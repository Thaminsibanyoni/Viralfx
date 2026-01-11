import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from "../../../prisma/prisma.service";
import { ReferralTrackingService } from '../services/referral-tracking.service';

@Injectable()
export class ReferralScheduler {
  private readonly logger = new Logger(ReferralScheduler.name);
  private readonly isProduction: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly referralTrackingService: ReferralTrackingService,
    private readonly configService: ConfigService,
    @InjectQueue('referral-processing') private readonly referralProcessingQueue: Queue,
    @InjectQueue('reward-distribution') private readonly rewardDistributionQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
  }

  /**
   * Daily referral completion checks - runs at 2 AM UTC
   */
  @Cron('0 2 * * *', {
    name: 'daily-referral-completion-checks',
    timeZone: 'UTC'
  })
  async dailyReferralCompletionChecks(): Promise<void> {
    this.logger.log('Starting daily referral completion checks');

    try {
      // Get all pending and registered referrals that need checking
      const referralsToCheck = await this.prisma.referral.findMany({
        where: {
          status: { in: ['PENDING', 'REGISTERED', 'QUALIFIED'] },
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        },
        include: {
          referredUser: {
            select: {
              id: true,
              kycStatus: true
            }
          }
        }
      });

      this.logger.log(`Found ${referralsToCheck.length} referrals to check`);

      // Priority: QUALIFIED > REGISTERED > PENDING
      const sortedReferrals = referralsToCheck.sort((a, b) => {
        const priority = { QUALIFIED: 3, REGISTERED: 2, PENDING: 1 };
        return priority[b.status] - priority[a.status];
      });

      // Queue completion checks in batches
      const batchSize = 50;
      for (let i = 0; i < sortedReferrals.length; i += batchSize) {
        const batch = sortedReferrals.slice(i, i + batchSize);

        for (const referral of batch) {
          await this.referralProcessingQueue.add(
            'check-referral-completion',
            {
              referralId: referral.id,
              checkCriteria: {
                kycRequired: true,
                firstTradeRequired: true,
                minTradeAmount: 10 // Minimum trade amount to qualify
              }
            },
            {
              priority: this.getReferralPriority(referral),
              delay: i * 100, // Stagger jobs to avoid overwhelming the system
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000
              },
              removeOnComplete: 100,
              removeOnFail: 50
            }
          );
        }

        // Add delay between batches
        if (i + batchSize < sortedReferrals.length) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      this.logger.log(`Queued ${sortedReferrals.length} referral completion checks`);
    } catch (error) {
      this.logger.error('Failed to process daily referral completion checks:', error);
      await this.sendAdminAlert('Daily Referral Completion Checks Failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Daily referral expiration - runs at 3 AM UTC
   */
  @Cron('0 3 * * *', {
    name: 'daily-referral-expiration',
    timeZone: 'UTC'
  })
  async dailyReferralExpiration(): Promise<void> {
    this.logger.log('Starting daily referral expiration');

    try {
      // Expire referrals older than 30 days that are still pending/registered
      await this.referralProcessingQueue.add(
        'expire-referrals',
        {
          daysOld: 30
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      );

      // Expire unclaimed rewards older than 30 days
      await this.rewardDistributionQueue.add(
        'batch-expire-rewards',
        {
          daysUnclaimed: 30
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      );

      this.logger.log('Queued referral and reward expiration jobs');
    } catch (error) {
      this.logger.error('Failed to process daily referral expiration:', error);
      await this.sendAdminAlert('Daily Referral Expiration Failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Weekly leaderboard recalculation - runs on Sundays at 12 AM UTC
   */
  @Cron('0 0 * * 0', {
    name: 'weekly-leaderboard-recalculation',
    timeZone: 'UTC'
  })
  async weeklyLeaderboardRecalculation(): Promise<void> {
    this.logger.log('Starting weekly leaderboard recalculation');

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days

      const endDate = new Date();

      // Get top referrers for the week
      const topReferrers = await this.referralTrackingService.getTopReferrers(
        100, // Top 100
        startDate,
        endDate
      );

      // Cache the weekly leaderboard
      const leaderboardKey = 'referral:leaderboard:weekly';
      await this.referralTrackingService['redis'].setex(
        leaderboardKey,
        7 * 24 * 60 * 60, // 7 days TTL
        JSON.stringify({
          entries: topReferrers,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          generatedAt: new Date().toISOString()
        })
      );

      // Calculate weekly rewards for top performers
      await this.processWeeklyRewards(topReferrers);

      this.logger.log(`Weekly leaderboard recalculated with ${topReferrers.length} entries`);
    } catch (error) {
      this.logger.error('Failed to recalculate weekly leaderboard:', error);
      await this.sendAdminAlert('Weekly Leaderboard Recalculation Failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Monthly referral analytics report - runs on 1st day of month at 1 AM UTC
   */
  @Cron('0 1 1 * *', {
    name: 'monthly-referral-analytics',
    timeZone: 'UTC'
  })
  async monthlyReferralAnalytics(): Promise<void> {
    this.logger.log('Starting monthly referral analytics report');

    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(1); // First day of last month

      const endOfLastMonth = new Date();
      endOfLastMonth.setDate(0); // Last day of last month

      // Generate analytics for last month
      const analytics = await this.referralTrackingService.getReferralAnalytics('30d', 'day');

      // Generate report
      const report = {
        period: {
          start: lastMonth.toISOString().split('T')[0],
          end: endOfLastMonth.toISOString().split('T')[0]
        },
        summary: {
          totalReferrals: analytics.funnel.reduce((sum, day) => sum + day.signups, 0),
          totalConversions: analytics.funnel.reduce((sum, day) => sum + day.conversions, 0),
          totalRevenue: analytics.topReferrers.reduce((sum, referrer) => sum + referrer.totalEarnings, 0),
          averageConversionRate: analytics.conversionRates
        },
        topPerformers: analytics.topReferrers.slice(0, 10),
        channelPerformance: analytics.channelPerformance,
        generatedAt: new Date().toISOString()
      };

      // Store report
      await this.prisma.analyticsReport.create({
        data: {
          type: 'MONTHLY_REFERRAL_ANALYTICS',
          period: report.period,
          data: report,
          generatedAt: new Date()
        }
      });

      // Send report to admins
      await this.notificationsQueue.add(
        'send-admin-report',
        {
          type: 'MONTHLY_REFERRAL_ANALYTICS',
          data: report,
          recipients: ['admin@viralfx.com'] // Would get from config
        },
        {
          attempts: 3
        }
      );

      this.logger.log('Monthly referral analytics report generated and sent');
    } catch (error) {
      this.logger.error('Failed to generate monthly referral analytics:', error);
      await this.sendAdminAlert('Monthly Referral Analytics Failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Hourly cleanup of temporary Redis data
   */
  @Cron('0 * * * *', {
    name: 'hourly-redis-cleanup',
    timeZone: 'UTC'
  })
  async hourlyRedisCleanup(): Promise<void> {
    if (!this.isProduction) {
      return; // Skip cleanup in non-production
    }

    this.logger.log('Starting hourly Redis cleanup');

    try {
      const redis = this.referralTrackingService['redis'];

      // Clean up old click data (older than 24 hours)
      const clickKeys = await redis.keys('referral:clicks:*');
      let deletedClicks = 0;

      for (const key of clickKeys) {
        const ttl = await redis.ttl(key);
        if (ttl === -1) { // No expiry set
          await redis.expire(key, 86400); // Set 24-hour TTL
        } else if (ttl === -2) { // Key doesn't exist
          deletedClicks++;
        }
      }

      // Clean up expired daily counters
      const dailyKeys = await redis.keys('referral:daily:*');
      const today = new Date().toISOString().split('T')[0];
      let deletedDaily = 0;

      for (const key of dailyKeys) {
        if (!key.includes(today)) {
          const parts = key.split(':');
          if (parts.length >= 4) {
            const dateStr = parts[2];
            const keyDate = new Date(dateStr);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (keyDate < thirtyDaysAgo) {
              await redis.del(key);
              deletedDaily++;
            }
          }
        }
      }

      this.logger.log(`Redis cleanup completed: ${deletedClicks} clicks cleaned, ${deletedDaily} daily counters cleaned`);
    } catch (error) {
      this.logger.error('Failed to perform hourly Redis cleanup:', error);
    }
  }

  /**
   * Health check for referral system - runs every 5 minutes
   */
  @Cron('*/5 * * * *', {
    name: 'referral-health-check'
  })
  async referralHealthCheck(): Promise<void> {
    try {
      const checks = await Promise.allSettled([
        this.checkQueueHealth('referral-processing'),
        this.checkQueueHealth('reward-distribution'),
        this.checkDatabaseConnectivity(),
        this.checkRedisConnectivity(),
      ]);

      const healthStatus = {
        timestamp: new Date().toISOString(),
        checks: {
          referralProcessingQueue: checks[0].status === 'fulfilled' ? checks[0].value : 'failed',
          rewardDistributionQueue: checks[1].status === 'fulfilled' ? checks[1].value : 'failed',
          database: checks[2].status === 'fulfilled' ? 'healthy' : 'failed',
          redis: checks[3].status === 'fulfilled' ? 'healthy' : 'failed'
        },
        overall: checks.every(check => check.status === 'fulfilled') ? 'healthy' : 'degraded'
      };

      // Store health status
      await this.referralTrackingService['redis'].setex(
        'referral:health:status',
        300, // 5 minutes TTL
        JSON.stringify(healthStatus)
      );

      // Send alert if system is degraded
      if (healthStatus.overall === 'degraded') {
        await this.sendAdminAlert('Referral System Health Check Failed', healthStatus);
      }
    } catch (error) {
      this.logger.error('Referral health check failed:', error);
      await this.sendAdminAlert('Referral Health Check Error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private getReferralPriority(referral: any): number {
    // Higher priority for older referrals and those closer to completion
    const daysOld = (Date.now() - new Date(referral.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const statusPriority = { QUALIFIED: 10, REGISTERED: 5, PENDING: 1 };

    return statusPriority[referral.status] + Math.min(daysOld, 10);
  }

  private async processWeeklyRewards(topReferrers: any[]): Promise<void> {
    // Process weekly rewards for top performers
    for (let i = 0; i < Math.min(topReferrers.length, 10); i++) {
      const referrer = topReferrers[i];
      const bonusAmount = this.calculateWeeklyBonus(i + 1, referrer);

      if (bonusAmount > 0) {
        await this.rewardDistributionQueue.add(
          'distribute-reward',
          {
            claimId: `weekly_bonus_${referrer.user.id}_${Date.now()}`,
            userId: referrer.user.id,
            rewardId: 'weekly_leaderboard_bonus',
            referralId: null,
            metadata: {
              rank: i + 1,
              referralCount: referrer.referralCount,
              totalEarnings: referrer.totalEarnings,
              bonusAmount,
              period: 'weekly'
            }
          },
          {
            attempts: 3
          }
        );
      }
    }
  }

  private calculateWeeklyBonus(rank: number, referrer: any): number {
    const bonusStructure = {
      1: 100,  // 1st place
      2: 50,   // 2nd place
      3: 25,   // 3rd place
      4: 15,   // 4th place
      5: 10,   // 5th place
      6: 5    // 6th-10th place
    };

    if (rank <= 5) {
      return bonusStructure[rank];
    } else if (rank <= 10 && referrer.referralCount >= 5) {
      return bonusStructure[6];
    }

    return 0;
  }

  private async checkQueueHealth(queueName: string): Promise<string> {
    try {
      const queue = queueName === 'referral-processing'
        ? this.referralProcessingQueue
        : this.rewardDistributionQueue;

      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
      ]);

      const health = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      };

      return health.failed > 100 ? 'degraded' : 'healthy';
    } catch (error) {
      return 'failed';
    }
  }

  private async checkDatabaseConnectivity(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkRedisConnectivity(): Promise<boolean> {
    try {
      await this.referralTrackingService['redis'].ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async sendAdminAlert(subject: string, data: any): Promise<void> {
    try {
      await this.notificationsQueue.add(
        'send-admin-alert',
        {
          subject: `ViralFX Referral System: ${subject}`,
          data,
          priority: 'high'
        },
        {
          attempts: 3
        }
      );
    } catch (error) {
      this.logger.error('Failed to send admin alert:', error);
    }
  }
}
