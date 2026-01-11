import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

import { AnalyticsService } from '../services/analytics.service';
import { MarketDataAggregationService } from '../services/market-data-aggregation.service';
import { PerformanceService } from '../services/performance.service';
// TypeORM entity removed - using Prisma instead
// import { DataInterval } from "../../../database/entities/market-data.entity";

@Processor('analytics-calculation')
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly marketDataAggregationService: MarketDataAggregationService,
    private readonly performanceService: PerformanceService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'aggregate-market-data':
        return this.processMarketDataAggregation(job);
      case 'calculate-performance':
        return this.processPerformanceCalculation(job);
      case 'update-leaderboard':
        return this.processLeaderboardUpdate(job);
      case 'cleanup-old-data':
        return this.processDataCleanup(job);
      case 'batch-realtime-metrics':
        return this.processBatchRealtimeMetrics(job);
      case 'aggregate-all-topics':
        return this.processAggregateAllTopics(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async processMarketDataAggregation(job: Job<{
    topicId: string;
    interval: string; // Changed from DataInterval to string
    startTime?: Date;
    endTime?: Date;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing market data aggregation for topic ${job.data.topicId}, interval ${job.data.interval}`);

      const { topicId, interval, startTime, endTime } = job.data;

      // Update progress
      await job.updateProgress(10);

      // Aggregate viral data into market data
      const aggregatedData = await this.marketDataAggregationService.aggregateViralData(
        topicId,
        interval,
        startTime,
        endTime
      );

      await job.updateProgress(90);

      // Update progress
      await job.updateProgress(100);

      this.logger.log(`Market data aggregation completed for topic ${topicId}. Generated ${aggregatedData.length} data points.`);
      return {
        topicId,
        interval,
        dataPointsCount: aggregatedData.length,
        startTime,
        endTime
      };

    } catch (error) {
      this.logger.error(`Market data aggregation job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async processPerformanceCalculation(job: Job<{
    entityType: string;
    entityId: string;
    period: string;
    forceRecalculate?: boolean;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing performance calculation for ${job.data.entityType}:${job.data.entityId}, period ${job.data.period}`);

      const { entityType, entityId, period, forceRecalculate = false } = job.data;

      // Update progress
      await job.updateProgress(10);

      if (entityType === 'STRATEGY') {
        await this.performanceService.trackStrategyPerformance(entityId as any, period as any);
      } else if (entityType === 'USER') {
        // This would require user ID from context or job data
        this.logger.warn(`User performance tracking not fully implemented`);
      }

      await job.updateProgress(100);

      this.logger.log(`Performance calculation completed for ${entityType}:${entityId}, period ${period}`);
      return {
        entityType,
        entityId,
        period,
        completed: true
      };

    } catch (error) {
      this.logger.error(`Performance calculation job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async processLeaderboardUpdate(job: Job<{
    metricTypes?: string[];
    periods?: string[];
    entityTypes?: string[];
  }>): Promise<any> {
    try {
      this.logger.log(`Processing leaderboard update`);

      const {
        metricTypes = ['TOTAL_RETURN', 'SHARPE_RATIO', 'WIN_RATE', 'PROFIT_FACTOR'],
        periods = ['1D', '7D', '30D', 'ALL_TIME'],
        entityTypes = ['STRATEGY', 'USER']
      } = job.data;

      const results = [];

      // Update progress
      await job.updateProgress(10);

      for (const entityType of entityTypes) {
        for (const metricType of metricTypes) {
          for (const period of periods) {
            try {
              // This would trigger leaderboard recalculation
              // The actual calculation happens when the leaderboard is requested
              // Here we just clear the cache to force recalculation
              const leaderboard = await this.performanceService.getLeaderboard(
                metricType,
                period as any,
                50,
                entityType as any
              );

              results.push({
                entityType,
                metricType,
                period,
                entriesCount: leaderboard.length,
                topPerformer: leaderboard[0]?.entityId
              });

            } catch (error) {
              this.logger.warn(`Failed to update leaderboard for ${entityType}:${metricType}:${period}:`, error);
            }
          }
        }

        // Update progress
        const progress = 10 + ((entityTypes.indexOf(entityType) + 1) / entityTypes.length) * 80;
        await job.updateProgress(progress);
      }

      await job.updateProgress(100);

      this.logger.log(`Leaderboard update completed. Processed ${results.length} leaderboard combinations.`);
      return {
        processedCombinations: results.length,
        results,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Leaderboard update job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async processDataCleanup(job: Job<{
    daysToKeep?: number;
    dryRun?: boolean;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing data cleanup`);

      const { daysToKeep = 90, dryRun = false } = job.data;

      // Update progress
      await job.updateProgress(10);

      if (dryRun) {
        // Just check what would be deleted without actually deleting
        const stats = await this.marketDataAggregationService.getAggregationStats();
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

        this.logger.log(`Dry run: Would delete data older than ${cutoffDate}`);
        await job.updateProgress(100);

        return {
          dryRun: true,
          cutoffDate,
          totalDataPoints: stats.totalMarketDataPoints,
          estimatedDeletions: 'Estimation not implemented in dry run'
        };
      } else {
        // Actually perform cleanup
        await this.marketDataAggregationService.cleanupOldData(daysToKeep);
        await job.updateProgress(100);

        // Get post-cleanup stats
        const stats = await this.marketDataAggregationService.getAggregationStats();

        this.logger.log(`Data cleanup completed. Retention period: ${daysToKeep} days`);
        return {
          dryRun: false,
          daysToKeep,
          remainingDataPoints: stats.totalMarketDataPoints,
          cleanupCompleted: true
        };
      }

    } catch (error) {
      this.logger.error(`Data cleanup job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async processBatchRealtimeMetrics(job: Job<{
    symbols: string[];
    batchSize?: number;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing batch real-time metrics calculation for ${job.data.symbols.length} symbols`);

      const { symbols, batchSize = 10 } = job.data;
      const results = [];

      // Process symbols in batches
      const batches = this.chunkArray(symbols, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchResults = [];

        for (const symbol of batch) {
          try {
            const metrics = await this.analyticsService.calculateRealTimeMetrics(symbol);
            batchResults.push({
              symbol,
              success: true,
              metrics
            });
          } catch (error) {
            this.logger.warn(`Failed to calculate real-time metrics for ${symbol}:`, error);
            batchResults.push({
              symbol,
              success: false,
              error: error.message
            });
          }
        }

        results.push(...batchResults);

        // Update progress
        const progress = Math.floor(((i + 1) / batches.length) * 90) + 10;
        await job.updateProgress(progress);
      }

      await job.updateProgress(100);

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.log(`Batch real-time metrics completed: ${successful} successful, ${failed} failed`);
      return {
        totalSymbols: symbols.length,
        successful,
        failed,
        results,
        processedAt: new Date()
      };

    } catch (error) {
      this.logger.error(`Batch real-time metrics job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async processAggregateAllTopics(job: Job<{
    interval?: string; // Changed from DataInterval to string
    timeRangeHours?: number;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing aggregation for all active topics`);

      const { interval = 'ONE_HOUR', timeRangeHours = 24 } = job.data;

      // Update progress
      await job.updateProgress(10);

      // This would get all active topics from Prisma
      // For now, we'll use the aggregation service method
      await this.marketDataAggregationService.aggregateRecentViralData();

      await job.updateProgress(100);

      this.logger.log(`All topics aggregation completed for interval ${interval}`);
      return {
        interval,
        timeRangeHours,
        completed: true,
        processedAt: new Date()
      };

    } catch (error) {
      this.logger.error(`Aggregate all topics job ${job.id} failed:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Analytics calculation job ${job.id} started: ${job.data}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`Analytics calculation job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Analytics calculation job ${job.id} failed:`, error);
  }

  // Helper methods

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
