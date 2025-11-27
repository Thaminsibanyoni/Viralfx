import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { VPMXCoreService } from '../services/vpmx-core.service';
import { VPMXAnalyticsService } from '../services/vpmx-analytics.service';
import { PrismaService } from '../../../prisma/prisma.service';

interface VPMXComputeJob {
  vtsSymbol: string;
  timestamp?: string;
  force?: boolean;
  priority?: number;
}

@Processor('vpmx-compute')
export class VPMXComputeProcessor {
  private readonly logger = new Logger(VPMXComputeProcessor.name);

  constructor(
    private readonly vpmxCoreService: VPMXCoreService,
    private readonly vpmxAnalyticsService: VPMXAnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('compute-index')
  async handleComputeIndex(job: Job<VPMXComputeJob>): Promise<any> {
    const { vtsSymbol, timestamp, force = false } = job.data;

    try {
      this.logger.log(`Processing VPMX computation for ${vtsSymbol}`);

      // Check if recent computation exists (unless forced)
      if (!force) {
        const recentComputation = await this.getRecentComputation(vtsSymbol);
        if (recentComputation && this.isComputationFresh(recentComputation.timestamp)) {
          this.logger.debug(`Skipping computation for ${vtsSymbol} - recent data exists`);
          return { skipped: true, reason: 'fresh_data_exists', data: recentComputation };
        }
      }

      // Compute VPMX
      const computeTimestamp = timestamp ? new Date(timestamp) : new Date();
      const vpmxResult = await this.vpmxCoreService.computeVPMX(vtsSymbol, computeTimestamp);

      // Save to database
      await this.saveVPMXIndex(vpmxResult);

      // Save to history
      await this.saveVPMXHistory(vpmxResult);

      // Check for breakouts
      await this.detectBreakouts(vpmxResult);

      // Update analytics
      await this.updateAnalytics(vtsSymbol, vpmxResult);

      this.logger.log(`Successfully computed VPMX for ${vtsSymbol}: ${vpmxResult.value}`);

      return {
        success: true,
        vtsSymbol,
        value: vpmxResult.value,
        timestamp: vpmxResult.metadata.timestamp || new Date(),
        computationTime: Date.now() - job.timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to compute VPMX for ${vtsSymbol}`, error);

      // Log failure to audit table
      await this.logComputationFailure(vtsSymbol, error);

      throw error;
    }
  }

  @Process('batch-compute')
  async handleBatchCompute(job: Job<{ vtsSymbols: string[]; timestamp?: string }>): Promise<any> {
    const { vtsSymbols, timestamp } = job.data;

    try {
      this.logger.log(`Processing batch VPMX computation for ${vtsSymbols.length} symbols`);

      const results = [];

      // Process symbols in parallel with concurrency limit
      const batchSize = 5;
      for (let i = 0; i < vtsSymbols.length; i += batchSize) {
        const batch = vtsSymbols.slice(i, i + batchSize);

        const batchPromises = batch.map(symbol =>
          this.vpmxCoreService.computeVPMX(symbol, timestamp ? new Date(timestamp) : undefined)
            .then(result => ({ symbol, success: true, result }))
            .catch(error => ({ symbol, success: false, error: error.message }))
        );

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              symbol: 'unknown',
              success: false,
              error: result.reason.message,
            });
          }
        });

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      // Save successful results
      for (const { result } of successful) {
        await this.saveVPMXIndex(result);
        await this.saveVPMXHistory(result);
      }

      this.logger.log(`Batch computation completed: ${successful.length} successful, ${failed.length} failed`);

      return {
        success: true,
        totalProcessed: vtsSymbols.length,
        successful: successful.length,
        failed: failed.length,
        results,
        errors: failed.map(f => ({ symbol: f.symbol, error: f.error })),
      };
    } catch (error) {
      this.logger.error('Batch VPMX computation failed', error);
      throw error;
    }
  }

  @Process('recompute-all')
  async handleRecomputeAll(job: Job<{ force?: boolean }>): Promise<any> {
    const { force = false } = job.data;

    try {
      this.logger.log('Processing recompute all active symbols');

      // Get all active symbols from database
      const activeSymbols = await this.getActiveSymbols();

      if (activeSymbols.length === 0) {
        this.logger.log('No active symbols found for recomputation');
        return { success: true, message: 'No active symbols found' };
      }

      // Queue individual computations
      const results = [];
      for (const symbol of activeSymbols) {
        try {
          const result = await this.vpmxCoreService.computeVPMX(symbol);
          await this.saveVPMXIndex(result);
          await this.saveVPMXHistory(result);
          results.push({ symbol, success: true, value: result.value });
        } catch (error) {
          this.logger.warn(`Failed to recompute ${symbol}`, error);
          results.push({ symbol, success: false, error: error.message });
        }
      }

      const successful = results.filter(r => r.success);
      this.logger.log(`Recomputed ${successful.length} out of ${activeSymbols.length} symbols`);

      return {
        success: true,
        totalSymbols: activeSymbols.length,
        successful: successful.length,
        failed: activeSymbols.length - successful.length,
        results,
      };
    } catch (error) {
      this.logger.error('Recompute all failed', error);
      throw error;
    }
  }

  @Process('cleanup-old-data')
  async handleCleanupOldData(job: Job<{ daysToKeep?: number }>): Promise<any> {
    const { daysToKeep = 30 } = job.data;

    try {
      this.logger.log(`Cleaning up VPMX data older than ${daysToKeep} days`);

      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      // Clean up old VPMX history
      const deletedHistory = await this.prisma.vpmxHistory.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
        },
      });

      // Clean up old predictions
      const deletedPredictions = await this.prisma.vpmxPrediction.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          status: { in: ['EXPIRED', 'SETTLED'] },
        },
      });

      // Clean up old anomalies
      const deletedAnomalies = await this.prisma.vpmxAnomaly.deleteMany({
        where: {
          detectedAt: { lt: cutoffDate },
          status: 'RESOLVED',
        },
      });

      // Clean up old audit logs
      const deletedAudits = await this.prisma.vpmxAudit.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
        },
      });

      this.logger.log(
        `Cleanup completed: ${deletedHistory.count} history, ${deletedPredictions.count} predictions, ` +
        `${deletedAnomalies.count} anomalies, ${deletedAudits.count} audit records`
      );

      return {
        success: true,
        deletedRecords: {
          history: deletedHistory.count,
          predictions: deletedPredictions.count,
          anomalies: deletedAnomalies.count,
          audits: deletedAudits.count,
        },
        cutoffDate,
      };
    } catch (error) {
      this.logger.error('Data cleanup failed', error);
      throw error;
    }
  }

  // Private helper methods

  private async getRecentComputation(vtsSymbol: string): Promise<any> {
    return await this.prisma.vpmxIndex.findFirst({
      where: { vtsSymbol },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        vtsSymbol: true,
        value: true,
        timestamp: true,
        metadata: true,
      },
    });
  }

  private isComputationFresh(timestamp: Date): boolean {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(timestamp) > fiveMinutesAgo;
  }

  private async saveVPMXIndex(vpmxResult: any): Promise<void> {
    await this.prisma.vpmxIndex.upsert({
      where: {
        vtsSymbol_timestamp: {
          vtsSymbol: vpmxResult.vtsSymbol,
          timestamp: vpmxResult.metadata.timestamp || new Date(),
        },
      },
      update: {
        value: vpmxResult.value,
        components: vpmxResult.components,
        metadata: vpmxResult.metadata,
        processedAt: new Date(),
      },
      create: {
        vtsSymbol: vpmxResult.vtsSymbol,
        value: vpmxResult.value,
        components: vpmxResult.components,
        metadata: vpmxResult.metadata,
        timestamp: vpmxResult.metadata.timestamp || new Date(),
        processedAt: new Date(),
      },
    });
  }

  private async saveVPMXHistory(vpmxResult: any): Promise<void> {
    const timestamp = vpmxResult.metadata.timestamp || new Date();

    // Get previous value for change calculations
    const previousEntry = await this.prisma.vpmxHistory.findFirst({
      where: { vtsSymbol: vpmxResult.vtsSymbol },
      orderBy: { timestamp: 'desc' },
    });

    const change1h = previousEntry ? this.calculateChange(previousEntry.value, vpmxResult.value, previousEntry.timestamp, timestamp) : null;

    await this.prisma.vpmxHistory.create({
      data: {
        vtsSymbol: vpmxResult.vtsSymbol,
        value: vpmxResult.value,
        open: vpmxResult.value, // For intraday, open = current
        high: vpmxResult.value,
        low: vpmxResult.value,
        close: vpmxResult.value,
        volume: Math.floor(Math.random() * 10000), // Mock volume
        change1h,
        components: vpmxResult.components,
        metadata: vpmxResult.metadata,
        timestamp,
      },
    });
  }

  private calculateChange(previousValue: number, currentValue: number, previousTime: Date, currentTime: Date): number {
    const hoursDiff = (currentTime.getTime() - previousTime.getTime()) / (1000 * 60 * 60);
    if (hoursDiff === 0) return 0;

    const changePerHour = (currentValue - previousValue) / hoursDiff;
    return changePerHour;
  }

  private async detectBreakouts(vpmxResult: any): Promise<void> {
    try {
      // Get recent history to detect breakouts
      const recentHistory = await this.prisma.vpmxHistory.findMany({
        where: {
          vtsSymbol: vpmxResult.vtsSymbol,
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });

      if (recentHistory.length < 10) return;

      const values = recentHistory.map(h => h.value);
      const currentValue = vpmxResult.value;
      const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avgValue, 2), 0) / values.length);

      // Detect if current value is a significant breakout (> 2 standard deviations)
      const zScore = (currentValue - avgValue) / stdDev;
      if (Math.abs(zScore) > 2) {
        await this.prisma.vpmxBreakoutEvent.create({
          data: {
            vtsSymbol: vpmxResult.vtsSymbol,
            breakoutType: zScore > 0 ? 'MOMENTUM' : 'DIP',
            strength: Math.min(1, Math.abs(zScore) / 3),
            breakoutValue: currentValue,
            currentPeak: currentValue,
            predictedPeak: currentValue * (zScore > 0 ? 1.2 : 0.8),
            status: 'PENDING',
            metadata: {
              zScore,
              avgValue,
              stdDev,
              breakoutProbability: vpmxResult.metadata.breakoutProbability,
            },
          },
        });

        this.logger.log(`Breakout detected for ${vpmxResult.vtsSymbol}: ${zScore.toFixed(2)} sigma`);
      }
    } catch (error) {
      this.logger.warn(`Failed to detect breakouts for ${vpmxResult.vtsSymbol}`, error);
    }
  }

  private async updateAnalytics(vtsSymbol: string, vpmxResult: any): Promise<void> {
    try {
      // Update regional indices
      await this.updateRegionalIndex(vtsSymbol, vpmxResult);

      // Check for anomalies
      await this.vpmxAnalyticsService.detectAnomalousPatterns(vtsSymbol, '1h');

      // Cache current value for quick retrieval
      await this.cacheCurrentValue(vtsSymbol, vpmxResult);
    } catch (error) {
      this.logger.warn(`Failed to update analytics for ${vtsSymbol}`, error);
    }
  }

  private async updateRegionalIndex(vtsSymbol: string, vpmxResult: any): Promise<void> {
    const region = this.extractRegionFromVTS(vtsSymbol);

    await this.prisma.vpmxRegionIndex.upsert({
      where: {
        vtsSymbol_region_timestamp: {
          vtsSymbol,
          region,
          timestamp: vpmxResult.metadata.timestamp || new Date(),
        },
      },
      update: {
        value: vpmxResult.value,
        components: vpmxResult.components,
        contribution: this.calculateRegionalContribution(vpmxResult.value, region),
        confidence: vpmxResult.metadata.confidence,
        sampleSize: 1000, // Mock sample size
      },
      create: {
        vtsSymbol,
        region,
        value: vpmxResult.value,
        components: vpmxResult.components,
        contribution: this.calculateRegionalContribution(vpmxResult.value, region),
        confidence: vpmxResult.metadata.confidence,
        sampleSize: 1000,
        timestamp: vpmxResult.metadata.timestamp || new Date(),
      },
    });
  }

  private extractRegionFromVTS(vtsSymbol: string): string {
    const parts = vtsSymbol.split(':');
    return parts.length > 1 ? parts[1] : 'GLOBAL';
  }

  private calculateRegionalContribution(value: number, region: string): number {
    const regionalWeights: Record<string, number> = {
      'US': 1.0,
      'GLOBAL': 0.9,
      'EU': 0.8,
      'UK': 0.7,
      'ZA': 0.6,
      'NG': 0.5,
      'ASIA': 0.8,
    };

    return (value / 1000) * (regionalWeights[region] || 0.5);
  }

  private async cacheCurrentValue(vtsSymbol: string, vpmxResult: any): Promise<void> {
    // This would use Redis or similar caching mechanism
    // For now, it's a placeholder
    this.logger.debug(`Cached current value for ${vtsSymbol}: ${vpmxResult.value}`);
  }

  private async logComputationFailure(vtsSymbol: string, error: any): Promise<void> {
    try {
      await this.prisma.vpmxAudit.create({
        data: {
          action: 'COMPUTE',
          entityType: 'VPMX_INDEX',
          entityId: vtsSymbol,
          status: 'ERROR',
          errorMessage: error.message,
          duration: 0, // Would be calculated
          timestamp: new Date(),
        },
      });
    } catch (auditError) {
      this.logger.error('Failed to log computation failure', auditError);
    }
  }

  private async getActiveSymbols(): Promise<string[]> {
    const activeIndices = await this.prisma.vpmxIndex.findMany({
      where: {
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Active in last 7 days
      },
      select: { vtsSymbol: true },
      distinct: ['vtsSymbol'],
    });

    return activeIndices.map(index => index.vtsSymbol);
  }
}