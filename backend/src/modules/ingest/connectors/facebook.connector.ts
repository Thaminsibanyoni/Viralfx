import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { BaseConnector, Content, ContentMetrics, MediaUrl } from './base.connector';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class FacebookConnector extends BaseConnector {
  private readonly httpService: HttpService;
  private accessToken: string;
  private readonly appId: string;
  private readonly appSecret: string;
  private apiBaseUrl: string;
  private pageTokens: Record<string, string>;

  // Hardcoded South African news page IDs to avoid deprecated search endpoint
  private readonly SA_PAGE_IDS = {
    'News24': '105475029474',
    'SABC News': '215258401599491',
    'eNCA': '148720041839716',
    'TimesLIVE': '153686901330264',
    'IOL News': '126819974030938',
    'Cape Times': '126914817399361',
    'Mail & Guardian': '192629990771719',
    'Sunday Times': '1108756489263045',
    'Carte Blanche': '128076243896647',
    'Power 987': '197666996923460',
  };

  constructor(
    @InjectRedis() redis: Redis,
    config: ConfigService,
    httpService: HttpService,
  ) {
    super(redis, config, 'facebook');
    this.httpService = httpService;
    this.accessToken = config.get<string>('FACEBOOK_ACCESS_TOKEN') || '';
    this.appId = config.get<string>('FACEBOOK_APP_ID') || '';
    this.appSecret = config.get<string>('FACEBOOK_APP_SECRET') || '';
    this.apiBaseUrl = 'https://graph.facebook.com/v18.0';

    // Load page-specific tokens from environment
    this.pageTokens = {
      'News24': config.get<string>('NEWS24_PAGE_TOKEN') || '',
      'SABC News': config.get<string>('SABC_NEWS_PAGE_TOKEN') || '',
      'eNCA': config.get<string>('ENCA_PAGE_TOKEN') || '',
      'TimesLIVE': config.get<string>('TIMESLIVE_PAGE_TOKEN') || '',
      'IOL News': config.get<string>('IOL_NEWS_PAGE_TOKEN') || '',
      'Cape Times': config.get<string>('CAPE_TIMES_PAGE_TOKEN') || '',
      'Mail & Guardian': config.get<string>('MAIL_AND_GUARDIAN_PAGE_TOKEN') || '',
      'Sunday Times': config.get<string>('SUNDAY_TIMES_PAGE_TOKEN') || '',
      'Carte Blanche': config.get<string>('CARTE_BLANCHE_PAGE_TOKEN') || '',
      'Power 987': config.get<string>('POWER_987_PAGE_TOKEN') || '',
    };

    if (!this.accessToken && !(this.appId && this.appSecret)) {
      this.logger.warn('Facebook connector not configured - missing access token and API credentials');
    }
  }

  async connect(): Promise<void> {
    try {
      if (!this.accessToken) {
        // Try to get an app token if no user token is available
        await this.getAppToken();
      }

      // Validate each hardcoded page ID and token
      const validationPromises = Object.entries(this.SA_PAGE_IDS).map(async ([pageName, pageId]) => {
        try {
          const token = this.getPageToken(pageName);
          if (token) {
            const response = await this.makeApiRequest(`/${pageId}`, {
              fields: 'id,name',
              access_token: token,
            });
            if (response.id) {
              // Cache valid pages in Redis with TTL (7 days)
              await this.redis.setex(`facebook:validated_page:${pageId}`, 7 * 24 * 3600, 'true');
              this.logger.log(`Validated Facebook page: ${pageName} (${response.name || response.id})`);
            }
          } else {
            this.logger.warn(`No page token available for ${pageName}, will use app token`);
          }
        } catch (error) {
          this.logger.warn(`Failed to validate page ${pageName}: ${error.message}`);
          // Don't throw here, continue with other pages
        }
      });

      await Promise.allSettled(validationPromises);
      this.logger.log(`Facebook API connection established with ${Object.keys(this.SA_PAGE_IDS).length} SA pages configured`);
    } catch (error) {
      this.logger.error('Failed to connect to Facebook API:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Clear sensitive data
    this.accessToken = '';
    this.logger.log('Facebook connector disconnected');
  }

  async collectContent(): Promise<Content[]> {
    try {
      // Check rate limits
      if (!await this.checkRateLimit()) {
        this.logger.warn('Facebook rate limit exceeded, skipping collection');
        return [];
      }

      const contents: Content[] = [];

      // Collect from public pages (using page access tokens)
      const pageContents = await this.collectFromPages();
      contents.push(...pageContents);

      // Collect from public groups (limited availability)
      const groupContents = await this.collectFromGroups();
      contents.push(...groupContents);

      // Collect from hashtag search (limited availability)
      const hashtagContents = await this.collectFromHashtags();
      contents.push(...hashtagContents);

      // Store content
      if (contents.length > 0) {
        await this.storeContent(contents);
        await this.setLastCollectionTimestamp(new Date());
      }

      this.logger.log(`Collected ${contents.length} posts from Facebook`);
      return contents;

    } catch (error) {
      this.logger.error('Failed to collect Facebook content:', error);
      await this.addCollectionError(`Facebook collection failed: ${error.message}`);
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
    // Extract hashtags and mentions from message
    const hashtags = this.extractHashtags(rawPost.message || '');
    const mentions = this.extractMentions(rawPost.message || '');

    // Build media URLs
    const mediaUrls: MediaUrl[] = [];

    // Handle photos
    if (rawPost.attachments?.data) {
      for (const attachment of rawPost.attachments.data) {
        if (attachment.type === 'photo') {
          mediaUrls.push({
            url: attachment.media?.image?.src || attachment.url,
            type: 'image',
            size: attachment.media?.image?.height * attachment.media?.image?.width,
          });
        } else if (attachment.type === 'video') {
          mediaUrls.push({
            url: attachment.source || attachment.url,
            type: 'video',
            thumbnail: attachment.picture,
          });
        } else if (attachment.type === 'album') {
          // Handle photo albums
          if (attachment.subattachments?.data) {
            for (const subAttachment of attachment.subattachments.data) {
              if (subAttachment.type === 'photo') {
                mediaUrls.push({
                  url: subAttachment.media?.image?.src || subAttachment.url,
                  type: 'image',
                  size: subAttachment.media?.image?.height * subAttachment.media?.image?.width,
                });
              }
            }
          }
        }
      }
    }

    // Build metrics
    const metrics: ContentMetrics = {
      likes: 0,
      shares: rawPost.shares?.count || 0,
      comments: 0,
      views: 0, // Facebook doesn't provide view counts for regular posts
    };

    // Handle reactions properly - reactions.data is an array of reaction objects
    if (rawPost.reactions?.data) {
      metrics.reactions = {};
      let totalLikes = 0;
      for (const reaction of rawPost.reactions.data) {
        const reactionType = reaction.type.toLowerCase();
        metrics.reactions[reactionType] = reaction.total_count || 0;
        totalLikes += reaction.total_count || 0;
      }
      metrics.likes = totalLikes;
    } else if (rawPost.reactions?.summary?.total_count) {
      // Fallback for older API response format
      metrics.likes = rawPost.reactions.summary.total_count;
    }

    // Handle comments summary
    if (rawPost.comments?.summary?.total_count) {
      metrics.comments = rawPost.comments.summary.total_count;
    }

    // Calculate engagement
    const engagement = this.calculateEngagement(metrics);

    return {
      platform: 'FACEBOOK',
      nativeId: rawPost.id,
      authorId: rawPost.from?.id || '',
      authorHandle: rawPost.from?.name || '',
      textContent: rawPost.message || rawPost.story || '',
      mediaUrls,
      metrics,
      hashtags,
      mentions,
      location: rawPost.place ? {
        name: rawPost.place.name,
        coordinates: rawPost.place.location ? {
          latitude: rawPost.place.location.latitude,
          longitude: rawPost.place.location.longitude,
        } : null,
      } : null,
      language: this.detectLanguage(rawPost.message || rawPost.story || ''),
      timestamp: new Date(rawPost.created_time),
      engagement,
      metadata: {
        source: 'facebook-graph-api',
        type: rawPost.type,
        statusType: rawPost.status_type,
        permalinkUrl: rawPost.permalink_url,
        isHidden: rawPost.is_hidden,
        isExpired: rawPost.is_expired,
        storyTags: rawPost.story_tags,
        messageTags: rawPost.message_tags,
        withTags: rawPost.with_tags,
        target: rawPost.target,
        object: rawPost.object,
      },
    };
  }

  private async collectFromPages(): Promise<Content[]> {
    const contents: Content[] = [];

    for (const [pageName, pageId] of Object.entries(this.SA_PAGE_IDS)) {
      try {
        // Check if page is validated in cache
        const isValid = await this.redis.get(`facebook:validated_page:${pageId}`);
        if (isValid === null) {
          this.logger.debug(`Skipping page ${pageName}: not validated or expired`);
          continue;
        }

        // Get watermark for incremental collection
        const watermark = await this.getWatermark(`page:${pageName}`);

        // Get page-specific cursor for pagination
        let after = await this.getPageToken(`page:${pageName}`);

        // Fetch posts with pagination
        const postsResponse = await this.fetchPagePosts(pageId, this.getPageToken(pageName), watermark, after);

        // Update watermark if we got content
        if (postsResponse.contents.length > 0) {
          const latestTimestamp = postsResponse.contents[0].timestamp.toISOString();
          await this.setWatermark(latestTimestamp, `page:${pageName}`);
        }

        // Update pagination cursor
        if (postsResponse.nextCursor) {
          await this.setPageToken(postsResponse.nextCursor, `page:${pageName}`);
        }

        // Transform and validate content
        for (const post of postsResponse.contents) {
          try {
            const transformedContent = this.transformContent(post);

            if (this.validateContent(transformedContent) && this.matchesFilters(transformedContent)) {
              contents.push(transformedContent);
            }
          } catch (error) {
            this.logger.warn(`Failed to transform Facebook post ${post.id}:`, error);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to collect from page ${pageName}:`, error);
        await this.addCollectionError(`Page collection failed for ${pageName}: ${error.message}`);
      }
    }

    return contents;
  }

  private async fetchPagePosts(
    pageId: string,
    token: string,
    since?: string,
    after?: string
  ): Promise<{ contents: any[]; nextCursor?: string }> {
    const contents: any[] = [];

    const params: any = {
      fields: 'id,message,story,created_time,from,attachments,reactions.summary(true),comments.summary(true),shares,place,type,status_type,permalink_url,is_hidden,is_expired,story_tags,message_tags,with_tags,target,object',
      limit: 25,
      access_token: token,
    };

    if (since) {
      params.since = since;
    }

    if (after) {
      params.after = after;
    }

    const response = await this.makeApiRequest(`/${pageId}/posts`, params);

    if (response.data) {
      contents.push(...response.data);
    }

    // Extract pagination cursor
    let nextCursor;
    if (response.paging?.cursors?.after) {
      nextCursor = response.paging.cursors.after;
    }

    return { contents, nextCursor };
  }

  private getPageToken(pageName: string): string {
    return this.pageTokens[pageName] || this.accessToken;
  }

  private async collectFromGroups(): Promise<Content[]> {
    // Note: Group access requires specific permissions and user tokens
    // This is a placeholder implementation
    const contents: Content[] = [];

    try {
      // This would require group access tokens which are harder to obtain
      // For now, return empty array
      this.logger.debug('Facebook group collection not implemented due to API limitations');
    } catch (error) {
      this.logger.warn('Failed to collect from Facebook groups:', error);
    }

    return contents;
  }

  private async collectFromHashtags(): Promise<Content[]> {
    // Note: Hashtag search has limited availability in Facebook Graph API
    const contents: Content[] = [];

    try {
      for (const hashtag of this.collectorConfig.hashtags.slice(0, 3)) { // Limit to 3 hashtags
        const cleanHashtag = hashtag.replace('#', '');

        // Search for hashtag (limited availability)
        const hashtagResponse = await this.makeApiRequest(`/ig_hashtag_search`, {
          user_id: 'me', // This requires Instagram Business account
          q: cleanHashtag,
        });

        // Facebook hashtag search is limited and requires specific permissions
        this.logger.debug(`Facebook hashtag search for ${cleanHashtag} limited by API restrictions`);
      }
    } catch (error) {
      this.logger.warn('Facebook hashtag search not available:', error);
    }

    return contents;
  }

  private async makeApiRequest(endpoint: string, params: any = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No Facebook access token available');
    }

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
      if (error.response?.data?.error?.code === 190) {
        this.logger.error('Facebook access token expired');
        await this.getAppToken(); // Try to get new app token
        // Retry once with new token
        const url = `${this.apiBaseUrl}${endpoint}`;
        const retryResponse = await firstValueFrom(
          this.httpService.get(url, {
            params: {
              access_token: this.accessToken,
              ...params,
            },
          })
        );

        return retryResponse.data;
      }

      throw error;
    }
  }

  private async getAppToken(): Promise<void> {
    if (!this.appId || !this.appSecret) {
      throw new Error('Cannot get Facebook app token: missing app credentials');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiBaseUrl}/oauth/access_token`, {
          params: {
            client_id: this.appId,
            client_secret: this.appSecret,
            grant_type: 'client_credentials',
          },
        })
      );

      this.accessToken = response.data.access_token;
      this.logger.log('Facebook app token obtained successfully');
    } catch (error) {
      this.logger.error('Failed to get Facebook app token:', error);
      throw error;
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

  private async getLastWeek(): string {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek.toISOString();
  }
}