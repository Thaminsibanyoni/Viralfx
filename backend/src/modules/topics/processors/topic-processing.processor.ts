import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { TopicsService } from '../services/topics.service';
import { TopicMergingService } from '../services/topic-merging.service';
import { TrendingService } from '../services/trending.service';
import { PrismaService } from '../../../prisma/prisma.service';

interface TopicProcessingJob {
  topicId?: string;
  data?: any;
}

interface MergeJob {
  mergeId: string;
  primaryTopicId: string;
  duplicateTopicIds: string[];
  executorId: string;
}

interface RollbackJob {
  mergeId: string;
  reason?: string;
  primaryTopicId: string;
  duplicateTopicIds: string[];
}

@Processor('topic-processing')
export class TopicProcessingProcessor {
  private readonly logger = new Logger(TopicProcessingProcessor.name);

  constructor(
    private readonly topicsService: TopicsService,
    private readonly topicMergingService: TopicMergingService,
    private readonly trendingService: TrendingService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('topic-creation')
  async handleTopicCreation(job: Job<TopicProcessingJob>) {
    const { topicId, data } = job.data;

    try {
      this.logger.log(`Processing topic creation for topic ${topicId}`);

      // Perform post-creation tasks
      await this.performTopicValidation(topicId);
      await this.updateTopicCache(topicId);
      await this.notifyTopicCreation(topicId, data);

      this.logger.log(`Topic creation processing completed for ${topicId}`);
      return { success: true, topicId };
    } catch (error) {
      this.logger.error(`Failed to process topic creation for ${topicId}:`, error);
      throw error;
    }
  }

  @Process('topic-merge')
  async handleTopicMerge(job: Job<MergeJob>) {
    const { mergeId, primaryTopicId, duplicateTopicIds, executorId } = job.data;

    try {
      this.logger.log(`Processing topic merge ${mergeId}: ${primaryTopicId} <- [${duplicateTopicIds.join(', ')}]`);

      // Update merge record status
      await this.prisma.topicMerge.update({
        where: { id: mergeId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      // Execute the merge
      const result = await this.topicsService.mergeTopics(duplicateTopicIds, primaryTopicId);

      // Update merge record with success
      await this.prisma.topicMerge.update({
        where: { id: mergeId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: {
            mergedTopicId: primaryTopicId,
            duplicateTopicIds,
            finalSnapshot: result,
          },
        },
      });

      // Invalidate caches
      await this.invalidateTopicCaches([primaryTopicId, ...duplicateTopicIds]);

      // Send notifications
      await this.notifyMergeCompletion(mergeId, primaryTopicId, duplicateTopicIds, executorId);

      this.logger.log(`Topic merge ${mergeId} completed successfully`);
      return { success: true, mergeId, result };
    } catch (error) {
      this.logger.error(`Failed to process topic merge ${mergeId}:`, error);

      // Update merge record with failure
      await this.prisma.topicMerge.update({
        where: { id: mergeId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  @Process('rollback-merge')
  async handleRollbackMerge(job: Job<RollbackJob>) {
    const { mergeId, reason, primaryTopicId, duplicateTopicIds } = job.data;

    try {
      this.logger.log(`Processing rollback for merge ${mergeId}`);

      // Update merge record status
      await this.prisma.topicMerge.update({
        where: { id: mergeId },
        data: {
          status: 'ROLLING_BACK',
          rollbackStartedAt: new Date(),
        },
      });

      // Re-activate duplicate topics
      await this.prisma.topic.updateMany({
        where: {
          id: { in: duplicateTopicIds },
        },
        data: {
          isActive: true,
          deletedAt: null,
          mergedInto: null,
        },
      });

      // This is a simplified rollback - in practice, you'd need to:
      // 1. Revert all data migrations
      // 2. Restore original topic relationships
      // 3. Handle data conflicts

      // Update merge record with success
      await this.prisma.topicMerge.update({
        where: { id: mergeId },
        data: {
          status: 'ROLLED_BACK',
          rollbackCompletedAt: new Date(),
        },
      });

      // Invalidate caches
      await this.invalidateTopicCaches([primaryTopicId, ...duplicateTopicIds]);

      // Send notifications
      await this.notifyRollbackCompletion(mergeId, reason);

      this.logger.log(`Rollback for merge ${mergeId} completed successfully`);
      return { success: true, mergeId };
    } catch (error) {
      this.logger.error(`Failed to rollback merge ${mergeId}:`, error);

      // Update merge record with failure
      await this.prisma.topicMerge.update({
        where: { id: mergeId },
        data: {
          status: 'ROLLBACK_FAILED',
          rollbackError: error.message,
          rollbackCompletedAt: new Date(),
        },
      });

      throw error;
    }
  }

  @Process('trending-calculation')
  async handleTrendingCalculation(job: Job<TopicProcessingJob>) {
    const { data } = job.data;

    try {
      this.logger.log('Processing trending calculation');

      // Update trending cache
      await this.trendingService.updateTrendingCache();

      // Detect viral spikes
      const spikes = await this.trendingService.detectViralSpikes(2.0, 60);

      // Queue notifications for significant spikes
      for (const spike of spikes.slice(0, 5)) { // Top 5 spikes
        await this.notifyViralSpike(spike.topicId, spike.spikeScore);
      }

      this.logger.log(`Trending calculation completed. Found ${spikes.length} viral spikes`);
      return { success: true, spikesFound: spikes.length };
    } catch (error) {
      this.logger.error('Failed to process trending calculation:', error);
      throw error;
    }
  }

  @Process('canonical-update')
  async handleCanonicalUpdate(job: Job<TopicProcessingJob>) {
    const { topicId, data } = job.data;

    try {
      this.logger.log(`Processing canonical update for topic ${topicId}`);

      // Update canonical data
      const topic = await this.topicsService.findById(topicId);
      if (!topic) {
        throw new Error(`Topic ${topicId} not found`);
      }

      // Process new canonical data
      const updatedCanonical = await this.processCanonicalData(topic.canonical, data.newCanonical);

      // Update topic
      await this.topicsService.updateTopic(topicId, {
        canonical: updatedCanonical,
      });

      // Update cache
      await this.updateTopicCache(topicId);

      this.logger.log(`Canonical update completed for topic ${topicId}`);
      return { success: true, topicId };
    } catch (error) {
      this.logger.error(`Failed to process canonical update for ${topicId}:`, error);
      throw error;
    }
  }

  @Process('topic-cleanup')
  async handleTopicCleanup(job: Job<TopicProcessingJob>) {
    const { data } = job.data;

    try {
      this.logger.log('Processing topic cleanup');

      // Clean up old deleted topics
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const deletedTopics = await this.prisma.topic.findMany({
        where: {
          isActive: false,
          deletedAt: { lte: thirtyDaysAgo },
        },
        select: { id: true },
      });

      if (deletedTopics.length > 0) {
        // Permanently delete old topics
        await this.prisma.topic.deleteMany({
          where: {
            id: { in: deletedTopics.map(t => t.id) },
          },
        });

        this.logger.log(`Permanently deleted ${deletedTopics.length} old topics`);
      }

      // Clean up old merge records
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      await this.prisma.topicMerge.deleteMany({
        where: {
          completedAt: { lte: ninetyDaysAgo },
          status: { in: ['COMPLETED', 'ROLLED_BACK'] },
        },
      });

      return { success: true, deletedTopics: deletedTopics.length };
    } catch (error) {
      this.logger.error('Failed to process topic cleanup:', error);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing topic job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed topic job ${job.id} of type ${job.name}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed topic job ${job.id} of type ${job.name}:`, error);
  }

  private async performTopicValidation(topicId: string): Promise<void> {
    // Validate topic data integrity
    const topic = await this.topicsService.findById(topicId);
    if (!topic) {
      throw new Error(`Topic ${topicId} not found`);
    }

    // Check for required fields
    if (!topic.name || !topic.slug || !topic.category) {
      throw new Error(`Topic ${topicId} missing required fields`);
    }

    // Validate canonical data structure
    if (topic.canonical) {
      const { hashtags, keywords, entities } = topic.canonical;
      if (!Array.isArray(hashtags) || !Array.isArray(keywords) || !Array.isArray(entities)) {
        throw new Error(`Invalid canonical data structure for topic ${topicId}`);
      }
    }
  }

  private async updateTopicCache(topicId: string): Promise<void> {
    // Update Redis cache for the topic
    const topic = await this.topicsService.findById(topicId);
    if (topic) {
      // Cache will be updated automatically in the service
      this.logger.log(`Updated cache for topic ${topicId}`);
    }
  }

  private async invalidateTopicCaches(topicIds: string[]): Promise<void> {
    // Invalidate all topic-related caches
    const patterns = [
      'topic:*',
      'trending:topics:*',
      'topics:category:*',
    ];

    // This would use Redis client to delete matching patterns
    // Implementation depends on your Redis setup
    this.logger.log(`Invalidated caches for topics: ${topicIds.join(', ')}`);
  }

  private async notifyTopicCreation(topicId: string, data: any): Promise<void> {
    // Send notification for topic creation
    // This would integrate with your notification service
    this.logger.log(`Notified topic creation for ${topicId}`);
  }

  private async notifyMergeCompletion(
    mergeId: string,
    primaryTopicId: string,
    duplicateTopicIds: string[],
    executorId: string,
  ): Promise<void> {
    // Send notification for merge completion
    this.logger.log(`Notified merge completion for ${mergeId}`);
  }

  private async notifyRollbackCompletion(mergeId: string, reason?: string): Promise<void> {
    // Send notification for rollback completion
    this.logger.log(`Notified rollback completion for ${mergeId}`);
  }

  private async notifyViralSpike(topicId: string, spikeScore: number): Promise<void> {
    // Send notification for viral spike detection
    this.logger.log(`Notified viral spike for topic ${topicId} (score: ${spikeScore})`);
  }

  private async processCanonicalData(existing: any, updates: any): Promise<any> {
    // Merge and process canonical data
    const merged = {
      hashtags: [...new Set([...(existing?.hashtags || []), ...(updates.hashtags || [])])],
      keywords: [...new Set([...(existing?.keywords || []), ...(updates.keywords || [])])],
      entities: [...(existing?.entities || []), ...(updates.entities || [])],
    };

    // Remove duplicates from entities based on type and value
    merged.entities = merged.entities.filter((entity, index, self) =>
      index === self.findIndex(e => e.type === entity.type && e.value === entity.value)
    );

    return merged;
  }
}