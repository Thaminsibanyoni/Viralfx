import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

import { PerformanceMetric } from '../../../database/entities/performance-metric.entity';
import { BacktestingResult } from '../../../database/entities/backtesting-result.entity';
import { BacktestingStrategy } from '../../../database/entities/backtesting-strategy.entity';
import { MarketData } from '../../../database/entities/market-data.entity';
import { PrismaService } from '../../prisma/prisma.service';
import { BacktestResult } from '../interfaces/backtesting.interface';
import { PerformanceMetrics } from '../interfaces/analytics.interface';

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);

  constructor(
    @InjectRepository(PerformanceMetric)
    private readonly performanceMetricRepository: Repository<PerformanceMetric>,
    @InjectRepository(BacktestingResult)
    private readonly backtestingResultRepository: Repository<BacktestingResult>,
    @InjectRepository(MarketData)
    private readonly marketDataRepository: Repository<MarketData>,
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private configService: ConfigService,
  ) {}

  /**
   * Calculate performance metrics from a backtest result
   */
  async calculatePerformanceMetrics(backtestResult: BacktestResult): Promise<PerformanceMetrics> {
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

      const metrics: PerformanceMetrics = {
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
        sortinoRatio,
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

      // Get all backtest results for the strategy in the period
      const results = await this.backtestingResultRepository.find({
        where: {
          strategyId,
          status: 'COMPLETED',
          createdAt: Between(startTime, endTime),
        },
        order: { createdAt: 'ASC' },
      });

      if (results.length === 0) {
        this.logger.debug(`No backtest results found for strategy ${strategyId} in period ${period}`);
        return;
      }

      // Calculate aggregate metrics
      const aggregateMetrics = this.calculateAggregateMetrics(results);

      // Save each metric as a separate record
      for (const [metricType, metricValue] of Object.entries(aggregateMetrics)) {
        await this.performanceMetricRepository.save({
          entityType: 'STRATEGY',
          entityId: strategyId,
          metricType: metricType as any,
          metricValue,
          period,
          startTime,
          endTime,
          sampleSize: results.length,
          metadata: {
            riskFreeRate: this.configService.get<number>('ANALYTICS_RISK_FREE_RATE', 0.02),
            calculationMethod: 'aggregate_backtest_results',
            resultIds: results.map(r => r.id),
          },
          timestamp: new Date(),
        });
      }

      // Invalidate cache
      await this.invalidatePerformanceCache('STRATEGY', strategyId, period);

      this.logger.log(`Tracked performance for strategy ${strategyId} in period ${period}`);
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

      // Get all backtest results for the user in the period
      const results = await this.backtestingResultRepository.find({
        where: {
          userId,
          status: 'COMPLETED',
          createdAt: Between(startTime, endTime),
        },
        order: { createdAt: 'ASC' },
      });

      if (results.length === 0) {
        this.logger.debug(`No backtest results found for user ${userId} in period ${period}`);
        return;
      }

      // Calculate aggregate metrics across all user's strategies
      const aggregateMetrics = this.calculateAggregateMetrics(results);

      // Save each metric
      for (const [metricType, metricValue] of Object.entries(aggregateMetrics)) {
        await this.performanceMetricRepository.save({
          entityType: 'USER',
          entityId: userId,
          metricType: metricType as any,
          metricValue,
          period,
          startTime,
          endTime,
          sampleSize: results.length,
          metadata: {
            riskFreeRate: this.configService.get<number>('ANALYTICS_RISK_FREE_RATE', 0.02),
            calculationMethod: 'aggregate_user_backtests',
            strategyCount: new Set(results.map(r => r.strategyId)).size,
            resultIds: results.map(r => r.id),
          },
          timestamp: new Date(),
        });
      }

      // Invalidate cache
      await this.invalidatePerformanceCache('USER', userId, period);

      this.logger.log(`Tracked performance for user ${userId} in period ${period}`);
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

      const { startTime, endTime } = this.getPeriodRange(period);

      const query = this.performanceMetricRepository.createQueryBuilder('metric')
        .where('metric.entityType = :entityType', { entityType })
        .andWhere('metric.metricType = :metricType', { metricType })
        .andWhere('metric.period = :period', { period })
        .andWhere('metric.timestamp >= :startTime', { startTime })
        .orderBy('metric.metricValue', 'DESC')
        .limit(limit);

      if (entityType === 'STRATEGY') {
        query.leftJoin(BacktestingStrategy, 'strategy', 'strategy.id = metric.entityId')
          .addSelect(['strategy.name', 'strategy.userId']);
      }

      const metrics = await query.getMany();

      const leaderboard = metrics.map((metric, index) => ({
        entityId: metric.entityId,
        entityName: entityType === 'STRATEGY' ? (metric as any).strategy?.name : undefined,
        metricValue: parseFloat(metric.metricValue.toString()),
        rank: index + 1,
        metadata: metric.metadata,
      }));

      // Cache for 10 minutes
      await this.redis.setex(cacheKey, 600, JSON.stringify(leaderboard));

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

      const result: Record<string, PerformanceMetrics> = {};

      for (const entityId of entityIds) {
        const metrics = await this.performanceMetricRepository.find({
          where: {
            entityType,
            entityId,
            period,
            timestamp: Between(startTime, endTime),
          },
        });

        if (metrics.length > 0) {
          const performanceMetrics: PerformanceMetrics = {
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
            sortinoRatio: this.getMetricValue(metrics, 'SORTINO_RATIO'),
          };

          result[entityId] = performanceMetrics;
        }
      }

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
        returns: totalReturn,
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
        peak,
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
        benchmark: benchmarkReturns[index] || 0,
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
      // For viral assets, use average market performance as benchmark
      // In a real implementation, this would use a proper market index
      const marketData = await this.marketDataRepository.find({
        where: {
          timestamp: Between(startTime, endTime),
        },
        order: { timestamp: 'ASC' },
      });

      if (marketData.length < 2) {
        return [];
      }

      const returns: number[] = [];
      for (let i = 1; i < marketData.length; i++) {
        const current = marketData[i].closePrice;
        const previous = marketData[i - 1].closePrice;
        returns.push((current - previous) / previous);
      }

      return returns;
    } catch (error) {
      this.logger.warn('Failed to get benchmark returns:', error);
      return [];
    }
  }

  private calculateAggregateMetrics(results: BacktestingResult[]): Record<string, number> {
    const totalReturn = results.reduce((sum, r) => sum + r.totalReturn, 0) / results.length;
    const sharpeRatio = results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length;
    const maxDrawdown = results.reduce((sum, r) => sum + r.maxDrawdown, 0) / results.length;
    const winRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
    const totalTrades = results.reduce((sum, r) => sum + r.totalTrades, 0);
    const profitFactor = results.reduce((sum, r) => sum + (r.profitFactor || 0), 0) / results.filter(r => r.profitFactor).length;

    return {
      TOTAL_RETURN: totalReturn,
      SHARPE_RATIO: sharpeRatio,
      MAX_DRAWDOWN: maxDrawdown,
      WIN_RATE: winRate,
      TOTAL_TRADES: totalTrades,
      PROFIT_FACTOR: profitFactor,
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

  private getMetricValue(metrics: PerformanceMetric[], metricType: string): number {
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