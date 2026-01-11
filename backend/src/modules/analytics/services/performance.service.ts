import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

// Temporarily simplified to get server running - TypeORM imports removed
// import { BacktestResult } from '../interfaces/backtesting.interface';
// import { PerformanceMetrics } from '../interfaces/analytics.interface';

// Type definitions for compatibility
type BacktestResult = any;
type PerformanceMetrics = any;

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);

  constructor(
    // TypeORM repositories removed - using Prisma instead
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private configService: ConfigService) {}

  /**
   * Calculate performance metrics from a backtest result
   */
  async calculatePerformanceMetrics(backtestResult: any): Promise<any> {
    try {
      const riskFreeRate = this.configService.get<number>('ANALYTICS_RISK_FREE_RATE', 0.02);

      // Basic metrics (already calculated in BacktestingService)
      const totalReturn = backtestResult.totalReturn;
      const sharpeRatio = backtestResult.sharpeRatio;
      const maxDrawdown = backtestResult.maxDrawdown;
      const winRate = backtestResult.winRate;
      const totalTrades = backtestResult.totalTrades;

      // Additional calculations
      const avgWin = this.calculateAverageWin(backtestResult.trades);
      const avgLoss = this.calculateAverageLoss(backtestResult.trades);
      const profitFactor = this.calculateProfitFactor(backtestResult.trades);
      const volatility = this.calculateVolatility(backtestResult.equity);
      const { alpha, beta } = await this.calculateAlphaBeta(backtestResult, riskFreeRate);
      const calmarRatio = this.calculateCalmarRatio(totalReturn, maxDrawdown);
      const sortinoRatio = this.calculateSortinoRatio(backtestResult.equity, riskFreeRate);

      const metrics: any = {
        totalReturn,
        sharpeRatio,
        maxDrawdown,
        winRate,
        totalTrades,
        profitFactor,
        avgWin,
        avgLoss,
        volatility,
        alpha,
        beta,
        calmarRatio,
        sortinoRatio
      };

      this.logger.debug(`Calculated performance metrics for backtest ${backtestResult.id}`);
      return metrics;
    } catch (error) {
      this.logger.error('Failed to calculate performance metrics:', error);
      throw error;
    }
  }

  /**
   * Track strategy performance over time
   */
  async trackStrategyPerformance(
    strategyId: string,
    period: '1D' | '7D' | '30D' | '90D' | '1Y' | 'ALL_TIME' = 'ALL_TIME'
  ): Promise<void> {
    try {
      const { startTime, endTime } = this.getPeriodRange(period);

      // TODO: Implement with Prisma when analytics tables are ready
      // For now, just log and cache placeholder data
      this.logger.debug(`Tracking performance for strategy ${strategyId} in period ${period}`);

      // Placeholder implementation - would query Prisma analytics tables
      const mockResults = [];

      if (mockResults.length === 0) {
        this.logger.debug(`No backtest results found for strategy ${strategyId} in period ${period}`);
        return;
      }

      // Invalidate cache
      await this.invalidatePerformanceCache('STRATEGY', strategyId, period);

      this.logger.log(`Tracked performance for strategy ${strategyId} in period ${period} (placeholder)`);
    } catch (error) {
      this.logger.error('Failed to track strategy performance:', error);
      throw error;
    }
  }

  /**
   * Track user performance across all their strategies
   */
  async trackUserPerformance(
    userId: string,
    period: '1D' | '7D' | '30D' | '90D' | '1Y' | 'ALL_TIME' = 'ALL_TIME'
  ): Promise<void> {
    try {
      const { startTime, endTime } = this.getPeriodRange(period);

      // TODO: Implement with Prisma when analytics tables are ready
      this.logger.debug(`Tracking performance for user ${userId} in period ${period}`);

      // Placeholder implementation - would query Prisma analytics tables
      const mockResults = [];

      if (mockResults.length === 0) {
        this.logger.debug(`No backtest results found for user ${userId} in period ${period}`);
        return;
      }

      // Invalidate cache
      await this.invalidatePerformanceCache('USER', userId, period);

      this.logger.log(`Tracked performance for user ${userId} in period ${period} (placeholder)`);
    } catch (error) {
      this.logger.error('Failed to track user performance:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard for a specific metric and period
   */
  async getLeaderboard(
    metricType: string,
    period: '1D' | '7D' | '30D' | '90D' | '1Y' | 'ALL_TIME' = 'ALL_TIME',
    limit = 50,
    entityType: 'STRATEGY' | 'USER' = 'STRATEGY'
  ): Promise<Array<{
    entityId: string;
    entityName?: string;
    metricValue: number;
    rank: number;
    metadata?: any;
  }>> {
    try {
      const cacheKey = `leaderboard:${entityType}:${metricType}:${period}:${limit}`;
      const cachedLeaderboard = await this.redis.get(cacheKey);
      if (cachedLeaderboard) {
        return JSON.parse(cachedLeaderboard);
      }

      // TODO: Implement with Prisma when analytics tables are ready
      // For now, return empty leaderboard
      const leaderboard: Array<{
        entityId: string;
        entityName?: string;
        metricValue: number;
        rank: number;
        metadata?: any;
      }> = [];

      // Cache for 10 minutes
      await this.redis.setex(cacheKey, 600, JSON.stringify(leaderboard));

      this.logger.debug(`Retrieved ${entityType} leaderboard for ${metricType}:${period} (placeholder)`);
      return leaderboard;
    } catch (error) {
      this.logger.error('Failed to get leaderboard:', error);
      throw error;
    }
  }

  /**
   * Compare performance of multiple entities
   */
  async comparePerformance(
    entityIds: string[],
    period: '1D' | '7D' | '30D' | '90D' | '1Y' | 'ALL_TIME' = 'ALL_TIME',
    entityType: 'STRATEGY' | 'USER' = 'STRATEGY'
  ): Promise<Record<string, PerformanceMetrics>> {
    try {
      const { startTime, endTime } = this.getPeriodRange(period);

      const result: Record<string, any> = {};

      // TODO: Implement with Prisma when analytics tables are ready
      for (const entityId of entityIds) {
        // Placeholder implementation - return empty metrics
        result[entityId] = {
          totalReturn: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          winRate: 0,
          totalTrades: 0,
          profitFactor: 0,
          avgWin: 0,
          avgLoss: 0,
          volatility: 0,
          alpha: 0,
          beta: 1,
          calmarRatio: 0,
          sortinoRatio: 0
        };
      }

      this.logger.debug(`Compared performance for ${entityIds.length} ${entityType}s (placeholder)`);
      return result;
    } catch (error) {
      this.logger.error('Failed to compare performance:', error);
      throw error;
    }
  }

  /**
   * Calculate equity curve from trade history
   */
  calculateEquityCurve(
    trades: any[],
    initialCapital: number = 10000
  ): Array<{ timestamp: Date; equity: number; returns: number }> {
    const equityCurve: Array<{ timestamp: Date; equity: number; returns: number }> = [];
    let currentEquity = initialCapital;

    // Sort trades by entry time
    const sortedTrades = [...trades].sort((a, b) =>
      new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
    );

    for (const trade of sortedTrades) {
      currentEquity += trade.profit;
      const totalReturn = (currentEquity / initialCapital) - 1;

      equityCurve.push({
        timestamp: new Date(trade.exitTime),
        equity: currentEquity,
        returns: totalReturn
      });
    }

    return equityCurve;
  }

  /**
   * Calculate drawdown series from equity curve
   */
  calculateDrawdownSeries(equityCurve: Array<{ equity: number }>): Array<{
    timestamp: Date;
    drawdown: number;
    peak: number;
  }> {
    const drawdownSeries: Array<{ timestamp: Date; drawdown: number; peak: number }> = [];
    let peak = equityCurve[0]?.equity || 0;

    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }

      const drawdown = ((peak - point.equity) / peak) * 100;
      drawdownSeries.push({
        timestamp: point.timestamp || new Date(),
        drawdown,
        peak
      });
    }

    return drawdownSeries;
  }

  // Helper methods

  private calculateAverageWin(trades: any[]): number {
    const winningTrades = trades.filter(trade => trade.profit > 0);
    if (winningTrades.length === 0) return 0;
    return winningTrades.reduce((sum, trade) => sum + trade.profit, 0) / winningTrades.length;
  }

  private calculateAverageLoss(trades: any[]): number {
    const losingTrades = trades.filter(trade => trade.profit < 0);
    if (losingTrades.length === 0) return 0;
    const totalLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.profit, 0));
    return totalLoss / losingTrades.length;
  }

  private calculateProfitFactor(trades: any[]): number {
    const grossProfit = trades
      .filter(trade => trade.profit > 0)
      .reduce((sum, trade) => sum + trade.profit, 0);
    const grossLoss = Math.abs(trades
      .filter(trade => trade.profit < 0)
      .reduce((sum, trade) => sum + trade.profit, 0));

    return grossLoss === 0 ? Infinity : grossProfit / grossLoss;
  }

  private calculateVolatility(equity: Array<{ returns: number }>): number {
    if (equity.length < 2) return 0;

    const returns = equity.slice(1).map(point => point.returns || 0);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    // Annualized volatility (assuming daily returns)
    return Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  private async calculateAlphaBeta(
    backtestResult: BacktestResult,
    riskFreeRate: number
  ): Promise<{ alpha: number; beta: number }> {
    try {
      // Get benchmark data (e.g., S&P 500 or market index)
      // For now, use a simple approximation with market data
      const benchmarkReturns = await this.getBenchmarkReturns(
        backtestResult.symbol,
        backtestResult.startTime,
        backtestResult.endTime
      );

      if (benchmarkReturns.length < 2) {
        return { alpha: 0, beta: 1 };
      }

      // Calculate returns for the strategy
      const strategyReturns = backtestResult.equity.slice(1).map((point, index) => ({
        strategy: point.returns || 0,
        benchmark: benchmarkReturns[index] || 0
      }));

      // Calculate beta (covariance / variance)
      const avgStrategyReturn = strategyReturns.reduce((sum, r) => sum + r.strategy, 0) / strategyReturns.length;
      const avgBenchmarkReturn = strategyReturns.reduce((sum, r) => sum + r.benchmark, 0) / strategyReturns.length;

      let covariance = 0;
      let variance = 0;

      for (const pair of strategyReturns) {
        covariance += (pair.strategy - avgStrategyReturn) * (pair.benchmark - avgBenchmarkReturn);
        variance += Math.pow(pair.benchmark - avgBenchmarkReturn, 2);
      }

      covariance /= strategyReturns.length;
      variance /= strategyReturns.length;

      const beta = variance === 0 ? 1 : covariance / variance;

      // Calculate alpha (actual return - expected return)
      const expectedReturn = riskFreeRate + beta * (avgBenchmarkReturn - riskFreeRate);
      const alpha = avgStrategyReturn - expectedReturn;

      return { alpha, beta };
    } catch (error) {
      this.logger.warn('Failed to calculate alpha/beta, using defaults:', error);
      return { alpha: 0, beta: 1 };
    }
  }

  private calculateCalmarRatio(totalReturn: number, maxDrawdown: number): number {
    return maxDrawdown === 0 ? 0 : totalReturn / Math.abs(maxDrawdown);
  }

  private calculateSortinoRatio(equity: Array<{ returns: number }>, riskFreeRate: number): number {
    if (equity.length < 2) return 0;

    const returns = equity.slice(1).map(point => point.returns || 0);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate downside deviation
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return Infinity;

    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);

    return downsideDeviation === 0 ? 0 : (avgReturn - riskFreeRate) / downsideDeviation;
  }

  private async getBenchmarkReturns(
    symbol: string,
    startTime: Date,
    endTime: Date
  ): Promise<number[]> {
    try {
      // TODO: Implement with Prisma when market data tables are ready
      // For viral assets, use average market performance as benchmark
      // In a real implementation, this would use a proper market index
      this.logger.debug(`Getting benchmark returns for ${symbol} (placeholder)`);
      return [];
    } catch (error) {
      this.logger.warn('Failed to get benchmark returns:', error);
      return [];
    }
  }

  private calculateAggregateMetrics(results: BacktestingResult[]): Record<string, number> {
    // TODO: Implement with actual results when analytics tables are ready
    if (results.length === 0) {
      return {
        TOTAL_RETURN: 0,
        SHARPE_RATIO: 0,
        MAX_DRAWDOWN: 0,
        WIN_RATE: 0,
        TOTAL_TRADES: 0,
        PROFIT_FACTOR: 0
      };
    }

    // Placeholder calculation for when we have real results
    const totalReturn = results.reduce((sum: number, r: any) => sum + (r.totalReturn || 0), 0) / results.length;
    const sharpeRatio = results.reduce((sum: number, r: any) => sum + (r.sharpeRatio || 0), 0) / results.length;
    const maxDrawdown = results.reduce((sum: number, r: any) => sum + (r.maxDrawdown || 0), 0) / results.length;
    const winRate = results.reduce((sum: number, r: any) => sum + (r.winRate || 0), 0) / results.length;
    const totalTrades = results.reduce((sum: number, r: any) => sum + (r.totalTrades || 0), 0);
    const profitFactorResults = results.filter((r: any) => r.profitFactor);
    const profitFactor = profitFactorResults.length > 0
      ? profitFactorResults.reduce((sum: number, r: any) => sum + r.profitFactor, 0) / profitFactorResults.length
      : 0;

    return {
      TOTAL_RETURN: totalReturn,
      SHARPE_RATIO: sharpeRatio,
      MAX_DRAWDOWN: maxDrawdown,
      WIN_RATE: winRate,
      TOTAL_TRADES: totalTrades,
      PROFIT_FACTOR: profitFactor
    };
  }

  private getPeriodRange(period: string): { startTime: Date; endTime: Date } {
    const endTime = new Date();
    let startTime: Date;

    switch (period) {
      case '1D':
        startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7D':
        startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30D':
        startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90D':
        startTime = new Date(endTime.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1Y':
        startTime = new Date(endTime.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'ALL_TIME':
      default:
        startTime = new Date(0); // Beginning of time
        break;
    }

    return { startTime, endTime };
  }

  private getMetricValue(metrics: any[], metricType: string): number {
    const metric = metrics.find(m => m.metricType === metricType);
    return metric ? parseFloat(metric.metricValue.toString()) : 0;
  }

  private async invalidatePerformanceCache(
    entityType: string,
    entityId: string,
    period: string
  ): Promise<void> {
    const patterns = [
      `perf:${entityType}:${entityId}:${period}`,
      `leaderboard:${entityType}:*:${period}:*`,
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}
