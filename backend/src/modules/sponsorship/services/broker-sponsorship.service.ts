import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

// COMMENTED OUT (cross-module entity import): import { ViralAsset, ViralCategory } from "../../assets/entities/viral-asset.entity";
// COMMENTED OUT (cross-module entity import): import { Broker } from "../../brokers/entities/broker.entity";
// COMMENTED OUT (TypeORM entity deleted): import { Sponsorship, SponsorshipStatus, SponsorshipTier } from '../entities/sponsorship.entity';
// COMMENTED OUT (TypeORM entity deleted): import { SponsorshipAgreement } from '../entities/sponsorship-agreement.entity';
import { SponsorshipAnalytics } from '../interfaces/sponsorship.interface';
import { NotificationService } from "../../notifications/services/notification.service";
import { AuditService } from '../services/audit.service';
import { BillingService } from "../../billing/services/billing.service";

@Injectable()
export class BrokerSponsorshipService {
  private readonly logger = new Logger(BrokerSponsorshipService.name);

  constructor(
    private config: ConfigService,
    
        private notificationService: NotificationService,
    private auditService: AuditService,
    private billingService: BillingService,
    @InjectQueue('sponsorship-processing')
    private sponsorshipQueue: Queue,
    @InjectQueue('sponsorship-analytics')
    private analyticsQueue: Queue
  ) {}

  /**
   * Create a new sponsorship between broker and viral asset
   */
  async createSponsorship(
    brokerId: string,
    assetId: string,
    sponsorshipData: {
      tier: SponsorshipTier;
      duration: number; // in days
      budget: number;
      customTerms?: any;
    }
  ): Promise<Sponsorship> {
    try {
      this.logger.log(`Creating sponsorship: broker ${brokerId} for asset ${assetId}`);

      // Verify broker exists and is eligible for sponsorship
      const broker = await this.prisma.broker.findFirst({ where: { id: brokerId } });
      if (!broker) {
        throw new NotFoundException('Broker not found');
      }

      if (!broker.fscVerified) {
        throw new BadRequestException('Broker must be FSCA verified to sponsor assets');
      }

      // Verify asset exists and is eligible for sponsorship
      const asset = await this.prisma.asset.findFirst({ where: { id: assetId } });
      if (!asset) {
        throw new NotFoundException('Viral asset not found');
      }

      if (!asset.broker_interest) {
        throw new BadRequestException('Asset is not available for broker sponsorship');
      }

      // Check for existing active sponsorship
      const existingSponsorship = await this.prisma.sponsorshiprepository.findFirst({
        where: {
          brokerId,
          assetId,
          status: SponsorshipStatus.ACTIVE
        }
      });

      if (existingSponsorship) {
        throw new ConflictException('Asset already has an active sponsorship with this broker');
      }

      // Validate sponsorship tier and budget
      const tierConfig = this.getTierConfiguration(sponsorshipData.tier);
      if (sponsorshipData.budget < tierConfig.minBudget) {
        throw new BadRequestException(`Minimum budget for ${sponsorshipData.tier} tier is R${tierConfig.minBudget}`);
      }

      // Calculate sponsorship costs and terms
      const sponsorshipTerms = this.calculateSponsorshipTerms(
        sponsorshipData.tier,
        sponsorshipData.duration,
        sponsorshipData.budget,
        tierConfig
      );

      // Create sponsorship record
      const sponsorship = this.prisma.sponsorshiprepository.create({
        brokerId,
        assetId,
        tier: sponsorshipData.tier,
        status: SponsorshipStatus.PENDING,
        startDate: new Date(),
        endDate: new Date(Date.now() + sponsorshipData.duration * 24 * 60 * 60 * 1000),
        budget: sponsorshipData.budget,
        actualSpend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        terms: sponsorshipTerms,
        customTerms: sponsorshipData.customTerms,
        createdBy: brokerId
      });

      const savedSponsorship = await this.prisma.sponsorshiprepository.upsert(sponsorship);

      // Create sponsorship agreement
      const agreement = await this.createSponsorshipAgreement(savedSponsorship, broker, asset);

      // Queue sponsorship activation
      await this.sponsorshipQueue.add('activate-sponsorship', {
        sponsorshipId: savedSponsorship.id,
        agreementId: agreement.id
      }, {
        delay: 60000, // 1 minute delay for processing
        attempts: 3,
        backoff: 'exponential'
      });

      // Log audit trail
      await this.auditService.logSponsorshipCreation({
        sponsorshipId: savedSponsorship.id,
        brokerId,
        assetId,
        tier: sponsorshipData.tier,
        budget: sponsorshipData.budget,
        timestamp: new Date()
      });

      this.logger.log(`Sponsorship created successfully: ${savedSponsorship.id}`);

      return savedSponsorship;

    } catch (error) {
      this.logger.error('Failed to create sponsorship:', error);
      throw error;
    }
  }

  /**
   * Activate a sponsorship (automated or manual)
   */
  async activateSponsorship(sponsorshipId: string, activatedBy?: string): Promise<void> {
    try {
      const sponsorship = await this.prisma.sponsorshiprepository.findFirst({
        where: { id: sponsorshipId },
        relations: ['broker', 'asset']
      });

      if (!sponsorship) {
        throw new NotFoundException('Sponsorship not found');
      }

      if (sponsorship.status !== SponsorshipStatus.PENDING) {
        throw new BadRequestException('Sponsorship is not in pending status');
      }

      // Start database transaction
      await this.dataSource.transaction(async manager => {
        // Update sponsorship status
        await manager.update(Sponsorship, sponsorshipId, {
          status: SponsorshipStatus.ACTIVE,
          activatedAt: new Date(),
          activatedBy: activatedBy || 'SYSTEM'
        });

        // Update asset to show sponsorship
        await manager.update(ViralAsset, sponsorship.assetId, {
          sponsoring_brokers: [sponsorship.brokerId] // This would be handled by relation update
        });

        // Process initial payment
        await this.billingService.processSponsorshipPayment(sponsorshipId);
      });

      // Send notifications
      await this.notificationService.sendSponsorshipActivated({
        sponsorshipId,
        brokerId: sponsorship.brokerId,
        assetId: sponsorship.assetId,
        assetName: sponsorship.asset.name,
        brokerName: sponsorship.broker.name
      });

      // Start sponsorship analytics tracking
      await this.analyticsQueue.add('start-tracking', {
        sponsorshipId,
        startDate: new Date(),
        endDate: sponsorship.endDate
      });

      this.logger.log(`Sponsorship activated: ${sponsorshipId}`);

    } catch (error) {
      this.logger.error(`Failed to activate sponsorship ${sponsorshipId}:`, error);
      throw error;
    }
  }

  /**
   * Get sponsorships for a broker
   */
  async getBrokerSponsorships(
    brokerId: string,
    filters?: {
      status?: SponsorshipStatus;
      tier?: SponsorshipTier;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Sponsorship[]> {
    try {
      const query = this.sponsorshipRepository
        .createQueryBuilder('sponsorship')
        .leftJoinAndSelect('sponsorship.asset', 'asset')
        .leftJoinAndSelect('sponsorship.agreement', 'agreement')
        .where('sponsorship.brokerId = :brokerId', { brokerId });

      if (filters?.status) {
        query.andWhere('sponsorship.status = :status', { status: filters.status });
      }

      if (filters?.tier) {
        query.andWhere('sponsorship.tier = :tier', { tier: filters.tier });
      }

      if (filters?.startDate) {
        query.andWhere('sponsorship.startDate >= :startDate', { startDate: filters.startDate });
      }

      if (filters?.endDate) {
        query.andWhere('sponsorship.endDate <= :endDate', { endDate: filters.endDate });
      }

      return query.orderBy('sponsorship.createdAt', 'DESC').getMany();

    } catch (error) {
      this.logger.error(`Failed to get sponsorships for broker ${brokerId}:`, error);
      throw error;
    }
  }

  /**
   * Get sponsorship analytics
   */
  async getSponsorshipAnalytics(sponsorshipId: string): Promise<SponsorshipAnalytics> {
    try {
      const sponsorship = await this.prisma.sponsorshiprepository.findFirst({
        where: { id: sponsorshipId },
        relations: ['asset', 'broker']
      });

      if (!sponsorship) {
        throw new NotFoundException('Sponsorship not found');
      }

      // Calculate performance metrics
      const performanceMetrics = await this.calculatePerformanceMetrics(sponsorship);

      // Calculate ROI
      const roi = this.calculateROI(sponsorship, performanceMetrics);

      // Get engagement metrics
      const engagementMetrics = await this.getEngagementMetrics(sponsorship);

      // Get demographic insights
      const demographicInsights = await this.getDemographicInsights(sponsorship);

      // Get competitive analysis
      const competitiveAnalysis = await this.getCompetitiveAnalysis(sponsorship);

      return {
        sponsorshipId,
        performanceMetrics,
        roi,
        engagementMetrics,
        demographicInsights,
        competitiveAnalysis,
        recommendations: await this.generateRecommendations(sponsorship, performanceMetrics)
      };

    } catch (error) {
      this.logger.error(`Failed to get analytics for sponsorship ${sponsorshipId}:`, error);
      throw error;
    }
  }

  /**
   * Update sponsorship metrics (called by tracking systems)
   */
  async updateSponsorshipMetrics(
    sponsorshipId: string,
    metrics: {
      impressions?: number;
      clicks?: number;
      conversions?: number;
      spend?: number;
    }
  ): Promise<void> {
    try {
      const sponsorship = await this.prisma.sponsorshiprepository.findFirst({
        where: { id: sponsorshipId }
      });

      if (!sponsorship) {
        throw new NotFoundException('Sponsorship not found');
      }

      // Update cumulative metrics
      await this.prisma.sponsorshiprepository.update(sponsorshipId, {
        impressions: sponsorship.impressions + (metrics.impressions || 0),
        clicks: sponsorship.clicks + (metrics.clicks || 0),
        conversions: sponsorship.conversions + (metrics.conversions || 0),
        actualSpend: sponsorship.actualSpend + (metrics.spend || 0),
        lastMetricsUpdate: new Date()
      });

      // Check if budget is exhausted
      if (sponsorship.actualSpend >= sponsorship.budget * 0.95) {
        await this.sponsorshipQueue.add('budget-warning', {
          sponsorshipId,
          remainingBudget: sponsorship.budget - sponsorship.actualSpend
        });
      }

      // Track for real-time analytics
      await this.analyticsQueue.add('update-metrics', {
        sponsorshipId,
        metrics,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error(`Failed to update metrics for sponsorship ${sponsorshipId}:`, error);
    }
  }

  /**
   * Get sponsorship opportunities for brokers
   */
  async getSponsorshipOpportunities(
    brokerId: string,
    preferences?: {
      categories?: ViralCategory[];
      minMomentum?: number;
      maxBudget?: number;
      duration?: number;
    }
  ): Promise<{
    trendingAssets: ViralAsset[];
    recommendedAssets: ViralAsset[];
    categoryInsights: any;
  }> {
    try {
      const broker = await this.prisma.broker.findFirst({ where: { id: brokerId } });
      if (!broker) {
        throw new NotFoundException('Broker not found');
      }

      // Get trending assets available for sponsorship
      const trendingAssets = await this.assetRepository
        .createQueryBuilder('asset')
        .where('asset.broker_interest = :interest', { interest: true })
        .andWhere('asset.is_trending = :trending', { trending: true })
        .andWhere('asset.content_safety = :safe', { safe: 'SAFE' })
        .andWhere('asset.momentum_score > :threshold', { threshold: 70 })
        .orderBy('asset.momentum_score', 'DESC')
        .limit(20)
        .getMany();

      // Get recommended assets based on broker preferences
      let recommendedAssetsQuery = this.assetRepository
        .createQueryBuilder('asset')
        .where('asset.broker_interest = :interest', { interest: true })
        .andWhere('asset.content_safety = :safe', { safe: 'SAFE' })
        .andWhere('asset.momentum_score > :threshold', { threshold: preferences?.minMomentum || 50 });

      if (preferences?.categories?.length > 0) {
        recommendedAssetsQuery.andWhere('asset.category IN (:...categories)', {
          categories: preferences.categories
        });
      }

      const recommendedAssets = await recommendedAssetsQuery
        .orderBy('asset.momentum_score', 'DESC')
        .limit(10)
        .getMany();

      // Filter out assets already sponsored by this broker
      const sponsoredAssets = await this.getSponsoredAssets(brokerId);
      const sponsoredAssetIds = new Set(sponsoredAssets.map(asset => asset.id));

      const availableTrending = trendingAssets.filter(asset => !sponsoredAssetIds.has(asset.id));
      const availableRecommended = recommendedAssets.filter(asset => !sponsoredAssetIds.has(asset.id));

      // Get category insights
      const categoryInsights = await this.getCategoryInsights(availableRecommended, broker);

      return {
        trendingAssets: availableTrending,
        recommendedAssets: availableRecommended,
        categoryInsights
      };

    } catch (error) {
      this.logger.error(`Failed to get sponsorship opportunities for broker ${brokerId}:`, error);
      throw error;
    }
  }

  /**
   * Get assets sponsored by a broker
   */
  async getSponsoredAssets(brokerId: string): Promise<ViralAsset[]> {
    const sponsorships = await this.prisma.sponsorshiprepository.findMany({
      where: {
        brokerId,
        status: SponsorshipStatus.ACTIVE
      },
      relations: ['asset']
    });

    return sponsorships.map(sponsorship => sponsorship.asset);
  }

  /**
   * Helper methods
   */
  private getTierConfiguration(tier: SponsorshipTier): any {
    const configurations = {
      [SponsorshipTier.BASIC]: {
        minBudget: 5000,
        durationDays: 7,
        commissionRate: 0.15,
        features: ['basic_placement', 'analytics', 'support']
      },
      [SponsorshipTier.PREMIUM]: {
        minBudget: 15000,
        durationDays: 14,
        commissionRate: 0.12,
        features: ['featured_placement', 'advanced_analytics', 'dedicated_support', 'custom_branding']
      },
      [SponsorshipTier.ELITE]: {
        minBudget: 50000,
        durationDays: 30,
        commissionRate: 0.10,
        features: ['exclusive_placement', 'real_time_analytics', 'account_manager', 'white_label_options']
      }
    };

    return configurations[tier];
  }

  private calculateSponsorshipTerms(
    tier: SponsorshipTier,
    duration: number,
    budget: number,
    tierConfig: any
  ): any {
    return {
      durationDays: duration,
      totalBudget: budget,
      dailyBudget: budget / duration,
      commissionRate: tierConfig.commissionRate,
      features: tierConfig.features,
      performanceGuarantees: {
        minImpressions: budget * 100, // 100 impressions per rand
        minCTR: 0.02, // 2% click-through rate
        minEngagement: 0.01 // 1% engagement rate
      },
      paymentSchedule: {
        upfront: budget * 0.5, // 50% upfront
        milestone: budget * 0.3, // 30% at midpoint
        completion: budget * 0.2 // 20% on completion
      }
    };
  }

  private async createSponsorshipAgreement(
    sponsorship: Sponsorship,
    broker: Broker,
    asset: ViralAsset
  ): Promise<SponsorshipAgreement> {
    const agreement = this.prisma.agreementrepository.create({
      sponsorshipId: sponsorship.id,
      brokerId: broker.id,
      assetId: asset.id,
      terms: sponsorship.terms,
      status: 'PENDING_SIGNATURE',
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days to sign
    });

    return await this.prisma.agreementrepository.upsert(agreement);
  }

  private async calculatePerformanceMetrics(sponsorship: Sponsorship): Promise<any> {
    const daysActive = Math.floor((Date.now() - sponsorship.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyMetrics = {
      impressionsPerDay: sponsorship.impressions / Math.max(daysActive, 1),
      clicksPerDay: sponsorship.clicks / Math.max(daysActive, 1),
      spendPerDay: sponsorship.actualSpend / Math.max(daysActive, 1)
    };

    return {
      ...dailyMetrics,
      ctr: sponsorship.impressions > 0 ? sponsorship.clicks / sponsorship.impressions : 0,
      conversionRate: sponsorship.clicks > 0 ? sponsorship.conversions / sponsorship.clicks : 0,
      costPerClick: sponsorship.clicks > 0 ? sponsorship.actualSpend / sponsorship.clicks : 0,
      costPerConversion: sponsorship.conversions > 0 ? sponsorship.actualSpend / sponsorship.conversions : 0
    };
  }

  private calculateROI(sponsorship: Sponsorship, performanceMetrics: any): number {
    // Estimate revenue from conversions (would need business logic for conversion value)
    const estimatedRevenue = sponsorship.conversions * 250; // Assuming R250 per conversion
    const profit = estimatedRevenue - sponsorship.actualSpend;
    return sponsorship.actualSpend > 0 ? (profit / sponsorship.actualSpend) * 100 : 0;
  }

  private async getEngagementMetrics(sponsorship: Sponsorship): Promise<any> {
    // This would integrate with analytics systems
    return {
      averageSessionDuration: 180, // seconds
      bounceRate: 0.35,
      pagesPerSession: 2.5,
      returnVisitorRate: 0.25,
      socialShares: 45,
      comments: 23,
      likes: 156
    };
  }

  private async getDemographicInsights(sponsorship: Sponsorship): Promise<any> {
    // This would integrate with demographic data
    return {
      ageGroups: {
        '18-24': 0.25,
        '25-34': 0.45,
        '35-44': 0.20,
        '45-54': 0.07,
        '55+': 0.03
      },
      gender: {
        male: 0.48,
        female: 0.50,
        other: 0.02
      },
      locations: {
        'Gauteng': 0.35,
        'Western Cape': 0.25,
        'KwaZulu-Natal': 0.20,
        'Eastern Cape': 0.10,
        'Other': 0.10
      },
      interests: [
        'Technology',
        'Finance',
        'Entertainment',
        'Sports',
        'News'
      ]
    };
  }

  private async getCompetitiveAnalysis(sponsorship: Sponsorship): Promise<any> {
    // Get competitive data for similar sponsorships
    return {
      marketShare: 0.12,
      competitorPerformance: [
        { name: 'Competitor A', cpc: 2.50, ctr: 0.025 },
        { name: 'Competitor B', cpc: 2.20, ctr: 0.022 },
        { name: 'Competitor C', cpc: 2.80, ctr: 0.018 }
      ],
      industryAverage: {
        cpc: 2.50,
        ctr: 0.022,
        conversionRate: 0.015
      }
    };
  }

  private async generateRecommendations(sponsorship: Sponsorship, performanceMetrics: any): Promise<string[]> {
    const recommendations = [];

    if (performanceMetrics.ctr < 0.02) {
      recommendations.push('Consider optimizing creative assets to improve click-through rate');
    }

    if (performanceMetrics.conversionRate < 0.01) {
      recommendations.push('Review landing page experience to improve conversion rate');
    }

    if (performanceMetrics.costPerClick > 3.00) {
      recommendations.push('Consider adjusting targeting to reduce cost per click');
    }

    if (sponsorship.actualSpend < sponsorship.budget * 0.5) {
      recommendations.push('Budget underutilized - consider extending duration or increasing daily spend');
    }

    return recommendations;
  }

  private async getCategoryInsights(assets: ViralAsset[], broker: Broker): Promise<any> {
    const categoryDistribution = assets.reduce((acc, asset) => {
      acc[asset.category] = (acc[asset.category] || 0) + 1;
      return acc;
    }, {});

    const averageMomentumByCategory = {};
    for (const category of Object.keys(categoryDistribution)) {
      const categoryAssets = assets.filter(asset => asset.category === category);
      const avgMomentum = categoryAssets.reduce((sum, asset) => sum + asset.momentum_score, 0) / categoryAssets.length;
      averageMomentumByCategory[category] = avgMomentum;
    }

    return {
      distribution: categoryDistribution,
      averageMomentum: averageMomentumByCategory,
      brokerSpecialization: broker.specializedCategories || [],
      recommendations: Object.keys(categoryDistribution).map(category => ({
        category,
        opportunity: categoryDistribution[category],
        momentum: averageMomentumByCategory[category],
        recommended: broker.specializedCategories?.includes(category)
      }))
    };
  }
}
