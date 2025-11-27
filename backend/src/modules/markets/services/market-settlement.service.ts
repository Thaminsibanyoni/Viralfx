import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Redis } from 'ioredis';
import { WalletService } from '../../wallet/services/wallet.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

interface SettlementData {
  marketId: string;
  reason?: string;
  winningOutcomeId?: string;
  settlementMethod?: 'MANUAL' | 'AUTOMATIC';
  settlementData?: any;
}

interface SettlementResult {
  marketId: string;
  totalBets: number;
  totalVolume: number;
  winningOutcomeId: string;
  totalPayouts: number;
  winningBets: number;
  losingBets: number;
  settledAt: Date;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errors?: string[];
}

@Injectable()
export class MarketSettlementService {
  private readonly logger = new Logger(MarketSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async settleMarket(settlementData: SettlementData): Promise<SettlementResult> {
    const { marketId, reason, winningOutcomeId, settlementMethod = 'AUTOMATIC' } = settlementData;

    try {
      this.logger.log(`Starting settlement for market ${marketId}`);

      // Get market with all related data
      const market = await this.prisma.market.findUnique({
        where: { id: marketId },
        include: {
          outcomes: true,
          bets: {
            include: {
              user: {
                select: { id: true, username: true, email: true },
              },
              outcome: true,
            },
          },
          topic: {
            select: { id: true, name: true },
          },
        },
      });

      if (!market) {
        throw new NotFoundException('Market not found');
      }

      if (market.status === 'SETTLED') {
        throw new BadRequestException('Market has already been settled');
      }

      if (market.status === 'PENDING') {
        throw new BadRequestException('Market is not yet active');
      }

      // Determine winning outcome
      const winningOutcome = winningOutcomeId
        ? market.outcomes.find(o => o.id === winningOutcomeId)
        : await this.determineWinningOutcome(market, settlementData);

      if (!winningOutcome) {
        throw new BadRequestException('Could not determine winning outcome');
      }

      // Calculate settlement results
      const settlementResult = await this.processSettlement(market, winningOutcome, reason);

      // Update market status
      await this.prisma.market.update({
        where: { id: marketId },
        data: {
          status: 'SETTLED',
          metadata: {
            ...market.metadata,
            settlement: {
              settledAt: settlementResult.settledAt.toISOString(),
              winningOutcomeId: winningOutcome.id,
              settlementMethod,
              reason: reason || 'Market expiration',
              totalPayouts: settlementResult.totalPayouts,
              winningBets: settlementResult.winningBets,
              losingBets: settlementResult.losingBets,
              errors: settlementResult.errors,
            },
          },
        },
      });

      // Send notifications to all bettors
      await this.sendSettlementNotifications(market, winningOutcome, settlementResult);

      this.logger.log(`Market settlement completed: ${marketId} - Total payouts: ${settlementResult.totalPayouts}`);

      return settlementResult;
    } catch (error) {
      this.logger.error(`Failed to settle market ${marketId}:`, error);
      throw error;
    }
  }

  async processPartialSettlement(marketId: string, winningOutcomeId: string): Promise<SettlementResult> {
    this.logger.log(`Processing partial settlement for market ${marketId}`);

    // Get only winning bets to process
    const winningBets = await this.prisma.bet.findMany({
      where: {
        marketId,
        outcomeId: winningOutcomeId,
        status: 'PENDING',
      },
      include: {
        user: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    let processedBets = 0;
    let totalPayouts = 0;
    const errors: string[] = [];

    for (const bet of winningBets) {
      try {
        await this.processWinningBet(bet);
        processedBets++;
        totalPayouts += bet.actualPayout || 0;
      } catch (error) {
        this.logger.error(`Failed to process winning bet ${bet.id}:`, error);
        errors.push(`Bet ${bet.id}: ${error.message}`);
      }
    }

    return {
      marketId,
      totalBets: winningBets.length,
      totalVolume: winningBets.reduce((sum, bet) => sum + bet.amount, 0),
      winningOutcomeId,
      totalPayouts,
      winningBets: processedBets,
      losingBets: 0,
      settledAt: new Date(),
      status: errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
      errors,
    };
  }

  async getSettlementHistory(marketId: string): Promise<Array<{
    timestamp: Date;
    action: string;
    details: any;
    userId?: string;
  }>> {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      select: {
        metadata: true,
        bets: {
          select: {
            settledAt: true,
            status: true,
            actualPayout: true,
            metadata: true,
            userId: true,
          },
          orderBy: { settledAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!market) {
      throw new NotFoundException('Market not found');
    }

    const history: Array<{
      timestamp: Date;
      action: string;
      details: any;
      userId?: string;
    }> = [];

    // Add settlement event
    if (market.metadata?.settlement) {
      history.push({
        timestamp: new Date(market.metadata.settlement.settledAt),
        action: 'MARKET_SETTLED',
        details: market.metadata.settlement,
      });
    }

    // Add individual bet settlements
    market.bets.forEach(bet => {
      if (bet.settledAt) {
        history.push({
          timestamp: bet.settledAt,
          action: `BET_${bet.status}`,
          details: {
            betId: bet.id,
            status: bet.status,
            payout: bet.actualPayout,
            metadata: bet.metadata,
          },
          userId: bet.userId,
        });
      }
    });

    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async verifySettlement(settlementId: string): Promise<{
    isValid: boolean;
    discrepancies: Array<{
      betId: string;
      issue: string;
      expectedAmount: number;
      actualAmount: number;
    }>;
    summary: {
      totalBets: number;
      verifiedBets: number;
      disputedBets: number;
    };
  }> {
    // This would implement verification logic
    // For now, return mock data
    return {
      isValid: true,
      discrepancies: [],
      summary: {
        totalBets: 0,
        verifiedBets: 0,
        disputedBets: 0,
      },
    };
  }

  private async determineWinningOutcome(market: any, settlementData: SettlementData): Promise<any> {
    // This is where market-specific logic would determine the winner
    // For now, implement basic logic based on market type and external data

    switch (market.marketType) {
      case 'BINARY':
        return await this.determineBinaryWinner(market, settlementData);
      case 'MULTIPLE_CHOICE':
        return await this.determineMultipleChoiceWinner(market, settlementData);
      default:
        throw new BadRequestException(`Unsupported market type for automatic settlement: ${market.marketType}`);
    }
  }

  private async determineBinaryWinner(market: any, settlementData: SettlementData): Promise<any> {
    // For binary markets, determine winner based on:
    // 1. Explicit winning outcome provided
    // 2. External data (sentiment, viral metrics, etc.)
    // 3. Default to NO if inconclusive

    if (settlementData.winningOutcomeId) {
      const outcome = market.outcomes.find((o: any) => o.id === settlementData.winningOutcomeId);
      if (outcome) return outcome;
    }

    // Get external data for automatic determination
    const [sentimentData, viralData] = await Promise.all([
      this.getExternalSentiment(market.topicId),
      this.getExternalViralData(market.topicId),
    ]);

    // Simple logic: if sentiment is positive AND viral index is high, choose YES
    const sentimentScore = sentimentData.score || 0.5;
    const viralScore = viralData.index || 0.5;

    const combinedScore = (sentimentScore + viralScore) / 2;

    // Choose YES if score > 0.6, otherwise NO
    const winnerTitle = combinedScore > 0.6 ? 'YES' : 'NO';

    return market.outcomes.find((o: any) => o.title === winnerTitle) || market.outcomes[1]; // Default to NO
  }

  private async determineMultipleChoiceWinner(market: any, settlementData: SettlementData): Promise<any> {
    // For multiple choice, determine based on:
    // 1. Explicit winning outcome provided
    // 2. Most popular bet (if applicable)
    // 3. External data analysis
    // 4. Default to first option

    if (settlementData.winningOutcomeId) {
      const outcome = market.outcomes.find((o: any) => o.id === settlementData.winningOutcomeId);
      if (outcome) return outcome;
    }

    // For now, return the first outcome as default
    // In a real implementation, this would be more sophisticated
    return market.outcomes[0];
  }

  private async processSettlement(market: any, winningOutcome: any, reason?: string): Promise<SettlementResult> {
    const winningBets = market.bets.filter(bet => bet.outcomeId === winningOutcome.id);
    const losingBets = market.bets.filter(bet => bet.outcomeId !== winningOutcome.id);

    let processedWins = 0;
    let processedLosses = 0;
    let totalPayouts = 0;
    const errors: string[] = [];

    // Process winning bets
    for (const bet of winningBets) {
      try {
        await this.processWinningBet(bet);
        processedWins++;
        totalPayouts += bet.actualPayout || 0;
      } catch (error) {
        this.logger.error(`Failed to process winning bet ${bet.id}:`, error);
        errors.push(`Bet ${bet.id}: ${error.message}`);
      }
    }

    // Process losing bets
    for (const bet of losingBets) {
      try {
        await this.processLosingBet(bet);
        processedLosses++;
      } catch (error) {
        this.logger.error(`Failed to process losing bet ${bet.id}:`, error);
        errors.push(`Bet ${bet.id}: ${error.message}`);
      }
    }

    return {
      marketId: market.id,
      totalBets: market.bets.length,
      totalVolume: market.totalVolume,
      winningOutcomeId: winningOutcome.id,
      totalPayouts,
      winningBets: processedWins,
      losingBets: processedLosses,
      settledAt: new Date(),
      status: errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
      errors,
    };
  }

  private async processWinningBet(bet: any): Promise<void> {
    const actualPayout = Math.floor(bet.potentialPayout * 100) / 100;

    await this.prisma.$transaction(async (tx) => {
      // Update bet status
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: 'WON',
          actualPayout,
          settledAt: new Date(),
          metadata: {
            ...bet.metadata,
            settledAt: new Date().toISOString(),
            processingTime: Date.now(),
          },
        },
      });

      // Unfreeze funds and add winnings to user wallet
      await this.walletService.unfreezeFunds(bet.userId, bet.amount, tx);
      await this.walletService.addFunds(bet.userId, actualPayout, tx, {
        source: 'BET_WINNINGS',
        reference: bet.id,
        description: `Winnings from bet on ${bet.market?.title || 'unknown market'}`,
      });

      // Update user statistics
      await this.updateUserStats(bet.userId, 'WIN', bet.amount, actualPayout);
    });
  }

  private async processLosingBet(bet: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Update bet status
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: 'LOST',
          actualPayout: 0,
          settledAt: new Date(),
          metadata: {
            ...bet.metadata,
            settledAt: new Date().toISOString(),
            processingTime: Date.now(),
          },
        },
      });

      // Unfreeze funds (bet amount is lost)
      await this.walletService.unfreezeFunds(bet.userId, bet.amount, tx, {
        deductAmount: bet.amount,
        reason: 'BET_LOSS',
        reference: bet.id,
        description: `Loss from bet on ${bet.market?.title || 'unknown market'}`,
      });

      // Update user statistics
      await this.updateUserStats(bet.userId, 'LOSS', bet.amount, 0);
    });
  }

  private async sendSettlementNotifications(market: any, winningOutcome: any, result: SettlementResult): Promise<void> {
    try {
      // Send notifications to all bettors
      for (const bet of market.bets) {
        const isWinner = bet.outcomeId === winningOutcome.id;
        const payout = bet.actualPayout || 0;

        await this.notificationsService.sendNotification({
          userId: bet.userId,
          type: 'MARKET_SETTLED',
          title: `Market Settled: ${market.title}`,
          message: isWinner
            ? `Congratulations! You won ${payout} credits from your bet on "${winningOutcome.title}"`
            : `Your bet on "${bet.outcome?.title || 'unknown outcome'}" was not successful. The winning outcome was "${winningOutcome.title}"`,
          metadata: {
            marketId: market.id,
            marketTitle: market.title,
            betId: bet.id,
            isWinner,
            payout,
            winningOutcome: winningOutcome.title,
            totalBets: result.totalBets,
            settledAt: result.settledAt,
          },
          priority: isWinner ? 'HIGH' : 'NORMAL',
        });
      }

      // Send market-wide notification
      await this.notificationsService.sendNotification({
        type: 'SYSTEM_NOTIFICATION',
        title: 'Market Settlement Complete',
        message: `Market "${market.title}" has been settled. "${winningOutcome.title}" was the winning outcome with ${result.winningBets} winning bets.`,
        metadata: {
          marketId: market.id,
          winningOutcome: winningOutcome.title,
          totalPayouts: result.totalPayouts,
          winningBets: result.winningBets,
          losingBets: result.losingBets,
        },
        priority: 'NORMAL',
      });
    } catch (error) {
      this.logger.error('Failed to send settlement notifications:', error);
    }
  }

  private async updateUserStats(userId: string, result: 'WIN' | 'LOSS', betAmount: number, payout: number): Promise<void> {
    try {
      // Update user betting statistics
      const stats = await this.prisma.userBettingStats.findUnique({
        where: { userId },
      });

      if (stats) {
        await this.prisma.userBettingStats.update({
          where: { userId },
          data: {
            totalBets: { increment: 1 },
            totalAmount: { increment: betAmount },
            totalWins: result === 'WIN' ? { increment: 1 } : undefined,
            totalLosses: result === 'LOSS' ? { increment: 1 } : undefined,
            totalWinnings: { increment: payout },
            totalLosses: { increment: result === 'LOSS' ? betAmount : 0 },
            currentStreak: this.calculateStreak(stats.currentStreak, result),
            lastResult: result,
            lastBetAt: new Date(),
          },
        });
      } else {
        await this.prisma.userBettingStats.create({
          data: {
            userId,
            totalBets: 1,
            totalAmount: betAmount,
            totalWins: result === 'WIN' ? 1 : 0,
            totalLosses: result === 'LOSS' ? 1 : 0,
            totalWinnings: payout,
            totalLosses: result === 'LOSS' ? betAmount : 0,
            currentStreak: result === 'WIN' ? 1 : -1,
            lastResult: result,
            lastBetAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to update user stats for ${userId}:`, error);
    }
  }

  private calculateStreak(currentStreak: number, result: 'WIN' | 'LOSS'): number {
    if (currentStreak > 0 && result === 'WIN') {
      return currentStreak + 1;
    } else if (currentStreak < 0 && result === 'LOSS') {
      return currentStreak - 1;
    } else {
      return result === 'WIN' ? 1 : -1;
    }
  }

  private async getExternalSentiment(topicId: string): Promise<{ score: number; confidence: number }> {
    // Would integrate with SentimentModule
    // For now, return mock data
    return {
      score: 0.5 + Math.random() * 0.3,
      confidence: 0.7 + Math.random() * 0.2,
    };
  }

  private async getExternalViralData(topicId: string): Promise<{ index: number; momentum: number }> {
    // Would integrate with ViralModule
    // For now, return mock data
    return {
      index: 0.4 + Math.random() * 0.4,
      momentum: Math.random() * 0.6,
    };
  }
}