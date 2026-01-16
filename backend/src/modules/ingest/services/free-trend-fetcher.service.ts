import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import * as parser from 'xml2js';

/**
 * Free Trend Fetcher Service
 *
 * Sources:
 * 1. Google Trends RSS (100% Free, No API Key)
 * 2. NewsAPI.org (Free Tier: 100 requests/day)
 * 3. Reddit API (100% Free for public data)
 * 4. YouTube Data API v3 (Free: 10,000 units/day)
 * 5. Twitter/X API v2 (Free: 500K tweets/month)
 *
 * Expected Output: 40-65 trends per day
 */

interface TrendSource {
  name: string;
  volume?: string;
  source: string;
  category: string;
  url?: string;
  publishedAt?: Date;
  metadata?: Record<string, any>;
}

interface FreeTrend extends TrendSource {
  region: string;
  isActive: boolean;
  requiresApproval: boolean;
  vpmxScore: number;
  engagementScore: number;
}

@Injectable()
export class FreeTrendFetcherService implements OnModuleInit {
  private readonly logger = new Logger(FreeTrendFetcherService.name);

  // Configuration
  private readonly NEWS_API_KEY: string;
  private readonly YOUTUBE_API_KEY: string;
  private readonly TWITTER_BEARER_TOKEN: string;
  private readonly NEWSDATA_API_KEY: string;

  // Offensive content filter
  private readonly offensiveWords = [
    // Profanity (basic list - expand as needed)
    'fuck', 'shit', 'bitch', 'whore', 'slut',
    // Hate speech indicators
    'kill all', 'death to', 'hate speech', 'racist',
    // Spam indicators
    'buy now', 'click here', 'free money', 'bitcoin scam'
  ];

  // Category keywords for auto-categorization
  private readonly categoryKeywords = {
    POLITICS: ['election', 'president', 'minister', 'anc', 'da', 'eff', 'parliament', 'government', 'vote'],
    SPORTS: ['bafana', 'springboks', 'psl', 'chiefs', 'pirates', 'rugby', 'cricket', 'soccer', 'football', 'tennis'],
    ENTERTAINMENT: ['bbmzansi', 'skeem', 'uzalo', 'actor', 'actress', 'movie', 'music', 'celebrity', 'netflix', 'showmax'],
    CRYPTO: ['bitcoin', 'crypto', 'ethereum', 'wallet', 'nft', 'blockchain', 'defi', 'altcoin'],
    ECONOMY: ['loadshedding', 'eskom', 'tax', 'rand', 'fuel price', 'inflation', 'interest rate', 'recession'],
    TECHNOLOGY: ['ai', 'tech', 'startup', 'app', 'software', 'machine learning', 'robot'],
    HEALTH: ['covid', 'vaccine', 'health', 'disease', 'hospital', 'doctor'],
    EDUCATION: ['school', 'university', 'matric', 'student', 'education', 'exam']
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.NEWS_API_KEY = this.configService.get('NEWS_API_KEY', '');
    this.YOUTUBE_API_KEY = this.configService.get('YOUTUBE_API_KEY', '');
    this.TWITTER_BEARER_TOKEN = this.configService.get('TWITTER_BEARER_TOKEN', '');
    this.NEWSDATA_API_KEY = this.configService.get('NEWSDATA_API_KEY', '');
  }

  async onModuleInit() {
    this.logger.log('🔄 Free Trend Fetcher Service initialized');
    this.logger.log('📊 Ready to fetch from 6 free sources:');
    this.logger.log('   1. Google Trends RSS (No API key needed)');
    this.logger.log('   2. Reddit API (100% free)');
    this.logger.log(`   3. NewsData.io (${this.NEWSDATA_API_KEY ? 'Configured' : 'Not configured'}) - 200K requests/day FREE`);
    this.logger.log(`   4. NewsAPI.org (${this.NEWS_API_KEY ? 'Configured' : 'Not configured'})`);
    this.logger.log(`   5. YouTube API (${this.YOUTUBE_API_KEY ? 'Configured' : 'Not configured'})`);
    this.logger.log(`   6. Twitter API (${this.TWITTER_BEARER_TOKEN ? 'Configured' : 'Not configured'})`);
  }

  /**
   * Main cron job - Fetch trends every hour
   * Runs at minute 0 of every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async fetchTrendsHourly() {
    this.logger.log(`🌐 Starting hourly trend fetch [${new Date().toISOString()}]`);

    try {
      const allTrends: FreeTrend[] = [];

      // Fetch from all sources
      const sources = [
        { name: 'Google Trends', func: () => this.fetchGoogleTrends() },
        { name: 'Reddit', func: () => this.fetchRedditTrends() },
        { name: 'NewsData.io', func: () => this.fetchNewsDataTrends() },
        { name: 'NewsAPI', func: () => this.fetchNewsAPITrends() },
        { name: 'YouTube', func: () => this.fetchYouTubeTrends() },
        { name: 'Twitter', func: () => this.fetchTwitterTrends() },
      ];

      for (const source of sources) {
        try {
          this.logger.log(`📡 Fetching from ${source.name}...`);
          const trends = await source.func();
          allTrends.push(...trends);
          this.logger.log(`✅ ${source.name}: ${trends.length} trends fetched`);

          // Be nice to free APIs - rate limiting
          await this.sleep(2000);
        } catch (error) {
          this.logger.warn(`⚠️  ${source.name} failed: ${error.message}`);
        }
      }

      // Process and deduplicate trends
      const uniqueTrends = this.deduplicateTrends(allTrends);
      this.logger.log(`📊 Total unique trends: ${uniqueTrends.length}`);

      // Filter offensive content
      const filteredTrends = this.filterOffensiveContent(uniqueTrends);
      this.logger.log(`✅ After content filter: ${filteredTrends.length} trends`);

      // Save to database (pending approval)
      const savedTrends = await this.saveTrendsToDatabase(filteredTrends);
      this.logger.log(`💾 Saved ${savedTrends} trends to database (pending approval)`);

      this.logger.log('✅ Hourly trend fetch completed successfully');
    } catch (error) {
      this.logger.error('❌ Hourly trend fetch failed:', error);
    }
  }

  /**
   * Fetch from Google Trends RSS (South Africa)
   * No API key required - 100% free
   */
  private async fetchGoogleTrends(): Promise<FreeTrend[]> {
    try {
      const rssUrl = 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=ZA';

      const response = await axios.get(rssUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'ViralFX/1.0' }
      });

      const result = await parser.parseStringPromise(response.data);
      const items = result.rss?.channel?.[0]?.item || [];

      const trends: FreeTrend[] = items.slice(0, 20).map((item: any) => {
        const name = item.title?.[0] || '';
        const volume = item['ht:approx_traffic']?.[0] || '1K+';

        return {
          name: this.cleanTrendName(name),
          volume,
          source: 'google_trends',
          category: this.categorizeTrend(name),
          region: 'ZA',
          isActive: false, // Requires approval
          requiresApproval: true,
          vpmxScore: this.calculateVPMXScore(volume),
          engagementScore: this.calculateEngagementScore(volume),
          publishedAt: item.pubDate?.[0] ? new Date(item.pubDate[0]) : new Date(),
          metadata: { traffic: volume, source: 'google_trends_rss' }
        };
      });

      return trends;
    } catch (error) {
      this.logger.error('Google Trends fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Fetch from Reddit API (100% free for public data)
   * No API key required
   */
  private async fetchRedditTrends(): Promise<FreeTrend[]> {
    try {
      const subreddits = ['southafrica', 'Africa', 'worldnews', 'technology'];
      const trends: FreeTrend[] = [];

      for (const sub of subreddits) {
        try {
          const url = `https://www.reddit.com/r/${sub}/hot.json?limit=10`;
          const response = await axios.get(url, {
            headers: { 'User-Agent': 'ViralFX/1.0' },
            timeout: 10000
          });

          const posts = response.data.data?.children || [];

          for (const post of posts.slice(0, 5)) {
            const data = post.data;
            const title = data.title || '';
            const upvotes = data.ups || 0;
            const comments = data.num_comments || 0;

            trends.push({
              name: this.cleanTrendName(title.substring(0, 100)),
              source: `reddit_${sub}`,
              category: this.categorizeTrend(title),
              url: `https://reddit.com${data.permalink}`,
              region: 'ZA',
              isActive: false,
              requiresApproval: true,
              vpmxScore: this.calculateRedditVPMX(upvotes, comments),
              engagementScore: this.calculateRedditEngagement(upvotes, comments),
              publishedAt: new Date(data.created_utc * 1000),
              metadata: {
                upvotes,
                comments,
                subreddit: sub,
                source: 'reddit_api'
              }
            });
          }

          await this.sleep(1000); // Rate limiting
        } catch (error) {
          this.logger.warn(`Reddit r/${sub} failed: ${error.message}`);
        }
      }

      return trends;
    } catch (error) {
      this.logger.error('Reddit trends fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Fetch from NewsAPI.org (Free Tier: 100 requests/day)
   */
  private async fetchNewsAPITrends(): Promise<FreeTrend[]> {
    if (!this.NEWS_API_KEY) {
      this.logger.warn('NewsAPI not configured - skipping');
      return [];
    }

    try {
      const url = `https://newsapi.org/v2/top-headlines?country=za&apiKey=${this.NEWS_API_KEY}`;

      const response = await axios.get(url, { timeout: 10000 });
      const articles = response.data.articles || [];

      const trends: FreeTrend[] = articles.slice(0, 15).map((article: any) => {
        const title = article.title || '';
        const description = article.description || '';

        return {
          name: this.extractTrendFromHeadline(title),
          source: 'newsapi',
          category: this.categorizeTrend(title + ' ' + description),
          url: article.url,
          region: 'ZA',
          isActive: false,
          requiresApproval: true,
          vpmxScore: 0.7, // Default score for news
          engagementScore: 0.6,
          publishedAt: article.publishedAt ? new Date(article.publishedAt) : new Date(),
          metadata: {
            description,
            source: article.source?.name,
            author: article.author,
            api_source: 'newsapi_org'
          }
        };
      });

      return trends;
    } catch (error) {
      this.logger.error('NewsAPI fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Fetch from NewsData.io (Free Tier: 200,000 requests/day)
   * Better than NewsAPI - more results, better coverage
   */
  private async fetchNewsDataTrends(): Promise<FreeTrend[]> {
    if (!this.NEWSDATA_API_KEY) {
      this.logger.warn('NewsData.io not configured - skipping');
      return [];
    }

    try {
      // South Africa focus with multiple categories
      const categories = ['politics', 'technology', 'sports', 'lifestyle', 'breaking'];
      const trends: FreeTrend[] = [];

      for (const category of categories) {
        try {
          const url = `https://newsdata.io/api/1/latest?apikey=${this.NEWSDATA_API_KEY}&country=za&language=en&category=${category}`;

          const response = await axios.get(url, { timeout: 10000 });
          const data = response.data;

          if (data.status === 'success' && data.results) {
            const articles = data.results.slice(0, 5); // Top 5 per category

            for (const article of articles) {
              const title = article.title || '';
              const description = article.description || '';

              trends.push({
                name: this.extractTrendFromHeadline(title),
                source: `newsdata_${category}`,
                category: this.categorizeTrend(title + ' ' + description),
                url: article.link,
                region: 'ZA',
                isActive: false,
                requiresApproval: true,
                vpmxScore: 0.75,
                engagementScore: 0.65,
                publishedAt: article.pubDate ? new Date(article.pubDate) : new Date(),
                metadata: {
                  description,
                  source: article.source_id,
                  category,
                  country: article.country,
                  language: article.language,
                  api_source: 'newsdata_io',
                  pubDate: article.pubDate,
                  image_url: article.image_url
                }
              });
            }
          }

          await this.sleep(500); // Rate limiting
        } catch (error) {
          this.logger.warn(`NewsData.io category ${category} failed:`, error.message);
        }
      }

      this.logger.log(`✅ NewsData.io: ${trends.length} articles fetched from ${categories.length} categories`);
      return trends;
    } catch (error) {
      this.logger.error('NewsData.io fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Fetch from YouTube Data API v3 (Free: 10,000 units/day)
   */
  private async fetchYouTubeTrends(): Promise<FreeTrend[]> {
    if (!this.YOUTUBE_API_KEY) {
      this.logger.warn('YouTube API not configured - skipping');
      return [];
    }

    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=ZA&maxResults=10&key=${this.YOUTUBE_API_KEY}`;

      const response = await axios.get(url, { timeout: 10000 });
      const videos = response.data.items || [];

      const trends: FreeTrend[] = videos.map((video: any) => {
        const title = video.snippet?.title || '';
        const viewCount = parseInt(video.statistics?.viewCount || '0');
        const likeCount = parseInt(video.statistics?.likeCount || '0');

        return {
          name: this.cleanTrendName(title),
          source: 'youtube',
          category: this.categorizeTrend(title),
          url: `https://youtube.com/watch?v=${video.id}`,
          region: 'ZA',
          isActive: false,
          requiresApproval: true,
          vpmxScore: this.calculateYouTubeVPMX(viewCount, likeCount),
          engagementScore: this.calculateYouTubeEngagement(viewCount, likeCount),
          publishedAt: new Date(video.snippet?.publishedAt),
          metadata: {
            viewCount,
            likeCount,
            commentCount: video.statistics?.commentCount,
            channelId: video.snippet?.channelId,
            channelTitle: video.snippet?.channelTitle,
            api_source: 'youtube_data_api_v3'
          }
        };
      });

      return trends;
    } catch (error) {
      this.logger.error('YouTube API fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Fetch from Twitter/X API v2 (Free: 500K tweets/month)
   */
  private async fetchTwitterTrends(): Promise<FreeTrend[]> {
    if (!this.TWITTER_BEARER_TOKEN) {
      this.logger.warn('Twitter API not configured - skipping');
      return [];
    }

    try {
      // South Africa WOEID = 23424942
      const url = 'https://api.twitter.com/1.1/trends/place.json?id=23424942';

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.TWITTER_BEARER_TOKEN}`
        },
        timeout: 10000
      });

      const trendsData = response.data[0]?.trends || [];

      const trends: FreeTrend[] = trendsData.slice(0, 15).map((trend: any) => {
        const name = trend.name || '';
        const volume = trend.tweet_volume || 0;

        return {
          name: this.cleanTrendName(name),
          source: 'twitter',
          category: this.categorizeTrend(name),
          url: trend.url,
          region: 'ZA',
          isActive: false,
          requiresApproval: true,
          vpmxScore: this.calculateTwitterVPMX(volume),
          engagementScore: this.calculateTwitterEngagement(volume),
          publishedAt: new Date(),
          metadata: {
            tweetVolume: volume,
            promoted: trend.promoted_content || false,
            api_source: 'twitter_api_v2'
          }
        };
      });

      return trends;
    } catch (error) {
      this.logger.error('Twitter API fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Save trends to database with PENDING status
   * Requires admin approval before becoming active
   */
  private async saveTrendsToDatabase(trends: FreeTrend[]): Promise<number> {
    let savedCount = 0;

    for (const trend of trends) {
      try {
        // Check if trend already exists (by name + source)
        const existing = await this.prisma.topic.findFirst({
          where: {
            name: trend.name,
            // No source field in Topic model - use slug instead
          }
        });

        if (existing) {
          // Update existing trend's metadata
          await this.prisma.topic.update({
            where: { id: existing.id },
            data: {
              metadata: {
                ...existing.metadata as any,
                ...trend.metadata,
                lastSeen: new Date().toISOString()
              }
            }
          });
          continue;
        }

        // Create new trend (requires approval)
        const slug = this.generateSlug(trend.name, trend.source);

        await this.prisma.topic.create({
          data: {
            name: trend.name,
            slug,
            category: trend.category,
            description: `Trend from ${trend.source}`,
            title: trend.name.substring(0, 50),
            alias: trend.name.substring(0, 30),
            region: trend.region,
            status: 'PAUSED', // PAUSED = requires approval
            isVerified: false,
            metadata: {
              ...trend.metadata,
              source: trend.source,
              requiresApproval: true,
              dateFetched: new Date().toISOString(),
              vpmxScore: trend.vpmxScore,
              engagementScore: trend.engagementScore,
              autoGenerated: true
            },
            canonical: {
              hashtags: [trend.name.includes('#') ? trend.name : `#${trend.name.replace(/\s+/g, '')}`],
              keywords: trend.name.toLowerCase().split(/\s+/),
              entities: [],
              sources: [trend.source]
            }
          }
        });

        savedCount++;
      } catch (error) {
        this.logger.error(`Failed to save trend "${trend.name}":`, error.message);
      }
    }

    return savedCount;
  }

  /**
   * Filter out offensive/inappropriate content
   */
  private filterOffensiveContent(trends: FreeTrend[]): FreeTrend[] {
    return trends.filter(trend => {
      const nameLower = trend.name.toLowerCase();

      // Check for offensive words
      const hasOffensive = this.offensiveWords.some(word =>
        nameLower.includes(word.toLowerCase())
      );

      if (hasOffensive) {
        this.logger.warn(`🚫 Filtered offensive trend: ${trend.name}`);
        return false;
      }

      // Filter out very short trends
      if (nameLengthWithoutHashtag(trend.name) < 3) {
        return false;
      }

      // Filter out spam-like patterns
      if (this.isSpam(trend.name)) {
        this.logger.warn(`🚫 Filtered spam trend: ${trend.name}`);
        return false;
      }

      return true;
    });
  }

  /**
   * Detect spam-like patterns
   */
  private isSpam(name: string): boolean {
    const spamPatterns = [
      /^buy\s+/i,
      /^click\s+/i,
      /^free\s+/i,
      /https?:\/\//,
      /\.com$/,
      /\$\$\$/,
      /!!!{3,}/
    ];

    return spamPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Remove duplicate trends
   */
  private deduplicateTrends(trends: FreeTrend[]): FreeTrend[] {
    const seen = new Set<string>();
    const unique: FreeTrend[] = [];

    for (const trend of trends) {
      const key = trend.name.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(trend);
      }
    }

    return unique;
  }

  /**
   * Categorize trend based on keywords
   */
  private categorizeTrend(name: string): string {
    const nameLower = name.toLowerCase();

    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      if (keywords.some(keyword => nameLower.includes(keyword))) {
        return category;
      }
    }

    return 'GENERAL';
  }

  /**
   * Clean trend name (remove extra whitespace, special chars)
   */
  private cleanTrendName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 100);
  }

  /**
   * Extract trend from news headline
   */
  private extractTrendFromHeadline(headline: string): string {
    // Remove common words and keep main topic
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of'];
    const words = headline.split(/\s+/);
    const filtered = words.filter(word => !stopWords.includes(word.toLowerCase()));

    return filtered.join(' ').substring(0, 80);
  }

  /**
   * Generate URL-safe slug
   */
  private generateSlug(name: string, source: string): string {
    const clean = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${clean}-${source.substring(0, 10)}-${Date.now()}`;
  }

  /**
   * VPMX Score calculation for Google Trends
   */
  private calculateVPMXScore(volume: string): number {
    // Parse volume like "100K+" or "1M+"
    const num = parseInt(volume.replace(/[^0-9]/g, '')) || 1;
    const multiplier = volume.includes('M') ? 1000000 : volume.includes('K') ? 1000 : 1;

    const absolute = num * multiplier;
    // Normalize to 0-1 range
    return Math.min(absolute / 1000000, 1);
  }

  /**
   * Engagement score calculation
   */
  private calculateEngagementScore(volume: string): number {
    return this.calculateVPMXScore(volume) * 0.8;
  }

  /**
   * Reddit VPMX score
   */
  private calculateRedditVPMX(upvotes: number, comments: number): number {
    const score = (upvotes * 2 + comments) / 10000;
    return Math.min(score, 1);
  }

  /**
   * Reddit engagement score
   */
  private calculateRedditEngagement(upvotes: number, comments: number): number {
    return this.calculateRedditVPMX(upvotes, comments) * 0.7;
  }

  /**
   * YouTube VPMX score
   */
  private calculateYouTubeVPMX(views: number, likes: number): number {
    const score = (views + likes * 10) / 1000000;
    return Math.min(score, 1);
  }

  /**
   * YouTube engagement score
   */
  private calculateYouTubeEngagement(views: number, likes: number): number {
    if (views === 0) return 0;
    return Math.min((likes / views) * 10, 1);
  }

  /**
   * Twitter VPMX score
   */
  private calculateTwitterVPMX(volume: number): number {
    const score = volume / 1000000;
    return Math.min(score, 1);
  }

  /**
   * Twitter engagement score
   */
  private calculateTwitterEngagement(volume: number): number {
    return this.calculateTwitterVPMX(volume) * 0.9;
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Helper function to calculate name length without hashtag
 */
function nameLengthWithoutHashtag(name: string): number {
  return name.replace(/#/g, '').trim().length;
}
