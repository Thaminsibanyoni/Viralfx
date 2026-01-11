import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { BetStatusTransitionError } from '../exceptions/bet-status-transition.error';
import { LedgerService } from "../../wallet/services/ledger.service";
import { BetStatus } from '@prisma/client';

@Injectable()
export class BetService {
  private readonly logger = new Logger(BetService.name);

  // Define allowed status transitions
  private readonly allowedTransitions: Map<BetStatus, BetStatus[]> = new Map([
    [BetStatus.PENDING, [BetStatus.ACTIVE, BetStatus.CANCELLED]],
    [BetStatus.ACTIVE, [BetStatus.WON, BetStatus.LOST, BetStatus.CANCELLED, BetStatus.REFUNDED]],
    [BetStatus.WON, [BetStatus.REFUNDED]], // Only refund after winning for special cases
    [BetStatus.LOST, []], // No transitions allowed after loss
    [BetStatus.CANCELLED, [BetStatus.REFUNDED]],
    [BetStatus.REFUNDED, []], // Final state
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService) {}

  async updateBetStatus(
    betId: string,
    newStatus: BetStatus,
    reason?: string,
    metadata?: any,
    performedBy?: string): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      // Query bet within transaction
      const bet = await tx.bet.findUnique({ where: { id: betId } });

      if (!bet) {
        throw new Error(`Bet with ID ${betId} not found`);
      }

      const oldStatus = bet.status;

      // Validate transition
      this.validateStatusTransition(oldStatus, newStatus, betId);

      // If no actual status change, just log and return
      if (oldStatus === newStatus) {
        this.logger.warn(`Bet ${betId} already has status ${newStatus}, no change needed`);
        return bet;
      }

      // Prepare update data
      const updateData: any = {
        status: newStatus
      };

      // Set settlement timestamp if settling the bet
      if (newStatus === BetStatus.WON || newStatus === BetStatus.LOST) {
        updateData.settledAt = new Date();

        // Calculate and set actual payout
        if (newStatus === BetStatus.WON) {
          updateData.actualPayout = bet.potentialPayout;
        } else {
          updateData.actualPayout = 0;
        }
      }

      // Save bet within transaction
      const updatedBet = await tx.bet.update({
        where: { id: betId },
        data: updateData
      });

      // Create audit log entry if AuditLog model exists
      try {
        await tx.auditLog.create({
          data: {
            betId,
            action: 'STATUS_CHANGE',
            fromStatus: oldStatus,
            toStatus: newStatus,
            reason: reason || 'Status updated',
            userId: bet.userId,
            metadata: metadata || {},
            performedBy: performedBy || 'system'
          }
        });
      } catch (error) {
        // AuditLog might not exist or have different structure, log and continue
        this.logger.warn(`Could not create audit log: ${error.message}`);
      }

      // Process payouts if bet is won or lost within the same transaction
      if (newStatus === BetStatus.WON || newStatus === BetStatus.LOST) {
        if (newStatus === BetStatus.WON) {
          // Process winnings through LedgerService
          // Note: This assumes LedgerService has been updated for Prisma
          if (this.ledgerService && this.ledgerService.recordTransaction) {
            try {
              await this.ledgerService.recordTransaction(
                bet.userId,
                'BET_WINNING',
                Number(updatedBet.actualPayout),
                `Winnings from bet ${betId}`,
                {
                  betId,
                  side: bet.side,
                  originalAmount: Number(bet.stake),
                  odds: bet.odds
                }
              );
            } catch (error) {
              this.logger.error(`Failed to record transaction: ${error.message}`);
            }
          }
        }

        // Log payout processing
        this.logger.log(
          `Processed ${newStatus.toLowerCase()} payout for bet ${betId}: ${updatedBet.actualPayout} for user ${bet.userId}`
        );
      }

      // Comprehensive logging
      this.logger.log(
        `Bet ${betId} status transitioned from ${oldStatus} to ${newStatus} for user ${bet.userId}. Reason: ${reason || 'Status updated'}`
      );

      return updatedBet;
    });
  }

  private validateStatusTransition(
    fromStatus: BetStatus,
    toStatus: BetStatus,
    betId?: string): void {
    const allowedNewStatuses = this.allowedTransitions.get(fromStatus);

    if (!allowedNewStatuses || !allowedNewStatuses.includes(toStatus)) {
      throw new BetStatusTransitionError(fromStatus, toStatus, betId);
    }
  }

  async getBetHistory(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: BetStatus;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<{ items: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = options;

    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [items, total] = await Promise.all([
      this.prisma.bet.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          market: true
        }
      }),
      this.prisma.bet.count({ where })
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getBetAuditLogs(
    betId: string,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ items: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page = 1, limit = 20 } = options;

    try {
      const [items, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where: { betId },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { timestamp: 'desc' }
        }),
        this.prisma.auditLog.count({ where: { betId } })
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      // If AuditLog doesn't exist or has different structure
      this.logger.warn(`Could not fetch audit logs: ${error.message}`);
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
  }

  async createBet(
    userId: string,
    marketId: string,
    side: string,
    stake: number,
    odds: number,
    betData?: any
  ): Promise<any> {
    const potentialPayout = stake * odds;

    const bet = await this.prisma.bet.create({
      data: {
        userId,
        marketId,
        side,
        stake,
        odds,
        potentialPayout,
        hmacSignature: 'signature-placeholder', // TODO: Generate proper HMAC signature
        ipAddress: betData?.ipAddress,
        status: BetStatus.PENDING
      }
    });

    // Create initial audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          betId: bet.id,
          action: 'CREATE',
          toStatus: BetStatus.PENDING,
          reason: 'Bet created',
          userId,
          metadata: { side, stake, odds, betData },
          performedBy: userId
        }
      });
    } catch (error) {
      this.logger.warn(`Could not create audit log: ${error.message}`);
    }

    this.logger.log(`Created new bet ${bet.id} for user ${userId} with stake ${stake}`);

    return bet;
  }
}
