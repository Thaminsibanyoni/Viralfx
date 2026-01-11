import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Cron } from '@nestjs/schedule';

import { MetricsService } from "./metrics.service";
import { AlertingService } from "./alerting.service";
import { PerformanceService } from "./performance.service";
import { HealthService } from "./health.service";

// COMMENTED OUT (TypeORM entity deleted): import { SystemMetric } from '../entities/metric.entity';
// COMMENTED OUT (TypeORM entity deleted): import { Alert } from '../entities/alert.entity';

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private isMonitoring = false;
  private metricCollectionInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Performance thresholds
  private readonly thresholds = {
    responseTime: 1000, // 1 second
    errorRate: 0.05, // 5%
    memoryUsage: 0.8, // 80%
    cpuUsage: 0.7, // 70%
    diskUsage: 0.85, // 85%
    websocketLatency: 500, // 500ms
    databaseConnections: 0.9 // 90% of max connections
  };

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly alertingService: AlertingService,
    private readonly performanceService: PerformanceService,
    private readonly healthService: HealthService
  ) {}

  async onModuleInit() {
    await this.initializeMonitoring();
  }

  /**
   * Initialize the monitoring system
   */
  private async initializeMonitoring(): Promise<void> {
    try {
      this.logger.log('Initializing monitoring system...');

      // Start metric collection
      await this.startMetricCollection();

      // Start health checks
      await this.startHealthChecks();

      // Initialize alert rules
      await this.initializeAlertRules();

      // Set up performance tracking
      await this.initializePerformanceTracking();

      this.isMonitoring = true;
      this.logger.log('Monitoring system initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize monitoring system:', error);
      throw error;
    }
  }

  /**
   * Start collecting system metrics
   */
  private async startMetricCollection(): Promise<void> {
    const intervalMs = parseInt(this.configService.get('METRICS_COLLECTION_INTERVAL', '30000'));

    this.metricCollectionInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        this.logger.error('Error collecting system metrics:', error);
      }
    }, intervalMs);

    this.logger.log(`Started metric collection with ${intervalMs}ms interval`);
  }

  /**
   * Start health monitoring
   */
  private async startHealthChecks(): Promise<void> {
    const intervalMs = parseInt(this.configService.get('HEALTH_CHECK_INTERVAL', '60000'));

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        this.logger.error('Error during health checks:', error);
      }
    }, intervalMs);

    this.logger.log(`Started health checks with ${intervalMs}ms interval`);
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    const metrics = await Promise.all([
      this.collectCpuMetrics(),
      this.collectMemoryMetrics(),
      this.collectDatabaseMetrics(),
      this.collectRedisMetrics(),
      this.collectWebSocketMetrics(),
      this.collectApplicationMetrics()
    ]);

    // Store metrics in database
    for (const metric of metrics) {
      if (metric) {
        await this.metricsService.recordMetric(metric);
      }
    }

    // Check thresholds and trigger alerts
    await this.checkMetricThresholds(metrics);
  }

  /**
   * Collect CPU metrics
   */
  private async collectCpuMetrics(): Promise<SystemMetric | null> {
    try {
      const usage = process.cpuUsage();
      const cpuUsage = (usage.user + usage.system) / 1000000; // Convert to seconds

      return {
        id: undefined,
        name: 'cpu_usage',
        value: cpuUsage,
        unit: 'percentage',
        tags: { component: 'system' },
        timestamp: new Date(),
        metadata: {
          userTime: usage.user,
          systemTime: usage.system,
          cores: require('os').cpus().length
        }
      };
    } catch (error) {
      this.logger.error('Error collecting CPU metrics:', error);
      return null;
    }
  }

  /**
   * Collect memory metrics
   */
  private async collectMemoryMetrics(): Promise<SystemMetric | null> {
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();
      const usedMemory = totalMemory - freeMemory;

      return {
        id: undefined,
        name: 'memory_usage',
        value: usedMemory / totalMemory,
        unit: 'percentage',
        tags: { component: 'system' },
        timestamp: new Date(),
        metadata: {
          totalMemory,
          freeMemory,
          usedMemory,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external
        }
      };
    } catch (error) {
      this.logger.error('Error collecting memory metrics:', error);
      return null;
    }
  }

  /**
   * Collect database metrics
   */
  private async collectDatabaseMetrics(): Promise<SystemMetric | null> {
    try {
      // This would connect to your database to get actual metrics
      // Mock implementation for now
      const dbResponseTime = Math.random() * 100;
      const activeConnections = Math.floor(Math.random() * 50);

      return {
        id: undefined,
        name: 'database_performance',
        value: dbResponseTime,
        unit: 'milliseconds',
        tags: { component: 'database' },
        timestamp: new Date(),
        metadata: {
          responseTime: dbResponseTime,
          activeConnections,
          connectionPool: 'postgresql'
        }
      };
    } catch (error) {
      this.logger.error('Error collecting database metrics:', error);
      return null;
    }
  }

  /**
   * Collect Redis metrics
   */
  private async collectRedisMetrics(): Promise<SystemMetric | null> {
    try {
      const info = await this.redis.info('memory');
      const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
      const maxMemory = parseInt(info.match(/maxmemory:(\d+)/)?.[1] || '0');

      return {
        id: undefined,
        name: 'redis_memory_usage',
        value: maxMemory > 0 ? usedMemory / maxMemory : 0,
        unit: 'percentage',
        tags: { component: 'redis' },
        timestamp: new Date(),
        metadata: {
          usedMemory,
          maxMemory,
          connectedClients: await this.redis.info('clients')
        }
      };
    } catch (error) {
      this.logger.error('Error collecting Redis metrics:', error);
      return null;
    }
  }

  /**
   * Collect WebSocket metrics
   */
  private async collectWebSocketMetrics(): Promise<SystemMetric | null> {
    try {
      // Get WebSocket connection count from Redis
      const connectedClients = await this.redis.get('websocket:connections') || '0';
      const messagesPerSecond = Math.random() * 100;

      return {
        id: undefined,
        name: 'websocket_connections',
        value: parseInt(connectedClients),
        unit: 'count',
        tags: { component: 'websocket' },
        timestamp: new Date(),
        metadata: {
          connections: parseInt(connectedClients),
          messagesPerSecond,
          latency: Math.random() * 100
        }
      };
    } catch (error) {
      this.logger.error('Error collecting WebSocket metrics:', error);
      return null;
    }
  }

  /**
   * Collect application-specific metrics
   */
  private async collectApplicationMetrics(): Promise<SystemMetric | null> {
    try {
      // Get application metrics from Redis
      const activeUsers = await this.redis.scard('active_users');
      const tradesPerMinute = Math.random() * 50;
      const ordersPerMinute = Math.random() * 100;

      return {
        id: undefined,
        name: 'application_metrics',
        value: tradesPerMinute,
        unit: 'count',
        tags: { component: 'application' },
        timestamp: new Date(),
        metadata: {
          activeUsers,
          tradesPerMinute,
          ordersPerMinute,
          errorsPerMinute: Math.random() * 5
        }
      };
    } catch (error) {
      this.logger.error('Error collecting application metrics:', error);
      return null;
    }
  }

  /**
   * Perform comprehensive health checks
   */
  private async performHealthChecks(): Promise<void> {
    const healthChecks = await Promise.allSettled([
      this.healthService.checkDatabase(),
      this.healthService.checkRedis(),
      this.healthService.checkWebSocket(),
      this.healthService.checkExternalApis(),
      this.healthService.checkDiskSpace(),
      this.healthService.checkMemory()
    ]);

    const results = healthChecks.map((result, index) => ({
      component: ['database', 'redis', 'websocket', 'external-apis', 'disk', 'memory'][index],
      status: result.status === 'fulfilled' ? result.value.status : 'unhealthy',
      message: result.status === 'fulfilled' ? result.value.message : result.reason?.message,
      timestamp: new Date()
    }));

    // Store health status
    await this.healthService.recordHealthCheck(results);

    // Check for critical issues and trigger alerts
    const criticalIssues = results.filter(r => r.status === 'unhealthy');
    if (criticalIssues.length > 0) {
      await this.alertingService.triggerAlert({
        type: 'SYSTEM_HEALTH',
        severity: 'CRITICAL',
        message: `${criticalIssues.length} system components are unhealthy`,
        metadata: { issues: criticalIssues }
      });
    }
  }

  /**
   * Check metric thresholds and trigger alerts
   */
  private async checkMetricThresholds(metrics: (SystemMetric | null)[]): Promise<void> {
    for (const metric of metrics) {
      if (!metric) continue;

      await this.evaluateMetricThreshold(metric);
    }
  }

  /**
   * Evaluate a single metric against thresholds
   */
  private async evaluateMetricThreshold(metric: SystemMetric): Promise<void> {
    const threshold = this.getThresholdForMetric(metric.name);
    if (!threshold) return;

    const isExceeded = this.checkThresholdExceeded(metric.value, threshold);
    const alertKey = `threshold:${metric.name}`;

    if (isExceeded) {
      // Check if we already have an active alert for this threshold
      const existingAlert = await this.redis.get(alertKey);

      if (!existingAlert) {
        await this.alertingService.triggerAlert({
          type: 'THRESHOLD_EXCEEDED',
          severity: this.getSeverityForMetric(metric.name, metric.value, threshold),
          message: `${metric.name} exceeded threshold: ${metric.value} > ${threshold}`,
          metadata: {
            metric: metric.name,
            value: metric.value,
            threshold,
            unit: metric.unit
          }
        });

        // Cache alert to prevent spam (1 hour TTL)
        await this.redis.setex(alertKey, 3600, JSON.stringify({
          timestamp: new Date().toISOString(),
          value: metric.value
        }));
      }
    } else {
      // Clear alert if threshold is back to normal
      await this.redis.del(alertKey);
    }
  }

  /**
   * Get threshold value for a metric
   */
  private getThresholdForMetric(metricName: string): number | null {
    const thresholdMap: { [key: string]: number } = {
      'cpu_usage': this.thresholds.cpuUsage,
      'memory_usage': this.thresholds.memoryUsage,
      'database_performance': this.thresholds.responseTime,
      'redis_memory_usage': this.thresholds.memoryUsage,
      'websocket_connections': 1000, // Max connections
      'application_metrics': 100 // Max trades per minute
    };

    return thresholdMap[metricName] || null;
  }

  /**
   * Check if a threshold is exceeded
   */
  private checkThresholdExceeded(value: number, threshold: number): boolean {
    return value > threshold;
  }

  /**
   * Get alert severity based on metric and threshold
   */
  private getSeverityForMetric(metricName: string, value: number, threshold: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const ratio = value / threshold;

    if (ratio >= 2) return 'CRITICAL';
    if (ratio >= 1.5) return 'HIGH';
    if (ratio >= 1.2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Initialize alert rules
   */
  private async initializeAlertRules(): Promise<void> {
    const defaultRules = [
      {
        name: 'High CPU Usage',
        condition: 'cpu_usage > 0.8',
        severity: 'HIGH',
        cooldown: 300000, // 5 minutes
        enabled: true
      },
      {
        name: 'High Memory Usage',
        condition: 'memory_usage > 0.85',
        severity: 'CRITICAL',
        cooldown: 300000,
        enabled: true
      },
      {
        name: 'Database Slow Response',
        condition: 'database_performance > 1000',
        severity: 'MEDIUM',
        cooldown: 300000,
        enabled: true
      },
      {
        name: 'Redis Memory High',
        condition: 'redis_memory_usage > 0.8',
        severity: 'HIGH',
        cooldown: 300000,
        enabled: true
      },
      {
        name: 'WebSocket Connections High',
        condition: 'websocket_connections > 1000',
        severity: 'MEDIUM',
        cooldown: 300000,
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      await this.alertingService.createAlertRule(rule);
    }

    this.logger.log(`Initialized ${defaultRules.length} alert rules`);
  }

  /**
   * Initialize performance tracking
   */
  private async initializePerformanceTracking(): Promise<void> {
    await this.performanceService.initializeTracking();
    this.logger.log('Performance tracking initialized');
  }

  /**
   * Get real-time system status
   */
  async getSystemStatus(): Promise<any> {
    const [
      healthStatus,
      recentMetrics,
      activeAlerts,
      performanceSummary
    ] = await Promise.all([
      this.healthService.getCurrentHealth(),
      this.metricsService.getRecentMetrics(24), // Last 24 hours
      this.alertingService.getActiveAlerts(),
      this.performanceService.getPerformanceSummary()
    ]);

    return {
      status: healthStatus,
      metrics: recentMetrics,
      alerts: activeAlerts,
      performance: performanceSummary,
      timestamp: new Date(),
      monitoring: {
        active: this.isMonitoring,
        uptime: process.uptime(),
        lastHealthCheck: new Date()
      }
    };
  }

  /**
   * Stop monitoring (for graceful shutdown)
   */
  async stopMonitoring(): Promise<void> {
    this.logger.log('Stopping monitoring system...');

    if (this.metricCollectionInterval) {
      clearInterval(this.metricCollectionInterval);
      this.metricCollectionInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.isMonitoring = false;
    this.logger.log('Monitoring system stopped');
  }

  /**
   * Cleanup old metrics (runs daily)
   */
  @Cron('0 2 * * *') // Run at 2 AM daily
  async cleanupOldMetrics(): Promise<void> {
    try {
      const deletedDays = 30; // Keep metrics for 30 days
      const result = await this.metricsService.cleanupOldMetrics(deletedDays);
      this.logger.log(`Cleaned up ${result} old metrics older than ${deletedDays} days`);
    } catch (error) {
      this.logger.error('Error cleaning up old metrics:', error);
    }
  }
}
