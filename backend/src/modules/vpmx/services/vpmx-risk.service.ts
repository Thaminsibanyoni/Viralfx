import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { VPMXCoreService } from "./vpmx-core.service";

@Injectable()
export class VPMXRiskService {
  private readonly logger = new Logger(VPMXRiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vpmxCoreService: VPMXCoreService) {}

  /**
   * Assess risk for a VTS symbol and position
   */
  async assessRisk(
    vtsSymbol: string,
    riskTolerance: string,
    positionSize: number,
    timeframe: string): Promise<any> {
    try {
      this.logger.log(`Assessing risk for ${vtsSymbol} with position size ${positionSize}`);

      // Get current VPMX data
      const vpmxData = await this.vpmxCoreService.getCurrentVPMX(vtsSymbol);
      if (!vpmxData) {
        throw new Error('No VPMX data available for risk assessment');
      }

      // Calculate risk metrics
      const riskMetrics = await this.calculateRiskMetrics(vtsSymbol);
      const exposureAnalysis = this.analyzeExposure(positionSize, vpmxData.value, riskMetrics);
      const riskScore = this.calculateOverallRiskScore(riskMetrics, exposureAnalysis);

      // Determine risk level based on tolerance
      const riskLevel = this.determineRiskLevel(riskScore, riskTolerance);

      // Generate risk recommendations
      const recommendations = this.generateRiskRecommendations(
        riskLevel,
        exposureAnalysis,
        riskMetrics);

      return {
        vtsSymbol,
        riskTolerance,
        positionSize,
        timeframe,
        assessment: {
          riskScore,
          riskLevel,
          riskMetrics,
          exposureAnalysis,
          recommendations
        },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Failed to assess risk for ${vtsSymbol}`, error);
      throw error;
    }
  }

  /**
   * Get current risk snapshot for a symbol
   */
  async getRiskSnapshot(vtsSymbol: string): Promise<any> {
    const latestSnapshot = await this.prisma.vpmxRiskSnapshot.findFirst({
      where: { vtsSymbol },
      orderBy: { timestamp: 'desc' }
    });

    if (!latestSnapshot) {
      // Generate new snapshot if none exists
      return await this.generateRiskSnapshot(vtsSymbol);
    }

    // Check if snapshot is recent (within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (latestSnapshot.timestamp < oneHourAgo) {
      return await this.generateRiskSnapshot(vtsSymbol);
    }

    return latestSnapshot;
  }

  /**
   * Calculate comprehensive risk metrics
   */
  private async calculateRiskMetrics(vtsSymbol: string): Promise<any> {
    // Get historical VPMX data
    const historicalData = await this.vpmxCoreService.getVPMXHistory(
      vtsSymbol,
      '15m',
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days
      new Date(),
      500
    );

    if (historicalData.length < 10) {
      throw new Error('Insufficient data for risk calculation');
    }

    const values = historicalData.map(d => d.value);
    const returns = this.calculateReturns(values);

    return {
      volatility: this.calculateVolatility(returns),
      valueAtRisk: this.calculateVaR(values, 0.05), // 5% VaR
      expectedShortfall: this.calculateExpectedShortfall(values, 0.05),
      maxDrawdown: this.calculateMaxDrawdown(values),
      sharpeRatio: this.calculateSharpeRatio(returns),
      beta: this.calculateBeta(values), // Relative to market
      correlation: this.calculateCorrelation(values),
      skewness: this.calculateSkewness(returns),
      kurtosis: this.calculateKurtosis(returns),
      autocorrelation: this.calculateAutocorrelation(returns)
    };
  }

  /**
   * Analyze position exposure
   */
  private analyzeExposure(positionSize: number, currentVPMX: number, riskMetrics: any): any {
    const notionalValue = positionSize;
    const leverage = positionSize / 10000; // Assuming 10k base
    const maxLoss = notionalValue * 0.1; // 10% max loss assumption

    return {
      notionalValue,
      leverage,
      maxLoss,
      riskAdjustedReturn: (currentVPMX - 500) / 500 * (1 / riskMetrics.volatility),
      concentration: leverage > 2 ? 'HIGH' : leverage > 1 ? 'MEDIUM' : 'LOW',
      liquidityRisk: this.assessLiquidityRisk(currentVPMX),
      counterpartyRisk: this.assessCounterpartyRisk(leverage)
    };
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateOverallRiskScore(riskMetrics: any, exposureAnalysis: any): number {
    const volatilityScore = Math.min(100, riskMetrics.volatility * 20);
    const varScore = Math.min(100, riskMetrics.valueAtRisk / 10);
    const drawdownScore = Math.min(100, riskMetrics.maxDrawdown / 10);
    const concentrationScore = exposureAnalysis.concentration === 'HIGH' ? 80 :
                              exposureAnalysis.concentration === 'MEDIUM' ? 50 : 20;
    const liquidityScore = exposureAnalysis.liquidityRisk * 100;

    return (volatilityScore + varScore + drawdownScore + concentrationScore + liquidityScore) / 5;
  }

  /**
   * Determine risk level based on score and tolerance
   */
  private determineRiskLevel(riskScore: number, riskTolerance: string): string {
    const thresholds: Record<string, { low: number; medium: number; high: number }> = {
      CONSERVATIVE: { low: 20, medium: 40, high: 60 },
      MODERATE: { low: 35, medium: 55, high: 75 },
      AGGRESSIVE: { low: 50, medium: 70, high: 85 }
    };

    const threshold = thresholds[riskTolerance] || thresholds.MODERATE;

    if (riskScore < threshold.low) return 'LOW';
    if (riskScore < threshold.medium) return 'MEDIUM';
    if (riskScore < threshold.high) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Generate risk recommendations
   */
  private generateRiskRecommendations(
    riskLevel: string,
    exposureAnalysis: any,
    riskMetrics: any): any[] {
    const recommendations = [];

    if (riskLevel === 'CRITICAL') {
      recommendations.push({
        priority: 'HIGH',
        action: 'REDUCE_POSITION',
        reason: 'Critical risk level detected',
        suggestedSize: exposureAnalysis.notionalValue * 0.5
      });
    }

    if (riskMetrics.volatility > 0.4) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'ADD_HEDGE',
        reason: 'High volatility detected',
        suggestedHedge: 'PUT_OPTIONS'
      });
    }

    if (riskMetrics.maxDrawdown > 0.2) {
      recommendations.push({
        priority: 'HIGH',
        action: 'STOP_LOSS',
        reason: 'High maximum drawdown risk',
        suggestedLevel: '10%'
      });
    }

    if (exposureAnalysis.leverage > 3) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'REDUCE_LEVERAGE',
        reason: 'Excessive leverage',
        targetLeverage: 2
      });
    }

    if (exposureAnalysis.liquidityRisk > 0.7) {
      recommendations.push({
        priority: 'HIGH',
        action: 'LIQUIDITY_CHECK',
        reason: 'Low liquidity detected',
        suggestedAction: 'STAGGERED_EXIT'
      });
    }

    return recommendations;
  }

  /**
   * Generate and save risk snapshot
   */
  private async generateRiskSnapshot(vtsSymbol: string): Promise<any> {
    try {
      const riskMetrics = await this.calculateRiskMetrics(vtsSymbol);
      const riskScore = this.calculateRiskScore(riskMetrics);
      const riskRating = this.calculateRiskRating(riskScore);
      const marketCondition = this.assessMarketCondition(riskMetrics);

      const snapshot = await this.prisma.vpmxRiskSnapshot.create({
        data: {
          vtsSymbol,
          valueAtRisk: riskMetrics.valueAtRisk,
          expectedShortfall: riskMetrics.expectedShortfall,
          maxDrawdown: riskMetrics.maxDrawdown,
          volatility: riskMetrics.volatility,
          beta: riskMetrics.beta,
          sharpeRatio: riskMetrics.sharpeRatio,
          riskRating,
          riskScore,
          marketCondition
        }
      });

      return snapshot;
    } catch (error) {
      this.logger.error(`Failed to generate risk snapshot for ${vtsSymbol}`, error);
      throw error;
    }
  }

  // Statistical calculation methods

  private calculateReturns(values: number[]): number[] {
    const returns = [];
    for (let i = 1; i < values.length; i++) {
      returns.push((values[i] - values[i - 1]) / values[i - 1]);
    }
    return returns;
  }

  private calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  private calculateVaR(values: number[], confidence: number): number {
    const returns = this.calculateReturns(values);
    returns.sort((a, b) => a - b);
    const index = Math.floor(returns.length * confidence);
    return -returns[index] * 100; // Convert to percentage
  }

  private calculateExpectedShortfall(values: number[], confidence: number): number {
    const returns = this.calculateReturns(values);
    returns.sort((a, b) => a - b);
    const index = Math.floor(returns.length * confidence);
    const tailReturns = returns.slice(0, index);
    const tailMean = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    return -tailMean * 100; // Convert to percentage
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

  private calculateSharpeRatio(returns: number[]): number {
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    const riskFreeRate = 0.02; // Assume 2% risk-free rate
    return (meanReturn - riskFreeRate) / volatility;
  }

  private calculateBeta(values: number[]): number {
    // Simplified beta calculation - in production would use market benchmark
    const returns = this.calculateReturns(values);
    const covariance = this.calculateCovariance(returns, returns);
    const variance = this.calculateVariance(returns);
    return covariance / variance;
  }

  private calculateCorrelation(values: number[]): number {
    // Simplified autocorrelation
    const returns = this.calculateReturns(values);
    if (returns.length < 2) return 0;

    const laggedReturns = returns.slice(1);
    const currentReturns = returns.slice(0, -1);

    return this.calculatePearsonCorrelation(currentReturns, laggedReturns);
  }

  private calculateSkewness(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const skewness = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0) / returns.length;
    return skewness;
  }

  private calculateKurtosis(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 4), 0) / returns.length;
    return kurtosis - 3; // Excess kurtosis
  }

  private calculateAutocorrelation(returns: number[], lag: number = 1): number {
    if (returns.length <= lag) return 0;

    const n = returns.length - lag;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (returns[i] - mean) * (returns[i + lag] - mean);
    }

    for (let i = 0; i < returns.length; i++) {
      denominator += Math.pow(returns[i] - mean, 2);
    }

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateCovariance(x: number[], y: number[]): number {
    if (x.length !== y.length) throw new Error('Arrays must have same length');

    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;

    return x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0) / x.length;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length) throw new Error('Arrays must have same length');

    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < x.length; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      sumSqX += diffX * diffX;
      sumSqY += diffY * diffY;
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private assessLiquidityRisk(currentVPMX: number): number {
    // Simplified liquidity risk based on VPMX level
    // Higher VPMX = more attention = better liquidity
    return Math.max(0, 1 - currentVPMX / 1000);
  }

  private assessCounterpartyRisk(leverage: number): number {
    // Higher leverage = higher counterparty risk
    return Math.min(1, leverage / 5);
  }

  private calculateRiskScore(riskMetrics: any): number {
    // Convert risk metrics to 0-100 score
    const volatilityScore = Math.min(100, riskMetrics.volatility * 200);
    const varScore = Math.min(100, riskMetrics.valueAtRisk * 2);
    const drawdownScore = Math.min(100, riskMetrics.maxDrawdown * 500);

    return (volatilityScore + varScore + drawdownScore) / 3;
  }

  private calculateRiskRating(riskScore: number): string {
    if (riskScore < 20) return 'AAA';
    if (riskScore < 35) return 'AA';
    if (riskScore < 50) return 'A';
    if (riskScore < 65) return 'BBB';
    if (riskScore < 80) return 'BB';
    if (riskScore < 90) return 'B';
    return 'CCC';
  }

  private assessMarketCondition(riskMetrics: any): string {
    const volatility = riskMetrics.volatility;
    const trend = riskMetrics.sharpeRatio;

    if (volatility > 0.4) return 'VOLATILE';
    if (trend > 1) return 'BULLISH';
    if (trend < -0.5) return 'BEARISH';
    return 'SIDEWAYS';
  }

  /**
   * Update user exposure limits
   */
  async updateExposureLimits(userId: string, updates: any): Promise<any> {
    return await this.prisma.vpmxExposure.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: updates
    });
  }

  /**
   * Check for risk limit breaches
   */
  async checkRiskLimitBreaches(): Promise<any[]> {
    const breaches = await this.prisma.vpmxExposure.findMany({
      where: {
        status: 'ACTIVE',
        maxPotentialLoss: { gte: 10000 } // Example limit
      }
    });

    return breaches;
  }
}
