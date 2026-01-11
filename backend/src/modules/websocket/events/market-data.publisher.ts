import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebSocketService } from '../services/websocket.service';
import { MarketDataService } from "../../market-aggregation/services/market-data.service";
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Injectable()
export class MarketDataPublisher {
  private readonly logger = new Logger(MarketDataPublisher.name);
  private readonly PUBLISH_INTERVAL = 5000; // 5 seconds
  private readonly BATCH_SIZE = 100;

  constructor(
    private readonly websocketService: WebSocketService,
    private readonly marketDataService: MarketDataService,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis) {}

  // Real-time market data publishing
  @Cron('*/5 * * * * *') // Every 5 seconds
  async publishRealTimeMarketData(): Promise<void> {
    try {
      // Get active trends with significant activity
      const activeTrends = await this.getActiveTrendsForBroadcast();

      if (activeTrends.length === 0) {
        return;
      }

      // Process trends in batches
      const batches = this.createBatches(activeTrends, this.BATCH_SIZE);

      for (const batch of batches) {
        await Promise.all(
          batch.map(trend => this.publishTrendMarketData(trend.id))
        );
      }

      this.logger.debug(`Published market data for ${activeTrends.length} trends`);

    } catch (error) {
      this.logger.error('Error publishing real-time market data:', error);
    }
  }

  // Hourly market summary
  @Cron(CronExpression.EVERY_HOUR)
  async publishMarketSummary(): Promise<void> {
    try {
      const summary = await this.generateMarketSummary();

      await this.websocketService.broadcastToAll('market:summary', {
        ...summary,
        timestamp: new Date().toISOString()
      });

      this.logger.debug('Published hourly market summary');

    } catch (error) {
      this.logger.error('Error publishing market summary:', error);
    }
  }

  // Daily market analytics
  @Cron('0 0 * * *') // At midnight every day
  async publishDailyAnalytics(): Promise<void> {
    try {
      const analytics = await this.generateDailyAnalytics();

      await this.websocketService.broadcastToAll('market:daily-analytics', {
        ...analytics,
        timestamp: new Date().toISOString()
      });

      // Reset daily counters
      await this.resetDailyCounters();

      this.logger.debug('Published daily market analytics');

    } catch (error) {
      this.logger.error('Error publishing daily analytics:', error);
    }
  }

  // Publish individual trend market data
  private async publishTrendMarketData(trendId: string): Promise<void> {
    try {
      const marketData = await this.marketDataService.getLatestMarketData(trendId);

      // Get trend data using Prisma
      const trend = await this.prisma.topic.findUnique({
        where: { id: trendId }
      });

      if (!marketData || !trend) {
        return;
      }

      const update = {
        trendId,
        price: 0, // Would come from market data service
        volume24h: Number(trend.totalVolume),
        priceChange24h: 0, // Would come from price history
        bidPrice: marketData.bidPrice,
        askPrice: marketData.askPrice,
        bidSize: marketData.bidSize,
        askSize: marketData.askSize,
        timestamp: new Date().toISOString()
      };

      await this.websocketService.broadcastMarketData(update);

      // Check for significant price changes
      await this.checkPriceAlerts(trend, update);

      // Update Redis cache for quick access
      await this.updateMarketDataCache(trendId, update);

    } catch (error) {
      this.logger.error(`Error publishing market data for trend ${trendId}:`, error);
    }
  }

  // Get active trends that need market data updates
  private async getActiveTrendsForBroadcast(): Promise<Array<{ id: string }>> {
    try {
      // Get trends from Redis cache or database
      const cacheKey = 'market-data:active-trends';
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Query database for active trends using Prisma
      const activeTrends = await this.prisma.topic.findMany({
        where: {
          status: 'ACTIVE',
          totalVolume: {
            gt: 0
          }
        },
        select: {
          id: true
        },
        take: 100,
        orderBy: {
          totalVolume: 'desc'
        }
      });

      // Cache for 30 seconds
      await this.redis.setex(cacheKey, 30, JSON.stringify(activeTrends));

      return activeTrends;

    } catch (error) {
      this.logger.error('Error getting active trends:', error);
      return [];
    }
  }

  // Check for price alerts
  private async checkPriceAlerts(trend: any, marketData: any): Promise<void> {
    try {
      // Get active price alerts for this trend
      const alerts = await this.getPriceAlertsForTrend(trend.id);

      for (const alert of alerts) {
        const shouldTrigger = this.evaluatePriceAlert(alert, trend.currentPrice, marketData.timestamp);

        if (shouldTrigger) {
          await this.triggerPriceAlert(alert, trend, marketData);
        }
      }

    } catch (error) {
      this.logger.error('Error checking price alerts:', error);
    }
  }

  // Evaluate if a price alert should trigger
  private evaluatePriceAlert(alert: any, currentPrice: number, timestamp: string): boolean {
    const { alertType, targetPrice, triggeredAt } = alert;

    // Don't trigger if already triggered recently (within last 5 minutes)
    if (triggeredAt) {
      const lastTriggered = new Date(triggeredAt);
      const now = new Date(timestamp);
      const timeDiff = (now.getTime() - lastTriggered.getTime()) / (1000 * 60); // minutes

      if (timeDiff < 5) {
        return false;
      }
    }

    switch (alertType) {
      case 'ABOVE':
        return currentPrice >= targetPrice;
      case 'BELOW':
        return currentPrice <= targetPrice;
      default:
        return false;
    }
  }

  // Trigger a price alert
  private async triggerPriceAlert(alert: any, trend: any, marketData: any): Promise<void> {
    try {
      const alertData = {
        userId: alert.userId,
        trendId: trend.id,
        alertType: alert.alertType,
        targetPrice: alert.targetPrice,
        currentPrice: trend.currentPrice,
        message: `${trend.name} is ${alert.alertType.toLowerCase()} ${alert.targetPrice} (currently ${trend.currentPrice})`
      };

      await this.websocketService.broadcastPriceAlert(alertData);

      // Update alert as triggered
      await this.updateAlertTriggered(alert.id, marketData.timestamp);

      this.logger.debug(`Price alert triggered for user ${alert.userId} on trend ${trend.id}`);

    } catch (error) {
      this.logger.error('Error triggering price alert:', error);
    }
  }

  // Generate market summary
  private async generateMarketSummary(): Promise<any> {
    try {
      const summary = await this.marketDataService.getMarketSummary();

      return {
        totalMarketCap: summary.totalMarketCap,
        totalVolume24h: summary.totalVolume24h,
        activeTrends: summary.activeTrends,
        topGainers: summary.topGainers,
        topLosers: summary.topLosers,
        topVolume: summary.topVolume
      };

    } catch (error) {
      this.logger.error('Error generating market summary:', error);
      return null;
    }
  }

  // Generate daily analytics
  private async generateDailyAnalytics(): Promise<any> {
    try {
      const analytics = await this.marketDataService.getDailyAnalytics();

      return {
        date: new Date().toISOString().split('T')[0],
        totalTrades: analytics.totalTrades,
        totalVolume: analytics.totalVolume,
        totalRevenue: analytics.totalRevenue,
        uniqueTraders: analytics.uniqueTraders,
        averageTradeSize: analytics.averageTradeSize,
        topTrends: analytics.topTrends,
        priceMovements: analytics.priceMovements
      };

    } catch (error) {
      this.logger.error('Error generating daily analytics:', error);
      return null;
    }
  }

  // Get price alerts for a trend
  private async getPriceAlertsForTrend(trendId: string): Promise<any[]> {
    try {
      const key = `price-alerts:trend:${trendId}`;
      const alerts = await this.redis.get(key);

      return alerts ? JSON.parse(alerts) : [];

    } catch (error) {
      this.logger.error('Error getting price alerts:', error);
      return [];
    }
  }

  // Update alert as triggered
  private async updateAlertTriggered(alertId: string, timestamp: string): Promise<void> {
    try {
      const key = `price-alert:${alertId}`;
      await this.redis.hset(key, 'triggeredAt', timestamp);
      await this.redis.expire(key, 300); // Expire in 5 minutes

    } catch (error) {
      this.logger.error('Error updating alert triggered status:', error);
    }
  }

  // Update market data cache
  private async updateMarketDataCache(trendId: string, marketData: any): Promise<void> {
    try {
      const key = `market-data:latest:${trendId}`;
      await this.redis.setex(key, 60, JSON.stringify(marketData)); // Cache for 1 minute

    } catch (error) {
      this.logger.error('Error updating market data cache:', error);
    }
  }

  // Reset daily counters
  private async resetDailyCounters(): Promise<void> {
    try {
      const keys = await this.redis.keys('stats:daily:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

    } catch (error) {
      this.logger.error('Error resetting daily counters:', error);
    }
  }

  // Create batches for processing
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  // Emergency broadcasting for significant market events
  async broadcastMarketEmergency(alert: {
    type: 'CRASH' | 'SURGE' | 'SUSPENSION' | 'RESUMPTION';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    affectedTrends?: string[];
  }): Promise<void> {
    try {
      const message = {
        ...alert,
        timestamp: new Date().toISOString()
      };

      // Broadcast to all users with high priority
      await this.websocketService.broadcastToAll('market:emergency', message);

      // If specific trends are affected, broadcast to their subscribers
      if (alert.affectedTrends) {
        for (const trendId of alert.affectedTrends) {
          await this.websocketService.broadcastToRoom(
            `trend:${trendId}`,
            'market:emergency',
            message
          );
        }
      }

      this.logger.warn(`Market emergency broadcast: ${alert.type} - ${alert.message}`);

    } catch (error) {
      this.logger.error('Error broadcasting market emergency:', error);
    }
  }

  // Publish order book updates
  async publishOrderBookUpdate(trendId: string): Promise<void> {
    try {
      const orderBook = await this.marketDataService.getOrderBook(trendId);

      const update = {
        trendId,
        bids: orderBook.bids,
        asks: orderBook.asks,
        timestamp: new Date().toISOString()
      };

      await this.websocketService.broadcastOrderBook(update);

    } catch (error) {
      this.logger.error(`Error publishing order book update for trend ${trendId}:`, error);
    }
  }
}
