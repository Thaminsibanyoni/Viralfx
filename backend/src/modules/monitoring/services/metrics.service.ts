import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

interface MetricQuery {
  name?: string;
  tags?: Record<string, string>;
  startTime?: Date;
  endTime?: Date;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  groupBy?: string[];
}

interface MetricAggregation {
  timestamp: Date;
  value: number;
  count: number;
}

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit?: string;
  timestamp: Date;
  tags?: Record<string, any>;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
        private prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis
  ) {}

  /**
   * Record a new metric
   */
  async recordMetric(metric: Partial<SystemMetric>): Promise<SystemMetric> {
    try {
      const savedMetric = await this.prisma.systemMetric.create({
        data: {
          name: metric.name,
          value: metric.value,
          unit: metric.unit,
          timestamp: metric.timestamp || new Date(),
          tags: metric.tags || {},
        }
      });

      // Cache recent metrics in Redis for quick access
      const cacheKey = `metric:${metric.name}:latest`;
      await this.redis.setex(cacheKey, 300, JSON.stringify(savedMetric)); // 5 minutes TTL

      // Update time-series data for real-time monitoring
      await this.updateTimeSeriesData(metric);

      this.logger.debug(`Recorded metric: ${metric.name} = ${metric.value}`);
      return savedMetric;

    } catch (error) {
      this.logger.error(`Failed to record metric ${metric.name}:`, error);
      throw error;
    }
  }

  /**
   * Get recent metrics for multiple names
   */
  async getRecentMetrics(hours: number = 24): Promise<SystemMetric[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    return await this.prisma.systemMetric.findMany({
      where: {
        timestamp: {
          gte: startTime
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 1000 // Limit to prevent excessive data
    });
  }

  /**
   * Query metrics with filters
   */
  async queryMetrics(query: MetricQuery): Promise<SystemMetric[]> {
    try {
      const where: any = {};

      // Apply name filter
      if (query.name) {
        where.name = query.name;
      }

      // Apply time range filter
      if (query.startTime && query.endTime) {
        where.timestamp = {
          gte: query.startTime,
          lte: query.endTime
        };
      } else if (query.startTime) {
        where.timestamp = {
          gte: query.startTime
        };
      } else if (query.endTime) {
        where.timestamp = {
          lte: query.endTime
        };
      }

      // Note: Tags filtering with JSON operations is more complex in Prisma
      // For simple tag filtering, we'll apply it at the application level
      // or use raw queries for complex JSON filtering

      const results = await this.prisma.systemMetric.findMany({
        where,
        orderBy: {
          timestamp: 'desc'
        },
        take: 1000
      });

      // Apply tags filter at application level
      let filteredResults = results;
      if (query.tags) {
        filteredResults = results.filter(metric => {
          if (!metric.tags) return false;
          return Object.entries(query.tags).every(([key, value]) => {
            return metric.tags && metric.tags[key] === value;
          });
        });
      }

      return filteredResults as SystemMetric[];

    } catch (error) {
      this.logger.error('Failed to query metrics:', error);
      throw error;
    }
  }

  /**
   * Get aggregated metrics for time series
   */
  async getAggregatedMetrics(
    metricName: string,
    startTime: Date,
    endTime: Date,
    interval: string = '1h'
  ): Promise<MetricAggregation[]> {
    try {
      // Get all metrics in the time range
      const metrics = await this.prisma.systemMetric.findMany({
        where: {
          name: metricName,
          timestamp: {
            gte: startTime,
            lte: endTime
          }
        },
        orderBy: {
          timestamp: 'asc'
        }
      });

      // Group by time interval and calculate aggregations
      const intervalMs = this.parseIntervalToMs(interval);
      const grouped = new Map<string, { sum: number; count: number; timestamps: number[] }>();

      for (const metric of metrics) {
        const timestamp = metric.timestamp.getTime();
        const bucketStart = Math.floor(timestamp / intervalMs) * intervalMs;
        const bucketKey = bucketStart.toString();

        if (!grouped.has(bucketKey)) {
          grouped.set(bucketKey, { sum: 0, count: 0, timestamps: [] });
        }

        const bucket = grouped.get(bucketKey)!;
        bucket.sum += metric.value;
        bucket.count += 1;
        bucket.timestamps.push(timestamp);
      }

      // Convert to array of aggregations
      return Array.from(grouped.entries()).map(([bucketKey, data]) => ({
        timestamp: new Date(parseInt(bucketKey)),
        value: data.sum / data.count,
        count: data.count
      }));

    } catch (error) {
      this.logger.error('Failed to get aggregated metrics:', error);
      throw error;
    }
  }

  private parseIntervalToMs(interval: string): number {
    const match = interval.match(/(\d+)([hms])/);
    if (!match) return 3600000; // Default to 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60000;
      case 'h': return value * 3600000;
      default: return 3600000;
    }
  }

  /**
   * Get latest metric value
   */
  async getLatestMetric(name: string): Promise<SystemMetric | null> {
    try {
      // Try to get from cache first
      const cacheKey = `metric:${name}:latest`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...parsed,
          timestamp: new Date(parsed.timestamp)
        };
      }

      // Get from database
      const metric = await this.prisma.systemMetric.findFirst({
        where: { name },
        orderBy: { timestamp: 'desc' }
      });

      if (metric) {
        // Cache the result
        await this.redis.setex(cacheKey, 300, JSON.stringify(metric));
      }

      return metric;

    } catch (error) {
      this.logger.error(`Failed to get latest metric ${name}:`, error);
      return null;
    }
  }

  /**
   * Get metric statistics
   */
  async getMetricStatistics(
    name: string,
    startTime: Date,
    endTime: Date
  ): Promise<{
    min: number;
    max: number;
    avg: number;
    count: number;
    sum: number;
  }> {
    try {
      const metrics = await this.prisma.systemMetric.findMany({
        where: {
          name,
          timestamp: {
            gte: startTime,
            lte: endTime
          }
        },
        select: {
          value: true
        }
      });

      if (metrics.length === 0) {
        return { min: 0, max: 0, avg: 0, count: 0, sum: 0 };
      }

      const values = metrics.map(m => m.value);
      const sum = values.reduce((a, b) => a + b, 0);

      return {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: sum / values.length,
        count: values.length,
        sum
      };

    } catch (error) {
      this.logger.error(`Failed to get metric statistics for ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get metrics by tags
   */
  async getMetricsByTags(tags: Record<string, string>): Promise<SystemMetric[]> {
    try {
      const metrics = await this.prisma.systemMetric.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 1000
      });

      // Filter by tags at application level
      return metrics.filter(metric => {
        if (!metric.tags) return false;
        return Object.entries(tags).every(([key, value]) => {
          return metric.tags && metric.tags[key] === value;
        });
      }) as SystemMetric[];

    } catch (error) {
      this.logger.error('Failed to get metrics by tags:', error);
      throw error;
    }
  }

  /**
   * Get metric names
   */
  async getMetricNames(): Promise<string[]> {
    try {
      const metrics = await this.prisma.systemMetric.findMany({
        select: {
          name: true
        },
        distinct: ['name']
      });

      return metrics.map(m => m.name);

    } catch (error) {
      this.logger.error('Failed to get metric names:', error);
      throw error;
    }
  }

  /**
   * Update time-series data in Redis
   */
  private async updateTimeSeriesData(metric: Partial<SystemMetric>): Promise<void> {
    try {
      if (!metric.name || !metric.value) return;

      const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
      const key = `ts:${metric.name}`;

      // Use Redis Time Series if available, otherwise use sorted sets
      await this.redis.zadd(key, timestamp, metric.value.toString());

      // Keep only last 24 hours of data
      const oneDayAgo = timestamp - 86400;
      await this.redis.zremrangebyscore(key, 0, oneDayAgo);

      // Set expiration
      await this.redis.expire(key, 86400); // 24 hours

    } catch (error) {
      this.logger.error('Failed to update time-series data:', error);
    }
  }

  /**
   * Get time-series data from Redis
   */
  async getTimeSeriesData(
    metricName: string,
    startTime?: number,
    endTime?: number
  ): Promise<Array<{ timestamp: number; value: number }>> {
    try {
      const key = `ts:${metricName}`;
      const now = Math.floor(Date.now() / 1000);
      const start = startTime || (now - 3600); // Default to last hour
      const end = endTime || now;

      const results = await this.redis.zrangebyscore(
        key,
        start,
        end,
        'WITHSCORES'
      );

      const data = [];
      for (let i = 0; i < results.length; i += 2) {
        data.push({
          timestamp: parseInt(results[i + 1]),
          value: parseFloat(results[i])
        });
      }

      return data;

    } catch (error) {
      this.logger.error(`Failed to get time-series data for ${metricName}:`, error);
      return [];
    }
  }

  /**
   * Cleanup old metrics
   */
  async cleanupOldMetrics(daysToKeep: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      const result = await this.prisma.systemMetric.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      return result.count;

    } catch (error) {
      this.logger.error('Failed to cleanup old metrics:', error);
      throw error;
    }
  }

  /**
   * Export metrics to CSV
   */
  async exportMetrics(query: MetricQuery): Promise<string> {
    try {
      const metrics = await this.queryMetrics(query);

      if (metrics.length === 0) {
        return '';
      }

      // Create CSV header
      const headers = ['timestamp', 'name', 'value', 'unit', 'tags'];
      const rows = [headers.join(',')];

      // Add data rows
      for (const metric of metrics) {
        const row = [
          metric.timestamp.toISOString(),
          metric.name,
          metric.value.toString(),
          metric.unit || '',
          JSON.stringify(metric.tags || {})
        ];
        rows.push(row.join(','));
      }

      return rows.join('\n');

    } catch (error) {
      this.logger.error('Failed to export metrics:', error);
      throw error;
    }
  }

  /**
   * Get metric trends (increase/decrease percentage)
   */
  async getMetricTrends(
    metricName: string,
    period1: { start: Date; end: Date },
    period2: { start: Date; end: Date }
  ): Promise<{ trend: number; period1Avg: number; period2Avg: number }> {
    try {
      const [stats1, stats2] = await Promise.all([
        this.getMetricStatistics(metricName, period1.start, period1.end),
        this.getMetricStatistics(metricName, period2.start, period2.end)
      ]);

      const period1Avg = stats1.avg;
      const period2Avg = stats2.avg;

      const trend = period1Avg > 0 ? ((period2Avg - period1Avg) / period1Avg) * 100 : 0;

      return {
        trend,
        period1Avg,
        period2Avg
      };

    } catch (error) {
      this.logger.error(`Failed to get metric trends for ${metricName}:`, error);
      throw error;
    }
  }

  /**
   * Get top metrics by value
   */
  async getTopMetrics(
    name: string,
    limit: number = 10,
    timeWindow: number = 3600000 // 1 hour default
  ): Promise<SystemMetric[]> {
    try {
      const startTime = new Date(Date.now() - timeWindow);

      return await this.prisma.systemMetric.findMany({
        where: {
          name,
          timestamp: {
            gte: startTime
          }
        },
        orderBy: {
          value: 'desc'
        },
        take: limit
      });

    } catch (error) {
      this.logger.error(`Failed to get top metrics for ${name}:`, error);
      throw error;
    }
  }
}
