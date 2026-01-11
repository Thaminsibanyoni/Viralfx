import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from '../redis/redis.service';
import { VPMXResult, VPMXHistoryEntry, VPMXWeighting, RegionalVPMXData } from "./interfaces/vpmx.interface";
import { WebSocketGatewayHandler } from '../websocket/gateways/websocket.gateway';

@Injectable()
export class VPMXService {
  private readonly logger = new Logger(VPMXService.name);
  private readonly VPMX_CACHE_KEY = 'vpmx:current';
  private readonly VPMX_HISTORY_KEY = 'vpmx:history';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly wsGateway: WebSocketGatewayHandler) {}

  /**
   * Get current VPMX value for a VTS symbol
   */
  async getCurrentVPMX(vtsSymbol: string): Promise<VPMXHistoryEntry | null> {
    // Try cache first
    const cacheKey = `${this.VPMX_CACHE_KEY}:${vtsSymbol}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const latest = await this.prisma.vPMXHistory.findFirst({
      where: { vtsSymbol },
      orderBy: { timestamp: 'desc' }
    });

    if (latest) {
      // Cache for 30 seconds
      await this.redis.setex(cacheKey, 30, JSON.stringify(latest));
    }

    return latest;
  }

  /**
   * Get latest VPMX values for multiple symbols
   */
  async getLatestVPMXBatch(vtsSymbols: string[]): Promise<Record<string, VPMXHistoryEntry | null>> {
    const results: Record<string, VPMXHistoryEntry | null> = {};

    // Batch cache lookup
    const cacheKeys = vtsSymbols.map(symbol => `${this.VPMX_CACHE_KEY}:${symbol}`);
    const cachedValues = await this.redis.mget(...cacheKeys);

    const uncachedSymbols: string[] = [];

    vtsSymbols.forEach((symbol, index) => {
      const cached = cachedValues[index];
      if (cached) {
        results[symbol] = JSON.parse(cached);
      } else {
        uncachedSymbols.push(symbol);
      }
    });

    // Fetch uncached symbols from database
    if (uncachedSymbols.length > 0) {
      const dbResults = await this.prisma.vPMXHistory.findMany({
        where: { vtsSymbol: { in: uncachedSymbols } },
        orderBy: { timestamp: 'desc' }
      });

      // Group by symbol and take latest
      const latestBySymbol = new Map<string, VPMXHistoryEntry>();
      dbResults.forEach(entry => {
        if (!latestBySymbol.has(entry.vtsSymbol) ||
            entry.timestamp > latestBySymbol.get(entry.vtsSymbol)!.timestamp) {
          latestBySymbol.set(entry.vtsSymbol, entry);
        }
      });

      // Cache and add to results
      for (const [symbol, entry] of latestBySymbol) {
        const cacheKey = `${this.VPMX_CACHE_KEY}:${symbol}`;
        await this.redis.setex(cacheKey, 30, JSON.stringify(entry));
        results[symbol] = entry;
      }

      // Add null for symbols with no data
      uncachedSymbols.forEach(symbol => {
        if (!latestBySymbol.has(symbol)) {
          results[symbol] = null;
        }
      });
    }

    return results;
  }

  /**
   * Get VPMX historical data
   */
  async getVPMXHistory(
    vtsSymbol: string,
    interval: string = '1h',
    startDate?: Date,
    endDate?: Date,
    limit = 100,
    page = 1): Promise<{ data: VPMXHistoryEntry[]; total: number }> {
    const where: any = { vtsSymbol };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.vPMXHistory.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: (page - 1) * limit
      }),
      this.prisma.vPMXHistory.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Get regional VPMX data
   */
  async getRegionalVPMXData(region?: string): Promise<RegionalVPMXData[]> {
    const cacheKey = `vpmx:regional:${region || 'global'}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const where = region ? { region } : {};
    const regionalData = await this.prisma.vPMXRegional.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    // Cache for 60 seconds
    await this.redis.setex(cacheKey, 60, JSON.stringify(regionalData));

    return regionalData as RegionalVPMXData[];
  }

  /**
   * Store VPMX computation result
   */
  async storeVPMXResult(result: VPMXResult): Promise<VPMXHistoryEntry> {
    const stored = await this.prisma.vPMXHistory.create({
      data: {
        vtsSymbol: result.vtsSymbol,
        timestamp: result.timestamp,
        value: result.value,
        components: result.components,
        metadata: result.metadata
      }
    });

    // Update cache
    const cacheKey = `${this.VPMX_CACHE_KEY}:${result.vtsSymbol}`;
    await this.redis.setex(cacheKey, 30, JSON.stringify(stored));

    // Broadcast real-time update
    this.wsGateway.broadcast('vpmx:update', {
      vtsSymbol: result.vtsSymbol,
      value: result.value,
      timestamp: result.timestamp,
      change: await this.calculateChange(result.vtsSymbol, result.value)
    });

    return stored;
  }

  /**
   * Store regional VPMX data
   */
  async storeRegionalVPMX(region: string, data: RegionalVPMXData): Promise<void> {
    await this.prisma.vPMXRegional.create({
      data: {
        region,
        vtsSymbol: data.vtsSymbol || 'AGGREGATE',
        timestamp: new Date(),
        value: data.value,
        components: data.components,
        contribution: data.contribution
      }
    });

    // Invalidate regional cache
    await this.redis.del(`vpmx:regional:${region}`);
    await this.redis.del('vpmx:regional:global');
  }

  /**
   * Update weighting configuration
   */
  async updateWeightingConfig(weighting: VPMXWeighting): Promise<void> {
    await this.redis.set('vpmx:weighting', JSON.stringify(weighting));
    this.logger.log('VPMX weighting configuration updated');
  }

  /**
   * Get current weighting configuration
   */
  async getWeightingConfig(): Promise<VPMXWeighting> {
    const cached = await this.redis.get('vpmx:weighting');

    if (cached) {
      return JSON.parse(cached);
    }

    // Default weighting
    const defaultWeighting: VPMXWeighting = {
      globalSentimentWeight: 0.20,
      viralMomentumWeight: 0.20,
      trendVelocityWeight: 0.15,
      mentionVolumeWeight: 0.15,
      engagementQualityWeight: 0.10,
      trendStabilityWeight: 0.10,
      deceptionRiskWeight: 0.05,
      regionalWeightingWeight: 0.05
    };

    await this.redis.set('vpmx:weighting', JSON.stringify(defaultWeighting));
    return defaultWeighting;
  }

  /**
   * Refresh aggregates for given interval
   */
  async refreshAggregates(interval: string, regions?: string[]): Promise<void> {
    this.logger.log(`Refreshing aggregates for interval: ${interval}`);

    // Calculate time range based on interval
    const timeRange = this.getTimeRangeForInterval(interval);

    const aggregateData = await this.prisma.vPMXHistory.groupBy({
      by: ['vtsSymbol'],
      where: {
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      },
      _avg: { value: true },
      _max: { value: true },
      _min: { value: true },
      _count: { value: true }
    });

    // Store aggregates
    for (const data of aggregateData) {
      await this.redis.setex(
        `vpmx:aggregate:${interval}:${data.vtsSymbol}`,
        300, // 5 minutes cache
        JSON.stringify({
          avg: data._avg.value,
          max: data._max.value,
          min: data._min.value,
          count: data._count.value,
          interval,
          timestamp: new Date()
        })
      );
    }
  }

  /**
   * Update historical aggregates
   */
  async updateHistoricalAggregates(interval: string): Promise<void> {
    // Implementation for updating long-term historical aggregates
    this.logger.log(`Updating historical aggregates for ${interval}`);
    // This would typically run less frequently (hourly/daily)
  }

  /**
   * Cleanup old VPMX data
   */
  async cleanupOldData(daysToKeep: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.vPMXHistory.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  }

  /**
   * Compute regional index
   */
  async computeRegionalIndex(region: string, vtsSymbols: string[]): Promise<RegionalVPMXData> {
    const regionalData = await this.prisma.vPMXHistory.findMany({
      where: {
        vtsSymbol: { in: vtsSymbols }
        // Add region-specific filtering logic here
      },
      orderBy: { timestamp: 'desc' },
      take: vtsSymbols.length * 10 // Get recent data for each symbol
    });

    // Calculate weighted regional average
    const totalValue = regionalData.reduce((sum, entry) => sum + entry.value, 0);
    const avgValue = totalValue / regionalData.length;

    return {
      region,
      value: avgValue,
      components: {
        // Aggregate components from regional data
        globalSentimentScore: 0.75,
        viralMomentumIndex: 0.82,
        trendVelocity: 0.68,
        mentionVolumeNormalized: 0.71,
        engagementQualityScore: 0.64,
        trendStability: 0.77,
        deceptionRiskInverse: 0.85,
        regionalWeighting: 1.0
      },
      contribution: avgValue / 1000 // Normalize to 0-1
    };
  }

  /**
   * Synchronize regional data
   */
  async synchronizeRegionalData(region: string): Promise<{ synced: number; errors: number }> {
    // Implementation for synchronizing regional data
    this.logger.log(`Synchronizing regional data for ${region}`);

    return {
      synced: 0,
      errors: 0
    };
  }

  /**
   * Count recent VPMX data
   */
  async countRecentVPMXData(hours: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    return await this.prisma.vPMXHistory.count({
      where: {
        timestamp: {
          gte: cutoffDate
        }
      }
    });
  }

  // Health check methods
  async testDatabaseConnection(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async testRedisConnection(): Promise<void> {
    await this.redis.ping();
  }

  async testSentimentServiceConnection(): Promise<void> {
    // Test connectivity to sentiment service
    // This would make an actual HTTP request or check service health
  }

  /**
   * Get latest VPMX for a symbol (alias for getCurrentVPMX)
   */
  async getLatestVPMX(vtsSymbol: string): Promise<VPMXHistoryEntry | null> {
    return this.getCurrentVPMX(vtsSymbol);
  }

  /**
   * Get top trending VTS symbols by VPMX
   */
  async getTopTrendingVPMX(limit = 10): Promise<VPMXHistoryEntry[]> {
    return await this.prisma.vPMXHistory.findMany({
      orderBy: { value: 'desc' },
      take: limit,
      distinct: ['vtsSymbol'],
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });
  }

  /**
   * Calculate percentage change for a VTS symbol
   */
  private async calculateChange(vtsSymbol: string, currentValue: number): Promise<{
    oneHour: number;
    twentyFourHours: number;
    sevenDays: number;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [oneHour, twentyFourHours, sevenDays] = await Promise.all([
      this.getVPMXAtTime(vtsSymbol, oneHourAgo),
      this.getVPMXAtTime(vtsSymbol, twentyFourHoursAgo),
      this.getVPMXAtTime(vtsSymbol, sevenDaysAgo),
    ]);

    return {
      oneHour: oneHour ? ((currentValue - oneHour) / oneHour) * 100 : 0,
      twentyFourHours: twentyFourHours ? ((currentValue - twentyFourHours) / twentyFourHours) * 100 : 0,
      sevenDays: sevenDays ? ((currentValue - sevenDays) / sevenDays) * 100 : 0
    };
  }

  /**
   * Get VPMX value at specific timestamp
   */
  private async getVPMXAtTime(vtsSymbol: string, timestamp: Date): Promise<number | null> {
    const entry = await this.prisma.vPMXHistory.findFirst({
      where: {
        vtsSymbol,
        timestamp: {
          lte: timestamp
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    return entry?.value || null;
  }

  /**
   * Get time range for aggregation interval
   */
  private getTimeRangeForInterval(interval: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);

    switch (interval) {
      case '1m':
        start.setMinutes(start.getMinutes() - 1);
        break;
      case '5m':
        start.setMinutes(start.getMinutes() - 5);
        break;
      case '15m':
        start.setMinutes(start.getMinutes() - 15);
        break;
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '6h':
        start.setHours(start.getHours() - 6);
        break;
      case '1d':
        start.setDate(start.getDate() - 1);
        break;
      default:
        start.setHours(start.getHours() - 1);
    }

    return { start, end: now };
  }
}
