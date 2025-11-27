import { Injectable, Logger, OnModuleInit, OnModuleDestroy, forwardRef, Inject } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import {
  QualityMetrics,
  QualityScoreBreakdown,
  AdaptiveThresholds,
  ConnectionQualityAlert,
  ConnectionHealthMetrics,
  PollingFallbackConfig,
  MonitoringConfig,
  BandwidthMetrics,
  SyncPerformanceMetrics
} from '../interfaces/differential-sync.interface';
import { EventEmitter } from 'events';
import { DifferentialSyncService } from './differential-sync.service';
import { WebSocketMetricsResponseDto, SystemBandwidthDto, ClientBandwidthDto, QualityMetricsSummaryDto, ErrorRateDto } from '../dto/metrics.dto';

@Injectable()
export class ConnectionQualityMonitorService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionQualityMonitorService.name);
  private readonly METRICS_KEY_PREFIX = 'connection:quality:';
  private readonly EVENTS_KEY_PREFIX = 'connection:events:';
  private readonly ALERTS_KEY_PREFIX = 'connection:alerts:';
  private readonly FALLBACK_KEY_PREFIX = 'connection:fallback:';
  private readonly HEALTH_KEY_PREFIX = 'system:health:';
  private readonly BANDWIDTH_TRACKING_PREFIX = 'connection:bandwidth:';

  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private readonly QUALITY_WEIGHTS = {
    latency: 0.35,
    packetLoss: 0.25,
    jitter: 0.20,
    connectionStability: 0.20,
  };

  private readonly MONITORING_CONFIG: MonitoringConfig = {
    pingInterval: 30000,
    healthCheckInterval: 60000,
    metricsRetentionPeriod: 3600000, // 1 hour
    alertThresholds: {
      latencyCritical: 200, // Updated for sub-100ms target
      latencyWarning: 100, // Updated for sub-100ms target
      packetLossCritical: 0.1,
      packetLossWarning: 0.05,
      qualityScoreCritical: 30,
      qualityScoreWarning: 60,
    },
    adaptiveMonitoring: {
      enabled: true,
      qualityBasedAdjustment: true,
      loadBasedAdjustment: true,
    },
  };

  private readonly POLLING_FALLBACK_CONFIG: PollingFallbackConfig = {
    enabled: true,
    interval: 5000,
    maxRetries: 3,
    backoffMultiplier: 2,
    qualityThreshold: 60,
    autoRecovery: true,
    recoveryCheckInterval: 30000,
  };

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => DifferentialSyncService))
    private readonly differentialSyncService: DifferentialSyncService,
  ) {
    super();
    this.loadConfiguration();
  }

  async onModuleInit() {
    this.logger.log('Initializing Connection Quality Monitor Service');
    await this.startHealthMonitoring();
    await this.startMetricsCleanup();
    this.logger.log('Connection Quality Monitor Service initialized');
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Connection Quality Monitor Service');
    await this.stopHealthMonitoring();
    await this.stopMetricsCleanup();
    this.removeAllListeners();
    this.logger.log('Connection Quality Monitor Service shut down');
  }

  private loadConfiguration() {
    // Load configuration from environment variables
    this.QUALITY_WEIGHTS.latency = parseFloat(
      process.env.WS_QUALITY_WEIGHT_LATENCY || '0.35'
    );
    this.QUALITY_WEIGHTS.packetLoss = parseFloat(
      process.env.WS_QUALITY_WEIGHT_PACKET_LOSS || '0.25'
    );
    this.QUALITY_WEIGHTS.jitter = parseFloat(
      process.env.WS_QUALITY_WEIGHT_JITTER || '0.20'
    );
    this.QUALITY_WEIGHTS.connectionStability = parseFloat(
      process.env.WS_QUALITY_WEIGHT_STABILITY || '0.20'
    );

    this.MONITORING_CONFIG.pingInterval = parseInt(
      process.env.WS_MONITORING_PING_INTERVAL || '30000'
    );
    this.MONITORING_CONFIG.healthCheckInterval = parseInt(
      process.env.WS_HEALTH_CHECK_INTERVAL || '60000'
    );

    // Load alert thresholds from environment variables with sub-100ms target alignment
    this.MONITORING_CONFIG.alertThresholds.latencyCritical = parseInt(
      process.env.WS_LATENCY_CRITICAL_MS || '200'
    );
    this.MONITORING_CONFIG.alertThresholds.latencyWarning = parseInt(
      process.env.WS_LATENCY_WARNING_MS || '100'
    );

    // Validate quality weights sum to 1.0
    const totalWeight = Object.values(this.QUALITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(`Quality weights must sum to 1.0, got ${totalWeight}`);
    }

    this.logger.debug('Configuration loaded', {
      qualityWeights: this.QUALITY_WEIGHTS,
      monitoringConfig: this.MONITORING_CONFIG,
    });
  }

  /**
   * Record latency measurement for a client with sub-100ms tracking
   */
  async recordLatency(clientId: string, latency: number): Promise<void> {
    try {
      const key = `${this.METRICS_KEY_PREFIX}${clientId}`;
      const timestamp = Date.now();

      // Store latency measurement in Redis list for rolling window
      await this.redis.lpush(`${key}:latency`, JSON.stringify({ latency, timestamp }));
      await this.redis.ltrim(`${key}:latency`, 0, 199); // Keep last 200 measurements for better accuracy
      await this.redis.expire(`${key}:latency`, 600); // 10 minutes TTL

      // Track sub-100ms performance separately
      if (latency <= 100) {
        await this.redis.lpush(`${key}:sub100ms`, JSON.stringify({ latency, timestamp }));
        await this.redis.ltrim(`${key}:sub100ms`, 0, 99);
        await this.redis.expire(`${key}:sub100ms`, 600);
      }

      // Check for latency spikes and trigger alerts if needed
      await this.checkLatencyThresholds(clientId, latency);

      // Update current metrics
      const updatedMetrics = await this.updateQualityMetrics(clientId);

      // Emit events for real-time monitoring
      if (updatedMetrics) {
        this.emit('qualityUpdated', { clientId, metrics: updatedMetrics });

        // Check if adaptive monitoring adjustment is needed
        if (this.MONITORING_CONFIG.adaptiveMonitoring.qualityBasedAdjustment) {
          await this.adjustMonitoringInterval(clientId, updatedMetrics.qualityScore);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to record latency for client ${clientId}:`, error);
    }
  }

  /**
   * Check latency thresholds and trigger alerts
   */
  private async checkLatencyThresholds(clientId: string, latency: number): Promise<void> {
    const config = this.MONITORING_CONFIG.alertThresholds;

    if (latency >= config.latencyCritical) {
      await this.createAlert(clientId, 'latency_spike', 'critical',
        `Critical latency detected: ${latency}ms`, { latency });
    } else if (latency >= config.latencyWarning) {
      await this.createAlert(clientId, 'latency_spike', 'warning',
        `High latency detected: ${latency}ms`, { latency });
    }
  }

  /**
   * Record packet loss event
   */
  async recordPacketLoss(clientId: string): Promise<void> {
    try {
      const key = `${this.METRICS_KEY_PREFIX}${clientId}`;
      const timestamp = Date.now();

      await this.redis.lpush(`${key}:packetLoss`, JSON.stringify({ timestamp }));
      await this.redis.ltrim(`${key}:packetLoss`, 0, 49); // Keep last 50 events
      await this.redis.expire(`${key}:packetLoss`, 300);

      await this.updateQualityMetrics(clientId);
    } catch (error) {
      this.logger.error(`Failed to record packet loss for client ${clientId}:`, error);
    }
  }

  /**
   * Calculate jitter from latency measurements
   */
  async calculateJitter(clientId: string): Promise<number> {
    try {
      const latencyData = await this.redis.lrange(`${this.METRICS_KEY_PREFIX}${clientId}:latency`, 0, 19); // Last 20 measurements

      if (latencyData.length < 2) return 0;

      const latencies = latencyData.map(data => JSON.parse(data).latency);

      // Calculate standard deviation of latency differences
      const differences = [];
      for (let i = 1; i < latencies.length; i++) {
        differences.push(Math.abs(latencies[i] - latencies[i - 1]));
      }

      const mean = differences.reduce((sum, diff) => sum + diff, 0) / differences.length;
      const variance = differences.reduce((sum, diff) => sum + Math.pow(diff - mean, 2), 0) / differences.length;

      return Math.sqrt(variance);
    } catch (error) {
      this.logger.error(`Failed to calculate jitter for client ${clientId}:`, error);
      return 0;
    }
  }

  /**
   * Update connection quality metrics for a client
   */
  async updateQualityMetrics(clientId: string): Promise<ConnectionQualityMetrics | null> {
    try {
      const key = `${this.METRICS_KEY_PREFIX}${clientId}`;

      // Get latency measurements
      const latencyData = await this.redis.lrange(`${key}:latency`, 0, 99);
      const latencies = latencyData.map(data => JSON.parse(data).latency);
      const avgLatency = latencies.length > 0 ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0;

      // Get packet loss rate
      const packetLossData = await this.redis.lrange(`${key}:packetLoss`, 0, 49);
      const totalMeasurements = Math.max(latencyData.length, 1);
      const packetLossRate = packetLossData.length / totalMeasurements;

      // Calculate jitter
      const jitter = await this.calculateJitter(clientId);

      // Calculate connection stability (based on uptime and reconnection attempts)
      const connectionTime = await this.redis.hget(`${key}:connection`, 'connectedAt');
      const uptime = connectionTime ? Date.now() - parseInt(connectionTime) : 0;
      const reconnectionAttempts = parseInt(await this.redis.hget(`${key}:connection`, 'reconnections') || '0');
      const stability = uptime > 0 ? Math.max(0, 1 - (reconnectionAttempts / (uptime / 60000))) : 1; // Decay over minutes

      const metrics = {
        avgLatency,
        packetLoss: packetLossRate,
        jitter,
        connectionStability: stability,
      };

      const qualityScore = this.calculateQualityScore(metrics);

      // Get actual bandwidth utilization
      const bandwidthUtilizationData = await this.getBandwidthUtilization(clientId);

      const qualityMetrics: ConnectionQualityMetrics = {
        clientId,
        avgLatency,
        packetLoss: packetLossRate,
        jitter,
        bandwidthUtilization: bandwidthUtilizationData.utilizationPercentage,
        connectionStability: stability,
        qualityScore,
        lastUpdated: new Date(),
        usingPollingFallback: await this.shouldUsePollingFallback(qualityScore),
        fallbackReasons: [],
        reconnectionAttempts,
        uptime,
      };

      // Store metrics
      await this.redis.hset(key, {
        qualityScore: qualityScore.toString(),
        avgLatency: avgLatency.toString(),
        packetLoss: packetLossRate.toString(),
        jitter: jitter.toString(),
        connectionStability: stability.toString(),
        lastUpdated: Date.now().toString(),
        usingPollingFallback: qualityMetrics.usingPollingFallback.toString(),
        reconnectionAttempts: reconnectionAttempts.toString(),
        uptime: uptime.toString(),
      });

      await this.redis.expire(key, 300);

      return qualityMetrics;
    } catch (error) {
      this.logger.error(`Failed to update quality metrics for client ${clientId}:`, error);
      return null;
    }
  }

  /**
   * Get quality metrics for a client
   */
  async getQualityMetrics(clientId: string): Promise<ConnectionQualityMetrics | null> {
    try {
      const key = `${this.METRICS_KEY_PREFIX}${clientId}`;
      const metricsData = await this.redis.hgetall(key);

      if (!metricsData || !metricsData.qualityScore) return null;

      return {
        clientId,
        avgLatency: parseFloat(metricsData.avgLatency || '0'),
        packetLoss: parseFloat(metricsData.packetLoss || '0'),
        jitter: parseFloat(metricsData.jitter || '0'),
        bandwidthUtilization: parseFloat(metricsData.bandwidthUtilization || '0'),
        connectionStability: parseFloat(metricsData.connectionStability || '0'),
        qualityScore: parseFloat(metricsData.qualityScore),
        lastUpdated: new Date(parseInt(metricsData.lastUpdated || '0')),
        usingPollingFallback: metricsData.usingPollingFallback === 'true',
        fallbackReasons: JSON.parse(metricsData.fallbackReasons || '[]'),
        reconnectionAttempts: parseInt(metricsData.reconnectionAttempts || '0'),
        uptime: parseInt(metricsData.uptime || '0'),
      };
    } catch (error) {
      this.logger.error(`Failed to get quality metrics for client ${clientId}:`, error);
      return null;
    }
  }

  /**
   * Determine if client should use polling fallback with intelligent thresholds
   */
  async shouldUsePollingFallback(clientId: string): Promise<boolean> {
    try {
      const metrics = await this.getQualityMetrics(clientId);
      if (!metrics) return false;

      // Multi-factor fallback decision
      const adaptiveThresholds = await this.getAdaptiveThresholds(clientId);

      // Check quality score against adaptive threshold
      if (metrics.qualityScore < adaptiveThresholds.fallbackThreshold) {
        return true;
      }

      // Check for critical conditions that force fallback
      if (metrics.avgLatency > 200) return true; // High latency
      if (metrics.packetLoss > 0.1) return true; // High packet loss
      if (metrics.connectionStability < 0.5) return true; // Unstable connection

      // Check recent disconnection frequency
      const recentDisconnections = await this.getRecentDisconnectionCount(clientId);
      if (recentDisconnections > 3) return true;

      return false;
    } catch (error) {
      this.logger.error(`Failed to determine fallback status for client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Activate polling fallback for a client
   */
  async activatePollingFallback(clientId: string, reason: string): Promise<void> {
    try {
      if (!this.POLLING_FALLBACK_CONFIG.enabled) {
        this.logger.warn(`Polling fallback disabled for client ${clientId}`);
        return;
      }

      const fallbackKey = `${this.FALLBACK_KEY_PREFIX}${clientId}`;
      const fallbackData = {
        active: true,
        activatedAt: Date.now(),
        reason,
        interval: this.POLLING_FALLBACK_CONFIG.interval,
        retryCount: 0,
        lastAttempt: Date.now(),
      };

      await this.redis.hset(fallbackKey, fallbackData);
      await this.redis.expire(fallbackKey, 3600); // 1 hour TTL

      await this.createAlert(clientId, 'fallback_activated', 'medium',
        `Polling fallback activated: ${reason}`, { reason });

      // Record connection event
      await this.recordConnectionEvent(clientId, 'fallback_activated', reason);

      this.emit('fallbackActivated', { clientId, reason });

      this.logger.warn(`Activated polling fallback for client ${clientId}: ${reason}`);
    } catch (error) {
      this.logger.error(`Failed to activate polling fallback for client ${clientId}:`, error);
    }
  }

  /**
   * Deactivate polling fallback for a client
   */
  async deactivatePollingFallback(clientId: string): Promise<void> {
    try {
      const fallbackKey = `${this.FALLBACK_KEY_PREFIX}${clientId}`;
      await this.redis.del(fallbackKey);

      // Record recovery event
      await this.recordConnectionEvent(clientId, 'recovery', 'Connection quality improved');

      this.emit('fallbackDeactivated', { clientId });

      this.logger.log(`Deactivated polling fallback for client ${clientId}`);
    } catch (error) {
      this.logger.error(`Failed to deactivate polling fallback for client ${clientId}:`, error);
    }
  }

  /**
   * Clean up all client data including bandwidth tracking
   */
  async cleanupClientData(clientId: string): Promise<void> {
    try {
      if (!clientId) {
        this.logger.warn('Cannot cleanup client data: no clientId provided');
        return;
      }

      const keysToDelete = [
        `${this.METRICS_KEY_PREFIX}${clientId}`,
        `${this.METRICS_KEY_PREFIX}${clientId}:latency`,
        `${this.METRICS_KEY_PREFIX}${clientId}:packetLoss`,
        `${this.METRICS_KEY_PREFIX}${clientId}:connection`,
        `${this.METRICS_KEY_PREFIX}${clientId}:sub100ms`,
        `${this.METRICS_KEY_PREFIX}${clientId}:bandwidth:totals`,
        `${this.METRICS_KEY_PREFIX}${clientId}:bandwidth:metrics`,
        `${this.METRICS_KEY_PREFIX}${clientId}:sync:performance`,
        `${this.BANDWIDTH_TRACKING_PREFIX}${clientId}`,
        `${this.EVENTS_KEY_PREFIX}${clientId}`,
        `${this.FALLBACK_KEY_PREFIX}${clientId}`,
      ];

      // Use Redis pipeline for efficient deletion
      const pipeline = this.redis.pipeline();
      keysToDelete.forEach(key => pipeline.del(key));
      await pipeline.exec();

      this.logger.debug(`Cleaned up all data for client ${clientId}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup client data for ${clientId}:`, error);
    }
  }

  /**
   * Get adaptive thresholds for a client based on historical performance
   */
  async getAdaptiveThresholds(clientId: string): Promise<AdaptiveThresholds> {
    try {
      const metrics = await this.getQualityMetrics(clientId);
      const historicalPerformance = await this.getHistoricalPerformance(clientId);

      // Base thresholds
      let latencyThreshold = 100; // 100ms target
      let fallbackThreshold = 60;

      // Adjust based on historical performance
      if (historicalPerformance.avgLatency > 0) {
        // If client historically has higher latency, adjust threshold
        latencyThreshold = Math.max(50, historicalPerformance.avgLatency * 1.2);
      }

      if (metrics && metrics.qualityScore < 40) {
        // If current quality is poor, be more aggressive with fallback
        fallbackThreshold = 70;
      }

      return {
        latencyThreshold,
        packetLossThreshold: 0.05,
        jitterThreshold: 50,
        stabilityThreshold: 0.8,
        fallbackThreshold,
        recoveryThreshold: 80,
        adaptivePingInterval: {
          min: 10000,
          max: 60000,
          current: await this.calculateAdaptivePingInterval(clientId),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get adaptive thresholds for client ${clientId}:`, error);
      // Return default thresholds
      return {
        latencyThreshold: 100,
        packetLossThreshold: 0.05,
        jitterThreshold: 50,
        stabilityThreshold: 0.8,
        fallbackThreshold: 60,
        recoveryThreshold: 80,
        adaptivePingInterval: {
          min: 10000,
          max: 60000,
          current: 30000,
        },
      };
    }
  }

  /**
   * Record connection event
   */
  async recordConnectionEvent(clientId: string, eventType: ConnectionEvent['eventType'], reason?: string): Promise<void> {
    try {
      const event: ConnectionEvent = {
        clientId,
        eventType,
        timestamp: new Date(),
        metrics: {},
        reason,
      };

      const eventKey = `${this.EVENTS_KEY_PREFIX}${clientId}`;
      await this.redis.lpush(eventKey, JSON.stringify(event));
      await this.redis.ltrim(eventKey, 0, 99); // Keep last 100 events
      await this.redis.expire(eventKey, 3600);

      // Update connection-specific data
      const connectionKey = `${this.METRICS_KEY_PREFIX}${clientId}:connection`;
      if (eventType === 'connect') {
        await this.redis.hset(connectionKey, 'connectedAt', Date.now().toString());
        await this.redis.expire(connectionKey, 86400);
      } else if (eventType === 'disconnect') {
        const currentReconnections = parseInt(await this.redis.hget(connectionKey, 'reconnections') || '0');
        await this.redis.hset(connectionKey, 'reconnections', (currentReconnections + 1).toString());
      }

      await this.handleConnectionEvent(event);
    } catch (error) {
      this.logger.error(`Failed to record connection event for client ${clientId}:`, error);
    }
  }

  /**
   * Record bandwidth metrics for a connection
   */
  async recordBandwidthUsage(clientId: string, bytesSent: number, bytesReceived: number): Promise<void> {
    try {
      const timestamp = Date.now();
      const bandwidthKey = `${this.BANDWIDTH_TRACKING_PREFIX}${clientId}`;

      // Record individual bandwidth event
      const bandwidthEvent = {
        timestamp,
        bytesSent,
        bytesReceived,
        totalBytes: bytesSent + bytesReceived,
      };

      await this.redis.lpush(bandwidthKey, JSON.stringify(bandwidthEvent));
      await this.redis.ltrim(bandwidthKey, 0, 999); // Keep last 1000 events
      await this.redis.expire(bandwidthKey, 3600); // 1 hour TTL

      // Update running totals for the connection
      const totalsKey = `${this.METRICS_KEY_PREFIX}${clientId}:bandwidth:totals`;
      const pipeline = this.redis.pipeline();

      pipeline.hincrby(totalsKey, 'totalBytesSent', bytesSent);
      pipeline.hincrby(totalsKey, 'totalBytesReceived', bytesReceived);
      pipeline.hincrby(totalsKey, 'totalBytesTransferred', bytesSent + bytesReceived);
      pipeline.hincrby(totalsKey, 'messageCount', 1);
      pipeline.hset(totalsKey, 'lastActivity', timestamp.toString());
      pipeline.expire(totalsKey, 86400); // 24 hours TTL

      await pipeline.exec();

      // Calculate and update bandwidth utilization
      await this.updateBandwidthUtilization(clientId);

      this.logger.debug(`Recorded bandwidth usage for client ${clientId}: sent=${bytesSent}, received=${bytesReceived}`);
    } catch (error) {
      this.logger.error(`Failed to record bandwidth usage for client ${clientId}:`, error);
    }
  }

  /**
   * Calculate and update bandwidth utilization for a client
   */
  private async updateBandwidthUtilization(clientId: string): Promise<void> {
    try {
      const totalsKey = `${this.METRICS_KEY_PREFIX}${clientId}:bandwidth:totals`;
      const connectionKey = `${this.METRICS_KEY_PREFIX}${clientId}:connection`;

      const [totalsData, connectionData] = await Promise.all([
        this.redis.hgetall(totalsKey),
        this.redis.hgetall(connectionKey)
      ]);

      if (!totalsData || !connectionData) {
        return;
      }

      const totalBytesTransferred = parseInt(totalsData.totalBytesTransferred || '0');
      const connectedAt = parseInt(connectionData.connectedAt || '0');
      const currentTime = Date.now();
      const connectionDuration = currentTime - connectedAt; // in milliseconds

      if (connectionDuration <= 0) {
        return;
      }

      // Calculate bytes per second
      const bytesPerSecond = (totalBytesTransferred / connectionDuration) * 1000;

      // Convert to kilobits per second (kbps) for better readability
      const kbps = (bytesPerSecond * 8) / 1024;

      // Calculate utilization percentage (assuming 10 Mbps max connection)
      const maxConnectionKbps = 10000; // 10 Mbps
      const utilizationPercentage = Math.min(100, (kbps / maxConnectionKbps) * 100);

      // Update the quality metrics with bandwidth utilization
      const metricsKey = `${this.METRICS_KEY_PREFIX}${clientId}`;
      await this.redis.hset(metricsKey, 'bandwidthUtilization', utilizationPercentage.toString());

      // Store detailed bandwidth metrics
      const bandwidthMetricsKey = `${this.METRICS_KEY_PREFIX}${clientId}:bandwidth:metrics`;
      await this.redis.hset(bandwidthMetricsKey, {
        bytesPerSecond: bytesPerSecond.toFixed(2),
        kbps: kbps.toFixed(2),
        utilizationPercentage: utilizationPercentage.toFixed(2),
        totalBytesTransferred: totalBytesTransferred.toString(),
        connectionDuration: connectionDuration.toString(),
        messageCount: totalsData.messageCount || '0',
        lastCalculated: currentTime.toString(),
      });
      await this.redis.expire(bandwidthMetricsKey, 3600);

    } catch (error) {
      this.logger.error(`Failed to update bandwidth utilization for client ${clientId}:`, error);
    }
  }

  /**
   * Get bandwidth utilization metrics for a client
   */
  async getBandwidthUtilization(clientId: string): Promise<{
    bytesPerSecond: number;
    kbps: number;
    utilizationPercentage: number;
    totalBytesTransferred: number;
    totalBytesSent: number;
    totalBytesReceived: number;
    messageCount: number;
    connectionDuration: number;
  }> {
    try {
      const totalsKey = `${this.METRICS_KEY_PREFIX}${clientId}:bandwidth:totals`;
      const metricsKey = `${this.METRICS_KEY_PREFIX}${clientId}:bandwidth:metrics`;
      const connectionKey = `${this.METRICS_KEY_PREFIX}${clientId}:connection`;

      const [totalsData, metricsData, connectionData] = await Promise.all([
        this.redis.hgetall(totalsKey),
        this.redis.hgetall(metricsKey),
        this.redis.hgetall(connectionKey)
      ]);

      const connectedAt = parseInt(connectionData?.connectedAt || '0');
      const connectionDuration = connectedAt > 0 ? Date.now() - connectedAt : 0;

      return {
        bytesPerSecond: parseFloat(metricsData?.bytesPerSecond || '0'),
        kbps: parseFloat(metricsData?.kbps || '0'),
        utilizationPercentage: parseFloat(metricsData?.utilizationPercentage || '0'),
        totalBytesTransferred: parseInt(totalsData?.totalBytesTransferred || '0'),
        totalBytesSent: parseInt(totalsData?.totalBytesSent || '0'),
        totalBytesReceived: parseInt(totalsData?.totalBytesReceived || '0'),
        messageCount: parseInt(totalsData?.messageCount || '0'),
        connectionDuration,
      };
    } catch (error) {
      this.logger.error(`Failed to get bandwidth utilization for client ${clientId}:`, error);
      return {
        bytesPerSecond: 0,
        kbps: 0,
        utilizationPercentage: 0,
        totalBytesTransferred: 0,
        totalBytesSent: 0,
        totalBytesReceived: 0,
        messageCount: 0,
        connectionDuration: 0,
      };
    }
  }

  /**
   * Get system-wide bandwidth metrics
   */
  async getSystemBandwidthMetrics(): Promise<{
    totalBytesTransferred: number;
    totalBytesSent: number;
    totalBytesReceived: number;
    averageUtilization: number;
    totalConnections: number;
    totalMessages: number;
  }> {
    try {
      const clientKeys = await this.getClientKeys();

      let totalBytesTransferred = 0;
      let totalBytesSent = 0;
      let totalBytesReceived = 0;
      let totalUtilization = 0;
      let totalConnections = 0;
      let totalMessages = 0;

      for (const key of clientKeys) {
        const clientId = key.replace(this.METRICS_KEY_PREFIX, '');
        const bandwidthMetrics = await this.getBandwidthUtilization(clientId);

        totalBytesTransferred += bandwidthMetrics.totalBytesTransferred;
        totalBytesSent += bandwidthMetrics.totalBytesSent;
        totalBytesReceived += bandwidthMetrics.totalBytesReceived;
        totalUtilization += bandwidthMetrics.utilizationPercentage;
        totalMessages += bandwidthMetrics.messageCount;

        if (bandwidthMetrics.connectionDuration > 0) {
          totalConnections++;
        }
      }

      const averageUtilization = totalConnections > 0 ? totalUtilization / totalConnections : 0;

      return {
        totalBytesTransferred,
        totalBytesSent,
        totalBytesReceived,
        averageUtilization: parseFloat(averageUtilization.toFixed(2)),
        totalConnections,
        totalMessages,
      };
    } catch (error) {
      this.logger.error('Failed to get system bandwidth metrics:', error);
      return {
        totalBytesTransferred: 0,
        totalBytesSent: 0,
        totalBytesReceived: 0,
        averageUtilization: 0,
        totalConnections: 0,
        totalMessages: 0,
      };
    }
  }

  /**
   * Expose bandwidth metrics via /websocket/metrics endpoint
   */
  async getWebSocketMetrics(): Promise<Omit<WebSocketMetricsResponseDto, 'timestamp'>> {
    try {
      // Get system bandwidth metrics
      const systemBandwidth = await this.getSystemBandwidthMetrics();

      // Get per-client bandwidth metrics
      const clientKeys = await this.getClientKeys();
      const clientBandwidthMetrics: ClientBandwidthDto[] = [];

      for (const key of clientKeys) {
        const clientId = key.replace(this.METRICS_KEY_PREFIX, '');
        const bandwidthUtilization = await this.getBandwidthUtilization(clientId);

        if (bandwidthUtilization.totalBytesTransferred > 0) {
          clientBandwidthMetrics.push({
            clientId,
            utilization: bandwidthUtilization,
          });
        }
      }

      // Get quality metrics
      const systemHealth = await this.getSystemHealthMetrics();
      const sub100msPercentage = await this.getSub100msLatencyPercentage();

      // Get error rates from differential sync service
      // getAllClientsErrorStats() is intentionally synchronous - it operates on in-memory data only
      // and does not perform any I/O operations, making it safe to call without await
      let errorRates: ErrorRateDto[] = [];
      try {
        const allClientErrorStats = this.differentialSyncService.getAllClientsErrorStats();
        errorRates = allClientErrorStats.map(stat => ({
          clientId: stat.clientId,
          errorRate: stat.errorRate,
          totalOperations: stat.totalOperations,
          errorCount: stat.errorCount,
          lastSyncTime: stat.lastSyncTime
        }));
        this.logger.debug(`Retrieved error rates for ${errorRates.length} clients`);
      } catch (error) {
        this.logger.warn('Failed to get error rates from differential sync service:', error);
        errorRates = [];
      }

      return {
        bandwidth: {
          system: systemBandwidth as SystemBandwidthDto,
          clients: clientBandwidthMetrics,
        },
        errorRates,
        quality: {
          averageScore: systemHealth.averageQualityScore,
          sub100msPercentage,
        } as QualityMetricsSummaryDto,
      };
    } catch (error) {
      this.logger.error('Failed to get WebSocket metrics:', error);
      return {
        bandwidth: {
          system: {
            totalBytesTransferred: 0,
            totalBytesSent: 0,
            totalBytesReceived: 0,
            averageUtilization: 0,
            totalConnections: 0,
            totalMessages: 0,
          } as SystemBandwidthDto,
          clients: [],
        },
        errorRates: [],
        quality: {
          averageScore: 0,
          sub100msPercentage: 0,
        } as QualityMetricsSummaryDto,
      };
    }
  }

  /**
   * Get enhanced system-wide health metrics for admin dashboard
   */
  async getSystemHealthMetrics(): Promise<ConnectionHealthMetrics> {
    try {
      // Get all client keys efficiently
      const clientKeys = await this.getClientKeys();

      if (clientKeys.length === 0) {
        return {
          totalConnections: 0,
          activeConnections: 0,
          averageQualityScore: 0,
          connectionsInFallback: 0,
          averageLatency: 0,
          packetLossRate: 0,
          systemLoad: 0,
          memoryUsage: 0,
          uptime: process.uptime(),
        };
      }

      // Batch get metrics for efficiency
      const metricsPipeline = this.redis.pipeline();
      for (const key of clientKeys) {
        metricsPipeline.hgetall(key);
      }
      const results = await metricsPipeline.exec();

      let totalQualityScore = 0;
      let totalLatency = 0;
      let totalPacketLoss = 0;
      let connectionsInFallback = 0;
      let activeConnections = 0;
      let validMetricsCount = 0;

      for (const [err, metrics] of results || []) {
        if (!err && metrics && metrics.qualityScore) {
          totalQualityScore += parseFloat(metrics.qualityScore);
          totalLatency += parseFloat(metrics.avgLatency || '0');
          totalPacketLoss += parseFloat(metrics.packetLoss || '0');
          if (metrics.usingPollingFallback === 'true') {
            connectionsInFallback++;
          }

          // Check if connection is active (updated within last 2 minutes)
          const lastUpdated = parseInt(metrics.lastUpdated || '0');
          if (Date.now() - lastUpdated < 120000) {
            activeConnections++;
          }

          validMetricsCount++;
        }
      }

      // Get system load metrics
      const systemLoad = process.cpuUsage().user / 1000000; // Convert to seconds
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // Convert to MB

      const avgQualityScore = validMetricsCount > 0 ? totalQualityScore / validMetricsCount : 0;
      const avgLatency = validMetricsCount > 0 ? totalLatency / validMetricsCount : 0;
      const packetLossRate = validMetricsCount > 0 ? totalPacketLoss / validMetricsCount : 0;

      return {
        totalConnections: clientKeys.length,
        activeConnections,
        averageQualityScore: avgQualityScore,
        connectionsInFallback,
        averageLatency: avgLatency,
        packetLossRate,
        systemLoad,
        memoryUsage,
        uptime: process.uptime(),
      };
    } catch (error) {
      this.logger.error('Failed to get system health metrics:', error);
      return {
        totalConnections: 0,
        activeConnections: 0,
        averageQualityScore: 0,
        connectionsInFallback: 0,
        averageLatency: 0,
        packetLossRate: 0,
        systemLoad: 0,
        memoryUsage: 0,
        uptime: process.uptime(),
      };
    }
  }

  /**
   * Get client keys efficiently using SCAN instead of KEYS
   */
  private async getClientKeys(): Promise<string[]> {
    const clientKeys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', `${this.METRICS_KEY_PREFIX}*`, 'COUNT', 100);
      cursor = nextCursor;

      // Filter out sub-keys (latency, packetLoss, etc.)
      const filteredKeys = keys.filter(key =>
        !key.includes(':latency') &&
        !key.includes(':packetLoss') &&
        !key.includes(':connection') &&
        !key.includes(':sub100ms')
      );

      clientKeys.push(...filteredKeys);
    } while (cursor !== '0');

    return clientKeys;
  }

  private calculateQualityScore(metrics: {
    avgLatency: number;
    packetLoss: number;
    jitter: number;
    connectionStability: number;
  }): number {
    const breakdown = this.getQualityScoreBreakdown(metrics);
    return breakdown.overallScore;
  }

  getQualityScoreBreakdown(metrics: {
    avgLatency: number;
    packetLoss: number;
    jitter: number;
    connectionStability: number;
  }): QualityScoreBreakdown {
    // Get tiered thresholds
    const latencyExcellent = this.configService.get<number>('WS_LATENCY_EXCELLENT_MS', 50);
    const latencyGood = this.configService.get<number>('WS_LATENCY_GOOD_MS', 100);
    const latencyPoor = this.configService.get<number>('WS_LATENCY_POOR_MS', 200);

    // Calculate individual metric scores (0-100 scale)
    let latencyScore: number;
    if (metrics.avgLatency <= latencyExcellent) {
      latencyScore = 100;
    } else if (metrics.avgLatency <= latencyGood) {
      latencyScore = 80; // Good
    } else if (metrics.avgLatency <= latencyPoor) {
      latencyScore = 60; // Acceptable
    } else {
      // Linear penalty for poor latency
      latencyScore = Math.max(0, 40 - (metrics.avgLatency - latencyPoor) / 10);
    }

    // Packet loss score: 100 - (packetLoss * 2000), clamped to 0-100
    const packetLossScore = Math.max(0, Math.min(100, 100 - (metrics.packetLoss * 2000)));

    // Jitter score (similar tiered approach as latency)
    const jitterExcellent = this.configService.get<number>('WS_JITTER_EXCELLENT_MS', 20);
    const jitterGood = this.configService.get<number>('WS_JITTER_GOOD_MS', 50);
    const jitterPoor = this.configService.get<number>('WS_JITTER_POOR_MS', 100);

    let jitterScore: number;
    if (metrics.jitter <= jitterExcellent) {
      jitterScore = 100;
    } else if (metrics.jitter <= jitterGood) {
      jitterScore = 80;
    } else if (metrics.jitter <= jitterPoor) {
      jitterScore = 60;
    } else {
      jitterScore = Math.max(0, 40 - (metrics.jitter - jitterPoor) / 10);
    }

    // Stability score is already 0-1 range, convert to 0-100
    const stabilityScore = metrics.connectionStability * 100;

    // Apply weighted formula
    const overallScore =
      (this.QUALITY_WEIGHTS.latency * latencyScore) +
      (this.QUALITY_WEIGHTS.packetLoss * packetLossScore) +
      (this.QUALITY_WEIGHTS.jitter * jitterScore) +
      (this.QUALITY_WEIGHTS.connectionStability * stabilityScore);

    return {
      latencyScore,
      latencyWeight: this.QUALITY_WEIGHTS.latency,
      packetLossScore,
      packetLossWeight: this.QUALITY_WEIGHTS.packetLoss,
      jitterScore,
      jitterWeight: this.QUALITY_WEIGHTS.jitter,
      stabilityScore,
      stabilityWeight: this.QUALITY_WEIGHTS.connectionStability,
      overallScore: Math.max(0, Math.min(100, overallScore)),
    };
  }

  private async handleConnectionEvent(event: ConnectionEvent): Promise<void> {
    try {
      switch (event.eventType) {
        case 'connect':
          await this.onClientConnect(event.clientId);
          break;
        case 'disconnect':
          await this.onClientDisconnect(event.clientId);
          break;
        case 'latency_spike':
          await this.onLatencySpike(event.clientId);
          break;
        case 'packet_loss':
          await this.onPacketLoss(event.clientId);
          break;
        case 'recovery':
          await this.onConnectionRecovery(event.clientId);
          break;
        case 'fallback_activated':
          await this.onFallbackActivated(event.clientId, event.reason);
          break;
      }
    } catch (error) {
      this.logger.error(`Failed to handle connection event for client ${event.clientId}:`, error);
    }
  }

  private async onClientConnect(clientId: string): Promise<void> {
    this.logger.debug(`Client ${clientId} connected`);
  }

  private async onClientDisconnect(clientId: string): Promise<void> {
    this.logger.debug(`Client ${clientId} disconnected`);
  }

  private async onLatencySpike(clientId: string): Promise<void> {
    this.logger.warn(`Latency spike detected for client ${clientId}`);
    await this.updateQualityMetrics(clientId);
  }

  private async onPacketLoss(clientId: string): Promise<void> {
    this.logger.warn(`Packet loss detected for client ${clientId}`);
    await this.updateQualityMetrics(clientId);
  }

  private async onConnectionRecovery(clientId: string): Promise<void> {
    this.logger.debug(`Connection recovered for client ${clientId}`);
    await this.updateQualityMetrics(clientId);
  }

  private async onFallbackActivated(clientId: string, reason?: string): Promise<void> {
    this.logger.warn(`Polling fallback activated for client ${clientId}, reason: ${reason}`);

    const metrics = await this.getQualityMetrics(clientId);
    if (metrics && reason) {
      const updatedReasons = [...metrics.fallbackReasons, reason];
      // Store updated reasons
      await this.redis.hset(
        `${this.METRICS_KEY_PREFIX}${clientId}`,
        'fallbackReasons',
        JSON.stringify(updatedReasons)
      );
    }
  }

  /**
   * Calculate adaptive ping interval based on connection quality
   */
  private async calculateAdaptivePingInterval(clientId: string): Promise<number> {
    try {
      const metrics = await this.getQualityMetrics(clientId);
      if (!metrics) return this.MONITORING_CONFIG.pingInterval;

      // Adaptive interval based on quality score
      if (metrics.qualityScore >= 80) {
        // Excellent connection - reduce ping frequency
        return Math.max(10000, this.MONITORING_CONFIG.pingInterval * 0.5);
      } else if (metrics.qualityScore >= 60) {
        // Good connection - normal ping frequency
        return this.MONITORING_CONFIG.pingInterval;
      } else if (metrics.qualityScore >= 40) {
        // Poor connection - increase ping frequency for better monitoring
        return Math.min(60000, this.MONITORING_CONFIG.pingInterval * 1.5);
      } else {
        // Very poor connection - frequent monitoring
        return Math.min(30000, this.MONITORING_CONFIG.pingInterval * 2);
      }
    } catch (error) {
      this.logger.error(`Failed to calculate adaptive ping interval for client ${clientId}:`, error);
      return this.MONITORING_CONFIG.pingInterval;
    }
  }

  /**
   * Adjust monitoring interval based on connection quality
   */
  private async adjustMonitoringInterval(clientId: string, qualityScore: number): Promise<void> {
    try {
      const adaptiveInterval = await this.calculateAdaptivePingInterval(clientId);
      const monitoringKey = `${this.METRICS_KEY_PREFIX}${clientId}:monitoring`;

      await this.redis.hset(monitoringKey, {
        adaptiveInterval: adaptiveInterval.toString(),
        lastAdjustment: Date.now().toString(),
        qualityScore: qualityScore.toString(),
      });

      await this.redis.expire(monitoringKey, 3600);
    } catch (error) {
      this.logger.error(`Failed to adjust monitoring interval for client ${clientId}:`, error);
    }
  }

  /**
   * Create and store connection quality alerts
   */
  private async createAlert(
    clientId: string,
    alertType: ConnectionQualityAlert['alertType'],
    severity: ConnectionQualityAlert['severity'],
    message: string,
    metrics: Partial<QualityMetrics>
  ): Promise<void> {
    try {
      const alert: ConnectionQualityAlert = {
        clientId,
        alertType,
        severity,
        message,
        metrics,
        timestamp: new Date(),
        resolved: false,
      };

      const alertKey = `${this.ALERTS_KEY_PREFIX}${clientId}:${Date.now()}`;
      await this.redis.hset(alertKey, {
        clientId: alert.clientId,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        metrics: JSON.stringify(alert.metrics),
        timestamp: alert.timestamp.getTime().toString(),
        resolved: alert.resolved.toString(),
      });

      await this.redis.expire(alertKey, 86400); // Keep alerts for 24 hours

      // Emit alert event
      this.emit('alert', alert);

      // Store in system-wide alerts for monitoring
      await this.redis.lpush(`${this.ALERTS_KEY_PREFIX}system`, JSON.stringify(alert));
      await this.redis.ltrim(`${this.ALERTS_KEY_PREFIX}system`, 0, 999); // Keep last 1000 alerts
      await this.redis.expire(`${this.ALERTS_KEY_PREFIX}system`, 86400);
    } catch (error) {
      this.logger.error(`Failed to create alert for client ${clientId}:`, error);
    }
  }

  /**
   * Get recent alerts for monitoring dashboard
   */
  async getRecentAlerts(limit: number = 100): Promise<ConnectionQualityAlert[]> {
    try {
      const alertData = await this.redis.lrange(`${this.ALERTS_KEY_PREFIX}system`, 0, limit - 1);
      return alertData.map(data => JSON.parse(data));
    } catch (error) {
      this.logger.error('Failed to get recent alerts:', error);
      return [];
    }
  }

  /**
   * Get historical performance metrics for a client
   */
  private async getHistoricalPerformance(clientId: string): Promise<{
    avgLatency: number;
    avgQualityScore: number;
    totalDisconnections: number;
  }> {
    try {
      const key = `${this.METRICS_KEY_PREFIX}${clientId}`;

      // Get historical data from Redis
      const latencyData = await this.redis.lrange(`${key}:latency`, 0, -1);
      const eventsData = await this.redis.lrange(`${this.EVENTS_KEY_PREFIX}${clientId}`, 0, -1);

      let totalLatency = 0;
      let validLatencyCount = 0;
      let totalDisconnections = 0;

      // Process latency data
      for (const data of latencyData) {
        const parsed = JSON.parse(data);
        totalLatency += parsed.latency;
        validLatencyCount++;
      }

      // Process events to count disconnections
      for (const data of eventsData) {
        const event = JSON.parse(data);
        if (event.eventType === 'disconnect') {
          totalDisconnections++;
        }
      }

      const avgLatency = validLatencyCount > 0 ? totalLatency / validLatencyCount : 0;

      return {
        avgLatency,
        avgQualityScore: 0, // Would need to calculate from historical quality scores
        totalDisconnections,
      };
    } catch (error) {
      this.logger.error(`Failed to get historical performance for client ${clientId}:`, error);
      return {
        avgLatency: 0,
        avgQualityScore: 0,
        totalDisconnections: 0,
      };
    }
  }

  /**
   * Get recent disconnection count for a client
   */
  private async getRecentDisconnectionCount(clientId: string): Promise<number> {
    try {
      const eventsData = await this.redis.lrange(`${this.EVENTS_KEY_PREFIX}${clientId}`, 0, 49); // Last 50 events
      const recentTime = Date.now() - 300000; // Last 5 minutes

      let disconnectionCount = 0;
      for (const data of eventsData) {
        const event = JSON.parse(data);
        if (event.eventType === 'disconnect' && event.timestamp > recentTime) {
          disconnectionCount++;
        }
      }

      return disconnectionCount;
    } catch (error) {
      this.logger.error(`Failed to get recent disconnection count for client ${clientId}:`, error);
      return 0;
    }
  }

  /**
   * Start system health monitoring
   */
  private async startHealthMonitoring(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthMetrics = await this.getSystemHealthMetrics();
        this.emit('systemHealth', healthMetrics);

        // Check for system-wide issues
        if (healthMetrics.averageQualityScore < 40) {
          this.logger.warn('System-wide connection quality degraded', {
            averageQualityScore: healthMetrics.averageQualityScore,
            totalConnections: healthMetrics.totalConnections,
          });
        }

        // Store health metrics for trend analysis
        await this.redis.lpush(`${this.HEALTH_KEY_PREFIX}metrics`, JSON.stringify({
          ...healthMetrics,
          timestamp: Date.now(),
        }));
        await this.redis.ltrim(`${this.HEALTH_KEY_PREFIX}metrics`, 0, 287); // Keep 24 hours of data (every 5 minutes)
        await this.redis.expire(`${this.HEALTH_KEY_PREFIX}metrics`, 86400);
      } catch (error) {
        this.logger.error('Health monitoring failed:', error);
      }
    }, this.MONITORING_CONFIG.healthCheckInterval);
  }

  /**
   * Stop system health monitoring
   */
  private async stopHealthMonitoring(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Start periodic cleanup of old metrics
   */
  private async startMetricsCleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldMetrics();
      } catch (error) {
        this.logger.error('Metrics cleanup failed:', error);
      }
    }, 3600000); // 1 hour
  }

  /**
   * Stop periodic cleanup
   */
  private async stopMetricsCleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up old metrics and expired data
   */
  private async cleanupOldMetrics(): Promise<void> {
    try {
      const cutoffTime = Date.now() - this.MONITORING_CONFIG.metricsRetentionPeriod;
      let cleanedKeys = 0;

      // Clean up old alerts
      const alertKeys = await this.redis.keys(`${this.ALERTS_KEY_PREFIX}*`);
      for (const key of alertKeys) {
        const timestamp = await this.redis.hget(key, 'timestamp');
        if (timestamp && parseInt(timestamp) < cutoffTime) {
          await this.redis.del(key);
          cleanedKeys++;
        }
      }

      // Clean up old bandwidth tracking data
      const bandwidthKeys = await this.redis.keys(`${this.BANDWIDTH_TRACKING_PREFIX}*`);
      for (const key of bandwidthKeys) {
        const lastEvent = await this.redis.lindex(key, 0); // Get most recent event
        if (lastEvent) {
          const event = JSON.parse(lastEvent);
          if (event.timestamp < cutoffTime) {
            await this.redis.del(key);
            cleanedKeys++;
          }
        }
      }

      // Clean up old bandwidth totals
      const totalsKeys = await this.redis.keys(`${this.METRICS_KEY_PREFIX}*bandwidth:totals`);
      for (const key of totalsKeys) {
        const lastActivity = await this.redis.hget(key, 'lastActivity');
        if (lastActivity && parseInt(lastActivity) < cutoffTime) {
          await this.redis.del(key);
          cleanedKeys++;
        }
      }

      this.logger.debug(`Cleanup completed: removed ${cleanedKeys} expired keys`);
    } catch (error) {
      this.logger.error('Failed to cleanup old metrics:', error);
    }
  }

  /**
   * Get bandwidth metrics for a client
   */
  async getBandwidthMetrics(clientId: string, limit: number = 100): Promise<BandwidthMetrics[]> {
    try {
      const metricsData = await this.redis.lrange(`${this.METRICS_KEY_PREFIX}${clientId}:bandwidth`, 0, limit - 1);
      return metricsData.map(data => JSON.parse(data));
    } catch (error) {
      this.logger.error(`Failed to get bandwidth metrics for client ${clientId}:`, error);
      return [];
    }
  }

  /**
   * Record sync performance metrics
   */
  async recordSyncPerformanceMetrics(metrics: SyncPerformanceMetrics): Promise<void> {
    try {
      const key = `${this.METRICS_KEY_PREFIX}${metrics.clientId}:sync:performance`;
      await this.redis.lpush(key, JSON.stringify(metrics));
      await this.redis.ltrim(key, 0, 199); // Keep last 200 performance records
      await this.redis.expire(key, 3600); // 1 hour TTL

      // Emit performance event
      this.emit('syncPerformance', metrics);
    } catch (error) {
      this.logger.error(`Failed to record sync performance metrics for client ${metrics.clientId}:`, error);
    }
  }

  /**
   * Get performance statistics for a client
   */
  async getClientPerformanceStats(clientId: string): Promise<{
    avgSyncDuration: number;
    avgDeltaCount: number;
    avgBytesTransferred: number;
    totalSyncs: number;
  }> {
    try {
      const performanceData = await this.redis.lrange(`${this.METRICS_KEY_PREFIX}${clientId}:sync:performance`, 0, -1);

      if (performanceData.length === 0) {
        return {
          avgSyncDuration: 0,
          avgDeltaCount: 0,
          avgBytesTransferred: 0,
          totalSyncs: 0,
        };
      }

      let totalSyncDuration = 0;
      let totalDeltaCount = 0;
      let totalBytesTransferred = 0;

      for (const data of performanceData) {
        const metrics: SyncPerformanceMetrics = JSON.parse(data);
        totalSyncDuration += metrics.syncDuration;
        totalDeltaCount += metrics.deltaCount;
        totalBytesTransferred += metrics.bytesTransferred;
      }

      return {
        avgSyncDuration: totalSyncDuration / performanceData.length,
        avgDeltaCount: totalDeltaCount / performanceData.length,
        avgBytesTransferred: totalBytesTransferred / performanceData.length,
        totalSyncs: performanceData.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get performance stats for client ${clientId}:`, error);
      return {
        avgSyncDuration: 0,
        avgDeltaCount: 0,
        avgBytesTransferred: 0,
        totalSyncs: 0,
      };
    }
  }

  /**
   * Get all client metrics for admin dashboard
   */
  async getAllClientMetrics(): Promise<ConnectionQualityMetrics[]> {
    try {
      const clientKeys = await this.getClientKeys();
      const allMetrics: ConnectionQualityMetrics[] = [];

      for (const key of clientKeys) {
        const metricsData = await this.redis.hgetall(key);

        if (metricsData && metricsData.qualityScore) {
          const clientId = key.replace(this.METRICS_KEY_PREFIX, '');
          allMetrics.push({
            clientId,
            avgLatency: parseFloat(metricsData.avgLatency || '0'),
            packetLoss: parseFloat(metricsData.packetLoss || '0'),
            jitter: parseFloat(metricsData.jitter || '0'),
            bandwidthUtilization: parseFloat(metricsData.bandwidthUtilization || '0'),
            connectionStability: parseFloat(metricsData.connectionStability || '0'),
            qualityScore: parseFloat(metricsData.qualityScore),
            lastUpdated: new Date(parseInt(metricsData.lastUpdated || '0')),
            usingPollingFallback: metricsData.usingPollingFallback === 'true',
            fallbackReasons: JSON.parse(metricsData.fallbackReasons || '[]'),
            reconnectionAttempts: parseInt(metricsData.reconnectionAttempts || '0'),
            uptime: parseInt(metricsData.uptime || '0'),
          });
        }
      }

      return allMetrics;
    } catch (error) {
      this.logger.error('Failed to get all client metrics:', error);
      return [];
    }
  }

  /**
   * Get percentage of pings under 100ms across all clients
   */
  async getSub100msLatencyPercentage(): Promise<number> {
    try {
      const clientKeys = await this.getClientKeys();
      let totalSub100msCount = 0;
      let totalLatencyCount = 0;

      for (const key of clientKeys) {
        // Get latency data
        const latencyData = await this.redis.lrange(`${key}:latency`, 0, -1);
        const sub100msData = await this.redis.lrange(`${key}:sub100ms`, 0, -1);

        totalLatencyCount += latencyData.length;
        totalSub100msCount += sub100msData.length;
      }

      if (totalLatencyCount === 0) return 0;
      return Math.round((totalSub100msCount / totalLatencyCount) * 100);
    } catch (error) {
      this.logger.error('Failed to calculate sub-100ms latency percentage:', error);
      return 0;
    }
  }
}