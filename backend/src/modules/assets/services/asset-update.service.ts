import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, Interval } from '@nestjs/schedule';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from "../../../prisma/prisma.service";

// COMMENTED OUT (TypeORM entity deleted): import { ViralAsset, SocialPlatform } from '../entities/viral-asset.entity';
import { AssetMetrics } from '../interfaces/classification.interface';
import { SocialDataService } from '../services/social-data.service';
import { NLPService } from "../../nlp/services/nlp.service";
import { PricingEngineService } from "./pricing-engine.service";
import { WebSocketGatewayHandler } from "../../websocket/gateways/websocket.gateway";
import { NotificationService } from "../../notifications/services/notification.service";

@Injectable()
export class AssetUpdateService implements OnModuleInit {
  private readonly logger = new Logger(AssetUpdateService.name);
  private readonly assetMetricsCache = new Map<string, AssetMetrics>();
  private readonly priceUpdateCache = new Map<string, { price: number; timestamp: Date }>();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private socialDataService: SocialDataService,
    private nlpService: NLPService,
    private pricingEngine: PricingEngineService,
    private websocketGateway: WebSocketGatewayHandler,
    private notificationService: NotificationService,
    @InjectQueue('asset-updates')
    private assetUpdateQueue: Queue,
    @InjectQueue('price-calculation')
    private priceCalculationQueue: Queue,
    @InjectQueue('market-notifications')
    private marketNotificationQueue: Queue
  ) {}

  onModuleInit() {
    this.logger.log('Asset Update Service initialized');
    this.initializeCaches();
  }

  /**
   * Initialize caches with current asset data
   */
  private async initializeCaches(): Promise<void> {
    try {
      const activeAssets = await this.prisma.viralAsset.findMany({
        where: { status: 'ACTIVE' }
      });

      for (const asset of activeAssets) {
        this.assetMetricsCache.set(asset.id, {
          momentum: asset.momentum_score || 0,
          sentiment: asset.sentiment_index || 0,
          viralityRate: asset.virality_rate || 0,
          engagementVelocity: asset.engagement_velocity || 0,
          reach: asset.reach_estimate || 0
        });

        this.priceUpdateCache.set(asset.id, {
          price: asset.current_price || 0,
          timestamp: new Date()
        });
      }

      this.logger.log(`Initialized caches for ${activeAssets.length} assets`);
    } catch (error) {
      this.logger.error('Failed to initialize caches:', error);
    }
  }

  /**
   * Update asset metrics in real-time (every 30 seconds)
   */
  @Cron('*/30 * * * *')
  async updateAssetMetrics(): Promise<void> {
    try {
      this.logger.debug('Starting asset metrics update cycle');

      const activeAssets = await this.getActiveAssetsForUpdate();

      if (activeAssets.length === 0) {
        this.logger.debug('No active assets to update');
        return;
      }

      // Process assets in parallel batches
      const batchSize = 10;
      const batches = this.createBatches(activeAssets, batchSize);

      for (const batch of batches) {
        await Promise.all(
          batch.map(asset => this.updateSingleAssetMetrics(asset))
        );
      }

      this.logger.log(`Updated metrics for ${activeAssets.length} assets`);

    } catch (error) {
      this.logger.error('Failed to update asset metrics:', error);
    }
  }

  /**
   * Update prices for high-momentum assets (every 10 seconds)
   */
  @Interval(10000)
  async updateHighMomentumPrices(): Promise<void> {
    try {
      const highMomentumAssets = await this.prisma.viralAsset.findMany({
        where: {
          momentum_score: { gt: 80 },
          status: 'ACTIVE'
        }
      });

      if (highMomentumAssets.length === 0) {
        return;
      }

      // Queue price updates for high-momentum assets
      for (const asset of highMomentumAssets) {
        await this.priceCalculationQueue.add('calculate-price', {
          assetId: asset.id,
          forceUpdate: true,
          highFrequency: true
        }, {
          delay: Math.random() * 2000, // Stagger updates
          removeOnComplete: true
        });
      }

      this.logger.debug(`Queued price updates for ${highMomentumAssets.length} high-momentum assets`);

    } catch (error) {
      this.logger.error('Failed to queue high-momentum price updates:', error);
    }
  }

  /**
   * Analyze trending assets and update rankings (every 2 minutes)
   */
  @Cron('*/2 * * * *')
  async updateTrendingRankings(): Promise<void> {
    try {
      const trendingAssets = await this.prisma.viralAsset.findMany({
        where: {
          momentum_score: { gt: 60 },
          status: 'ACTIVE',
          is_trending: true
        },
        orderBy: {
          momentum_score: 'desc'
        }
      });

      // Update trending rankings
      for (let i = 0; i < trendingAssets.length; i++) {
        const asset = trendingAssets[i];

        // Only update if ranking changed significantly
        if (asset.trending_rank !== i + 1 ||
            Math.abs(asset.trending_rank - (i + 1)) > 5) {

          await this.prisma.viralAsset.update({
            where: { id: asset.id },
            data: {
              trending_rank: i + 1,
              updated_at: new Date()
            }
          });

          // Notify about significant ranking changes
          if (asset.trending_rank && Math.abs(asset.trending_rank - (i + 1)) > 10) {
            await this.notificationService.sendTrendingAlert({
              assetId: asset.id,
              symbol: asset.symbol,
              previousRank: asset.trending_rank,
              newRank: i + 1,
              change: asset.trending_rank - (i + 1)
            });
          }
        }
      }

      // Remove trending status from assets below threshold
      const demoteThreshold = 50;
      const assetsToDemote = await this.prisma.viralAsset.findMany({
        where: {
          momentum_score: { lt: demoteThreshold },
          is_trending: true
        }
      });

      if (assetsToDemote.length > 0) {
        await this.prisma.viralAsset.updateMany({
          where: {
            id: { in: assetsToDemote.map(a => a.id) }
          },
          data: {
            is_trending: false,
            trending_rank: null,
            updated_at: new Date()
          }
        });

        this.logger.log(`Demoted ${assetsToDemote.length} assets from trending status`);
      }

      // Promote new assets to trending
      const promoteThreshold = 75;
      const assetsToPromote = await this.prisma.viralAsset.findMany({
        where: {
          momentum_score: { gte: promoteThreshold },
          is_trending: false,
          status: 'ACTIVE'
        },
        orderBy: {
          momentum_score: 'desc'
        },
        take: 10 // Top 10 new trending assets
      });

      if (assetsToPromote.length > 0) {
        const maxCurrentRank = trendingAssets.length > 0 ?
          Math.max(...trendingAssets.map(a => a.trending_rank || 0)) : 0;

        for (let i = 0; i < assetsToPromote.length; i++) {
          const asset = assetsToPromote[i];
          await this.prisma.viralAsset.update({
            where: { id: asset.id },
            data: {
              is_trending: true,
              trending_rank: maxCurrentRank + i + 1,
              updated_at: new Date()
            }
          });
        }

        this.logger.log(`Promoted ${assetsToPromote.length} assets to trending status`);
      }

    } catch (error) {
      this.logger.error('Failed to update trending rankings:', error);
    }
  }

  /**
   * Update metrics for a single asset
   */
  private async updateSingleAssetMetrics(asset: ViralAsset): Promise<void> {
    try {
      // Get current cached metrics
      const cachedMetrics = this.assetMetricsCache.get(asset.id);

      // Fetch new metrics from social platforms
      const updatedMetrics = await this.calculateUpdatedMetrics(asset);

      // Calculate delta changes
      const deltas = this.calculateMetricDeltas(cachedMetrics, updatedMetrics);

      // Update cache
      this.assetMetricsCache.set(asset.id, updatedMetrics);

      // Check for significant changes
      if (this.hasSignificantChange(deltas)) {
        await this.processSignificantChange(asset, updatedMetrics, deltas);
      }

      // Update asset in database
      await this.prisma.viralAsset.update({
        where: { id: asset.id },
        data: {
          momentum_score: updatedMetrics.momentum,
          sentiment_index: updatedMetrics.sentiment,
          virality_rate: updatedMetrics.viralityRate,
          engagement_velocity: updatedMetrics.engagementVelocity,
          reach_estimate: updatedMetrics.reach,
          updated_at: new Date(),
          is_trending: updatedMetrics.momentum > 70
        }
      });

      // Broadcast real-time updates
      this.websocketGateway.broadcastAssetUpdate(asset.id, {
        metrics: updatedMetrics,
        deltas,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error(`Failed to update metrics for asset ${asset.id}:`, error);
    }
  }

  /**
   * Calculate updated metrics from social data
   */
  private async calculateUpdatedMetrics(asset: ViralAsset): Promise<AssetMetrics> {
    try {
      // Fetch real-time data from all active platforms
      const platformData = await Promise.all(
        asset.current_platforms.map(platform =>
          this.socialDataService.getPlatformMetrics(asset.trend_id, platform)
        )
      );

      // Aggregate platform data
      const aggregatedData = this.aggregatePlatformData(platformData);

      // Calculate sentiment analysis
      const sentimentAnalysis = await this.calculateRealTimeSentiment(asset);

      // Calculate momentum score
      const momentum = this.calculateMomentumScore(aggregatedData);

      // Calculate virality rate
      const viralityRate = this.calculateViralityRate(aggregatedData);

      // Calculate engagement velocity
      const engagementVelocity = this.calculateEngagementVelocity(aggregatedData);

      // Calculate reach estimate
      const reach = this.calculateReachEstimate(aggregatedData);

      return {
        momentum,
        sentiment: sentimentAnalysis,
        viralityRate,
        engagementVelocity,
        reach
      };

    } catch (error) {
      this.logger.error(`Failed to calculate updated metrics for asset ${asset.id}:`, error);
      // Return cached metrics as fallback
      return this.assetMetricsCache.get(asset.id) || {
        momentum: asset.momentum_score,
        sentiment: asset.sentiment_index,
        viralityRate: asset.virality_rate,
        engagementVelocity: asset.engagement_velocity,
        reach: asset.reach_estimate
      };
    }
  }

  /**
   * Process significant asset changes
   */
  private async processSignificantChange(
    asset: ViralAsset,
    updatedMetrics: AssetMetrics,
    deltas: any
  ): Promise<void> {
    try {
      // Trigger price recalculation for significant momentum changes
      if (Math.abs(deltas.momentum) > 10) {
        await this.priceCalculationQueue.add('calculate-price', {
          assetId: asset.id,
          newMomentum: updatedMetrics.momentum,
          newSentiment: updatedMetrics.sentiment,
          forceUpdate: true
        });
      }

      // Send alerts for extreme sentiment shifts
      if (Math.abs(deltas.sentiment) > 0.3) {
        await this.marketNotificationQueue.add('sentiment-alert', {
          assetId: asset.id,
          symbol: asset.symbol,
          sentimentChange: deltas.sentiment,
          currentSentiment: updatedMetrics.sentiment,
          timestamp: new Date()
        });
      }

      // Notify brokers of significant changes
      if (Math.abs(deltas.momentum) > 20) {
        await this.notificationService.sendAssetAlert({
          type: 'SIGNIFICANT_MOMENTUM_CHANGE',
          assetId: asset.id,
          symbol: asset.symbol,
          change: deltas.momentum,
          currentValue: updatedMetrics.momentum
        });
      }

      this.logger.log(`Processed significant change for ${asset.symbol}: momentum ${deltas.momentum.toFixed(2)}, sentiment ${deltas.sentiment.toFixed(3)}`);

    } catch (error) {
      this.logger.error(`Failed to process significant change for asset ${asset.id}:`, error);
    }
  }

  /**
   * Calculate real-time sentiment analysis
   */
  private async calculateRealTimeSentiment(asset: ViralAsset): Promise<number> {
    try {
      // Get recent content for sentiment analysis
      const recentContent = await this.socialDataService.getRecentContent(
        asset.trend_id,
        asset.current_platforms,
        100 // Last 100 content pieces
      );

      if (recentContent.length === 0) {
        return asset.sentiment_index; // Return existing sentiment if no new content
      }

      // Analyze sentiment of all content
      const sentimentAnalyses = await Promise.all(
        recentContent.map(content =>
          this.nlpService.analyzeSentiment(content.text)
        )
      );

      // Calculate weighted average sentiment
      const totalWeight = sentimentAnalyses.reduce((sum, analysis) =>
        sum + (analysis.confidence * (recentContent.find(c => c.text === analysis.text)?.engagementMetrics?.total || 1)),
        0
      );

      const weightedSentiment = sentimentAnalyses.reduce((sum, analysis) => {
        const content = recentContent.find(c => c.text === analysis.text);
        const weight = analysis.confidence * (content?.engagementMetrics?.total || 1);
        return sum + (analysis.sentiment * weight);
      }, 0) / totalWeight;

      return weightedSentiment;

    } catch (error) {
      this.logger.error(`Failed to calculate sentiment for asset ${asset.id}:`, error);
      return asset.sentiment_index;
    }
  }

  /**
   * Helper methods for metric calculations
   */
  private async getActiveAssetsForUpdate(): Promise<any[]> {
    return this.prisma.viralAsset.findMany({
      where: {
        status: 'ACTIVE',
        expiry_time: { gt: new Date() }
      }
    });
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private aggregatePlatformData(platformData: any[]): any {
    return platformData.reduce((acc, data) => ({
      totalPosts: acc.totalPosts + (data.posts || 0),
      totalEngagement: acc.totalEngagement + (data.engagement || 0),
      totalReach: acc.totalReach + (data.reach || 0),
      totalShares: acc.totalShares + (data.shares || 0),
      totalComments: acc.totalComments + (data.comments || 0),
      averageSentiment: (acc.averageSentiment + data.sentiment) / 2,
      platformCount: acc.platformCount + 1
    }), {
      totalPosts: 0,
      totalEngagement: 0,
      totalReach: 0,
      totalShares: 0,
      totalComments: 0,
      averageSentiment: 0,
      platformCount: 0
    });
  }

  private calculateMomentumScore(data: any): number {
    // Momentum score based on posting rate, engagement rate, and growth
    const postingRate = data.totalPosts / data.platformCount;
    const engagementRate = data.totalEngagement / Math.max(data.totalPosts, 1);
    const growthRate = this.calculateGrowthRate(data);

    const momentum = (postingRate * 0.3) + (engagementRate * 0.4) + (growthRate * 0.3);
    return Math.min(Math.max(momentum, 0), 100);
  }

  private calculateViralityRate(data: any): number {
    // Virality rate based on share velocity and cross-platform spread
    const shareVelocity = data.totalShares / Math.max(data.totalPosts, 1);
    const crossPlatformFactor = Math.log(data.platformCount + 1) / Math.log(5); // Normalize to max 5 platforms

    return shareVelocity * crossPlatformFactor * 60; // Convert to per-hour rate
  }

  private calculateEngagementVelocity(data: any): number {
    // Engagement velocity based on comment and interaction rates
    const commentRate = data.totalComments / Math.max(data.totalPosts, 1);
    const engagementDepth = data.totalEngagement / Math.max(data.totalReach, 1);

    return (commentRate * 0.6) + (engagementDepth * 0.4);
  }

  private calculateReachEstimate(data: any): number {
    // Estimate unique reach based on platform data
    const organicReach = data.totalReach;
    const viralMultiplier = Math.log(data.totalShares + 1) * 0.5;

    return Math.round(organicReach * (1 + viralMultiplier));
  }

  private calculateGrowthRate(data: any): number {
    // Calculate growth rate based on recent trends
    // This would typically compare current data with historical data
    return 0.5; // Placeholder - would implement actual growth calculation
  }

  private calculateMetricDeltas(oldMetrics: AssetMetrics, newMetrics: AssetMetrics): any {
    return {
      momentum: newMetrics.momentum - oldMetrics.momentum,
      sentiment: newMetrics.sentiment - oldMetrics.sentiment,
      viralityRate: newMetrics.viralityRate - oldMetrics.viralityRate,
      engagementVelocity: newMetrics.engagementVelocity - oldMetrics.engagementVelocity,
      reach: newMetrics.reach - oldMetrics.reach
    };
  }

  private hasSignificantChange(deltas: any): boolean {
    return (
      Math.abs(deltas.momentum) > 5 ||
      Math.abs(deltas.sentiment) > 0.1 ||
      Math.abs(deltas.viralityRate) > 10 ||
      Math.abs(deltas.engagementVelocity) > 0.2 ||
      Math.abs(deltas.reach) > 10000
    );
  }

  /**
   * Public API methods
   */
  async getAssetMetrics(assetId: string): Promise<AssetMetrics | null> {
    return this.assetMetricsCache.get(assetId) || null;
  }

  async forceUpdateAsset(assetId: string): Promise<void> {
    const asset = await this.prisma.viralAsset.findFirst({ where: { id: assetId } });
    if (asset) {
      await this.updateSingleAssetMetrics(asset);
    }
  }

  async getTrendingAssets(limit: number = 50): Promise<any[]> {
    return this.prisma.viralAsset.findMany({
      where: {
        is_trending: true,
        status: 'ACTIVE'
      },
      orderBy: {
        trending_rank: 'asc'
      },
      take: limit
    });
  }

  async getHighMomentumAssets(threshold: number = 80): Promise<any[]> {
    return this.prisma.viralAsset.findMany({
      where: {
        momentum_score: { gt: threshold },
        status: 'ACTIVE'
      },
      orderBy: {
        momentum_score: 'desc'
      }
    });
  }
}
