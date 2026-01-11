import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

// Data interval enum
enum DataInterval {
  ONE_MINUTE = 'ONE_MINUTE',
  FIVE_MINUTES = 'FIVE_MINUTES',
  FIFTEEN_MINUTES = 'FIFTEEN_MINUTES',
  ONE_HOUR = 'ONE_HOUR',
  FOUR_HOURS = 'FOUR_HOURS',
  ONE_DAY = 'ONE_DAY'
}

// Interfaces for market data
interface MarketData {
  id?: string;
  symbol: string;
  trendId?: string;
  timestamp: Date;
  interval: DataInterval;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  viralityScore?: number;
  sentimentScore?: number;
  velocity?: number;
  engagementRate?: number;
  momentumScore?: number;
  volatility?: number;
  metadata?: any;
}

@Injectable()
export class MarketDataAggregationService {
  private readonly logger = new Logger(MarketDataAggregationService.name);

  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private configService: ConfigService) {}

  /**
   * Aggregate ViralIndexSnapshot data into OHLCV MarketData
   */
  async aggregateViralData(
    topicId: string,
    interval: DataInterval,
    startTime?: Date,
    endTime?: Date
  ): Promise<MarketData[]> {
    try {
      const endTimeValue = endTime || new Date();
      const startTimeValue = startTime || new Date(endTimeValue.getTime() - 24 * 60 * 60 * 1000); // 24h default

      // Get ViralIndexSnapshots for the time range
      const snapshots = await this.prisma.viralIndexSnapshot.findMany({
        where: {
          trendId: topicId,
          timestamp: {
            gte: startTimeValue,
            lte: endTimeValue
          }
        },
        orderBy: { timestamp: 'asc' }
      });

      if (snapshots.length === 0) {
        this.logger.debug(`No viral data found for topic ${topicId} in the specified range`);
        return [];
      }

      // Group snapshots into time buckets based on interval
      const timeBuckets = this.groupSnapshotsByInterval(snapshots, interval);

      // Convert each bucket to OHLCV data
      const marketData: MarketData[] = [];
      const trend = await this.prisma.topic.findUnique({ where: { id: topicId } });

      for (const [bucketTimestamp, bucketSnapshots] of Object.entries(timeBuckets)) {
        const ohlcv = this.calculateOHLCV(bucketSnapshots);
        const dataPoint: MarketData = {
          symbol: trend?.topicName || 'UNKNOWN',
          trendId: topicId,
          timestamp: new Date(parseInt(bucketTimestamp)),
          interval,
          openPrice: ohlcv.open,
          highPrice: ohlcv.high,
          lowPrice: ohlcv.low,
          closePrice: ohlcv.close,
          volume: ohlcv.volume,
          viralityScore: ohlcv.viralityScore,
          sentimentScore: ohlcv.sentimentScore,
          velocity: ohlcv.velocity,
          engagementRate: ohlcv.engagementRate,
          momentumScore: ohlcv.momentumScore,
          volatility: ohlcv.volatility,
          metadata: {
            source: 'viral_aggregation',
            snapshotCount: bucketSnapshots.length,
            aggregationTime: new Date()
          }
        };

        marketData.push(dataPoint);
      }

      // Save aggregated data
      if (marketData.length > 0) {
        await this.saveMarketData(marketData);
        this.logger.log(`Aggregated ${marketData.length} market data points for topic ${topicId}`);
      }

      return marketData;
    } catch (error) {
      this.logger.error('Failed to aggregate viral data:', error);
      throw error;
    }
  }

  /**
   * Save market data to database
   */
  private async saveMarketData(data: MarketData[]): Promise<void> {
    try {
      // Try to save to MarketData table if it exists
      for (const item of data) {
        try {
          await this.prisma.marketData.upsert({
            where: {
              id: `${item.symbol}_${item.interval}_${item.timestamp.getTime()}`
            },
            create: {
              symbol: item.symbol,
              trendId: item.trendId,
              timestamp: item.timestamp,
              interval: item.interval,
              openPrice: item.openPrice,
              highPrice: item.highPrice,
              lowPrice: item.lowPrice,
              closePrice: item.closePrice,
              volume: item.volume,
              viralityScore: item.viralityScore,
              sentimentScore: item.sentimentScore,
              velocity: item.velocity,
              engagementRate: item.engagementRate,
              momentumScore: item.momentumScore,
              volatility: item.volatility,
              metadata: item.metadata
            },
            update: {
              openPrice: item.openPrice,
              highPrice: item.highPrice,
              lowPrice: item.lowPrice,
              closePrice: item.closePrice,
              volume: item.volume,
              viralityScore: item.viralityScore,
              sentimentScore: item.sentimentScore,
              velocity: item.velocity,
              engagementRate: item.engagementRate,
              momentumScore: item.momentumScore,
              volatility: item.volatility
            }
          });
        } catch (e) {
          // MarketData table might not exist or have different schema
          this.logger.debug('MarketData table not available or upsert failed');
        }
      }
    } catch (error) {
      this.logger.error('Failed to save market data:', error);
    }
  }

  /**
   * Sync historical data from ViralIndexSnapshot to MarketData
   */
  async syncHistoricalData(
    topicId: string,
    startDate: Date,
    endDate: Date,
    interval: DataInterval = DataInterval.ONE_HOUR
  ): Promise<void> {
    try {
      this.logger.log(`Starting historical data sync for topic ${topicId} from ${startDate} to ${endDate}`);

      // Check if data already exists for this period
      try {
        const existingData = await this.prisma.marketData.findMany({
          where: {
            trendId: topicId,
            interval: interval as any,
            timestamp: {
              gte: startDate,
              lte: endDate
            }
          }
        });

        if (existingData.length > 0) {
          this.logger.debug(`Found ${existingData.length} existing data points, removing duplicates`);
          await this.prisma.marketData.deleteMany({
            where: {
              trendId: topicId,
              interval: interval as any,
              timestamp: {
                gte: startDate,
                lte: endDate
              }
            }
          });
        }
      } catch (e) {
        this.logger.debug('MarketData table not available for sync check');
      }

      // Aggregate in batches to avoid memory issues
      const batchSize = 7 * 24 * 60 * 60 * 1000; // 7 days per batch
      let currentStart = new Date(startDate);

      while (currentStart < endDate) {
        const currentEnd = new Date(Math.min(currentStart.getTime() + batchSize, endDate.getTime()));

        const batchData = await this.aggregateViralData(topicId, interval, currentStart, currentEnd);

        if (batchData.length > 0) {
          this.logger.debug(`Processed batch: ${batchData.length} data points from ${currentStart} to ${currentEnd}`);
        }

        currentStart = new Date(currentEnd);
      }

      this.logger.log(`Completed historical data sync for topic ${topicId}`);
    } catch (error) {
      this.logger.error('Failed to sync historical data:', error);
      throw error;
    }
  }

  /**
   * Get market data with caching
   */
  async getMarketData(
    symbol: string,
    startTime: Date,
    endTime: Date,
    interval: DataInterval = DataInterval.ONE_HOUR
  ): Promise<MarketData[]> {
    try {
      const cacheKey = `marketdata:${symbol}:${interval}:${startTime.getTime()}:${endTime.getTime()}`;
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      let marketData: MarketData[] = [];

      try {
        marketData = await this.prisma.marketData.findMany({
          where: {
            symbol,
            interval: interval as any,
            timestamp: {
              gte: startTime,
              lte: endTime
            }
          },
          orderBy: { timestamp: 'asc' }
        });
      } catch (e) {
        this.logger.debug('MarketData table not available');
      }

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(marketData));

      return marketData;
    } catch (error) {
      this.logger.error('Failed to get market data:', error);
      throw error;
    }
  }

  /**
   * Clean up old market data based on retention policy
   */
  async cleanupOldData(daysToKeep?: number): Promise<void> {
    try {
      const retentionDays = daysToKeep || this.configService.get<number>('ANALYTICS_HISTORICAL_DATA_RETENTION_DAYS', 90);
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // Keep daily data longer than other intervals
      const dailyDataRetentionDays = retentionDays * 4; // Keep daily data 4x longer

      // Delete minute and hourly data older than retention period
      let deletedCount = 0;
      try {
        const result = await this.prisma.marketData.deleteMany({
          where: {
            timestamp: { lt: cutoffDate },
            interval: { in: [DataInterval.ONE_MINUTE, DataInterval.FIVE_MINUTES, DataInterval.FIFTEEN_MINUTES, DataInterval.ONE_HOUR, DataInterval.FOUR_HOURS] as any[] }
          }
        });
        deletedCount = result.count;
      } catch (e) {
        this.logger.debug('MarketData table not available for cleanup');
      }

      // Delete daily data older than extended retention period
      const dailyCutoffDate = new Date(Date.now() - dailyDataRetentionDays * 24 * 60 * 60 * 1000);
      let dailyDeletedCount = 0;
      try {
        const result = await this.prisma.marketData.deleteMany({
          where: {
            timestamp: { lt: dailyCutoffDate },
            interval: DataInterval.ONE_DAY as any
          }
        });
        dailyDeletedCount = result.count;
      } catch (e) {
        this.logger.debug('Daily MarketData cleanup failed');
      }

      this.logger.log(`Cleaned up market data: ${deletedCount} minute/hourly records, ${dailyDeletedCount} daily records`);

      // Clear cache entries for deleted data
      await this.clearExpiredCache(cutoffDate);
    } catch (error) {
      this.logger.error('Failed to cleanup old data:', error);
      throw error;
    }
  }

  /**
   * Aggregate recent viral data for all active topics
   */
  async aggregateRecentViralData(): Promise<void> {
    try {
      // Get all active trends
      const activeTrends = await this.prisma.topic.findMany({
        where: {
          status: 'ACTIVE',
          viralIndexSnapshots: {
            some: {
              timestamp: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            }
          }
        },
        include: {
          viralIndexSnapshots: true
        }
      });

      const intervals = [DataInterval.ONE_MINUTE, DataInterval.FIVE_MINUTES, DataInterval.ONE_HOUR];

      for (const trend of activeTrends) {
        for (const interval of intervals) {
          try {
            await this.aggregateViralData(trend.id, interval);
          } catch (error) {
            this.logger.warn(`Failed to aggregate data for trend ${trend.id} at interval ${interval}:`, error);
          }
        }
      }

      this.logger.log(`Aggregated recent viral data for ${activeTrends.length} active trends`);
    } catch (error) {
      this.logger.error('Failed to aggregate recent viral data:', error);
      throw error;
    }
  }

  /**
   * Get aggregation statistics
   */
  async getAggregationStats(): Promise<{
    totalMarketDataPoints: number;
    dataByInterval: Record<string, number>;
    dataBySymbol: Record<string, number>;
    oldestDataPoint: Date | null;
    newestDataPoint: Date | null;
  }> {
    try {
      // Get total count
      let totalPoints = 0;
      let oldestPoint: any = null;
      let newestPoint: any = null;
      let intervalStats: any[] = [];
      let symbolStats: any[] = [];

      try {
        [totalPoints, oldestPoint, newestPoint, intervalStats, symbolStats] = await Promise.all([
          this.prisma.marketData.count(),
          this.prisma.marketData.findFirst({ orderBy: { timestamp: 'asc' } }),
          this.prisma.marketData.findFirst({ orderBy: { timestamp: 'desc' } }),
          this.prisma.marketData.groupBy({
            by: ['interval'],
            _count: { interval: true }
          }),
          this.prisma.marketData.groupBy({
            by: ['symbol'],
            _count: { symbol: true },
            orderBy: { _count: { symbol: 'desc' } },
            take: 10
          })
        ]);
      } catch (e) {
        this.logger.debug('MarketData table not available for stats');
      }

      const dataByInterval = intervalStats.reduce((acc, stat) => {
        acc[stat.interval] = stat._count.interval;
        return acc;
      }, {} as Record<string, number>);

      const dataBySymbol = symbolStats.reduce((acc, stat) => {
        acc[stat.symbol] = stat._count.symbol;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalMarketDataPoints: totalPoints,
        dataByInterval,
        dataBySymbol,
        oldestDataPoint: oldestPoint?.timestamp || null,
        newestDataPoint: newestPoint?.timestamp || null
      };
    } catch (error) {
      this.logger.error('Failed to get aggregation stats:', error);
      throw error;
    }
  }

  // Helper methods

  private groupSnapshotsByInterval(
    snapshots: any[],
    interval: DataInterval
  ): Record<string, any[]> {
    const buckets: Record<string, any[]> = {};

    for (const snapshot of snapshots) {
      const bucketTimestamp = this.getBucketTimestamp(snapshot.timestamp, interval);
      const bucketKey = bucketTimestamp.getTime().toString();

      if (!buckets[bucketKey]) {
        buckets[bucketKey] = [];
      }
      buckets[bucketKey].push(snapshot);
    }

    return buckets;
  }

  private getBucketTimestamp(timestamp: Date, interval: DataInterval): Date {
    const date = new Date(timestamp);

    switch (interval) {
      case DataInterval.ONE_MINUTE:
        date.setSeconds(0, 0);
        break;
      case DataInterval.FIVE_MINUTES:
        date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
        break;
      case DataInterval.FIFTEEN_MINUTES:
        date.setMinutes(Math.floor(date.getMinutes() / 15) * 15, 0, 0);
        break;
      case DataInterval.ONE_HOUR:
        date.setMinutes(0, 0, 0);
        break;
      case DataInterval.FOUR_HOURS:
        date.setHours(Math.floor(date.getHours() / 4) * 4, 0, 0, 0);
        break;
      case DataInterval.ONE_DAY:
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date;
  }

  private calculateOHLCV(snapshots: any[]): {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    viralityScore: number;
    sentimentScore: number;
    velocity: number;
    engagementRate: number;
    momentumScore: number;
    volatility: number;
  } {
    if (snapshots.length === 0) {
      return {
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        volume: 0,
        viralityScore: 0,
        sentimentScore: 0,
        velocity: 0,
        engagementRate: 0,
        momentumScore: 0,
        volatility: 0
      };
    }

    // Sort snapshots by timestamp
    const sortedSnapshots = [...snapshots].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const first = sortedSnapshots[0];
    const last = sortedSnapshots[sortedSnapshots.length - 1];

    const viralityScores = sortedSnapshots.map(s => s.viralIndex || 0);
    const sentimentScores = sortedSnapshots.map(s => s.sentimentMean || 0);
    const velocities = sortedSnapshots.map(s => s.viralVelocity || 0);
    const engagementRates = sortedSnapshots.map(s => s.engagementRate || 0);
    const momentumScores = sortedSnapshots.map(s => s.momentumScore || 0);

    return {
      open: first.viralIndex || 0,
      high: Math.max(...viralityScores),
      low: Math.min(...viralityScores),
      close: last.viralIndex || 0,
      volume: sortedSnapshots.reduce((sum, s) => sum + (s.engagementTotal || 0), 0),
      viralityScore: last.viralIndex || 0,
      sentimentScore: sentimentScores.reduce((sum, s) => sum + s, 0) / sentimentScores.length,
      velocity: velocities.reduce((sum, s) => sum + s, 0) / velocities.length,
      engagementRate: engagementRates.reduce((sum, s) => sum + s, 0) / engagementRates.length,
      momentumScore: momentumScores.reduce((sum, s) => sum + s, 0) / momentumScores.length,
      volatility: this.calculateVolatility(viralityScores)
    };
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private async clearExpiredCache(cutoffDate: Date): Promise<void> {
    try {
      // Get all cache keys for market data
      const keys = await this.redis.keys('marketdata:*');

      for (const key of keys) {
        // Extract timestamp from key and check if it's expired
        const keyParts = key.split(':');
        if (keyParts.length >= 4) {
          const keyEndTime = parseInt(keyParts[keyParts.length - 1]);
          if (keyEndTime < cutoffDate.getTime()) {
            await this.redis.del(key);
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to clear expired cache:', error);
    }
  }
}
