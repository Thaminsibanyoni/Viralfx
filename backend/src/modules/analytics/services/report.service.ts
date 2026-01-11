import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { BacktestingService } from "./backtesting.service";
import { PerformanceService } from "./performance.service";
import { AnalyticsService } from "./analytics.service";
import { BacktestResult } from '../interfaces/backtesting.interface';
// TypeORM entities removed - using Prisma instead
// import { BacktestingResult } from "../../../database/entities/backtesting-result.entity";
import {
  ReportConfig,
  Report,
  ReportStatus,
  ChartData,
  DashboardData,
  TrendAnalytics,
  PerformanceMetrics
} from '../interfaces/analytics.interface';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly backtestingService: BacktestingService,
    private readonly performanceService: PerformanceService,
    private readonly analyticsService: AnalyticsService,
    // TypeORM repository removed - using Prisma instead
    @InjectQueue('analytics-report') private readonly reportQueue: Queue,
    @Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Generate a comprehensive backtest report
   */
  async generateBacktestReport(backtestId: string): Promise<Report> {
    try {
      const reportId = this.generateReportId();
      const report: Report = {
        id: reportId,
        config: {
          type: 'backtest',
          entityType: 'strategy',
          entityId: backtestId,
          period: 'ALL_TIME',
          format: 'json'
        },
        status: 'generating',
        metadata: {
          generatedAt: new Date(),
          generatedBy: 'system',
          executionTime: 0,
          dataSize: 0
        },
        createdAt: new Date()
      };

      // Cache initial report state
      await this.redis.setex(`report:${reportId}`, 86400, JSON.stringify(report)); // 24 hours TTL

      // Queue for generation
      await this.reportQueue.add('generate-backtest-report', {
        reportId,
        backtestId,
        timestamp: new Date()
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate backtest report:', error);
      throw error;
    }
  }

  /**
   * Generate performance report for an entity
   */
  async generatePerformanceReport(config: ReportConfig, userId?: string): Promise<Report> {
    try {
      const reportId = this.generateReportId();
      const report: Report = {
        id: reportId,
        config,
        status: 'generating',
        metadata: {
          generatedAt: new Date(),
          generatedBy: userId || 'system',
          executionTime: 0,
          dataSize: 0
        },
        createdAt: new Date()
      };

      // Cache initial report state
      await this.redis.setex(`report:${reportId}`, 86400, JSON.stringify(report));

      // Queue for generation
      await this.reportQueue.add('generate-performance-report', {
        reportId,
        config,
        userId,
        timestamp: new Date()
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate performance report:', error);
      throw error;
    }
  }

  /**
   * Generate strategy comparison report
   */
  async generateStrategyComparisonReport(
    strategyIds: string[],
    symbol: string,
    period: { start: Date; end: Date },
    userId?: string
  ): Promise<Report> {
    try {
      const reportId = this.generateReportId();
      const report: Report = {
        id: reportId,
        config: {
          type: 'comparison',
          entityType: 'strategy',
          entityId: strategyIds.join(','),
          period: 'ALL_TIME',
          format: 'json',
          options: {
            symbol,
            period: period.start.toISOString() + ',' + period.end.toISOString()
          }
        },
        status: 'generating',
        metadata: {
          generatedAt: new Date(),
          generatedBy: userId || 'system',
          executionTime: 0,
          dataSize: 0
        },
        createdAt: new Date()
      };

      // Cache initial report state
      await this.redis.setex(`report:${reportId}`, 86400, JSON.stringify(report));

      // Queue for generation
      await this.reportQueue.add('generate-comparison-report', {
        reportId,
        strategyIds,
        symbol,
        period,
        userId,
        timestamp: new Date()
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate comparison report:', error);
      throw error;
    }
  }

  /**
   * Get generated report by ID
   */
  async getReport(reportId: string): Promise<Report | null> {
    try {
      const cachedReport = await this.redis.get(`report:${reportId}`);
      if (!cachedReport) {
        return null;
      }

      const report: Report = JSON.parse(cachedReport);

      // If report is still generating, check if it's ready
      if (report.status === 'generating') {
        // Could check queue status here if needed
        return report;
      }

      return report;
    } catch (error) {
      this.logger.error('Failed to get report:', error);
      return null;
    }
  }

  /**
   * Get report history for a user
   */
  async getReportHistory(
    userId?: string,
    page = 1,
    limit = 20
  ): Promise<{
    reports: Report[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const pattern = userId ? `report:*` : `report:*`;
      const keys = await this.redis.keys(pattern);

      const reports: Report[] = [];
      for (const key of keys) {
        const reportData = await this.redis.get(key);
        if (reportData) {
          const report: Report = JSON.parse(reportData);
          if (!userId || report.metadata.generatedBy === userId) {
            reports.push(report);
          }
        }
      }

      // Sort by creation date (newest first)
      reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Paginate
      const total = reports.length;
      const startIndex = (page - 1) * limit;
      const paginatedReports = reports.slice(startIndex, startIndex + limit);

      return {
        reports: paginatedReports,
        total,
        page,
        limit
      };
    } catch (error) {
      this.logger.error('Failed to get report history:', error);
      throw error;
    }
  }

  /**
   * Export report in specified format
   */
  async exportReport(reportId: string, format: 'json' | 'csv' | 'pdf' = 'json'): Promise<string> {
    try {
      const report = await this.getReport(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      if (report.status !== 'completed') {
        throw new Error('Report is not ready for export');
      }

      switch (format) {
        case 'json':
          return JSON.stringify(report.data, null, 2);
        case 'csv':
          return this.convertToCSV(report.data);
        case 'pdf':
          // PDF generation would require additional dependencies
          throw new Error('PDF export not yet implemented');
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      this.logger.error('Failed to export report:', error);
      throw error;
    }
  }

  /**
   * Queue report generation
   */
  async queueReportGeneration(reportConfig: ReportConfig, userId?: string): Promise<string> {
    try {
      switch (reportConfig.type) {
        case 'backtest':
          return (await this.generateBacktestReport(reportConfig.entityId)).id;
        case 'performance':
          return (await this.generatePerformanceReport(reportConfig, userId)).id;
        case 'comparison':
          // Parse strategy IDs from entityId
          const strategyIds = reportConfig.entityId.split(',');
          const symbol = reportConfig.options?.symbol;
          const [startDate, endDate] = reportConfig.options?.period?.split(',') || [];
          return (await this.generateStrategyComparisonReport(
            strategyIds,
            symbol,
            {
              start: new Date(startDate),
              end: new Date(endDate)
            },
            userId
          )).id;
        default:
          throw new Error(`Unsupported report type: ${reportConfig.type}`);
      }
    } catch (error) {
      this.logger.error('Failed to queue report generation:', error);
      throw error;
    }
  }

  // Internal methods for report processors

  async generateBacktestReportInternal(reportId: string, backtestId: string): Promise<void> {
    try {
      const startTime = Date.now();

      // Fetch the actual backtest result from the database
      const backtestResultEntity = await this.prisma.backtestingresultrepository.findFirst({
        where: { id: backtestId },
        relations: ['strategy']
      });

      if (!backtestResultEntity) {
        throw new Error(`Backtest result not found: ${backtestId}`);
      }

      // Map the entity to the BacktestResult interface
      const backtestResult: BacktestResult = {
        id: backtestResultEntity.id,
        strategyId: backtestResultEntity.strategyId,
        userId: backtestResultEntity.userId,
        symbol: backtestResultEntity.symbol,
        startTime: backtestResultEntity.startTime,
        endTime: backtestResultEntity.endTime,
        initialCapital: backtestResultEntity.initialCapital,
        finalCapital: backtestResultEntity.finalCapital,
        totalReturn: backtestResultEntity.totalReturn,
        sharpeRatio: backtestResultEntity.sharpeRatio,
        maxDrawdown: backtestResultEntity.maxDrawdown,
        winRate: backtestResultEntity.winRate,
        totalTrades: backtestResultEntity.totalTrades,
        winningTrades: backtestResultEntity.winningTrades,
        losingTrades: backtestResultEntity.losingTrades,
        avgWin: backtestResultEntity.avgWin,
        avgLoss: backtestResultEntity.avgLoss,
        profitFactor: backtestResultEntity.profitFactor,
        trades: backtestResultEntity.trades,
        equity: backtestResultEntity.equity,
        parameters: backtestResultEntity.parameters,
        status: backtestResultEntity.status as any,
        errorMessage: backtestResultEntity.errorMessage,
        executionTime: backtestResultEntity.executionTime,
        metadata: backtestResultEntity.metadata,
        createdAt: backtestResultEntity.createdAt,
        updatedAt: backtestResultEntity.updatedAt
      };

      // Calculate additional metrics
      const performanceMetrics = await this.performanceService.calculatePerformanceMetrics(backtestResult);

      // Generate equity curve chart data
      const equityCurveData = this.formatEquityCurveForChart(backtestResult.equity);

      // Generate trade analysis
      const tradeAnalysis = this.analyzeTrades(backtestResult.trades);

      // Generate performance summary
      const performanceSummary = this.createPerformanceSummary(performanceMetrics);

      const reportData = {
        backtestResult,
        performanceMetrics,
        charts: {
          equityCurve: equityCurveData,
          returns: this.formatReturnsForChart(backtestResult.equity),
          drawdown: this.formatDrawdownForChart(backtestResult.equity),
          tradeDistribution: this.formatTradeDistributionForChart(backtestResult.trades)
        },
        tradeAnalysis,
        performanceSummary,
        riskAnalysis: this.analyzeRisk(backtestResult, performanceMetrics)
      };

      const report: Report = {
        id: reportId,
        config: {
          type: 'backtest',
          entityType: 'strategy',
          entityId: backtestId,
          period: 'ALL_TIME',
          format: 'json'
        },
        status: 'completed',
        data: reportData,
        charts: Object.values(reportData.charts),
        metadata: {
          generatedAt: new Date(),
          generatedBy: 'system',
          executionTime: Date.now() - startTime,
          dataSize: JSON.stringify(reportData).length
        },
        completedAt: new Date(),
        createdAt: new Date()
      };

      // Save report to cache
      await this.redis.setex(`report:${reportId}`, 86400, JSON.stringify(report));

      this.logger.log(`Generated backtest report: ${reportId}`);
    } catch (error) {
      this.logger.error('Failed to generate backtest report:', error);
      await this.markReportAsFailed(reportId, error.message);
    }
  }

  async generatePerformanceReportInternal(reportId: string, config: ReportConfig, userId?: string): Promise<void> {
    try {
      const startTime = Date.now();

      // Get performance metrics for the entity
      const performanceMetrics = await this.analyticsService.getPerformanceMetrics(
        config.entityType,
        config.entityId,
        config.period
      );

      // Get historical performance data
      const historicalData = await this.getHistoricalPerformanceData(
        config.entityType,
        config.entityId,
        config.period
      );

      const reportData = {
        entity: {
          type: config.entityType,
          id: config.entityId,
          period: config.period
        },
        currentMetrics: performanceMetrics,
        historicalMetrics: historicalData,
        charts: {
          performanceTrend: this.formatPerformanceTrendForChart(historicalData),
          metricComparison: this.formatMetricComparisonForChart(performanceMetrics)
        },
        insights: this.generatePerformanceInsights(performanceMetrics, historicalData)
      };

      const report: Report = {
        id: reportId,
        config,
        status: 'completed',
        data: reportData,
        charts: Object.values(reportData.charts),
        metadata: {
          generatedAt: new Date(),
          generatedBy: userId || 'system',
          executionTime: Date.now() - startTime,
          dataSize: JSON.stringify(reportData).length
        },
        completedAt: new Date(),
        createdAt: new Date()
      };

      // Save report to cache
      await this.redis.setex(`report:${reportId}`, 86400, JSON.stringify(report));

      this.logger.log(`Generated performance report: ${reportId}`);
    } catch (error) {
      this.logger.error('Failed to generate performance report:', error);
      await this.markReportAsFailed(reportId, error.message);
    }
  }

  async generateComparisonReportInternal(
    reportId: string,
    strategyIds: string[],
    symbol: string,
    period: { start: Date; end: Date },
    userId?: string
  ): Promise<void> {
    try {
      const startTime = Date.now();

      // Get performance data for all strategies
      const comparisonData = await this.performanceService.comparePerformance(
        strategyIds,
        'ALL_TIME',
        'STRATEGY'
      );

      // Run backtests if needed
      const backtestResults = [];
      for (const strategyId of strategyIds) {
        try {
          const backtestHistory = await this.backtestingService.getBacktestHistory(strategyId, symbol);
          if (backtestHistory.results.length > 0) {
            backtestResults.push({
              strategyId,
              result: backtestHistory.results[0] // Get latest result
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to get backtest history for strategy ${strategyId}:`, error);
        }
      }

      // Create ranking
      const ranking = this.createStrategyRanking(comparisonData, backtestResults);

      const reportData = {
        comparison: {
          symbol,
          period: period.start.toISOString() + ' - ' + period.end.toISOString(),
          strategies: strategyIds
        },
        metrics: comparisonData,
        backtests: backtestResults,
        ranking,
        charts: {
          performanceComparison: this.formatPerformanceComparisonForChart(comparisonData),
          riskReturnScatter: this.formatRiskReturnScatterForChart(comparisonData),
          metricHeatmap: this.formatMetricHeatmapForChart(comparisonData)
        },
        insights: this.generateComparisonInsights(comparisonData, ranking)
      };

      const report: Report = {
        id: reportId,
        config: {
          type: 'comparison',
          entityType: 'strategy',
          entityId: strategyIds.join(','),
          period: 'ALL_TIME',
          format: 'json'
        },
        status: 'completed',
        data: reportData,
        charts: Object.values(reportData.charts),
        metadata: {
          generatedAt: new Date(),
          generatedBy: userId || 'system',
          executionTime: Date.now() - startTime,
          dataSize: JSON.stringify(reportData).length
        },
        completedAt: new Date(),
        createdAt: new Date()
      };

      // Save report to cache
      await this.redis.setex(`report:${reportId}`, 86400, JSON.stringify(report));

      this.logger.log(`Generated comparison report: ${reportId}`);
    } catch (error) {
      this.logger.error('Failed to generate comparison report:', error);
      await this.markReportAsFailed(reportId, error.message);
    }
  }

  // Helper methods

  private generateReportId(): string {
    return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatEquityCurveForChart(equity: Array<{ timestamp: Date; equity: number }>): ChartData {
    return {
      type: 'line',
      title: 'Equity Curve',
      data: equity.map(point => ({
        time: point.timestamp.toISOString(),
        value: point.equity
      })),
      config: {
        xAxis: 'time',
        yAxis: 'value',
        color: '#10B981'
      }
    };
  }

  private formatReturnsForChart(equity: Array<{ timestamp: Date; returns: number }>): ChartData {
    return {
      type: 'line',
      title: 'Returns Over Time',
      data: equity.map(point => ({
        time: point.timestamp.toISOString(),
        value: point.returns * 100 // Convert to percentage
      })),
      config: {
        xAxis: 'time',
        yAxis: 'value',
        color: '#3B82F6'
      }
    };
  }

  private formatDrawdownForChart(equity: Array<{ timestamp: Date; returns: number }>): ChartData {
    const drawdownSeries = this.performanceService.calculateDrawdownSeries(equity);
    return {
      type: 'area',
      title: 'Drawdown',
      data: drawdownSeries.map(point => ({
        time: point.timestamp.toISOString(),
        value: point.drawdown
      })),
      config: {
        xAxis: 'time',
        yAxis: 'value',
        color: '#EF4444'
      }
    };
  }

  private formatTradeDistributionForChart(trades: any[]): ChartData {
    const profits = trades.map(t => t.profit);
    const bins = this.createHistogramBins(profits, 10);

    return {
      type: 'bar',
      title: 'Trade Distribution',
      data: bins.map(bin => ({
        range: bin.range,
        count: bin.count
      })),
      config: {
        xAxis: 'range',
        yAxis: 'count',
        color: '#8B5CF6'
      }
    };
  }

  private formatPerformanceTrendForChart(historicalData: any): ChartData {
    return {
      type: 'line',
      title: 'Performance Trend',
      data: historicalData.map((point: any) => ({
        time: point.timestamp,
        value: point.totalReturn * 100
      })),
      config: {
        xAxis: 'time',
        yAxis: 'value',
        color: '#10B981'
      }
    };
  }

  private formatMetricComparisonForChart(metrics: PerformanceMetrics): ChartData {
    const data = [
      { metric: 'Total Return', value: metrics.totalReturn * 100 },
      { metric: 'Sharpe Ratio', value: metrics.sharpeRatio },
      { metric: 'Win Rate', value: metrics.winRate },
      { metric: 'Profit Factor', value: metrics.profitFactor },
    ];

    return {
      type: 'bar',
      title: 'Performance Metrics',
      data,
      config: {
        xAxis: 'metric',
        yAxis: 'value',
        color: '#3B82F6'
      }
    };
  }

  private formatPerformanceComparisonForChart(comparisonData: Record<string, PerformanceMetrics>): ChartData {
    const data = Object.entries(comparisonData).map(([strategyId, metrics]) => ({
      strategy: strategyId,
      totalReturn: metrics.totalReturn * 100,
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown * 100,
      winRate: metrics.winRate
    }));

    return {
      type: 'bar',
      title: 'Strategy Performance Comparison',
      data,
      config: {
        xAxis: 'strategy',
        yAxis: 'value',
        color: '#8B5CF6'
      }
    };
  }

  private formatRiskReturnScatterForChart(comparisonData: Record<string, PerformanceMetrics>): ChartData {
    const data = Object.entries(comparisonData).map(([strategyId, metrics]) => ({
      x: metrics.maxDrawdown * 100,
      y: metrics.totalReturn * 100,
      name: strategyId
    }));

    return {
      type: 'scatter',
      title: 'Risk vs Return',
      data,
      config: {
        xAxis: 'maxDrawdown',
        yAxis: 'totalReturn',
        color: '#EF4444'
      }
    };
  }

  private formatMetricHeatmapForChart(comparisonData: Record<string, PerformanceMetrics>): ChartData {
    const metrics = ['totalReturn', 'sharpeRatio', 'maxDrawdown', 'winRate'];
    const data = [];

    Object.entries(comparisonData).forEach(([strategyId, metricsData]) => {
      metrics.forEach(metric => {
        data.push({
          strategy: strategyId,
          metric,
          value: metricsData[metric as keyof PerformanceMetrics]
        });
      });
    });

    return {
      type: 'heatmap',
      title: 'Performance Heatmap',
      data,
      config: {
        xAxis: 'strategy',
        yAxis: 'metric',
        color: '#10B981'
      }
    };
  }

  private analyzeTrades(trades: any[]): any {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        bestTrade: null,
        worstTrade: null,
        averageHoldTime: 0,
        profitFactor: 0
      };
    }

    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      bestTrade: winningTrades.reduce((best, trade) =>
        trade.profit > (best?.profit || 0) ? trade : best, null),
      worstTrade: losingTrades.reduce((worst, trade) =>
        trade.profit < (worst?.profit || 0) ? trade : worst, null),
      averageHoldTime: trades.reduce((sum, t) => sum + t.holdPeriod, 0) / trades.length,
      profitFactor: this.calculateProfitFactor(trades)
    };
  }

  private createPerformanceSummary(metrics: PerformanceMetrics): any {
    return {
      overall: metrics.totalReturn >= 0 ? 'Profitable' : 'Loss-making',
      riskAdjustedReturn: metrics.sharpeRatio > 1 ? 'Excellent' : metrics.sharpeRatio > 0.5 ? 'Good' : 'Poor',
      consistency: metrics.winRate > 70 ? 'High' : metrics.winRate > 50 ? 'Medium' : 'Low',
      riskLevel: metrics.maxDrawdown < 0.1 ? 'Low' : metrics.maxDrawdown < 0.2 ? 'Medium' : 'High'
    };
  }

  private analyzeRisk(backtestResult: BacktestResult, metrics: PerformanceMetrics): any {
    return {
      maxDrawdown: metrics.maxDrawdown,
      volatility: metrics.volatility,
      var95: this.calculateVaR(backtestResult.equity, 0.05),
      beta: metrics.beta,
      alpha: metrics.alpha,
      riskOfRuin: this.calculateRiskOfRuin(backtestResult.trades)
    };
  }

  private generatePerformanceInsights(metrics: PerformanceMetrics, historicalData: any[]): string[] {
    const insights: string[] = [];

    if (metrics.totalReturn > 0) {
      insights.push(`Strategy generated ${metrics.totalReturn.toFixed(2)}% returns`);
    }

    if (metrics.sharpeRatio > 1.5) {
      insights.push('Excellent risk-adjusted returns with Sharpe ratio above 1.5');
    }

    if (metrics.winRate > 70) {
      insights.push('High win rate indicates strong strategy consistency');
    }

    if (metrics.maxDrawdown > 0.2) {
      insights.push('High maximum drawdown suggests elevated risk exposure');
    }

    return insights;
  }

  private generateComparisonInsights(comparisonData: Record<string, PerformanceMetrics>, ranking: any[]): string[] {
    const insights: string[] = [];

    if (ranking.length > 0) {
      const best = ranking[0];
      insights.push(`${best.strategyId} performs best with ${best.totalReturn.toFixed(2)}% returns`);

      const worst = ranking[ranking.length - 1];
      insights.push(`${worst.strategyId} underperforms with ${worst.totalReturn.toFixed(2)}% returns`);
    }

    return insights;
  }

  private createStrategyRanking(comparisonData: Record<string, PerformanceMetrics>, backtestResults: any[]): any[] {
    const ranking = Object.entries(comparisonData).map(([strategyId, metrics]) => ({
      strategyId,
      totalReturn: metrics.totalReturn,
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      winRate: metrics.winRate,
      hasBacktest: backtestResults.some(r => r.strategyId === strategyId)
    }));

    return ranking.sort((a, b) => b.totalReturn - a.totalReturn);
  }

  private async getHistoricalPerformanceData(
    entityType: string,
    entityId: string,
    period: string
  ): Promise<any[]> {
    // This would query historical performance data from database
    // For now, return mock data
    return [];
  }

  private createHistogramBins(values: number[], binCount: number): Array<{ range: string; count: number }> {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => ({
      range: `${(min + i * binSize).toFixed(2)}-${(min + (i + 1) * binSize).toFixed(2)}`,
      count: 0
    }));

    values.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1);
      if (binIndex >= 0) {
        bins[binIndex].count++;
      }
    });

    return bins;
  }

  private calculateProfitFactor(trades: any[]): number {
    const grossProfit = trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(trades.filter(t => t.profit < 0).reduce((sum, t) => sum + t.profit, 0));
    return grossLoss === 0 ? Infinity : grossProfit / grossLoss;
  }

  private calculateVaR(equity: Array<{ returns: number }>, confidence: number): number {
    const returns = equity.map(e => e.returns || 0).sort((a, b) => a - b);
    const index = Math.floor(returns.length * confidence);
    return Math.abs(returns[index] || 0);
  }

  private calculateRiskOfRuin(trades: any[]): number {
    if (trades.length === 0) return 0;

    const losingTrades = trades.filter(t => t.profit < 0);
    if (losingTrades.length === 0) return 0;

    const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length);
    const winRate = (trades.length - losingTrades.length) / trades.length;

    // Simplified risk of ruin calculation
    return winRate === 0 ? 1 : Math.pow((1 - winRate) / winRate, 10);
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - would need to be enhanced based on data structure
    if (Array.isArray(data)) {
      const headers = Object.keys(data[0] || {});
      const rows = data.map(item => headers.map(header => item[header]).join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    return JSON.stringify(data);
  }

  private async markReportAsFailed(reportId: string, errorMessage: string): Promise<void> {
    try {
      const report = await this.getReport(reportId);
      if (report) {
        report.status = 'failed';
        // In a real implementation, you'd store the error message
        await this.redis.setex(`report:${reportId}`, 86400, JSON.stringify(report));
      }
    } catch (error) {
      this.logger.error('Failed to mark report as failed:', error);
    }
  }
}
