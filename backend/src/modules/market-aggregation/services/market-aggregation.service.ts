import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../../prisma/prisma.service';
import { Symbol } from '../entities/symbol.entity';
import { Price } from '../entities/price.entity';
import { Portfolio } from '../entities/portfolio.entity';
import { PricingEngineService } from './pricing-engine.service';
import { SymbolNormalizerService } from './symbol-normalizer.service';
import { OrderBookService } from '../../order-matching/services/order-book.service';

@Injectable()
export class MarketAggregationService {
  private readonly logger = new Logger(MarketAggregationService.name);

  constructor(
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(Price)
    private readonly priceRepository: Repository<Price>,
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    private readonly prismaService: PrismaService,
    private readonly pricingEngineService: PricingEngineService,
    private readonly symbolNormalizerService: SymbolNormalizerService,
    private readonly orderBookService: OrderBookService,
    @InjectRedis()
    private readonly redis: Redis,
    @InjectQueue('market-updates')
    private readonly marketQueue: Queue,
    @InjectQueue('price-calculation')
    private readonly priceQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async createSymbolFromTopic(topicId: string): Promise<Symbol> {
    try {
      // Query Prisma Topic by ID
      const topic = await this.prismaService.topic.findUnique({
        where: { id: topicId },
        include: {
          country: true,
          category: true,
        },
      });

      if (!topic) {
        throw new Error(`Topic with ID ${topicId} not found`);
      }

      // Generate symbol using SymbolNormalizerService
      const symbol = await this.symbolNormalizerService.normalizeSymbol(topicId);

      // Check if symbol already exists
      const existingSymbol = await this.symbolRepository.findOne({
        where: { symbol },
      });

      if (existingSymbol) {
        this.logger.warn(`Symbol ${symbol} already exists for topic ${topicId}`);
        return existingSymbol;
      }

      // Create Symbol entity
      const newSymbol = this.symbolRepository.create({
        symbol,
        topicId,
        name: topic.name || topic.topicName,
        category: topic.category?.name || 'UNKNOWN',
        region: topic.country?.code || 'UNKNOWN',
        basePrice: 100.00,
        status: 'ACTIVE',
        isActive: true,
        metadata: {
          keywords: topic.keywords || [],
          hashtags: topic.hashtags || [],
          platforms: topic.platforms || [],
        },
        listedAt: new Date(),
      });

      const savedSymbol = await this.symbolRepository.save(newSymbol);

      // Cache the symbol data
      await this.cacheSymbolData(symbol, savedSymbol);

      this.logger.log(`Created symbol ${symbol} from topic ${topicId}`);
      return savedSymbol;
    } catch (error) {
      this.logger.error(`Error creating symbol from topic ${topicId}:`, error);
      throw error;
    }
  }

  async updateSymbolPrices(symbols?: string[]): Promise<void> {
    try {
      const activeSymbols = symbols || (await this.getActiveSymbols()).map(s => s.symbol);

      for (const symbol of activeSymbols) {
        await this.priceQueue.add('calculate-price', { symbol }, {
          delay: Math.random() * 5000, // Stagger jobs
          attempts: 3,
          backoff: 'exponential',
        });
      }

      this.logger.log(`Queued price updates for ${activeSymbols.length} symbols`);
    } catch (error) {
      this.logger.error('Error updating symbol prices:', error);
      throw error;
    }
  }

  async getSymbolWithLatestData(symbol: string): Promise<Symbol & { latestPrice?: Price, viralData?: any }> {
    try {
      // Check cache first
      const cachedData = await this.getCachedSymbolData(symbol);
      if (cachedData) {
        return cachedData;
      }

      // Query Symbol entity
      const symbolEntity = await this.symbolRepository.findOne({
        where: { symbol, isActive: true },
      });

      if (!symbolEntity) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      // Get latest Price record
      const latestPrice = await this.priceRepository.findOne({
        where: { symbol },
        order: { timestamp: 'DESC' },
      });

      // Query Prisma ViralIndexSnapshot for latest virality data
      let viralData = null;
      if (symbolEntity.topicId) {
        const viralSnapshot = await this.prismaService.viralIndexSnapshot.findFirst({
          where: { topicId: symbolEntity.topicId },
          orderBy: { ts: 'DESC' },
        });

        if (viralSnapshot) {
          viralData = {
            viralIndex: viralSnapshot.viralIndex,
            velocity: viralSnapshot.viralVelocity,
            sentiment: viralSnapshot.sentimentMean,
            timestamp: viralSnapshot.ts,
          };
        }
      }

      const result = {
        ...symbolEntity,
        latestPrice,
        viralData,
      };

      // Cache the combined data
      await this.cacheSymbolData(symbol, result);

      return result;
    } catch (error) {
      this.logger.error(`Error getting symbol with latest data ${symbol}:`, error);
      throw error;
    }
  }

  async syncViralityData(topicId: string): Promise<void> {
    try {
      // Query latest ViralIndexSnapshot from Prisma
      const viralSnapshot = await this.prismaService.viralIndexSnapshot.findFirst({
        where: { topicId },
        orderBy: { ts: 'DESC' },
      });

      if (!viralSnapshot) {
        this.logger.warn(`No virality data found for topic ${topicId}`);
        return;
      }

      // Find corresponding Symbol by topicId
      const symbol = await this.symbolRepository.findOne({
        where: { topicId },
      });

      if (!symbol) {
        this.logger.warn(`No symbol found for topic ${topicId}`);
        return;
      }

      // Update Symbol's virality metrics
      await this.symbolRepository.update(symbol.id, {
        lastViralityScore: viralSnapshot.viralIndex,
        lastVelocity: viralSnapshot.viralVelocity,
        lastSentiment: viralSnapshot.sentimentMean,
      });

      // Queue price recalculation
      await this.priceQueue.add('calculate-price', { symbol: symbol.symbol }, {
        priority: 10, // Higher priority for virality updates
      });

      this.logger.log(`Synced virality data for topic ${topicId}, symbol ${symbol.symbol}`);
    } catch (error) {
      this.logger.error(`Error syncing virality data for topic ${topicId}:`, error);
      throw error;
    }
  }

  async getActiveSymbols(): Promise<Symbol[]> {
    try {
      return await this.symbolRepository.find({
        where: {
          status: 'ACTIVE',
          isActive: true,
        },
        order: { volume24h: 'DESC' },
      });
    } catch (error) {
      this.logger.error('Error getting active symbols:', error);
      throw error;
    }
  }

  async getTrendingSymbols(limit: number, sortBy: string, timeframe: string): Promise<Symbol[]> {
    try {
      const queryBuilder = this.symbolRepository
        .createQueryBuilder('symbol')
        .where('symbol.status = :status', { status: 'ACTIVE' })
        .andWhere('symbol.isActive = :isActive', { isActive: true });

      // Apply timeframe filtering using Price data
      if (timeframe && timeframe !== '24h') {
        const timeWindow = this.getTimeWindowInHours(timeframe);
        const timeWindowStart = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

        queryBuilder.innerJoin('symbol.prices', 'price', 'price.timestamp >= :timeWindowStart', { timeWindowStart });

        // Calculate aggregates based on timeframe
        queryBuilder
          .addSelect('AVG(price.price)', 'avgPrice')
          .addSelect('MAX(price.price)', 'maxPrice')
          .addSelect('MIN(price.price)', 'minPrice')
          .addSelect('SUM(price.volume)', 'totalTimeframeVolume')
          .groupBy('symbol.id');
      }

      // Apply sorting based on sortBy parameter and timeframe
      switch (sortBy) {
        case 'volume':
          if (timeframe && timeframe !== '24h') {
            queryBuilder.orderBy('totalTimeframeVolume', 'DESC');
          } else {
            queryBuilder.orderBy('symbol.volume24h', 'DESC');
          }
          break;
        case 'priceChange':
          queryBuilder.orderBy('symbol.priceChangePercent24h', 'DESC');
          break;
        case 'viralityScore':
          queryBuilder.orderBy('symbol.lastViralityScore', 'DESC');
          break;
        case 'trades':
          queryBuilder.orderBy('symbol.totalTrades', 'DESC');
          break;
        default:
          if (timeframe && timeframe !== '24h') {
            queryBuilder.orderBy('totalTimeframeVolume', 'DESC');
          } else {
            queryBuilder.orderBy('symbol.volume24h', 'DESC');
          }
      }

      return await queryBuilder.limit(limit).getMany();
    } catch (error) {
      this.logger.error(`Error getting trending symbols:`, error);
      throw error;
    }
  }

  private getTimeWindowInHours(timeframe: string): number {
    const timeframes = {
      '1h': 1,
      '4h': 4,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30
    };
    return timeframes[timeframe] || 24;
  }

  async updateSymbolStats(symbol: string): Promise<void> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get prices from last 24 hours
      const prices = await this.priceRepository.find({
        where: {
          symbol,
          timestamp: MoreThanOrEqual(yesterday),
        },
        order: { timestamp: 'ASC' },
      });

      if (prices.length === 0) {
        return;
      }

      const firstPrice = prices[0].price;
      const currentPrice = prices[prices.length - 1].price;
      const high24h = Math.max(...prices.map(p => p.price));
      const low24h = Math.min(...prices.map(p => p.price));
      const volume24h = prices.reduce((sum, p) => sum + p.volume, 0);

      // Update Symbol entity
      await this.symbolRepository.update(
        { symbol },
        {
          currentPrice,
          priceChange24h: currentPrice - firstPrice,
          priceChangePercent24h: ((currentPrice - firstPrice) / firstPrice) * 100,
          high24h,
          low24h,
          volume24h,
        },
      );

      // Cache updated stats
      const cacheKey = `symbol-stats:${symbol}`;
      await this.redis.setex(cacheKey, 60, JSON.stringify({
        currentPrice,
        priceChange24h: currentPrice - firstPrice,
        priceChangePercent24h: ((currentPrice - firstPrice) / firstPrice) * 100,
        high24h,
        low24h,
        volume24h,
        timestamp: now.toISOString(),
      }));

      this.logger.log(`Updated stats for symbol ${symbol}`);
    } catch (error) {
      this.logger.error(`Error updating stats for symbol ${symbol}:`, error);
      throw error;
    }
  }

  async getSymbolsByCategory(category: string): Promise<Symbol[]> {
    try {
      return await this.symbolRepository.find({
        where: {
          category,
          status: 'ACTIVE',
          isActive: true,
        },
        order: { volume24h: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`Error getting symbols by category ${category}:`, error);
      throw error;
    }
  }

  async getSymbolsByRegion(region: string): Promise<Symbol[]> {
    try {
      return await this.symbolRepository.find({
        where: {
          region,
          status: 'ACTIVE',
          isActive: true,
        },
        order: { volume24h: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`Error getting symbols by region ${region}:`, error);
      throw error;
    }
  }

  private async cacheSymbolData(symbol: string, data: any): Promise<void> {
    try {
      const cacheKey = `symbol:${symbol}`;
      // Convert Date objects to ISO strings for caching
      const serializableData = JSON.parse(JSON.stringify(data, (key, value) =>
        value instanceof Date ? value.toISOString() : value
      ));
      await this.redis.setex(cacheKey, 60, JSON.stringify(serializableData));
    } catch (error) {
      this.logger.warn(`Failed to cache symbol data for ${symbol}:`, error.message);
    }
  }

  private async getCachedSymbolData(symbol: string): Promise<any> {
    try {
      const cacheKey = `symbol:${symbol}`;
      const cached = await this.redis.get(cacheKey);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      // Rehydrate Date objects from ISO strings
      return this.rehydrateDates(parsed);
    } catch (error) {
      this.logger.warn(`Failed to get cached symbol data for ${symbol}:`, error.message);
      return null;
    }
  }

  private rehydrateDates(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      // Check if this looks like an ISO date string
      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      if (dateRegex.test(obj)) {
        return new Date(obj);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.rehydrateDates(item));
    }

    if (typeof obj === 'object') {
      const rehydrated: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Rehydrate common date fields
        if (key.includes('Date') || key.includes('At') || key === 'timestamp' || key === 'ts') {
          rehydrated[key] = typeof value === 'string' ? new Date(value) : this.rehydrateDates(value);
        } else {
          rehydrated[key] = this.rehydrateDates(value);
        }
      }
      return rehydrated;
    }

    return obj;
  }
}