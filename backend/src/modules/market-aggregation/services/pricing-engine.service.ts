import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

import { Symbol } from '../entities/symbol.entity';
import { Price, PriceInterval } from '../entities/price.entity';
import { Order } from '../entities/order.entity';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PricingEngineService {
  private readonly logger = new Logger(PricingEngineService.name);

  constructor(
    private config: ConfigService,
    @InjectRepository(Symbol)
    private symbolRepository: Repository<Symbol>,
    @InjectRepository(Price)
    private priceRepository: Repository<Price>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectQueue('price-calculation')
    private priceQueue: Queue,
    @InjectRedis()
    private redis: Redis,
    private prismaService: PrismaService,
  ) {}

  /**
   * Calculate price based on virality score and market factors
   */
  async calculatePrice(symbol: string, viralityScore?: number): Promise<number> {
    const symbolData = await this.symbolRepository.findOne({ where: { symbol } });
    if (!symbolData) {
      throw new Error(`Symbol ${symbol} not found`);
    }

    // Get virality data from Prisma if not provided
    const viralityData = await this.getViralityData(symbol);
    const actualViralityScore = viralityScore || viralityData.viralIndex || 50;

    const basePrice = symbolData.basePrice || 100.0;
    const velocity = viralityData.velocity || await this.calculateVelocity(symbol);
    const sentiment = viralityData.sentiment || await this.getAverageSentiment(symbol);
    const orderBookImbalance = await this.getOrderBookImbalance(symbol);

    // Price calculation formula
    // Price = BasePrice + (ViralityDelta × VelocityMultiplier × SentimentWeight × OrderBookFactor)
    const viralityDelta = actualViralityScore - (symbolData.lastViralityScore || 50);
    const velocityMultiplier = this.config.get('VELOCITY_MULTIPLIER', 2.0);
    const sentimentWeight = 1 + (sentiment * 0.5); // Sentiment influences price more when positive
    const orderBookFactor = 1 + (orderBookImbalance * 0.1);

    const priceChange = viralityDelta * velocityMultiplier * sentimentWeight * orderBookFactor;
    const newPrice = Math.max(0.01, basePrice + priceChange); // Ensure price doesn't go negative

    // Update last virality score for next calculation
    await this.symbolRepository.update(symbol, {
      lastViralityScore: actualViralityScore,
      lastVelocity: velocity,
      lastSentiment: sentiment,
    });

    return Math.round(newPrice * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Simulate price movement over time window
   */
  async simulatePriceMovement(
    symbol: string,
    timeWindow: '1h' | '4h' | '24h' | '7d' | '30d'
  ): Promise<PriceHistoryPoint[]> {
    const windowMs = this.getWindowMilliseconds(timeWindow);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMs);

    // Get historical prices in the time window
    const historicalPrices = await this.priceRepository.find({
      where: {
        symbol,
        timestamp: MoreThan(startTime),
      },
      order: { timestamp: 'ASC' },
      take: 1000, // Limit for performance
    });

    // Get orders in the time window for volume analysis
    const historicalOrders = await this.orderRepository.find({
      where: {
        symbol,
        createdAt: MoreThan(startTime),
        status: 'FILLED',
      },
      select: ['createdAt', 'quantity', 'price'],
    });

    // Generate simulated price points
    const simulatedPrices: PriceHistoryPoint[] = [];
    let currentPrice = historicalPrices[historicalPrices.length - 1]?.price || 100.0;

    // Process data in hourly intervals for simulation
    const intervals = Math.ceil(windowMs / (60 * 60 * 1000)); // 1 hour intervals
    const volumeByHour = this.aggregateVolumeByHour(historicalOrders);

    for (let i = 0; i < intervals; i++) {
      const intervalTime = new Date(startTime.getTime() + (i * 60 * 60 * 1000));
      const hour = intervalTime.getHours();
      const volume = volumeByHour[hour] || 0;

      // Simulate price movement based on volume and random walk
      const volatility = this.calculateVolatility(symbol, volume);
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      const trendInfluence = this.calculateTrendInfluence(volume, intervals, i);

      currentPrice = Math.max(0.01, currentPrice * (1 + randomChange + trendInfluence));

      simulatedPrices.push({
        timestamp: intervalTime,
        price: Math.round(currentPrice * 100) / 100,
        volume,
        volatility,
      });
    }

    return simulatedPrices;
  }

  /**
   * Real-time price updates
   */
  async updatePrices(): Promise<void> {
    try {
      // Get all active symbols
      const activeSymbols = await this.symbolRepository.find({
        where: { status: 'ACTIVE' },
      });

      for (const symbolData of activeSymbols) {
        // Queue price calculation job for each symbol
        await this.priceQueue.add('update-symbol-price', {
          symbol: symbolData.symbol,
        }, {
          delay: Math.random() * 5000, // Stagger updates to prevent load spikes
        });
      }

      this.logger.log(`Queued price updates for ${activeSymbols.length} symbols`);
    } catch (error) {
      this.logger.error('Failed to update prices:', error);
      throw error;
    }
  }

  /**
   * Get current price with cache
   */
  async getCurrentPrice(symbol: string): Promise<number | null> {
    const cacheKey = `price:${symbol}`;

    // Try cache first
    const cachedPrice = await this.getPriceFromCache(cacheKey);
    if (cachedPrice) {
      return cachedPrice;
    }

    // Get from database
    const latestPrice = await this.priceRepository.findOne({
      where: { symbol },
      order: { timestamp: 'DESC' },
    });

    if (latestPrice) {
      // Cache for 1 second
      await this.cachePrice(cacheKey, latestPrice.price, 1);
      return latestPrice.price;
    }

    return null;
  }

  /**
   * Get price history with pagination
   */
  async getPriceHistory(
    symbol: string,
    from: Date,
    to: Date,
    interval: PriceInterval
  ): Promise<PriceHistoryPoint[]> {
    const intervalMs = this.getIntervalMilliseconds(interval);
    const prices = await this.priceRepository.find({
      where: {
        symbol,
        timestamp: MoreThan(from),
      },
      order: { timestamp: 'ASC' },
    });

    // Aggregate prices by interval
    const aggregated = this.aggregatePricesByInterval(prices, intervalMs);

    return aggregated;
  }

  /**
   * Get market statistics
   */
  async getMarketStats(symbol: string): Promise<MarketStats> {
    const [latestPrice, volume24h, price24h] = await Promise.all([
      this.getCurrentPrice(symbol),
      this.getVolume24h(symbol),
      this.getPrice24hAgo(symbol),
    ]);

    const change24h = latestPrice && price24h ?
      ((latestPrice - price24h) / price24h) * 100 : 0;

    const high24h = await this.getHigh24h(symbol);
    const low24h = await this.getLow24h(symbol);

    return {
      symbol,
      currentPrice: latestPrice || 0,
      change24h: Math.round(change24h * 100) / 100,
      volume24h,
      high24h,
      low24h,
      lastUpdated: new Date(),
    };
  }

  /**
   * Private helper methods
   */

  private async calculateVelocity(symbol: string): Promise<number> {
    const recentPrices = await this.priceRepository.find({
      where: { symbol },
      order: { timestamp: 'DESC' },
      take: 10,
    });

    if (recentPrices.length < 2) return 0;

    const priceChanges = [];
    for (let i = 1; i < recentPrices.length; i++) {
      const change = (recentPrices[i - 1].price - recentPrices[i].price) / recentPrices[i].price;
      priceChanges.push(change);
    }

    return priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
  }

  private async getAverageSentiment(symbol: string): Promise<number> {
    try {
      const symbolData = await this.symbolRepository.findOne({ where: { symbol } });
      if (!symbolData?.topicId) {
        return 0;
      }

      const cacheKey = `sentiment:${symbol}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return parseFloat(cached);
      }

      const viralSnapshot = await this.prismaService.viralIndexSnapshot.findFirst({
        where: { topicId: symbolData.topicId },
        orderBy: { ts: 'DESC' },
      });

      const sentiment = viralSnapshot?.sentimentMean || 0;

      // Cache for 30 seconds
      await this.redis.setex(cacheKey, 30, sentiment.toString());

      return sentiment;
    } catch (error) {
      this.logger.warn(`Failed to get sentiment for ${symbol}:`, error.message);
      return 0;
    }
  }

  private async getViralityData(symbol: string): Promise<{ viralIndex: number, velocity: number, sentiment: number }> {
    try {
      const symbolData = await this.symbolRepository.findOne({ where: { symbol } });
      if (!symbolData?.topicId) {
        return { viralIndex: 0, velocity: 0, sentiment: 0 };
      }

      const cacheKey = `virality:${symbol}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const viralSnapshot = await this.prismaService.viralIndexSnapshot.findFirst({
        where: { topicId: symbolData.topicId },
        orderBy: { ts: 'DESC' },
      });

      const result = {
        viralIndex: viralSnapshot?.viralIndex || 0,
        velocity: viralSnapshot?.viralVelocity || 0,
        sentiment: viralSnapshot?.sentimentMean || 0,
      };

      // Cache for 30 seconds
      await this.redis.setex(cacheKey, 30, JSON.stringify(result));

      return result;
    } catch (error) {
      this.logger.warn(`Failed to get virality data for ${symbol}:`, error.message);
      return { viralIndex: 0, velocity: 0, sentiment: 0 };
    }
  }

  private async getOrderBookImbalance(symbol: string): Promise<number> {
    const recentOrders = await this.orderRepository.find({
      where: { symbol, status: 'PENDING' },
      take: 100,
      select: ['side', 'quantity'],
    });

    const buyVolume = recentOrders
      .filter(order => order.side === 'BUY')
      .reduce((sum, order) => sum + order.quantity, 0);

    const sellVolume = recentOrders
      .filter(order => order.side === 'SELL')
      .reduce((sum, order) => sum + order.quantity, 0);

    if (buyVolume + sellVolume === 0) return 0;

    return (buyVolume - sellVolume) / (buyVolume + sellVolume);
  }

  private getWindowMilliseconds(window: string): number {
    const windows = {
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return windows[window] || windows['1h'];
  }

  private getWindowSeconds(interval: string): number {
    const intervals = {
      '1m': 60,
      '5m': 5 * 60,
      '15m': 15 * 60,
      '1h': 60 * 60,
      '4h': 4 * 60 * 60,
      '1d': 24 * 60 * 60,
    };
    return intervals[interval] || intervals['1m'];
  }

  private getIntervalMilliseconds(interval: string): number {
    return this.getWindowSeconds(interval) * 1000;
  }

  private aggregateVolumeByHour(orders: Order[]): Record<number, number> {
    return orders.reduce((acc, order) => {
      const hour = order.createdAt.getHours();
      acc[hour] = (acc[hour] || 0) + order.quantity;
      return acc;
    }, {});
  }

  private calculateVolatility(symbol: string, volume: number): number {
    // Base volatility adjusted by volume
    const baseVolatility = this.config.get('BASE_VOLATILITY', 0.02);
    const volumeMultiplier = Math.min(volume / 100000, 2); // Cap at 2x for high volume
    return baseVolatility * (1 + volumeMultiplier);
  }

  private calculateTrendInfluence(volume: number, totalIntervals: number, currentInterval: number): number {
    // Early intervals get more trend influence if volume is high
    const positionFactor = 1 - (currentInterval / totalIntervals);
    const volumeFactor = Math.min(volume / 50000, 1);
    return positionFactor * volumeFactor * 0.01; // Max 1% trend influence
  }

  private aggregatePricesByInterval(prices: Price[], intervalMs: number): PriceHistoryPoint[] {
    const aggregated: PriceHistoryPoint[] = [];
    let currentInterval: Price[] = [];
    let currentIntervalStart = prices[0]?.timestamp || new Date();

    for (const price of prices) {
      if (price.timestamp.getTime() - currentIntervalStart.getTime() >= intervalMs) {
        // Aggregate current interval
        if (currentInterval.length > 0) {
          aggregated.push(this.aggregateInterval(currentInterval));
        }
        // Start new interval
        currentInterval = [price];
        currentIntervalStart = price.timestamp;
      } else {
        currentInterval.push(price);
      }
    }

    // Don't forget the last interval
    if (currentInterval.length > 0) {
      aggregated.push(this.aggregateInterval(currentInterval));
    }

    return aggregated;
  }

  private aggregateInterval(prices: Price[]): PriceHistoryPoint {
    const openPrice = prices[0].price;
    const closePrice = prices[prices.length - 1].price;
    const highPrice = Math.max(...prices.map(p => p.price));
    const lowPrice = Math.min(...prices.map(p => p.price));
    const volume = prices.reduce((sum, p) => sum + p.volume, 0);
    const volatility = this.calculatePriceVolatility(prices);

    return {
      timestamp: prices[0].timestamp,
      open: openPrice,
      high: highPrice,
      low: lowPrice,
      close: closePrice,
      volume,
      volatility,
    };
  }

  private calculatePriceVolatility(prices: Price[]): number {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const return_ = (prices[i].price - prices[i - 1].price) / prices[i - 1].price;
      returns.push(return_);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  private async getPriceFromCache(key: string): Promise<number | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const data = JSON.parse(cached);
        return data.price;
      }
      return null;
    } catch (error) {
      this.logger.warn(`Failed to get price from cache ${key}:`, error.message);
      return null;
    }
  }

  private async cachePrice(key: string, price: number, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify({ price, timestamp: Date.now() }));
    } catch (error) {
      this.logger.warn(`Failed to cache price ${key}:`, error.message);
    }
  }

  async storePriceRecord(symbol: string, price: number, metrics: { interval?: PriceInterval | string; [key: string]: any }): Promise<Price> {
    try {
      // Convert string interval to PriceInterval enum
      let interval: PriceInterval = PriceInterval.ONE_MINUTE;
      if (metrics.interval && typeof metrics.interval === 'string') {
        // Map string to enum value
        const intervalMap: Record<string, PriceInterval> = {
          '1m': PriceInterval.ONE_MINUTE,
          '5m': PriceInterval.FIVE_MINUTES,
          '15m': PriceInterval.FIFTEEN_MINUTES,
          '1h': PriceInterval.ONE_HOUR,
          '4h': PriceInterval.FOUR_HOURS,
          '1d': PriceInterval.ONE_DAY,
        };
        interval = intervalMap[metrics.interval] || PriceInterval.ONE_MINUTE;
      } else if (metrics.interval && Object.values(PriceInterval).includes(metrics.interval as PriceInterval)) {
        interval = metrics.interval as PriceInterval;
      }

      const priceRecord = this.priceRepository.create({
        symbol,
        price,
        open: metrics.open || price,
        high: metrics.high || price,
        low: metrics.low || price,
        close: metrics.close || price,
        volume: metrics.volume || 0,
        viralityScore: metrics.viralityScore,
        velocity: metrics.velocity,
        sentiment: metrics.sentiment,
        orderBookImbalance: metrics.orderBookImbalance,
        timestamp: new Date(),
        interval,
      });

      const saved = await this.priceRepository.save(priceRecord);
      return saved;
    } catch (error) {
      this.logger.error(`Failed to store price record for ${symbol}:`, error);
      throw error;
    }
  }

  private async getVolume24h(symbol: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.quantity) as total')
      .where('order.symbol = :symbol', { symbol })
      .andWhere('order.status = :status', { status: 'FILLED' })
      .andWhere('order.createdAt > :date', { date: twentyFourHoursAgo })
      .getRawOne();

    return result?.total || 0;
  }

  private async getPrice24hAgo(symbol: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const price = await this.priceRepository.findOne({
      where: {
        symbol,
        timestamp: LessThan(twentyFourHoursAgo),
      },
      order: { timestamp: 'DESC' },
    });

    return price?.price || 100;
  }

  private async getHigh24h(symbol: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.priceRepository
      .createQueryBuilder('price')
      .select('MAX(price.price) as high')
      .where('price.symbol = :symbol', { symbol })
      .andWhere('price.timestamp > :date', { date: twentyFourHoursAgo })
      .getRawOne();

    return result?.high || 0;
  }

  private async getLow24h(symbol: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.priceRepository
      .createQueryBuilder('price')
      .select('MIN(price.price) as low')
      .where('price.symbol = :symbol', { symbol })
      .andWhere('price.timestamp > :date', { date: twentyFourHoursAgo })
      .getRawOne();

    return result?.low || 0;
  }
}

// Type definitions
interface PriceHistoryPoint {
  timestamp: Date;
  price: number;
  volume?: number;
  volatility?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

interface MarketStats {
  symbol: string;
  currentPrice: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: Date;
}