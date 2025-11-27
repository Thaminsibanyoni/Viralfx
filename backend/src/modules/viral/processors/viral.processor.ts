import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ViralService } from '../services/viral.service';
import { ViralIndexService } from '../services/viral-index.service';
import { ViralMetricsService } from '../services/viral-metrics.service';
import { PrismaService } from '../../../prisma/prisma.service';

interface ViralAnalysisJob {
  type: 'analyze-virality' | 'update-viral-index' | 'viral-metrics-update' | 'batch-calculation';
  data: {
    content?: string;
    contentId?: string;
    topicId?: string;
    source?: string;
    authorId?: string;
    metadata?: any;
    analysis?: any;
    topicIds?: string[];
    timeWindow?: number;
  };
}

@Processor('viral-index-calculation')
export class ViralProcessor {
  private readonly logger = new Logger(ViralProcessor.name);

  constructor(
    private readonly viralService: ViralService,
    private readonly viralIndexService: ViralIndexService,
    private readonly viralMetricsService: ViralMetricsService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('update-viral-index')
  async handleViralIndexUpdate(job: Job<ViralAnalysisJob>): Promise<void> {
    const { topicId, contentId, analysis } = job.data;

    this.logger.log(`Updating viral index for topic ${topicId}, content ${contentId}`);

    try {
      // Update topic's viral metrics
      await this.viralService.updateViralMetrics(topicId);

      // Recalculate viral index for the topic
      const viralIndex = await this.viralIndexService.calculateTopicViralIndex(topicId);

      // Track metrics for analytics
      await this.viralMetricsService.trackMetrics(
        topicId,
        'viral_index_update',
        viralIndex.index,
        {
          contentId,
          confidence: viralIndex.confidence,
          momentum: viralIndex.momentum,
          timestamp: new Date().toISOString(),
        }
      );

      // Invalidate cache for this topic
      await this.invalidateViralCache(topicId);

      // Check for viral breakout
      if (viralIndex.index >= 0.8 && viralIndex.momentum >= 0.6) {
        await this.handleViralBreakout(topicId, viralIndex);
      }

      this.logger.log(`Viral index updated for topic ${topicId}: ${viralIndex.index.toFixed(3)}`);
    } catch (error) {
      this.logger.error(`Failed to update viral index for topic ${topicId}:`, error);
      throw error;
    }
  }

  @Process('batch-calculation')
  async handleBatchCalculation(job: Job<ViralAnalysisJob>): Promise<void> {
    const { topicIds, timeWindow = 24 } = job.data;

    this.logger.log(`Starting batch viral index calculation for ${topicIds.length} topics`);

    try {
      const results = [];

      // Process in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < topicIds.length; i += batchSize) {
        const batch = topicIds.slice(i, i + batchSize);

        const batchPromises = batch.map(async (topicId) => {
          try {
            const index = await this.viralIndexService.calculateTopicViralIndex(topicId, timeWindow);
            await this.viralService.updateViralMetrics(topicId);

            return {
              topicId,
              success: true,
              index: index.index,
              momentum: index.momentum,
            };
          } catch (error) {
            this.logger.warn(`Failed to calculate index for topic ${topicId}:`, error.message);
            return {
              topicId,
              success: false,
              error: error.message,
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Small delay between batches
        if (i + batchSize < topicIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.log(`Batch calculation completed: ${successful} successful, ${failed} failed`);
    } catch (error) {
      this.logger.error(`Batch viral index calculation failed:`, error);
      throw error;
    }
  }

  @Process('cleanup-old-data')
  async handleDataCleanup(job: Job): Promise<void> {
    const { olderThanDays = 90 } = job.data;

    this.logger.log(`Starting viral data cleanup for data older than ${olderThanDays} days`);

    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      // Clean up old viral content
      const deletedContent = await this.prisma.viralContent.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          viralScore: {
            lt: 0.8, // Keep high-viral content longer
          },
        },
      });

      // Clean up old viral index history
      const deletedHistory = await this.prisma.viralIndexHistory.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
          index: {
            lt: 0.7, // Keep high-performing history
          },
        },
      });

      // Clean up old metrics events
      const deletedEvents = await this.prisma.metricsEvent.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
          eventType: 'VIRAL_CONTENT_ANALYZED',
        },
      });

      this.logger.log(
        `Viral data cleanup completed: ${deletedContent.count} content, ` +
        `${deletedHistory.count} history, ${deletedEvents.count} events deleted`
      );
    } catch (error) {
      this.logger.error(`Viral data cleanup failed:`, error);
      throw error;
    }
  }

  private async handleViralBreakout(topicId: string, viralIndex: any): Promise<void> {
    this.logger.warn(`VIRAL BREAKOUT DETECTED - Topic: ${topicId}, Index: ${viralIndex.index}, Momentum: ${viralIndex.momentum}`);

    try {
      // Create breakout alert
      await this.prisma.notification.create({
        data: {
          type: 'VIRAL_BREAKOUT',
          title: 'Viral Breakout Detected',
          message: `Topic achieved viral index of ${viralIndex.index.toFixed(3)} with momentum ${viralIndex.momentum.toFixed(3)}`,
          metadata: {
            topicId,
            viralIndex: viralIndex.index,
            momentum: viralIndex.momentum,
            confidence: viralIndex.confidence,
            timestamp: new Date().toISOString(),
          },
          priority: 'HIGH',
          createdAt: new Date(),
        },
      });

      // Store breakout event
      await this.prisma.viralContent.create({
        data: {
          topicId,
          content: 'VIRAL BREAKOUT EVENT',
          source: 'system',
          viralScore: viralIndex.index,
          viralIndex: viralIndex.index,
          momentumScore: viralIndex.momentum,
          engagementScore: 0.8,
          reachScore: 0.9,
          predictedVirality: Math.min(1.0, viralIndex.index + 0.1),
          viralityFactors: {
            emotionalImpact: 0.8,
            socialProof: 0.9,
            noveltyScore: 0.7,
            controversyLevel: 0.6,
            timelinessScore: 0.9,
            platformFit: 0.8,
          },
          metadata: {
            eventType: 'VIRAL_BREAKOUT',
            automaticDetection: true,
            breakoutConfidence: viralIndex.confidence,
          },
          createdAt: new Date(),
        },
      });

      // Invalidate all caches for this topic
      await this.invalidateViralCache(topicId, true);
    } catch (error) {
      this.logger.error(`Failed to handle viral breakout for topic ${topicId}:`, error);
    }
  }

  private async invalidateViralCache(topicId: string, allKeys = false): Promise<void> {
    const cacheKeys = [
      `viral:index:${topicId}`,
      `viral:metrics:topic:${topicId}`,
      `viral:content:${topicId}`,
      `viral:history:${topicId}`,
    ];

    if (allKeys) {
      cacheKeys.push(
        `viral:metrics:*`,
        `viral:trending:*`,
        `viral:breakouts:*`,
      );
    }

    for (const key of cacheKeys) {
      if (!key.includes('*')) {
        await this.prisma.$redis?.del?.(key);
      }
    }
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`Viral processor job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Viral processor job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Viral processor job ${job.id} failed:`, error.message);
  }
}

@Processor('viral-content-analysis')
export class ViralContentAnalysisProcessor {
  private readonly logger = new Logger(ViralContentAnalysisProcessor.name);

  constructor(
    private readonly viralService: ViralService,
    private readonly viralMetricsService: ViralMetricsService,
  ) {}

  @Process('analyze-virality')
  async handleViralityAnalysis(job: Job<ViralAnalysisJob>): Promise<any> {
    const { content, topicId, source, authorId, metadata } = job.data;

    this.logger.log(`Processing virality analysis for content from topic ${topicId}`);

    try {
      const analysis = await this.viralService.analyzeContentVirality(
        content,
        topicId,
        source,
        authorId,
        metadata,
      );

      // Track analysis metrics
      await this.viralMetricsService.trackMetrics(
        topicId,
        'content_analysis',
        analysis.viralIndex,
        {
          contentLength: content.length,
          source,
          authorId,
          processingTime: Date.now() - job.timestamp,
        }
      );

      this.logger.log(`Virality analysis completed for topic ${topicId}: ${analysis.viralIndex.toFixed(3)}`);

      return {
        topicId,
        contentId: content.substring(0, 50), // Use content hash as ID
        analysis,
        processingTime: Date.now() - job.timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to analyze virality for topic ${topicId}:`, error);

      // Track error metrics
      await this.viralMetricsService.trackMetrics(
        topicId,
        'analysis_error',
        0,
        {
          error: error.message,
          contentLength: content?.length || 0,
          source,
        }
      );

      throw error;
    }
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`Viral content analysis job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Viral content analysis job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Viral content analysis job ${job.id} failed:`, error.message);
  }
}