import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan, Between } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

import { Symbol } from '../entities/symbol.entity';
import { Price, PriceInterval } from '../entities/price.entity';
import { OrderBookService } from '../../order-matching/services/order-book.service';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(Price)
    private readonly priceRepository: Repository<Price>,
    private readonly orderBookService: OrderBookService,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async getLatestMarketData(trendId: string): Promise<any> {
    try {
      // Check cache first
      const cacheKey = `market-data:${trendId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Find Symbol by topicId (trendId)
      const symbol = await this.symbolRepository.findOne({
        where: { topicId: trendId, isActive: true },
      });

      if (!symbol) {
        throw new Error(`No active symbol found for trend ${trendId}`);
      }

      // Get latest Price record
      const latestPrice = await this.priceRepository.findOne({
        where: { symbol: symbol.symbol },
        order: { timestamp: 'DESC' },
      });

      // Get order book
      const orderBook = await this.getOrderBook(trendId);

      const marketData = {
        symbol: symbol.symbol,
        name: symbol.name,
        category: symbol.category,
        region: symbol.region,
        currentPrice: latestPrice?.price || symbol.currentPrice,
        priceChange24h: symbol.priceChange24h,
        priceChangePercent24h: symbol.priceChangePercent24h,
        volume24h: symbol.volume24h,
        high24h: symbol.high24h,
        low24h: symbol.low24h,
        viralityScore: symbol.lastViralityScore,
        velocity: symbol.lastVelocity,
        sentiment: symbol.lastSentiment,
        totalTrades: symbol.totalTrades,
        marketCap: symbol.market_cap,
        lastUpdated: latestPrice?.timestamp || symbol.updatedAt,
        orderBook,
      };

      // Cache the result
      await this.redis.setex(cacheKey, 5, JSON.stringify(marketData));

      return marketData;
    } catch (error) {
      this.logger.error(`Error getting market data for trend ${trendId}:`, error);
      throw error;
    }
  }

  async getMarketData(trendId: string): Promise<any> {
    // Alias for getLatestMarketData (used by WebSocket gateway)
    return this.getLatestMarketData(trendId);
  }

  async getMarketDataForTrends(trendIds: string[]): Promise<any[]> {
    try {
      const results = await Promise.all(
        trendIds.map(trendId => this.getMarketData(trendId).catch(error => {
          this.logger.warn(`Failed to get market data for trend ${trendId}:`, error.message);
          return null;
        }))
      );

      return results.filter(result => result !== null);
    } catch (error) {
      this.logger.error('Error getting batch market data:', error);
      throw error;
    }
  }

  async getOrderBook(trendId: string): Promise<any> {
    try {
      // Check cache first
      const cacheKey = `orderbook:${trendId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Find Symbol by topicId
      const symbol = await this.symbolRepository.findOne({
        where: { topicId: trendId, isActive: true },
      });

      if (!symbol) {
        return null;
      }

      // Call OrderBookService.getOrderBook(symbol)
      const orderBookData = await this.orderBookService.getOrderBook(symbol.symbol);

      // Cache the result
      await this.redis.setex(cacheKey, 5, JSON.stringify(orderBookData));

      return orderBookData;
    } catch (error) {
      this.logger.error(`Error getting order book for trend ${trendId}:`, error);
      return null;
    }
  }

  async getMarketSummary(): Promise<any> {
    try {
      // Check cache first
      const cacheKey = 'market-summary';
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate aggregate market statistics
      const activeSymbols = await this.symbolRepository.find({
        where: { status: 'ACTIVE', isActive: true },
      });

      const totalMarketCap = activeSymbols.reduce((sum, symbol) => sum + symbol.market_cap, 0);
      const totalVolume24h = activeSymbols.reduce((sum, symbol) => sum + symbol.volume24h, 0);
      const activeTrends = activeSymbols.length;

      // Get top gainers, losers, and volume
      const topGainers = activeSymbols
        .filter(s => s.priceChangePercent24h && s.priceChangePercent24h > 0)
        .sort((a, b) => (b.priceChangePercent24h || 0) - (a.priceChangePercent24h || 0))
        .slice(0, 10);

      const topLosers = activeSymbols
        .filter(s => s.priceChangePercent24h && s.priceChangePercent24h < 0)
        .sort((a, b) => (a.priceChangePercent24h || 0) - (b.priceChangePercent24h || 0))
        .slice(0, 10);

      const topVolume = activeSymbols
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, 10);

      const summary = {
        totalMarketCap,
        totalVolume24h,
        activeTrends,
        topGainers: topGainers.map(s => ({
          symbol: s.symbol,
          name: s.name,
          priceChangePercent24h: s.priceChangePercent24h,
          currentPrice: s.currentPrice,
        })),
        topLosers: topLosers.map(s => ({
          symbol: s.symbol,
          name: s.name,
          priceChangePercent24h: s.priceChangePercent24h,
          currentPrice: s.currentPrice,
        })),
        topVolume: topVolume.map(s => ({
          symbol: s.symbol,
          name: s.name,
          volume24h: s.volume24h,
          currentPrice: s.currentPrice,
        })),
        timestamp: new Date().toISOString(),
      };

      // Cache the summary
      await this.redis.setex(cacheKey, 60, JSON.stringify(summary));

      return summary;
    } catch (error) {
      this.logger.error('Error getting market summary:', error);
      throw error;
    }
  }

  async getDailyAnalytics(): Promise<any> {
    try {
      // Check cache first
      const cacheKey = 'daily-analytics';
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Query daily statistics
      const dailyPrices = await this.priceRepository.find({
        where: {
          timestamp: Between(today, tomorrow),
        },
      });

      const totalTrades = dailyPrices.length;
      const totalVolume = dailyPrices.reduce((sum, price) => sum + price.volume, 0);
      const averageTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

      // Get unique active symbols today
      const uniqueSymbols = new Set(dailyPrices.map(p => p.symbol)).size;

      // Get top trends by volume
      const symbolVolumes = new Map<string, number>();
      dailyPrices.forEach(price => {
        const current = symbolVolumes.get(price.symbol) || 0;
        symbolVolumes.set(price.symbol, current + price.volume);
      });

      const topTrends = Array.from(symbolVolumes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([symbol, volume]) => ({
          symbol,
          volume,
        }));

      // Calculate price movements
      const priceMovements = await this.calculatePriceMovements();

      const analytics = {
        totalTrades,
        totalVolume,
        totalRevenue: 0, // Stubbed value - would calculate from trading fees
        uniqueTraders: uniqueSymbols, // Approximate - would need user data
        averageTradeSize,
        uniqueActiveSymbols: uniqueSymbols,
        topTrends,
        priceMovements,
        timestamp: new Date().toISOString(),
      };

      // Cache the analytics
      await this.redis.setex(cacheKey, 3600, JSON.stringify(analytics));

      return analytics;
    } catch (error) {
      this.logger.error('Error getting daily analytics:', error);
      throw error;
    }
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      // Get latest price from cache or database
      const cacheKey = `current-price:${symbol}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return parseFloat(cached);
      }

      // Query database
      const latestPrice = await this.priceRepository.findOne({
        where: { symbol },
        order: { timestamp: 'DESC' },
      });

      const price = latestPrice?.price;

      if (price) {
        // Cache for 1 second
        await this.redis.setex(cacheKey, 1, price.toString());
      }

      return price || 0;
    } catch (error) {
      this.logger.error(`Error getting current price for ${symbol}:`, error);
      return 0;
    }
  }

  async getPriceHistory(symbol: string, interval: PriceInterval | string, limit: number): Promise<Price[]> {
    try {
      const cacheKey = `price-history:${symbol}:${interval}:${limit}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Rehydrate timestamp fields back to Date objects
        return parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }

      // Calculate start date based on interval and limit
      const now = new Date();
      let startDate = new Date();

      switch (interval) {
        case '1m':
          startDate.setMinutes(startDate.getMinutes() - limit);
          break;
        case '5m':
          startDate.setMinutes(startDate.getMinutes() - (limit * 5));
          break;
        case '15m':
          startDate.setMinutes(startDate.getMinutes() - (limit * 15));
          break;
        case '1h':
          startDate.setHours(startDate.getHours() - limit);
          break;
        case '4h':
          startDate.setHours(startDate.getHours() - (limit * 4));
          break;
        case '1d':
          startDate.setDate(startDate.getDate() - limit);
          break;
        default:
          startDate.setHours(startDate.getHours() - limit);
      }

      // Convert string interval to PriceInterval if needed
      let intervalEnum: PriceInterval = PriceInterval.ONE_MINUTE;
      if (typeof interval === 'string' && Object.values(PriceInterval).includes(interval as PriceInterval)) {
        intervalEnum = interval as PriceInterval;
      } else if (typeof interval === 'string') {
        // Map common string formats
        const intervalMap: Record<string, PriceInterval> = {
          '1m': PriceInterval.ONE_MINUTE,
          '5m': PriceInterval.FIVE_MINUTES,
          '15m': PriceInterval.FIFTEEN_MINUTES,
          '1h': PriceInterval.ONE_HOUR,
          '4h': PriceInterval.FOUR_HOURS,
          '1d': PriceInterval.ONE_DAY,
        };
        intervalEnum = intervalMap[interval] || PriceInterval.ONE_MINUTE;
      } else {
        intervalEnum = interval as PriceInterval;
      }

      const priceHistory = await this.priceRepository.find({
        where: {
          symbol,
          interval: intervalEnum,
          timestamp: MoreThanOrEqual(startDate),
        },
        order: { timestamp: 'DESC' },
        take: limit,
      });

      // Cache for 30 seconds - serialize dates as ISO strings
      await this.redis.setex(cacheKey, 30, JSON.stringify(priceHistory, (key, value) =>
        value instanceof Date ? value.toISOString() : value
      ));

      return priceHistory;
    } catch (error) {
      this.logger.error(`Error getting price history for ${symbol}:`, error);
      return [];
    }
  }

  private async calculatePriceMovements(): Promise<any> {
    try {
      const activeSymbols = await this.symbolRepository.find({
        where: { status: 'ACTIVE', isActive: true },
      });

      const movements = {
        up: 0,
        down: 0,
        unchanged: 0,
        averageChange: 0,
        biggestGainer: null,
        biggestLoser: null,
      };

      let totalChange = 0;
      let changeCount = 0;

      for (const symbol of activeSymbols) {
        if (symbol.priceChangePercent24h) {
          if (symbol.priceChangePercent24h > 0) {
            movements.up++;
          } else if (symbol.priceChangePercent24h < 0) {
            movements.down++;
          } else {
            movements.unchanged++;
          }

          totalChange += Math.abs(symbol.priceChangePercent24h);
          changeCount++;

          if (!movements.biggestGainer || symbol.priceChangePercent24h > movements.biggestGainer.change) {
            movements.biggestGainer = {
              symbol: symbol.symbol,
              change: symbol.priceChangePercent24h,
            };
          }

          if (!movements.biggestLoser || symbol.priceChangePercent24h < movements.biggestLoser.change) {
            movements.biggestLoser = {
              symbol: symbol.symbol,
              change: symbol.priceChangePercent24h,
            };
          }
        }
      }

      movements.averageChange = changeCount > 0 ? totalChange / changeCount : 0;

      return movements;
    } catch (error) {
      this.logger.error('Error calculating price movements:', error);
      return {
        up: 0,
        down: 0,
        unchanged: 0,
        averageChange: 0,
        biggestGainer: null,
        biggestLoser: null,
      };
    }
  }
}