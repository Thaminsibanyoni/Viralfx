import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SentimentService } from '../services/sentiment.service';
import { SentimentAggregationService } from '../services/sentiment-aggregation.service';
import { PrismaService } from '../../../prisma/prisma.service';

interface SentimentAnalysisJob {
  type: 'single' | 'batch' | 'aggregate';
  data: {
    content?: string;
    topicId?: string;
    topicIds?: string[];
    source?: string;
    metadata?: any;
    forceRefresh?: boolean;
  };
}

interface SentimentResult {
  score: number;
  confidence: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  metadata?: any;
}

@Processor('sentiment-analysis')
export class SentimentAnalysisProcessor {
  private readonly logger = new Logger(SentimentAnalysisProcessor.name);

  constructor(
    private readonly sentimentService: SentimentService,
    private readonly aggregationService: SentimentAggregationService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('analyze-content')
  async handleSentimentAnalysis(job: Job<SentimentAnalysisJob>): Promise<SentimentResult | SentimentResult[]> {
    const { type, data } = job.data;

    this.logger.log(`Processing sentiment analysis job ${job.id} of type: ${type}`);

    try {
      switch (type) {
        case 'single':
          return await this.processSingleContent(data);
        case 'batch':
          return await this.processBatchAnalysis(data);
        case 'aggregate':
          return await this.processAggregationUpdate(data);
        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process sentiment analysis job ${job.id}:`, error);
      throw error;
    }
  }

  @Process('update-aggregations')
  async handleAggregationUpdate(job: Job): Promise<void> {
    this.logger.log(`Updating sentiment aggregations for job ${job.id}`);

    try {
      // Get all topics with recent sentiment activity
      const activeTopics = await this.prisma.sentimentEntry.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: {
          topicId: true,
        },
        distinct: ['topicId'],
      });

      if (activeTopics.length === 0) {
        this.logger.log('No topics with recent sentiment activity found');
        return;
      }

      const topicIds = activeTopics.map(t => t.topicId);
      this.logger.log(`Updating aggregations for ${topicIds.length} topics`);

      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < topicIds.length; i += batchSize) {
        const batch = topicIds.slice(i, i + batchSize);

        try {
          await this.aggregationService.batchAggregateTopics(batch);
          this.logger.debug(`Updated aggregations for batch ${Math.floor(i / batchSize) + 1}`);
        } catch (batchError) {
          this.logger.error(`Failed to update aggregations for batch ${Math.floor(i / batchSize) + 1}:`, batchError);
        }
      }

      this.logger.log('Aggregation update completed successfully');
    } catch (error) {
      this.logger.error(`Failed to update aggregations for job ${job.id}:`, error);
      throw error;
    }
  }

  @Process('cleanup-old-data')
  async handleDataCleanup(job: Job): Promise<void> {
    const { olderThanDays = 30, keepAggregated = true } = job.data;

    this.logger.log(`Starting sentiment data cleanup for data older than ${olderThanDays} days`);

    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      // Delete old sentiment entries
      const deletedEntries = await this.prisma.sentimentEntry.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Deleted ${deletedEntries.count} old sentiment entries`);

      if (!keepAggregated) {
        // Delete old aggregated data (except recent 24h)
        await this.aggregationService.cleanupOldAggregations();
      }

      this.logger.log('Data cleanup completed successfully');
    } catch (error) {
      this.logger.error(`Failed to cleanup sentiment data for job ${job.id}:`, error);
      throw error;
    }
  }

  private async processSingleContent(data: any): Promise<SentimentResult> {
    const { content, topicId, source, metadata } = data;

    // Analyze sentiment using external service or ML model
    const analysisResult = await this.performSentimentAnalysis(content);

    // Save to database
    if (topicId) {
      await this.prisma.sentimentEntry.create({
        data: {
          topicId,
          score: analysisResult.score,
          confidence: analysisResult.confidence,
          source: source || 'manual',
          content: content.substring(0, 1000), // Store truncated content
          metadata: metadata || {},
          timestamp: new Date(),
        },
      });

      // Invalidate cache for this topic
      await this.invalidateSentimentCache(topicId);

      this.logger.log(`Saved sentiment analysis for topic ${topicId}: ${analysisResult.score.toFixed(3)}`);
    }

    return analysisResult;
  }

  private async processBatchAnalysis(data: any): Promise<SentimentResult[]> {
    const { topicIds, forceRefresh = false } = data;
    const results: SentimentResult[] = [];

    for (const topicId of topicIds) {
      try {
        // Get recent content for this topic
        const recentContent = await this.getRecentContentForTopic(topicId, forceRefresh);

        if (recentContent.length === 0) {
          continue;
        }

        // Analyze each piece of content
        for (const content of recentContent) {
          try {
            const analysisResult = await this.performSentimentAnalysis(content.text);

            await this.prisma.sentimentEntry.create({
              data: {
                topicId,
                score: analysisResult.score,
                confidence: analysisResult.confidence,
                source: content.source || 'batch',
                content: content.text.substring(0, 1000),
                metadata: content.metadata || {},
                timestamp: new Date(content.timestamp || Date.now()),
              },
            });

            results.push(analysisResult);
          } catch (analysisError) {
            this.logger.warn(`Failed to analyze content for topic ${topicId}:`, analysisError);
          }
        }

        // Invalidate cache for this topic
        await this.invalidateSentimentCache(topicId);

        this.logger.log(`Processed batch analysis for topic ${topicId}: ${results.length} entries`);
      } catch (topicError) {
        this.logger.error(`Failed to process topic ${topicId}:`, topicError);
      }
    }

    return results;
  }

  private async processAggregationUpdate(data: any): Promise<void> {
    const { topicId } = data;

    if (topicId) {
      await this.aggregationService.aggregateSentiment(topicId);
      this.logger.log(`Updated aggregation for topic ${topicId}`);
    } else {
      // Update all active topics
      await this.handleAggregationUpdate({ data: {}, id: 'aggregation-update' } as Job);
    }
  }

  private async performSentimentAnalysis(content: string): Promise<SentimentResult> {
    // This is a placeholder for actual sentiment analysis
    // In a real implementation, this would call an external API or ML model

    // Simple rule-based sentiment analysis for demonstration
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'disgusting', 'poor'];

    const words = content.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;

    let score = 0;
    if (positiveCount > negativeCount) {
      score = Math.min(0.9, 0.3 + (positiveCount - negativeCount) / words.length);
    } else if (negativeCount > positiveCount) {
      score = Math.max(-0.9, -0.3 - (negativeCount - positiveCount) / words.length);
    } else {
      score = (Math.random() - 0.5) * 0.2; // Small random for neutral
    }

    // Add some randomness to simulate model confidence variation
    const confidence = 0.6 + Math.random() * 0.35;

    let sentiment: 'positive' | 'negative' | 'neutral';
    if (score > 0.1) {
      sentiment = 'positive';
    } else if (score < -0.1) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    return {
      score,
      confidence,
      sentiment,
      metadata: {
        wordCount: words.length,
        positiveWords: positiveCount,
        negativeWords: negativeCount,
      },
    };
  }

  private async getRecentContentForTopic(topicId: string, forceRefresh: boolean = false): Promise<Array<{
    text: string;
    source: string;
    timestamp: number;
    metadata?: any;
  }>> {
    // This would fetch recent content related to the topic
    // For now, return empty array to be implemented with actual content sources
    return [];
  }

  private async invalidateSentimentCache(topicId: string): Promise<void> {
    const cacheKeys = [
      `sentiment:aggregated:${topicId}:24h`,
      `sentiment:aggregated:${topicId}:1h`,
      `sentiment:aggregated:${topicId}:7d`,
      `sentiment:history:${topicId}:hour:24`,
      `sentiment:history:${topicId}:day:7`,
      `sentiment:history:${topicId}:week:4`,
    ];

    await Promise.all(
      cacheKeys.map(key => this.prisma.$executeRaw`SELECT redis_del(${key})`)
    );
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`Sentiment analysis job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Sentiment analysis job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Sentiment analysis job ${job.id} failed:`, error.message);
  }
}