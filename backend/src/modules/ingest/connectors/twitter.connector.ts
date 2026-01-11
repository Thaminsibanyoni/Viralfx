import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { TwitterApi } from 'twitter-api-v2';
import { BaseConnector, Content, ContentMetrics, MediaUrl } from "./base.connector";

@Injectable()
export class TwitterConnector extends BaseConnector {
  private twitterClient: TwitterApi;

  constructor(
    @InjectRedis() redis: Redis,
    config: ConfigService) {
    super(redis, config, 'twitter');
    this.initializeClient();
  }

  private initializeClient(): void {
    const bearerToken = this.config.get<string>('TWITTER_BEARER_TOKEN');
    if (!bearerToken) {
      throw new Error('TWITTER_BEARER_TOKEN is required for Twitter connector');
    }

    this.twitterClient = new TwitterApi(bearerToken);
  }

  async connect(): Promise<void> {
    try {
      // Test the connection with a small search request
      const searchResponse = await this.twitterClient.v2.search('SA OR South Africa -is:retweet', {
        max_results: 10
      });

      if (searchResponse.data?.data || searchResponse.meta) {
        const rateLimit = searchResponse.meta?.result_count || 0;
        this.logger.log(`Twitter API connection established successfully (${rateLimit} results in test)`);
      }
    } catch (error) {
      this.logger.error('Failed to connect to Twitter API:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // No explicit disconnect needed for Twitter API v2 with bearer token
    this.logger.log('Twitter connector disconnected');
  }

  async collectContent(): Promise<Content[]> {
    try {
      // Check rate limits
      if (!await this.checkRateLimit()) {
        this.logger.warn('Twitter rate limit exceeded, skipping collection');
        return [];
      }

      const lastCollection = await this.getLastCollectionTimestamp();
      const now = new Date();

      // Build search query with SA-relevant keywords
      const searchQuery = this.buildSearchQuery();

      // Search for recent tweets
      const searchResponse = await this.twitterClient.v2.search(searchQuery, {
        max_results: 100,
        'tweet.fields': [
          'public_metrics',
          'created_at',
          'author_id',
          'entities',
          'geo',
          'lang',
          'context_annotations'
        ],
        'user.fields': ['username', 'location', 'verified'],
        'media.fields': ['url', 'type', 'preview_image_url', 'duration_ms', 'variants'],
        'place.fields': ['country', 'country_code', 'full_name'],
        expansions: ['author_id', 'attachments.media_keys', 'geo.place_id'],
        ...(lastCollection && { since_id: await this.getSinceId() })
      });

      if (!searchResponse.data?.data) {
        this.logger.debug('No tweets found in search response');
        return [];
      }

      const tweets = searchResponse.data.data;
      const users = searchResponse.data.includes?.users || [];
      const media = searchResponse.data.includes?.media || [];
      const places = searchResponse.data.includes?.places || [];

      // Transform tweets to Content objects with sentiment-aware prioritization
      const contents: Content[] = [];

      for (const tweet of tweets) {
        try {
          const transformedContent = this.transformContent(tweet, users, media, places);

          if (this.validateContent(transformedContent) && this.matchesFilters(transformedContent)) {
            contents.push(transformedContent);
          }
        } catch (error) {
          this.logger.warn(`Failed to transform tweet ${tweet.id}:`, error);
        }
      }

      // Process content batch with sentiment-aware prioritization
      if (contents.length > 0) {
        const { highPriority, normalPriority } = await this.processContentBatch(contents);

        // Store high-priority content first
        if (highPriority.length > 0) {
          await this.storeContent(highPriority);
          this.logger.log(`Prioritized ${highPriority.length} high-impact tweets for immediate processing`);
        }

        // Store normal priority content
        if (normalPriority.length > 0) {
          await this.storeContent(normalPriority);
        }

        await this.setLastCollectionTimestamp(now);
        await this.updateSinceId(tweets[0].id); // Store the most recent tweet ID

        this.logger.log(`Collected ${contents.length} tweets (${highPriority.length} high-priority, ${normalPriority.length} normal)`);
      }

      this.logger.log(`Collected ${contents.length} tweets from Twitter`);
      return contents;

    } catch (error) {
      this.logger.error('Failed to collect Twitter content:', error);
      await this.addCollectionError(`Twitter collection failed: ${error.message}`);
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

  transformContent(tweet: any, users: any[], media: any[], places: any[]): Content {
    // Find the author
    const author = users.find(u => u.id === tweet.author_id);
    const authorHandle = author?.username || '';
    const authorLocation = author?.location || '';

    // Find media attachments
    const mediaUrls: MediaUrl[] = [];
    if (tweet.attachments?.media_keys) {
      for (const mediaKey of tweet.attachments.media_keys) {
        const mediaItem = media.find(m => m.media_key === mediaKey);
        if (mediaItem) {
          let mediaUrl = '';

          // Handle different media types for proper URL extraction
          if (mediaItem.type === 'photo') {
            mediaUrl = mediaItem.url || '';
          } else if (mediaItem.type === 'video' || mediaItem.type === 'animated_gif') {
            // For videos and GIFs, we need to extract URL from variants
            if (mediaItem.variants && mediaItem.variants.length > 0) {
              // Select best variant: highest bitrate MP4 for videos, smallest for GIFs
              let selectedVariant;
              if (mediaItem.type === 'video') {
                // For videos, select the variant with highest bitrate and MP4 content type
                selectedVariant = mediaItem.variants
                  .filter(v => v.content_type === 'video/mp4')
                  .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
              } else {
                // For animated GIFs, select the smallest file
                selectedVariant = mediaItem.variants
                  .filter(v => v.content_type === 'video/mp4')
                  .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0];
              }

              mediaUrl = selectedVariant?.url || '';

              if (!mediaUrl) {
                this.logger.warn(`No suitable video variant found for media_key: ${mediaKey}`);
              }
            } else {
              this.logger.warn(`No variants available for video media_key: ${mediaKey}`);
            }
          }

          mediaUrls.push({
            url: mediaUrl,
            type: this.mapMediaType(mediaItem.type),
            thumbnail: mediaItem.preview_image_url,
            duration: mediaItem.duration_ms
          });
        }
      }
    }

    // Extract hashtags and mentions
    const hashtags = this.extractHashtags(tweet.entities?.hashtags);
    const mentions = this.extractMentions(tweet.entities?.mentions);

    // Find location
    let location = null;
    if (tweet.geo?.place_id) {
      const place = places.find(p => p.id === tweet.geo.place_id);
      if (place) {
        location = {
          name: place.full_name,
          coordinates: null // Twitter doesn't provide exact coordinates
        };
      }
    } else if (authorLocation) {
      location = {
        name: authorLocation,
        coordinates: null
      };
    }

    // Build metrics - standardized to 0 for all optional fields to prevent NaN
    const metrics: ContentMetrics = {
      likes: tweet.public_metrics?.like_count || 0,
      shares: tweet.public_metrics?.retweet_count || 0,
      comments: tweet.public_metrics?.reply_count || 0,
      views: tweet.public_metrics?.impression_count || 0 // Changed from undefined to 0
    };

    // Calculate engagement
    const engagement = this.calculateEngagement(metrics);

    return {
      platform: 'TWITTER',
      nativeId: tweet.id,
      authorId: tweet.author_id,
      authorHandle: `@${authorHandle}`,
      textContent: tweet.text,
      mediaUrls,
      metrics,
      hashtags,
      mentions,
      location,
      language: tweet.lang || 'en',
      timestamp: new Date(tweet.created_at),
      engagement,
      metadata: {
        source: 'twitter-api-v2',
        verified: author?.verified || false,
        contextAnnotations: tweet.context_annotations,
        possiblySensitive: tweet.possibly_sensitive,
        replySettings: tweet.reply_settings
      }
    };
  }

  private buildSearchQuery(): string {
    const keywords = this.collectorConfig.keywords;
    const hashtags = this.collectorConfig.hashtags;
    const languages = this.collectorConfig.languages;

    let queryParts: string[] = [];

    // Add keywords with OR operator
    if (keywords.length > 0) {
      queryParts.push(`(${keywords.map(k => `"${k}"`).join(' OR ')})`);
    }

    // Add hashtags with OR operator
    if (hashtags.length > 0) {
      const hashtagTerms = hashtags.map(tag => {
        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
        return `#${cleanTag}`;
      });
      queryParts.push(`(${hashtagTerms.join(' OR ')})`);
    }

    // Combine keywords and hashtags with OR
    let query = queryParts.join(' OR ');

    // Exclude retweets to get original content
    query += ' -is:retweet';

    // Filter by language
    if (languages.length > 0) {
      query += ` lang:${languages.join(' OR lang:')}`;
    }

    // Filter for recent content (last 24 hours)
    query += ' -is:nullcast';

    return query;
  }

  private mapMediaType(twitterType: string): 'image' | 'video' | 'audio' | 'document' | 'link' | 'gif' {
    switch (twitterType) {
      case 'photo':
        return 'image';
      case 'video':
        return 'video';
      case 'animated_gif':
        return 'gif';
      default:
        return 'link';
    }
  }

  private extractHashtags(hashtagEntities: any[]): string[] {
    if (!hashtagEntities) return [];
    return hashtagEntities.map(tag => tag.tag);
  }

  private extractMentions(mentionEntities: any[]): string[] {
    if (!mentionEntities) return [];
    return mentionEntities.map(mention => `@${mention.username}`);
  }

  private async getSinceId(): Promise<string | null> {
    return await this.redis.get(`twitter:since_id`);
  }

  private async updateSinceId(tweetId: string): Promise<void> {
    await this.redis.set(`twitter:since_id`, tweetId);
  }
}
