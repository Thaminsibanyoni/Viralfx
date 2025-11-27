import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DeceptionService } from '../services/deception.service';
import { DeceptionAnalysisService } from '../services/deception-analysis.service';
import { PrismaService } from '../../../prisma/prisma.service';

interface DeceptionAnalysisJob {
  type: 'single' | 'batch' | 'process-deception-update' | 'process-high-risk';
  data: {
    content?: string;
    topicId?: string;
    source?: string;
    metadata?: any;
    contents?: Array<{
      content: string;
      topicId: string;
      source?: string;
      metadata?: any;
    }>;
    snapshotId?: string;
    analysis?: any;
  };
}

@Processor('deception-analysis')
export class DeceptionProcessor {
  private readonly logger = new Logger(DeceptionProcessor.name);

  constructor(
    private readonly deceptionService: DeceptionService,
    private readonly analysisService: DeceptionAnalysisService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('analyze-deception')
  async handleDeceptionAnalysis(job: Job<DeceptionAnalysisJob>): Promise<any> {
    const { type, data } = job.data;

    this.logger.log(`Processing deception analysis job ${job.id} of type: ${type}`);

    try {
      switch (type) {
        case 'single':
          return await this.processSingleContent(data);
        case 'batch':
          return await this.processBatchAnalysis(data);
        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process deception analysis job ${job.id}:`, error);
      throw error;
    }
  }

  @Process('process-deception-update')
  async handleDeceptionUpdate(job: Job): Promise<void> {
    const { topicId, snapshotId, analysis } = job.data;

    this.logger.log(`Processing deception update for topic ${topicId}, snapshot ${snapshotId}`);

    try {
      // Invalidate cache for this topic
      await this.invalidateDeceptionCache(topicId);

      // If high risk, trigger additional analysis
      if (analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'CRITICAL') {
        await this.performAdditionalHighRiskAnalysis(topicId, snapshotId, analysis);
      }

      // Update topic-level deception metrics
      await this.updateTopicDeceptionMetrics(topicId);

      this.logger.log(`Deception update completed for topic ${topicId}`);
    } catch (error) {
      this.logger.error(`Failed to process deception update for topic ${topicId}:`, error);
      throw error;
    }
  }

  @Process('process-high-risk')
  async handleHighRiskContent(job: Job): Promise<void> {
    const { snapshotId, topicId, analysis, content } = job.data;

    this.logger.log(`Processing high-risk content for snapshot ${snapshotId}`);

    try {
      // Perform additional analysis on high-risk content
      const advancedAnalysis = await this.analysisService.performAdvancedAnalysis(content);

      // Cross-reference with fact-checking sources if available
      if (analysis.flaggedPhrases && analysis.flaggedPhrases.length > 0) {
        const claim = content.substring(0, 200); // Use first 200 chars as claim
        const factCheck = await this.analysisService.crossReferenceSources(claim);

        // Update snapshot with advanced analysis
        await this.prisma.deceptionSnapshot.update({
          where: { id: snapshotId },
          data: {
            analysisDetails: {
              ...analysis,
              advancedAnalysis,
              factCheck,
              reviewedAt: new Date(),
              priorityLevel: 'HIGH',
            },
          },
        });
      }

      // Send notifications to moderators
      await this.notifyModerators(topicId, snapshotId, analysis);

      this.logger.log(`High-risk content processing completed for snapshot ${snapshotId}`);
    } catch (error) {
      this.logger.error(`Failed to process high-risk content for snapshot ${snapshotId}:`, error);
      throw error;
    }
  }

  @Process('cleanup-old-data')
  async handleDataCleanup(job: Job): Promise<void> {
    const { olderThanDays = 90 } = job.data;

    this.logger.log(`Starting deception data cleanup for data older than ${olderThanDays} days`);

    try {
      await this.deceptionService.cleanupOldData(olderThanDays);
      this.logger.log('Deception data cleanup completed successfully');
    } catch (error) {
      this.logger.error(`Failed to cleanup deception data:`, error);
      throw error;
    }
  }

  private async processSingleContent(data: any): Promise<any> {
    const { content, topicId, source, metadata } = data;

    // Perform analysis
    const analysis = await this.deceptionService.analyzeDeception(content, topicId, source, metadata);

    return {
      topicId,
      analysis,
      timestamp: new Date(),
    };
  }

  private async processBatchAnalysis(data: any): Promise<any[]> {
    const { contents } = data;
    const results: any[] = [];

    for (const contentItem of contents) {
      try {
        const result = await this.processSingleContent(contentItem);
        results.push(result);
      } catch (error) {
        this.logger.warn(`Failed to analyze content for topic ${contentItem.topicId}:`, error);
        results.push({
          topicId: contentItem.topicId,
          error: error.message,
        });
      }
    }

    this.logger.log(`Batch deception analysis completed: ${results.length} items processed`);
    return results;
  }

  private async performAdditionalHighRiskAnalysis(
    topicId: string,
    snapshotId: string,
    analysis: any,
  ): Promise<void> {
    try {
      // Get topic content for additional analysis
      const topic = await this.prisma.topic.findUnique({
        where: { id: topicId },
        select: { content: true },
      });

      if (topic?.content) {
        // Analyze for coordinated inauthentic behavior
        const socialAnalysis = await this.analysisService.analyzeSocialMediaAmplification(topic.content);

        // Update snapshot with additional analysis
        await this.prisma.deceptionSnapshot.update({
          where: { id: snapshotId },
          data: {
            analysisDetails: {
              ...analysis,
              socialAnalysis,
              additionalAnalysisAt: new Date(),
            },
          },
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to perform additional high-risk analysis for topic ${topicId}:`, error);
    }
  }

  private async updateTopicDeceptionMetrics(topicId: string): Promise<void> {
    try {
      // Calculate topic-level deception metrics
      const recentSnapshots = await this.prisma.deceptionSnapshot.findMany({
        where: {
          topicId,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      if (recentSnapshots.length === 0) {
        return;
      }

      const avgDeceptionScore = recentSnapshots.reduce((sum, s) => sum + s.deceptionScore, 0) / recentSnapshots.length;
      const highRiskCount = recentSnapshots.filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL').length;

      // Update topic with deception metrics
      await this.prisma.topic.update({
        where: { id: topicId },
        data: {
          deceptionScore: avgDeceptionScore,
          highRiskCount,
          lastDeceptionAnalysis: new Date(),
        },
      });

      this.logger.debug(`Updated deception metrics for topic ${topicId}: ${avgDeceptionScore.toFixed(3)}`);
    } catch (error) {
      this.logger.warn(`Failed to update deception metrics for topic ${topicId}:`, error);
    }
  }

  private async notifyModerators(topicId: string, snapshotId: string, analysis: any): Promise<void> {
    try {
      // In a real implementation, this would send notifications via WebSocket, email, etc.
      this.logger.warn(`High-risk content detected - Topic: ${topicId}, Snapshot: ${snapshotId}, Risk: ${analysis.riskLevel}`);

      // Store notification for moderators
      await this.prisma.notification.create({
        data: {
          type: 'HIGH_RISK_CONTENT',
          title: 'High-Risk Content Detected',
          message: `Deception analysis flagged content with risk level: ${analysis.riskLevel}`,
          metadata: {
            topicId,
            snapshotId,
            riskLevel: analysis.riskLevel,
            deceptionScore: analysis.deceptionScore,
          },
          priority: 'HIGH',
          createdAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to notify moderators for high-risk content:`, error);
    }
  }

  private async invalidateDeceptionCache(topicId: string): Promise<void> {
    const cacheKeys = [
      `deception:${topicId}:latest`,
      `deception:${topicId}:history`,
    ];

    // In a real implementation, this would clear Redis cache
    for (const key of cacheKeys) {
      // await this.redis.del(key);
    }
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`Deception analysis job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Deception analysis job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Deception analysis job ${job.id} failed:`, error.message);
  }
}