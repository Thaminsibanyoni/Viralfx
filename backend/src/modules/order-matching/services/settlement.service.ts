import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { WalletService } from "../../wallet/services/wallet.service";
import { LedgerService } from "../../wallet/services/ledger.service";
import { NotificationService } from "../../notifications/services/notification.service";
import {
  SettlementResult,
  RecordTransactionParams
} from '../interfaces/order-matching.interface';

interface OrderFill {
  id: string;
  quantity: number;
  price: number;
  commission: number;
  fee: number;
  timestamp: Date;
  tradeId?: string;
}

interface DbOrder {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  price?: number;
  status: string;
  filled_quantity?: number;
  remaining_quantity?: number;
  fills?: any;
  commission?: number;
  fee?: number;
  avg_fill_price?: number;
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
    private readonly notificationService: NotificationService,
    @InjectQueue('order-settlement')
    private readonly settlementQueue: Queue) {}

  async settleBet(betId: string): Promise<SettlementResult> {
    try {
      this.logger.log(`Settling bet ${betId}`);

      // Get bet details with relations
      const bet = await this.prisma.bet.findUnique({
        where: { id: betId },
        include: {
          market: true,
          user: true
        }
      });

      if (!bet) {
        throw new Error(`Bet ${betId} not found`);
      }

      // Verify market is settled
      if (bet.market?.status !== 'SETTLED') {
        throw new Error(`Market ${bet.marketId} is not settled`);
      }

      // Calculate payout based on bet outcome
      let payout = 0;
      let status = 'LOST';

      switch (bet.betType) {
        case 'BACK':
          // Back bet wins if the selection matches the settlement
          if (bet.selection === bet.market.settlementValue) {
            payout = Number(bet.stake) * Number(bet.odds);
            status = 'WON';
          }
          break;

        case 'LAY':
          // Lay bet wins if the selection does not match the settlement
          if (bet.selection !== bet.market.settlementValue) {
            payout = Number(bet.stake);
            status = 'WON';
          }
          break;

        case 'YES_NO':
          // Yes/No bet wins if prediction matches settlement
          if ((bet.prediction === 'YES' && bet.market.settlementValue === '1') ||
              (bet.prediction === 'NO' && bet.market.settlementValue === '0')) {
            payout = Number(bet.stake) * Number(bet.odds);
            status = 'WON';
          }
          break;

        default:
          // For unknown bet types, return stake (refund)
          payout = Number(bet.stake);
          status = 'REFUNDED';
      }

      // Process payout if bet won or was refunded
      if (payout > 0) {
        const transactionParams: RecordTransactionParams = {
          walletId: null, // Will be set in wallet service
          userId: bet.userId,
          type: 'BET_PAYOUT',
          amount: payout,
          currency: bet.currency || 'ZAR',
          description: `Bet payout - ${bet.betType}:${bet.selection}`,
          metadata: {
            betId,
            marketId: bet.marketId,
            selection: bet.selection,
            odds: Number(bet.odds),
            stake: Number(bet.stake),
            status
          },
          referenceId: betId,
          referenceType: 'BET'
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
          settledAt: new Date()
        }
      });

      // Create audit log
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: bet.userId,
            action: 'BET_SETTLEMENT',
            entityType: 'BET',
            entityId: betId,
            details: {
              payout,
              status,
              marketSettlementValue: bet.market.settlementValue
            }
          }
        });
      } catch (auditError) {
        this.logger.warn(`Failed to create audit log for bet ${betId}:`, auditError);
      }

      // Broadcast settlement to user
      try {
        await this.webSocketGateway.server?.to(`user:${bet.userId}`).emit('bet:settled', {
          betId,
          status,
          payout,
          timestamp: new Date()
        });
      } catch (wsError) {
        this.logger.warn(`Failed to broadcast bet settlement for ${betId}:`, wsError);
      }

      // Send notification
      try {
        await this.notificationService.sendNotification({
          userId: bet.userId,
          type: 'BET_SETTLED',
          title: status === 'WON' ? 'Bet Won!' : status === 'LOST' ? 'Bet Lost' : 'Bet Refunded',
          message: `Your bet on ${bet.selection} has been ${status.toLowerCase()}. Payout: ${payout} ${bet.currency || 'ZAR'}`,
          metadata: { betId, payout, status }
        });
      } catch (notifError) {
        this.logger.warn(`Failed to send notification for bet ${betId}:`, notifError);
      }

      this.logger.log(`Bet ${betId} settled successfully with status ${status} and payout ${payout}`);

      return {
        success: true,
        betId,
        payout,
        status,
        timestamp: new Date()
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
    signature?: string): Promise<void> {
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
          settledAt: new Date()
        }
      });

      // Get all active bets for this market
      const activeBets = await this.prisma.bet.findMany({
        where: {
          marketId,
          status: 'ACTIVE'
        }
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
              delay: 5000
            }
          }
        );
      }

      // Broadcast market settlement
      try {
        await this.webSocketGateway.server?.emit('market:settled', {
          marketId,
          settlementValue,
          timestamp: new Date()
        });
      } catch (wsError) {
        this.logger.warn(`Failed to broadcast market settlement for ${marketId}:`, wsError);
      }

      this.logger.log(`Market ${marketId} settled. Queued ${activeBets.length} bets for settlement`);
    } catch (error) {
      this.logger.error(`Failed to settle market ${marketId}:`, error);
      throw error;
    }
  }

  async processOrderSettlement(orderId: string): Promise<void> {
    try {
      this.logger.log(`Processing order settlement for ${orderId}`);

      // Get order from database
      const order = await this.prisma.order.findFirst({
        where: { id: orderId }
      }) as DbOrder | null;

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (order.status !== 'FILLED' || !order.fills || (Array.isArray(order.fills) && order.fills.length === 0)) {
        this.logger.log(`Order ${orderId} is not filled, skipping settlement`);
        return;
      }

      const userWallet = await this.walletService.getOrCreateWallet(order.userId, 'ZAR');
      if (!userWallet) {
        throw new Error(`Wallet not found for user ${order.userId}`);
      }

      // Process each fill
      const fills: OrderFill[] = Array.isArray(order.fills) ? order.fills : [];
      for (const fill of fills) {
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
              fee: fill.fee
            },
            referenceId: orderId,
            referenceType: 'ORDER'
          });
        } else {
          // For buy orders, unlock remaining funds if any
          const lockedAmount = fillValue + (fill.commission + fill.fee);
          try {
            await this.walletService.unlockFunds(
              order.userId,
              lockedAmount,
              'ZAR',
              `Order ${orderId} fill processed`
            );
          } catch (unlockError) {
            this.logger.warn(`Failed to unlock funds for order ${orderId}:`, unlockError);
          }
        }
      }

      // Record commission and fee transactions
      if (order.commission && order.commission > 0) {
        await this.ledgerService.recordTransaction({
          walletId: userWallet.id,
          userId: order.userId,
          type: 'COMMISSION',
          amount: -Number(order.commission),
          currency: 'ZAR',
          description: `Trading commission - ${order.symbol}`,
          metadata: { orderId },
          referenceId: orderId,
          referenceType: 'ORDER'
        });
      }

      if (order.fee && order.fee > 0) {
        await this.ledgerService.recordTransaction({
          walletId: userWallet.id,
          userId: order.userId,
          type: 'FEE',
          amount: -Number(order.fee),
          currency: 'ZAR',
          description: `Trading fee - ${order.symbol}`,
          metadata: { orderId },
          referenceId: orderId,
          referenceType: 'ORDER'
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
        where: { id: marketId }
      });

      if (!market || market.status !== 'SETTLED') {
        throw new Error(`Market ${marketId} is not settled`);
      }

      // Get all unsettled active bets
      const unsettledBets = await this.prisma.bet.findMany({
        where: {
          marketId,
          status: 'ACTIVE',
          settledAt: null
        }
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
              delay: 3000
            },
            delay: Math.random() * 1000 // Add small delay to prevent overwhelming
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
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const failedBets = await this.prisma.bet.findMany({
        where: {
          status: 'ACTIVE',
          market: {
            status: 'SETTLED'
          },
          updatedAt: {
            gte: oneHourAgo
          }
        }
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
                delay: 10000
              }
            }
          );
        }
      } else {
        this.logger.log('No failed bets to retry');
      }
    } catch (error) {
      this.logger.error('Failed to retry failed settlements:', error);
    }
  }

  /**
   * Get settlement statistics for a market
   */
  async getMarketSettlementStats(marketId: string): Promise<{
    totalBets: number;
    settledBets: number;
    pendingBets: number;
    totalPayout: number;
    winningBets: number;
    losingBets: number;
  }> {
    try {
      const [totalBets, settledBets, pendingBets, winningBets, losingBets] = await Promise.all([
        this.prisma.bet.count({ where: { marketId } }),
        this.prisma.bet.count({ where: { marketId, status: { in: ['WON', 'LOST', 'REFUNDED'] } } }),
        this.prisma.bet.count({ where: { marketId, status: 'ACTIVE' } }),
        this.prisma.bet.count({ where: { marketId, status: 'WON' } }),
        this.prisma.bet.count({ where: { marketId, status: 'LOST' } })
      ]);

      const settledBetRecords = await this.prisma.bet.findMany({
        where: {
          marketId,
          status: { in: ['WON', 'LOST', 'REFUNDED'] }
        },
        select: { actualPayout: true }
      });

      const totalPayout = settledBetRecords.reduce(
        (sum, bet) => sum + (bet.actualPayout || 0),
        0
      );

      return {
        totalBets,
        settledBets,
        pendingBets,
        totalPayout,
        winningBets,
        losingBets
      };
    } catch (error) {
      this.logger.error(`Failed to get settlement stats for market ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Get user settlement history
   */
  async getUserSettlementHistory(userId: string, limit: number = 50, offset: number = 0): Promise<{
    settlements: any[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const [settlements, total] = await Promise.all([
        this.prisma.bet.findMany({
          where: {
            userId,
            status: { in: ['WON', 'LOST', 'REFUNDED'] }
          },
          orderBy: { settledAt: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.bet.count({
          where: {
            userId,
            status: { in: ['WON', 'LOST', 'REFUNDED'] }
          }
        })
      ]);

      return {
        settlements,
        total,
        hasMore: offset + settlements.length < total
      };
    } catch (error) {
      this.logger.error(`Failed to get settlement history for user ${userId}:`, error);
      throw error;
    }
  }
}
