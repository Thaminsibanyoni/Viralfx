import { Injectable, Logger } from '@nestjs/common';
import { SocialMediaPost, PlatformType } from '../interfaces/social-data-integration.interface';
import { TwitterConnector } from '../../ingest/connectors/twitter.connector';
import { TikTokConnector } from '../../ingest/connectors/tiktok.connector';
import { InstagramConnector } from '../../ingest/connectors/instagram.connector';
import { YouTubeConnector } from '../../ingest/connectors/youtube.connector';
import { FacebookConnector } from '../../ingest/connectors/facebook.connector';
import { Content } from '../../ingest/interfaces/ingest.interface';

/**
 * Real Social Data Service - Oracle Phase 2 (Real APIs)
 *
 * This service implements Phase 2 of the Oracle system using real platform connectors.
 * All mock data methods have been removed and replaced with actual data collection from
 * social media platform connectors.
 *
 * Phase 1 Status: ✅ DEPRECATED (Mock implementation removed)
 * Phase 2 Status: ✅ COMPLETE (Real API integration implemented)
 *
 * For Phase 2 implementation details, see SOCIAL_SENTIMENT_ORACLE_BLUEPRINT.md for detailed requirements.
 */
@Injectable()
export class RealSocialDataService {
  private readonly logger = new Logger(RealSocialDataService.name);

  constructor(
    private readonly twitterConnector: TwitterConnector,
    private readonly tiktokConnector: TikTokConnector,
    private readonly instagramConnector: InstagramConnector,
    private readonly youtubeConnector: YouTubeConnector,
    private readonly facebookConnector: FacebookConnector,
  ) {}

  async getTrendingTikTokVideos(limit: number = 50): Promise<SocialMediaPost[]> {
    this.logger.log(`📱 Fetching ${limit} trending TikTok videos`);

    try {
      const contents: Content[] = await this.tiktokConnector.collectContent();
      const mappedPosts = contents.slice(0, limit).map(content =>
        this.mapContentToSocialMediaPost(content, PlatformType.TIKTOK)
      );

      // Apply South African filters
      const saFilteredPosts = this.applySouthAfricanFilters(mappedPosts);
      this.logger.log(`Successfully collected ${saFilteredPosts.length} TikTok videos`);
      return saFilteredPosts;
    } catch (error) {
      this.logger.error('Failed to collect TikTok content:', error);
      throw error;
    }
  }

  async getTrendingTwitterTopics(limit: number = 100): Promise<SocialMediaPost[]> {
    this.logger.log(`🐦 Fetching ${limit} trending Twitter topics`);

    try {
      const contents: Content[] = await this.twitterConnector.collectContent();
      const mappedPosts = contents.slice(0, limit).map(content =>
        this.mapContentToSocialMediaPost(content, PlatformType.TWITTER)
      );

      // Apply South African filters
      const saFilteredPosts = this.applySouthAfricanFilters(mappedPosts);
      this.logger.log(`Successfully collected ${saFilteredPosts.length} Twitter topics`);
      return saFilteredPosts;
    } catch (error) {
      this.logger.error('Failed to collect Twitter content:', error);
      throw error;
    }
  }

  async getTrendingInstagramPosts(limit: number = 50): Promise<SocialMediaPost[]> {
    this.logger.log(`📷 Fetching ${limit} trending Instagram posts`);

    try {
      const contents: Content[] = await this.instagramConnector.collectContent();
      const mappedPosts = contents.slice(0, limit).map(content =>
        this.mapContentToSocialMediaPost(content, PlatformType.INSTAGRAM)
      );

      // Apply South African filters
      const saFilteredPosts = this.applySouthAfricanFilters(mappedPosts);
      this.logger.log(`Successfully collected ${saFilteredPosts.length} Instagram posts`);
      return saFilteredPosts;
    } catch (error) {
      this.logger.error('Failed to collect Instagram content:', error);
      throw error;
    }
  }

  async getTrendingYouTubeVideos(limit: number = 30): Promise<SocialMediaPost[]> {
    this.logger.log(`📺 Fetching ${limit} trending YouTube videos`);

    try {
      const contents: Content[] = await this.youtubeConnector.collectContent();
      const mappedPosts = contents.slice(0, limit).map(content =>
        this.mapContentToSocialMediaPost(content, PlatformType.YOUTUBE)
      );

      // Apply South African filters
      const saFilteredPosts = this.applySouthAfricanFilters(mappedPosts);
      this.logger.log(`Successfully collected ${saFilteredPosts.length} YouTube videos`);
      return saFilteredPosts;
    } catch (error) {
      this.logger.error('Failed to collect YouTube content:', error);
      throw error;
    }
  }

  async getTrendingFacebookPosts(limit: number = 50): Promise<SocialMediaPost[]> {
    this.logger.log(`📘 Fetching ${limit} trending Facebook posts`);

    try {
      const contents: Content[] = await this.facebookConnector.collectContent();
      const mappedPosts = contents.slice(0, limit).map(content =>
        this.mapContentToSocialMediaPost(content, PlatformType.FACEBOOK)
      );

      // Apply South African filters
      const saFilteredPosts = this.applySouthAfricanFilters(mappedPosts);
      this.logger.log(`Successfully collected ${saFilteredPosts.length} Facebook posts`);
      return saFilteredPosts;
    } catch (error) {
      this.logger.error('Failed to collect Facebook content:', error);
      throw error;
    }
  }

  // South African specific trend detection
  async getSouthAfricanTrends(): Promise<SocialMediaPost[]> {
    this.logger.log(`🇿🇦 Fetching South African specific trends`);

    try {
      // Collect content from all connectors
      const [
        tiktokContents,
        twitterContents,
        instagramContents,
        youtubeContents,
        facebookContents
      ] = await Promise.allSettled([
        this.tiktokConnector.collectContent(),
        this.twitterConnector.collectContent(),
        this.instagramConnector.collectContent(),
        this.youtubeConnector.collectContent(),
        this.facebookConnector.collectContent()
      ]);

      // Map all successfully collected content
      const allMappedPosts: SocialMediaPost[] = [];

      if (tiktokContents.status === 'fulfilled') {
        allMappedPosts.push(...tiktokContents.value.slice(0, 20).map(content =>
          this.mapContentToSocialMediaPost(content, PlatformType.TIKTOK)
        ));
      }

      if (twitterContents.status === 'fulfilled') {
        allMappedPosts.push(...twitterContents.value.slice(0, 30).map(content =>
          this.mapContentToSocialMediaPost(content, PlatformType.TWITTER)
        ));
      }

      if (instagramContents.status === 'fulfilled') {
        allMappedPosts.push(...instagramContents.value.slice(0, 20).map(content =>
          this.mapContentToSocialMediaPost(content, PlatformType.INSTAGRAM)
        ));
      }

      if (youtubeContents.status === 'fulfilled') {
        allMappedPosts.push(...youtubeContents.value.slice(0, 15).map(content =>
          this.mapContentToSocialMediaPost(content, PlatformType.YOUTUBE)
        ));
      }

      if (facebookContents.status === 'fulfilled') {
        allMappedPosts.push(...facebookContents.value.slice(0, 20).map(content =>
          this.mapContentToSocialMediaPost(content, PlatformType.FACEBOOK)
        ));
      }

      // Apply comprehensive South African filters
      const saFilteredPosts = this.applySouthAfricanFilters(allMappedPosts);

      // Log any collection failures
      const failedCollections = [];
      if (tiktokContents.status === 'rejected') failedCollections.push('TikTok');
      if (twitterContents.status === 'rejected') failedCollections.push('Twitter');
      if (instagramContents.status === 'rejected') failedCollections.push('Instagram');
      if (youtubeContents.status === 'rejected') failedCollections.push('YouTube');
      if (facebookContents.status === 'rejected') failedCollections.push('Facebook');

      if (failedCollections.length > 0) {
        this.logger.warn(`Failed to collect from: ${failedCollections.join(', ')}`);
      }

      this.logger.log(`Successfully collected ${saFilteredPosts.length} South African trends from ${allMappedPosts.length} total posts`);
      return saFilteredPosts;
    } catch (error) {
      this.logger.error('Failed to collect South African trends:', error);
      throw error;
    }
  }

  // Helper method to map Content to SocialMediaPost
  private mapContentToSocialMediaPost(content: Content, platformType: PlatformType): SocialMediaPost {
    return {
      id: `${platformType}-${content.nativeId}-${Date.now()}`,
      platform: platformType,
      platformPostId: content.nativeId,
      authorId: content.authorId,
      authorHandle: content.authorHandle || '',
      authorVerified: content.metadata?.verified || false,
      authorFollowers: 0, // Will be populated by connector metadata if available
      content: content.textContent,
      contentType: this.determineContentType(content),
      hashtags: content.hashtags || [],
      mentions: content.mentions || [],
      engagementCount: this.calculateTotalEngagement(content.metrics),
      likesCount: content.metrics.likes || 0,
      sharesCount: content.metrics.shares || 0,
      commentsCount: content.metrics.comments || 0,
      viewsCount: content.metrics.views,
      publishedAt: content.timestamp,
      collectedAt: new Date(),
      location: content.location?.name,
      language: content.language || 'en',
      isDeleted: false,
      mediaUrls: content.mediaUrls?.map(media => media.url) || []
    };
  }

  // Helper method to determine content type
  private determineContentType(content: Content): 'text' | 'image' | 'video' | 'link' {
    if (content.mediaUrls && content.mediaUrls.length > 0) {
      const hasVideo = content.mediaUrls.some(media => media.type === 'video');
      const hasImage = content.mediaUrls.some(media => media.type === 'image');
      if (hasVideo) return 'video';
      if (hasImage) return 'image';
    }
    return 'text';
  }

  // Helper method to calculate total engagement
  private calculateTotalEngagement(metrics: any): number {
    return (
      (metrics.likes || 0) +
      (metrics.shares || 0) +
      (metrics.comments || 0) +
      (metrics.saves || 0) +
      (metrics.clicks || 0)
    );
  }

  // Helper method to apply South African filters
  private applySouthAfricanFilters(posts: SocialMediaPost[]): SocialMediaPost[] {
    return posts.filter(post =>
      this.isSouthAfricanContent(post) || this.isSouthAfricanHashtag(post.hashtags)
    );
  }

  // Helper method to detect South African content
  private isSouthAfricanContent(post: SocialMediaPost): boolean {
    const content = post.content.toLowerCase();
    const location = post.location?.toLowerCase() || '';
    const language = post.language || '';

    // Check content for South African keywords
    const saKeywords = [
      'south africa', 'southafrica', 'mzansi', 'sa', 'za',
      'johannesburg', 'joburg', 'cape town', 'capetown', 'durban',
      'pretoria', 'soweto', 'sandton', 'nelson mandela', 'anc',
      'da', 'eff', 'boks', 'springboks', 'proteas'
    ];

    const hasSAContent = saKeywords.some(keyword => content.includes(keyword));
    const hasSALocation = location.includes('south africa') || location.includes('za');
    const isSALanguage = ['en', 'af', 'zu', 'xh', 'nr', 'st', 'ts', 'ss', 'tn', 've'].includes(language);

    return hasSAContent || hasSALocation || isSALanguage;
  }

  // Helper method to detect South African hashtags
  private isSouthAfricanHashtag(hashtags: string[]): boolean {
    const saHashtags = [
      '#southafrica', '#southafrican', '#sacreatives', '#zalebs', '#sa', '#za',
      '#joburg', '#capetown', '#durban', '#pretoria', '#soweto',
      '#viralza', '#mzansitwitter', '#sainfluencer', '#mzansi',
      '#southafricanmusic', '#safashion', '#safoodie', '#madeinsa',
      '#saftech', '#satourism', '#sabusiness', '#sastartups',
      '#springboks', '#proteas', '#bokke', '#amabokoboko'
    ];

    return hashtags.some(tag =>
      saHashtags.some(saTag => tag.toLowerCase().includes(saTag.toLowerCase()))
    );
  }
}