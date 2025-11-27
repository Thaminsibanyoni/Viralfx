import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { BaseConnector, Content, ContentMetrics, MediaUrl } from './base.connector';
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
    httpService: HttpService,
  ) {
    super(redis, config, 'youtube');
    this.httpService = httpService;
    this.apiKey = config.get<string>('YOUTUBE_API_KEY') || '';

    if (this.apiKey) {
      this.youtubeClient = google.youtube({
        version: 'v3',
        auth: this.apiKey,
      });
    } else {
      this.logger.warn('YouTube connector not configured - missing API key');
    }
  }

  async connect(): Promise<void> {
    try {
      if (!this.apiKey) {
        throw new Error('YouTube API key is required');
      }

      // Test the connection with a lightweight public call
      const response = await this.youtubeClient.videos.list({
        part: 'snippet',
        chart: 'mostPopular',
        regionCode: 'ZA',
        maxResults: 1,
      });

      if (response.data.items?.length > 0) {
        this.logger.log('YouTube API connection established successfully');
        this.quotaUsage += 1;
      } else {
        this.logger.log('YouTube API connection established but no trending content found');
      }
    } catch (error) {
      this.logger.error('Failed to connect to YouTube API:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Clear sensitive data
    this.quotaUsage = 0;
    this.logger.log('YouTube connector disconnected');
  }

  async collectContent(): Promise<Content[]> {
    try {
      // Check rate limits and quota
      if (!await this.checkRateLimit()) {
        this.logger.warn('YouTube rate limit exceeded, skipping collection');
        return [];
      }

      if (this.quotaUsage >= this.dailyQuotaLimit) {
        this.logger.warn('YouTube daily quota exceeded, skipping collection');
        return [];
      }

      const contents: Content[] = [];

      // Collect from keyword searches
      const searchContents = await this.collectFromSearch();
      contents.push(...searchContents);

      // Collect from trending videos in South Africa
      const trendingContents = await this.collectFromTrending();
      contents.push(...trendingContents);

      // Store content
      if (contents.length > 0) {
        await this.storeContent(contents);
        await this.setLastCollectionTimestamp(new Date());
      }

      this.logger.log(`Collected ${contents.length} videos from YouTube (quota used: ${this.quotaUsage}/${this.dailyQuotaLimit})`);
      return contents;

    } catch (error) {
      this.logger.error('Failed to collect YouTube content:', error);
      await this.addCollectionError(`YouTube collection failed: ${error.message}`);
      throw error;
    }
  }

  validateContent(content: Content): boolean {
    return !!(
      content.platform &&
      content.nativeId &&
      content.authorId &&
      content.timestamp
    );
  }

  transformContent(rawVideo: any, snippet: any): Content {
    // Extract hashtags from description
    const hashtags = this.extractHashtags(snippet.description || '');
    const mentions = this.extractMentions(snippet.description || '');

    // Build media URLs
    const mediaUrls: MediaUrl[] = [{
      url: `https://www.youtube.com/watch?v=${rawVideo.id}`,
      type: 'video',
      thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
      size: rawVideo.contentDetails?.duration,
    }];

    // Build metrics
    const metrics: ContentMetrics = {
      likes: rawVideo.statistics?.likeCount || 0,
      shares: 0, // YouTube doesn't provide share counts
      comments: rawVideo.statistics?.commentCount || 0,
      views: rawVideo.statistics?.viewCount || 0,
      saves: 0, // YouTube doesn't provide save counts
    };

    // Calculate engagement
    const engagement = this.calculateEngagement(metrics);

    // Determine if it's a YouTube Short (duration < 60 seconds)
    const duration = this.parseDuration(rawVideo.contentDetails?.duration);
    const isShort = duration && duration < 60;

    return {
      platform: 'YOUTUBE',
      nativeId: rawVideo.id,
      authorId: snippet.channelId,
      authorHandle: snippet.channelTitle,
      textContent: `${snippet.title}\n\n${snippet.description?.substring(0, 500) || ''}`,
      mediaUrls,
      metrics,
      hashtags,
      mentions,
      location: null, // YouTube doesn't provide location data in API
      language: snippet.defaultLanguage || snippet.defaultAudioLanguage || 'en',
      timestamp: new Date(snippet.publishedAt),
      engagement,
      metadata: {
        source: 'youtube-data-api-v3',
        duration: rawVideo.contentDetails?.duration,
        definition: rawVideo.contentDetails?.definition,
        caption: rawVideo.contentDetails?.caption,
        isShort,
        tags: snippet.tags,
        categoryId: snippet.categoryId,
        liveBroadcastContent: snippet.liveBroadcastContent,
        defaultLanguage: snippet.defaultLanguage,
        thumbnails: snippet.thumbnails,
      },
    };
  }

  private async collectFromSearch(): Promise<Content[]> {
    const contents: Content[] = [];

    for (const keyword of this.collectorConfig.keywords.slice(0, 3)) { // Limit to 3 keywords
      try {
        // Get watermark for incremental collection
        const lastWatermark = await this.getWatermark(`search:${keyword}`);
        const publishedAfter = lastWatermark ? new Date(lastWatermark) : await this.getLastWeekDate();

        // Get pagination token for continued searches
        let pageToken = await this.getPageToken(`search:${keyword}`);
        let pageCount = 0;
        const maxPages = parseInt(this.config.get('INGEST_MAX_PAGES', '3'));

        // Paginate through results
        while (pageCount < maxPages) {
          // Search for videos (costs 100 quota units)
          this.quotaUsage += 100;

          const searchResponse = await this.youtubeClient.search.list({
            q: `${keyword} South Africa OR Mzansi OR SA`,
            part: 'snippet',
            type: 'video',
            regionCode: 'ZA',
            relevanceLanguage: 'en',
            maxResults: 25,
            order: 'date',
            publishedAfter: publishedAfter.toISOString(),
            pageToken: pageToken || undefined,
          });

          if (searchResponse.data.items) {
            const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId);

            // Check for duplicates in Redis before processing
            const existingVideoKeys = await Promise.all(
              videoIds.map(id => this.redis.exists(`content:youtube:${id}`))
            );

            const newVideoIds = videoIds.filter((_, index) => existingVideoKeys[index] === 0);

            if (newVideoIds.length > 0) {
              // Get detailed video statistics (costs 1 quota unit per video)
              this.quotaUsage += newVideoIds.length;

              const videoResponse = await this.youtubeClient.videos.list({
                id: newVideoIds.join(','),
                part: 'statistics,snippet,contentDetails',
              });

              if (videoResponse.data.items) {
                for (const video of videoResponse.data.items) {
                  try {
                    const snippet = searchResponse.data.items.find((item: any) => item.id.videoId === video.id)?.snippet;
                    if (snippet) {
                      const transformedContent = this.transformContent(video, snippet);

                      if (this.validateContent(transformedContent) && this.matchesFilters(transformedContent)) {
                        contents.push(transformedContent);
                      }
                    }
                  } catch (error) {
                    this.logger.warn(`Failed to transform YouTube video ${video.id}:`, error);
                  }
                }
              }
            }
          }

          // Check for pagination
          if (searchResponse.data.nextPageToken) {
            pageToken = searchResponse.data.nextPageToken;
            await this.setPageToken(pageToken, `search:${keyword}`);
            pageCount++;
          } else {
            // No more pages, clear the token
            await this.setPageToken('', `search:${keyword}`);
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
      await this.setWatermark(latestTimestamp, 'youtube');
    }

    return contents;
  }

  private async collectFromTrending(): Promise<Content[]> {
    const contents: Content[] = [];

    try {
      // Get watermark for incremental collection
      const lastWatermark = await this.getWatermark('trending');
      const publishedAfter = lastWatermark ? new Date(lastWatermark) : await this.getLastWeekDate();

      // Get pagination token for trending videos
      let pageToken = await this.getPageToken('trending');
      let pageCount = 0;
      const maxPages = parseInt(this.config.get('INGEST_MAX_PAGES', '3'));

      // Paginate through trending results
      while (pageCount < maxPages) {
        // Get trending videos in South Africa (costs 1 quota unit)
        this.quotaUsage += 1;

        const trendingResponse = await this.youtubeClient.videos.list({
          part: 'snippet,statistics,contentDetails',
          chart: 'mostPopular',
          regionCode: 'ZA',
          maxResults: 25,
          categoryId: '22', // People & Blogs category
          pageToken: pageToken || undefined,
        });

        if (trendingResponse.data.items) {
          // Filter by published date and check for duplicates
          const videoIds = trendingResponse.data.items.map((video: any) => video.id);
          const existingVideoKeys = await Promise.all(
            videoIds.map(id => this.redis.exists(`content:youtube:${id}`))
          );

          const filteredItems = trendingResponse.data.items.filter((video: any, index: number) => {
            const videoDate = new Date(video.snippet.publishedAt);
            const isRecent = videoDate > publishedAfter;
            const isDuplicate = existingVideoKeys[index] === 1;

            return isRecent && !isDuplicate;
          });

          // Process filtered items
          for (const video of filteredItems) {
            try {
              const transformedContent = this.transformContent(video, video.snippet);

              if (this.validateContent(transformedContent) && this.matchesFilters(transformedContent)) {
                contents.push(transformedContent);
              }
            } catch (error) {
              this.logger.warn(`Failed to transform trending YouTube video ${video.id}:`, error);
            }
          }
        }

        // Check for pagination
        if (trendingResponse.data.nextPageToken) {
          pageToken = trendingResponse.data.nextPageToken;
          await this.setPageToken(pageToken, 'trending');
          pageCount++;
        } else {
          // No more pages, clear the token
          await this.setPageToken('', 'trending');
          break;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to collect trending YouTube videos:', error);
      await this.addCollectionError(`Trending collection failed: ${error.message}`);
    }

    // Update watermark to latest content timestamp
    if (contents.length > 0) {
      const latestTimestamp = contents[0].timestamp.toISOString();
      await this.setWatermark(latestTimestamp, 'trending');
    }

    return contents;
  }

  private extractHashtags(description: string): string[] {
    // YouTube hashtags can be in description or as a separate property
    const hashtagRegex = /#[\w]+/g;
    const matches = description.match(hashtagRegex) || [];
    return matches.map(tag => tag.replace('#', ''));
  }

  private extractMentions(description: string): string[] {
    const mentionRegex = /@[\w.]+/g;
    const matches = description.match(mentionRegex) || [];
    return matches;
  }

  private parseDuration(duration: string | undefined): number | null {
    if (!duration) return null;

    // YouTube duration format: PT4M13S (4 minutes 13 seconds)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return null;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  private async getLastWeek(): string {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek.toISOString();
  }

  private async getLastWeekDate(): Promise<Date> {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek;
  }

  // Enhanced quota management
  protected async checkRateLimit(): Promise<boolean> {
    // Check if we've exceeded our daily quota
    const dailyQuotaKey = `youtube:daily_quota:${new Date().toISOString().split('T')[0]}`;
    const todayUsage = parseInt((await this.redis.get(dailyQuotaKey)) || '0');

    if (todayUsage >= this.dailyQuotaLimit) {
      this.logger.warn(`YouTube daily quota exceeded: ${todayUsage}/${this.dailyQuotaLimit}`);
      return false;
    }

    // Check per-minute rate limit
    const key = `ratelimit:${this.platformName}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }

    const isWithinLimit = current <= this.collectorConfig.rateLimit;

    // Update daily quota usage
    if (isWithinLimit) {
      await this.redis.incrby(dailyQuotaKey, this.quotaUsage);
      await this.redis.expire(dailyQuotaKey, 24 * 3600); // 24 hours
    }

    return isWithinLimit;
  }
}