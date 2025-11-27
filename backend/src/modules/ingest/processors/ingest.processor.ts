import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaService } from '../../../prisma/prisma.service';
import { IngestJobData, Content, ContentMetrics } from '../interfaces/ingest.interface';
import { Platform } from '@prisma/client';

@Injectable()
@Processor('ingest:twitter')
export class TwitterIngestProcessor {
  private readonly logger = new Logger(TwitterIngestProcessor.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Process('process')
  async processContent(job: Job<IngestJobData>) {
    return this.processContentJob('TWITTER', job);
  }

  private async processContentJob(platform: Platform, job: Job<IngestJobData>) {
    const startTime = Date.now();
    const { content, retryCount } = job.data;

    try {
      if (!this.validateContent(content)) {
        throw new Error(`Invalid content for platform ${platform}`);
      }

      const existing = await this.prismaService.ingestEvent.findFirst({
        where: {
          platform,
          nativeId: content.nativeId,
        },
      });

      if (existing) {
        this.logger.debug(`Content already exists: ${platform}:${content.nativeId}`);
        return { status: 'duplicate', id: existing.id };
      }

      const ingestEventData = this.transformToIngestEvent(platform, content);

      const ingestEvent = await this.prismaService.ingestEvent.create({
        data: ingestEventData,
      });

      const duration = Date.now() - startTime;
      await this.updateProcessingStats(platform, true, duration);

      this.logger.log(`Successfully processed content: ${platform}:${content.nativeId}`);

      return {
        status: 'success',
        id: ingestEvent.id,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.updateProcessingStats(platform, false, duration);

      this.logger.error(`Failed to process content: ${platform}:${content.nativeId}`, error);

      const maxRetries = this.configService.get<number>('INGEST_RETRY_ATTEMPTS', 3);
      if (retryCount < maxRetries) {
        throw error;
      } else {
        await this.logFailedContent(platform, content, error.message);

        return {
          status: 'failed',
          error: error.message,
          retryCount,
        };
      }
    }
  }

  private validateContent(content: Content): boolean {
    // Basic content validation
    const basicValidation = !!(
      content.platform &&
      content.nativeId &&
      content.authorId &&
      content.timestamp &&
      content.textContent
    );

    if (!basicValidation) return false;

    // Metrics validation to prevent NaN values
    if (content.metrics) {
      const metrics = content.metrics;
      return (
        typeof metrics.likes === 'number' && !isNaN(metrics.likes) && metrics.likes >= 0 &&
        typeof metrics.shares === 'number' && !isNaN(metrics.shares) && metrics.shares >= 0 &&
        typeof metrics.comments === 'number' && !isNaN(metrics.comments) && metrics.comments >= 0 &&
        typeof metrics.views === 'number' && !isNaN(metrics.views) && metrics.views >= 0 &&
        typeof metrics.plays === 'number' && !isNaN(metrics.plays) && metrics.plays >= 0 &&
        typeof metrics.saves === 'number' && !isNaN(metrics.saves) && metrics.saves >= 0 &&
        typeof metrics.clicks === 'number' && !isNaN(metrics.clicks) && metrics.clicks >= 0
      );
    }

    return true;
  }

  private transformToIngestEvent(platform: Platform, content: Content) {
    const engagementCount = this.calculateEngagementCount(content.metrics);
    const contentType = this.determineContentType(content);

    const mediaUrls = content.mediaUrls.map(url => ({
      url: url.url,
      type: url.type,
      thumbnail: url.thumbnail,
      duration: url.duration,
      size: url.size,
    }));

    return {
      platform,
      nativeId: content.nativeId,
      authorId: content.authorId,
      authorHandle: content.authorHandle,
      contentType,
      textContent: content.textContent,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
      likesCount: content.metrics.likes || 0,
      sharesCount: content.metrics.shares || 0,
      commentsCount: content.metrics.comments || 0,
      viewsCount: content.metrics.views || 0,
      engagementCount,
      processed: false,
      processingErrors: null,
      publishedAt: content.timestamp,
      ingestedAt: new Date(),
    };
  }

  private calculateEngagementCount(metrics: ContentMetrics): number {
    const likes = metrics.likes || 0;
    const shares = metrics.shares || 0;
    const comments = metrics.comments || 0;
    const views = metrics.views || 0;

    return (
      likes * 1 +
      shares * 2 +
      comments * 1.5 +
      views * 0.01
    );
  }

  private determineContentType(content: Content): 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'MIXED' {
    if (!content.mediaUrls || content.mediaUrls.length === 0) {
      return 'TEXT';
    }

    const mediaTypes = content.mediaUrls.map(url => url.type);
    const uniqueTypes = new Set(mediaTypes);

    if (uniqueTypes.size > 1) {
      return 'MIXED';
    }

    if (mediaTypes.includes('video')) {
      return 'VIDEO';
    } else if (mediaTypes.includes('image')) {
      return 'IMAGE';
    } else if (mediaTypes.includes('audio')) {
      return 'AUDIO';
    }

    return 'MIXED';
  }

  private async updateProcessingStats(platform: Platform, success: boolean, duration: number): Promise<void> {
    const statsKey = `ingest:processing:stats:${platform}`;

    if (success) {
      await this.redis.hincrby(statsKey, 'processed', 1);
    } else {
      await this.redis.hincrby(statsKey, 'failed', 1);
    }

    const currentAvg = parseFloat((await this.redis.hget(statsKey, 'avgProcessingTime')) || '0');
    const totalProcessed = parseInt((await this.redis.hget(statsKey, 'processed')) || '0');
    const newAvg = ((currentAvg * (totalProcessed - 1)) + duration) / totalProcessed;
    await this.redis.hset(statsKey, 'avgProcessingTime', newAvg.toString());
  }

  private async logFailedContent(platform: Platform, content: Content, error: string): Promise<void> {
    const failedKey = `ingest:failed:${platform}`;
    const failedData = {
      nativeId: content.nativeId,
      authorId: content.authorId,
      error,
      timestamp: new Date().toISOString(),
    };

    await this.redis.lpush(failedKey, JSON.stringify(failedData));
    await this.redis.ltrim(failedKey, 0, 999);
  }
}

@Injectable()
@Processor('ingest:tiktok')
export class TikTokIngestProcessor extends TwitterIngestProcessor {
  protected readonly logger = new Logger(TikTokIngestProcessor.name);
}

@Injectable()
@Processor('ingest:instagram')
export class InstagramIngestProcessor extends TwitterIngestProcessor {
  protected readonly logger = new Logger(InstagramIngestProcessor.name);
}

@Injectable()
@Processor('ingest:youtube')
export class YouTubeIngestProcessor extends TwitterIngestProcessor {
  protected readonly logger = new Logger(YouTubeIngestProcessor.name);
}

@Injectable()
@Processor('ingest:facebook')
export class FacebookIngestProcessor extends TwitterIngestProcessor {
  protected readonly logger = new Logger(FacebookIngestProcessor.name);
}