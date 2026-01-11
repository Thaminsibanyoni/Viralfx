import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VPMXService } from "./vpmx.service";
import { VPMXIndexService } from "./vpmx-index.service";

@Injectable()
export class VPMXScheduler {
  private readonly logger = new Logger(VPMXScheduler.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly vpmxService: VPMXService,
    private readonly vpmxIndexService: VPMXIndexService,
    @InjectQueue('vpmx-compute') private readonly vpmxQueue: Queue,
    @InjectQueue('vpmx-analytics') private readonly aggregatesQueue: Queue,
    @InjectQueue('vpmx-prediction') private readonly regionalQueue: Queue,
    @InjectQueue('vpmx-breakout') private readonly healthQueue: Queue) {}

  /**
   * Main VPMX computation job - runs every 10 seconds
   */
  @Cron('*/10 * * * * *', {
    name: 'vpmx-compute-index',
    timeZone: 'UTC'
  })
  async computeVPMXIndex() {
    try {
      this.logger.debug('Starting VPMX index computation');

      // Get list of active VTS symbols that need computation
      const activeSymbols = await this.getActiveVTSSymbols();

      // Queue computation for each symbol
      for (const symbol of activeSymbols) {
        await this.vpmxQueue.add(
          'compute-index',
          {
            vtsSymbol: symbol,
            force: false
          },
          {
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000
            }
          });
      }

      this.logger.debug(`Queued VPMX computation for ${activeSymbols.length} symbols`);
    } catch (error) {
      this.logger.error('Failed to compute VPMX index', error);
    }
  }

  /**
   * Update VPMX aggregates every minute
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'vpmx-update-aggregates',
    timeZone: 'UTC'
  })
  async updateAggregates() {
    try {
      this.logger.debug('Updating VPMX aggregates');

      const intervals = ['1m', '5m', '15m'];

      for (const interval of intervals) {
        await this.aggregatesQueue.add(
          'refresh-aggregates',
          {
            interval,
            regions: ['US', 'ZA', 'UK', 'NG', 'GLOBAL']
          },
          {
            removeOnComplete: 50,
            removeOnFail: 25,
            attempts: 2,
            delay: 1000 * intervals.indexOf(interval) // Stagger jobs
          });
      }
    } catch (error) {
      this.logger.error('Failed to update VPMX aggregates', error);
    }
  }

  /**
   * Update regional VPMX data every 5 minutes
   */
  @Cron('*/5 * * * *', {
    name: 'vpmx-update-regional',
    timeZone: 'UTC'
  })
  async updateRegionalData() {
    try {
      this.logger.debug('Updating regional VPMX data');

      const regions = ['US', 'ZA', 'UK', 'NG', 'GLOBAL', 'EU', 'ASIA'];

      for (const region of regions) {
        await this.regionalQueue.add(
          'regional-index-update',
          {
            region,
            vtsSymbols: await this.getActiveVTSSymbolsForRegion(region)
          },
          {
            removeOnComplete: 20,
            removeOnFail: 10,
            attempts: 2,
            delay: Math.random() * 5000 // Random delay to prevent overlap
          });
      }
    } catch (error) {
      this.logger.error('Failed to update regional VPMX data', error);
    }
  }

  /**
   * Perform health checks every 15 minutes
   */
  @Cron('*/15 * * * *', {
    name: 'vpmx-health-check',
    timeZone: 'UTC'
  })
  async performHealthChecks() {
    try {
      this.logger.debug('Performing VPMX health checks');

      const healthChecks = ['memory', 'performance', 'data', 'connectivity'];

      for (const check of healthChecks) {
        await this.healthQueue.add(
          'health-check',
          {
            checkType: check
          },
          {
            removeOnComplete: 10,
            removeOnFail: 5,
            attempts: 1
          });
      }
    } catch (error) {
      this.logger.error('Failed to perform VPMX health checks', error);
    }
  }

  /**
   * Cleanup old data every hour
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'vpmx-cleanup-old-data',
    timeZone: 'UTC'
  })
  async cleanupOldData() {
    try {
      this.logger.debug('Cleaning up old VPMX data');

      await this.aggregatesQueue.add(
        'cleanup-old-data',
        {
          daysToKeep: 30 // Keep 30 days of data
        },
        {
          removeOnComplete: 5,
          removeOnFail: 3,
          attempts: 1
        });
    } catch (error) {
      this.logger.error('Failed to cleanup old VPMX data', error);
    }
  }

  /**
   * Update chart data every 5 minutes
   */
  @Cron('*/5 * * * *', {
    name: 'vpmx-update-chart-data',
    timeZone: 'UTC'
  })
  async updateChartData() {
    try {
      this.logger.debug('Updating VPMX chart data');

      const activeSymbols = await this.getActiveVTSSymbols();
      const intervals = ['1m', '5m', '15m', '1h'];

      for (const symbol of activeSymbols.slice(0, 50)) { // Limit to top 50 symbols
        const currentData = await this.vpmxService.getCurrentVPMX(symbol);

        if (currentData) {
          for (const interval of intervals) {
            await this.vpmxIndexService.cacheChartDataPoint(
              symbol,
              interval,
              {
                timestamp: currentData.timestamp,
                value: currentData.value,
                volume: Math.random() * 1000, // Placeholder volume
                components: currentData.components
              });
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to update chart data', error);
    }
  }

  /**
   * Generate daily VPMX report at midnight UTC
   */
  @Cron('0 0 * * *', {
    name: 'vpmx-daily-report',
    timeZone: 'UTC'
  })
  async generateDailyReport() {
    try {
      this.logger.log('Generating daily VPMX report');

      const reportData = await this.generateDailyReportData();

      // Store report
      await this.vpmxService.storeDailyReport(reportData);

      this.logger.log(`Daily VPMX report generated: ${reportData.summary.totalSymbols} symbols`);
    } catch (error) {
      this.logger.error('Failed to generate daily VPMX report', error);
    }
  }

  /**
   * Weekly VPMX analysis and weighting adjustments
   */
  @Cron('0 0 * * 0', {
    name: 'vpmx-weekly-analysis',
    timeZone: 'UTC'
  })
  async performWeeklyAnalysis() {
    try {
      this.logger.log('Performing weekly VPMX analysis');

      const analysis = await this.analyzeWeeklyPerformance();

      // Apply automatic weighting adjustments if needed
      if (analysis.requiresWeightingAdjustment) {
        await this.applyWeightingAdjustments(analysis.recommendedWeights);
      }

      this.logger.log('Weekly VPMX analysis completed');
    } catch (error) {
      this.logger.error('Failed to perform weekly VPMX analysis', error);
    }
  }

  /**
   * Monthly VPMX metrics reset and archiving
   */
  @Cron('0 0 1 * *', {
    name: 'vpmx-monthly-maintenance',
    timeZone: 'UTC'
  })
  async performMonthlyMaintenance() {
    try {
      this.logger.log('Performing monthly VPMX maintenance');

      // Archive old data
      await this.archiveMonthlyData();

      // Reset monthly counters
      await this.resetMonthlyCounters();

      // Generate monthly report
      await this.generateMonthlyReport();

      this.logger.log('Monthly VPMX maintenance completed');
    } catch (error) {
      this.logger.error('Failed to perform monthly VPMX maintenance', error);
    }
  }

  /**
   * Custom job to recompute specific VTS symbols
   */
  async recomputeSymbols(symbols: string[], priority = 5): Promise<void> {
    try {
      this.logger.log(`Queuing recomputation for ${symbols.length} symbols`);

      for (const symbol of symbols) {
        await this.vpmxQueue.add(
          'compute-index',
          {
            vtsSymbol: symbol,
            force: true
          },
          {
            priority,
            removeOnComplete: 10,
            removeOnFail: 5,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 500
            }
          });
      }
    } catch (error) {
      this.logger.error('Failed to queue symbol recomputation', error);
    }
  }

  /**
   * Get queue status and metrics
   */
  async getQueueStatus(): Promise<any> {
    try {
      const [
        computationQueue,
        aggregatesQueue,
        regionalQueue,
        healthQueue,
      ] = await Promise.all([
        this.getQueueMetrics('vpmx-computation'),
        this.getQueueMetrics('vpmx-aggregates'),
        this.getQueueMetrics('vpmx-regional'),
        this.getQueueMetrics('vpmx-health'),
      ]);

      return {
        computationQueue,
        aggregatesQueue,
        regionalQueue,
        healthQueue,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to get queue status', error);
      return null;
    }
  }

  /**
   * Pause all VPMX processing
   */
  async pauseAllProcessing(): Promise<void> {
    try {
      await this.vpmxQueue.pause();
      await this.aggregatesQueue.pause();
      await this.regionalQueue.pause();
      await this.healthQueue.pause();

      this.logger.log('All VPMX processing paused');
    } catch (error) {
      this.logger.error('Failed to pause VPMX processing', error);
    }
  }

  /**
   * Resume all VPMX processing
   */
  async resumeAllProcessing(): Promise<void> {
    try {
      await this.vpmxQueue.resume();
      await this.aggregatesQueue.resume();
      await this.regionalQueue.resume();
      await this.healthQueue.resume();

      this.logger.log('All VPMX processing resumed');
    } catch (error) {
      this.logger.error('Failed to resume VPMX processing', error);
    }
  }

  // Private helper methods

  private async getActiveVTSSymbols(): Promise<string[]> {
    // In a real implementation, this would query the database for active symbols
    // For now, return a placeholder list
    return [
      'V:US:ENT:BEIBERNEWALBUM',
      'V:ZA:ENT:ZINHLEXD',
      'V:GLOBAL:SPORT:WORLDCUP',
      'V:US:POL:BIDEN2028',
      'V:UK:ENT:ROYALWEDDING',
    ];
  }

  private async getActiveVTSSymbolsForRegion(region: string): Promise<string[]> {
    const allSymbols = await this.getActiveVTSSymbols();
    return allSymbols.filter(symbol => symbol.includes(`:${region}:`));
  }

  private async getQueueMetrics(queueName: string): Promise<any> {
    try {
      const queue = this.schedulerRegistry.getQueue(queueName);
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
      ]);

      return {
        name: queueName,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        isPaused: await queue.isPaused()
      };
    } catch (error) {
      this.logger.error(`Failed to get metrics for queue ${queueName}`, error);
      return null;
    }
  }

  private async generateDailyReportData(): Promise<any> {
    const topSymbols = await this.vpmxService.getTopTrendingVPMX(10);
    const totalDataPoints = await this.vpmxService.countRecentVPMXData(24);

    return {
      date: new Date().toISOString().split('T')[0],
      summary: {
        totalSymbols: topSymbols.length,
        totalDataPoints,
        averageVPMX: topSymbols.reduce((sum, s) => sum + s.value, 0) / topSymbols.length,
        topMover: topSymbols[0]?.vtsSymbol
      },
      topPerformers: topSymbols,
      regionalBreakdown: await this.getRegionalBreakdown()
    };
  }

  private async getRegionalBreakdown(): Promise<any> {
    // Placeholder implementation
    return {
      US: { count: 45, avgVPMX: 678 },
      ZA: { count: 23, avgVPMX: 542 },
      UK: { count: 18, avgVPMX: 598 },
      NG: { count: 12, avgVPMX: 487 },
      GLOBAL: { count: 2, avgVPMX: 756 }
    };
  }

  private async analyzeWeeklyPerformance(): Promise<any> {
    // Placeholder implementation
    return {
      requiresWeightingAdjustment: false,
      recommendedWeights: {
        globalSentimentWeight: 0.20,
        viralMomentumWeight: 0.20,
        trendVelocityWeight: 0.15,
        mentionVolumeWeight: 0.15,
        engagementQualityWeight: 0.10,
        trendStabilityWeight: 0.10,
        deceptionRiskWeight: 0.05,
        regionalWeightingWeight: 0.05
      },
      performanceMetrics: {
        accuracy: 0.87,
        volatilityIndex: 0.34,
        predictionSuccess: 0.72
      }
    };
  }

  private async applyWeightingAdjustments(weights: any): Promise<void> {
    await this.vpmxService.updateWeightingConfig(weights);
    this.logger.log('Applied automatic weighting adjustments');
  }

  private async archiveMonthlyData(): Promise<void> {
    // Implementation for archiving old data
    this.logger.log('Archived monthly VPMX data');
  }

  private async resetMonthlyCounters(): Promise<void> {
    // Implementation for resetting monthly counters
    this.logger.log('Reset monthly VPMX counters');
  }

  private async generateMonthlyReport(): Promise<void> {
    // Implementation for generating monthly reports
    this.logger.log('Generated monthly VPMX report');
  }
}
