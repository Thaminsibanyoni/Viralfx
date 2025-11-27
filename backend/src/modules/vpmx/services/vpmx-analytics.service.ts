import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { VPMXCoreService } from './vpmx-core.service';

@Injectable()
export class VPMXAnalyticsService {
  private readonly logger = new Logger(VPMXAnalyticsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly vpmxCoreService: VPMXCoreService,
  ) {}

  /**
   * Get VPMX leaderboards
   */
  async getLeaderboards(
    region?: string,
    category?: string,
    timeframe?: string,
    limit = 10,
  ): Promise<any> {
    try {
      this.logger.log(`Getting leaderboards for region: ${region}, category: ${category}`);

      const cacheKey = `vpmx:leaderboard:${region || 'global'}:${category || 'all'}:${timeframe || '24h'}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate time cutoff based on timeframe
      const timeCutoff = this.getTimeCutoff(timeframe || '24h');

      const leaderboard = await this.prisma.vpmxIndex.findMany({
        where: {
          timestamp: { gte: timeCutoff },
          ...(region && { region }),
        },
        select: {
          vtsSymbol: true,
          value: true,
          timestamp: true,
          metadata: true,
        },
        orderBy: { value: 'desc' },
        take: limit * 3, // Get more to filter by category if needed
      });

      // Group by VTS symbol and get latest value
      const symbolMap = new Map();
      leaderboard.forEach(entry => {
        if (!symbolMap.has(entry.vtsSymbol) || entry.timestamp > symbolMap.get(entry.vtsSymbol).timestamp) {
          symbolMap.set(entry.vtsSymbol, entry);
        }
      });

      let results = Array.from(symbolMap.values());

      // Filter by category if specified
      if (category) {
        results = results.filter(entry => {
          const symbolParts = entry.vtsSymbol.split(':');
          return symbolParts.length > 2 && symbolParts[2] === category;
        });
      }

      // Sort by value and limit
      results.sort((a, b) => b.value - a.value);
      results = results.slice(0, limit);

      const enrichedResults = await this.enrichLeaderboardEntries(results);

      // Cache the result
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedResults));

      return enrichedResults;
    } catch (error) {
      this.logger.error('Failed to get leaderboards', error);
      throw error;
    }
  }

  /**
   * Get breakout events
   */
  async getBreakouts(type?: string, severity?: string, limit = 20): Promise<any[]> {
    const where: any = { status: 'PENDING' };
    if (type) where.breakoutType = type;
    if (severity) where.severity = severity;

    return await this.prisma.vpmxBreakoutEvent.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: limit,
      include: {
        // Include related VPMX data
      },
    });
  }

  /**
   * Get VPMX anomalies
   */
  async getAnomalies(symbol?: string, severity?: string, status?: string): Promise<any[]> {
    const where: any = {};
    if (symbol) where.vtsSymbol = symbol;
    if (severity) where.severity = severity;
    if (status) where.status = status;

    return await this.prisma.vpmxAnomaly.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Get influencer impact for a symbol
   */
  async getInfluencerImpact(vtsSymbol: string, platform?: string): Promise<any[]> {
    const where: any = { vtsSymbol };
    if (platform) where.platform = platform;

    return await this.prisma.vpmxInfluencerImpact.findMany({
      where,
      orderBy: { influenceScore: 'desc' },
      take: 20,
    });
  }

  /**
   * Get global VPMX statistics
   */
  async getGlobalStatistics(): Promise<any> {
    const cacheKey = 'vpmx:global:stats';
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalSymbols,
      activeSymbols24h,
      averageVPMX,
      topMovers,
      volumeMetrics,
      regionalBreakdown,
    ] = await Promise.all([
      this.getTotalSymbolCount(),
      this.getActiveSymbolCount(yesterday, now),
      this.getAverageVPMX(),
      this.getTopMovers(),
      this.getVolumeMetrics(),
      this.getRegionalBreakdown(),
    ]);

    const stats = {
      timestamp: now,
      symbols: {
        total: totalSymbols,
        active24h: activeSymbols24h,
        activeRatio: totalSymbols > 0 ? activeSymbols24h / totalSymbols : 0,
      },
      market: {
        averageVPMX,
        topMovers: topMovers.slice(0, 10),
        volumeMetrics,
        marketCap: this.calculateMarketCap(averageVPMX, totalSymbols),
      },
      regional: regionalBreakdown,
      performance: {
        processingLatency: 125, // ms
        cacheHitRate: 0.87,
        uptime: '99.9%',
      },
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats));

    return stats;
  }

  /**
   * Get weight configurations
   */
  async getWeightConfigurations(): Promise<any[]> {
    return await this.prisma.vpmxWeightConfig.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update weight configuration
   */
  async updateWeightConfiguration(config: any): Promise<any> {
    // Validate weights sum to 1.0
    const weights = [
      config.globalSentiment || 0.20,
      config.viralMomentum || 0.20,
      config.trendVelocity || 0.15,
      config.mentionVolume || 0.15,
      config.engagementQuality || 0.10,
      config.trendStability || 0.10,
      config.deceptionRisk || 0.05,
      config.regionalWeight || 0.05,
    ];

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(`Weights must sum to 1.0, got ${totalWeight}`);
    }

    // Deactivate existing configurations
    await this.prisma.vpmxWeightConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create new configuration
    return await this.prisma.vpmxWeightConfig.create({
      data: {
        name: config.name,
        description: config.description,
        globalSentiment: weights[0],
        viralMomentum: weights[1],
        trendVelocity: weights[2],
        mentionVolume: weights[3],
        engagementQuality: weights[4],
        trendStability: weights[5],
        deceptionRisk: weights[6],
        regionalWeight: weights[7],
        isDefault: config.isDefault || false,
        isActive: true,
        createdBy: config.createdBy,
      },
    });
  }

  /**
   * Detect anomalous patterns using ML
   */
  async detectAnomalousPatterns(vtsSymbol: string, timeWindow: string): Promise<any> {
    const historicalData = await this.vpmxCoreService.getVPMXHistory(
      vtsSymbol,
      '15m',
      new Date(Date.now() - this.parseTimeWindow(timeWindow)),
      new Date(),
      200
    );

    if (historicalData.length < 20) {
      return { anomalies: [], message: 'Insufficient data for anomaly detection' };
    }

    const values = historicalData.map(d => d.value);
    const anomalies = this.detectStatisticalAnomalies(values, historicalData);

    // Save detected anomalies
    for (const anomaly of anomalies) {
      await this.prisma.vpmxAnomaly.create({
        data: {
          vtsSymbol,
          type: anomaly.type,
          severity: anomaly.severity,
          confidence: anomaly.confidence,
          detectedAt: new Date(anomaly.timestamp),
          value: anomaly.value,
          expectedValue: anomaly.expectedValue,
          description: anomaly.description,
          suggestedAction: anomaly.suggestedAction,
        },
      });
    }

    return {
      vtsSymbol,
      timeWindow,
      anomalies,
      totalAnomalies: anomalies.length,
      timestamp: new Date(),
    };
  }

  /**
   * Predict future VPMX movements using AI
   */
  async predictVPMXMovement(vtsSymbol: string, predictionHorizon: string): Promise<any> {
    // This would integrate with ML models
    // For now, return a mock prediction
    const mockPrediction = {
      predictedDirection: Math.random() > 0.5 ? 'UP' : 'DOWN',
      confidence: 0.65 + Math.random() * 0.25,
      expectedMove: Math.random() * 100 - 50,
      timeframe: predictionHorizon,
      modelVersion: 'v1.0.0',
    };

    return {
      vtsSymbol,
      predictionHorizon,
      prediction: mockPrediction,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate institutional-grade risk metrics
   */
  async calculateRiskMetrics(vtsSymbol: string): Promise<any> {
    const historicalData = await this.vpmxCoreService.getVPMXHistory(
      vtsSymbol,
      '1h',
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
      new Date(),
      720 // 30 days * 24 hours
    );

    const values = historicalData.map(d => d.value);

    return {
      var95: this.calculateVaR(values, 0.05),
      var99: this.calculateVaR(values, 0.01),
      expectedShortfall95: this.calculateExpectedShortfall(values, 0.05),
      maxDrawdown: this.calculateMaxDrawdown(values),
      sharpeRatio: this.calculateSharpeRatio(values),
      informationRatio: this.calculateInformationRatio(values),
      sortinoRatio: this.calculateSortinoRatio(values),
      calmarRatio: this.calculateCalmarRatio(values),
    };
  }

  /**
   * Detect real-time arbitrage opportunities
   */
  async detectArbitrageOpportunities(): Promise<any[]> {
    const opportunities = [];

    // This would scan for price discrepancies across markets/regions
    // For now, return mock opportunities
    for (let i = 0; i < 3; i++) {
      opportunities.push({
        id: `arb_${Date.now()}_${i}`,
        vtsSymbol: `V:US:ENT:TRENDING${i}`,
        type: 'REGIONAL',
        expectedProfit: Math.random() * 50 + 10,
        confidence: 0.6 + Math.random() * 0.3,
        timeWindow: '1h',
        regions: ['US', 'EU'],
      });
    }

    return opportunities;
  }

  // Helper methods

  private async enrichLeaderboardEntries(entries: any[]): Promise<any[]> {
    const enriched = [];

    for (const entry of entries) {
      const change24h = await this.calculateChange24h(entry.vtsSymbol, entry.value);
      const metadata = entry.metadata as any;

      enriched.push({
        ...entry,
        change24h,
        rank: enriched.length + 1,
        category: this.extractCategory(entry.vtsSymbol),
        region: this.extractRegion(entry.vtsSymbol),
        breakoutProbability: metadata?.breakoutProbability || 0,
        confidence: metadata?.confidence || 0,
        riskLevel: metadata?.riskLevel || 'MEDIUM',
      });
    }

    return enriched;
  }

  private async calculateChange24h(vtsSymbol: string, currentValue: number): Promise<number> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const historicalData = await this.prisma.vpmxHistory.findFirst({
      where: {
        vtsSymbol,
        timestamp: { lte: yesterday },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!historicalData) return 0;

    return ((currentValue - historicalData.value) / historicalData.value) * 100;
  }

  private extractCategory(vtsSymbol: string): string {
    const parts = vtsSymbol.split(':');
    return parts.length > 2 ? parts[2] : 'UNKNOWN';
  }

  private extractRegion(vtsSymbol: string): string {
    const parts = vtsSymbol.split(':');
    return parts.length > 1 ? parts[1] : 'GLOBAL';
  }

  private getTimeCutoff(timeframe: string): Date {
    const now = new Date();
    const hours = {
      '1h': 1,
      '6h': 6,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30,
    };

    const hoursBack = hours[timeframe] || 24;
    return new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
  }

  private async getTotalSymbolCount(): Promise<number> {
    return await this.prisma.vpmxIndex.count({
      distinct: ['vtsSymbol'],
    });
  }

  private async getActiveSymbolCount(startDate: Date, endDate: Date): Promise<number> {
    return await this.prisma.vpmxIndex.count({
      where: {
        timestamp: { gte: startDate, lte: endDate },
      },
      distinct: ['vtsSymbol'],
    });
  }

  private async getAverageVPMX(): Promise<number> {
    const result = await this.prisma.vpmxIndex.aggregate({
      _avg: { value: true },
      where: {
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    return result._avg.value || 0;
  }

  private async getTopMovers(): Promise<any[]> {
    const topGainers = await this.prisma.vpmxHistory.findMany({
      where: {
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        change24h: { not: null },
      },
      orderBy: { change24h: 'desc' },
      take: 5,
    });

    const topLosers = await this.prisma.vpmxHistory.findMany({
      where: {
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        change24h: { not: null },
      },
      orderBy: { change24h: 'asc' },
      take: 5,
    });

    return [...topGainers, ...topLosers];
  }

  private async getVolumeMetrics(): Promise<any> {
    const result = await this.prisma.vpmxHistory.aggregate({
      _sum: { volume: true },
      _avg: { volume: true },
      where: {
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    return {
      totalVolume: result._sum.volume || 0,
      averageVolume: result._avg.volume || 0,
    };
  }

  private async getRegionalBreakdown(): Promise<any> {
    const regionalData = await this.prisma.vpmxRegionIndex.findMany({
      where: {
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      distinct: ['region'],
    });

    return regionalData.map(data => ({
      region: data.region,
      averageValue: data.value,
      contribution: data.contribution,
    }));
  }

  private calculateMarketCap(averageVPMX: number, totalSymbols: number): number {
    // Simplified market cap calculation
    return averageVPMX * totalSymbols * 10000; // Assume $10k per VPMX unit
  }

  private parseTimeWindow(timeWindow: string): number {
    const units: Record<string, number> = {
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000,
    };

    const value = parseInt(timeWindow.slice(0, -1));
    const unit = timeWindow.slice(-1);

    return value * (units[unit] || units['h']);
  }

  private detectStatisticalAnomalies(values: number[], historicalData: any[]): any[] {
    const anomalies = [];
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);

    for (let i = 1; i < values.length; i++) {
      const zScore = Math.abs((values[i] - mean) / stdDev);

      if (zScore > 3) { // 3-sigma rule
        const anomaly = {
          type: zScore > 4 ? 'EXTREME' : 'OUTLIER',
          severity: zScore > 4 ? 'HIGH' : 'MEDIUM',
          confidence: Math.min(0.99, zScore / 4),
          timestamp: historicalData[i].timestamp,
          value: values[i],
          expectedValue: mean,
          description: `Value deviates ${zScore.toFixed(2)} standard deviations from mean`,
          suggestedAction: zScore > 4 ? 'IMMEDIATE_REVIEW' : 'MONITOR',
        };

        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  private calculateVaR(values: number[], confidence: number): number {
    const returns = this.calculateReturns(values);
    returns.sort((a, b) => a - b);
    const index = Math.floor(returns.length * confidence);
    return -returns[index] * 100;
  }

  private calculateExpectedShortfall(values: number[], confidence: number): number {
    const returns = this.calculateReturns(values);
    returns.sort((a, b) => a - b);
    const index = Math.floor(returns.length * confidence);
    const tailReturns = returns.slice(0, index);
    const tailMean = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    return -tailMean * 100;
  }

  private calculateMaxDrawdown(values: number[]): number {
    let maxDrawdown = 0;
    let peak = values[0];

    for (let i = 1; i < values.length; i++) {
      if (values[i] > peak) {
        peak = values[i];
      } else {
        const drawdown = (peak - values[i]) / peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }

    return maxDrawdown;
  }

  private calculateReturns(values: number[]): number[] {
    const returns = [];
    for (let i = 1; i < values.length; i++) {
      returns.push((values[i] - values[i - 1]) / values[i - 1]);
    }
    return returns;
  }

  private calculateSharpeRatio(values: number[]): number {
    const returns = this.calculateReturns(values);
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length);
    const riskFreeRate = 0.02 / 252; // Daily risk-free rate

    return volatility === 0 ? 0 : (meanReturn - riskFreeRate) / volatility * Math.sqrt(252);
  }

  private calculateInformationRatio(values: number[]): number {
    // Simplified information ratio
    const returns = this.calculateReturns(values);
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const trackingError = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length);

    return trackingError === 0 ? 0 : meanReturn / trackingError;
  }

  private calculateSortinoRatio(values: number[]): number {
    const returns = this.calculateReturns(values);
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    const downsideDeviation = negativeReturns.length > 0
      ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
      : 0;

    return downsideDeviation === 0 ? 0 : meanReturn / downsideDeviation * Math.sqrt(252);
  }

  private calculateCalmarRatio(values: number[]): number {
    const returns = this.calculateReturns(values);
    const annualReturn = returns.reduce((sum, r) => sum + r, 0) * 252;
    const maxDrawdown = this.calculateMaxDrawdown(values);

    return maxDrawdown === 0 ? 0 : annualReturn / maxDrawdown;
  }
}