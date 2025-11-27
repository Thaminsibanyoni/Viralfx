import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Redis } from 'ioredis';

import { BacktestConfig, BacktestResult, BacktestStrategy, StrategyRule, BacktestStatus } from '../interfaces/backtesting.interface';
import { BacktestingStrategy } from '../../../database/entities/backtesting-strategy.entity';
import { BacktestingResult } from '../../../database/entities/backtesting-result.entity';
import { MarketData } from '../../../database/entities/market-data.entity';
import { WebSocketGateway } from '../../websocket/gateways/websocket.gateway';

@Injectable()
export class BacktestingService {
  private readonly logger = new Logger(BacktestingService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @InjectRepository(BacktestingStrategy)
    private readonly backtestingStrategyRepository: Repository<BacktestingStrategy>,
    @InjectRepository(BacktestingResult)
    private readonly backtestingResultRepository: Repository<BacktestingResult>,
    @InjectRepository(MarketData)
    private readonly marketDataRepository: Repository<MarketData>,
    @InjectQueue('analytics-backtest') private readonly backtestingQueue: Queue,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly webSocketGateway: WebSocketGateway,
  ) {}

  /**
   * Run a backtest
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    try {
      this.logger.log(`Starting backtest for strategy ${config.strategyId}`);

      // 1. Load historical data
      const historicalData = await this.loadHistoricalData(
        config.symbol,
        config.startTime,
        config.endTime
      );

      if (historicalData.length === 0) {
        throw new Error('No historical data found for the specified period');
      }

      // 2. Load strategy configuration
      const strategy = await this.loadStrategy(config.strategyId);

      // 3. Execute backtest
      const result = await this.executeBacktest(
        config,
        strategy,
        historicalData
      );

      // 4. Save backtest results
      await this.saveBacktestResult(result);

      this.logger.log(`Backtest completed: ${result.id}`);
      return result;

    } catch (error) {
      this.logger.error('Backtest execution failed:', error);
      throw error;
    }
  }

  /**
   * Load historical market data
   */
  private async loadHistoricalData(
    symbol: string,
    startTime: Date,
    endTime: Date
  ): Promise<any[]> {
    try {
      // Check cache first
      const cacheKey = `historical:${symbol}:${startTime.getTime()}:${endTime.getTime()}`;
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for historical data: ${cacheKey}`);
        return JSON.parse(cachedData);
      }

      // Query MarketData from TypeORM first
      const marketData = await this.marketDataRepository.find({
        where: {
          symbol,
          timestamp: Between(startTime, endTime)
        },
        order: { timestamp: 'ASC' }
      });

      if (marketData.length > 0) {
        // Cache the result for 30 minutes
        await this.redis.setex(cacheKey, 1800, JSON.stringify(marketData));
        return marketData;
      }

      // Fallback to Prisma ViralIndexSnapshot (following pricing-engine pattern)
      this.logger.log(`No MarketData found for ${symbol}, querying ViralIndexSnapshot`);

      // Find trend by symbol
      const trend = await this.prisma.trend.findFirst({
        where: { topicName: symbol },
        include: {
          viralIndexSnapshots: {
            where: {
              timestamp: {
                gte: startTime,
                lte: endTime
              }
            },
            orderBy: { timestamp: 'asc' }
          }
        }
      });

      if (!trend || trend.viralIndexSnapshots.length === 0) {
        throw new Error(`No historical data found for ${symbol} in the specified period`);
      }

      // Transform ViralIndexSnapshot data to match expected structure
      const transformedData = trend.viralIndexSnapshots.map(snapshot => ({
        timestamp: snapshot.timestamp,
        symbol,
        close_price: snapshot.viralIndex,
        volume: snapshot.engagementTotal,
        virality_score: snapshot.viralIndex,
        sentiment_score: snapshot.sentimentMean,
        velocity: snapshot.viralVelocity,
        engagement_rate: snapshot.engagementRate,
        momentum_score: snapshot.momentumScore || 0,
        open_price: snapshot.viralIndex, // Use same as close for now
        high_price: snapshot.viralIndex,
        low_price: snapshot.viralIndex,
      }));

      // Cache the transformed data
      await this.redis.setex(cacheKey, 1800, JSON.stringify(transformedData));

      return transformedData;
    } catch (error) {
      this.logger.error('Failed to load historical data:', error);
      throw error;
    }
  }

  /**
   * Load strategy configuration
   */
  private async loadStrategy(strategyId: string): Promise<BacktestStrategy> {
    try {
      // Check cache first
      const cacheKey = `strategy:${strategyId}`;
      const cachedStrategy = await this.redis.get(cacheKey);
      if (cachedStrategy) {
        this.logger.debug(`Cache hit for strategy: ${strategyId}`);
        return JSON.parse(cachedStrategy);
      }

      // Query from TypeORM repository
      let strategy = await this.backtestingStrategyRepository.findOne({
        where: { id: strategyId, isActive: true }
      });

      // If not found, fall back to system strategies
      if (!strategy) {
        strategy = await this.getSystemStrategy(strategyId);
      }

      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      // Transform to BacktestStrategy interface
      const backtestStrategy: BacktestStrategy = {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        category: strategy.category,
        parameters: strategy.parameters,
        rules: strategy.rules,
        isActive: strategy.isActive,
        isPublic: strategy.isPublic,
        userId: strategy.userId,
        version: strategy.version,
        metadata: strategy.metadata,
        createdAt: strategy.createdAt,
        updatedAt: strategy.updatedAt,
      };

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(backtestStrategy));

      return backtestStrategy;
    } catch (error) {
      this.logger.error('Failed to load strategy:', error);
      throw error;
    }
  }

  /**
   * Get system strategy (built-in strategies)
   */
  private async getSystemStrategy(strategyId: string): Promise<BacktestingStrategy | null> {
    const systemStrategies: Record<string, BacktestStrategy> = {
      'trend_momentum': {
        id: 'trend_momentum',
        name: 'Trend Momentum Strategy',
        description: 'Buy when momentum exceeds threshold, sell when momentum drops',
        category: 'TREND_MOMENTUM' as any,
        parameters: [
          { name: 'minViralityScore', type: 'number', defaultValue: 75, min: 0, max: 100 },
          { name: 'sentimentThreshold', type: 'number', defaultValue: 0.5, min: -1, max: 1 },
          { name: 'holdPeriod', type: 'number', defaultValue: 24, min: 1, max: 168 },
          { name: 'stopLoss', type: 'number', defaultValue: 0.1, min: 0, max: 0.5 },
          { name: 'takeProfit', type: 'number', defaultValue: 0.2, min: 0, max: 1 }
        ],
        rules: [
          {
            type: 'BUY',
            condition: 'AND',
            criteria: [
              { field: 'momentum_score', operator: '>', value: '{{minViralityScore}}' },
              { field: 'sentiment_index', operator: '>', value: '{{sentimentThreshold}}' },
              { field: 'volume_24h', operator: '>', value: 10000 }
            ]
          },
          {
            type: 'SELL',
            condition: 'OR',
            criteria: [
              { field: 'momentum_score', operator: '<', value: '{{minViralityScore}} * 0.8' },
              { field: 'price_change_percent', operator: '<', value: '-{{stopLoss}}' },
              { field: 'price_change_percent', operator: '>', value: '{{takeProfit}}' },
              { field: 'hold_duration', operator: '>', value: '{{holdPeriod}}' }
            ]
          }
        ],
        isActive: true,
        isPublic: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'sentiment_reversal': {
        id: 'sentiment_reversal',
        name: 'Sentiment Reversal Strategy',
        description: 'Trade based on sentiment reversals',
        category: 'SENTIMENT_REVERSAL' as any,
        parameters: [
          { name: 'sentimentOversold', type: 'number', defaultValue: -0.7, min: -1, max: 0 },
          { name: 'sentimentOverbought', type: 'number', defaultValue: 0.7, min: 0, max: 1 },
          { name: 'confirmationPeriod', type: 'number', defaultValue: 6, min: 1, max: 24 }
        ],
        rules: [
          {
            type: 'BUY',
            condition: 'AND',
            criteria: [
              { field: 'sentiment_index', operator: '<', value: '{{sentimentOversold}}' },
              { field: 'sentiment_trend', operator: '>', value: 0 }
            ]
          },
          {
            type: 'SELL',
            condition: 'OR',
            criteria: [
              { field: 'sentiment_index', operator: '>', value: '{{sentimentOverbought}}' },
              { field: 'sentiment_trend', operator: '<', value: 0 }
            ]
          }
        ],
        isActive: true,
        isPublic: true,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    };

    return systemStrategies[strategyId] || null;
  }

  /**
   * Execute backtest logic
   */
  private async executeBacktest(
    config: BacktestConfig,
    strategy: BacktestStrategy,
    historicalData: any[]
  ): Promise<BacktestResult> {
    const trades: any[] = [];
    const equity: Array<{ timestamp: Date; equity: number; returns: number }> = [];

    let currentPosition = null;
    let currentEquity = config.initialCapital;
    let entryPrice = 0;
    let entryTime = null;

    // Track performance metrics
    let totalReturn = 0;
    let maxDrawdown = 0;
    let peakEquity = config.initialCapital;
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    // Process each data point
    for (let i = 0; i < historicalData.length; i++) {
      const dataPoint = historicalData[i];

      // Calculate indicators if needed
      const indicators = this.calculateIndicators(historicalData.slice(0, i + 1));

      // Evaluate strategy rules
      const signals = this.evaluateStrategyRules(strategy.rules, dataPoint, indicators, config.parameters);

      // Process signals
      for (const signal of signals) {
        if (signal.type === 'BUY' && !currentPosition) {
          // Enter position
          currentPosition = 'LONG';
          entryPrice = dataPoint.close_price;
          entryTime = dataPoint.timestamp;
          totalTrades++;
        } else if (signal.type === 'SELL' && currentPosition === 'LONG') {
          // Exit position
          const exitPrice = dataPoint.close_price;
          const returns = (exitPrice - entryPrice) / entryPrice;
          const profit = returns * config.initialCapital;

          trades.push({
            entryTime,
            exitTime: dataPoint.timestamp,
            entryPrice,
            exitPrice,
            quantity: 1,
            profit,
            returns,
            holdPeriod: Math.floor((dataPoint.timestamp.getTime() - entryTime.getTime()) / (1000 * 60 * 60)) // hours
          });

          currentEquity += profit;
          totalReturn = (currentEquity / config.initialCapital) - 1;

          // Track max drawdown
          if (currentEquity > peakEquity) {
            peakEquity = currentEquity;
          }
          const drawdown = (peakEquity - currentEquity) / peakEquity;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }

          // Trade classification
          if (profit > 0) {
            winningTrades++;
          } else {
            losingTrades++;
          }

          currentPosition = null;
          entryPrice = 0;
          entryTime = null;
        }
      }

      // Record equity
      equity.push({
        timestamp: dataPoint.timestamp,
        equity: currentEquity,
        returns: (currentEquity / config.initialCapital) - 1
      });
    }

    // Calculate performance metrics
    const sharpeRatio = this.calculateSharpeRatio(equity);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const result: BacktestResult = {
      id: this.generateBacktestId(),
      strategyId: config.strategyId,
      userId: undefined,
      symbol: config.symbol,
      startTime: config.startTime,
      endTime: config.endTime,
      initialCapital: config.initialCapital,
      finalCapital: currentEquity,
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      winRate,
      totalTrades,
      winningTrades,
      losingTrades,
      avgWin: this.calculateAverageWin(trades),
      avgLoss: this.calculateAverageLoss(trades),
      profitFactor: this.calculateProfitFactor(trades),
      trades,
      equity,
      parameters: config.parameters,
      status: BacktestStatus.COMPLETED,
      executionTime: 0,
      metadata: {
        executedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return result;
  }

  /**
   * Calculate technical indicators
   */
  private calculateIndicators(data: any[]): any {
    const latest = data[data.length - 1];

    // Simple moving averages
    const sma20 = this.calculateSMA(data, 20, 'close_price');
    const sma50 = this.calculateSMA(data, 50, 'close_price');

    // Relative strength index
    const rsi = this.calculateRSI(data, 14, 'close_price');

    // Bollinger Bands
    const bollinger = this.calculateBollingerBands(data, 20, 'close_price');

    // Volume indicators
    const volumeSMA = this.calculateSMA(data, 20, 'volume');
    const volumeRatio = latest.volume / volumeSMA;

    // Momentum indicators
    const momentum = this.calculateMomentum(data, 10, 'close_price');
    const roc = this.calculateRateOfChange(data, 5, 'close_price');

    return {
      sma20,
      sma50,
      rsi,
      bollinger: {
        upper: bollinger.upper,
        middle: bollinger.middle,
        lower: bollinger.lower
      },
      volumeRatio,
      momentum,
      roc,
      priceChangePercent: this.calculatePriceChangePercent(data, 1, 'close_price'),
      volatility: this.calculateVolatility(data, 20, 'close_price')
    };
  }

  /**
   * Evaluate strategy rules
   */
  private evaluateStrategyRules(
    rules: StrategyRule[],
    dataPoint: any,
    indicators: any,
    parameters: Record<string, any>
  ): any[] {
    const signals = [];

    for (const rule of rules) {
      const criteria = this.interpolateCriteria(rule.criteria, parameters);
      let conditionMet = false;

      if (rule.condition === 'AND') {
        conditionMet = criteria.every(criterion => this.evaluateCriterion(criterion, dataPoint, indicators));
      } else if (rule.condition === 'OR') {
        conditionMet = criteria.some(criterion => this.evaluateCriterion(criterion, dataPoint, indicators));
      }

      if (conditionMet) {
        signals.push({
          type: rule.type,
          timestamp: dataPoint.timestamp,
          price: dataPoint.close_price,
          reasons: criteria.filter(c => this.evaluateCriterion(c, dataPoint, indicators))
        });
      }
    }

    return signals;
  }

  /**
   * Evaluate single criterion
   */
  private evaluateCriterion(criterion: any, dataPoint: any, indicators: any): boolean {
    let field: string;
    let operator: string;
    let value: any;

    if (typeof criterion === 'string') {
      // Parse string criterion
      const match = criterion.match(/(\w+)\s*(<|>|<=|>=|==|!=)\s*(.+)/);
      if (!match) return false;
      field = match[1];
      operator = match[2];
      value = this.parseValue(match[3], dataPoint, indicators);
    } else {
      field = criterion.field;
      operator = criterion.operator;
      value = criterion.value;
    }

    const actualValue = this.getFieldValue(field, dataPoint, indicators);

    switch (operator) {
      case '>': return actualValue > value;
      case '<': return actualValue < value;
      case '>=': return actualValue >= value;
      case '<=': return actualValue <= value;
      case '==': return actualValue === value;
      case '!=': return actualValue !== value;
      default: return false;
    }
  }

  /**
   * Get field value from data point or indicators
   */
  private getFieldValue(field: string, dataPoint: any, indicators: any): any {
    // Check data point first
    if (dataPoint[field] !== undefined) {
      return dataPoint[field];
    }

    // Check indicators
    if (indicators[field] !== undefined) {
      return indicators[field];
    }

    // Check nested fields
    if (field.includes('.')) {
      const parts = field.split('.');
      let value = indicators;
      for (const part of parts) {
        value = value?.[part];
      }
      return value;
    }

    return 0;
  }

  /**
   * Parse value with template interpolation
   */
  private parseValue(value: string, dataPoint: any, indicators: any): any {
    if (typeof value === 'string' && value.includes('{{')) {
      // Simple template interpolation
      return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const paramValue = dataPoint[key] || indicators[key];
        return paramValue !== undefined ? paramValue.toString() : match;
      });
    }

    // Try to parse as number
    const parsed = parseFloat(value);
    return isNaN(parsed) ? value : parsed;
  }

  /**
   * Interpolate criteria with parameters
   */
  private interpolateCriteria(criteria: any[], parameters: Record<string, any>): any[] {
    return criteria.map(criterion => {
      if (typeof criterion === 'string' && criterion.includes('{{')) {
        const match = criterion.match(/(\w+)\s*(<|>|<=|>=|==|!=)\s*\{\{(\w+)\}\}/);
        if (match) {
          const [, field, operator, paramKey] = match;
          const paramValue = parameters[paramKey];
          return {
            field,
            operator,
            value: paramValue
          };
        }
      }
      return criterion;
    });
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(data: any[], period: number, field: string): number {
    if (data.length < period) return 0;
    const recent = data.slice(-period);
    const sum = recent.reduce((acc, item) => acc + (item[field] || 0), 0);
    return sum / period;
  }

  /**
   * Calculate RSI
   */
  private calculateRSI(data: any[], period: number, field: string): number {
    if (data.length < period + 1) return 50;

    const prices = data.map(item => item[field] || 0);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = prices[prices.length - i] - prices[prices.length - i - 1];
      if (diff > 0) {
        gains += diff;
      } else {
        losses += Math.abs(diff);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBollingerBands(data: any[], period: number, field: string): any {
    if (data.length < period) return { upper: 0, middle: 0, lower: 0 };

    const recent = data.slice(-period);
    const prices = recent.map(item => item[field] || 0);
    const middle = prices.reduce((sum, price) => sum + price, 0) / period;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: middle + (2 * stdDev),
      middle,
      lower: middle - (2 * stdDev)
    };
  }

  /**
   * Calculate momentum
   */
  private calculateMomentum(data: any[], period: number, field: string): number {
    if (data.length < period + 1) return 0;
    const current = data[data.length - 1][field] || 0;
    const previous = data[data.length - 1 - period][field] || 0;
    return current - previous;
  }

  /**
   * Calculate Rate of Change
   */
  private calculateRateOfChange(data: any[], period: number, field: string): number {
    if (data.length < period + 1) return 0;
    const current = data[data.length - 1][field] || 0;
    const previous = data[data.length - 1 - period][field] || 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Calculate price change percentage
   */
  private calculatePriceChangePercent(data: any[], period: number, field: string): number {
    if (data.length < period + 1) return 0;
    const current = data[data.length - 1][field] || 0;
    const previous = data[data.length - 1 - period][field] || 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Calculate volatility
   */
  private calculateVolatility(data: any[], period: number, field: string): number {
    if (data.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < data.length; i++) {
      const current = data[i][field] || 0;
      const previous = data[i - 1][field] || 0;
      if (previous > 0) {
        returns.push((current - previous) / previous);
      }
    }

    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100;
  }

  /**
   * Calculate Sharpe Ratio
   */
  private calculateSharpeRatio(equity: any[]): number {
    if (equity.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      returns.push(equity[i].returns - equity[i - 1].returns);
    }

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(252); // Annualized
  }

  /**
   * Generate unique backtest ID
   */
  private generateBacktestId(): string {
    return `bt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save backtest result
   */
  private async saveBacktestResult(result: BacktestResult, userId?: string): Promise<void> {
    try {
      const backtestResult = this.backtestingResultRepository.create({
        id: result.id,
        strategyId: result.strategyId,
        userId: userId || result.userId,
        symbol: result.symbol,
        startTime: result.startTime,
        endTime: result.endTime,
        initialCapital: result.initialCapital,
        finalCapital: result.finalCapital,
        totalReturn: result.totalReturn,
        sharpeRatio: result.sharpeRatio,
        maxDrawdown: result.maxDrawdown,
        winRate: result.winRate,
        totalTrades: result.totalTrades,
        winningTrades: result.winningTrades,
        losingTrades: result.losingTrades,
        avgWin: result.avgWin,
        avgLoss: result.avgLoss,
        profitFactor: result.profitFactor,
        trades: result.trades,
        equity: result.equity,
        parameters: result.parameters,
        status: result.status,
        executionTime: result.executionTime,
        metadata: result.metadata,
      });

      await this.backtestingResultRepository.save(backtestResult);

      // Emit WebSocket event
      if (userId || result.userId) {
        this.webSocketGateway.broadcastBacktestCompleted(userId || result.userId!, result);
      }

      this.logger.log(`Backtest result saved: ${result.id}`);
    } catch (error) {
      this.logger.error('Failed to save backtest result:', error);
      throw error;
    }
  }

  /**
   * Calculate average win
   */
  private calculateAverageWin(trades: any[]): number {
    const winningTrades = trades.filter(trade => trade.profit > 0);
    if (winningTrades.length === 0) return 0;
    return winningTrades.reduce((sum, trade) => sum + trade.profit, 0) / winningTrades.length;
  }

  /**
   * Calculate average loss
   */
  private calculateAverageLoss(trades: any[]): number {
    const losingTrades = trades.filter(trade => trade.profit < 0);
    if (losingTrades.length === 0) return 0;
    const totalLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.profit, 0));
    return totalLoss / losingTrades.length;
  }

  /**
   * Calculate profit factor
   */
  private calculateProfitFactor(trades: any[]): number {
    const grossProfit = trades
      .filter(trade => trade.profit > 0)
      .reduce((sum, trade) => sum + trade.profit, 0);
    const grossLoss = Math.abs(trades
      .filter(trade => trade.profit < 0)
      .reduce((sum, trade) => sum + trade.profit, 0));

    return grossLoss === 0 ? Infinity : grossProfit / grossLoss;
  }

  /**
   * Queue backtest for async processing
   */
  async queueBacktest(config: BacktestConfig, userId?: string): Promise<{ jobId: string; backtestId: string }> {
    try {
      const backtestId = this.generateBacktestId();

      const job = await this.backtestingQueue.add('run', {
        config,
        backtestId,
        userId,
        timestamp: new Date(),
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      this.logger.log(`Backtest queued: ${backtestId}, job: ${job.id}`);

      return {
        jobId: job.id.toString(),
        backtestId,
      };
    } catch (error) {
      this.logger.error('Failed to queue backtest:', error);
      throw error;
    }
  }

  /**
   * Get backtest history
   */
  async getBacktestHistory(
    strategyId?: string,
    symbol?: string,
    userId?: string,
    dateRange?: { start: Date; end: Date },
    page = 1,
    limit = 20
  ): Promise<{ results: BacktestResult[]; total: number; page: number; limit: number }> {
    try {
      const queryBuilder = this.backtestingResultRepository.createQueryBuilder('result')
        .leftJoinAndSelect('result.strategy', 'strategy')
        .orderBy('result.createdAt', 'DESC');

      if (strategyId) {
        queryBuilder.andWhere('result.strategyId = :strategyId', { strategyId });
      }

      if (symbol) {
        queryBuilder.andWhere('result.symbol = :symbol', { symbol });
      }

      if (userId) {
        queryBuilder.andWhere('result.userId = :userId', { userId });
      }

      if (dateRange) {
        queryBuilder.andWhere('result.createdAt BETWEEN :start AND :end', {
          start: dateRange.start,
          end: dateRange.end,
        });
      }

      const total = await queryBuilder.getCount();

      const results = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      // Transform to BacktestResult interface
      const backtestResults: BacktestResult[] = results.map(result => ({
        id: result.id,
        strategyId: result.strategyId,
        userId: result.userId,
        symbol: result.symbol,
        startTime: result.startTime,
        endTime: result.endTime,
        initialCapital: result.initialCapital,
        finalCapital: result.finalCapital,
        totalReturn: result.totalReturn,
        sharpeRatio: result.sharpeRatio,
        maxDrawdown: result.maxDrawdown,
        winRate: result.winRate,
        totalTrades: result.totalTrades,
        winningTrades: result.winningTrades,
        losingTrades: result.losingTrades,
        avgWin: result.avgWin,
        avgLoss: result.avgLoss,
        profitFactor: result.profitFactor,
        trades: result.trades,
        equity: result.equity,
        parameters: result.parameters,
        status: result.status as BacktestStatus,
        errorMessage: result.errorMessage,
        executionTime: result.executionTime,
        metadata: result.metadata,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      }));

      return {
        results: backtestResults,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Failed to get backtest history:', error);
      throw error;
    }
  }

  /**
   * Compare multiple strategies
   */
  async compareStrategies(
    strategies: string[],
    symbol: string,
    period: { start: Date; end: Date },
    userId?: string
  ): Promise<{ jobId: string }> {
    try {
      const job = await this.backtestingQueue.add('compare', {
        strategyIds: strategies,
        symbol,
        startTime: period.start,
        endTime: period.end,
        initialCapital: 10000,
        userId,
        timestamp: new Date(),
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 5,
        removeOnFail: 3,
      });

      this.logger.log(`Strategy comparison queued: ${job.id}`);
      return { jobId: job.id.toString() };
    } catch (error) {
      this.logger.error('Failed to compare strategies:', error);
      throw error;
    }
  }

  /**
   * Optimize strategy parameters
   */
  async optimizeStrategy(
    strategyId: string,
    symbol: string,
    period: { start: Date; end: Date },
    parameterRanges: Record<string, { min: number; max: number; step: number }>,
    optimizationMetric: 'totalReturn' | 'sharpeRatio' | 'profitFactor' | 'winRate' = 'sharpeRatio',
    maxIterations = 50,
    userId?: string
  ): Promise<{ jobId: string }> {
    try {
      const job = await this.backtestingQueue.add('optimize', {
        strategyId,
        symbol,
        startTime: period.start,
        endTime: period.end,
        initialCapital: 10000,
        parameterRanges,
        optimizationMetric,
        maxIterations,
        userId,
        timestamp: new Date(),
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 3,
        removeOnFail: 2,
      });

      this.logger.log(`Strategy optimization queued: ${job.id}`);
      return { jobId: job.id.toString() };
    } catch (error) {
      this.logger.error('Failed to optimize strategy:', error);
      throw error;
    }
  }

  /**
   * Generate parameter combinations for optimization
   */
  private generateParameterCombinations(parameters: any[]): any[] {
    // This would generate all combinations of parameter values within ranges
    // For now, return a simple array
    return [
      { minViralityScore: 70, sentimentThreshold: 0.4, holdPeriod: 24, stopLoss: 0.15, takeProfit: 0.25 },
      { minViralityScore: 75, sentimentThreshold: 0.5, holdPeriod: 24, stopLoss: 0.1, takeProfit: 0.2 },
      { minViralityScore: 80, sentimentThreshold: 0.6, holdPeriod: 12, stopLoss: 0.12, takeProfit: 0.18 }
    ];
  }
}