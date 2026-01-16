import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { BaseConnector, Content, ContentMetrics, MediaUrl } from "./base.connector";
import { google } from 'googleapis';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class YouTubeConnector extends BaseConnector {
  private readonly httpService: HttpService;
  private youtubeClient: any;
  private readonly apiKey: string;
  private quotaUsage: number = 0;
  private readonly dailyQuotaLimit: number = 10000;
  private readonly logger: Logger;

  constructor(
    @InjectRedis() redis: Redis,
    config: ConfigService,
    httpService: HttpService
  ) {
    super(redis, config, 'youtube');
    this.httpService = httpService;
    this.apiKey = config.get<string>('YOUTUBE_API_KEY') || '';
    this.logger = new Logger(YouTubeConnector.name);

    if (this.apiKey) {
      this.youtubeClient = google.youtube({
        version: 'v3',
        auth: this.apiKey
      });
    } else {
      this.logger.warn('YouTube API key not configured');
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!this.apiKey;
  }

  async searchContent(
    query: string,
    maxResults: number = 20,
    filters: any = {}
  ): Promise<any[]> {
    try {
      const response = await this.youtubeClient.search.list({
        part: 'snippet',
        q: query,
        maxResults,
        type: 'video',
        order: filters.sortOrder || 'relevance',
        publishedAfter: filters.publishedAfter,
        publishedBefore: filters.publishedBefore
      });

      const items = response.data.items || [];
      return items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        author: item.snippet.channelTitle,
        publishedAt: new Date(item.snippet.publishedAt),
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        platform: 'youtube',
        metadata: {
          channelId: item.snippet.channelId,
          thumbnails: item.snippet.thumbnails,
          tags: item.snippet.tags || []
        }
      }));
    } catch (error) {
      this.logger.error('YouTube search error:', error);
      return [];
    }
  }

  async getContentDetails(contentId: string): Promise<Content | null> {
    try {
      const response = await this.youtubeClient.videos.list({
        part: 'snippet,statistics,contentDetails',
        id: contentId
      });

      const item = response.data.items?.[0];
      if (!item) return null;

      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        author: item.snippet.channelTitle,
        publishedAt: new Date(item.snippet.publishedAt),
        url: `https://www.youtube.com/watch?v=${item.id}`,
        platform: 'youtube',
        metadata: {
          channelId: item.snippet.channelId,
          thumbnails: item.snippet.thumbnails,
          tags: item.snippet.tags || [],
          duration: item.contentDetails.duration,
          statistics: item.statistics
        }
      };
    } catch (error) {
      this.logger.error('YouTube content details error:', error);
      return null;
    }
  }

  async getContentMetrics(contentId: string): Promise<ContentMetrics | null> {
    try {
      const response = await this.youtubeClient.videos.list({
        part: 'statistics',
        id: contentId
      });

      const item = response.data.items?.[0];
      if (!item) return null;

      const stats = item.statistics;
      return {
        views: parseInt(stats.viewCount || '0'),
        likes: parseInt(stats.likeCount || '0'),
        comments: parseInt(stats.commentCount || '0'),
        shares: 0, // YouTube doesn't provide share count
        engagement: 0
      };
    } catch (error) {
      this.logger.error('YouTube metrics error:', error);
      return null;
    }
  }

  async getMediaUrls(contentId: string): Promise<MediaUrl[]> {
    // YouTube doesn't provide direct media URLs through the API
    return [];
  }

  async checkQuota(): Promise<{ used: number; limit: number; remaining: number }> {
    return {
      used: this.quotaUsage,
      limit: this.dailyQuotaLimit,
      remaining: this.dailyQuotaLimit - this.quotaUsage
    };
  }

  // Implementation of abstract collectContent method from BaseConnector
  async collectContent(): Promise<Content[]> {
    this.logger.log('📺 Collecting trending YouTube content for South Africa');

    try {
      // South African trending queries
      const saQueries = [
        'South Africa trends',
        'Mzansi viral',
        'South Africa viral videos',
        'SA trending'
      ];

      const allContent: any[] = [];

      for (const query of saQueries) {
        try {
          const content = await this.searchContent(query, 10, {
            sortOrder: 'relevance'
          });
          allContent.push(...content);
          this.incrementQuota(content.length * 100); // Approximate quota cost
        } catch (error) {
          this.logger.warn(`Failed to search YouTube for query "${query}":`, error.message);
        }
      }

      // Map YouTube API response to Content interface
      const mappedContent: Content[] = allContent.map((item: any) => ({
        nativeId: item.id,
        textContent: `${item.title}. ${item.description}`.substring(0, 500),
        authorId: item.metadata?.channelId || '',
        authorHandle: item.author,
        platform: 'youtube' as any,
        contentType: 'video' as any,
        hashtags: item.metadata?.tags?.map((tag: string) => `#${tag.replace(/\s+/g, '')}`) || [],
        mentions: [],
        mediaUrls: [
          {
            url: item.url,
            type: 'video' as any,
            thumbnails: item.metadata?.thumbnails
          }
        ],
        metrics: {
          views: item.metadata?.statistics?.viewCount || 0,
          likes: item.metadata?.statistics?.likeCount || 0,
          comments: item.metadata?.statistics?.commentCount || 0,
          shares: 0
        },
        timestamp: item.publishedAt,
        location: null,
        language: 'en',
        metadata: {
          verified: false,
          ...item.metadata
        }
      }));

      this.logger.log(`✅ Collected ${mappedContent.length} YouTube videos`);
      return mappedContent;
    } catch (error) {
      this.logger.error('❌ Failed to collect YouTube content:', error);
      return [];
    }
  }

  private incrementQuota(amount: number): void {
    this.quotaUsage += amount;
  }
}
