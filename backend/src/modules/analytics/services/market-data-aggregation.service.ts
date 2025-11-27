import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, In } from 'typeorm';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { MarketData } from '../../../database/entities/market-data.entity';
import { Trend } from '../../../database/entities/trend.entity';
import { DataInterval } from '../../../database/entities/market-data.entity';

@Injectable()
export class MarketDataAggregationService {
  private readonly logger = new Logger(MarketDataAggregationService.name);

  constructor(
    private prisma: PrismaService,
    @InjectRepository(MarketData)
    private readonly marketDataRepository: Repository<MarketData>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private configService: ConfigService,
  ) {}

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
            lte: endTimeValue,
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      if (snapshots.length === 0) {
        this.logger.debug(`No viral data found for topic ${topicId} in the specified range`);
        return [];
      }

      // Group snapshots into time buckets based on interval
      const timeBuckets = this.groupSnapshotsByInterval(snapshots, interval);

      // Convert each bucket to OHLCV data
      const marketData: MarketData[] = [];
      const trend = await this.prisma.trend.findUnique({ where: { id: topicId } });

      for (const [bucketTimestamp, bucketSnapshots] of Object.entries(timeBuckets)) {
        const ohlcv = this.calculateOHLCV(bucketSnapshots);
        const aggregatedData = this.marketDataRepository.create({
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
            aggregationTime: new Date(),
          },
        });

        marketData.push(aggregatedData);
      }

      // Save aggregated data
      if (marketData.length > 0) {
        await this.marketDataRepository.save(marketData);
        this.logger.log(`Aggregated ${marketData.length} market data points for topic ${topicId}`);
      }

      return marketData;
    } catch (error) {
      this.logger.error('Failed to aggregate viral data:', error);
      throw error;
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
      const existingData = await this.marketDataRepository.find({
        where: {
          trendId: topicId,
          interval,
          timestamp: Between(startDate, endDate),
        },
      });

      if (existingData.length > 0) {
        this.logger.debug(`Found ${existingData.length} existing data points, removing duplicates`);
        await this.marketDataRepository.delete({
          trendId: topicId,
          interval,
          timestamp: Between(startDate, endDate),
        });
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

      const marketData = await this.marketDataRepository.find({
        where: {
          symbol,
          interval,
          timestamp: Between(startTime, endTime),
        },
        order: { timestamp: 'ASC' },
      });

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
      const minuteHourlyResult = await this.marketDataRepository.delete({
        timestamp: LessThan(cutoffDate),
        interval: In([DataInterval.ONE_MINUTE, DataInterval.FIVE_MINUTES, DataInterval.FIFTEEN_MINUTES, DataInterval.ONE_HOUR, DataInterval.FOUR_HOURS]),
      });

      // Delete daily data older than extended retention period
      const dailyCutoffDate = new Date(Date.now() - dailyDataRetentionDays * 24 * 60 * 60 * 1000);
      const dailyResult = await this.marketDataRepository.delete({
        timestamp: LessThan(dailyCutoffDate),
        interval: DataInterval.ONE_DAY,
      });

      this.logger.log(`Cleaned up market data: ${minuteHourlyResult.affected || 0} minute/hourly records, ${dailyResult.affected || 0} daily records`);

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
      const activeTrends = await this.prisma.trend.findMany({
        where: {
          isActive: true,
          viralIndexSnapshots: {
            some: {
              timestamp: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
              },
            },
          },
        },
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
      const totalPoints = await this.marketDataRepository.count();

      // Get count by interval
      const intervalStats = await this.marketDataRepository
        .createQueryBuilder('data')
        .select('data.interval', 'interval')
        .addSelect('COUNT(*)', 'count')
        .groupBy('data.interval')
        .getRawMany();

      const dataByInterval = intervalStats.reduce((acc, stat) => {
        acc[stat.interval] = parseInt(stat.count);
        return acc;
      }, {});

      // Get count by symbol
      const symbolStats = await this.marketDataRepository
        .createQueryBuilder('data')
        .select('data.symbol', 'symbol')
        .addSelect('COUNT(*)', 'count')
        .groupBy('data.symbol')
        .orderBy('COUNT(*)', 'DESC')
        .limit(10)
        .getRawMany();

      const dataBySymbol = symbolStats.reduce((acc, stat) => {
        acc[stat.symbol] = parseInt(stat.count);
        return acc;
      }, {});

      // Get date range
      const oldestPoint = await this.marketDataRepository.findOne({
        order: { timestamp: 'ASC' },
      });
      const newestPoint = await this.marketDataRepository.findOne({
        order: { timestamp: 'DESC' },
      });

      return {
        totalMarketDataPoints: totalPoints,
        dataByInterval,
        dataBySymbol,
        oldestDataPoint: oldestPoint?.timestamp || null,
        newestDataPoint: newestPoint?.timestamp || null,
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
        volatility: 0,
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
      volatility: this.calculateVolatility(viralityScores),
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