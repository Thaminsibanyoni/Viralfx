import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { AnalyticsService } from '../services/analytics.service';
import { ConfigService } from '@nestjs/config';
import { Broker, BrokerStatus } from '../entities/broker.entity';
import Redis from 'ioredis';

@Injectable()
export class AnalyticsScheduler {
  private readonly logger = new Logger(AnalyticsScheduler.name);
  private redis: Redis;

  constructor(
    @InjectRepository(Broker)
    private readonly brokerRepository: Repository<Broker>,
    private readonly analyticsService: AnalyticsService,
    private readonly configService: ConfigService,
    @InjectQueue('broker-analytics') private analyticsQueue: Queue,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
    });
  }

  @Cron('0 1 * * *') // Daily at 1 AM
  async handleAggregateDailyMetrics() {
    this.logger.log('Starting daily metrics aggregation at 1 AM');

    try {
      // Query all active brokers
      const brokers = await this.getActiveBrokers();
      const brokerIds = brokers.map(broker => broker.id);

      const results = [];

      for (const brokerId of brokerIds) {
        try {
          // Queue daily aggregation for each broker
          const job = await this.analyticsQueue.add('aggregate-daily-metrics', {
            brokerId,
            date: new Date(),
          }, {
            attempts: 2,
            backoff: 'fixed',
            delay: Math.random() * 300000, // Random delay up to 5 minutes
          });

          results.push({ brokerId, jobId: job.id, success: true });
        } catch (error) {
          this.logger.error(`Failed to queue daily metrics for broker ${brokerId}:`, error);
          results.push({ brokerId, error: error.message, success: false });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.log(`Daily metrics aggregation queued. Success: ${successful}, Failed: ${failed}`);

      return {
        success: true,
        totalBrokers: brokerIds.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      this.logger.error('Failed to start daily metrics aggregation:', error);
      throw error;
    }
  }

  @Cron('0 0 * * 1') // Weekly on Monday at midnight
  async handleGenerateWeeklyAnalytics() {
    this.logger.log('Generating weekly analytics at midnight on Monday');

    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      // Queue weekly analytics generation
      const job = await this.analyticsQueue.add('generate-weekly-analytics', {
        period: {
          start: weekStart,
          end: now,
        },
        reportType: 'WEEKLY',
      }, {
        attempts: 2,
        backoff: 'exponential',
      });

      this.logger.log(`Weekly analytics generation job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        period: {
          start: weekStart.toISOString(),
          end: now.toISOString(),
        },
        message: 'Weekly analytics generation initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue weekly analytics generation:', error);
      throw error;
    }
  }

  @Cron('0 0 1 * *') // Monthly on 1st at midnight
  async handleGenerateMonthlyAnalytics() {
    this.logger.log('Generating monthly analytics on 1st of the month at midnight');

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Queue monthly analytics generation
      const job = await this.analyticsQueue.add('generate-monthly-analytics', {
        period: {
          start: monthStart,
          end: monthEnd,
        },
        reportType: 'MONTHLY',
      }, {
        attempts: 3,
        backoff: 'exponential',
      });

      this.logger.log(`Monthly analytics generation job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        period: {
          start: monthStart.toISOString(),
          end: monthEnd.toISOString(),
        },
        message: 'Monthly analytics generation initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue monthly analytics generation:', error);
      throw error;
    }
  }

  @Cron('*/5 * * * *') // Every 5 minutes
  async handleUpdateRealtimeMetrics() {
    this.logger.debug('Updating real-time dashboard metrics');

    try {
      // Get broker IDs with active connections (from Redis)
      const activeBrokers = await this.redis.smembers('realtime:active_brokers');

      for (const brokerId of activeBrokers) {
        // Queue real-time metrics update for each active broker
        await this.analyticsQueue.add('update-realtime-metrics', {
          brokerId,
          timestamp: new Date(),
        }, {
          attempts: 1,
          removeOnComplete: 100,
          removeOnFail: 10,
        });
      }

      // Update platform-wide metrics
      await this.analyticsQueue.add('update-platform-metrics', {
        timestamp: new Date(),
      }, {
        attempts: 1,
        removeOnComplete: true,
      });

      this.logger.debug(`Real-time metrics updates queued for ${activeBrokers.length} active brokers`);

      return {
        success: true,
        activeBrokers: activeBrokers.length,
      };
    } catch (error) {
      this.logger.error('Failed to queue real-time metrics updates:', error);
      // Don't throw error for real-time updates to prevent scheduler failures
    }
  }

  @Cron('0 2 * * *') // Daily at 2 AM
  async handleProcessApiUsageLogs() {
    this.logger.log('Processing daily API usage logs at 2 AM');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Queue API usage log processing
      const job = await this.analyticsQueue.add('process-api-usage-logs', {
        date: yesterday,
      }, {
        attempts: 2,
        backoff: 'fixed',
      });

      this.logger.log(`API usage log processing job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        date: yesterday.toISOString(),
        message: 'API usage log processing initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue API usage log processing:', error);
      throw error;
    }
  }

  @Cron('0 3 * * 0') // Weekly on Sunday at 3 AM
  async handleGeneratePerformanceReports() {
    this.logger.log('Generating weekly performance reports');

    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      // Queue performance report generation for all brokers
      const job = await this.analyticsQueue.add('generate-performance-reports', {
        period: {
          start: weekStart,
          end: now,
        },
        reportType: 'PERFORMANCE',
        includeCharts: true,
      }, {
        attempts: 2,
        backoff: 'exponential',
      });

      this.logger.log(`Performance reports generation job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        period: {
          start: weekStart.toISOString(),
          end: now.toISOString(),
        },
        message: 'Performance reports generation initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue performance reports generation:', error);
      throw error;
    }
  }

  @Cron('0 4 * * *') // Daily at 4 AM
  async handleUpdateMarketingAnalytics() {
    this.logger.log('Updating marketing analytics at 4 AM');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // In a real implementation, this would process marketing data from various sources
      const job = await this.analyticsQueue.add('update-marketing-analytics', {
        date: yesterday,
        sources: ['website', 'social_media', 'referrals', 'email_campaigns'],
      }, {
        attempts: 2,
        backoff: 'fixed',
      });

      this.logger.log(`Marketing analytics update job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        date: yesterday.toISOString(),
        message: 'Marketing analytics update initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue marketing analytics update:', error);
      throw error;
    }
  }

  @Cron('0 5 * * 6') // Weekly on Saturday at 5 AM
  async handleCleanupOldAnalyticsData() {
    this.logger.log('Cleaning up old analytics data');

    try {
      // Calculate cutoff date (keep 2 years of data)
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

      const job = await this.analyticsQueue.add('cleanup-analytics-data', {
        cutoffDate,
        options: {
          archiveOldData: true,
          compressBeforeArchive: true,
          keepAggregatedData: true,
        },
      }, {
        attempts: 1,
        removeOnComplete: true,
      });

      this.logger.log(`Analytics data cleanup job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        cutoffDate: cutoffDate.toISOString(),
        message: 'Analytics data cleanup initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue analytics data cleanup:', error);
      throw error;
    }
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async handleValidateAnalyticsData() {
    this.logger.log('Validating analytics data integrity');

    try {
      const job = await this.analyticsQueue.add('validate-analytics-data', {
        options: {
          checkDataIntegrity: true,
          checkAnomalies: true,
          generateValidationReport: true,
        },
      }, {
        attempts: 1,
        timeout: 600000, // 10 minutes timeout
      });

      this.logger.log(`Analytics data validation job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        message: 'Analytics data validation initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue analytics data validation:', error);
      throw error;
    }
  }

  // Manual trigger methods for admin and testing
  async triggerManualAnalyticsReport(
    brokerIds: string[],
    reportType: string,
    period: { start: Date; end: Date },
  ) {
    this.logger.log(`Triggering manual ${reportType} analytics report`);

    try {
      const job = await this.analyticsQueue.add('generate-custom-report', {
        brokerIds,
        reportType,
        period,
        isManual: true,
      });

      this.logger.log(`Manual ${reportType} report job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        brokerIds,
        reportType,
        period,
      };
    } catch (error) {
      this.logger.error(`Failed to trigger manual ${reportType} report:`, error);
      throw error;
    }
  }

  async triggerMetricsRecalculation(brokerId?: string) {
    this.logger.log(`Triggering metrics recalculation${brokerId ? ` for broker ${brokerId}` : ' for all brokers'}`);

    try {
      const job = await this.analyticsQueue.add('recalculate-metrics', {
        brokerId, // undefined means all brokers
        forceRecalculation: true,
      }, {
        attempts: 2,
        backoff: 'exponential',
      });

      this.logger.log(`Metrics recalculation job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        brokerId,
      };
    } catch (error) {
      this.logger.error('Failed to trigger metrics recalculation:', error);
      throw error;
    }
  }

  async clearCache(brokerId?: string) {
    this.logger.log(`Clearing analytics cache${brokerId ? ` for broker ${brokerId}` : ' for all brokers'}`);

    try {
      if (brokerId) {
        // Clear specific broker cache
        await this.redis.del(`broker:dashboard:${brokerId}`);
      } else {
        // Clear all analytics cache
        const keys = await this.redis.keys('broker:dashboard:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        await this.redis.del('admin:dashboard');
      }

      this.logger.log(`Cache cleared${brokerId ? ` for broker ${brokerId}` : ' for all brokers'}`);

      return {
        success: true,
        brokerId,
      };
    } catch (error) {
      this.logger.error('Failed to clear analytics cache:', error);
      throw error;
    }
  }

  private async getActiveBrokers(): Promise<Broker[]> {
    try {
      return await this.brokerRepository.find({
        where: {
          isActive: true,
          status: BrokerStatus.VERIFIED,
        },
        select: ['id'],
      });
    } catch (error) {
      this.logger.error('Failed to get active brokers:', error);
      return [];
    }
  }
}