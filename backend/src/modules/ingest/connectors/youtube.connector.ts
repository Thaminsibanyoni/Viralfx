import { Injectable } from '@nestjs/common';
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

  constructor(
    @InjectRedis() redis: Redis,
    config: ConfigService,
    httpService: HttpService
  ) {
    super(redis, config, 'youtube');
    this.httpService = httpService;
    this.apiKey = config.get<string>('YOUTUBE_API_KEY') || '';
    if (this.apiKey) {
      this.youtubeClient = google.youtube({
        version: 'v3',
        auth: this.apiKey
      });
    } else {
      console.warn('YouTube API key not configured');
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!this.apiKey;
  }

  async searchContent(
    query: string,
    maxResults: number = 20,
    filters: any = {}
  ): Promise<Content[]> {
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
      console.error('YouTube search error:', error);
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
      console.error('YouTube content details error:', error);
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
      console.error('YouTube metrics error:', error);
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

  private incrementQuota(amount: number): void {
    this.quotaUsage += amount;
  }
}