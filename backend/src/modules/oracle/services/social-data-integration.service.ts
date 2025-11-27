import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import {
  SocialMediaPost,
  TrendClassification,
  TrendCategory,
  PlatformType,
  SourceType,
  SourceAnalysis,
  CorrelationScore,
  OfficialVerification,
  DeceptionDetectionResult,
  ViralityRiskModel
} from '../interfaces/social-data-integration.interface';

@Injectable()
export class SocialDataIntegrationService {
  private readonly logger = new Logger(SocialDataIntegrationService.name);
  private readonly deceptionServiceUrl: string;
  private readonly classificationServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.deceptionServiceUrl = this.configService.get<string>('DECEPTION_SERVICE_URL', 'http://localhost:3002');
    this.classificationServiceUrl = this.configService.get<string>('CLASSIFICATION_SERVICE_URL', 'http://localhost:3003');
  }

  // Content filtering for harmful topics
  private readonly harmfulKeywords = [
    'child abuse', 'domestic violence', 'rape', 'murder', 'death', 'suicide',
    'pornography', 'hate crime', 'racism', 'terrorism', 'extremism',
    'illegal', 'criminal', 'assault', 'violence', 'abuse'
  ];

  // Celebrity gossip patterns that are usually suspicious
  private readonly gossipPatterns = [
    'pregnant', 'arrested', 'dumped', 'cheating', 'scandal',
    'spotted alive', 'death hoax', 'secret baby', 'divorce',
    'caught', 'exposed', 'leaked', 'rumor', 'allegedly'
  ];

  // Official sources that provide verification
  private readonly officialSources = [
    { domain: 'cnn.com', type: 'official_news', authority: 0.9 },
    { domain: 'bbc.com', type: 'official_news', authority: 0.9 },
    { domain: 'reuters.com', type: 'official_news', authority: 0.95 },
    { domain: 'apnews.com', type: 'official_news', authority: 0.9 },
    { domain: 'nytimes.com', type: 'official_news', authority: 0.85 },
    { domain: 'washingtonpost.com', type: 'official_news', authority: 0.85 },
    { domain: 'news24.com', type: 'official_news', authority: 0.8 }, // SA source
    { domain: 'timeslive.co.za', type: 'official_news', authority: 0.8 }, // SA source
    { domain: 'iol.co.za', type: 'official_news', authority: 0.8 }, // SA source
  ];

  // Caching helpers for external service calls
  private async getCachedResult<T>(cacheKey: string): Promise<T | null> {
    try {
      const cachedResult = await this.redis.get(cacheKey);
      return cachedResult ? JSON.parse(cachedResult) : null;
    } catch (error) {
      this.logger.warn(`Failed to retrieve cached result for key ${cacheKey}:`, error.message);
      return null;
    }
  }

  private async setCachedResult<T>(cacheKey: string, result: T, ttlSeconds: number = 300): Promise<void> {
    try {
      await this.redis.setex(cacheKey, ttlSeconds, JSON.stringify(result));
      this.logger.debug(`Cached result for key ${cacheKey} with TTL ${ttlSeconds}s`);
    } catch (error) {
      this.logger.warn(`Failed to cache result for key ${cacheKey}:`, error.message);
    }
  }

  private generateCacheKey(prefix: string, data: any): string {
    const contentHash = this.hashContent(data);
    return `oracle:${prefix}:${contentHash}`;
  }

  private hashContent(data: any): string {
    const crypto = require('crypto');
    const contentString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(contentString).digest('hex').substring(0, 16);
  }

  async getClassificationByTrendId(trendId: string): Promise<TrendClassification | null> {
    const cacheKey = `oracle:classification:trend:${trendId}`;
    return await this.getCachedResult<TrendClassification>(cacheKey);
  }

  async classifyTrend(posts: SocialMediaPost[]): Promise<TrendClassification> {
    this.logger.log(`🔍 Classifying trend from ${posts.length} social media posts`);

    // Check cache first
    const trendId = this.generateTrendId(posts);
    const cacheKey = `oracle:classification:trend:${trendId}`;
    const cachedResult = await this.getCachedResult<TrendClassification>(cacheKey);

    if (cachedResult) {
      this.logger.log(`📋 Retrieved cached classification for trend: ${trendId}`);
      return cachedResult;
    }

    // Step 1: Check for harmful content
    const harmfulCheck = this.checkForHarmfulContent(posts);
    if (harmfulCheck.isHarmful) {
      const classification = {
        trendId,
        category: TrendCategory.HARMFUL_BLOCKED,
        confidence: harmfulCheck.confidence,
        reasoning: harmfulCheck.reasoning,
        sources: [],
        crossPlatformCorrelation: [],
        deceptionScore: 0,
        riskLevel: 'HIGH',
        marketImpact: 'NONE',
      };

      // Cache harmful content classification with longer TTL
      await this.setCachedResult(cacheKey, classification, 1800); // 30 minutes
      return classification;
    }

    // Step 2: Analyze sources and credibility
    const sourceAnalysis = await this.analyzeSources(posts);

    // Step 3: Check for gossip patterns
    const gossipAnalysis = this.analyzeGossipPatterns(posts);

    // Step 4: Cross-platform correlation
    const correlation = await this.analyzeCrossPlatformCorrelation(posts);

    // Step 5: Deception detection (now with external service calls)
    const deceptionResult = await this.detectDeception(posts, sourceAnalysis);

    // Step 6: Official verification search
    const officialVerification = await this.searchOfficialVerification(posts);

    // Step 7: Final classification
    const category = this.determineCategory({
      sourceAnalysis,
      gossipAnalysis,
      deceptionResult,
      officialVerification,
      correlation
    });

    const classification = {
      trendId,
      category,
      confidence: this.calculateConfidence(category, sourceAnalysis, correlation),
      reasoning: this.generateReasoning(category, sourceAnalysis, gossipAnalysis),
      sources: sourceAnalysis,
      crossPlatformCorrelation: correlation,
      deceptionScore: deceptionResult.confidence,
      riskLevel: this.calculateRiskLevel(category, deceptionResult),
      marketImpact: this.calculateMarketImpact(category, correlation),
      officialVerification
    };

    // Cache the result
    const ttl = category === TrendCategory.VERIFIED_TRADEABLE ? 600 : 300; // 10 min for verified, 5 min for others
    await this.setCachedResult(cacheKey, classification, ttl);

    this.logger.log(`✅ Completed trend classification: ${category} (confidence: ${classification.confidence.toFixed(2)})`);
    return classification;
  }

  private checkForHarmfulContent(posts: SocialMediaPost[]): { isHarmful: boolean; confidence: number; reasoning: string } {
    const harmfulPosts = posts.filter(post =>
      this.harmfulKeywords.some(keyword =>
        post.content.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    const harmfulRatio = harmfulPosts.length / posts.length;

    if (harmfulRatio > 0.1) { // More than 10% harmful content
      return {
        isHarmful: true,
        confidence: Math.min(0.95, harmfulRatio * 2),
        reasoning: `Harmful content detected: ${harmfulPosts.length}/${posts.length} posts contain prohibited topics`
      };
    }

    return { isHarmful: false, confidence: 0, reasoning: '' };
  }

  private async analyzeSources(posts: SocialMediaPost[]): Promise<SourceAnalysis[]> {
    const sourceMap = new Map<string, SocialMediaPost[]>();

    // Group posts by source
    posts.forEach(post => {
      const sourceKey = `${post.platform}:${post.authorHandle}`;
      if (!sourceMap.has(sourceKey)) {
        sourceMap.set(sourceKey, []);
      }
      sourceMap.get(sourceKey)!.push(post);
    });

    const analyses: SourceAnalysis[] = [];

    for (const [sourceKey, sourcePosts] of sourceMap) {
      const [platform, handle] = sourceKey.split(':');
      const firstPost = sourcePosts[0];

      // Determine source type
      let sourceType = SourceType.USER_GENERATED;
      let credibilityScore = 0.1;
      let authorityLevel = 0.1;
      let verificationStatus = 'UNVERIFIED' as const;

      // Check for verified accounts
      if (firstPost.authorVerified) {
        sourceType = this.determineSourceTypeByHandle(handle, platform);
        credibilityScore = this.getBaseCredibility(sourceType);
        authorityLevel = this.getAuthorityLevel(sourceType);
        verificationStatus = 'VERIFIED';
      }

      // Check for official sources in content
      const officialSources = this.extractOfficialSources(sourcePosts);
      if (officialSources.length > 0) {
        credibilityScore = Math.max(credibilityScore, 0.7);
        authorityLevel = Math.max(authorityLevel, 0.6);
      }

      analyses.push({
        platform: platform as PlatformType,
        sourceType,
        credibilityScore,
        authorityLevel,
        verificationStatus,
        politicalBias: 'UNKNOWN' // TODO: Implement political bias detection
      });
    }

    return analyses;
  }

  private determineSourceTypeByHandle(handle: string, platform: string): SourceType {
    // Celebrity patterns
    const celebrityPatterns = [
      /^official_/i, /_official$/i, /^real_/i, /_real$/i,
      /celebrity/i, /star/i, /actor/i, /singer/i, /artist/i
    ];

    // Brand patterns
    const brandPatterns = [
      /shop/i, /store/i, /official/i, /brand/i, /company/i,
      /ltd$/i, /inc$/i, /corp$/i, /group$/i
    ];

    // Media patterns
    const mediaPatterns = [
      /news/i, /media/i, /tv/i, /radio/i, /press/i,
      /magazine/i, /journal/i, /reporter/i
    ];

    const handleLower = handle.toLowerCase();

    if (celebrityPatterns.some(pattern => pattern.test(handleLower))) {
      return SourceType.CELEBRITY_OFFICIAL;
    }

    if (brandPatterns.some(pattern => pattern.test(handleLower))) {
      return SourceType.BRAND_OFFICIAL;
    }

    if (mediaPatterns.some(pattern => pattern.test(handleLower))) {
      return SourceType.MEDIA_OUTLET;
    }

    // Check for large follower counts (influencers)
    // This would need actual follower data from the platform APIs
    return SourceType.INFLUENCER;
  }

  private getBaseCredibility(sourceType: SourceType): number {
    switch (sourceType) {
      case SourceType.OFFICIAL_NEWS: return 0.9;
      case SourceType.CELEBRITY_OFFICIAL: return 0.7;
      case SourceType.BRAND_OFFICIAL: return 0.6;
      case SourceType.MEDIA_OUTLET: return 0.5;
      case SourceType.INFLUENCER: return 0.3;
      default: return 0.1;
    }
  }

  private getAuthorityLevel(sourceType: SourceType): number {
    switch (sourceType) {
      case SourceType.OFFICIAL_NEWS: return 0.9;
      case SourceType.CELEBRITY_OFFICIAL: return 0.6;
      case SourceType.BRAND_OFFICIAL: return 0.5;
      case SourceType.MEDIA_OUTLET: return 0.4;
      case SourceType.INFLUENCER: return 0.2;
      default: return 0.1;
    }
  }

  private extractOfficialSources(posts: SocialMediaPost[]): string[] {
    const sources: string[] = [];

    posts.forEach(post => {
      // Look for URLs in content
      const urlPattern = /https?:\/\/[^\s]+/g;
      const urls = post.content.match(urlPattern);

      if (urls) {
        urls.forEach(url => {
          const domain = this.extractDomain(url);
          const officialSource = this.officialSources.find(s => domain.includes(s.domain));
          if (officialSource) {
            sources.push(url);
          }
        });
      }
    });

    return [...new Set(sources)]; // Remove duplicates
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  private analyzeGossipPatterns(posts: SocialMediaPost[]): { isGossip: boolean; patterns: string[]; confidence: number } {
    const gossipPosts = posts.filter(post =>
      this.gossipPatterns.some(pattern =>
        post.content.toLowerCase().includes(pattern.toLowerCase())
      )
    );

    const patterns = [...new Set(
      gossipPosts.flatMap(post =>
        this.gossipPatterns.filter(pattern =>
          post.content.toLowerCase().includes(pattern.toLowerCase())
        )
      )
    )];

    return {
      isGossip: gossipPosts.length > 0,
      patterns,
      confidence: Math.min(0.9, gossipPosts.length / posts.length)
    };
  }

  private async analyzeCrossPlatformCorrelation(posts: SocialMediaPost[]): Promise<CorrelationScore[]> {
    const correlations: CorrelationScore[] = [];
    const platforms = [...new Set(posts.map(p => p.platform))];

    // Compare each platform pair
    for (let i = 0; i < platforms.length; i++) {
      for (let j = i + 1; j < platforms.length; j++) {
        const platform1 = platforms[i];
        const platform2 = platforms[j];

        const posts1 = posts.filter(p => p.platform === platform1);
        const posts2 = posts.filter(p => p.platform === platform2);

        const correlation = this.calculateCorrelation(posts1, posts2);

        correlations.push({
          platform1,
          platform2,
          correlationStrength: correlation.strength,
          timeOverlap: correlation.timeOverlap,
          contentSimilarity: correlation.similarity,
          sharedKeywords: correlation.sharedKeywords
        });
      }
    }

    return correlations;
  }

  private calculateCorrelation(posts1: SocialMediaPost[], posts2: SocialMediaPost[]): {
    strength: number;
    timeOverlap: number;
    similarity: number;
    sharedKeywords: string[];
  } {
    // Find time overlap (posts within 1 hour of each other)
    const timeOverlap = this.calculateTimeOverlap(posts1, posts2);

    // Calculate content similarity using hashtags and keywords
    const contentSimilarity = this.calculateContentSimilarity(posts1, posts2);

    // Find shared keywords
    const sharedKeywords = this.findSharedKeywords(posts1, posts2);

    // Overall correlation strength
    const strength = (timeOverlap * 0.4) + (contentSimilarity * 0.4) + (sharedKeywords.length * 0.2);

    return {
      strength: Math.min(1, strength),
      timeOverlap,
      similarity: contentSimilarity,
      sharedKeywords
    };
  }

  private calculateTimeOverlap(posts1: SocialMediaPost[], posts2: SocialMediaPost[]): number {
    const oneHour = 60 * 60 * 1000; // milliseconds
    let overlapCount = 0;
    let totalComparisons = 0;

    posts1.forEach(post1 => {
      posts2.forEach(post2 => {
        const timeDiff = Math.abs(post1.publishedAt.getTime() - post2.publishedAt.getTime());
        if (timeDiff <= oneHour) {
          overlapCount++;
        }
        totalComparisons++;
      });
    });

    return totalComparisons > 0 ? overlapCount / totalComparisons : 0;
  }

  private calculateContentSimilarity(posts1: SocialMediaPost[], posts2: SocialMediaPost[]): number {
    const keywords1 = this.extractKeywords(posts1);
    const keywords2 = this.extractKeywords(posts2);

    const intersection = keywords1.filter(k => keywords2.includes(k));
    const union = [...new Set([...keywords1, ...keywords2])];

    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private findSharedKeywords(posts1: SocialMediaPost[], posts2: SocialMediaPost[]): string[] {
    const keywords1 = this.extractKeywords(posts1);
    const keywords2 = this.extractKeywords(posts2);

    return keywords1.filter(k => keywords2.includes(k));
  }

  private extractKeywords(posts: SocialMediaPost[]): string[] {
    const keywords = new Set<string>();

    posts.forEach(post => {
      // Extract hashtags
      post.hashtags.forEach(tag => keywords.add(tag.toLowerCase()));

      // Extract mentions
      post.mentions.forEach(mention => keywords.add(mention.toLowerCase()));

      // Extract significant words from content
      const words = post.content.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3); // Only words longer than 3 characters

      words.forEach(word => keywords.add(word));
    });

    return Array.from(keywords);
  }

  private async detectDeception(posts: SocialMediaPost[], sourceAnalysis: SourceAnalysis[]): Promise<DeceptionDetectionResult> {
    this.logger.log(`🔍 Analyzing ${posts.length} posts for deception`);

    // Check cache first
    const contentHash = this.hashContent({ posts, sourceAnalysis });
    const cacheKey = `oracle:deception:${contentHash}`;
    const cachedResult = await this.getCachedResult<DeceptionDetectionResult>(cacheKey);

    if (cachedResult) {
      this.logger.debug(`📋 Retrieved cached deception analysis`);
      return cachedResult;
    }

    try {
      // Prepare payload for external deception detection service
      const payload = {
        posts: posts.map(post => ({
          content: post.content,
          authorHandle: post.authorHandle,
          authorVerified: post.authorVerified,
          platform: post.platform,
          publishedAt: post.publishedAt,
          engagementMetrics: {
            likesCount: post.likesCount,
            sharesCount: post.sharesCount,
            commentsCount: post.commentsCount,
            viewsCount: post.viewsCount
          },
          hashtags: post.hashtags,
          mentions: post.mentions
        })),
        sourceAnalysis: sourceAnalysis.map(source => ({
          platform: source.platform,
          sourceType: source.sourceType,
          credibilityScore: source.credibilityScore,
          authorityLevel: source.authorityLevel,
          verificationStatus: source.verificationStatus,
          politicalBias: source.politicalBias
        })),
        analysisContext: {
          southAfricanFocus: true,
          language: 'en',
          region: 'ZA'
        }
      };

      // Call external deception detection service
      const response = await firstValueFrom(
        this.httpService.post(`${this.deceptionServiceUrl}/analyze`, payload, {
          timeout: 15000, // 15 second timeout
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.configService.get<string>('DECEPTION_SERVICE_API_KEY', '')
          }
        })
      );

      const externalResult = response.data;

      // Map external service response to our interface
      const deceptionResult: DeceptionDetectionResult = {
        isDeceptive: externalResult.isDeceptive || false,
        confidence: externalResult.confidence || 0.5,
        deceptionType: externalResult.deceptionType || 'MISINFORMATION',
        evidence: externalResult.evidence || [],
        riskScore: externalResult.riskScore || externalResult.confidence || 0.5,
        recommendedAction: externalResult.recommendedAction || 'FLAG'
      };

      // Cache the result with moderate TTL
      await this.setCachedResult(cacheKey, deceptionResult, 600); // 10 minutes

      this.logger.log(`✅ External deception analysis completed: ${deceptionResult.isDeceptive ? 'DECEPTIVE' : 'AUTHENTIC'} (confidence: ${deceptionResult.confidence.toFixed(2)})`);
      return deceptionResult;

    } catch (error) {
      this.logger.warn(`External deception service unavailable, falling back to heuristic analysis: ${error.message}`);

      // Fallback to heuristic analysis if external service fails
      return this.performHeuristicDeceptionAnalysis(posts, sourceAnalysis);
    }
  }

  private async performHeuristicDeceptionAnalysis(posts: SocialMediaPost[], sourceAnalysis: SourceAnalysis[]): Promise<DeceptionDetectionResult> {
    this.logger.log('🔧 Using heuristic deception analysis fallback');

    const gossipAnalysis = this.analyzeGossipPatterns(posts);
    const avgCredibility = sourceAnalysis.length > 0 ?
      sourceAnalysis.reduce((sum, s) => sum + s.credibilityScore, 0) / sourceAnalysis.length : 0.5;

    // High deception probability if:
    // 1. High gossip content
    // 2. Low source credibility
    // 3. Suspicious patterns in content

    const deceptionScore = (gossipAnalysis.confidence * 0.4) +
                          ((1 - avgCredibility) * 0.4) +
                          (this.hasSuspiciousPatterns(posts) * 0.2);

    return {
      isDeceptive: deceptionScore > 0.6,
      confidence: deceptionScore,
      deceptionType: deceptionScore > 0.8 ? 'FAKE_NEWS' :
                   deceptionScore > 0.6 ? 'MISINFORMATION' : 'GOSSIP',
      evidence: [{
        type: 'heuristic_analysis',
        description: 'Analysis based on content patterns and source credibility',
        confidence: deceptionScore,
        severity: deceptionScore > 0.7 ? 'HIGH' : deceptionScore > 0.5 ? 'MEDIUM' : 'LOW'
      }],
      riskScore: deceptionScore,
      recommendedAction: deceptionScore > 0.7 ? 'BLOCK' :
                       deceptionScore > 0.5 ? 'FLAG' : 'ALLOW'
    };
  }

  private hasSuspiciousPatterns(posts: SocialMediaPost[]): boolean {
    const suspiciousPatterns = [
      'clickbait', 'you won\'t believe', 'shocking', 'breaking',
      'exclusive', 'leaked', 'secret', 'conspiracy', 'cover up'
    ];

    return posts.some(post =>
      suspiciousPatterns.some(pattern =>
        post.content.toLowerCase().includes(pattern.toLowerCase())
      )
    );
  }

  private async searchOfficialVerification(posts: SocialMediaPost[]): Promise<OfficialVerification | undefined> {
    const officialSources = this.extractOfficialSources(posts);

    if (officialSources.length === 0) {
      return undefined;
    }

    // In a real implementation, this would:
    // 1. Fetch the official source content
    // 2. Verify the authenticity of the source
    // 3. Extract verification details

    return {
      type: 'NEWS_ARTICLE',
      source: this.extractDomain(officialSources[0]),
      url: officialSources[0],
      publishedAt: new Date(),
      authority: 'Verified News Source',
      verificationLevel: 0.8
    };
  }

  private determineCategory(params: {
    sourceAnalysis: SourceAnalysis[];
    gossipAnalysis: { isGossip: boolean; patterns: string[]; confidence: number };
    deceptionResult: DeceptionDetectionResult;
    officialVerification?: OfficialVerification;
    correlation: CorrelationScore[];
  }): TrendCategory {
    const { sourceAnalysis, gossipAnalysis, deceptionResult, officialVerification, correlation } = params;

    // Immediate block if high deception
    if (deceptionResult.isDeceptive && deceptionResult.confidence > 0.7) {
      return TrendCategory.SUSPICIOUS_NON_TRADEABLE;
    }

    // Block if high gossip content without verification
    if (gossipAnalysis.isGossip && gossipAnalysis.confidence > 0.6 && !officialVerification) {
      return TrendCategory.SUSPICIOUS_NON_TRADEABLE;
    }

    // Check for verified sources
    const hasHighCredibilitySources = sourceAnalysis.some(s => s.credibilityScore > 0.7);
    const hasOfficialVerification = !!officialVerification;
    const hasGoodCorrelation = correlation.some(c => c.correlationStrength > 0.5);

    // Require at least 2 of these 3 conditions for verified tradable trends
    const verifiedSignals = [
      hasHighCredibilitySources,
      hasOfficialVerification,
      hasGoodCorrelation
    ].filter(Boolean).length;

    if (verifiedSignals >= 2) {
      return TrendCategory.VERIFIED_TRADEABLE;
    }

    // Default to suspicious for anything uncertain
    return TrendCategory.SUSPICIOUS_NON_TRADEABLE;
  }

  private calculateConfidence(category: TrendCategory, sourceAnalysis: SourceAnalysis[], correlation: CorrelationScore[]): number {
    if (category === TrendCategory.VERIFIED_TRADEABLE) {
      const avgCredibility = sourceAnalysis.reduce((sum, s) => sum + s.credibilityScore, 0) / sourceAnalysis.length;
      const maxCorrelation = Math.max(...correlation.map(c => c.correlationStrength));
      return (avgCredibility * 0.6) + (maxCorrelation * 0.4);
    }

    return 0.5; // Default confidence for non-tradable categories
  }

  private generateReasoning(category: TrendCategory, sourceAnalysis: SourceAnalysis[], gossipAnalysis: any): string {
    switch (category) {
      case TrendCategory.VERIFIED_TRADEABLE:
        const credibleSources = sourceAnalysis.filter(s => s.credibilityScore > 0.7).length;
        return `Verified tradable trend based on ${credibleSources} high-credibility sources and cross-platform correlation`;

      case TrendCategory.SUSPICIOUS_NON_TRADEABLE:
        if (gossipAnalysis.isGossip) {
          return `Suspicious non-tradable trend: Contains gossip patterns (${gossipAnalysis.patterns.join(', ')}) without official verification`;
        }
        return `Suspicious non-tradable trend: Low source credibility or insufficient verification`;

      case TrendCategory.HARMFUL_BLOCKED:
        return `Harmful content blocked: Contains prohibited topics that violate community guidelines`;

      default:
        return 'Uncategorized trend requiring manual review';
    }
  }

  private calculateRiskLevel(category: TrendCategory, deceptionResult: DeceptionDetectionResult): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (category === TrendCategory.HARMFUL_BLOCKED) return 'HIGH';
    if (category === TrendCategory.SUSPICIOUS_NON_TRADEABLE) return 'MEDIUM';
    if (deceptionResult.isDeceptive) return 'HIGH';
    return 'LOW';
  }

  private calculateMarketImpact(category: TrendCategory, correlation: CorrelationScore[]): 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
    if (category === TrendCategory.HARMFUL_BLOCKED) return 'NONE';
    if (category === TrendCategory.SUSPICIOUS_NON_TRADEABLE) return 'NONE';

    const maxCorrelation = Math.max(...correlation.map(c => c.correlationStrength));
    if (maxCorrelation > 0.7) return 'HIGH';
    if (maxCorrelation > 0.4) return 'MEDIUM';
    return 'LOW';
  }

  private generateTrendId(posts: SocialMediaPost[]): string {
    // Create a deterministic trend ID from the posts
    const sortedPosts = posts.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
    const keywords = this.extractKeywords(sortedPosts.slice(0, 3)); // Use first 3 posts

    if (keywords.length === 0) {
      return `trend-${Date.now()}`;
    }

    return `trend-${keywords.slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
  }

  async calculateRiskAdjustedVirality(posts: SocialMediaPost[], classification: TrendClassification): Promise<ViralityRiskModel> {
    // Calculate base virality score
    const baseVirality = this.calculateBaseVirality(posts);

    // Apply risk adjustments based on classification
    let riskAdjustment = 0;

    switch (classification.category) {
      case TrendCategory.VERIFIED_TRADEABLE:
        riskAdjustment = 0.1; // Small positive adjustment for verified trends
        break;
      case TrendCategory.SUSPICIOUS_NON_TRADEABLE:
        riskAdjustment = -0.3; // Significant negative adjustment
        break;
      case TrendCategory.HARMFUL_BLOCKED:
        riskAdjustment = -1.0; // Complete blocking
        break;
    }

    // Additional risk factors
    const riskFactors = [
      {
        factor: 'Source Credibility',
        impact: classification.sources.reduce((sum, s) => sum + s.credibilityScore, 0) / classification.sources.length,
        confidence: 0.8,
        description: 'Average credibility of sources reporting the trend'
      },
      {
        factor: 'Deception Risk',
        impact: -classification.deceptionScore,
        confidence: classification.confidence,
        description: 'Risk of misinformation or deception'
      },
      {
        factor: 'Cross-Platform Strength',
        impact: Math.max(...classification.crossPlatformCorrelation.map(c => c.correlationStrength)),
        confidence: 0.9,
        description: 'Strength of trend correlation across platforms'
      }
    ];

    const finalScore = Math.max(0, Math.min(1, baseVirality + riskAdjustment));

    return {
      baseVirality,
      riskAdjustment,
      finalScore,
      riskFactors,
      marketVolatility: this.calculateMarketVolatility(classification),
      confidenceInterval: this.calculateConfidenceInterval(finalScore, classification)
    };
  }

  private calculateBaseVirality(posts: SocialMediaPost[]): number {
    if (posts.length === 0) return 0;

    // Calculate virality based on engagement metrics
    const totalEngagement = posts.reduce((sum, post) =>
      sum + post.likesCount + post.sharesCount + post.commentsCount + (post.viewsCount || 0), 0
    );

    const avgEngagement = totalEngagement / posts.length;

    // Normalize to 0-1 scale (this would need calibration with real data)
    const normalizedScore = Math.min(1, avgEngagement / 10000);

    return normalizedScore;
  }

  private calculateMarketVolatility(classification: TrendClassification): number {
    // Higher volatility for suspicious or high-risk trends
    switch (classification.riskLevel) {
      case 'HIGH': return 0.8;
      case 'MEDIUM': return 0.5;
      case 'LOW': return 0.2;
      default: return 0.3;
    }
  }

  private calculateConfidenceInterval(score: number, classification: TrendClassification): [number, number] {
    // Wider intervals for less certain classifications
    const margin = classification.confidence > 0.8 ? 0.05 :
                    classification.confidence > 0.6 ? 0.1 : 0.2;

    return [
      Math.max(0, score - margin),
      Math.min(1, score + margin)
    ];
  }
}