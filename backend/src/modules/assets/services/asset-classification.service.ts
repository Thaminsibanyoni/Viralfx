import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

import { ViralAsset, ViralCategory, SocialPlatform, ContentSafetyLevel, ModerationStatus } from '../entities/viral-asset.entity';
import { SocialContent } from '../interfaces/social-content.interface';
import { ClassificationResult, ContentFeatures, AssetMetrics } from '../interfaces/classification.interface';
import { MLService } from '../../ml/services/ml.service';
import { VisionService } from '../../vision/services/vision.service';
import { NLPService } from '../../nlp/services/nlp.service';
import { ComplianceService } from '../services/compliance.service';
import { SocialDataService } from '../services/social-data.service';
import { WebSocketGateway } from '../../websocket/websocket.gateway';
import { PricingEngineService } from '../services/pricing-engine.service';

@Injectable()
export class AssetClassificationService {
  private readonly logger = new Logger(AssetClassificationService.name);

  constructor(
    private config: ConfigService,
    @InjectRepository(ViralAsset)
    private assetRepository: Repository<ViralAsset>,
    private mlService: MLService,
    private visionService: VisionService,
    private nlpService: NLPService,
    private complianceService: ComplianceService,
    private socialDataService: SocialDataService,
    private websocketGateway: WebSocketGateway,
    private pricingEngine: PricingEngineService,
    @InjectQueue('asset-classification')
    private classificationQueue: Queue,
    @InjectQueue('asset-updates')
    private updateQueue: Queue
  ) {}

  /**
   * Classify social content and potentially create a viral asset
   */
  async classifySocialContent(content: SocialContent): Promise<ClassificationResult> {
    try {
      this.logger.log(`Classifying content from ${content.platform}: ${content.id}`);

      // 1. Extract features from content
      const features = await this.extractFeatures(content);

      // 2. Apply ML classification model
      const classification = await this.mlService.classify(features);

      // 3. Apply rule-based filtering
      const filteredClassification = await this.applyRules(classification, content);

      // 4. Validate against content policies
      const complianceCheck = await this.complianceService.validate(filteredClassification, content);

      // 5. Check if asset should be created
      if (!complianceCheck.approved) {
        this.logger.warn(`Content rejected: ${complianceCheck.reasons.join(', ')}`);
        return {
          approved: false,
          reason: 'Content does not meet compliance requirements',
          violations: complianceCheck.violations,
          recommendation: complianceCheck.recommendations[0] || 'Content rejected'
        };
      }

      // 6. Check if asset already exists
      const existingAsset = await this.findExistingAsset(filteredClassification);
      if (existingAsset) {
        await this.updateExistingAsset(existingAsset, filteredClassification, content);
        return {
          approved: true,
          assetId: existingAsset.id,
          action: 'updated',
          reason: 'Existing asset updated with new content'
        };
      }

      // 7. Create new asset if it meets thresholds
      if (this.meetsCreationThresholds(filteredClassification)) {
        const asset = await this.createViralAsset(filteredClassification, content);
        return {
          approved: true,
          assetId: asset.id,
          action: 'created',
          reason: 'New viral asset created successfully'
        };
      }

      return {
        approved: false,
        reason: 'Content does not meet asset creation thresholds',
        recommendation: 'Monitor for increased virality'
      };

    } catch (error) {
      this.logger.error('Failed to classify content:', error);
      throw new BadRequestException('Content classification failed');
    }
  }

  /**
   * Extract features from social content for ML classification
   */
  private async extractFeatures(content: SocialContent): Promise<ContentFeatures> {
    const [textFeatures, visualFeatures] = await Promise.all([
      this.nlpService.extractTextFeatures(content.text),
      content.mediaUrls ? this.visionService.extractFeatures(content.mediaUrls) : null
    ]);

    return {
      textFeatures,
      visualFeatures,
      metadata: {
        platform: content.platform,
        author: content.author,
        timestamp: content.timestamp,
        engagement: content.engagementMetrics,
        geolocation: content.geolocation,
        hashtags: content.hashtags || [],
        mentions: content.mentions || []
      }
    };
  }

  /**
   * Apply business rules to ML classification
   */
  private async applyRules(classification: any, content: SocialContent): Promise<any> {
    // Rule 1: South African content prioritization
    const saRelevance = await this.calculateSARelevance(content);
    if (saRelevance < 0.3) {
      classification.category = ViralCategory.TRENDBASE;
      classification.priority = 'low';
    }

    // Rule 2: Platform-specific category adjustments
    classification.category = this.adjustCategoryForPlatform(classification.category, content.platform);

    // Rule 3: Time-based virality assessment
    const timeScore = this.calculateTimeBasedScore(content);
    classification.viralityRate = classification.viralityRate * timeScore;

    // Rule 4: Cross-platform correlation bonus
    const crossPlatformBonus = await this.calculateCrossPlatformBonus(content);
    classification.momentum = Math.min(100, classification.momentum + crossPlatformBonus);

    return classification;
  }

  /**
   * Create a new viral asset from classification results
   */
  private async createViralAsset(classification: any, content: SocialContent): Promise<ViralAsset> {
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 24); // 24-hour default expiry

    const asset: Partial<ViralAsset> = {
      symbol: this.generateSymbol(classification),
      name: this.generateAssetName(content),
      description: this.generateDescription(content, classification),
      category: classification.category,
      subcategory: classification.subcategory,
      origin_platform: content.platform,
      current_platforms: [content.platform],
      momentum_score: classification.momentum,
      sentiment_index: classification.sentiment,
      virality_rate: classification.viralityRate,
      engagement_velocity: classification.engagementVelocity,
      reach_estimate: classification.estimatedReach,
      current_price: await this.pricingEngine.calculateInitialPrice(classification),
      volume_24h: 0,
      market_cap: 0,
      content_safety: classification.safetyLevel,
      content_risk_score: classification.riskScore,
      moderation_status: classification.safetyLevel === ContentSafetyLevel.SAFE ? ModerationStatus.APPROVED : ModerationStatus.PENDING,
      first_seen: content.timestamp,
      expiry_time: expiryTime,
      source_urls: [content.url],
      keywords: classification.keywords || [],
      geographic_relevance: classification.geographicRelevance || ['ZA'],
      languages: classification.languages || ['en'],
      target_demographics: classification.targetDemographics || [],
      status: 'ACTIVE',
      is_trending: classification.momentum > 70
    };

    const createdAsset = await this.assetRepository.save(asset);

    // Queue initial price history entry
    await this.updateQueue.add('create-price-history', {
      assetId: createdAsset.id,
      price: createdAsset.current_price,
      momentum: createdAsset.momentum_score,
      sentiment: createdAsset.sentiment_index
    });

    // Notify WebSocket clients of new asset
    this.websocketGateway.broadcastAssetCreated(createdAsset);

    this.logger.log(`Created new viral asset: ${createdAsset.symbol} (${createdAsset.id})`);
    return createdAsset;
  }

  /**
   * Update existing asset with new content data
   */
  private async updateExistingAsset(
    asset: ViralAsset,
    classification: any,
    content: SocialContent
  ): Promise<ViralAsset> {
    // Update metrics
    const updatedMetrics = await this.calculateUpdatedMetrics(asset, classification, content);

    // Update platforms if new one detected
    const currentPlatforms = asset.current_platforms || [];
    if (!currentPlatforms.includes(content.platform)) {
      currentPlatforms.push(content.platform);
    }

    // Update asset
    await this.assetRepository.update(asset.id, {
      current_platforms: currentPlatforms,
      momentum_score: updatedMetrics.momentum,
      sentiment_index: updatedMetrics.sentiment,
      virality_rate: updatedMetrics.viralityRate,
      engagement_velocity: updatedMetrics.engagementVelocity,
      reach_estimate: updatedMetrics.reach,
      updated_at: new Date(),
      is_trending: updatedMetrics.momentum > 70
    });

    // Recalculate price if significant change
    if (this.hasSignificantChange(asset, updatedMetrics)) {
      const newPrice = await this.pricingEngine.recalculatePrice(asset.id, updatedMetrics);
      await this.assetRepository.update(asset.id, {
        current_price: newPrice
      });
    }

    const updatedAsset = await this.assetRepository.findOne({ where: { id: asset.id } });

    // Broadcast updates
    this.websocketGateway.broadcastAssetUpdate(asset.id, updatedMetrics);

    this.logger.log(`Updated existing asset: ${asset.symbol}`);
    return updatedAsset;
  }

  /**
   * Find existing asset based on classification
   */
  private async findExistingAsset(classification: any): Promise<ViralAsset | null> {
    // Search for existing assets with similar characteristics
    const similarAssets = await this.assetRepository
      .createQueryBuilder('asset')
      .where('asset.category = :category', { category: classification.category })
      .andWhere('asset.status = :status', { status: 'ACTIVE' })
      .andWhere('asset.expiry_time > :now', { now: new Date() })
      .getMany();

    // Check for keyword overlap
    for (const asset of similarAssets) {
      const keywordOverlap = this.calculateKeywordOverlap(
        asset.keywords || [],
        classification.keywords || []
      );

      if (keywordOverlap > 0.5) { // 50% keyword overlap threshold
        return asset;
      }
    }

    return null;
  }

  /**
   * Check if content meets thresholds for asset creation
   */
  private meetsCreationThresholds(classification: any): boolean {
    const minMomentum = this.config.get('MIN_MOMENTUM_THRESHOLD', 50);
    const minSentiment = this.config.get('MIN_SENTIMENT_THRESHOLD', -0.5);
    const maxRiskScore = this.config.get('MAX_RISK_SCORE', 0.5);

    return (
      classification.momentum >= minMomentum &&
      classification.sentiment >= minSentiment &&
      classification.riskScore <= maxRiskScore &&
      classification.safetyLevel === ContentSafetyLevel.SAFE
    );
  }

  /**
   * Generate unique symbol for asset
   */
  private generateSymbol(classification: any): string {
    const categoryPrefix = this.getCategoryPrefix(classification.category);
    const timestamp = Date.now().toString(36).toUpperCase();
    const hash = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${categoryPrefix}/SA_${timestamp}_${hash}`;
  }

  private getCategoryPrefix(category: ViralCategory): string {
    const prefixes = {
      [ViralCategory.CELEBEX]: 'CELEB',
      [ViralCategory.BRANDPULSE]: 'BRAND',
      [ViralCategory.EDUWAVE]: 'EDU',
      [ViralCategory.POLITIX]: 'POLITICS',
      [ViralCategory.ENTERTAIN360]: 'ENTERTAIN',
      [ViralCategory.TRENDBASE]: 'TREND'
    };
    return prefixes[category] || 'TREND';
  }

  /**
   * Generate human-readable asset name
   */
  private generateAssetName(content: SocialContent): string {
    // Extract key terms from content
    const keyTerms = content.hashtags?.slice(0, 3).map(tag => tag.replace('#', '')) || [];
    const authorName = content.author?.username || content.author?.displayName || 'Anonymous';

    if (keyTerms.length > 0) {
      return `${authorName}: ${keyTerms.join(' ')}`;
    }

    // Fallback to content excerpt
    const excerpt = content.text.substring(0, 50).trim();
    return `${authorName}: ${excerpt}${content.text.length > 50 ? '...' : ''}`;
  }

  /**
   * Generate asset description
   */
  private generateDescription(content: SocialContent, classification: any): string {
    const platformName = this.getPlatformName(content.platform);
    const categoryName = classification.category;
    const engagementCount = content.engagementMetrics?.total || 0;

    return `Viral ${categoryName} trend from ${platformName} with ${engagementCount.toLocaleString()} engagements. Sentiment: ${(classification.sentiment * 100).toFixed(1)}%, Momentum: ${classification.momentum.toFixed(1)}/100.`;
  }

  private getPlatformName(platform: SocialPlatform): string {
    const names = {
      [SocialPlatform.TWITTER]: 'Twitter/X',
      [SocialPlatform.TIKTOK]: 'TikTok',
      [SocialPlatform.INSTAGRAM]: 'Instagram',
      [SocialPlatform.YOUTUBE]: 'YouTube',
      [SocialPlatform.FACEBOOK]: 'Facebook'
    };
    return names[platform] || platform;
  }

  /**
   * Helper methods for classification logic
   */
  private async calculateSARelevance(content: SocialContent): Promise<number> {
    // Check for South African indicators
    const saKeywords = ['south africa', 'sa', 'johannesburg', 'cape town', 'pretoria', 'za'];
    const text = content.text.toLowerCase();

    let relevanceScore = 0;

    // Text-based relevance
    saKeywords.forEach(keyword => {
      if (text.includes(keyword)) relevanceScore += 0.3;
    });

    // Geographic relevance
    if (content.geolocation?.countryCode === 'ZA') {
      relevanceScore += 0.5;
    }

    // Language relevance
    const zaLanguages = ['en', 'af', 'zu', 'xh', 'st'];
    if (content.language && zaLanguages.includes(content.language)) {
      relevanceScore += 0.2;
    }

    return Math.min(relevanceScore, 1.0);
  }

  private adjustCategoryForPlatform(category: ViralCategory, platform: SocialPlatform): ViralCategory {
    const adjustments = {
      [SocialPlatform.TIKTOK]: {
        [ViralCategory.ENTERTAIN360]: ViralCategory.ENTERTAIN360, // Keep as is
        [ViralCategory.CELEBEX]: ViralCategory.CELEBEX // Keep as is
      },
      [SocialPlatform.TWITTER]: {
        [ViralCategory.POLITIX]: ViralCategory.POLITIX, // Keep as is
        [ViralCategory.BRANDPULSE]: ViralCategory.BRANDPULSE // Keep as is
      }
    };

    return adjustments[platform]?.[category] || category;
  }

  private calculateTimeBasedScore(content: SocialContent): number {
    const ageInHours = (Date.now() - content.timestamp.getTime()) / (1000 * 60 * 60);

    // Fresh content gets higher score
    if (ageInHours < 1) return 1.2;
    if (ageInHours < 6) return 1.0;
    if (ageInHours < 24) return 0.8;
    return 0.6;
  }

  private async calculateCrossPlatformBonus(content: SocialContent): Promise<number> {
    // Check for similar content on other platforms
    const crossPlatformScore = await this.socialDataService.findSimilarContent(content);

    // Bonus of up to 20 points for strong cross-platform presence
    return Math.min(crossPlatformScore * 20, 20);
  }

  private async calculateUpdatedMetrics(
    asset: ViralAsset,
    classification: any,
    content: SocialContent
  ): Promise<AssetMetrics> {
    // Weighted average of existing and new metrics
    const weight = 0.7; // Give 70% weight to existing metrics, 30% to new

    return {
      momentum: (asset.momentum_score * weight) + (classification.momentum * (1 - weight)),
      sentiment: (asset.sentiment_index * weight) + (classification.sentiment * (1 - weight)),
      viralityRate: (asset.virality_rate * weight) + (classification.viralityRate * (1 - weight)),
      engagementVelocity: (asset.engagement_velocity * weight) + (classification.engagementVelocity * (1 - weight)),
      reach: Math.max(asset.reach_estimate, classification.estimatedReach || 0)
    };
  }

  private hasSignificantChange(asset: ViralAsset, updatedMetrics: AssetMetrics): boolean {
    const momentumChange = Math.abs(asset.momentum_score - updatedMetrics.momentum);
    const sentimentChange = Math.abs(asset.sentiment_index - updatedMetrics.sentiment);

    return momentumChange > 10 || sentimentChange > 0.2;
  }

  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1.map(k => k.toLowerCase()));
    const set2 = new Set(keywords2.map(k => k.toLowerCase()));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Public methods for external services
   */
  async getActiveAssets(category?: ViralCategory): Promise<ViralAsset[]> {
    const query = this.assetRepository
      .createQueryBuilder('asset')
      .where('asset.status = :status', { status: 'ACTIVE' })
      .andWhere('asset.expiry_time > :now', { now: new Date() })
      .orderBy('asset.momentum_score', 'DESC');

    if (category) {
      query.andWhere('asset.category = :category', { category });
    }

    return query.getMany();
  }

  async getTrendingAssets(limit: number = 50): Promise<ViralAsset[]> {
    return this.assetRepository
      .createQueryBuilder('asset')
      .where('asset.status = :status', { status: 'ACTIVE' })
      .andWhere('asset.is_trending = :trending', { trending: true })
      .andWhere('asset.expiry_time > :now', { now: new Date() })
      .orderBy('asset.trending_rank', 'ASC')
      .limit(limit)
      .getMany();
  }

  async getAssetBySymbol(symbol: string): Promise<ViralAsset | null> {
    return this.assetRepository.findOne({
      where: { symbol },
      relations: ['price_history']
    });
  }

  async searchAssets(query: string, filters?: any): Promise<ViralAsset[]> {
    const queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .where('asset.status = :status', { status: 'ACTIVE' })
      .andWhere('asset.expiry_time > :now', { now: new Date() });

    // Text search
    if (query) {
      queryBuilder.andWhere(
        '(asset.name ILIKE :search OR asset.description ILIKE :search OR asset.keywords ILIKE :search)',
        { search: `%${query}%` }
      );
    }

    // Apply filters
    if (filters?.category) {
      queryBuilder.andWhere('asset.category = :category', { category: filters.category });
    }

    if (filters?.platform) {
      queryBuilder.andWhere(':platform = ANY(asset.current_platforms)', { platform: filters.platform });
    }

    if (filters?.minMomentum) {
      queryBuilder.andWhere('asset.momentum_score >= :minMomentum', { minMomentum: filters.minMomentum });
    }

    return queryBuilder
      .orderBy('asset.momentum_score', 'DESC')
      .limit(filters?.limit || 100)
      .getMany();
  }
}