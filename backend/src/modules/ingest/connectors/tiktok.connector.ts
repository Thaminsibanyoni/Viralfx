import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { BaseConnector, Content, ContentMetrics, MediaUrl } from "./base.connector";
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TikTokConnector extends BaseConnector {
  private readonly httpService: HttpService;
  private accessToken: string;
  private apiBaseUrl: string;
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(
    @InjectRedis() redis: Redis,
    config: ConfigService,
    httpService: HttpService) {
    super(redis, config, 'tiktok');
    this.httpService = httpService;
    this.accessToken = config.get<string>('TIKTOK_ACCESS_TOKEN') || '';
    this.appId = config.get<string>('TIKTOK_API_KEY') || '';
    this.appSecret = config.get<string>('TIKTOK_API_SECRET') || '';
    this.apiBaseUrl = config.get<string>('TIKTOK_API_BASE_URL', 'https://open.tiktokapis.com/v2');

    if (!this.accessToken && !this.appId) {
      this.logger.warn('TikTok connector not configured - missing access token and API credentials');
    }
  }

  async connect(): Promise<void> {
    try {
      // If we don't have an access token, we need to get one
      if (!this.accessToken && this.appId && this.appSecret) {
        await this.refreshAccessToken();
      }

      // Test the connection with a simple request
      const response = await this.makeApiRequest('/user/info/');
      if (response) {
        this.logger.log('TikTok API connection established successfully');
      }
    } catch (error) {
      this.logger.error('Failed to connect to TikTok API:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Clear sensitive data
    this.accessToken = '';
    this.logger.log('TikTok connector disconnected');
  }

  async collectContent(): Promise<Content[]> {
    try {
      // Feature flag to disable TikTok collection if API is not available
      const isTikTokEnabled = this.config.get<boolean>('TIKTOK_COLLECTION_ENABLED', false);
      if (!isTikTokEnabled) {
        this.logger.debug('TikTok collection is disabled via feature flag');
        return [];
      }

      // Check rate limits
      if (!await this.checkRateLimit()) {
        this.logger.warn('TikTok rate limit exceeded, skipping collection');
        return [];
      }

      const contents: Content[] = [];

      // Only attempt collection if we have valid API endpoints
      try {
        // Collect from hashtags
        const hashtagContents = await this.collectFromHashtags();
        contents.push(...hashtagContents);

        // Collect from search terms
        const searchContents = await this.collectFromSearch();
        contents.push(...searchContents);
      } catch (apiError) {
        this.logger.warn('TikTok API endpoints not available, skipping collection:', apiError.message);
        return [];
      }

      // Store content
      if (contents.length > 0) {
        await this.storeContent(contents);
        await this.setLastCollectionTimestamp(new Date());
      }

      this.logger.log(`Collected ${contents.length} videos from TikTok`);
      return contents;

    } catch (error) {
      this.logger.error('Failed to collect TikTok content:', error);
      await this.addCollectionError(`TikTok collection failed: ${error.message}`);
      throw error;
    }
  }

  validateContent(content: Content): boolean {
    return !!(
      content.platform &&
      content.nativeId &&
      content.authorId &&
      content.textContent &&
      content.timestamp
    );
  }

  transformContent(rawVideo: any): Content {
    // Extract hashtags from text description
    const hashtags = this.extractHashtags(rawVideo.text_description || '');

    // Build media URLs
    const mediaUrls: MediaUrl[] = [{
      url: rawVideo.video?.play_addr?.url_list?.[0] || '',
      type: 'video',
      thumbnail: rawVideo.video?.cover?.url_list?.[0],
      duration: rawVideo.video?.duration * 1000, // Convert to milliseconds
      size: rawVideo.video?.size
    }];

    // Build metrics
    const metrics: ContentMetrics = {
      likes: rawVideo.stats?.like_count || 0,
      shares: rawVideo.stats?.share_count || 0,
      comments: rawVideo.stats?.comment_count || 0,
      plays: rawVideo.stats?.play_count || 0
    };

    // Calculate engagement
    const engagement = this.calculateEngagement(metrics);

    return {
      platform: 'TIKTOK',
      nativeId: rawVideo.id,
      authorId: rawVideo.author?.unique_id || '',
      authorHandle: rawVideo.author?.unique_id || '',
      textContent: rawVideo.text_description || '',
      mediaUrls,
      metrics,
      hashtags,
      mentions: [], // TikTok mentions are part of the text description
      language: this.detectLanguage(rawVideo.text_description || ''),
      timestamp: new Date(parseInt(rawVideo.create_time) * 1000),
      engagement,
      metadata: {
        source: 'tiktok-api',
        music: rawVideo.music,
        challenges: rawVideo.challenges,
        duetInfo: rawVideo.duet_info,
        stitchInfo: rawVideo.stitch_info,
        effectiveComments: rawVideo.stats?.effective_comment_count
      }
    };
  }

  private async collectFromHashtags(): Promise<Content[]> {
    const contents: Content[] = [];

    for (const hashtag of this.collectorConfig.hashtags.slice(0, 5)) { // Limit to 5 hashtags
      try {
        const cleanHashtag = hashtag.replace('#', '');
        const hashtagKey = `hashtag:${cleanHashtag}`;

        // Get watermark for incremental collection
        const lastWatermark = await this.getWatermark(hashtagKey);

        // Get pagination cursor for this hashtag
        let cursor = await this.getPageToken(hashtagKey) || '0';
        let pageCount = 0;
        const maxPages = parseInt(this.config.get('INGEST_MAX_PAGES', '3'));

        // Paginate through hashtag videos
        while (pageCount < maxPages) {
          const response = await this.makeApiRequest(`/hashtag/hashtag/videos/`, {
            hashtag_name: cleanHashtag,
            count: 20,
            cursor: parseInt(cursor)
          });

          if (response?.data?.videos) {
            // Check for duplicates in Redis
            const videoIds = response.data.videos.map((video: any) => video.id);
            const existingVideoKeys = await Promise.all(
              videoIds.map(id => this.redis.exists(`content:tiktok:${id}`))
            );

            const newVideos = response.data.videos.filter((video: any, index: number) => {
              const isDuplicate = existingVideoKeys[index] === 1;

              // Filter by watermark if available
              let isRecent = true;
              if (lastWatermark && video.create_time) {
                const videoTime = new Date(parseInt(video.create_time) * 1000);
                const watermarkTime = new Date(lastWatermark);
                isRecent = videoTime > watermarkTime;
              }

              return !isDuplicate && isRecent;
            });

            // Process new videos
            for (const video of newVideos) {
              try {
                const transformedContent = this.transformContent(video);

                if (this.validateContent(transformedContent) && this.matchesFilters(transformedContent)) {
                  contents.push(transformedContent);
                }
              } catch (error) {
                this.logger.warn(`Failed to transform TikTok video ${video.id}:`, error);
              }
            }
          }

          // Check for pagination
          if (response?.data?.has_more && response?.data?.cursor) {
            cursor = response.data.cursor.toString();
            await this.setPageToken(cursor, hashtagKey);
            pageCount++;
          } else {
            // No more pages, clear the token
            await this.setPageToken('', hashtagKey);
            break;
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to collect from hashtag ${hashtag}:`, error);
        await this.addCollectionError(`Hashtag collection failed for ${hashtag}: ${error.message}`);
      }
    }

    // Update watermark to latest content timestamp
    if (contents.length > 0) {
      const latestTimestamp = contents[0].timestamp.toISOString();
      await this.setWatermark(latestTimestamp, 'tiktok');
    }

    return contents;
  }

  private async collectFromSearch(): Promise<Content[]> {
    const contents: Content[] = [];

    for (const keyword of this.collectorConfig.keywords.slice(0, 3)) { // Limit to 3 keywords
      try {
        const searchKey = `search:${keyword}`;

        // Get watermark for incremental collection
        const lastWatermark = await this.getWatermark(searchKey);

        // Get pagination cursor for this search
        let cursor = await this.getPageToken(searchKey) || '0';
        let pageCount = 0;
        const maxPages = parseInt(this.config.get('INGEST_MAX_PAGES', '3'));

        // Paginate through search results
        while (pageCount < maxPages) {
          const response = await this.makeApiRequest(`/search/video/`, {
            keyword,
            count: 20,
            cursor: parseInt(cursor)
          });

          if (response?.data?.videos) {
            // Check for duplicates in Redis
            const videoIds = response.data.videos.map((video: any) => video.id);
            const existingVideoKeys = await Promise.all(
              videoIds.map(id => this.redis.exists(`content:tiktok:${id}`))
            );

            const newVideos = response.data.videos.filter((video: any, index: number) => {
              const isDuplicate = existingVideoKeys[index] === 1;

              // Filter by watermark if available
              let isRecent = true;
              if (lastWatermark && video.create_time) {
                const videoTime = new Date(parseInt(video.create_time) * 1000);
                const watermarkTime = new Date(lastWatermark);
                isRecent = videoTime > watermarkTime;
              }

              return !isDuplicate && isRecent;
            });

            // Process new videos
            for (const video of newVideos) {
              try {
                const transformedContent = this.transformContent(video);

                if (this.validateContent(transformedContent) && this.matchesFilters(transformedContent)) {
                  contents.push(transformedContent);
                }
              } catch (error) {
                this.logger.warn(`Failed to transform TikTok video ${video.id}:`, error);
              }
            }
          }

          // Check for pagination
          if (response?.data?.has_more && response?.data?.cursor) {
            cursor = response.data.cursor.toString();
            await this.setPageToken(cursor, searchKey);
            pageCount++;
          } else {
            // No more pages, clear the token
            await this.setPageToken('', searchKey);
            break;
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to search for keyword ${keyword}:`, error);
        await this.addCollectionError(`Search failed for keyword ${keyword}: ${error.message}`);
      }
    }

    // Update watermark to latest content timestamp
    if (contents.length > 0) {
      const latestTimestamp = contents[0].timestamp.toISOString();
      await this.setWatermark(latestTimestamp, 'search');
    }

    return contents;
  }

  private async makeApiRequest(endpoint: string, params: any = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No TikTok access token available');
    }

    try {
      const headers = {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      };

      const url = `${this.apiBaseUrl}${endpoint}`;
      const response = await firstValueFrom(
        this.httpService.post(url, params, { headers })
      );

      return response.data;
    } catch (error) {
      // Handle token expiration
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        // Retry once with new token
        const headers = {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        };

        const url = `${this.apiBaseUrl}${endpoint}`;
        const retryResponse = await firstValueFrom(
          this.httpService.post(url, params, { headers })
        );

        return retryResponse.data;
      }

      throw error;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.appId || !this.appSecret) {
      throw new Error('Cannot refresh TikTok access token: missing API credentials');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiBaseUrl}/oauth2/token/`, {
          client_key: this.appId,
          client_secret: this.appSecret,
          grant_type: 'client_credentials'
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );

      this.accessToken = response.data.access_token;
      this.logger.log('TikTok access token refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh TikTok access token:', error);
      throw error;
    }
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex) || [];
    return matches.map(tag => tag.replace('#', ''));
  }

  // TikTok API may require different authentication methods
  private async testAlternativeConnection(): Promise<boolean> {
    // This would implement alternative connection methods
    // such as web scraping or third-party APIs
    try {
      // Test with public TikTok endpoints
      const testUrl = 'https://www.tiktok.com/@tiktok/video/7351234567890123456';
      const response = await firstValueFrom(
        this.httpService.get(testUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })
      );

      return response.status === 200;
    } catch (error) {
      this.logger.warn('Alternative TikTok connection failed:', error);
      return false;
    }
  }
}
