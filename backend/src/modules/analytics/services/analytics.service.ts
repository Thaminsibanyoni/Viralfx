import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';

// TypeORM entities removed - using Prisma instead
// import { MarketData } from "../../../database/entities/market-data.entity";
// import { PerformanceMetric } from "../../../database/entities/performance-metric.entity";
// import { Trend } from "../../../database/entities/trend.entity";
// WebSocketGateway import removed - not a valid NestJS injection pattern
// import { WebSocketGatewayHandler } from "../../websocket/gateways/websocket.gateway";
import {
  AnalyticsQuery,
  AnalyticsData,
  PerformanceMetrics,
  TrendAnalytics,
  DashboardData,
  AnalyticsDataPoint,
  Prediction,
  RiskFactor,
  Alert
} from '../interfaces/analytics.interface';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    // TypeORM repositories removed - using Prisma instead
    @Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Find trend by symbol (name)
   */
  async findTrendBySymbol(symbol: string): Promise<{ id: string; topicName: string } | null> {
    try {
      // Try to find in TypeORM Trend entity first
      const trend = await this.prisma.trend.findFirst({
        where: { topicName: symbol }
      });

      if (trend) {
        return { id: trend.id, topicName: trend.topicName };
      }

      // Fallback to Prisma Topic model
      const topic = await this.prisma.topic.findFirst({
        where: {
          OR: [
            { name: symbol },
            { slug: symbol.toUpperCase() }
          ]
        }
      });

      if (topic) {
        return { id: topic.id, topicName: topic.name };
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to find trend by symbol ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get analytics data for a symbol
   */
  async getAnalyticsData(query: AnalyticsQuery): Promise<AnalyticsData> {
    try {
      const cacheKey = `analytics:${query.symbol}:${query.interval || '1h'}:${query.startTime?.getTime()}:${query.endTime?.getTime()}`;
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for analytics data: ${cacheKey}`);
        return JSON.parse(cachedData);
      }

      const endTime = query.endTime || new Date();
      const startTime = query.startTime || new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24h default
      const interval = query.interval || '1h';

      // Query MarketData
      const marketData = await this.prisma.marketdatarepository.findMany({
        where: {
          symbol: query.symbol,
          interval,
          timestamp: {
            $gte: startTime,
            $lte: endTime
          }
        },
        order: { timestamp: 'ASC' }
      });

      // If no MarketData, fall back to ViralIndexSnapshot
      let data = marketData;
      if (data.length === 0) {
        data = await this.getViralIndexData(query.symbol, startTime, endTime);
      }

      // Aggregate data based on requested metrics
      const aggregatedData = this.aggregateData(data, query);

      const result: AnalyticsData = {
        symbol: query.symbol,
        timeframe: {
          startTime,
          endTime,
          interval
        },
        data: aggregatedData,
        metadata: {
          totalPoints: aggregatedData.length,
          hasGaps: this.detectGaps(aggregatedData),
          source: marketData.length > 0 ? 'market_data' : 'viral_index_snapshot'
        }
      };

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(result));

      return result;
    } catch (error) {
      this.logger.error('Failed to get analytics data:', error);
      throw error;
    }
  }

  /**
   * Get trend analytics for a trend
   */
  async getTrendAnalytics(trendId: string): Promise<TrendAnalytics> {
    try {
      const cacheKey = `trend-analytics:${trendId}`;
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Fetch latest ViralIndexSnapshot
      const snapshots = await this.prisma.viralIndexSnapshot.findMany({
        where: { trendId },
        orderBy: { timestamp: 'desc' },
        take: 100 // Last 100 snapshots
      });

      if (snapshots.length === 0) {
        throw new Error(`No data found for trend: ${trendId}`);
      }

      const latest = snapshots[0];
      const previous24h = snapshots.find(s =>
        s.timestamp <= new Date(latest.timestamp.getTime() - 24 * 60 * 60 * 1000)
      ) || snapshots[snapshots.length - 1];
      const previous7d = snapshots.find(s =>
        s.timestamp <= new Date(latest.timestamp.getTime() - 7 * 24 * 60 * 60 * 1000)
      ) || snapshots[snapshots.length - 1];

      // Calculate trends
      const viralityTrend = this.calculateTrend(latest.viralIndex, previous24h.viralIndex, previous7d.viralIndex);
      const velocityTrend = this.calculateTrend(latest.viralVelocity, previous24h.viralVelocity, 0);

      // Get trend info
      const trend = await this.prisma.trend.findUnique({ where: { id: trendId } });

      const result: TrendAnalytics = {
        symbol: trend?.topicName || 'Unknown',
        viralityScore: {
          current: latest.viralIndex,
          trend: viralityTrend.direction,
          change24h: viralityTrend.change24h,
          change7d: viralityTrend.change7d
        },
        velocity: {
          current: latest.viralVelocity,
          trend: velocityTrend.direction,
          change24h: velocityTrend.change24h
        },
        sentiment: {
          current: latest.sentimentMean,
          trend: this.calculateSentimentTrend(snapshots),
          distribution: this.calculateSentimentDistribution(snapshots)
        },
        engagement: {
          current: latest.engagementRate,
          trend: this.calculateEngagementTrend(snapshots),
          totalEngagements: latest.engagementTotal,
          activeUsers: latest.activeUsers || 0
        },
        momentum: {
          current: latest.momentumScore || 0,
          trend: this.calculateMomentumTrend(snapshots),
          strength: this.getMomentumStrength(latest.momentumScore || 0)
        },
        predictions: {
          shortTerm: await this.generateShortTermPrediction(snapshots),
          longTerm: await this.generateLongTermPrediction(snapshots)
        },
        riskFactors: this.calculateRiskFactors(snapshots),
        updatedAt: new Date()
      };

      // Cache for 1 minute
      await this.redis.setex(cacheKey, 60, JSON.stringify(result));

      return result;
    } catch (error) {
      this.logger.error('Failed to get trend analytics:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics for an entity
   */
  async getPerformanceMetrics(
    entityType: string,
    entityId: string,
    period: string
  ): Promise<PerformanceMetrics> {
    try {
      const cacheKey = `perf:${entityType}:${entityId}:${period}`;
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const metrics = await this.prisma.performancemetricrepository.findMany({
        where: {
          entityType,
          entityId,
          period
        },
        order: { timestamp: 'DESC' }
      });

      if (metrics.length === 0) {
        throw new Error(`No performance metrics found for ${entityType}:${entityId}:${period}`);
      }

      const result: PerformanceMetrics = {
        totalReturn: this.getMetricValue(metrics, 'TOTAL_RETURN'),
        sharpeRatio: this.getMetricValue(metrics, 'SHARPE_RATIO'),
        maxDrawdown: this.getMetricValue(metrics, 'MAX_DRAWDOWN'),
        winRate: this.getMetricValue(metrics, 'WIN_RATE'),
        totalTrades: Math.round(this.getMetricValue(metrics, 'TOTAL_TRADES') || 0),
        profitFactor: this.getMetricValue(metrics, 'PROFIT_FACTOR'),
        avgWin: this.getMetricValue(metrics, 'AVG_WIN'),
        avgLoss: this.getMetricValue(metrics, 'AVG_LOSS'),
        volatility: this.getMetricValue(metrics, 'VOLATILITY'),
        alpha: this.getMetricValue(metrics, 'ALPHA'),
        beta: this.getMetricValue(metrics, 'BETA'),
        calmarRatio: this.getMetricValue(metrics, 'CALMAR_RATIO'),
        sortinoRatio: this.getMetricValue(metrics, 'SORTINO_RATIO')
      };

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(result));

      return result;
    } catch (error) {
      this.logger.error('Failed to get performance metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate real-time metrics for a symbol
   */
  async calculateRealTimeMetrics(symbol: string): Promise<AnalyticsDataPoint> {
    try {
      const cacheKey = `realtime:${symbol}`;
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Get recent ViralIndexSnapshots (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const snapshots = await this.prisma.viralIndexSnapshot.findMany({
        where: {
          trend: { topicName: symbol },
          timestamp: { gte: oneHourAgo }
        },
        orderBy: { timestamp: 'desc' },
        take: 60 // One per minute max
      });

      if (snapshots.length === 0) {
        throw new Error(`No recent data found for symbol: ${symbol}`);
      }

      const latest = snapshots[0];
      const dataPoint: AnalyticsDataPoint = {
        timestamp: latest.timestamp,
        viralityScore: latest.viralIndex,
        sentimentScore: latest.sentimentMean,
        velocity: latest.viralVelocity,
        engagementRate: latest.engagementRate,
        momentumScore: latest.momentumScore || 0
      };

      // Cache for 1 minute
      await this.redis.setex(cacheKey, 60, JSON.stringify(dataPoint));

      // TODO: Re-enable WebSocket broadcast using proper NestJS pattern
      // Broadcast to WebSocket subscribers
      // this.webSocketGateway.broadcastAnalyticsUpdate(symbol, dataPoint);

      return dataPoint;
    } catch (error) {
      this.logger.error('Failed to calculate real-time metrics:', error);
      throw error;
    }
  }

  /**
   * Get dashboard data for an asset
   */
  async getDashboardData(assetId: string, timeRange = '7D'): Promise<DashboardData> {
    try {
      const cacheKey = `dashboard:${assetId}:${timeRange}`;
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Get trend info
      const trend = await this.prisma.trend.findFirst({
        where: { topicName: assetId }
      });

      if (!trend) {
        throw new Error(`Asset not found: ${assetId}`);
      }

      // Get performance metrics
      const performance = await this.getPerformanceMetrics('SYMBOL', assetId, timeRange);

      // Get trend analytics
      const trendAnalytics = await this.getTrendAnalytics(trend.id);

      // Get market data
      const marketData = await this.getAnalyticsData({
        symbol: assetId,
        interval: '1h'
      });

      // Get engagement data
      const engagement = await this.getEngagementData(trend.id);

      // Get predictions
      const predictions = {
        shortTerm: trendAnalytics.predictions.shortTerm,
        longTerm: trendAnalytics.predictions.longTerm,
        accuracy: {
          shortTerm: await this.getPredictionAccuracy(trend.id, 'short'),
          longTerm: await this.getPredictionAccuracy(trend.id, 'long')
        }
      };

      // Generate alerts
      const alerts = await this.generateAlerts(trend.id, trendAnalytics);

      const result: DashboardData = {
        assetId,
        symbol: assetId,
        lastUpdated: new Date(),
        performance,
        engagement,
        market: {
          currentPrice: trendAnalytics.viralityScore.current, // Using virality as price proxy
          priceChange24h: trendAnalytics.viralityScore.change24h,
          volume24h: engagement.totalEngagements,
          marketData: marketData.data
        },
        predictions,
        alerts
      };

      // Cache for 1 minute
      await this.redis.setex(cacheKey, 60, JSON.stringify(result));

      return result;
    } catch (error) {
      this.logger.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  // Helper methods

  private async getViralIndexData(
    symbol: string,
    startTime: Date,
    endTime: Date
  ): Promise<AnalyticsDataPoint[]> {
    const trend = await this.prisma.trend.findFirst({
      where: { topicName: symbol },
      include: {
        viralIndexSnapshots: {
          where: {
            timestamp: { gte: startTime, lte: endTime }
          },
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!trend || !trend.viralIndexSnapshots.length) {
      return [];
    }

    return trend.viralIndexSnapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      price: snapshot.viralIndex,
      volume: snapshot.engagementTotal,
      viralityScore: snapshot.viralIndex,
      sentimentScore: snapshot.sentimentMean,
      velocity: snapshot.viralVelocity,
      engagementRate: snapshot.engagementRate,
      momentumScore: snapshot.momentumScore || 0
    }));
  }

  private aggregateData(data: AnalyticsDataPoint[], query: AnalyticsQuery): AnalyticsDataPoint[] {
    if (!query.metrics || query.metrics.length === 0) {
      return data;
    }

    return data.map(point => {
      const aggregated: AnalyticsDataPoint = { timestamp: point.timestamp };
      query.metrics!.forEach(metric => {
        if (point[metric] !== undefined) {
          aggregated[metric] = point[metric];
        }
      });
      return aggregated;
    });
  }

  private detectGaps(data: AnalyticsDataPoint[]): boolean {
    if (data.length < 2) return false;

    for (let i = 1; i < data.length; i++) {
      const timeDiff = data[i].timestamp.getTime() - data[i - 1].timestamp.getTime();
      const expectedInterval = 60 * 60 * 1000; // 1 hour default
      if (timeDiff > expectedInterval * 2) {
        return true;
      }
    }
    return false;
  }

  private calculateTrend(current: number, previous24h: number, previous7d: number) {
    const change24h = ((current - previous24h) / previous24h) * 100;
    const change7d = ((current - previous7d) / previous7d) * 100;

    let direction: 'rising' | 'falling' | 'stable';
    if (change24h > 1) direction = 'rising';
    else if (change24h < -1) direction = 'falling';
    else direction = 'stable';

    return { direction, change24h, change7d };
  }

  private calculateSentimentTrend(snapshots: any[]): 'improving' | 'declining' | 'stable' {
    if (snapshots.length < 2) return 'stable';

    const recent = snapshots.slice(0, Math.min(10, snapshots.length));
    const avgRecent = recent.reduce((sum, s) => sum + s.sentimentMean, 0) / recent.length;
    const older = snapshots.slice(Math.min(10, snapshots.length), Math.min(20, snapshots.length));
    const avgOlder = older.length > 0 ? older.reduce((sum, s) => sum + s.sentimentMean, 0) / older.length : avgRecent;

    if (avgRecent > avgOlder + 0.1) return 'improving';
    if (avgRecent < avgOlder - 0.1) return 'declining';
    return 'stable';
  }

  private calculateSentimentDistribution(snapshots: any[]) {
    const latest = snapshots[0];
    return {
      positive: Math.max(0, (latest.sentimentMean + 1) * 50),
      neutral: Math.max(0, 50 - Math.abs(latest.sentimentMean) * 50),
      negative: Math.max(0, (1 - latest.sentimentMean) * 50)
    };
  }

  private calculateEngagementTrend(snapshots: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (snapshots.length < 2) return 'stable';

    const recent = snapshots[0].engagementRate;
    const previous = snapshots[1].engagementRate;

    if (recent > previous * 1.05) return 'increasing';
    if (recent < previous * 0.95) return 'decreasing';
    return 'stable';
  }

  private calculateMomentumTrend(snapshots: any[]): 'bullish' | 'bearish' | 'neutral' {
    if (snapshots.length < 2) return 'neutral';

    const recent = snapshots.slice(0, 5).map(s => s.momentumScore || 0);
    const avgRecent = recent.reduce((sum, s) => sum + s, 0) / recent.length;

    if (avgRecent > 0.5) return 'bullish';
    if (avgRecent < -0.5) return 'bearish';
    return 'neutral';
  }

  private getMomentumStrength(score: number): 'strong' | 'moderate' | 'weak' {
    const abs = Math.abs(score);
    if (abs > 0.7) return 'strong';
    if (abs > 0.3) return 'moderate';
    return 'weak';
  }

  private async generateShortTermPrediction(snapshots: any[]): Promise<Prediction> {
    // Simple linear regression based prediction
    const recent = snapshots.slice(0, 10).map(s => s.viralIndex);
    const trend = this.calculateLinearTrend(recent);

    let direction: 'up' | 'down' | 'sideways';
    if (trend > 0.5) direction = 'up';
    else if (trend < -0.5) direction = 'down';
    else direction = 'sideways';

    return {
      direction,
      confidence: Math.min(80, Math.abs(trend) * 20),
      targetPrice: snapshots[0].viralIndex + trend * 5,
      timeHorizon: '4 hours',
      factors: ['momentum', 'volume', 'sentiment']
    };
  }

  private async generateLongTermPrediction(snapshots: any[]): Promise<Prediction> {
    const weekly = snapshots.slice(0, 50).map(s => s.viralIndex);
    const trend = this.calculateLinearTrend(weekly);

    let direction: 'up' | 'down' | 'sideways';
    if (trend > 1) direction = 'up';
    else if (trend < -1) direction = 'down';
    else direction = 'sideways';

    return {
      direction,
      confidence: Math.min(70, Math.abs(trend) * 15),
      targetPrice: snapshots[0].viralIndex + trend * 30,
      timeHorizon: '7 days',
      factors: ['weekly_trend', 'sentiment_momentum', 'engagement_growth']
    };
  }

  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private calculateRiskFactors(snapshots: any[]): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const latest = snapshots[0];
    const volatility = this.calculateVolatility(snapshots.map(s => s.viralIndex));

    if (volatility > 20) {
      factors.push({
        factor: 'High Volatility',
        probability: Math.min(90, volatility * 2),
        impact: 'high',
        description: 'Asset shows high price volatility, increasing risk of sudden movements'
      });
    }

    if (latest.sentimentMean < -0.5) {
      factors.push({
        factor: 'Negative Sentiment',
        probability: Math.abs(latest.sentimentMean) * 60,
        impact: 'medium',
        description: 'Negative sentiment may lead to continued price decline'
      });
    }

    if (latest.viralVelocity < 0) {
      factors.push({
        factor: 'Declining Velocity',
        probability: Math.abs(latest.viralVelocity) * 50,
        impact: 'medium',
        description: 'Viral velocity is declining, indicating loss of momentum'
      });
    }

    return factors;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] !== 0) {
        returns.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100; // As percentage
  }

  private getMetricValue(metrics: any[], metricType: string): number {
    const metric = metrics.find(m => m.metricType === metricType);
    return metric ? parseFloat(metric.metricValue.toString()) : 0;
  }

  private async getEngagementData(trendId: string) {
    const snapshots = await this.prisma.viralIndexSnapshot.findMany({
      where: { trendId },
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    const latest = snapshots[0];
    const previous7d = snapshots.find(s =>
      s.timestamp <= new Date(latest.timestamp.getTime() - 7 * 24 * 60 * 60 * 1000)
    ) || snapshots[snapshots.length - 1];

    const growthRate = previous7d ?
      ((latest.engagementTotal - previous7d.engagementTotal) / previous7d.engagementTotal) * 100 : 0;

    return {
      totalEngagements: latest.engagementTotal,
      activeUsers: latest.activeUsers || 0,
      growthRate,
      topPlatforms: [
        { platform: 'Twitter', engagements: latest.engagementTotal * 0.4, growthRate: 5.2, sentiment: 0.6 },
        { platform: 'Reddit', engagements: latest.engagementTotal * 0.3, growthRate: 3.1, sentiment: 0.4 },
        { platform: 'Telegram', engagements: latest.engagementTotal * 0.2, growthRate: 8.7, sentiment: 0.7 },
        { platform: 'Discord', engagements: latest.engagementTotal * 0.1, growthRate: 12.3, sentiment: 0.8 },
      ]
    };
  }

  private async getPredictionAccuracy(trendId: string, horizon: 'short' | 'long'): Promise<number> {
    // This would typically compare historical predictions with actual outcomes
    // For now, return mock accuracy values
    return horizon === 'short' ? 72.5 : 68.3;
  }

  private async generateAlerts(trendId: string, trendAnalytics: TrendAnalytics): Promise<Alert[]> {
    const alerts: Alert[] = [];

    if (trendAnalytics.viralityScore.change24h > 20) {
      alerts.push({
        id: `alert_${Date.now()}_1`,
        type: 'virality',
        severity: 'high',
        title: 'Virality Spike Detected',
        message: `Virality score increased by ${trendAnalytics.viralityScore.change24h.toFixed(1)}% in 24h`,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    if (trendAnalytics.sentiment.current < -0.7) {
      alerts.push({
        id: `alert_${Date.now()}_2`,
        type: 'sentiment',
        severity: 'medium',
        title: 'Negative Sentiment Alert',
        message: 'Sentiment has dropped to extremely negative levels',
        timestamp: new Date(),
        acknowledged: false
      });
    }

    if (trendAnalytics.velocity.current < -10) {
      alerts.push({
        id: `alert_${Date.now()}_3`,
        type: 'virality',
        severity: 'high',
        title: 'Velocity Decline',
        message: 'Viral velocity is declining rapidly',
        timestamp: new Date(),
        acknowledged: false
      });
    }

    return alerts;
  }

  /**
   * Store performance metrics for predictive notifications
   */
  async storePerformanceMetrics(data: {
    userId: string;
    performanceData: any;
    timestamp: Date;
  }): Promise<string> {
    try {
      const id = `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store in Redis for quick access
      await this.redis.setex(
        `performance_metrics:${data.userId}:${id}`,
        7 * 24 * 60 * 60, // 7 days TTL
        JSON.stringify({
          id,
          userId: data.userId,
          performanceData: data.performanceData,
          timestamp: data.timestamp
        })
      );

      // Also store in analytics database for long-term analysis
      await this.prisma.performanceMetric.create({
        data: {
          entityType: 'USER',
          entityId: data.userId,
          metricType: 'PREDICTIVE_NOTIFICATION_PERFORMANCE',
          value: data.performanceData.analysis?.overallImprovement || 0,
          metadata: JSON.stringify(data.performanceData),
          timestamp: data.timestamp
        }
      });

      this.logger.log(`Stored performance metrics for user ${data.userId}: ${id}`);
      return id;
    } catch (error) {
      this.logger.error('Failed to store performance metrics:', error);
      throw error;
    }
  }

  /**
   * Analyze performance trends and generate insights
   */
  async analyzePerformanceTrends(userId: string, performanceData: any): Promise<void> {
    try {
      const analysis = performanceData.analysis;

      // Log significant insights
      if (analysis.meetsTarget) {
        this.logger.log(`[Performance Target Met] User ${userId}: ${analysis.overallImprovement}% improvement`);

        // TODO: Re-enable WebSocket notification using proper NestJS pattern
        // Send notification to user about performance milestone
        // this.webSocketGateway.sendNotificationToUser(userId, {
        //   type: 'performance_milestone',
        //   data: {
        //     improvement: analysis.overallImprovement,
        //     message: `Performance target achieved! ${analysis.overallImprovement}% improvement in notification loading.`
        //   }
        // });
      }

      // Check for performance issues
      if (analysis.overallImprovement !== null && analysis.overallImprovement < 30) {
        this.logger.warn(`[Performance Alert] User ${userId}: Low improvement (${analysis.overallImprovement}%)`);

        // Could trigger optimization recommendations here
        performanceData.recommendations.push({
          type: 'performance',
          severity: 'medium',
          message: 'Consider optimizing notification preloading strategy',
          action: 'Enable more aggressive caching',
          autoFix: false
        });
      }

      // Store trend analysis
      const trendData = {
        userId,
        improvement: analysis.overallImprovement,
        meetsTarget: analysis.meetsTarget,
        abTestGroup: performanceData.abTest?.group,
        recommendations: performanceData.recommendations.length,
        timestamp: new Date()
      };

      await this.redis.setex(
        `performance_trend:${userId}`,
        30 * 24 * 60 * 60, // 30 days TTL
        JSON.stringify(trendData)
      );

    } catch (error) {
      this.logger.error(`Failed to analyze performance trends for user ${userId}:`, error);
    }
  }

  /**
   * Get aggregated performance analytics
   */
  async getPredictiveNotificationPerformance(days: number = 30): Promise<{
    totalUsers: number;
    averageImprovement: number;
    targetMetRate: number;
    abTestResults: {
      control: {
        count: number;
        averageLoadTime: number;
      };
      treatment: {
        count: number;
        averageLoadTime: number;
        averageImprovement: number;
      };
    };
  }> {
    try {
      // Get performance metrics from database
      const metrics = await this.prisma.performanceMetric.findMany({
        where: {
          metricType: 'PREDICTIVE_NOTIFICATION_PERFORMANCE',
          timestamp: {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      const totalUsers = metrics.length;
      const improvements = metrics
        .map(m => {
          try {
            const data = JSON.parse(m.metadata || '{}');
            return data.analysis?.overallImprovement || 0;
          } catch {
            return 0;
          }
        })
        .filter(imp => imp > 0);

      const averageImprovement = improvements.length > 0
        ? improvements.reduce((a, b) => a + b, 0) / improvements.length
        : 0;

      const targetMetCount = metrics.filter(m => {
        try {
          const data = JSON.parse(m.metadata || '{}');
          return data.analysis?.meetsTarget === true;
        } catch {
          return false;
        }
      }).length;

      const targetMetRate = totalUsers > 0 ? (targetMetCount / totalUsers) * 100 : 0;

      // A/B test analysis
      const controlMetrics = metrics.filter(m => {
        try {
          const data = JSON.parse(m.metadata || '{}');
          return data.abTest?.group === 'control';
        } catch {
          return false;
        }
      });

      const treatmentMetrics = metrics.filter(m => {
        try {
          const data = JSON.parse(m.metadata || '{}');
          return data.abTest?.group === 'treatment';
        } catch {
          return false;
        }
      });

      const controlAverageLoadTime = controlMetrics.length > 0
        ? controlMetrics.reduce((sum, m) => {
            try {
              const data = JSON.parse(m.metadata || '{}');
              return sum + (data.abTest?.performance?.averageLoadTime || 0);
            } catch {
              return sum;
            }
          }, 0) / controlMetrics.length
        : 0;

      const treatmentAverageLoadTime = treatmentMetrics.length > 0
        ? treatmentMetrics.reduce((sum, m) => {
            try {
              const data = JSON.parse(m.metadata || '{}');
              return sum + (data.abTest?.performance?.averageLoadTime || 0);
            } catch {
              return sum;
            }
          }, 0) / treatmentMetrics.length
        : 0;

      const treatmentImprovement = treatmentMetrics.length > 0
        ? treatmentMetrics.reduce((sum, m) => {
            try {
              const data = JSON.parse(m.metadata || '{}');
              return sum + (data.analysis?.overallImprovement || 0);
            } catch {
              return sum;
            }
          }, 0) / treatmentMetrics.length
        : 0;

      return {
        totalUsers,
        averageImprovement,
        targetMetRate,
        abTestResults: {
          control: {
            count: controlMetrics.length,
            averageLoadTime: controlAverageLoadTime
          },
          treatment: {
            count: treatmentMetrics.length,
            averageLoadTime: treatmentAverageLoadTime,
            averageImprovement: treatmentImprovement
          }
        }
      };
    } catch (error) {
      this.logger.error('Failed to get predictive notification performance:', error);
      throw error;
    }
  }
}
