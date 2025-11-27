import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import {
  ReferralAnalyticsDto,
  ReferralFunnelDto,
  ReferralEventDto,
  LeaderboardEntryDto,
} from '../dto/referral.dto';
import {
  ReferralEventType,
  ReferralStatus,
} from '../types/referral.types';

@Injectable()
export class ReferralTrackingService {
  private readonly logger = new Logger(ReferralTrackingService.name);
  private readonly clickTTL = 86400; // 24 hours for click tracking
  private readonly analyticsCacheTTL = 300; // 5 minutes for analytics

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Track referral click
   */
  async trackReferralClick(
    referralCode: string,
    clickData: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    }
  ): Promise<void> {
    this.logger.log(`Tracking referral click for code: ${referralCode}`);

    try {
      const clickId = `click:${Date.now()}:${Math.random().toString(36).substring(2, 15)}`;
      const clickKey = `referral:clicks:${referralCode}`;

      // Store click data in Redis hash with TTL
      await this.redis.hset(clickKey, clickId, JSON.stringify({
        id: clickId,
        referralCode,
        timestamp: new Date().toISOString(),
        ...clickData,
      }));

      // Set TTL on the hash key
      await this.redis.expire(clickKey, this.clickTTL);

      // Increment click counter for the referral code
      await this.redis.incr(`referral:clicks:count:${referralCode}`);

      // Track daily clicks for analytics
      const today = new Date().toISOString().split('T')[0];
      await this.redis.incr(`referral:daily:clicks:${today}:${referralCode}`);

      // Track UTM parameters if provided
      if (clickData.utmSource) {
        await this.redis.incr(`referral:utm:source:${clickData.utmSource}`);
      }
      if (clickData.utmMedium) {
        await this.redis.incr(`referral:utm:medium:${clickData.utmMedium}`);
      }
      if (clickData.utmCampaign) {
        await this.redis.incr(`referral:utm:campaign:${clickData.utmCampaign}`);
      }

      this.logger.log(`Referral click tracked: ${clickId} for code: ${referralCode}`);
    } catch (error) {
      this.logger.error('Failed to track referral click:', error);
      throw new InternalServerErrorException('Failed to track referral click');
    }
  }

  /**
   * Track referral signup
   */
  async trackReferralSignup(
    referralCode: string,
    userId: string,
    signupData: {
      ipAddress?: string;
      userAgent?: string;
      source?: string;
    }
  ): Promise<void> {
    this.logger.log(`Tracking referral signup for code: ${referralCode}, user: ${userId}`);

    try {
      // Store signup event
      await this.prisma.referralEvent.create({
        data: {
          referralId: referralCode, // Will be updated with actual referral ID
          eventType: ReferralEventType.REGISTERED,
          userId,
          metadata: {
            referralCode,
            ...signupData,
          },
        },
      });

      // Track daily signups for analytics
      const today = new Date().toISOString().split('T')[0];
      await this.redis.incr(`referral:daily:signups:${today}`);

      // Update referral status in database (if referral record exists)
      const referral = await this.prisma.referral.findFirst({
        where: {
          referralCode: { code: referralCode },
          referredUserId: userId,
        },
      });

      if (referral) {
        await this.prisma.referral.update({
          where: { id: referral.id },
          data: {
            status: ReferralStatus.REGISTERED,
            registeredAt: new Date(),
            metadata: {
              ...referral.metadata,
              ...signupData,
            },
          },
        });

        // Create proper event with referral ID
        await this.prisma.referralEvent.create({
          data: {
            referralId: referral.id,
            eventType: ReferralEventType.REGISTERED,
            userId,
            metadata: signupData,
          },
        });
      }

      this.logger.log(`Referral signup tracked: ${userId} for code: ${referralCode}`);
    } catch (error) {
      this.logger.error('Failed to track referral signup:', error);
      throw new InternalServerErrorException('Failed to track referral signup');
    }
  }

  /**
   * Track referral conversion (KYC completion, first trade, etc.)
   */
  async trackReferralConversion(
    referralId: string,
    conversionData: {
      eventType: ReferralEventType;
      metadata?: any;
      amount?: number;
    }
  ): Promise<void> {
    this.logger.log(`Tracking referral conversion: ${referralId}, event: ${conversionData.eventType}`);

    try {
      const referral = await this.prisma.referral.findUnique({
        where: { id: referralId },
        include: { referralCode: true },
      });

      if (!referral) {
        this.logger.warn(`Referral not found: ${referralId}`);
        return;
      }

      // Update referral status based on event
      let updateData: any = {};
      switch (conversionData.eventType) {
        case ReferralEventType.KYC_COMPLETED:
          updateData.status = ReferralStatus.QUALIFIED;
          updateData.qualifiedAt = new Date();
          break;
        case ReferralEventType.FIRST_TRADE:
        case ReferralEventType.FIRST_BET:
          updateData.status = ReferralStatus.COMPLETED;
          updateData.completedAt = new Date();
          updateData.completedEventType = conversionData.eventType;
          if (conversionData.amount) {
            updateData.conversionAmount = conversionData.amount;
          }
          break;
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.$transaction(async (tx) => {
          // Update referral
          await tx.referral.update({
            where: { id: referralId },
            data: {
              ...updateData,
              metadata: {
                ...referral.metadata,
                ...conversionData.metadata,
              },
            },
          });

          // Create event
          await tx.referralEvent.create({
            data: {
              referralId,
              eventType: conversionData.eventType,
              userId: referral.referredUserId,
              metadata: conversionData.metadata || {},
            },
          });
        });

        // Track daily conversions for analytics
        const today = new Date().toISOString().split('T')[0];
        await this.redis.incr(`referral:daily:conversions:${today}`);

        // Update leaderboard scores
        await this.updateLeaderboardScore(referral.referrerId, conversionData.eventType, conversionData.amount);

        this.logger.log(`Referral conversion tracked: ${referralId}, event: ${conversionData.eventType}`);
      }
    } catch (error) {
      this.logger.error('Failed to track referral conversion:', error);
      throw new InternalServerErrorException('Failed to track referral conversion');
    }
  }

  /**
   * Get referral analytics
   */
  async getReferralAnalytics(
    timeWindow: string = '30d',
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<ReferralAnalyticsDto> {
    const cacheKey = `referral:analytics:${timeWindow}:${groupBy}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const startDate = new Date();
      const days = this.parseTimeWindow(timeWindow);
      startDate.setDate(startDate.getDate() - days);

      // Get funnel data
      const funnel = await this.getReferralFunnel(startDate, groupBy);

      // Get conversion rates
      const conversionRates = await this.calculateConversionRates(startDate);

      // Get top performers
      const topReferrers = await this.getTopReferrers(10, startDate);

      // Get channel performance
      const channelPerformance = await this.getChannelPerformance(startDate);

      const analytics: ReferralAnalyticsDto = {
        timeWindow,
        startDate,
        endDate: new Date(),
        funnel,
        conversionRates,
        topReferrers,
        channelPerformance,
        generatedAt: new Date(),
      };

      // Cache the result
      await this.redis.setex(cacheKey, this.analyticsCacheTTL, JSON.stringify(analytics));

      return analytics;
    } catch (error) {
      this.logger.error('Failed to get referral analytics:', error);
      throw new InternalServerErrorException('Failed to get referral analytics');
    }
  }

  /**
   * Calculate conversion rate
   */
  async calculateConversionRate(
    startDate: Date,
    endDate?: Date
  ): Promise<number> {
    try {
      endDate = endDate || new Date();

      const [totalSignups, totalConversions] = await Promise.all([
        this.prisma.referralEvent.count({
          where: {
            eventType: ReferralEventType.REGISTERED,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.referralEvent.count({
          where: {
            eventType: { in: [ReferralEventType.FIRST_TRADE, ReferralEventType.FIRST_BET] },
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
      ]);

      return totalSignups > 0 ? (totalConversions / totalSignups) * 100 : 0;
    } catch (error) {
      this.logger.error('Failed to calculate conversion rate:', error);
      return 0;
    }
  }

  /**
   * Get top referrers for leaderboard
   */
  async getTopReferrers(
    limit: number = 50,
    startDate?: Date,
    endDate?: Date
  ): Promise<LeaderboardEntryDto[]> {
    try {
      startDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
      endDate = endDate || new Date();

      const topReferrers = await this.prisma.referral.groupBy({
        by: ['referrerId'],
        where: {
          status: ReferralStatus.COMPLETED,
          completedAt: { gte: startDate, lte: endDate },
        },
        _count: {
          referrerId: true,
        },
        _sum: {
          rewardAmount: true,
          conversionAmount: true,
        },
        orderBy: {
          _count: { referrerId: 'desc' },
        },
        take: limit,
      });

      // Get user details
      const userIds = topReferrers.map(entry => entry.referrerId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });

      const userMap = users.reduce((map, user) => {
        map[user.id] = user;
        return map;
      }, {});

      return topReferrers.map((entry, index) => ({
        rank: index + 1,
        user: userMap[entry.referrerId],
        referralCount: entry._count.referrerId,
        totalEarnings: entry._sum.rewardAmount || 0,
        totalConversionAmount: entry._sum.conversionAmount || 0,
        averageConversionValue: entry._count.referrerId > 0
          ? (entry._sum.conversionAmount || 0) / entry._count.referrerId
          : 0,
      }));
    } catch (error) {
      this.logger.error('Failed to get top referrers:', error);
      throw new InternalServerErrorException('Failed to get top referrers');
    }
  }

  /**
   * Get referral events for a specific referral
   */
  async getReferralEvents(referralId: string): Promise<ReferralEventDto[]> {
    try {
      const events = await this.prisma.referralEvent.findMany({
        where: { referralId },
        orderBy: { createdAt: 'asc' },
      });

      return events.map(event => ({
        id: event.id,
        referralId: event.referralId,
        eventType: event.eventType,
        userId: event.userId,
        timestamp: event.createdAt,
        metadata: event.metadata,
      }));
    } catch (error) {
      this.logger.error('Failed to get referral events:', error);
      throw new InternalServerErrorException('Failed to get referral events');
    }
  }

  /**
   * Get real-time referral metrics
   */
  async getRealTimeMetrics(): Promise<{
    activeClicks: number;
    todaySignups: number;
    todayConversions: number;
    pendingReferrals: number;
    completionRate: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        activeClicks,
        todaySignups,
        todayConversions,
        pendingReferrals,
        totalReferrals,
        completedReferrals,
      ] = await Promise.all([
        // Count active clicks in Redis (last 24 hours)
        this.getActiveClicksCount(),
        // Today's signups from Redis
        this.redis.get(`referral:daily:signups:${today}`),
        // Today's conversions from Redis
        this.redis.get(`referral:daily:conversions:${today}`),
        // Pending referrals from database
        this.prisma.referral.count({
          where: { status: ReferralStatus.PENDING },
        }),
        // Total referrals
        this.prisma.referral.count(),
        // Completed referrals
        this.prisma.referral.count({
          where: { status: ReferralStatus.COMPLETED },
        }),
      ]);

      const completionRate = totalReferrals > 0
        ? (completedReferrals / totalReferrals) * 100
        : 0;

      return {
        activeClicks,
        todaySignups: parseInt(todaySignups || '0'),
        todayConversions: parseInt(todayConversions || '0'),
        pendingReferrals,
        completionRate: Math.round(completionRate * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to get real-time metrics:', error);
      throw new InternalServerErrorException('Failed to get real-time metrics');
    }
  }

  private async getReferralFunnel(
    startDate: Date,
    groupBy: 'day' | 'week' | 'month'
  ): Promise<ReferralFunnelDto[]> {
    // This would need more complex SQL queries for proper grouping
    // For now, return basic funnel data
    const [clicks, signups, kycCompleted, conversions] = await Promise.all([
      this.getClickCount(startDate),
      this.prisma.referralEvent.count({
        where: {
          eventType: ReferralEventType.REGISTERED,
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.referralEvent.count({
        where: {
          eventType: ReferralEventType.KYC_COMPLETED,
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.referralEvent.count({
        where: {
          eventType: { in: [ReferralEventType.FIRST_TRADE, ReferralEventType.FIRST_BET] },
          createdAt: { gte: startDate },
        },
      }),
    ]);

    return [{
      date: startDate.toISOString().split('T')[0],
      clicks,
      signups,
      kycCompleted,
      conversions,
    }];
  }

  private async getChannelPerformance(startDate: Date): Promise<any[]> {
    // Get UTM performance data from Redis
    const sources = await this.redis.keys('referral:utm:source:*');
    const performance = [];

    for (const sourceKey of sources) {
      const source = sourceKey.replace('referral:utm:source:', '');
      const count = await this.redis.get(sourceKey);
      if (count) {
        performance.push({
          source,
          count: parseInt(count),
        });
      }
    }

    return performance.sort((a, b) => b.count - a.count);
  }

  private async updateLeaderboardScore(
    userId: string,
    eventType: ReferralEventType,
    amount?: number
  ): Promise<void> {
    try {
      const scoreKey = 'referral:leaderboard:scores';
      const points = this.calculateEventPoints(eventType, amount);

      await this.redis.zincrby(scoreKey, points, userId);

      // Also store timestamp for the latest activity
      await this.redis.hset('referral:leaderboard:last_activity', userId, Date.now().toString());
    } catch (error) {
      this.logger.error('Failed to update leaderboard score:', error);
    }
  }

  private calculateEventPoints(eventType: ReferralEventType, amount?: number): number {
    switch (eventType) {
      case ReferralEventType.REGISTERED:
        return 10;
      case ReferralEventType.KYC_COMPLETED:
        return 25;
      case ReferralEventType.FIRST_TRADE:
        return 50 + (amount ? Math.min(amount / 10, 100) : 0);
      case ReferralEventType.FIRST_BET:
        return 40 + (amount ? Math.min(amount / 10, 80) : 0);
      default:
        return 0;
    }
  }

  private async getActiveClicksCount(): Promise<number> {
    const keys = await this.redis.keys('referral:clicks:*');
    let totalClicks = 0;

    for (const key of keys) {
      const clicks = await this.redis.hgetall(key);
      totalClicks += Object.keys(clicks).length;
    }

    return totalClicks;
  }

  private async getClickCount(startDate: Date): Promise<number> {
    // Get click count from Redis by summing daily counts
    const today = new Date().toISOString().split('T')[0];
    const days = Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    let totalClicks = 0;
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // This is a simplified approach - in practice, you'd need to aggregate
      // across all referral codes for each date
      const keys = await this.redis.keys(`referral:daily:clicks:${dateStr}:*`);
      for (const key of keys) {
        const count = await this.redis.get(key);
        if (count) {
          totalClicks += parseInt(count);
        }
      }
    }

    return totalClicks;
  }

  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([hdwmy])$/);
    if (!match) {
      return 30; // Default to 30 days
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      h: 1 / 24,      // hour to days
      d: 1,           // day
      w: 7,           // week
      m: 30,          // month
      y: 365,         // year
    };

    return value * (multipliers[unit as keyof typeof multipliers] || 1);
  }
}