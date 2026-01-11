import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface PerformanceSummary {
  timeRange: string;
  responseTime: {
  current: string;
  average: string;
  p95: string;
  p99: string;
  };
  throughput: {
  current: string;
  average: string;
  peak: string;
  };
  errorRate: {
  current: string;
  average: string;
  };
  resourceUsage: {
  cpu: string;
  memory: string;
  disk: string;
  };
}

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);
  constructor(
    @InjectRedis() private readonly redis: Redis,
  private readonly configService: ConfigService) {}
  async getPerformanceSummary(timeRange: string = '1h'): Promise<PerformanceSummary> {
  try {
  const now = Date.now();
  const timeRangeMs = this.parseTimeRange(timeRange);
  const startTime = now - timeRangeMs;

      // Get performance metrics from Redis
  const [
  responseTimeMetrics,
  throughputMetrics,
  errorRateMetrics,
  resourceMetrics
      ] = await Promise.all([
  this.getMetrics('response_time', startTime, now),
  this.getMetrics('throughput', startTime, now),
  this.getMetrics('error_rate', startTime, now),
  this.getMetrics('resource_usage', startTime, now)
      ]);
  return {
  timeRange,
  responseTime: {
  current: this.calculateCurrent(responseTimeMetrics),
  average: this.calculateAverage(responseTimeMetrics),
  p95: this.calculatePercentile(responseTimeMetrics, 95),
  p99: this.calculatePercentile(responseTimeMetrics, 99)
  },
  throughput: {
  current: this.calculateCurrent(throughputMetrics),
  average: this.calculateAverage(throughputMetrics),
  peak: this.calculatePeak(throughputMetrics)
  },
  errorRate: {
  current: this.calculateCurrent(errorRateMetrics),
  average: this.calculateAverage(errorRateMetrics)
  },
  resourceUsage: {
  cpu: this.getCurrentResourceUsage(resourceMetrics, 'cpu'),
  memory: this.getCurrentResourceUsage(resourceMetrics, 'memory'),
  disk: this.getCurrentResourceUsage(resourceMetrics, 'disk')
  }
  };
    } catch (error) {
  this.logger.error('Error getting performance summary', error);
  return this.getDefaultPerformanceSummary(timeRange);
  }
  }
  async recordPerformanceMetric(metric: Partial<PerformanceMetric>) {
  try {
  const fullMetric: PerformanceMetric = {
  name: metric.name || 'unknown',
  value: metric.value || 0,
  unit: metric.unit || 'ms',
  timestamp: metric.timestamp || new Date(),
  tags: metric.tags || {}
  };
  const key = `performance:${fullMetric.name}:${fullMetric.timestamp.getTime()}`;
  await this.redis.setex(key, 86400, JSON.stringify(fullMetric)); // 24 hours TTL

      // Add to time-series data
  const timeSeriesKey = `performance:timeseries:${fullMetric.name}`;
  await this.redis.zadd(timeSeriesKey, fullMetric.timestamp.getTime(), JSON.stringify(fullMetric));

      // Clean old data (keep only last 7 days)
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  await this.redis.zremrangebyscore(timeSeriesKey, 0, weekAgo);
  this.logger.log(`Performance metric recorded: ${fullMetric.name} = ${fullMetric.value}${fullMetric.unit}`);
    } catch (error) {
  this.logger.error('Error recording performance metric', error);
  }
  }
  async getPerformanceMetrics(
  name: string,
  timeRange: string = '1h',
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count' = 'avg') {
  try {
  const now = Date.now();
  const timeRangeMs = this.parseTimeRange(timeRange);
  const startTime = now - timeRangeMs;
  const metrics = await this.getMetrics(name, startTime, now);
  switch (aggregation) {
  case 'avg':
  return this.calculateAverage(metrics);
  case 'sum':
  return this.calculateSum(metrics);
  case 'min':
  return this.calculateMin(metrics);
  case 'max':
  return this.calculateMax(metrics);
  case 'count':
  return metrics.length.toString();
  default:
  return this.calculateAverage(metrics);
  }
    } catch (error) {
  this.logger.error(`Error getting performance metrics for ${name}`, error);
  return '0';
  }
  }
  async getPerformanceTrends(timeRange: string = '24h') {
  try {
  const metrics = ['response_time', 'throughput', 'error_rate'];
  const trends = {};
  for (const metric of metrics) {
  const trend = await this.calculateTrend(metric, timeRange);
  trends[metric] = trend;
  }
  return {
  timeRange,
  trends,
  summary: this.generateTrendSummary(trends)
  };
    } catch (error) {
  this.logger.error('Error getting performance trends', error);
  return {
  timeRange,
  trends: {},
  summary: {}
  };
  }
  }
  async getDatabasePerformance() {
  try {
      // Simulate database performance metrics
  return {
  connectionPool: {
  active: 15,
  idle: 35,
  total: 50,
  utilization: '30%'
  },
  queryPerformance: {
  averageResponseTime: '45ms',
  slowQueries: 3,
  queriesPerSecond: 125
  },
  indexUsage: {
  efficientQueries: '92%',
  inefficientQueries: '8%',
  recommendations: 2
  }
  };
    } catch (error) {
  this.logger.error('Error getting database performance', error);
  return {
  connectionPool: { active: 0, idle: 0, total: 0, utilization: '0%' },
  queryPerformance: { averageResponseTime: '0ms', slowQueries: 0, queriesPerSecond: 0 },
  indexUsage: { efficientQueries: '0%', inefficientQueries: '0%', recommendations: 0 }
  };
  }
  }
  async getCachePerformance() {
  try {
  const info = await this.redis.info('stats');
  return {
  hits: this.parseRedisStat(info, 'keyspace_hits') || '0',
  misses: this.parseRedisStat(info, 'keyspace_misses') || '0',
  hitRate: this.calculateHitRate(info),
  memoryUsage: this.parseRedisStat(info, 'used_memory_human') || '0B',
  evictions: this.parseRedisStat(info, 'evicted_keys') || '0',
  connections: this.parseRedisStat(info, 'connected_clients') || '0'
  };
    } catch (error) {
  this.logger.error('Error getting cache performance', error);
  return {
  hits: '0',
  misses: '0',
  hitRate: '0%',
  memoryUsage: '0B',
  evictions: '0',
  connections: '0'
  };
  }
  }
  private async getMetrics(name: string, startTime: number, endTime: number): Promise<PerformanceMetric[]> {
  try {
  const timeSeriesKey = `performance:timeseries:${name}`;
  const metricData = await this.redis.zrangebyscore(timeSeriesKey, startTime, endTime);
  const metrics: PerformanceMetric[] = [];
  for (const data of metricData) {
  try {
  const metric = JSON.parse(data);
  metrics.push(metric);
  } catch (error) {
  this.logger.error('Error parsing metric data', error);
  }
  }
  return metrics;
    } catch (error) {
  this.logger.error(`Error getting metrics for ${name}`, error);
  return [];
  }
  }
  private calculateCurrent(metrics: PerformanceMetric[]): string {
  if (metrics.length === 0) return '0';
  const latest = metrics[metrics.length - 1];
  return `${latest.value}${latest.unit}`;
  }
  private calculateAverage(metrics: PerformanceMetric[]): string {
  if (metrics.length === 0) return '0';
  const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
  const avg = sum / metrics.length;
  return `${Math.round(avg)}${metrics[0]?.unit || ''}`;
  }
  private calculatePercentile(metrics: PerformanceMetric[], percentile: number): string {
  if (metrics.length === 0) return '0';
  const values = metrics.map(m => m.value).sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * values.length) - 1;
  const value = values[index] || 0;
  return `${Math.round(value)}${metrics[0]?.unit || ''}`;
  }
  private calculatePeak(metrics: PerformanceMetric[]): string {
  if (metrics.length === 0) return '0';
  const peak = Math.max(...metrics.map(m => m.value));
  return `${peak}${metrics[0]?.unit || ''}`;
  }
  private calculateSum(metrics: PerformanceMetric[]): string {
  if (metrics.length === 0) return '0';
  const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
  return `${sum}${metrics[0]?.unit || ''}`;
  }
  private calculateMin(metrics: PerformanceMetric[]): string {
  if (metrics.length === 0) return '0';
  const min = Math.min(...metrics.map(m => m.value));
  return `${min}${metrics[0]?.unit || ''}`;
  }
  private calculateMax(metrics: PerformanceMetric[]): string {
  if (metrics.length === 0) return '0';
  const max = Math.max(...metrics.map(m => m.value));
  return `${max}${metrics[0]?.unit || ''}`;
  }
  private getCurrentResourceUsage(metrics: PerformanceMetric[], resourceType: string): string {
  const resourceMetrics = metrics.filter(m => m.tags?.type === resourceType);
  if (resourceMetrics.length === 0) return '0%';
  const latest = resourceMetrics[resourceMetrics.length - 1];
  return `${Math.round(latest.value)}${latest.unit}`;
  }
  private parseTimeRange(timeRange: string): number {
  const units: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
  };
  const match = timeRange.match(/^(\d+)([smhd])$/);
  if (!match) return 60 * 60 * 1000; // Default to 1 hour
  const value = parseInt(match[1], 10);
  const unit = match[2];
  return value * units[unit];
  }
  private async calculateTrend(metric: string, timeRange: string) {
  const metrics = await this.getMetrics(
  metric,
  Date.now() - this.parseTimeRange(timeRange),
  Date.now()
  );
  if (metrics.length < 2) return 'stable';
  const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2));
  const secondHalf = metrics.slice(Math.floor(metrics.length / 2));
  const firstAvg = firstHalf.reduce((acc, m) => acc + m.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((acc, m) => acc + m.value, 0) / secondHalf.length;
  const change = ((secondAvg - firstAvg) / firstAvg) * 100;
  if (change > 10) return 'improving';
  if (change < -10) return 'degrading';
  return 'stable';
  }
  private generateTrendSummary(trends: Record<string, string>) {
  const improving = Object.values(trends).filter(t => t === 'improving').length;
  const degrading = Object.values(trends).filter(t => t === 'degrading').length;
  const stable = Object.values(trends).filter(t => t === 'stable').length;
  return {
  overall: degrading > 0 ? 'attention' : improving > stable ? 'good' : 'stable',
  improving,
  degrading,
  stable
  };
  }
  private parseRedisStat(info: string, stat: string): string | null {
  const lines = info.split('\r\n');
  for (const line of lines) {
  if (line.startsWith(`${stat}:`)) {
  return line.split(':')[1];
  }
  }
  return null;
  }
  private calculateHitRate(info: string): string {
  const hits = parseInt(this.parseRedisStat(info, 'keyspace_hits') || '0');
  const misses = parseInt(this.parseRedisStat(info, 'keyspace_misses') || '0');
  const total = hits + misses;
  if (total === 0) return '0%';
  return `${Math.round((hits / total) * 100)}%`;
  }
  private getDefaultPerformanceSummary(timeRange: string): PerformanceSummary {
  return {
  timeRange,
  responseTime: {
  current: '0ms',
  average: '0ms',
  p95: '0ms',
  p99: '0ms'
  },
  throughput: {
  current: '0/s',
  average: '0/s',
  peak: '0/s'
  },
  errorRate: {
  current: '0%',
  average: '0%'
  },
  resourceUsage: {
  cpu: '0%',
  memory: '0%',
  disk: '0%'
  }
  };
  }
}