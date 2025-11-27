import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

import { SystemMetric } from '../entities/metric.entity';

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

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectRepository(SystemMetric)
    private readonly metricRepository: Repository<SystemMetric>,
    @InjectRedis() private readonly redis: Redis
  ) {}

  /**
   * Record a new metric
   */
  async recordMetric(metric: Partial<SystemMetric>): Promise<SystemMetric> {
    try {
      const newMetric = this.metricRepository.create({
        ...metric,
        timestamp: metric.timestamp || new Date()
      });

      const savedMetric = await this.metricRepository.save(newMetric);

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
    const endTime = new Date();

    return await this.metricRepository.find({
      where: {
        timestamp: Between(startTime, endTime)
      },
      order: {
        timestamp: 'DESC'
      },
      take: 1000 // Limit to prevent excessive data
    });
  }

  /**
   * Query metrics with filters
   */
  async queryMetrics(query: MetricQuery): Promise<SystemMetric[]> {
    try {
      const queryBuilder = this.metricRepository.createQueryBuilder('metric');

      // Apply name filter
      if (query.name) {
        queryBuilder.andWhere('metric.name = :name', { name: query.name });
      }

      // Apply time range filter
      if (query.startTime && query.endTime) {
        queryBuilder.andWhere('metric.timestamp BETWEEN :startTime AND :endTime', {
          startTime: query.startTime,
          endTime: query.endTime
        });
      } else if (query.startTime) {
        queryBuilder.andWhere('metric.timestamp >= :startTime', {
          startTime: query.startTime
        });
      } else if (query.endTime) {
        queryBuilder.andWhere('metric.timestamp <= :endTime', {
          endTime: query.endTime
        });
      }

      // Apply tags filter (using JSON operations)
      if (query.tags) {
        Object.entries(query.tags).forEach(([key, value]) => {
          queryBuilder.andWhere(`metric.tags ->> :${key} = :${key}Value`, {
            [key]: key,
            [`${key}Value`]: value
          });
        });
      }

      // Apply aggregation
      if (query.aggregation) {
        queryBuilder.select([
          'DATE_TRUNC(\'hour\', metric.timestamp) as timestamp',
          `${query.aggregation}(metric.value) as value`,
          'COUNT(*) as count'
        ]);
        queryBuilder.groupBy('DATE_TRUNC(\'hour\', metric.timestamp)');
      }

      queryBuilder.orderBy('metric.timestamp', 'DESC');

      const results = await queryBuilder.getMany();

      // Transform results for aggregation queries
      if (query.aggregation) {
        return results.map(result => ({
          ...result,
          timestamp: new Date(result.timestamp),
          value: parseFloat(result.value),
          count: parseInt(result.count)
        })) as SystemMetric[];
      }

      return results;

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
      const queryBuilder = this.metricRepository.createQueryBuilder('metric');

      queryBuilder
        .select([
          `DATE_TRUNC('${interval}', metric.timestamp) as timestamp`,
          'AVG(metric.value) as value',
          'COUNT(*) as count'
        ])
        .where('metric.name = :name', { name: metricName })
        .andWhere('metric.timestamp BETWEEN :startTime AND :endTime', {
          startTime,
          endTime
        })
        .groupBy(`DATE_TRUNC('${interval}', metric.timestamp)`)
        .orderBy('timestamp', 'ASC');

      const results = await queryBuilder.getRawMany();

      return results.map(result => ({
        timestamp: new Date(result.timestamp),
        value: parseFloat(result.value),
        count: parseInt(result.count)
      }));

    } catch (error) {
      this.logger.error('Failed to get aggregated metrics:', error);
      throw error;
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
      const metric = await this.metricRepository.findOne({
        where: { name },
        order: { timestamp: 'DESC' }
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
      const queryBuilder = this.metricRepository.createQueryBuilder('metric');

      const result = await queryBuilder
        .select([
          'MIN(metric.value) as min',
          'MAX(metric.value) as max',
          'AVG(metric.value) as avg',
          'COUNT(*) as count',
          'SUM(metric.value) as sum'
        ])
        .where('metric.name = :name', { name })
        .andWhere('metric.timestamp BETWEEN :startTime AND :endTime', {
          startTime,
          endTime
        })
        .getRawOne();

      return {
        min: parseFloat(result.min) || 0,
        max: parseFloat(result.max) || 0,
        avg: parseFloat(result.avg) || 0,
        count: parseInt(result.count) || 0,
        sum: parseFloat(result.sum) || 0
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
      const queryBuilder = this.metricRepository.createQueryBuilder('metric');

      Object.entries(tags).forEach(([key, value]) => {
        queryBuilder.andWhere(`metric.tags ->> :${key} = :${key}Value`, {
          [key]: key,
          [`${key}Value`]: value
        });
      });

      return await queryBuilder
        .orderBy('metric.timestamp', 'DESC')
        .limit(1000)
        .getMany();

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
      const result = await this.metricRepository
        .createQueryBuilder('metric')
        .select('DISTINCT metric.name', 'name')
        .getRawMany();

      return result.map(row => row.name);

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

      const result = await this.metricRepository.delete({
        timestamp: LessThan(cutoffDate)
      });

      return result.affected || 0;

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
      const endTime = new Date();

      return await this.metricRepository.find({
        where: {
          name,
          timestamp: Between(startTime, endTime)
        },
        order: {
          value: 'DESC'
        },
        take: limit
      });

    } catch (error) {
      this.logger.error(`Failed to get top metrics for ${name}:`, error);
      throw error;
    }
  }
}