import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { BaseConnector } from '../connectors/base.connector';
import { TwitterConnector } from '../connectors/twitter.connector';
import { TikTokConnector } from '../connectors/tiktok.connector';
import { InstagramConnector } from '../connectors/instagram.connector';
import { YouTubeConnector } from '../connectors/youtube.connector';
import { FacebookConnector } from '../connectors/facebook.connector';
import { CollectionResult, CollectionStatusResponseDto, Content } from '../interfaces/ingest.interface';
import { Platform } from '@prisma/client';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly connectors: Map<string, BaseConnector>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('ingest:twitter') private readonly twitterQueue: Queue,
    @InjectQueue('ingest:tiktok') private readonly tiktokQueue: Queue,
    @InjectQueue('ingest:instagram') private readonly instagramQueue: Queue,
    @InjectQueue('ingest:youtube') private readonly youtubeQueue: Queue,
    @InjectQueue('ingest:facebook') private readonly facebookQueue: Queue,
    private readonly twitterConnector: TwitterConnector,
    private readonly tiktokConnector: TikTokConnector,
    private readonly instagramConnector: InstagramConnector,
    private readonly youtubeConnector: YouTubeConnector,
    private readonly facebookConnector: FacebookConnector) {
    this.connectors = new Map<string, BaseConnector>([
      ['twitter', this.twitterConnector],
      ['tiktok', this.tiktokConnector],
      ['instagram', this.instagramConnector],
      ['youtube', this.youtubeConnector],
      ['facebook', this.facebookConnector],
    ]);
  }

  async collectFromPlatform(platform: string, options?: any): Promise<CollectionResult> {
    const startTime = Date.now();
    const result: CollectionResult = {
      platform,
      collected: 0,
      processed: 0,
      failed: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    };

    try {
      // Check if platform connector exists
      const connector = this.getConnector(platform);

      // Check if collection is already running
      const isRunning = await this.isCollectionRunning(platform);
      if (isRunning) {
        result.errors.push(`Collection for ${platform} is already running`);
        result.duration = Date.now() - startTime;
        return result;
      }

      // Mark collection as running
      await this.setCollectionRunning(platform, true);

      // Check if platform is enabled
      if (!this.isPlatformEnabled(platform)) {
        throw new Error(`Platform ${platform} is not enabled`);
      }

      // Connect to platform
      await connector.connect();

      // Collect content
      const content = await connector.collectContent(options);

      // Store content in Redis for processing
      for (const item of content) {
        try {
          await this.queueContentForProcessing(platform, item);
          result.collected++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to queue content ${item.nativeId}: ${error.message}`);
        }
      }

      // Update collection statistics
      await this.updateCollectionStats(platform, result);

      this.logger.log(`Successfully collected ${result.collected} items from ${platform}`);

    } catch (error) {
      this.logger.error(`Failed to collect from ${platform}:`, error);
      result.errors.push(error.message);
      result.failed++;
    } finally {
      // Mark collection as completed
      await this.setCollectionRunning(platform, false);
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  async collectFromAllPlatforms(): Promise<CollectionResult[]> {
    const enabledPlatforms = ['twitter', 'tiktok', 'instagram', 'youtube', 'facebook']
      .filter(platform => this.isPlatformEnabled(platform));

    const results: CollectionResult[] = [];

    // Collect from all platforms in parallel
    const promises = enabledPlatforms.map(async (platform) => {
      try {
        const result = await this.collectFromPlatform(platform);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to collect from ${platform}:`, error);
        results.push({
          platform,
          collected: 0,
          processed: 0,
          failed: 1,
          errors: [error.message],
          duration: 0,
          timestamp: new Date()
        });
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  async getCollectionStatus(): Promise<CollectionStatusResponseDto> {
    const platforms = ['twitter', 'tiktok', 'instagram', 'youtube', 'facebook'];
    const platformStatuses = [];
    let totalCollected = 0;
    let totalFailed = 0;
    let isAnyRunning = false;

    for (const platform of platforms) {
      const status = await this.getPlatformStatus(platform);
      platformStatuses.push(status);
      totalCollected += status.totalCollected;
      totalFailed += status.totalFailed;
      if (status.isRunning) {
        isAnyRunning = true;
      }
    }

    return {
      platforms: platformStatuses,
      totalCollected,
      totalFailed,
      isAnyRunning,
      lastUpdated: new Date()
    };
  }

  async getPlatformStatistics(platform: string): Promise<any> {
    const stats = await this.redis.hgetall(`ingest:stats:${platform}`);

    // Get priority queue statistics
    const priorityKey = `ingest:priority:${platform}`;
    const priorityQueueSize = await this.redis.zcard(priorityKey);
    const highPriorityCount = await this.redis.zcount(priorityKey, 7, 10);

    // Get high-priority content samples
    const highPrioritySamples = await this.redis.lrange(`ingest:high_priority:${platform}`, 0, 4);

    if (Object.keys(stats).length === 0) {
      return {
        platform,
        totalCollected: 0,
        totalProcessed: 0,
        totalFailed: 0,
        avgProcessingTime: 0,
        lastRun: null,
        nextRun: null,
        priorityQueueSize: 0,
        highPriorityCount: 0,
        highPrioritySamples: [],
        sentimentStats: {
          avgPriority: 0,
          viralContentCount: 0
        }
      };
    }

    // Convert string values to numbers
    return {
      platform,
      totalCollected: parseInt(stats.totalCollected || '0'),
      totalProcessed: parseInt(stats.totalProcessed || '0'),
      totalFailed: parseInt(stats.totalFailed || '0'),
      avgProcessingTime: parseFloat(stats.avgProcessingTime || '0'),
      lastRun: stats.lastRun ? new Date(stats.lastRun) : null,
      nextRun: stats.nextRun ? new Date(stats.nextRun) : null,
      priorityQueueSize,
      highPriorityCount,
      highPrioritySamples: highPrioritySamples.map(item => JSON.parse(item)),
      sentimentStats: {
        avgPriority: highPriorityCount > 0 ? (highPriorityCount / priorityQueueSize) * 10 : 0,
        viralContentCount: highPriorityCount,
        processingEfficiency: priorityQueueSize > 0 ? ((priorityQueueSize - highPriorityCount) / priorityQueueSize) : 1
      }
    };
  }

  getConnector(platform: string): BaseConnector {
    const connector = this.connectors.get(platform.toLowerCase());
    if (!connector) {
      throw new Error(`No connector found for platform: ${platform}`);
    }
    return connector;
  }

  private async isCollectionRunning(platform: string): Promise<boolean> {
    const result = await this.redis.get(`ingest:running:${platform}`);
    return result === '1';
  }

  private async setCollectionRunning(platform: string, running: boolean): Promise<void> {
    const key = `ingest:running:${platform}`;
    if (running) {
      await this.redis.setex(key, 300, '1'); // 5 minute timeout
    } else {
      await this.redis.del(key);
    }
  }

  private async queueContentForProcessing(platform: string, content: Content): Promise<void> {
    const jobData = {
      platform,
      content,
      retryCount: 0,
      timestamp: new Date()
    };

    const queueKey = `ingest:${platform.toLowerCase()}`;
    const queue = this.getQueueByName(queueKey);

    // Use priority from sentiment analysis if available
    const priority = content.metadata?.priorityScore || 5; // Default to medium priority

    // Higher priority content gets processed faster (lower delay)
    const options = {
      priority: 10 - priority, // Invert so higher priority score gets lower numeric priority
      delay: priority <= 4 ? 0 : Math.max(0, (priority - 4) * 1000), // Delay for lower priority content
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    };

    await queue.add('process', jobData, options);
  }

  private getQueueByName(queueName: string): Queue {
    switch (queueName) {
      case 'ingest:twitter':
        return this.twitterQueue;
      case 'ingest:tiktok':
        return this.tiktokQueue;
      case 'ingest:instagram':
        return this.instagramQueue;
      case 'ingest:youtube':
        return this.youtubeQueue;
      case 'ingest:facebook':
        return this.facebookQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }

  private async updateCollectionStats(platform: string, result: CollectionResult): Promise<void> {
    const statsKey = `ingest:stats:${platform}`;
    const timestamp = new Date().toISOString();

    // Update statistics
    await this.redis.hincrby(statsKey, 'totalCollected', result.collected);
    await this.redis.hincrby(statsKey, 'totalFailed', result.failed);
    await this.redis.hset(statsKey, 'lastRun', timestamp);

    // Update average processing time
    const currentAvg = parseFloat((await this.redis.hget(statsKey, 'avgProcessingTime')) || '0');
    const totalRuns = parseInt((await this.redis.hget(statsKey, 'totalRuns')) || '0');
    const newAvg = ((currentAvg * totalRuns) + result.duration) / (totalRuns + 1);
    await this.redis.hset(statsKey, 'avgProcessingTime', newAvg.toString());
    await this.redis.hincrby(statsKey, 'totalRuns', 1);
  }

  private async getPlatformStatus(platform: string): Promise<any> {
    const isRunning = await this.isCollectionRunning(platform);
    const stats = await this.redis.hgetall(`ingest:stats:${platform}`);

    return {
      platform,
      isRunning,
      lastRun: stats.lastRun ? new Date(stats.lastRun) : null,
      nextRun: stats.nextRun ? new Date(stats.nextRun) : null,
      totalCollected: parseInt(stats.totalCollected || '0'),
      totalFailed: parseInt(stats.totalFailed || '0')
    };
  }

  private isPlatformEnabled(platform: string): boolean {
    return this.configService.get<boolean>(`${platform.toUpperCase()}_ENABLED`, false);
  }

  async stopCollection(platform: string): Promise<void> {
    await this.setCollectionRunning(platform, false);
    this.logger.log(`Stopped collection for platform: ${platform}`);
  }
}
