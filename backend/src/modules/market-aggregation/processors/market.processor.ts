import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

import { MarketAggregationService } from '../services/market-aggregation.service';
import { PricingEngineService } from '../services/pricing-engine.service';
import { MarketDataService } from '../services/market-data.service';
import { WebSocketGateway } from '../../websocket/websocket.gateway';
import { Symbol } from '../entities/symbol.entity';

@Processor('market-updates')
export class MarketProcessor {
  private readonly logger = new Logger(MarketProcessor.name);

  constructor(
    private readonly marketAggregationService: MarketAggregationService,
    private readonly pricingEngineService: PricingEngineService,
    private readonly marketDataService: MarketDataService,
    private readonly webSocketGateway: WebSocketGateway,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRedis()
    private readonly redis: Redis,
    @InjectQueue('market-updates')
    private readonly marketQueue: Queue,
    @InjectQueue('price-calculation')
    private readonly priceQueue: Queue,
  ) {}

  @Process('update-symbol-price')
  async handleUpdateSymbolPrice(job: Job<{ symbol: string }>): Promise<void> {
    try {
      const { symbol } = job.data;

      // Report progress
      await job.progress(10);

      // Get symbol with latest data
      const symbolData = await this.marketAggregationService.getSymbolWithLatestData(symbol);
      await job.progress(30);

      // Calculate new price using virality data
      const newPrice = await this.pricingEngineService.calculatePrice(symbol, symbolData.viralData?.viralIndex);
      await job.progress(50);

      // Get order book imbalance
      const orderBookImbalance = await this.pricingEngineService.getOrderBookImbalance(symbol);

      // Store price record
      await this.pricingEngineService.storePriceRecord(symbol, newPrice, {
        viralityScore: symbolData.viralData?.viralIndex,
        velocity: symbolData.viralData?.velocity,
        sentiment: symbolData.viralData?.sentiment,
        orderBookImbalance,
        volume: 0, // Will be updated by order processing
      });
      await job.progress(70);

      // Update Symbol entity with currentPrice
      await this.symbolRepository.update(
        { symbol },
        { currentPrice: newPrice }
      );
      await job.progress(80);

      // Invalidate Redis cache
      await this.redis.del(`symbol:${symbol}`);
      await this.redis.del(`current-price:${symbol}`);
      await job.progress(90);

      // Broadcast price update via WebSocket
      await this.webSocketGateway.broadcastToRoom('market:symbol', {
        event: 'price-update',
        data: {
          symbol,
          price: newPrice,
          viralityScore: symbolData.viralData?.viralIndex,
          timestamp: new Date().toISOString(),
        },
      });
      await job.progress(100);

      this.logger.log(`Updated price for ${symbol}: ${newPrice}`);
    } catch (error) {
      this.logger.error(`Failed to update price for ${job.data.symbol}:`, error);
      throw error;
    }
  }

  @Process('sync-virality')
  async handleSyncVirality(job: Job<{ topicId: string }>): Promise<void> {
    try {
      const { topicId } = job.data;

      await job.progress(10);

      // Sync virality data
      await this.marketAggregationService.syncViralityData(topicId);
      await job.progress(50);

      // Get symbol for topic
      const symbol = await this.symbolRepository.findOne({
        where: { topicId },
      });

      if (symbol) {
        // Queue price update job
        await this.priceQueue.add('update-symbol-price', {
          symbol: symbol.symbol,
        }, {
          priority: 10, // Higher priority for virality updates
        });
      }

      await job.progress(100);

      this.logger.log(`Synced virality data for topic ${topicId}`);
    } catch (error) {
      this.logger.error(`Failed to sync virality for topic ${job.data.topicId}:`, error);
      throw error;
    }
  }

  @Process('update-market-stats')
  async handleUpdateMarketStats(job: Job<{ symbol: string }>): Promise<void> {
    try {
      const { symbol } = job.data;

      await job.progress(10);

      // Update symbol statistics
      await this.marketAggregationService.updateSymbolStats(symbol);
      await job.progress(80);

      // Broadcast stats update via WebSocket
      const stats = await this.pricingEngineService.getMarketStats(symbol);
      await this.webSocketGateway.broadcastToRoom('market:symbol', {
        event: 'stats-update',
        data: {
          symbol,
          stats,
          timestamp: new Date().toISOString(),
        },
      });
      await job.progress(100);

      this.logger.log(`Updated stats for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to update stats for ${job.data.symbol}:`, error);
      throw error;
    }
  }

  @Process('calculate-trending')
  async handleCalculateTrending(job: Job): Promise<void> {
    try {
      await job.progress(10);

      // Get all active symbols
      const activeSymbols = await this.marketAggregationService.getActiveSymbols();
      await job.progress(30);

      // Calculate trend scores based on volume, price change, virality
      const trendingSymbols = activeSymbols
        .map(symbol => {
          const trendScore = this.calculateTrendScore(symbol);
          return {
            symbol: symbol.symbol,
            name: symbol.name,
            category: symbol.category,
            currentPrice: symbol.currentPrice,
            priceChangePercent24h: symbol.priceChangePercent24h,
            volume24h: symbol.volume24h,
            viralityScore: symbol.lastViralityScore,
            trendScore,
          };
        })
        .filter(s => s.trendScore > 0)
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, 20);

      await job.progress(60);

      // Update trending cache in Redis
      await this.redis.setex(
        'trending-markets',
        300, // 5 minutes TTL
        JSON.stringify(trendingSymbols)
      );

      await job.progress(80);

      // Broadcast trending list via WebSocket
      await this.webSocketGateway.broadcastToRoom('market:trending', {
        event: 'trending-update',
        data: {
          trending: trendingSymbols,
          timestamp: new Date().toISOString(),
        },
      });
      await job.progress(100);

      this.logger.log(`Calculated trending markets: ${trendingSymbols.length} symbols`);
    } catch (error) {
      this.logger.error('Failed to calculate trending markets:', error);
      throw error;
    }
  }

  private calculateTrendScore(symbol: any): number {
    let score = 0;

    // Volume component (40% weight)
    if (symbol.volume24h > 100000) score += 40;
    else if (symbol.volume24h > 50000) score += 30;
    else if (symbol.volume24h > 10000) score += 20;
    else if (symbol.volume24h > 1000) score += 10;

    // Price change component (30% weight)
    const priceChange = Math.abs(symbol.priceChangePercent24h || 0);
    if (priceChange > 20) score += 30;
    else if (priceChange > 10) score += 25;
    else if (priceChange > 5) score += 20;
    else if (priceChange > 2) score += 15;
    else if (priceChange > 1) score += 10;

    // Virality component (30% weight)
    const virality = symbol.lastViralityScore || 0;
    if (virality > 80) score += 30;
    else if (virality > 60) score += 25;
    else if (virality > 40) score += 20;
    else if (virality > 20) score += 15;
    else if (virality > 10) score += 10;

    return Math.round(score);
  }
}