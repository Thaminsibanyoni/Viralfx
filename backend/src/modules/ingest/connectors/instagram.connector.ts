import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { BaseConnector, Content, ContentMetrics, MediaUrl } from './base.connector';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class InstagramConnector extends BaseConnector {
  private readonly httpService: HttpService;
  private accessToken: string;
  private readonly appId: string;
  private readonly appSecret: string;
  private apiBaseUrl: string;

  constructor(
    @InjectRedis() redis: Redis,
    config: ConfigService,
    httpService: HttpService,
  ) {
    super(redis, config, 'instagram');
    this.httpService = httpService;
    this.accessToken = config.get<string>('INSTAGRAM_ACCESS_TOKEN') || '';
    this.appId = config.get<string>('INSTAGRAM_APP_ID') || '';
    this.appSecret = config.get<string>('INSTAGRAM_APP_SECRET') || '';
    this.apiBaseUrl = 'https://graph.facebook.com/v18.0';

    if (!this.accessToken) {
      this.logger.warn('Instagram connector not configured - missing access token');
    }
  }

  async connect(): Promise<void> {
    try {
      if (!this.accessToken) {
        throw new Error('Instagram access token is required');
      }

      // Test the connection with a simple request to get user info
      const response = await this.makeApiRequest('/me', {
        fields: 'id,username,account_type,media_count,followers_count,media_count'
      });

      if (response.id) {
        this.logger.log(`Instagram API connection established for user: ${response.username}`);
      }
    } catch (error) {
      this.logger.error('Failed to connect to Instagram API:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Clear sensitive data
    this.accessToken = '';
    this.logger.log('Instagram connector disconnected');
  }

  async collectContent(): Promise<Content[]> {
    try {
      // Check rate limits
      if (!await this.checkRateLimit()) {
        this.logger.warn('Instagram rate limit exceeded, skipping collection');
        return [];
      }

      const contents: Content[] = [];

      // Collect from hashtag searches
      const hashtagContents = await this.collectFromHashtags();
      contents.push(...hashtagContents);

      // Collect from location-based searches (if available)
      const locationContents = await this.collectFromLocations();
      contents.push(...locationContents);

      // Collect from user media (for accounts we have access to)
      const userContents = await this.collectFromUserMedia();
      contents.push(...userContents);

      // Store content
      if (contents.length > 0) {
        await this.storeContent(contents);
        await this.setLastCollectionTimestamp(new Date());
      }

      this.logger.log(`Collected ${contents.length} posts from Instagram`);
      return contents;

    } catch (error) {
      this.logger.error('Failed to collect Instagram content:', error);
      await this.addCollectionError(`Instagram collection failed: ${error.message}`);
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

  transformContent(rawPost: any): Content {
    // Extract hashtags from caption
    const hashtags = this.extractHashtags(rawPost.caption || '');
    const mentions = this.extractMentions(rawPost.caption || '');

    // Build media URLs
    const mediaUrls: MediaUrl[] = [];

    if (rawPost.media_type === 'CAROUSEL_ALBUM' && rawPost.children?.data) {
      // Handle carousel posts
      for (const media of rawPost.children.data) {
        mediaUrls.push(this.createMediaUrl(media));
      }
    } else {
      // Handle single media posts
      mediaUrls.push(this.createMediaUrl(rawPost));
    }

    // Build metrics
    const metrics: ContentMetrics = {
      likes: rawPost.like_count || 0,
      comments: rawPost.comments_count || 0,
      shares: 0, // Instagram doesn't provide share counts
      views: rawPost.media_type === 'VIDEO' ? (rawPost.play_count || 0) : 0, // Only for videos
      saves: rawPost.saved_count || 0,
    };

    // Calculate engagement
    const engagement = this.calculateEngagement(metrics);

    return {
      platform: 'INSTAGRAM',
      nativeId: rawPost.id,
      authorId: rawPost.owner?.id || '',
      authorHandle: rawPost.owner?.username || '',
      textContent: rawPost.caption || '',
      mediaUrls,
      metrics,
      hashtags,
      mentions,
      location: rawPost.location ? {
        name: rawPost.location.name,
        coordinates: null, // Instagram doesn't provide exact coordinates
      } : null,
      language: this.detectLanguage(rawPost.caption || ''),
      timestamp: new Date(parseInt(rawPost.timestamp) * 1000),
      engagement,
      metadata: {
        source: 'instagram-graph-api',
        mediaType: rawPost.media_type,
        isCommentEnabled: rawPost.comments_enabled,
        permalink: rawPost.permalink,
        thumbnailUrl: rawPost.thumbnail_url,
        igId: rawPost.ig_id,
      },
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

        // First, get hashtag ID
        const hashtagResponse = await this.makeApiRequest('/ig_hashtag_search', {
          user_id: await this.getUserId(),
          q: cleanHashtag,
        });

        if (!hashtagResponse.data?.length) {
          continue;
        }

        const hashtagId = hashtagResponse.data[0].id;

        // Get pagination cursor for this hashtag
        let after = await this.getPageToken(hashtagKey);
        let pageCount = 0;
        const maxPages = parseInt(this.config.get('INGEST_MAX_PAGES', '3'));

        // Paginate through hashtag media
        while (pageCount < maxPages) {
          // Get recent media for this hashtag
          const mediaResponse = await this.makeApiRequest(`/${hashtagId}/recent_media`, {
            user_id: await this.getUserId(),
            fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,play_count,saved_count,owner,location,children',
            limit: 25,
            after: after || undefined,
          });

          if (mediaResponse.data) {
            // Check for duplicates in Redis
            const postIds = mediaResponse.data.map((post: any) => post.id);
            const existingPostKeys = await Promise.all(
              postIds.map(id => this.redis.exists(`content:instagram:${id}`))
            );

            const newPosts = mediaResponse.data.filter((post: any, index: number) => {
              const isDuplicate = existingPostKeys[index] === 1;

              // Filter by watermark if available
              let isRecent = true;
              if (lastWatermark && post.timestamp) {
                const postTime = new Date(parseInt(post.timestamp) * 1000);
                const watermarkTime = new Date(lastWatermark);
                isRecent = postTime > watermarkTime;
              }

              return !isDuplicate && isRecent;
            });

            // Process new posts
            for (const post of newPosts) {
              try {
                const transformedContent = this.transformContent(post);

                if (this.validateContent(transformedContent) && this.matchesFilters(transformedContent)) {
                  contents.push(transformedContent);
                }
              } catch (error) {
                this.logger.warn(`Failed to transform Instagram post ${post.id}:`, error);
              }
            }
          }

          // Check for pagination
          if (mediaResponse.paging?.cursors?.after) {
            after = mediaResponse.paging.cursors.after;
            await this.setPageToken(after, hashtagKey);
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
      await this.setWatermark(latestTimestamp, 'instagram');
    }

    return contents;
  }

  private async collectFromLocations(): Promise<Content[]> {
    const contents: Content[] = [];

    // Focus on South African locations
    const saLocations = [
      'Cape Town, South Africa',
      'Johannesburg, South Africa',
      'Durban, South Africa',
      'Pretoria, South Africa',
      'Port Elizabeth, South Africa',
    ];

    for (const locationName of saLocations.slice(0, 3)) { // Limit to 3 locations
      try {
        // Search for location
        const locationResponse = await this.makeApiRequest('/ig_location_search', {
          user_id: await this.getUserId(),
          lat: 0, // Instagram location search requires lat/lng
          lng: 0,
          distance: 1000,
          q: locationName,
        });

        if (!locationResponse.data?.length) {
          continue;
        }

        const locationId = locationResponse.data[0].id;

        // Get recent media from this location
        const mediaResponse = await this.makeApiRequest(`/${locationId}/recent_media`, {
          user_id: await this.getUserId(),
          fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,play_count,saved_count,owner,location,children',
          limit: 20,
        });

        if (mediaResponse.data) {
          for (const post of mediaResponse.data) {
            try {
              const transformedContent = this.transformContent(post);

              if (this.validateContent(transformedContent) && this.matchesFilters(transformedContent)) {
                contents.push(transformedContent);
              }
            } catch (error) {
              this.logger.warn(`Failed to transform Instagram post ${post.id}:`, error);
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to collect from location ${locationName}:`, error);
      }
    }

    return contents;
  }

  private async collectFromUserMedia(): Promise<Content[]> {
    const contents: Content[] = [];

    try {
      // Get watermark for incremental collection
      const lastWatermark = await this.getWatermark('user_media');

      // Get pagination cursor for user media
      let after = await this.getPageToken('user_media');
      let pageCount = 0;
      const maxPages = parseInt(this.config.get('INGEST_MAX_PAGES', '3'));

      // Paginate through user media
      while (pageCount < maxPages) {
        // Get media from the authenticated user's account
        const mediaResponse = await this.makeApiRequest('/me/media', {
          fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,play_count,saved_count,owner,location,children',
          limit: 25,
          after: after || undefined,
        });

        if (mediaResponse.data) {
          // Check for duplicates in Redis
          const postIds = mediaResponse.data.map((post: any) => post.id);
          const existingPostKeys = await Promise.all(
            postIds.map(id => this.redis.exists(`content:instagram:${id}`))
          );

          const newPosts = mediaResponse.data.filter((post: any, index: number) => {
            const isDuplicate = existingPostKeys[index] === 1;

            // Filter by watermark if available
            let isRecent = true;
            if (lastWatermark && post.timestamp) {
              const postTime = new Date(parseInt(post.timestamp) * 1000);
              const watermarkTime = new Date(lastWatermark);
              isRecent = postTime > watermarkTime;
            }

            return !isDuplicate && isRecent;
          });

          // Process new posts
          for (const post of newPosts) {
            try {
              const transformedContent = this.transformContent(post);

              if (this.validateContent(transformedContent) && this.matchesFilters(transformedContent)) {
                contents.push(transformedContent);
              }
            } catch (error) {
              this.logger.warn(`Failed to transform Instagram post ${post.id}:`, error);
            }
          }
        }

        // Check for pagination
        if (mediaResponse.paging?.cursors?.after) {
          after = mediaResponse.paging.cursors.after;
          await this.setPageToken(after, 'user_media');
          pageCount++;
        } else {
          // No more pages, clear the token
          await this.setPageToken('', 'user_media');
          break;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to collect user media:', error);
      await this.addCollectionError(`User media collection failed: ${error.message}`);
    }

    // Update watermark to latest content timestamp
    if (contents.length > 0) {
      const latestTimestamp = contents[0].timestamp.toISOString();
      await this.setWatermark(latestTimestamp, 'user_media');
    }

    return contents;
  }

  private createMediaUrl(media: any): MediaUrl {
    const mediaType = media.media_type;

    let type: 'image' | 'video' | 'audio' | 'document' | 'link' | 'gif';
    switch (mediaType) {
      case 'IMAGE':
        type = 'image';
        break;
      case 'VIDEO':
        type = 'video';
        break;
      case 'CAROUSEL_ALBUM':
        type = 'image';
        break;
      default:
        type = 'image';
    }

    return {
      url: media.media_url || '',
      type,
      thumbnail: media.thumbnail_url,
      size: media.media_size,
    };
  }

  private async makeApiRequest(endpoint: string, params: any = {}): Promise<any> {
    try {
      const url = `${this.apiBaseUrl}${endpoint}`;
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            access_token: this.accessToken,
            ...params,
          },
        })
      );

      return response.data;
    } catch (error) {
      // Handle token expiration
      if (error.response?.status === 190) { // OAuth error for expired token
        this.logger.error('Instagram access token expired');
        throw new Error('Instagram access token expired and needs to be refreshed');
      }

      throw error;
    }
  }

  private async getUserId(): Promise<string> {
    try {
      const response = await this.makeApiRequest('/me', {
        fields: 'id'
      });
      return response.id;
    } catch (error) {
      this.logger.warn('Failed to get user ID, using fallback');
      return 'me'; // Instagram API accepts 'me' as user ID
    }
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex) || [];
    return matches.map(tag => tag.replace('#', ''));
  }

  private extractMentions(text: string): string[] {
    const mentionRegex = /@[\w.]+/g;
    const matches = text.match(mentionRegex) || [];
    return matches;
  }
}