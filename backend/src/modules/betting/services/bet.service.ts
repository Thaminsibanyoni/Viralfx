import { Injectable, Logger, InjectRepository } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { Bet, BetStatus, BetType } from '../entities/bet.entity';
import { BetAuditLog } from '../entities/bet-audit-log.entity';
import { BetStatusTransitionError } from '../exceptions/bet-status-transition.error';
import { LedgerService } from '../../wallet/services/ledger.service';

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
    @InjectRepository(Bet)
    private readonly betRepository: Repository<Bet>,
    @InjectRepository(BetAuditLog)
    private readonly auditLogRepository: Repository<BetAuditLog>,
    private readonly dataSource: DataSource,
    private readonly ledgerService: LedgerService,
  ) {}

  async updateBetStatus(
    betId: string,
    newStatus: BetStatus,
    reason?: string,
    metadata?: any,
    performedBy?: string,
  ): Promise<Bet> {
    return await this.dataSource.transaction(async manager => {
      // Query bet within transaction
      const bet = await manager.findOne(Bet, { where: { id: betId } });

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

      // Update bet status
      bet.status = newStatus;
      bet.updatedAt = new Date();

      // Set settlement timestamp if settling the bet
      if (newStatus === BetStatus.WON || newStatus === BetStatus.LOST) {
        bet.settledAt = new Date();
        bet.settlementReason = reason || `Bet ${newStatus.toLowerCase()}`;

        // Calculate and set actual payout
        if (newStatus === BetStatus.WON) {
          bet.actualPayout = bet.potentialPayout;
        } else {
          bet.actualPayout = 0;
        }
      }

      // Save bet within transaction
      const updatedBet = await manager.save(bet);

      // Create audit log entry
      const auditLog = manager.create(BetAuditLog, {
        betId,
        fromStatus: oldStatus,
        toStatus: newStatus,
        reason: reason || 'Status updated',
        userId: bet.userId,
        metadata: metadata || {},
        performedBy: performedBy || 'system',
        timestamp: new Date(),
      });

      await manager.save(auditLog);

      // Process payouts if bet is won or lost within the same transaction
      if (newStatus === BetStatus.WON || newStatus === BetStatus.LOST) {
        if (newStatus === BetStatus.WON) {
          // Process winnings through LedgerService
          await this.ledgerService.recordTransaction(
            bet.userId,
            'BET_WINNING',
            bet.actualPayout,
            `Winnings from bet ${betId}`,
            {
              betId,
              betType: bet.betType,
              originalAmount: bet.amount,
              odds: bet.odds,
            },
            manager, // Pass transaction manager
          );
        }

        // Log payout processing
        this.logger.log(
          `Processed ${newStatus.toLowerCase()} payout for bet ${betId}: ${bet.actualPayout} for user ${bet.userId}`
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
    betId?: string,
  ): void {
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
      betType?: BetType;
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
  ): Promise<{ items: Bet[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page = 1, limit = 20, status, betType, dateFrom, dateTo } = options;

    const queryBuilder = this.betRepository
      .createQueryBuilder('bet')
      .where('bet.userId = :userId', { userId })
      .leftJoinAndSelect('bet.trend', 'trend')
      .orderBy('bet.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('bet.status = :status', { status });
    }

    if (betType) {
      queryBuilder.andWhere('bet.betType = :betType', { betType });
    }

    if (dateFrom) {
      queryBuilder.andWhere('bet.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      queryBuilder.andWhere('bet.createdAt <= :dateTo', { dateTo });
    }

    const [items, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBetAuditLogs(
    betId: string,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ items: BetAuditLog[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page = 1, limit = 20 } = options;

    const [items, total] = await this.auditLogRepository
      .createQueryBuilder('auditLog')
      .where('auditLog.betId = :betId', { betId })
      .orderBy('auditLog.timestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createBet(
    userId: string,
    trendId: string,
    betType: BetType,
    amount: number,
    odds: number,
    betData?: any,
  ): Promise<Bet> {
    const potentialPayout = amount * odds;

    const bet = this.betRepository.create({
      userId,
      trendId,
      betType,
      amount,
      odds,
      potentialPayout,
      betData,
      status: BetStatus.PENDING,
    });

    const savedBet = await this.betRepository.save(bet);

    // Create initial audit log
    await this.auditLogRepository.save({
      betId: savedBet.id,
      fromStatus: null as any,
      toStatus: BetStatus.PENDING,
      reason: 'Bet created',
      userId,
      metadata: { betType, amount, odds, betData },
      performedBy: userId,
    });

    this.logger.log(`Created new bet ${savedBet.id} for user ${userId} with amount ${amount}`);

    return savedBet;
  }
}