import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Content, MediaUrl, ContentMetrics } from '../interfaces/ingest.interface';
import { SentimentScorer, SentimentScore, ViralIndicators } from '../utils/sentiment-scorer';

export interface CollectorConfig {
  enabled: boolean;
  rateLimit: number;
  keywords: string[];
  hashtags: string[];
  regions: string[];
  languages: string[];
}

@Injectable()
export abstract class BaseConnector {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly redis: Redis;
  protected readonly config: ConfigService;
  protected readonly collectorConfig: CollectorConfig;
  protected readonly platformName: string;

  constructor(
    @InjectRedis() redis: Redis,
    config: ConfigService,
    platformName: string) {
    this.redis = redis;
    this.config = config;
    this.platformName = platformName;
    this.collectorConfig = this.loadConfig(platformName);
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract collectContent(): Promise<Content[]>;
  abstract validateContent(content: any): boolean;
  abstract transformContent(rawContent: any): Content;

  protected loadConfig(platformName: string): CollectorConfig {
    const getArray = (key: string, defaultValue: string): string[] => {
      const value = this.config.get(key);
      if (!value) return defaultValue.split(',');
      if (Array.isArray(value)) return value;
      return value.toString().split(',');
    };

    return {
      enabled: this.config.get(`${platformName.toUpperCase()}_ENABLED`, false),
      rateLimit: this.config.get(`${platformName.toUpperCase()}_RATE_LIMIT`, 100),
      keywords: getArray(`${platformName.toUpperCase()}_KEYWORDS`, ''),
      hashtags: getArray(`${platformName.toUpperCase()}_HASHTAGS`, ''),
      regions: getArray(`${platformName.toUpperCase()}_REGIONS`, 'ZA'),
      languages: getArray(`${platformName.toUpperCase()}_LANGUAGES`, 'en')
    };
  }

  protected async storeContent(content: Content[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const item of content) {
      // Store content details
      await pipeline.hset(
        `content:${item.platform}:${item.nativeId}`,
        {
          platform: item.platform,
          nativeId: item.nativeId,
          authorId: item.authorId,
          authorHandle: item.authorHandle || '',
          textContent: item.textContent,
          timestamp: item.timestamp.toISOString(),
          metrics: JSON.stringify(item.metrics),
          hashtags: JSON.stringify(item.hashtags || []),
          mentions: JSON.stringify(item.mentions || []),
          location: JSON.stringify(item.location || {}),
          language: item.language || '',
          engagement: JSON.stringify(item.engagement),
          metadata: JSON.stringify(item.metadata || {})
        }
      );

      // Queue management is now handled by IngestService - remove direct lpush
      // Content metadata storage only

      // Set expiry (7 days)
      await pipeline.expire(`content:${item.platform}:${item.nativeId}`, 7 * 24 * 3600);
    }

    await pipeline.exec();
    this.logger.log(`Stored ${content.length} content items for ${this.platformName}`);
  }

  protected async checkRateLimit(): Promise<boolean> {
    const key = `ratelimit:${this.platformName}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }

    return current <= this.collectorConfig.rateLimit;
  }

  protected matchesFilters(content: Partial<Content>): boolean {
    // Check keywords
    if (this.collectorConfig.keywords.length > 0 && content.textContent) {
      const text = content.textContent.toLowerCase();
      const hasKeyword = this.collectorConfig.keywords.some(keyword =>
        text.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Check hashtags
    if (this.collectorConfig.hashtags.length > 0) {
      const text = content.textContent?.toLowerCase() || '';
      const contentHashtags = content.hashtags?.map(h => h.toLowerCase()) || [];

      const hasHashtag = this.collectorConfig.hashtags.some(hashtag =>
        text.includes(`#${hashtag.toLowerCase()}`) ||
        text.includes(hashtag.toLowerCase()) ||
        contentHashtags.includes(hashtag.toLowerCase().replace('#', ''))
      );
      if (!hasHashtag) return false;
    }

    // Check language
    if (this.collectorConfig.languages.length > 0 && content.language) {
      if (!this.collectorConfig.languages.includes(content.language)) {
        return false;
      }
    }

    return true;
  }

  protected calculateEngagement(metrics: ContentMetrics): { score: number; tier: 'low' | 'medium' | 'high' | 'viral' } {
    const likes = metrics.likes || 0;
    const shares = metrics.shares || 0;
    const comments = metrics.comments || 0;
    const views = metrics.views || 0;
    const plays = metrics.plays || 0;
    const saves = metrics.saves || 0;
    const clicks = metrics.clicks || 0;

    // Calculate total engagement
    let totalEngagement = likes + (shares * 3) + (comments * 2) + saves + (clicks * 0.5);

    // Calculate engagement rate
    const totalViews = Math.max(views + plays, 1); // Avoid division by zero
    const engagementRate = totalEngagement / totalViews;

    let tier: 'low' | 'medium' | 'high' | 'viral';
    if (engagementRate > 0.1) {
      tier = 'viral';
    } else if (engagementRate > 0.05) {
      tier = 'high';
    } else if (engagementRate > 0.02) {
      tier = 'medium';
    } else {
      tier = 'low';
    }

    return {
      score: engagementRate,
      tier
    };
  }

  protected async geolocateContent(content: Partial<Content>): Promise<string | null> {
    // Check if content has location metadata
    if (content.location?.name) {
      return content.location.name;
    }

    // Check content metadata for location
    if (content.metadata?.location) {
      return content.metadata.location;
    }

    // Geolocate based on author information
    if (content.authorHandle) {
      const cachedLocation = await this.redis.get(`location:${content.authorHandle}`);
      if (cachedLocation) {
        return cachedLocation;
      }
    }

    // Default to South Africa if no location found
    return 'ZA';
  }

  protected async detectLanguage(content: string): Promise<string> {
    // Simple language detection - in production, use a proper library
    const zaKeywords = ['baie', 'gek', 'lekker', 'jou', 'jy', 'hier', 'daar', 'kom', 'gaan', 'sien', 'is', 'van', 'vir', 'met', 'die'];
    const text = content.toLowerCase();

    if (zaKeywords.some(keyword => text.includes(keyword))) {
      return 'af'; // Afrikaans
    }

    // Basic Zulu detection
    const zuKeywords = ['yini', 'ngiyabonga', 'khona', 'njalo', 'namhlanje', 'kusasa', 'baba', 'mama', 'ngiyakuthanda'];
    if (zuKeywords.some(keyword => text.includes(keyword))) {
      return 'zu'; // Zulu
    }

    // Basic Xhosa detection
    const xhKeywords = ['ntoni', ' enkosi', 'khona', 'njalo', 'namhlanje', 'kusasa', 'tata', 'umama', 'ndiyakuthanda'];
    if (xhKeywords.some(keyword => text.includes(keyword))) {
      return 'xh'; // Xhosa
    }

    return 'en'; // Default to English
  }

  // Additional validation for metrics to prevent NaN values
  protected validateMetrics(metrics: ContentMetrics): boolean {
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

  // Enhanced methods for better tracking
  protected async getLastCollectionTimestamp(): Promise<Date | null> {
    const timestamp = await this.redis.get(`ingest:last:${this.platformName}`);
    return timestamp ? new Date(timestamp) : null;
  }

  protected async setLastCollectionTimestamp(timestamp: Date): Promise<void> {
    await this.redis.set(`ingest:last:${this.platformName}`, timestamp.toISOString());
  }

  protected async getCollectionErrors(): Promise<string[]> {
    const errors = await this.redis.lrange(`ingest:errors:${this.platformName}`, 0, 9);
    return errors;
  }

  protected async addCollectionError(error: string): Promise<void> {
    await this.redis.lpush(`ingest:errors:${this.platformName}`, error);
    await this.redis.ltrim(`ingest:errors:${this.platformName}`, 0, 9); // Keep last 10 errors
  }

  // Pagination and checkpoint helpers
  protected async getCheckpoint(checkpointKey: string): Promise<string | null> {
    return await this.redis.get(`ingest:checkpoint:${this.platformName}:${checkpointKey}`);
  }

  protected async setCheckpoint(checkpointKey: string, value: string): Promise<void> {
    await this.redis.set(`ingest:checkpoint:${this.platformName}:${checkpointKey}`, value);
  }

  protected async getPageToken(pageTokenKey: string = 'default'): Promise<string | null> {
    return await this.getCheckpoint(`page_token:${pageTokenKey}`);
  }

  protected async setPageToken(pageToken: string, pageTokenKey: string = 'default'): Promise<void> {
    await this.setCheckpoint(`page_token:${pageTokenKey}`, pageToken);
  }

  protected async getWatermark(key?: string): Promise<string | null> {
    return await this.getCheckpoint(`watermark:${key || this.platformName}`);
  }

  protected async setWatermark(watermark: string, key?: string): Promise<void> {
    await this.setCheckpoint(`watermark:${key || this.platformName}`, watermark);
  }

  // Sentiment-aware content prioritization
  protected analyzeContentPriority(content: Content): {
    sentiment: SentimentScore;
    indicators: ViralIndicators;
    priority: number;
    enhancedContent: Content;
  } {
    const sentiment = SentimentScorer.analyzeSentiment(content.textContent, content.metadata);
    const indicators = SentimentScorer.analyzeViralIndicators(
      content.textContent,
      content.metrics,
      content.metadata
    );
    const priority = SentimentScorer.calculatePriorityScore(sentiment, indicators);

    // Enhance content with sentiment analysis results
    const enhancedContent: Content = {
      ...content,
      metadata: {
        ...content.metadata,
        sentimentAnalysis: {
          score: sentiment.score,
          polarity: sentiment.polarity,
          confidence: sentiment.confidence,
          impactScore: sentiment.impactScore,
          viralPotential: sentiment.viralPotential
        },
        viralIndicators: indicators,
        priorityScore: priority,
        analyzedAt: new Date().toISOString()
      }
    };

    return {
      sentiment,
      indicators,
      priority,
      enhancedContent
    };
  }

  protected async queueWithPriority(content: Content): Promise<void> {
    const analysis = this.analyzeContentPriority(content);
    const priorityKey = `ingest:priority:${this.platformName}`;

    // Add to priority queue with score
    await this.redis.zadd(priorityKey, analysis.priority, JSON.stringify(analysis.enhancedContent));

    // Trim priority queue to prevent memory bloat (keep top 1000 items)
    await this.redis.zremrangebyrank(priorityKey, 0, -1001);

    // Log high-priority content for monitoring
    if (analysis.priority >= 7) {
      this.logger.log(`High-priority content detected (score: ${analysis.priority}): ${content.nativeId}`);
      await this.logHighPriorityContent(analysis.enhancedContent, analysis.priority);
    }
  }

  protected async getPriorityQueuedContent(limit: number = 50): Promise<Content[]> {
    const priorityKey = `ingest:priority:${this.platformName}`;

    // Get highest priority items (descending order)
    const results = await this.redis.zrevrange(priorityKey, 0, limit - 1);

    return results.map(item => JSON.parse(item));
  }

  protected async removeFromPriorityQueue(contentId: string): Promise<void> {
    const priorityKey = `ingest:priority:${this.platformName}`;

    // Find and remove the specific content item
    const allItems = await this.redis.zrange(priorityKey, 0, -1);
    for (const item of allItems) {
      const content = JSON.parse(item);
      if (content.nativeId === contentId) {
        await this.redis.zrem(priorityKey, item);
        break;
      }
    }
  }

  private async logHighPriorityContent(content: Content, priority: number): Promise<void> {
    const logKey = `ingest:high_priority:${this.platformName}`;
    const logEntry = {
      contentId: content.nativeId,
      authorId: content.authorId,
      textContent: content.textContent.substring(0, 100) + '...',
      priority,
      timestamp: new Date().toISOString(),
      viralPotential: content.metadata?.sentimentAnalysis?.viralPotential,
      sentiment: content.metadata?.sentimentAnalysis?.polarity
    };

    await this.redis.lpush(logKey, JSON.stringify(logEntry));
    await this.redis.ltrim(logKey, 0, 99); // Keep last 100 high-priority entries
  }

  // Batch processing with sentiment-aware sorting
  protected async processContentBatch(contents: Content[]): Promise<{
    highPriority: Content[];
    normalPriority: Content[];
  }> {
    const highPriority: Content[] = [];
    const normalPriority: Content[] = [];

    for (const content of contents) {
      const analysis = this.analyzeContentPriority(content);

      if (analysis.priority >= 6) {
        highPriority.push(analysis.enhancedContent);
      } else {
        normalPriority.push(analysis.enhancedContent);
      }

      // Also add to priority queue for async processing
      await this.queueWithPriority(content);
    }

    // Sort high-priority content by score (highest first)
    highPriority.sort((a, b) =>
      (b.metadata?.priorityScore || 0) - (a.metadata?.priorityScore || 0)
    );

    this.logger.log(`Prioritized ${contents.length} items: ${highPriority.length} high-priority, ${normalPriority.length} normal-priority`);

    return { highPriority, normalPriority };
  }
}
