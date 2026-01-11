import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WalletService } from "../../wallet/services/wallet.service";

interface PlaceBetData {
  userId: string;
  marketId: string;
  outcomeId: string;
  amount: number;
  odds?: number;
  metadata?: any;
}

interface BetResult {
  id: string;
  userId: string;
  marketId: string;
  outcomeId: string;
  amount: number;
  odds: number;
  potentialPayout: number;
  status: 'PENDING' | 'WON' | 'LOST';
  createdAt: Date;
  settledAt?: Date;
  actualPayout?: number;
}

@Injectable()
export class BettingService {
  private readonly logger = new Logger(BettingService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
    private readonly walletService: WalletService,
    @InjectQueue('bet-processing')
    private readonly betProcessingQueue: Queue) {}

  async placeBet(placeBetData: PlaceBetData): Promise<BetResult> {
    const { userId, marketId, outcomeId, amount, odds, metadata } = placeBetData;

    try {
      // Validate market exists and is active
      const market = await this.prisma.market.findUnique({
        where: { id: marketId },
        include: { outcomes: true }
      });

      if (!market) {
        throw new NotFoundException('Market not found');
      }

      if (market.status !== 'ACTIVE') {
        throw new BadRequestException('Market is not active for betting');
      }

      if (new Date() >= new Date(market.endDate)) {
        throw new BadRequestException('Market has expired');
      }

      // Validate outcome belongs to market
      const outcome = market.outcomes.find(o => o.id === outcomeId);
      if (!outcome) {
        throw new NotFoundException('Outcome not found in this market');
      }

      // Validate bet amount
      if (amount < market.minBetAmount) {
        throw new BadRequestException(`Bet amount must be at least ${market.minBetAmount}`);
      }

      if (market.maxBetAmount && amount > market.maxBetAmount) {
        throw new BadRequestException(`Bet amount cannot exceed ${market.maxBetAmount}`);
      }

      // Check if user has sufficient balance
      const userBalance = await this.walletService.getBalance(userId);
      if (userBalance.available < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      // Check for existing bet (optional - some markets allow multiple bets)
      const existingBet = await this.prisma.bet.findFirst({
        where: {
          userId,
          marketId,
          outcomeId,
          status: 'PENDING'
        }
      });

      if (existingBet) {
        throw new ConflictException('You already have a pending bet on this outcome');
      }

      // Calculate potential payout
      const currentOdds = odds || this.calculateOdds(outcome.probability);
      const potentialPayout = Math.floor(amount * currentOdds * 100) / 100; // Round to 2 decimal places

      // Start database transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Freeze user funds
        await this.walletService.freezeFunds(userId, amount, tx);

        // Create bet record
        const bet = await tx.bet.create({
          data: {
            userId,
            marketId,
            outcomeId,
            amount,
            odds: currentOdds,
            potentialPayout,
            status: 'PENDING',
            metadata: metadata || {},
            createdAt: new Date()
          }
        });

        // Update market volume
        await tx.market.update({
          where: { id: marketId },
          data: {
            totalVolume: { increment: amount }
          }
        });

        // Update outcome volume
        await tx.marketOutcome.update({
          where: { id: outcomeId },
          data: {
            totalVolume: { increment: amount }
          }
        });

        // Update market prices (bet patterns affect probabilities)
        // This will be handled asynchronously

        return bet;
      });

      // Queue bet processing for market price updates
      await this.betProcessingQueue.add('process-new-bet', {
        betId: result.id,
        marketId,
        outcomeId,
        amount,
        userId
      });

      // Cache bet data
      await this.cacheBetData(result.id);

      this.logger.log(`Bet placed: ${result.id} - ${userId} bet ${amount} on ${market.title}`);

      return {
        id: result.id,
        userId: result.userId,
        marketId: result.marketId,
        outcomeId: result.outcomeId,
        amount: result.amount,
        odds: result.odds,
        potentialPayout: result.potentialPayout,
        status: result.status as 'PENDING' | 'WON' | 'LOST',
        createdAt: result.createdAt
      };
    } catch (error) {
      this.logger.error(`Failed to place bet for user ${userId}:`, error);
      throw error;
    }
  }

  async getBet(betId: string, userId?: string): Promise<BetResult> {
    const cacheKey = `bet:${betId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const whereClause: any = { id: betId };
    if (userId) {
      whereClause.userId = userId;
    }

    const bet = await this.prisma.bet.findFirst({
      where: whereClause,
      include: {
        user: {
          select: { id: true, username: true }
        },
        market: {
          select: { id: true, title: true, status: true }
        },
        outcome: {
          select: { id: true, title: true, isWinning: true }
        }
      }
    });

    if (!bet) {
      throw new NotFoundException('Bet not found');
    }

    const betResult: BetResult = {
      id: bet.id,
      userId: bet.userId,
      marketId: bet.marketId,
      outcomeId: bet.outcomeId,
      amount: bet.amount,
      odds: bet.odds,
      potentialPayout: bet.potentialPayout,
      status: bet.status as 'PENDING' | 'WON' | 'LOST',
      createdAt: bet.createdAt,
      settledAt: bet.settledAt || undefined,
      actualPayout: bet.actualPayout || undefined
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(betResult));
    return betResult;
  }

  async getUserBets(
    userId: string,
    filters: {
      status?: 'PENDING' | 'WON' | 'LOST';
      marketId?: string;
    } = {},
    pagination: {
      page: number;
      limit: number;
    } = { page: 1, limit: 20 }): Promise<{
    bets: BetResult[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (pagination.page - 1) * pagination.limit;
    const whereClause: any = { userId };

    if (filters.status) {
      whereClause.status = filters.status;
    }
    if (filters.marketId) {
      whereClause.marketId = filters.marketId;
    }

    const [bets, total] = await Promise.all([
      this.prisma.bet.findMany({
        where: whereClause,
        include: {
          market: {
            select: { id: true, title: true, status: true }
          },
          outcome: {
            select: { id: true, title: true, isWinning: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.limit
      }),
      this.prisma.bet.count({ where: whereClause }),
    ]);

    const betResults: BetResult[] = bets.map(bet => ({
      id: bet.id,
      userId: bet.userId,
      marketId: bet.marketId,
      outcomeId: bet.outcomeId,
      amount: bet.amount,
      odds: bet.odds,
      potentialPayout: bet.potentialPayout,
      status: bet.status as 'PENDING' | 'WON' | 'LOST',
      createdAt: bet.createdAt,
      settledAt: bet.settledAt || undefined,
      actualPayout: bet.actualPayout || undefined
    }));

    return {
      bets: betResults,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  async getMarketBets(marketId: string): Promise<{
    totalBets: number;
    totalVolume: number;
    uniqueBettors: number;
    betsByOutcome: Array<{
      outcomeId: string;
      outcomeTitle: string;
      betCount: number;
      totalAmount: number;
      percentage: number;
    }>;
  }> {
    const bets = await this.prisma.bet.findMany({
      where: { marketId },
      include: {
        outcome: {
          select: { id: true, title: true }
        }
      }
    });

    const totalBets = bets.length;
    const totalVolume = bets.reduce((sum, bet) => sum + bet.amount, 0);
    const uniqueBettors = new Set(bets.map(bet => bet.userId)).size;

    // Group bets by outcome
    const betsByOutcome = bets.reduce((acc, bet) => {
      const key = bet.outcomeId;
      if (!acc[key]) {
        acc[key] = {
          outcomeId: bet.outcomeId,
          outcomeTitle: bet.outcome.title,
          betCount: 0,
          totalAmount: 0
        };
      }
      acc[key].betCount++;
      acc[key].totalAmount += bet.amount;
      return acc;
    }, {} as Record<string, any>);

    // Add percentages
    Object.values(betsByOutcome).forEach(outcome => {
      outcome.percentage = totalVolume > 0 ? (outcome.totalAmount / totalVolume) * 100 : 0;
    });

    return {
      totalBets,
      totalVolume,
      uniqueBettors,
      betsByOutcome: Object.values(betsByOutcome)
    };
  }

  async cancelBet(betId: string, userId: string): Promise<void> {
    try {
      const bet = await this.prisma.bet.findFirst({
        where: {
          id: betId,
          userId,
          status: 'PENDING'
        },
        include: {
          market: {
            select: { status: true, endDate: true }
          }
        }
      });

      if (!bet) {
        throw new NotFoundException('Bet not found or cannot be cancelled');
      }

      // Check if market is still active and hasn't expired
      if (bet.market.status !== 'ACTIVE') {
        throw new BadRequestException('Cannot cancel bet - market is no longer active');
      }

      if (new Date() >= new Date(bet.market.endDate)) {
        throw new BadRequestException('Cannot cancel bet - market has expired');
      }

      // Use transaction to ensure data consistency
      await this.prisma.$transaction(async (tx) => {
        // Unfreeze user funds
        await this.walletService.unfreezeFunds(userId, bet.amount, tx);

        // Update bet status
        await tx.bet.update({
          where: { id: betId },
          data: {
            status: 'CANCELLED',
            settledAt: new Date(),
            metadata: {
              cancelledAt: new Date().toISOString(),
              reason: 'User cancellation'
            }
          }
        });

        // Update market volume (decrement)
        await tx.market.update({
          where: { id: bet.marketId },
          data: {
            totalVolume: { decrement: bet.amount }
          }
        });

        // Update outcome volume (decrement)
        await tx.marketOutcome.update({
          where: { id: bet.outcomeId },
          data: {
            totalVolume: { decrement: bet.amount }
          }
        });
      });

      // Invalidate cache
      await this.redis.del(`bet:${betId}`);

      this.logger.log(`Bet cancelled: ${betId} by user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel bet ${betId}:`, error);
      throw error;
    }
  }

  async getUserBettingStats(userId: string): Promise<{
    totalBets: number;
    totalAmount: number;
    totalWon: number;
    totalLost: number;
    totalPayouts: number;
    winRate: number;
    roi: number;
    favoriteCategories: Array<{
      category: string;
      betCount: number;
      winRate: number;
    }>;
  }> {
    const bets = await this.prisma.bet.findMany({
      where: { userId },
      include: {
        market: {
          select: { category: true }
        }
      }
    });

    const totalBets = bets.length;
    const totalAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

    const wonBets = bets.filter(bet => bet.status === 'WON');
    const lostBets = bets.filter(bet => bet.status === 'LOST');

    const totalWon = wonBets.length;
    const totalLost = lostBets.length;
    const totalPayouts = wonBets.reduce((sum, bet) => sum + (bet.actualPayout || 0), 0);

    const winRate = totalBets > 0 ? (totalWon / totalBets) * 100 : 0;
    const roi = totalAmount > 0 ? ((totalPayouts - totalAmount) / totalAmount) * 100 : 0;

    // Calculate favorite categories
    const categoryStats = bets.reduce((acc, bet) => {
      const category = bet.market.category || 'OTHER';
      if (!acc[category]) {
        acc[category] = { betCount: 0, wonCount: 0 };
      }
      acc[category].betCount++;
      if (bet.status === 'WON') {
        acc[category].wonCount++;
      }
      return acc;
    }, {} as Record<string, { betCount: number; wonCount: number }>);

    const favoriteCategories = Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      betCount: stats.betCount,
      winRate: stats.betCount > 0 ? (stats.wonCount / stats.betCount) * 100 : 0
    })).sort((a, b) => b.betCount - a.betCount).slice(0, 5);

    return {
      totalBets,
      totalAmount,
      totalWon,
      totalLost,
      totalPayouts,
      winRate: Math.round(winRate * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      favoriteCategories
    };
  }

  async updateBetOdds(betId: string, newOdds: number): Promise<void> {
    try {
      const bet = await this.prisma.bet.findUnique({
        where: { id: betId }
      });

      if (!bet) {
        throw new NotFoundException('Bet not found');
      }

      if (bet.status !== 'PENDING') {
        throw new BadRequestException('Cannot update odds for settled or cancelled bet');
      }

      // Calculate new potential payout
      const newPotentialPayout = Math.floor(bet.amount * newOdds * 100) / 100;

      await this.prisma.bet.update({
        where: { id: betId },
        data: {
          odds: newOdds,
          potentialPayout: newPotentialPayout,
          metadata: {
            ...bet.metadata,
            oddsHistory: [
              ...(bet.metadata?.oddsHistory || []),
              {
                oldOdds: bet.odds,
                newOdds,
                timestamp: new Date().toISOString()
              },
            ]
          }
        }
      });

      // Invalidate cache
      await this.redis.del(`bet:${betId}`);

      this.logger.log(`Updated odds for bet ${betId}: ${bet.odds} -> ${newOdds}`);
    } catch (error) {
      this.logger.error(`Failed to update odds for bet ${betId}:`, error);
      throw error;
    }
  }

  private calculateOdds(probability: number): number {
    // Convert probability to decimal odds
    // Ensure minimum odds of 1.01 to prevent division by zero
    return Math.max(1.01, 1 / probability);
  }

  private async cacheBetData(betId: string): Promise<void> {
    // Cache would be populated with bet data
    await this.redis.setex(`bet:${betId}`, this.CACHE_TTL, JSON.stringify({}));
  }
}
