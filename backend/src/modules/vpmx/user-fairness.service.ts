import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from '../redis/redis.service';
import { UserFairnessMetrics } from "./interfaces/vpmx.interface";

@Injectable()
export class UserFairnessService {
  private readonly logger = new Logger(UserFairnessService.name);
  private readonly FAIRNESS_CACHE_KEY = 'vpmx:user:fairness';
  private readonly BET_HISTORY_KEY = 'vpmx:user:bet_history';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService) {}

  /**
   * Get user fairness metrics
   */
  async getUserFairnessMetrics(userId: string): Promise<UserFairnessMetrics | null> {
    // Try cache first
    const cacheKey = `${this.FAIRNESS_CACHE_KEY}:${userId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database - exclude soft-deleted records
    const userFairness = await this.prisma.vPMXUserFairness.findFirst({
      where: {
        userId,
        deletedAt: null // Exclude soft-deleted fairness records
      }
    });

    if (!userFairness) {
      // Initialize fairness settings for new user
      return await this.initializeUserFairness(userId);
    }

    const metrics: UserFairnessMetrics = {
      userId: userFairness.userId,
      winRate: userFairness.winRate,
      avgBetSize: userFairness.avgBetSize,
      totalWinnings: userFairness.totalWinnings,
      totalLosses: userFairness.totalLosses,
      fairnessScore: userFairness.fairnessScore,
      isWhale: userFairness.isWhale,
      limits: userFairness.limits as any
    };

    // Cache for 60 seconds
    await this.redis.setex(cacheKey, 60, JSON.stringify(metrics));

    return metrics;
  }

  /**
   * Check if user can place a bet with fairness adjustments
   */
  async canPlaceBet(
    userId: string,
    betAmount: number,
    marketId: string): Promise<{
    allowed: boolean;
    reason?: string;
    adjustedAmount?: number;
    adjustedOdds?: number;
    marginRequirement?: number;
  }> {
    const fairness = await this.getUserFairnessMetrics(userId);

    if (!fairness) {
      return { allowed: false, reason: 'User fairness metrics not found' };
    }

    // Check if user is restricted
    if (fairness.isRestricted) {
      const restriction = await this.getUserRestriction(userId);
      if (restriction && Date.now() < new Date(restriction.restrictionExpires).getTime()) {
        return {
          allowed: false,
          reason: `User restricted: ${restriction.restrictionReason}`
        };
      }
    }

    // Check bet size limits
    const maxBetSize = fairness.limits?.maxBetSize || 1000; // Default $1000
    if (betAmount > maxBetSize) {
      return {
        allowed: false,
        reason: `Bet size exceeds maximum limit. Max: $${maxBetSize}`,
        adjustedAmount: maxBetSize
      };
    }

    // Check daily bet limits
    const dailyBets = await this.getDailyBetCount(userId);
    const maxDailyBets = fairness.limits?.maxDailyBets || 50; // Default 50 bets per day

    if (dailyBets >= maxDailyBets) {
      return {
        allowed: false,
        reason: `Daily bet limit exceeded. Max: ${maxDailyBets}`
      };
    }

    // Check cooling period
    const lastBetTime = await this.getLastBetTime(userId);
    const coolingPeriod = fairness.limits?.coolingPeriod || 0; // Default no cooling period

    if (coolingPeriod > 0 && lastBetTime) {
      const timeSinceLastBet = Date.now() - lastBetTime.getTime();
      if (timeSinceLastBet < coolingPeriod * 1000) {
        const remainingTime = Math.ceil((coolingPeriod * 1000 - timeSinceLastBet) / 1000);
        return {
          allowed: false,
          reason: `Cooling period active. Please wait ${remainingTime} seconds`
        };
      }
    }

    // Apply fairness adjustments
    const adjustedOdds = await this.calculateAdjustedOdds(userId, marketId, fairness);
    const marginRequirement = fairness.marginRequirement || 0;

    // Check for whale restrictions
    if (fairness.isWhale) {
      const whaleRestrictions = await this.getWhaleRestrictions(userId);
      if (whaleRestrictions && betAmount > whaleRestrictions.maxBetSize) {
        return {
          allowed: false,
          reason: `Whale user bet size exceeds limit. Max: $${whaleRestrictions.maxBetSize}`,
          adjustedAmount: whaleRestrictions.maxBetSize
        };
      }
    }

    return {
      allowed: true,
      adjustedOdds,
      marginRequirement
    };
  }

  /**
   * Record bet outcome and update fairness metrics
   */
  async recordBetOutcome(
    userId: string,
    betAmount: number,
    outcome: 'WON' | 'LOST' | 'REFUNDED',
    payout: number = 0,
    odds: number = 0): Promise<void> {
    try {
      const fairness = await this.getUserFairnessMetrics(userId);
      if (!fairness) return;

      // Calculate new metrics
      const totalBets = fairness.totalBets + 1;
      const totalWinnings = outcome === 'WON' ? fairness.totalWinnings + payout : fairness.totalWinnings;
      const totalLosses = outcome === 'LOST' ? fairness.totalLosses + betAmount : fairness.totalLosses;
      const wins = outcome === 'WON' ? (fairness.winRate * fairness.totalBets) + 1 : fairness.winRate * fairness.totalBets;
      const newWinRate = wins / totalBets;

      // Update average bet size
      const totalBetAmount = (fairness.avgBetSize * fairness.totalBets) + betAmount;
      const newAvgBetSize = totalBetAmount / totalBets;

      // Calculate new fairness score
      const newFairnessScore = await this.calculateFairnessScore(
        userId,
        newWinRate,
        newAvgBetSize,
        totalBets,
        totalWinnings,
        totalLosses);

      // Check if user is now a whale
      const isWhale = totalBets > 100 || newAvgBetSize > 10000;

      // Apply fairness adjustments if needed
      const adjustments = await this.determineFairnessAdjustments(newFairnessScore);
      const oddsAdjustment = adjustments.oddsAdjustment || 0;
      const marginRequirement = adjustments.marginRequirement || 0;

      await this.prisma.vPMXUserFairness.update({
        where: { userId },
        data: {
          winRate: newWinRate,
          avgBetSize: newAvgBetSize,
          totalWinnings,
          totalLosses,
          totalBets,
          fairnessScore: newFairnessScore,
          isWhale,
          oddsAdjustment,
          marginRequirement,
          lastUpdated: new Date()
        }
      });

      // Record bet in history
      await this.recordBetHistory(userId, {
        betAmount,
        outcome,
        payout,
        odds,
        timestamp: new Date(),
        fairnessScore: newFairnessScore
      });

      // Invalidate cache
      const cacheKey = `${this.FAIRNESS_CACHE_KEY}:${userId}`;
      await this.redis.del(cacheKey);

      // Check for automatic restrictions
      await this.checkAutomaticRestrictions(userId, newFairnessScore, newWinRate);

      this.logger.debug(`Updated fairness metrics for user ${userId}: ${outcome} $${betAmount}`);
    } catch (error) {
      this.logger.error(`Failed to record bet outcome for user ${userId}`, error);
    }
  }

  /**
   * Initialize fairness settings for a new user
   */
  async initializeUserFairness(userId: string): Promise<UserFairnessMetrics> {
    const defaultFairness = {
      userId,
      winRate: 0,
      avgBetSize: 0,
      totalWinnings: 0,
      totalLosses: 0,
      totalBets: 0,
      fairnessScore: 100, // Start with perfect fairness score
      isWhale: false,
      limits: {
        maxBetSize: 1000, // $1000 default
        maxDailyBets: 50,
        coolingPeriod: 0, // No cooling period
        maxPositions: 10 // Max simultaneous bets
      },
      oddsAdjustment: 0,
      marginRequirement: 0,
      isRestricted: false
    };

    await this.prisma.vPMXUserFairness.create({
      data: {
        userId,
        winRate: defaultFairness.winRate,
        avgBetSize: defaultFairness.avgBetSize,
        totalWinnings: defaultFairness.totalWinnings,
        totalLosses: defaultFairness.totalLosses,
        fairnessScore: defaultFairness.fairnessScore,
        isWhale: defaultFairness.isWhale,
        limits: defaultFairness.limits,
        oddsAdjustment: defaultFairness.oddsAdjustment,
        marginRequirement: defaultFairness.marginRequirement
      }
    });

    this.logger.log(`Initialized fairness metrics for user ${userId}`);
    return defaultFairness;
  }

  /**
   * Apply manual restriction to user
   */
  async applyRestriction(
    userId: string,
    reason: string,
    durationHours: number = 24): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + (durationHours * 60 * 60 * 1000));

      await this.prisma.vPMXUserFairness.update({
        where: { userId },
        data: {
          isRestricted: true,
          restrictionReason: reason,
          restrictionExpires: expiresAt
        }
      });

      // Invalidate cache
      const cacheKey = `${this.FAIRNESS_CACHE_KEY}:${userId}`;
      await this.redis.del(cacheKey);

      this.logger.log(`Applied restriction to user ${userId}: ${reason} for ${durationHours} hours`);
    } catch (error) {
      this.logger.error(`Failed to apply restriction to user ${userId}`, error);
    }
  }

  /**
   * Remove user restriction
   */
  async removeRestriction(userId: string): Promise<void> {
    try {
      await this.prisma.vPMXUserFairness.update({
        where: { userId },
        data: {
          isRestricted: false,
          restrictionReason: null,
          restrictionExpires: null
        }
      });

      // Invalidate cache
      const cacheKey = `${this.FAIRNESS_CACHE_KEY}:${userId}`;
      await this.redis.del(cacheKey);

      this.logger.log(`Removed restriction from user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to remove restriction from user ${userId}`, error);
    }
  }

  /**
   * Get users with unusual patterns (for review)
   */
  async getUnusualUsers(threshold = 0.7): Promise<any[]> {
    const unusualUsers = await this.prisma.vPMXUserFairness.findMany({
      where: {
        deletedAt: null, // Exclude soft-deleted records
        OR: [
          { fairnessScore: { lt: threshold * 100 } },
          { winRate: { gt: 0.8 } },
          { winRate: { lt: 0.2 } },
          { isWhale: true },
          { isRestricted: true },
        ]
      },
      orderBy: { fairnessScore: 'asc' },
      take: 50
    });

    return unusualUsers.map(user => ({
      userId: user.userId,
      fairnessScore: user.fairnessScore,
      winRate: user.winRate,
      avgBetSize: user.avgBetSize,
      totalBets: user.totalBets,
      isWhale: user.isWhale,
      isRestricted: user.isRestricted,
      restrictionReason: user.restrictionReason,
      flags: this.getUserFlags(user)
    }));
  }

  /**
   * Perform fairness assessment for all users
   */
  async performFairnessAssessment(): Promise<void> {
    const users = await this.prisma.vPMXUserFairness.findMany({
      where: {
        deletedAt: null // Exclude soft-deleted records
      }
    });

    for (const user of users) {
      await this.reassessUserFairness(user.userId);
    }

    this.logger.log(`Performed fairness assessment for ${users.length} users`);
  }

  /**
   * Get detailed fairness report for a user
   */
  async getFairnessReport(userId: string): Promise<any> {
    const fairness = await this.getUserFairnessMetrics(userId);
    if (!fairness) {
      throw new Error('User fairness metrics not found');
    }

    const recentBets = await this.getRecentBets(userId, 20);
    const winRateByPeriod = await this.getWinRateByPeriod(userId);
    const bettingPatterns = await this.analyzeBettingPatterns(userId);

    return {
      userId,
      currentMetrics: fairness,
      recentPerformance: {
        last20Bets: recentBets,
        winRateByPeriod,
        bettingPatterns
      },
      fairnessAnalysis: {
        score: fairness.fairnessScore,
        confidence: this.calculateFairnessConfidence(fairness),
        recommendations: this.getFairnessRecommendations(fairness),
        riskFactors: this.identifyRiskFactors(fairness)
      },
      limits: {
        current: fairness.limits,
        effective: this.calculateEffectiveLimits(fairness),
        history: await this.getLimitHistory(userId)
      },
      timestamp: new Date()
    };
  }

  // Private helper methods

  private async calculateFairnessScore(
    userId: string,
    winRate: number,
    avgBetSize: number,
    totalBets: number,
    totalWinnings: number,
    totalLosses: number): Promise<number> {
    let score = 100; // Start with perfect score

    // Penalize extremely high win rates
    if (winRate > 0.8) {
      score -= (winRate - 0.8) * 200;
    }

    // Penalize extremely low win rates
    if (winRate < 0.2 && totalBets > 10) {
      score -= (0.2 - winRate) * 100;
    }

    // Factor in bet size consistency
    if (totalBets > 5) {
      const betVariance = await this.calculateBetSizeVariance(userId);
      score -= Math.min(20, betVariance * 10); // Max 20 point penalty
    }

    // Factor in timing patterns
    const timingScore = await this.analyzeBettingTiming(userId);
    score -= (1 - timingScore) * 15; // Max 15 point penalty

    // Factor in profit patterns
    if (totalBets > 20) {
      const profitPatternScore = await this.analyzeProfitPatterns(userId);
      score -= (1 - profitPatternScore) * 25; // Max 25 point penalty
    }

    // Ensure score stays within 0-100 range
    return Math.max(0, Math.min(100, score));
  }

  private async determineFairnessAdjustments(fairnessScore: number): Promise<{
    oddsAdjustment: number;
    marginRequirement: number;
  }> {
    let oddsAdjustment = 0;
    let marginRequirement = 0;

    if (fairnessScore < 50) {
      // Significant unfairness detected
      oddsAdjustment = -0.1; // 10% odds penalty
      marginRequirement = 0.2; // 20% additional margin
    } else if (fairnessScore < 70) {
      // Moderate unfairness
      oddsAdjustment = -0.05; // 5% odds penalty
      marginRequirement = 0.1; // 10% additional margin
    } else if (fairnessScore < 85) {
      // Mild unfairness
      oddsAdjustment = -0.02; // 2% odds penalty
      marginRequirement = 0.05; // 5% additional margin
    }

    return { oddsAdjustment, marginRequirement };
  }

  private async calculateAdjustedOdds(
    userId: string,
    marketId: string,
    fairness: UserFairnessMetrics): Promise<number> {
    // Base odds would come from the market
    const baseOdds = 2.0; // Placeholder

    // Apply user-specific adjustments
    const adjustment = fairness.oddsAdjustment || 0;
    const adjustedOdds = baseOdds * (1 + adjustment);

    // Ensure odds remain reasonable
    return Math.max(1.01, Math.min(10.0, adjustedOdds));
  }

  private async checkAutomaticRestrictions(
    userId: string,
    fairnessScore: number,
    winRate: number): Promise<void> {
    let shouldRestrict = false;
    let reason = '';
    let duration = 24; // hours

    if (fairnessScore < 30) {
      shouldRestrict = true;
      reason = 'Very low fairness score detected';
      duration = 72; // 3 days
    } else if (winRate > 0.95 && await this.getRecentBetCount(userId) > 10) {
      shouldRestrict = true;
      reason = 'Suspiciously high win rate';
      duration = 48; // 2 days
    } else if (fairnessScore < 50) {
      shouldRestrict = true;
      reason = 'Low fairness score - manual review required';
      duration = 24;
    }

    if (shouldRestrict) {
      await this.applyRestriction(userId, reason, duration);
    }
  }

  private async recordBetHistory(userId: string, betData: any): Promise<void> {
    const historyKey = `${this.BET_HISTORY_KEY}:${userId}`;
    const historyEntry = JSON.stringify(betData);

    await this.redis.lpush(historyKey, historyEntry);
    await this.redis.ltrim(historyKey, 0, 999); // Keep last 1000 bets
    await this.redis.expire(historyKey, 86400 * 30); // Keep for 30 days
  }

  private async getDailyBetCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const pattern = `*${today}*`;

    // This is a simplified implementation
    // In practice, you'd want a more efficient way to count daily bets
    return 5; // Placeholder
  }

  private async getLastBetTime(userId: string): Promise<Date | null> {
    const historyKey = `${this.BET_HISTORY_KEY}:${userId}`;
    const lastBet = await this.redis.lindex(historyKey, 0);

    if (!lastBet) return null;

    const betData = JSON.parse(lastBet);
    return new Date(betData.timestamp);
  }

  private async getRecentBetCount(userId: string): Promise<number> {
    const historyKey = `${this.BET_HISTORY_KEY}:${userId}`;
    return await this.redis.llen(historyKey);
  }

  private async getUserRestriction(userId: string): Promise<any> {
    const fairness = await this.prisma.vPMXUserFairness.findFirst({
      where: {
        userId,
        deletedAt: null // Exclude soft-deleted records
      }
    });
    if (!fairness || !fairness.isRestricted) return null;

    return {
      reason: fairness.restrictionReason,
      expires: fairness.restrictionExpires
    };
  }

  private async getWhaleRestrictions(userId: string): Promise<any> {
    // Placeholder for whale-specific restrictions
    return {
      maxBetSize: 50000, // $50,000 max for whales
      maxDailyBets: 20,
      requiredMargin: 0.15 // 15% margin requirement
    };
  }

  private getUserFlags(user: any): string[] {
    const flags = [];

    if (user.fairnessScore < 30) flags.push('CRITICAL_FAIRNESS');
    if (user.fairnessScore < 50) flags.push('LOW_FAIRNESS');
    if (user.winRate > 0.85) flags.push('HIGH_WIN_RATE');
    if (user.winRate < 0.15 && user.totalBets > 10) flags.push('LOW_WIN_RATE');
    if (user.isWhale) flags.push('WHALE');
    if (user.isRestricted) flags.push('RESTRICTED');

    return flags;
  }

  private async reassessUserFairness(userId: string): Promise<void> {
    const fairness = await this.getUserFairnessMetrics(userId);
    if (!fairness) return;

    const newScore = await this.calculateFairnessScore(
      userId,
      fairness.winRate,
      fairness.avgBetSize,
      fairness.totalBets,
      fairness.totalWinnings,
      fairness.totalLosses);

    await this.prisma.vPMXUserFairness.updateMany({
      where: {
        userId,
        deletedAt: null // Only update active records
      },
      data: { fairnessScore: newScore, lastUpdated: new Date() }
    });
  }

  private async getRecentBets(userId: string, limit: number): Promise<any[]> {
    const historyKey = `${this.BET_HISTORY_KEY}:${userId}`;
    const bets = await this.redis.lrange(historyKey, 0, limit - 1);

    return bets.map(bet => JSON.parse(bet));
  }

  private async getWinRateByPeriod(userId: string): Promise<any> {
    // Placeholder implementation
    return {
      last24h: 0.65,
      last7d: 0.58,
      last30d: 0.62
    };
  }

  private async analyzeBettingPatterns(userId: string): Promise<any> {
    // Placeholder implementation
    return {
      averageTimeBetweenBets: 1800, // seconds
      preferredBetSize: 250,
      varianceScore: 0.3,
      consistencyScore: 0.7
    };
  }

  private calculateFairnessConfidence(fairness: UserFairnessMetrics): number {
    if (fairness.totalBets < 10) return 0.3;
    if (fairness.totalBets < 50) return 0.6;
    if (fairness.totalBets < 200) return 0.8;
    return 0.95;
  }

  private getFairnessRecommendations(fairness: UserFairnessMetrics): string[] {
    const recommendations = [];

    if (fairness.fairnessScore < 50) {
      recommendations.push('Monitor user activity closely');
      recommendations.push('Consider additional verification');
    }

    if (fairness.winRate > 0.8 && fairness.totalBets > 20) {
      recommendations.push('Investigate high win rate');
    }

    if (fairness.isWhale) {
      recommendations.push('Apply whale monitoring protocols');
    }

    return recommendations;
  }

  private identifyRiskFactors(fairness: UserFairnessMetrics): string[] {
    const factors = [];

    if (fairness.fairnessScore < 70) factors.push('Low fairness score');
    if (fairness.winRate > 0.8) factors.push('High win rate');
    if (fairness.avgBetSize > 10000) factors.push('High average bet size');
    if (fairness.totalBets < 5) factors.push('Insufficient history');

    return factors;
  }

  private calculateEffectiveLimits(fairness: UserFairnessMetrics): any {
    const baseLimits = fairness.limits;

    // Adjust limits based on fairness score
    const multiplier = Math.max(0.5, fairness.fairnessScore / 100);

    return {
      maxBetSize: baseLimits?.maxBetSize ? baseLimits.maxBetSize * multiplier : 1000 * multiplier,
      maxDailyBets: baseLimits?.maxDailyBets || 50,
      coolingPeriod: baseLimits?.coolingPeriod || 0
    };
  }

  private async getLimitHistory(userId: string): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  private async calculateBetSizeVariance(userId: string): Promise<number> {
    // Placeholder implementation
    return 0.3;
  }

  private async analyzeBettingTiming(userId: string): Promise<number> {
    // Placeholder implementation - 1 means normal, 0 means suspicious
    return 0.85;
  }

  private async analyzeProfitPatterns(userId: string): Promise<number> {
    // Placeholder implementation - 1 means normal, 0 means suspicious
    return 0.9;
  }
}
