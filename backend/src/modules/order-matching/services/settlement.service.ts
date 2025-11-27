import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

import { WalletService } from '../../wallet/services/wallet.service';
import { LedgerService } from '../../wallet/services/ledger.service';
import { WebSocketGateway } from '../../websocket/gateways/websocket.gateway';
import { NotificationService } from '../../notification/services/notification.service';
import { Order } from '../../market-aggregation/entities/order.entity';
import {
  SettlementResult,
  RecordTransactionParams
} from '../interfaces/order-matching.interface';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly notificationService: NotificationService,
    @InjectQueue('order-settlement')
    private readonly settlementQueue: Queue,
  ) {}

  async settleBet(betId: string): Promise<SettlementResult> {
    try {
      this.logger.log(`Settling bet ${betId}`);

      // Get bet details
      const bet = await this.prisma.bet.findUnique({
        where: { id: betId },
        include: {
          market: true,
          user: true,
        },
      });

      if (!bet) {
        throw new Error(`Bet ${betId} not found`);
      }

      // Verify market is settled
      if (bet.market.status !== 'SETTLED') {
        throw new Error(`Market ${bet.marketId} is not settled`);
      }

      // Calculate payout based on bet outcome
      let payout = 0;
      let status = 'LOST';

      switch (bet.type) {
        case 'BACK':
          // Back bet wins if the selection matches the settlement
          if (bet.selection === bet.market.settlementValue) {
            payout = bet.stake * bet.odds;
            status = 'WON';
          }
          break;

        case 'LAY':
          // Lay bet wins if the selection does not match the settlement
          if (bet.selection !== bet.market.settlementValue) {
            payout = bet.stake;
            status = 'WON';
          }
          break;

        case 'YES_NO':
          // Yes/No bet wins if prediction matches settlement
          if ((bet.prediction === 'YES' && bet.market.settlementValue === '1') ||
              (bet.prediction === 'NO' && bet.market.settlementValue === '0')) {
            payout = bet.stake * bet.odds;
            status = 'WON';
          }
          break;

        default:
          // For unknown bet types, return stake (refund)
          payout = bet.stake;
          status = 'REFUNDED';
      }

      // Process payout if bet won or was refunded
      if (payout > 0) {
        const transactionParams: RecordTransactionParams = {
          walletId: null, // Will be set in wallet service
          userId: bet.userId,
          type: 'BET_PAYOUT',
          amount: payout,
          currency: bet.currency,
          description: `Bet payout - ${bet.type}:${bet.selection}`,
          metadata: {
            betId,
            marketId: bet.marketId,
            selection: bet.selection,
            odds: bet.odds,
            stake: bet.stake,
            status,
          },
          referenceId: betId,
          referenceType: 'BET',
        };

        // Process transaction
        await this.walletService.processTransaction(transactionParams);
      }

      // Update bet status
      await this.prisma.bet.update({
        where: { id: betId },
        data: {
          status,
          actualPayout: payout,
          settledAt: new Date(),
        },
      });

      // Create audit log
      await this.prisma.auditLog.create({
        data: {
          userId: bet.userId,
          action: 'BET_SETTLEMENT',
          entityType: 'BET',
          entityId: betId,
          details: {
            payout,
            status,
            marketSettlementValue: bet.market.settlementValue,
          },
        },
      });

      // Broadcast settlement to user
      await this.webSocketGateway.server?.to(`user:${bet.userId}`).emit('bet:settled', {
        betId,
        status,
        payout,
        timestamp: new Date(),
      });

      // Send notification
      await this.notificationService.sendNotification({
        userId: bet.userId,
        type: 'BET_SETTLED',
        title: status === 'WON' ? 'Bet Won!' : status === 'LOST' ? 'Bet Lost' : 'Bet Refunded',
        message: `Your bet on ${bet.selection} has been ${status.toLowerCase()}. Payout: ${payout} ${bet.currency}`,
        metadata: { betId, payout, status },
      });

      this.logger.log(`Bet ${betId} settled successfully with status ${status} and payout ${payout}`);

      return {
        success: true,
        betId,
        payout,
        status,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to settle bet ${betId}:`, error);
      throw error;
    }
  }

  async settleMarket(
    marketId: string,
    settlementValue: number,
    proof: any,
    signature?: string,
  ): Promise<void> {
    try {
      this.logger.log(`Settling market ${marketId} with value ${settlementValue}`);

      // Update market status
      await this.prisma.market.update({
        where: { id: marketId },
        data: {
          status: 'SETTLED',
          settlementValue,
          settlementProof: proof,
          settlementSignature: signature,
          settledAt: new Date(),
        },
      });

      // Get all active bets for this market
      const activeBets = await this.prisma.bet.findMany({
        where: {
          marketId,
          status: 'ACTIVE',
        },
      });

      // Queue settlement for each bet
      for (const bet of activeBets) {
        await this.settlementQueue.add(
          'settle-bet',
          { betId: bet.id },
          {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          }
        );
      }

      // Broadcast market settlement
      await this.webSocketGateway.server?.emit('market:settled', {
        marketId,
        settlementValue,
        timestamp: new Date(),
      });

      this.logger.log(`Market ${marketId} settled. Queued ${activeBets.length} bets for settlement`);
    } catch (error) {
      this.logger.error(`Failed to settle market ${marketId}:`, error);
      throw error;
    }
  }

  async processOrderSettlement(orderId: string): Promise<void> {
    try {
      this.logger.log(`Processing order settlement for ${orderId}`);

      // Get order with fills using TypeORM
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (order.status !== 'FILLED' || !order.fills || order.fills.length === 0) {
        this.logger.log(`Order ${orderId} is not filled, skipping settlement`);
        return;
      }

      const userWallet = await this.walletService.getOrCreateWallet(order.userId, 'ZAR');
      if (!userWallet) {
        throw new Error(`Wallet not found for user ${order.userId}`);
      }

      // Process each fill using TypeORM order entity
      for (const fill of order.fills) {
        const fillValue = fill.quantity * fill.price;

        if (order.side === 'SELL') {
          // For sell orders, credit the user's wallet
          await this.ledgerService.recordTransaction({
            walletId: userWallet.id,
            userId: order.userId,
            type: 'TRADE_SELL',
            amount: fillValue - (fill.commission + fill.fee),
            currency: 'ZAR',
            description: `Trade execution - ${order.symbol}`,
            metadata: {
              orderId,
              fillId: fill.id,
              quantity: fill.quantity,
              price: fill.price,
              commission: fill.commission,
              fee: fill.fee,
            },
            referenceId: orderId,
            referenceType: 'ORDER',
          });
        } else {
          // For buy orders, unlock remaining funds if any
          const lockedAmount = fillValue + (fill.commission + fill.fee);
          await this.walletService.unlockFunds(
            order.userId,
            lockedAmount,
            'ZAR',
            `Order ${orderId} fill processed`,
          );
        }
      }

      // Record commission and fee transactions using TypeORM order entity
      if (order.commission > 0) {
        await this.ledgerService.recordTransaction({
          walletId: userWallet.id,
          userId: order.userId,
          type: 'COMMISSION',
          amount: -order.commission,
          currency: 'ZAR',
          description: `Trading commission - ${order.symbol}`,
          metadata: { orderId },
          referenceId: orderId,
          referenceType: 'ORDER',
        });
      }

      if (order.fee > 0) {
        await this.ledgerService.recordTransaction({
          walletId: userWallet.id,
          userId: order.userId,
          type: 'FEE',
          amount: -order.fee,
          currency: 'ZAR',
          description: `Trading fee - ${order.symbol}`,
          metadata: { orderId },
          referenceId: orderId,
          referenceType: 'ORDER',
        });
      }

      this.logger.log(`Order ${orderId} settlement processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process order settlement for ${orderId}:`, error);
      throw error;
    }
  }

  async bulkSettleBets(marketId: string): Promise<void> {
    try {
      this.logger.log(`Bulk settling bets for market ${marketId}`);

      const market = await this.prisma.market.findUnique({
        where: { id: marketId },
      });

      if (!market || market.status !== 'SETTLED') {
        throw new Error(`Market ${marketId} is not settled`);
      }

      // Get all unsettled active bets
      const unsettledBets = await this.prisma.bet.findMany({
        where: {
          marketId,
          status: 'ACTIVE',
          settledAt: null,
        },
      });

      this.logger.log(`Found ${unsettledBets.length} unsettled bets for market ${marketId}`);

      // Queue all settlements for parallel processing
      const settlementJobs = unsettledBets.map(bet =>
        this.settlementQueue.add(
          'settle-bet',
          { betId: bet.id },
          {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 3000,
            },
            delay: Math.random() * 1000, // Add small delay to prevent overwhelming
          }
        )
      );

      await Promise.all(settlementJobs);

      this.logger.log(`Queued ${settlementJobs.length} bet settlements for market ${marketId}`);
    } catch (error) {
      this.logger.error(`Failed to bulk settle bets for market ${marketId}:`, error);
      throw error;
    }
  }

  async retryFailedSettlements(): Promise<void> {
    try {
      this.logger.log('Retrying failed settlements');

      // Get failed bets from the last hour
      const failedBets = await this.prisma.bet.findMany({
        where: {
          status: 'ACTIVE',
          market: {
            status: 'SETTLED',
          },
          updatedAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      });

      if (failedBets.length > 0) {
        this.logger.log(`Found ${failedBets.length} failed bets to retry`);

        for (const bet of failedBets) {
          await this.settlementQueue.add(
            'settle-bet',
            { betId: bet.id },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 10000,
              },
            }
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to retry failed settlements:', error);
    }
  }
}