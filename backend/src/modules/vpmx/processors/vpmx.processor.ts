import { Processor, Process, Logger } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { VPMXService } from '../vpmx.service';
import { VPMXComputationService } from '../vpmx-computation.service';
import { VPMXIndexService } from '../vpmx-index.service';

export interface ComputeIndexJob {
  vtsSymbol: string;
  timestamp?: string;
  force?: boolean;
}

export interface UpdateWeightingJob {
  globalSentimentWeight: number;
  viralMomentumWeight: number;
  trendVelocityWeight: number;
  mentionVolumeWeight: number;
  engagementQualityWeight: number;
  trendStabilityWeight: number;
  deceptionRiskWeight: number;
  regionalWeightingWeight: number;
}

export interface RefreshAggregatesJob {
  interval: string; // '1m', '5m', '15m', '1h', '1d'
  regions?: string[];
}

export interface RegionalIndexJob {
  region: string;
  vtsSymbols: string[];
}

export interface HealthCheckJob {
  checkType: 'memory' | 'performance' | 'data' | 'connectivity';
}

@Processor('vpmx-computation')
export class VPMXProcessor {
  private readonly logger = new Logger(VPMXProcessor.name);

  constructor(
    private readonly vpmxService: VPMXService,
    private readonly vpmxComputationService: VPMXComputationService,
    private readonly vpmxIndexService: VPMXIndexService,
  ) {}

  @Process('compute-index')
  async handleComputeIndex(job: Job<ComputeIndexJob>) {
    this.logger.log(`Processing VPMX computation for ${job.data.vtsSymbol}`);

    try {
      const { vtsSymbol, timestamp, force } = job.data;

      // Check if recent computation exists (unless forced)
      if (!force) {
        const recent = await this.vpmxService.getLatestVPMX(vtsSymbol);
        const timeDiff = Date.now() - recent.timestamp.getTime();

        // Skip if computation is less than 30 seconds old
        if (recent && timeDiff < 30000) {
          this.logger.log(`Skipping computation for ${vtsSymbol} - recent data exists`);
          return { skipped: true, reason: 'Recent data exists' };
        }
      }

      // Compute VPMX
      const timestampDate = timestamp ? new Date(timestamp) : new Date();
      const result = await this.vpmxComputationService.computeVPMX(
        vtsSymbol,
        timestampDate,
      );

      // Store result
      await this.vpmxService.storeVPMXResult(result);

      // Update real-time data
      await this.vpmxIndexService.updateRealtimeIndex(result);

      this.logger.log(`VPMX computation completed for ${vtsSymbol}: ${result.value}`);

      return {
        success: true,
        vtsSymbol,
        value: result.value,
        timestamp: result.timestamp,
      };
    } catch (error) {
      this.logger.error(`VPMX computation failed for ${job.data.vtsSymbol}`, error);
      throw error;
    }
  }

  @Process('batch-compute')
  async handleBatchCompute(job: Job<{ vtsSymbols: string[]; timestamp?: string }>) {
    this.logger.log(`Processing batch VPMX computation for ${job.data.vtsSymbols.length} symbols`);

    const { vtsSymbols, timestamp } = job.data;
    const results = [];

    for (const symbol of vtsSymbols) {
      try {
        // Queue individual computations
        const jobId = await this.vpmxComputationService.queueVPMXComputation(
          symbol,
          timestamp ? new Date(timestamp) : undefined,
        );
        results.push({ symbol, jobId, status: 'queued' });
      } catch (error) {
        this.logger.error(`Failed to queue computation for ${symbol}`, error);
        results.push({ symbol, error: error.message, status: 'failed' });
      }
    }

    return results;
  }
}

@Processor('vpmx-weighting')
export class VPMXWeightingProcessor {
  private readonly logger = new Logger(VPMXWeightingProcessor.name);

  constructor(private readonly vpmxService: VPMXService) {}

  @Process('update-weighting')
  async handleUpdateWeighting(job: Job<UpdateWeightingJob>) {
    this.logger.log('Updating VPMX weighting configuration');

    try {
      await this.vpmxService.updateWeightingConfig(job.data);

      this.logger.log('VPMX weighting updated successfully');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to update VPMX weighting', error);
      throw error;
    }
  }
}

@Processor('vpmx-aggregates')
export class VPMXAggregatesProcessor {
  private readonly logger = new Logger(VPMXAggregatesProcessor.name);

  constructor(private readonly vpmxService: VPMXService) {}

  @Process('refresh-aggregates')
  async handleRefreshAggregates(job: Job<RefreshAggregatesJob>) {
    this.logger.log(`Refreshing VPMX aggregates for interval: ${job.data.interval}`);

    try {
      const { interval, regions } = job.data;

      // Refresh aggregate data
      await this.vpmxService.refreshAggregates(interval, regions);

      // Update historical data
      await this.vpmxService.updateHistoricalAggregates(interval);

      this.logger.log(`VPMX aggregates refreshed for ${interval}`);
      return { success: true, interval };
    } catch (error) {
      this.logger.error('Failed to refresh VPMX aggregates', error);
      throw error;
    }
  }

  @Process('cleanup-old-data')
  async handleCleanupOldData(job: Job<{ daysToKeep: number }>) {
    this.logger.log(`Cleaning up VPMX data older than ${job.data.daysToKeep} days`);

    try {
      const deletedCount = await this.vpmxService.cleanupOldData(job.data.daysToKeep);

      this.logger.log(`Cleaned up ${deletedCount} old VPMX records`);
      return { success: true, deletedCount };
    } catch (error) {
      this.logger.error('Failed to cleanup old VPMX data', error);
      throw error;
    }
  }
}

@Processor('vpmx-regional')
export class VPMXRegionalProcessor {
  private readonly logger = new Logger(VPMXRegionalProcessor.name);

  constructor(private readonly vpmxService: VPMXService) {}

  @Process('regional-index-update')
  async handleRegionalIndexUpdate(job: Job<RegionalIndexJob>) {
    this.logger.log(`Updating regional VPMX index for ${job.data.region}`);

    try {
      const { region, vtsSymbols } = job.data;

      // Compute regional index
      const regionalIndex = await this.vpmxService.computeRegionalIndex(
        region,
        vtsSymbols,
      );

      // Store regional data
      await this.vpmxService.storeRegionalVPMX(region, regionalIndex);

      this.logger.log(`Regional VPMX updated for ${region}: ${regionalIndex.value}`);
      return { success: true, region, value: regionalIndex.value };
    } catch (error) {
      this.logger.error(`Failed to update regional VPMX for ${job.data.region}`, error);
      throw error;
    }
  }

  @Process('regional-synchronization')
  async handleRegionalSynchronization(job: Job<{ regions: string[] }>) {
    this.logger.log('Synchronizing regional VPMX data');

    try {
      const { regions } = job.data;
      const results = [];

      for (const region of regions) {
        try {
          const syncResult = await this.vpmxService.synchronizeRegionalData(region);
          results.push({ region, success: true, ...syncResult });
        } catch (error) {
          this.logger.error(`Failed to sync region ${region}`, error);
          results.push({ region, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Regional synchronization failed', error);
      throw error;
    }
  }
}

@Processor('vpmx-health')
export class VPMXHealthProcessor {
  private readonly logger = new Logger(VPMXHealthProcessor.name);

  constructor(private readonly vpmxService: VPMXService) {}

  @Process('health-check')
  async handleHealthCheck(job: Job<HealthCheckJob>) {
    this.logger.log(`Performing VPMX health check: ${job.data.checkType}`);

    try {
      const { checkType } = job.data;

      switch (checkType) {
        case 'memory':
          return await this.checkMemoryUsage();
        case 'performance':
          return await this.checkPerformanceMetrics();
        case 'data':
          return await this.checkDataIntegrity();
        case 'connectivity':
          return await this.checkServiceConnectivity();
        default:
          throw new Error(`Unknown health check type: ${checkType}`);
      }
    } catch (error) {
      this.logger.error(`Health check failed: ${job.data.checkType}`, error);
      throw error;
    }
  }

  private async checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    return {
      type: 'memory',
      status: memoryUsagePercent > 90 ? 'critical' : memoryUsagePercent > 75 ? 'warning' : 'healthy',
      metrics: {
        heapUsed: usedMemory,
        heapTotal: totalMemory,
        usagePercent: memoryUsagePercent,
      },
    };
  }

  private async checkPerformanceMetrics() {
    const startTime = Date.now();

    // Perform test computation
    await this.vpmxService.getLatestVPMX('TEST:SYMBOL');

    const responseTime = Date.now() - startTime;

    return {
      type: 'performance',
      status: responseTime > 5000 ? 'critical' : responseTime > 2000 ? 'warning' : 'healthy',
      metrics: {
        responseTime,
        timestamp: new Date(),
      },
    };
  }

  private async checkDataIntegrity() {
    const recentDataCount = await this.vpmxService.countRecentVPMXData(24); // Last 24 hours

    return {
      type: 'data',
      status: recentDataCount < 100 ? 'warning' : 'healthy',
      metrics: {
        recentDataCount,
        last24Hours: recentDataCount,
      },
    };
  }

  private async checkServiceConnectivity() {
    // Check connectivity to dependent services
    const checks = [
      { name: 'database', status: await this.checkDatabaseConnection() },
      { name: 'redis', status: await this.checkRedisConnection() },
      { name: 'sentiment-service', status: await this.checkSentimentServiceConnection() },
    ];

    const allHealthy = checks.every(check => check.status);

    return {
      type: 'connectivity',
      status: allHealthy ? 'healthy' : 'critical',
      metrics: { services: checks },
    };
  }

  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      await this.vpmxService.testDatabaseConnection();
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedisConnection(): Promise<boolean> {
    try {
      await this.vpmxService.testRedisConnection();
      return true;
    } catch {
      return false;
    }
  }

  private async checkSentimentServiceConnection(): Promise<boolean> {
    try {
      await this.vpmxService.testSentimentServiceConnection();
      return true;
    } catch {
      return false;
    }
  }
}