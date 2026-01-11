import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { MarketDataAggregationService } from '../services/market-data-aggregation.service';
import { PerformanceService } from '../services/performance.service';
import { StrategyService } from '../services/strategy.service';
import { ReportService } from '../services/report.service';
// COMMENTED OUT (TypeORM entity deleted): import { DataInterval } from "../../../database/entities/market-data.entity";

@Injectable()
export class AnalyticsScheduler implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsScheduler.name);

  constructor(
    @InjectQueue('analytics-calculation') private readonly analyticsQueue: Queue,
    @InjectQueue('analytics-report') private readonly reportQueue: Queue,
    private readonly marketDataAggregationService: MarketDataAggregationService,
    private readonly performanceService: PerformanceService,
    private readonly strategyService: StrategyService,
    private readonly reportService: ReportService) {}

  onModuleInit() {
    this.logger.log('Analytics scheduler initialized');
  }

  /**
   * Aggregate recent viral data every 5 minutes
   */
  @Cron('*/5 * * * *')
  async aggregateRecentViralData(): Promise<void> {
    try {
      this.logger.debug('Running 5-minute viral data aggregation');

      // Queue aggregation jobs for different intervals
      const intervals = [DataInterval.ONE_MINUTE, DataInterval.FIVE_MINUTES];

      for (const interval of intervals) {
        await this.analyticsQueue.add('aggregate-all-topics', {
          interval,
          timeRangeHours: 1 // Last hour of data
        }, {
          priority: 5, // Medium priority
          removeOnComplete: 10,
          removeOnFail: 5
        });
      }

      this.logger.debug('Queued recent viral data aggregation jobs');
    } catch (error) {
      this.logger.error('Failed to schedule recent viral data aggregation:', error);
    }
  }

  /**
   * Aggregate hourly data every hour
   */
  @Cron('0 * * * *')
  async aggregateHourlyData(): Promise<void> {
    try {
      this.logger.debug('Running hourly data aggregation');

      await this.analyticsQueue.add('aggregate-all-topics', {
        interval: DataInterval.ONE_HOUR,
        timeRangeHours: 24 // Last 24 hours
      }, {
        priority: 7, // Higher priority for hourly data
        removeOnComplete: 5,
        removeOnFail: 3
      });

      this.logger.debug('Queued hourly data aggregation job');
    } catch (error) {
      this.logger.error('Failed to schedule hourly data aggregation:', error);
    }
  }

  /**
   * Calculate daily performance metrics at midnight
   */
  @Cron('0 0 * * *')
  async calculateDailyPerformance(): Promise<void> {
    try {
      this.logger.log('Running daily performance calculation');

      const periods = ['1D', '7D', '30D', '90D', '1Y'];
      const entityTypes = ['STRATEGY', 'USER'];

      // Queue performance calculation jobs
      for (const entityType of entityTypes) {
        for (const period of periods) {
          await this.analyticsQueue.add('calculate-performance', {
            entityType,
            period,
            forceRecalculate: true
          }, {
            priority: 6, // Medium-high priority
            removeOnComplete: 3,
            removeOnFail: 2
          });
        }
      }

      this.logger.log('Queued daily performance calculation jobs');
    } catch (error) {
      this.logger.error('Failed to schedule daily performance calculation:', error);
    }
  }

  /**
   * Update leaderboards daily at 2 AM
   */
  @Cron('0 2 * * *')
  async updateLeaderboards(): Promise<void> {
    try {
      this.logger.log('Running daily leaderboard update');

      await this.analyticsQueue.add('update-leaderboard', {
        metricTypes: ['TOTAL_RETURN', 'SHARPE_RATIO', 'WIN_RATE', 'PROFIT_FACTOR', 'VOLATILITY'],
        periods: ['1D', '7D', '30D', '90D', '1Y', 'ALL_TIME'],
        entityTypes: ['STRATEGY', 'USER']
      }, {
        priority: 8, // High priority
        removeOnComplete: 3,
        removeOnFail: 2
      });

      this.logger.log('Queued leaderboard update job');
    } catch (error) {
      this.logger.error('Failed to schedule leaderboard update:', error);
    }
  }

  /**
   * Clean up old data daily at 3 AM
   */
  @Cron('0 3 * * *')
  async cleanupOldData(): Promise<void> {
    try {
      this.logger.log('Running daily data cleanup');

      await this.analyticsQueue.add('cleanup-old-data', {
        daysToKeep: 90, // Keep 90 days of minute/hourly data
        dryRun: false
      }, {
        priority: 3, // Low priority
        removeOnComplete: 1,
        removeOnFail: 1
      });

      this.logger.log('Queued data cleanup job');
    } catch (error) {
      this.logger.error('Failed to schedule data cleanup:', error);
    }
  }

  /**
   * Generate weekly performance reports on Sundays at 9 AM
   */
  @Cron('0 9 * * 0')
  async generateWeeklyReports(): Promise<void> {
    try {
      this.logger.log('Running weekly report generation');

      // Generate reports for top performing strategies
      const leaderboard = await this.performanceService.getLeaderboard(
        'TOTAL_RETURN',
        '7D',
        10, // Top 10 strategies
        'STRATEGY'
      );

      for (const entry of leaderboard) {
        await this.reportQueue.add('generate-performance-report', {
          reportId: null, // Will be generated by the service
          config: {
            type: 'performance',
            entityType: 'strategy',
            entityId: entry.entityId,
            period: '7D',
            format: 'json',
            options: {
              includeCharts: true,
              includeTrades: true
            }
          },
          timestamp: new Date()
        }, {
          priority: 4, // Low-medium priority
          removeOnComplete: 5,
          removeOnFail: 3
        });
      }

      this.logger.log(`Queued ${leaderboard.length} weekly performance report generation jobs`);
    } catch (error) {
      this.logger.error('Failed to schedule weekly report generation:', error);
    }
  }

  /**
   * Calculate real-time metrics for active symbols every 2 minutes
   */
  @Cron('*/2 * * * *')
  async calculateRealTimeMetrics(): Promise<void> {
    try {
      this.logger.debug('Running real-time metrics calculation');

      // Get list of actively tracked symbols
      // This would typically come from a list of trending symbols or user watchlists
      const activeSymbols = await this.getActiveSymbols();

      if (activeSymbols.length > 0) {
        await this.analyticsQueue.add('batch-realtime-metrics', {
          symbols: activeSymbols,
          batchSize: 20
        }, {
          priority: 9, // Very high priority for real-time data
          removeOnComplete: 20,
          removeOnFail: 10
        });

        this.logger.debug(`Queued real-time metrics calculation for ${activeSymbols.length} symbols`);
      }
    } catch (error) {
      this.logger.error('Failed to schedule real-time metrics calculation:', error);
    }
  }

  /**
   * Sync historical data for new trends every 6 hours
   */
  @Cron('0 */6 * * *')
  async syncHistoricalData(): Promise<void> {
    try {
      this.logger.log('Running historical data sync');

      // This would identify new trends that need historical data backfill
      const newTrends = await this.getNewTrendsNeedingSync();

      for (const trend of newTrends) {
        await this.analyticsQueue.add('aggregate-market-data', {
          topicId: trend.id,
          interval: DataInterval.ONE_HOUR,
          startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          endTime: new Date()
        }, {
          priority: 2, // Low priority
          removeOnComplete: 3,
          removeOnFail: 2
        });
      }

      if (newTrends.length > 0) {
        this.logger.log(`Queued historical data sync for ${newTrends.length} new trends`);
      }
    } catch (error) {
      this.logger.error('Failed to schedule historical data sync:', error);
    }
  }

  /**
   * Cleanup expired reports daily at 4 AM
   */
  @Cron('0 4 * * *')
  async cleanupExpiredReports(): Promise<void> {
    try {
      this.logger.log('Running expired reports cleanup');

      await this.reportQueue.add('cleanup-expired-reports', {
        hoursToKeep: 168, // 7 days
        dryRun: false
      }, {
        priority: 1, // Lowest priority
        removeOnComplete: 1,
        removeOnFail: 1
      });

      this.logger.log('Queued expired reports cleanup job');
    } catch (error) {
      this.logger.error('Failed to schedule expired reports cleanup:', error);
    }
  }

  /**
   * Seed system strategies on startup (run once)
   */
  @Cron('0 5 1 1 *') // January 1st at 5 AM - once per year
  async seedSystemStrategies(): Promise<void> {
    try {
      this.logger.log('Running system strategies seeding');

      await this.strategyService.seedDefaultStrategies();

      this.logger.log('System strategies seeding completed');
    } catch (error) {
      this.logger.error('Failed to seed system strategies:', error);
    }
  }

  /**
   * Generate monthly analytics summary on the 1st of each month at 8 AM
   */
  @Cron('0 8 1 * *')
  async generateMonthlySummary(): Promise<void> {
    try {
      this.logger.log('Running monthly analytics summary generation');

      await this.reportQueue.add('generate-performance-report', {
        reportId: null,
        config: {
          type: 'performance',
          entityType: 'system',
          entityId: 'platform',
          period: '30D',
          format: 'json',
          options: {
            includeCharts: true,
            customMetrics: ['user_growth', 'strategy_adoption', 'platform_usage']
          }
        },
        timestamp: new Date()
      }, {
        priority: 5,
        removeOnComplete: 3,
        removeOnFail: 2
      });

      this.logger.log('Queued monthly analytics summary generation');
    } catch (error) {
      this.logger.error('Failed to schedule monthly summary generation:', error);
    }
  }

  // Helper methods

  private async getActiveSymbols(): Promise<string[]> {
    try {
      // This would query for currently active/trending symbols
      // For now, return a mock list
      return [
        'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'BTC', 'ETH',
        'GameStop', 'AMC', 'TrendingTopic1', 'TrendingTopic2'
      ];
    } catch (error) {
      this.logger.error('Failed to get active symbols:', error);
      return [];
    }
  }

  private async getNewTrendsNeedingSync(): Promise<Array<{ id: string; topicName: string }>> {
    try {
      // This would query for trends that don't have sufficient historical data
      // For now, return empty array
      return [];
    } catch (error) {
      this.logger.error('Failed to get new trends needing sync:', error);
      return [];
    }
  }
}
