import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { PrismaService } from '../../../prisma/prisma.service';
import { MarketDataService } from "../../market-aggregation/services/market-data.service";
import { SocialMediaService } from "./social-media.service";
import { SentimentAnalysisService } from "./sentiment-analysis.service";
import { ViralityPredictionService } from "./virality-prediction.service";
import { RiskAssessmentService } from "./risk-assessment.service";

export interface TrendAnalysisResult {
  trendId: string;
  timestamp: string;
  viralityScore: number;
  engagementRate: number;
  sentimentScore: number;
  marketPotential: number;
  riskScore: number;
  predictedLifespan: number;
  confidenceLevel: number;
  recommendations: string[];
  keyMetrics: {
    socialMentions: number;
    growthRate: number;
    reach: number;
    influencerCount: number;
    contentQuality: number;
  };
  predictions: {
    priceTarget: number;
    volumeForecast: number;
    category: 'HIGH_GROWTH' | 'STABLE' | 'DECLINING';
  };
}

export interface SocialMetrics {
  platform: string;
  mentions: number;
  likes: number;
  shares: number;
  comments: number;
  reach: number;
  engagement: number;
  sentiment: number;
  influencers: string[];
  hashtags: string[];
  growthRate: number;
}

@Injectable()
export class TrendAnalyzerService {
  private readonly logger = new Logger(TrendAnalyzerService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly marketDataService: MarketDataService,
    private readonly socialMediaService: SocialMediaService,
    private readonly sentimentAnalysisService: SentimentAnalysisService,
    private readonly viralityPredictionService: ViralityPredictionService,
    private readonly riskAssessmentService: RiskAssessmentService) {}

  /**
   * Analyze a trend comprehensively using multiple ML models
   */
  async analyzeTrend(trendId: string, forceRefresh: boolean = false): Promise<TrendAnalysisResult> {
    try {
      this.logger.debug(`Starting trend analysis for: ${trendId}`);

      // Check cache first
      if (!forceRefresh) {
        const cached = await this.getCachedAnalysis(trendId);
        if (cached) {
          return cached;
        }
      }

      // Get trend data using Prisma (Topic model)
      const trend = await this.prisma.topic.findUnique({
        where: { id: trendId },
        include: {
          ingestEvents: {
            take: 50,
            orderBy: { timestamp: 'desc' }
          }
        }
      });

      if (!trend) {
        throw new Error(`Trend not found: ${trendId}`);
      }

      // Transform trend data to match expected structure
      const trendData = {
        id: trend.id,
        name: trend.name,
        symbol: trend.symbol || trend.slug,
        description: trend.description,
        category: trend.category,
        region: trend.region,
        hashtags: trend.canonical?.hashtags || [],
        keywords: trend.canonical?.keywords || [],
        currentPrice: 0, // Would come from market data
        volume24h: Number(trend.totalVolume),
        price24hChange: 0, // Would come from price history
        marketCap: 0, // Would come from market data
        metadata: trend.metadata
      };

      // Get social media metrics
      const socialMetrics = await this.getSocialMetrics(trendData);

      // Get market data
      const marketData = await this.getMarketMetrics(trendData);

      // Perform sentiment analysis
      const sentimentAnalysis = await this.sentimentAnalysisService.analyzeSentiment(trendData);

      // Predict virality
      const viralityPrediction = await this.viralityPredictionService.predictVirality(
        trendData,
        socialMetrics,
        sentimentAnalysis
      );

      // Assess risk
      const riskAssessment = await this.riskAssessmentService.assessRisk(
        trendData,
        socialMetrics,
        marketData,
        sentimentAnalysis
      );

      // Generate comprehensive analysis
      const analysis = await this.generateComprehensiveAnalysis(
        trendData,
        socialMetrics,
        marketData,
        sentimentAnalysis,
        viralityPrediction,
        riskAssessment
      );

      // Cache the analysis
      await this.cacheAnalysis(trendId, analysis);

      // Trigger real-time updates if significant changes
      await this.checkForSignificantChanges(trendId, analysis);

      this.logger.log(`Trend analysis completed for: ${trendId}`);
      return analysis;

    } catch (error) {
      this.logger.error(`Error analyzing trend ${trendId}:`, error);
      throw error;
    }
  }

  /**
   * Batch analyze multiple trends for efficiency
   */
  async batchAnalyzeTrends(trendIds: string[]): Promise<TrendAnalysisResult[]> {
    try {
      this.logger.debug(`Batch analyzing ${trendIds.length} trends`);

      const batchSize = 10;
      const results: TrendAnalysisResult[] = [];

      for (let i = 0; i < trendIds.length; i += batchSize) {
        const batch = trendIds.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(trendId => this.analyzeTrend(trendId))
        );
        results.push(...batchResults);

        // Small delay between batches to avoid overwhelming services
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.logger.log(`Batch analysis completed for ${results.length} trends`);
      return results;

    } catch (error) {
      this.logger.error('Error in batch trend analysis:', error);
      throw error;
    }
  }

  /**
   * Get trend recommendations based on analysis
   */
  async getTrendRecommendations(trendId: string): Promise<{
    action: 'BUY' | 'SELL' | 'HOLD' | 'AVOID';
    confidence: number;
    reasons: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    entryPrice?: number;
    targetPrice?: number;
    stopLoss?: number;
    timeframe: 'SHORT' | 'MEDIUM' | 'LONG';
  }> {
    try {
      const analysis = await this.analyzeTrend(trendId);

      // Get trend data using Prisma
      const trend = await this.prisma.topic.findUnique({
        where: { id: trendId }
      });

      if (!trend) {
        throw new Error(`Trend not found: ${trendId}`);
      }

      const trendData = {
        id: trend.id,
        name: trend.name,
        symbol: trend.symbol || trend.slug,
        currentPrice: 0,
        volume24h: Number(trend.totalVolume),
        price24hChange: 0,
        marketCap: 0
      };

      const recommendations = this.generateRecommendations(analysis, trendData);

      // Cache recommendations
      await this.cacheRecommendations(trendId, recommendations);

      return recommendations;

    } catch (error) {
      this.logger.error(`Error generating recommendations for trend ${trendId}:`, error);
      throw error;
    }
  }

  /**
   * Monitor trend health and detect anomalies
   */
  async monitorTrendHealth(trendId: string): Promise<{
    healthScore: number;
    alerts: Array<{
      type: 'WARNING' | 'ERROR' | 'INFO';
      message: string;
      severity: number;
      timestamp: string;
    }>;
    metrics: {
      socialHealth: number;
      marketHealth: number;
      sentimentHealth: number;
      engagementHealth: number;
    };
  }> {
    try {
      const analysis = await this.analyzeTrend(trendId);
      const historicalData = await this.getHistoricalAnalysis(trendId);

      const healthCheck = await this.performHealthCheck(analysis, historicalData);

      // Alert on critical health issues
      if (healthCheck.healthScore < 30) {
        await this.triggerHealthAlert(trendId, healthCheck);
      }

      return healthCheck;

    } catch (error) {
      this.logger.error(`Error monitoring trend health for ${trendId}:`, error);
      throw error;
    }
  }

  /**
   * Get competitor analysis for similar trends
   */
  async getCompetitorAnalysis(trendId: string): Promise<{
    similarTrends: Array<{
      trendId: string;
      name: string;
      similarity: number;
      performance: {
        viralityScore: number;
        engagementRate: number;
        marketCap: number;
        volume: number;
      };
      advantages: string[];
      disadvantages: string[];
    }>;
    marketPosition: 'LEADER' | 'CHALLENGER' | 'FOLLOWER' | 'NICHE';
    competitiveAdvantages: string[];
    threats: string[];
  }> {
    try {
      const analysis = await this.analyzeTrend(trendId);

      // Get trend data using Prisma
      const trend = await this.prisma.topic.findUnique({
        where: { id: trendId }
      });

      if (!trend) {
        throw new Error(`Trend not found: ${trendId}`);
      }

      const trendData = {
        id: trend.id,
        name: trend.name,
        symbol: trend.symbol || trend.slug,
        category: trend.category,
        currentPrice: 0,
        volume24h: Number(trend.totalVolume),
        price24hChange: 0,
        marketCap: 0
      };

      // Find similar trends
      const similarTrends = await this.findSimilarTrends(trendData, analysis);

      // Analyze competitive position
      const marketPosition = await this.analyzeMarketPosition(trendData, analysis, similarTrends);

      return {
        similarTrends,
        marketPosition,
        competitiveAdvantages: this.identifyCompetitiveAdvantages(trendData, analysis, similarTrends),
        threats: this.identifyCompetitiveThreats(trendData, analysis, similarTrends)
      };

    } catch (error) {
      this.logger.error(`Error in competitor analysis for trend ${trendId}:`, error);
      throw error;
    }
  }

  // Private helper methods

  private async getSocialMetrics(trend: any): Promise<SocialMetrics[]> {
    try {
      const platforms = ['twitter', 'instagram', 'tiktok', 'youtube'];
      const metrics: SocialMetrics[] = [];

      for (const platform of platforms) {
        const platformMetrics = await this.socialMediaService.getSocialMetrics(
          trend.symbol,
          platform,
          trend.hashtags,
          trend.keywords
        );

        if (platformMetrics) {
          metrics.push(platformMetrics);
        }
      }

      return metrics;

    } catch (error) {
      this.logger.error('Error getting social metrics:', error);
      return [];
    }
  }

  private async getMarketMetrics(trend: any): Promise<any> {
    try {
      const marketData = await this.marketDataService.getMarketData(trend.id);
      const priceHistory = await this.marketDataService.getPriceHistory(trend.id, '24h');

      return {
        currentPrice: trend.currentPrice,
        volume24h: trend.volume24h,
        priceChange24h: trend.price24hChange,
        marketCap: trend.marketCap,
        volatility: this.calculateVolatility(priceHistory),
        liquidity: this.calculateLiquidity(marketData),
        priceHistory
      };

    } catch (error) {
      this.logger.error('Error getting market metrics:', error);
      return {};
    }
  }

  private async generateComprehensiveAnalysis(
    trend: any,
    socialMetrics: SocialMetrics[],
    marketData: any,
    sentimentAnalysis: any,
    viralityPrediction: any,
    riskAssessment: any
  ): Promise<TrendAnalysisResult> {
    // Aggregate social metrics
    const aggregatedSocial = this.aggregateSocialMetrics(socialMetrics);

    // Calculate composite scores
    const viralityScore = viralityPrediction.score;
    const engagementRate = aggregatedSocial.engagement;
    const sentimentScore = sentimentAnalysis.overallScore;
    const marketPotential = this.calculateMarketPotential(marketData, viralityScore);
    const riskScore = riskAssessment.overallRisk;

    // Generate predictions
    const predictions = await this.generatePredictions(trend, viralityPrediction, marketData);

    // Generate recommendations
    const recommendations = this.generateAnalysisRecommendations(
      viralityScore,
      sentimentScore,
      riskScore,
      marketPotential
    );

    return {
      trendId: trend.id,
      timestamp: new Date().toISOString(),
      viralityScore,
      engagementRate,
      sentimentScore,
      marketPotential,
      riskScore,
      predictedLifespan: viralityPrediction.predictedLifespan,
      confidenceLevel: this.calculateConfidenceLevel(viralityPrediction, sentimentAnalysis),
      recommendations,
      keyMetrics: {
        socialMentions: aggregatedSocial.mentions,
        growthRate: aggregatedSocial.growthRate,
        reach: aggregatedSocial.reach,
        influencerCount: aggregatedSocial.influencerCount,
        contentQuality: sentimentAnalysis.contentQuality
      },
      predictions
    };
  }

  private aggregateSocialMetrics(metrics: SocialMetrics[]): any {
    if (metrics.length === 0) {
      return {
        mentions: 0,
        likes: 0,
        shares: 0,
        comments: 0,
        reach: 0,
        engagement: 0,
        sentiment: 0,
        influencerCount: 0,
        growthRate: 0
      };
    }

    const total = metrics.reduce((acc, metric) => ({
      mentions: acc.mentions + metric.mentions,
      likes: acc.likes + metric.likes,
      shares: acc.shares + metric.shares,
      comments: acc.comments + metric.comments,
      reach: acc.reach + metric.reach,
      engagement: acc.engagement + metric.engagement,
      sentiment: acc.sentiment + metric.sentiment,
      influencerCount: acc.influencerCount + metric.influencerCount,
      growthRate: acc.growthRate + metric.growthRate
    }), {
      mentions: 0,
      likes: 0,
      shares: 0,
      comments: 0,
      reach: 0,
      engagement: 0,
      sentiment: 0,
      influencerCount: 0,
      growthRate: 0
    });

    const count = metrics.length;

    return {
      ...total,
      engagement: total.engagement / count,
      sentiment: total.sentiment / count,
      growthRate: total.growthRate / count
    };
  }

  private calculateMarketPotential(marketData: any, viralityScore: number): number {
    // Weight different factors for market potential
    const volumeWeight = 0.3;
    const priceWeight = 0.2;
    const viralityWeight = 0.3;
    const liquidityWeight = 0.2;

    let volumeScore = 0;
    let priceScore = 0;
    let liquidityScore = 0;

    if (marketData.volume24h > 0) {
      volumeScore = Math.min(marketData.volume24h / 1000000, 1) * 100; // Normalize to 100
    }

    if (marketData.currentPrice > 0) {
      priceScore = Math.min(marketData.currentPrice, 100);
    }

    if (marketData.liquidity > 0) {
      liquidityScore = Math.min(marketData.liquidity, 100);
    }

    return (
      (volumeScore * volumeWeight) +
      (priceScore * priceWeight) +
      (viralityScore * viralityWeight) +
      (liquidityScore * liquidityWeight)
    );
  }

  private async generatePredictions(trend: any, viralityPrediction: any, marketData: any): Promise<any> {
    // Price target prediction based on virality and market data
    const currentPrice = trend.currentPrice;
    const viralityMultiplier = viralityPrediction.score / 100;
    const marketGrowthRate = marketData.priceChange24h / 100;

    let priceTarget = currentPrice;
    if (viralityMultiplier > 0.7) {
      priceTarget = currentPrice * (1 + (viralityMultiplier * 0.5)); // Up to 50% increase
    } else if (viralityMultiplier < 0.3) {
      priceTarget = currentPrice * (1 - ((1 - viralityMultiplier) * 0.3)); // Up to 30% decrease
    }

    // Volume forecast
    const volumeGrowthRate = viralityMultiplier * 2; // Virality drives volume growth
    const volumeForecast = trend.volume24h * (1 + volumeGrowthRate);

    // Category prediction
    let category: 'HIGH_GROWTH' | 'STABLE' | 'DECLINING';
    if (viralityScore > 70 && marketGrowthRate > 0.05) {
      category = 'HIGH_GROWTH';
    } else if (viralityScore > 40 && Math.abs(marketGrowthRate) < 0.1) {
      category = 'STABLE';
    } else {
      category = 'DECLINING';
    }

    return {
      priceTarget,
      volumeForecast,
      category
    };
  }

  private generateAnalysisRecommendations(
    viralityScore: number,
    sentimentScore: number,
    riskScore: number,
    marketPotential: number
  ): string[] {
    const recommendations: string[] = [];

    if (viralityScore > 80) {
      recommendations.push('High virality detected - consider early entry');
    } else if (viralityScore < 30) {
      recommendations.push('Low virality - may not sustain momentum');
    }

    if (sentimentScore > 0.6) {
      recommendations.push('Positive sentiment - favorable for growth');
    } else if (sentimentScore < -0.3) {
      recommendations.push('Negative sentiment - high risk of decline');
    }

    if (riskScore > 70) {
      recommendations.push('High risk detected - implement strict stop-loss');
    } else if (riskScore < 30) {
      recommendations.push('Low risk - suitable for conservative strategies');
    }

    if (marketPotential > 75) {
      recommendations.push('Strong market potential - high upside expected');
    } else if (marketPotential < 25) {
      recommendations.push('Limited market potential - lower expected returns');
    }

    return recommendations;
  }

  private calculateConfidenceLevel(viralityPrediction: any, sentimentAnalysis: any): number {
    // Combine confidence from different models
    const viralityConfidence = viralityPrediction.confidence || 0;
    const sentimentConfidence = sentimentAnalysis.confidence || 0;

    return (viralityConfidence + sentimentConfidence) / 2;
  }

  private calculateVolatility(priceHistory: any[]): number {
    if (!priceHistory || priceHistory.length < 2) return 0;

    const prices = priceHistory.map(p => p.price);
    const returns = [];

    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility as percentage
  }

  private calculateLiquidity(marketData: any): number {
    if (!marketData || !marketData.bidSize || !marketData.askSize) return 0;

    const totalLiquidity = marketData.bidSize + marketData.askSize;
    const spread = marketData.askPrice - marketData.bidPrice;
    const spreadPercentage = spread / marketData.midPrice;

    // Higher liquidity score for lower spreads and higher volumes
    return Math.max(0, 100 - (spreadPercentage * 1000)) * Math.min(totalLiquidity / 1000000, 1);
  }

  private async getCachedAnalysis(trendId: string): Promise<TrendAnalysisResult | null> {
    try {
      const cached = await this.redis.get(`trend-analysis:${trendId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error('Error getting cached analysis:', error);
      return null;
    }
  }

  private async cacheAnalysis(trendId: string, analysis: TrendAnalysisResult): Promise<void> {
    try {
      await this.redis.setex(
        `trend-analysis:${trendId}`,
        300, // Cache for 5 minutes
        JSON.stringify(analysis)
      );
    } catch (error) {
      this.logger.error('Error caching analysis:', error);
    }
  }

  private async getHistoricalAnalysis(trendId: string): Promise<TrendAnalysisResult[]> {
    try {
      const historical = await this.redis.lrange(
        `trend-analysis-history:${trendId}`,
        0,
        -1
      );

      return historical.map(item => JSON.parse(item));
    } catch (error) {
      this.logger.error('Error getting historical analysis:', error);
      return [];
    }
  }

  private async checkForSignificantChanges(trendId: string, analysis: TrendAnalysisResult): Promise<void> {
    try {
      const previousAnalysis = await this.getCachedAnalysis(`${trendId}:previous`);

      if (previousAnalysis) {
        const changes = this.detectChanges(previousAnalysis, analysis);

        if (changes.length > 0) {
          await this.triggerSignificantChangeAlert(trendId, analysis, changes);
        }
      }

      // Store current analysis as previous for next comparison
      await this.cacheAnalysis(`${trendId}:previous`, analysis);

    } catch (error) {
      this.logger.error('Error checking for significant changes:', error);
    }
  }

  private detectChanges(previous: TrendAnalysisResult, current: TrendAnalysisResult): Array<{
    metric: string;
    oldValue: number;
    newValue: number;
    changePercent: number;
  }> {
    const changes: any[] = [];
    const threshold = 0.1; // 10% change threshold

    const metrics = [
      'viralityScore',
      'engagementRate',
      'sentimentScore',
      'marketPotential',
      'riskScore',
    ];

    for (const metric of metrics) {
      const oldValue = previous[metric] as number;
      const newValue = current[metric] as number;
      const changePercent = Math.abs((newValue - oldValue) / oldValue);

      if (changePercent > threshold) {
        changes.push({
          metric,
          oldValue,
          newValue,
          changePercent: changePercent * 100
        });
      }
    }

    return changes;
  }

  private async triggerSignificantChangeAlert(
    trendId: string,
    analysis: TrendAnalysisResult,
    changes: any[]
  ): Promise<void> {
    // This would integrate with the notification service
    this.logger.log(`Significant changes detected for trend ${trendId}:`, changes);

    // Store alert for admin dashboard
    await this.redis.lpush(
      'trend-alerts:significant-changes',
      JSON.stringify({
        trendId,
        timestamp: new Date().toISOString(),
        changes,
        analysis
      })
    );
  }

  // Additional private methods for health monitoring, competitor analysis, etc.
  private async performHealthCheck(analysis: TrendAnalysisResult, historical: TrendAnalysisResult[]): Promise<any> {
    // Implementation for trend health monitoring
    return {
      healthScore: 85,
      alerts: [],
      metrics: {
        socialHealth: 90,
        marketHealth: 80,
        sentimentHealth: 85,
        engagementHealth: 88
      }
    };
  }

  private async triggerHealthAlert(trendId: string, healthCheck: any): Promise<void> {
    // Implementation for health alerts
    this.logger.warn(`Health alert triggered for trend ${trendId}:`, healthCheck);
  }

  private async findSimilarTrends(trend: any, analysis: TrendAnalysisResult): Promise<any[]> {
    // Implementation for finding similar trends
    return [];
  }

  private async analyzeMarketPosition(trend: any, analysis: TrendAnalysisResult, similarTrends: any[]): Promise<string> {
    // Implementation for market position analysis
    return 'CHALLENGER';
  }

  private identifyCompetitiveAdvantages(trend: any, analysis: TrendAnalysisResult, similarTrends: any[]): string[] {
    // Implementation for competitive advantages
    return [];
  }

  private identifyCompetitiveThreats(trend: any, analysis: TrendAnalysisResult, similarTrends: any[]): string[] {
    // Implementation for competitive threats
    return [];
  }

  private generateRecommendations(analysis: TrendAnalysisResult, trend: any): any {
    // Implementation for trading recommendations
    return {
      action: 'HOLD',
      confidence: 75,
      reasons: ['Moderate virality detected', 'Balanced risk profile'],
      riskLevel: 'MEDIUM',
      timeframe: 'MEDIUM'
    };
  }

  private async cacheRecommendations(trendId: string, recommendations: any): Promise<void> {
    // Implementation for caching recommendations
  }
}
