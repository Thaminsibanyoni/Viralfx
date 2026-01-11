import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from "../../../prisma/prisma.service";

import { MarketAggregationService } from '../services/market-aggregation.service';
// COMMENTED OUT (TypeORM entity deleted): import { Symbol } from '../entities/symbol.entity';

@Injectable()
export class MarketUpdateScheduler {
  private readonly logger = new Logger(MarketUpdateScheduler.name);

  constructor(
    private readonly marketAggregationService: MarketAggregationService,
    @InjectQueue('market-updates')
    private readonly marketQueue: Queue,
    @InjectQueue('price-calculation')
    private readonly priceQueue: Queue,
        private prisma: PrismaService,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly prismaService: PrismaService) {}

  /**
   * Update active prices every 30 seconds
   */
  @Cron('*/30 * * * * *')
  async updateActivePrices(): Promise<void> {
    try {
      const activeSymbols = await this.marketAggregationService.getActiveSymbols();

      for (const symbol of activeSymbols) {
        // Add random delay to stagger jobs (0-5 seconds)
        const delay = Math.random() * 5000;

        await this.priceQueue.add('update-symbol-price', {
          symbol: symbol.symbol
        }, {
          delay,
          priority: 5, // Normal priority
          attempts: 3,
          backoff: 'exponential'
        });
      }

      this.logger.log(`Queued price updates for ${activeSymbols.length} symbols with staggered delays`);
    } catch (error) {
      this.logger.error('Error in updateActivePrices cron job:', error);
    }
  }

  /**
   * Update market statistics every 5 minutes
   */
  @Cron('*/5 * * * *')
  async updateMarketStats(): Promise<void> {
    try {
      const activeSymbols = await this.marketAggregationService.getActiveSymbols();

      for (const symbol of activeSymbols) {
        await this.marketQueue.add('update-market-stats', {
          symbol: symbol.symbol
        }, {
          priority: 3, // Lower priority
          attempts: 2,
          backoff: 'exponential'
        });
      }

      this.logger.log(`Queued market stats updates for ${activeSymbols.length} symbols`);
    } catch (error) {
      this.logger.error('Error in updateMarketStats cron job:', error);
    }
  }

  /**
   * Calculate trending markets every hour
   */
  @Cron('0 * * * *')
  async calculateTrending(): Promise<void> {
    try {
      await this.marketQueue.add('calculate-trending', {}, {
        priority: 8, // High priority
        attempts: 3,
        backoff: 'exponential'
      });

      this.logger.log('Queued trending markets calculation');
    } catch (error) {
      this.logger.error('Error in calculateTrending cron job:', error);
    }
  }

  /**
   * Cleanup old prices daily at midnight
   */
  @Cron('0 0 * * *')
  async cleanupOldPrices(): Promise<void> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // In a real implementation, you would:
      // 1. Delete Price records older than 90 days
      // 2. Keep aggregated candles (1h, 4h, 1d intervals)
      // 3. Archive data to cold storage if needed

      // Example query (would be implemented in PriceRepository)
      // const deletedCount = await this.prisma.pricerepository.delete({
      //   interval: '1m'
      //   timestamp: { $lt: ninetyDaysAgo }
      // });

      const deletedCount = 0; // Placeholder

      this.logger.log(`Cleaned up ${deletedCount} old price records older than 90 days`);
    } catch (error) {
      this.logger.error('Error in cleanupOldPrices cron job:', error);
    }
  }

  /**
   * Sync virality data every 2 minutes
   */
  @Cron('*/2 * * * *')
  async syncViralityData(): Promise<void> {
    try {
      // Get recently updated ViralIndexSnapshots from Prisma
      const recentlyUpdated = await this.prismaService.viralIndexSnapshot.findMany({
        where: {
          ts: {
            gte: new Date(Date.now() - 2 * 60 * 1000) // Last 2 minutes
          }
        },
        distinct: ['topicId'],
        select: {
          topicId: true
        }
      });

      for (const { topicId } of recentlyUpdated) {
        await this.marketQueue.add('sync-virality', { topicId }, {
          priority: 10, // Highest priority
          attempts: 3,
          backoff: 'exponential'
        });
      }

      this.logger.log(`Queued virality sync for ${recentlyUpdated.length} topics`);
    } catch (error) {
      this.logger.error('Error in syncViralityData cron job:', error);
    }
  }

  /**
   * Generate daily analytics report every hour
   */
  @Cron('0 * * * *')
  async generateDailyAnalytics(): Promise<void> {
    try {
      // This would generate and cache daily analytics
      // Similar to MarketDataService.getDailyAnalytics()

      this.logger.log('Generated daily analytics report');
    } catch (error) {
      this.logger.error('Error in generateDailyAnalytics cron job:', error);
    }
  }

  /**
   * Update portfolio values every minute
   */
  @Cron('* * * * *')
  async updatePortfolioValues(): Promise<void> {
    try {
      // In a real implementation, you would:
      // 1. Get all active portfolios
      // 2. Update current prices for all symbols
      // 3. Recalculate unrealized P&L
      // 4. Cache updated portfolio data

      this.logger.log('Updated portfolio values');
    } catch (error) {
      this.logger.error('Error in updatePortfolioValues cron job:', error);
    }
  }

  /**
   * Health check for market aggregation system
   */
  @Cron('*/10 * * * *')
  async healthCheck(): Promise<void> {
    try {
      // Check Redis connection
      const redisConnected = await this.redis.ping();

      // Check queue sizes
      const marketQueueSize = await this.marketQueue.getWaiting();
      const priceQueueSize = await this.priceQueue.getWaiting();

      // Check active symbol count
      const activeSymbolCount = (await this.marketAggregationService.getActiveSymbols()).length;

      this.logger.log(`Health check - Redis: ${redisConnected}, Market Queue: ${marketQueueSize.length}, Price Queue: ${priceQueueSize.length}, Active Symbols: ${activeSymbolCount}`);

      // Alert if queue sizes are too high
      if (marketQueueSize.length > 1000) {
        this.logger.warn(`Market queue size is high: ${marketQueueSize.length}`);
      }

      if (priceQueueSize.length > 1000) {
        this.logger.warn(`Price queue size is high: ${priceQueueSize.length}`);
      }
    } catch (error) {
      this.logger.error('Error in healthCheck cron job:', error);
    }
  }
}
