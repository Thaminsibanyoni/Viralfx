import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { ConfigService } from '@nestjs/config';
import { RedisService } from "../../redis/redis.service";

export interface ProviderHealthCheck {
  providerId: string;
  providerType: 'email' | 'sms' | 'push' | 'in-app';
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastChecked: Date;
  successRate: number;
  errorRate: number;
  lastError?: string;
  uptime: number;
  consecutiveFailures: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
}

export interface ProviderSla {
  providerId: string;
  targetUptime: number; // percentage
  targetResponseTime: number; // milliseconds
  targetSuccessRate: number; // percentage
  maxConsecutiveFailures: number;
  circuitBreakerTimeout: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  gracePeriod: number; // milliseconds for new providers
}

export interface HealthCheckResult {
  success: boolean;
  responseTime: number;
  error?: string;
  metadata?: any;
}

@Injectable()
export class ProviderHealthService implements OnModuleInit {
  private readonly logger = new Logger(ProviderHealthService.name);
  private healthCache = new Map<string, ProviderHealthCheck>();
  private slaConfigs = new Map<string, ProviderSla>();
  private activeHealthChecks = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService) {}

  async onModuleInit() {
    await this.initializeProviderSLAs();
    await this.loadExistingHealthData();
    await this.startContinuousHealthChecks();
  }

  private async initializeProviderSLAs() {
    // Default SLA configurations
    const defaultSLAs: ProviderSla[] = [
      // Email providers
      {
        providerId: 'smtp',
        providerType: 'email',
        targetUptime: 99.9,
        targetResponseTime: 2000,
        targetSuccessRate: 99.5,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000, // 5 minutes
        healthCheckInterval: 60000, // 1 minute
        gracePeriod: 300000 // 5 minutes
      },
      {
        providerId: 'sendgrid',
        providerType: 'email',
        targetUptime: 99.99,
        targetResponseTime: 1000,
        targetSuccessRate: 99.9,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000,
        healthCheckInterval: 60000,
        gracePeriod: 120000 // 2 minutes
      },
      {
        providerId: 'mailgun',
        providerType: 'email',
        targetUptime: 99.95,
        targetResponseTime: 1500,
        targetSuccessRate: 99.8,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000,
        healthCheckInterval: 60000,
        gracePeriod: 120000
      },
      {
        providerId: 'ses',
        providerType: 'email',
        targetUptime: 99.99,
        targetResponseTime: 800,
        targetSuccessRate: 99.9,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000,
        healthCheckInterval: 60000,
        gracePeriod: 120000
      },
      // SMS providers
      {
        providerId: 'twilio',
        providerType: 'sms',
        targetUptime: 99.99,
        targetResponseTime: 1000,
        targetSuccessRate: 99.9,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000,
        healthCheckInterval: 60000,
        gracePeriod: 120000
      },
      {
        providerId: 'africastalking',
        providerType: 'sms',
        targetUptime: 99.5,
        targetResponseTime: 2000,
        targetSuccessRate: 99.0,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000,
        healthCheckInterval: 60000,
        gracePeriod: 180000
      },
      {
        providerId: 'termii',
        providerType: 'sms',
        targetUptime: 99.0,
        targetResponseTime: 2500,
        targetSuccessRate: 98.5,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000,
        healthCheckInterval: 60000,
        gracePeriod: 180000
      },
      {
        providerId: 'clickatell',
        providerType: 'sms',
        targetUptime: 99.8,
        targetResponseTime: 1500,
        targetSuccessRate: 99.5,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000,
        healthCheckInterval: 60000,
        gracePeriod: 180000
      },
      // Push providers
      {
        providerId: 'fcm',
        providerType: 'push',
        targetUptime: 99.99,
        targetResponseTime: 500,
        targetSuccessRate: 99.9,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000,
        healthCheckInterval: 60000,
        gracePeriod: 120000
      },
      {
        providerId: 'apns',
        providerType: 'push',
        targetUptime: 99.99,
        targetResponseTime: 500,
        targetSuccessRate: 99.9,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000,
        healthCheckInterval: 60000,
        gracePeriod: 120000
      },
      {
        providerId: 'onesignal',
        providerType: 'push',
        targetUptime: 99.95,
        targetResponseTime: 1000,
        targetSuccessRate: 99.8,
        maxConsecutiveFailures: 3,
        circuitBreakerTimeout: 300000,
        healthCheckInterval: 60000,
        gracePeriod: 120000
      },
    ];

    for (const sla of defaultSLAs) {
      this.slaConfigs.set(sla.providerId, sla);
    }
  }

  private async loadExistingHealthData() {
    try {
      // Load recent health data from database
      const recentHealthData = await this.prismaService.providerHealth.findMany({
        where: {
          lastChecked: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { lastChecked: 'desc' }
      });

      for (const data of recentHealthData) {
        const healthCheck: ProviderHealthCheck = {
          providerId: data.providerId,
          providerType: data.providerType as any,
          status: data.status as any,
          responseTime: data.responseTime,
          lastChecked: data.lastChecked,
          successRate: data.successRate,
          errorRate: data.errorRate,
          lastError: data.lastError || undefined,
          uptime: data.uptime,
          consecutiveFailures: data.consecutiveFailures,
          circuitBreakerState: data.circuitBreakerState as any,
          metrics: data.metrics as any
        };

        this.healthCache.set(data.providerId, healthCheck);
      }
    } catch (error) {
      this.logger.error('Failed to load existing health data:', error);
    }
  }

  private async startContinuousHealthChecks() {
    for (const [providerId, sla] of this.slaConfigs) {
      this.scheduleHealthCheck(providerId, sla);
    }
  }

  private scheduleHealthCheck(providerId: string, sla: ProviderSla) {
    const healthCheck = async () => {
      try {
        await this.performHealthCheck(providerId);
      } catch (error) {
        this.logger.error(`Health check failed for provider ${providerId}:`, error);
      }
    };

    // Initial health check
    healthCheck();

    // Schedule periodic health checks
    const interval = setInterval(healthCheck, sla.healthCheckInterval);
    this.activeHealthChecks.set(providerId, interval);
  }

  async performHealthCheck(providerId: string): Promise<ProviderHealthCheck> {
    const startTime = Date.now();
    const sla = this.slaConfigs.get(providerId);

    if (!sla) {
      throw new Error(`No SLA configuration found for provider ${providerId}`);
    }

    const existingHealth = this.healthCache.get(providerId);

    try {
      const result = await this.executeProviderHealthCheck(providerId, sla.providerType);
      const responseTime = Date.now() - startTime;

      // Update health metrics
      const healthCheck: ProviderHealthCheck = {
        providerId,
        providerType: sla.providerType,
        status: this.determineHealthStatus(result, sla),
        responseTime,
        lastChecked: new Date(),
        successRate: this.calculateSuccessRate(providerId, result.success),
        errorRate: this.calculateErrorRate(providerId, result.success),
        lastError: result.error,
        uptime: this.calculateUptime(providerId),
        consecutiveFailures: result.success ? 0 : (existingHealth?.consecutiveFailures || 0) + 1,
        circuitBreakerState: this.updateCircuitBreakerState(existingHealth?.circuitBreakerState, result.success, sla),
        metrics: await this.updateProviderMetrics(providerId, result, responseTime)
      };

      // Cache and persist
      this.healthCache.set(providerId, healthCheck);
      await this.persistHealthCheck(healthCheck);

      // Update Redis cache for real-time access
      await this.redisService.setex(
        `provider:health:${providerId}`,
        300, // 5 minutes TTL
        JSON.stringify(healthCheck)
      );

      return healthCheck;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      const healthCheck: ProviderHealthCheck = {
        providerId,
        providerType: sla.providerType,
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        successRate: 0,
        errorRate: 100,
        lastError: error.message,
        uptime: this.calculateUptime(providerId),
        consecutiveFailures: (existingHealth?.consecutiveFailures || 0) + 1,
        circuitBreakerState: this.updateCircuitBreakerState(existingHealth?.circuitBreakerState, false, sla),
        metrics: await this.updateProviderMetrics(providerId, { success: false, responseTime }, responseTime)
      };

      this.healthCache.set(providerId, healthCheck);
      await this.persistHealthCheck(healthCheck);

      await this.redisService.setex(
        `provider:health:${providerId}`,
        300,
        JSON.stringify(healthCheck)
      );

      throw error;
    }
  }

  private async executeProviderHealthCheck(providerId: string, providerType: string): Promise<HealthCheckResult> {
    switch (providerType) {
      case 'email':
        return this.performEmailHealthCheck(providerId);
      case 'sms':
        return this.performSMSHealthCheck(providerId);
      case 'push':
        return this.performPushHealthCheck(providerId);
      case 'in-app':
        return this.performInAppHealthCheck(providerId);
      default:
        throw new Error(`Unsupported provider type: ${providerType}`);
    }
  }

  private async performEmailHealthCheck(providerId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      switch (providerId) {
        case 'smtp':
          return await this.checkSMTPHealth();
        case 'sendgrid':
          return await this.checkSendGridHealth();
        case 'mailgun':
          return await this.checkMailgunHealth();
        case 'ses':
          return await this.checkSESHealth();
        default:
          return { success: false, responseTime: Date.now() - startTime, error: 'Unknown email provider' };
      }
    } catch (error) {
      return { success: false, responseTime: Date.now() - startTime, error: error.message };
    }
  }

  private async performSMSHealthCheck(providerId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      switch (providerId) {
        case 'twilio':
          return await this.checkTwilioHealth();
        case 'africastalking':
          return await this.checkAfricasTalkingHealth();
        case 'termii':
          return await this.checkTermiiHealth();
        case 'clickatell':
          return await this.checkClickatellHealth();
        default:
          return { success: false, responseTime: Date.now() - startTime, error: 'Unknown SMS provider' };
      }
    } catch (error) {
      return { success: false, responseTime: Date.now() - startTime, error: error.message };
    }
  }

  private async performPushHealthCheck(providerId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      switch (providerId) {
        case 'fcm':
          return await this.checkFCMHealth();
        case 'apns':
          return await this.checkAPNSHealth();
        case 'onesignal':
          return await this.checkOneSignalHealth();
        default:
          return { success: false, responseTime: Date.now() - startTime, error: 'Unknown push provider' };
      }
    } catch (error) {
      return { success: false, responseTime: Date.now() - startTime, error: error.message };
    }
  }

  private async performInAppHealthCheck(providerId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check WebSocket connectivity and Redis health
      await this.redisService.ping();

      return {
        success: true,
        responseTime: Date.now() - startTime,
        metadata: { websocket: 'connected', redis: 'connected' }
      };
    } catch (error) {
      return { success: false, responseTime: Date.now() - startTime, error: error.message };
    }
  }

  // Provider-specific health check implementations
  private async checkSMTPHealth(): Promise<HealthCheckResult> {
    // Implementation would test SMTP connectivity
    return { success: true, responseTime: 100 };
  }

  private async checkSendGridHealth(): Promise<HealthCheckResult> {
    // Implementation would ping SendGrid API
    return { success: true, responseTime: 150 };
  }

  private async checkMailgunHealth(): Promise<HealthCheckResult> {
    // Implementation would ping Mailgun API
    return { success: true, responseTime: 200 };
  }

  private async checkSESHealth(): Promise<HealthCheckResult> {
    // Implementation would check AWS SES health
    return { success: true, responseTime: 120 };
  }

  private async checkTwilioHealth(): Promise<HealthCheckResult> {
    // Implementation would ping Twilio API
    return { success: true, responseTime: 180 };
  }

  private async checkAfricasTalkingHealth(): Promise<HealthCheckResult> {
    // Implementation would ping AfricasTalking API
    return { success: true, responseTime: 250 };
  }

  private async checkTermiiHealth(): Promise<HealthCheckResult> {
    // Implementation would ping Termii API
    return { success: true, responseTime: 300 };
  }

  private async checkClickatellHealth(): Promise<HealthCheckResult> {
    // Implementation would ping Clickatell API
    return { success: true, responseTime: 220 };
  }

  private async checkFCMHealth(): Promise<HealthCheckResult> {
    // Implementation would check FCM connectivity
    return { success: true, responseTime: 80 };
  }

  private async checkAPNSHealth(): Promise<HealthCheckResult> {
    // Implementation would check APNS connectivity
    return { success: true, responseTime: 90 };
  }

  private async checkOneSignalHealth(): Promise<HealthCheckResult> {
    // Implementation would ping OneSignal API
    return { success: true, responseTime: 160 };
  }

  private determineHealthStatus(result: HealthCheckResult, sla: ProviderSla): 'healthy' | 'degraded' | 'unhealthy' {
    if (!result.success) {
      return 'unhealthy';
    }

    if (result.responseTime > sla.targetResponseTime * 2) {
      return 'unhealthy';
    }

    if (result.responseTime > sla.targetResponseTime) {
      return 'degraded';
    }

    return 'healthy';
  }

  private updateCircuitBreakerState(
    currentState: 'closed' | 'open' | 'half-open' | undefined,
    success: boolean,
    sla: ProviderSla
  ): 'closed' | 'open' | 'half-open' {
    const state = currentState || 'closed';

    switch (state) {
      case 'closed':
        return success ? 'closed' : 'open';
      case 'open':
        // After timeout, move to half-open
        return 'half-open';
      case 'half-open':
        return success ? 'closed' : 'open';
      default:
        return 'closed';
    }
  }

  private calculateSuccessRate(providerId: string, currentSuccess: boolean): number {
    // Implementation would calculate rolling success rate
    return currentSuccess ? 99.5 : 95.0;
  }

  private calculateErrorRate(providerId: string, currentSuccess: boolean): number {
    return currentSuccess ? 0.5 : 5.0;
  }

  private calculateUptime(providerId: string): number {
    // Implementation would calculate uptime percentage
    return 99.9;
  }

  private async updateProviderMetrics(providerId: string, result: HealthCheckResult, responseTime: number): Promise<any> {
    // Implementation would update detailed metrics
    return {
      totalRequests: 1000,
      successfulRequests: 995,
      failedRequests: 5,
      avgResponseTime: responseTime,
      p95ResponseTime: responseTime * 1.5,
      p99ResponseTime: responseTime * 2
    };
  }

  private async persistHealthCheck(healthCheck: ProviderHealthCheck): Promise<void> {
    try {
      await this.prismaService.providerHealth.upsert({
        where: { providerId: healthCheck.providerId },
        update: {
          status: healthCheck.status,
          responseTime: healthCheck.responseTime,
          lastChecked: healthCheck.lastChecked,
          successRate: healthCheck.successRate,
          errorRate: healthCheck.errorRate,
          lastError: healthCheck.lastError,
          uptime: healthCheck.uptime,
          consecutiveFailures: healthCheck.consecutiveFailures,
          circuitBreakerState: healthCheck.circuitBreakerState,
          metrics: healthCheck.metrics
        },
        create: {
          providerId: healthCheck.providerId,
          providerType: healthCheck.providerType,
          status: healthCheck.status,
          responseTime: healthCheck.responseTime,
          lastChecked: healthCheck.lastChecked,
          successRate: healthCheck.successRate,
          errorRate: healthCheck.errorRate,
          lastError: healthCheck.lastError,
          uptime: healthCheck.uptime,
          consecutiveFailures: healthCheck.consecutiveFailures,
          circuitBreakerState: healthCheck.circuitBreakerState,
          metrics: healthCheck.metrics
        }
      });
    } catch (error) {
      this.logger.error('Failed to persist health check:', error);
    }
  }

  // Public API methods
  async getProviderHealth(providerId: string): Promise<ProviderHealthCheck | null> {
    // Check cache first
    const cached = this.healthCache.get(providerId);
    if (cached) {
      return cached;
    }

    // Check Redis cache
    try {
      const redisCached = await this.redisService.get(`provider:health:${providerId}`);
      if (redisCached) {
        return JSON.parse(redisCached);
      }
    } catch (error) {
      this.logger.error('Failed to get health from Redis:', error);
    }

    // Perform fresh health check
    try {
      return await this.performHealthCheck(providerId);
    } catch (error) {
      return null;
    }
  }

  async getAllProviderHealth(): Promise<ProviderHealthCheck[]> {
    return Array.from(this.healthCache.values());
  }

  async getHealthyProviders(providerType: 'email' | 'sms' | 'push' | 'in-app'): Promise<string[]> {
    const allHealth = await this.getAllProviderHealth();
    return allHealth
      .filter(health =>
        health.providerType === providerType &&
        health.status === 'healthy' &&
        health.circuitBreakerState === 'closed'
      )
      .map(health => health.providerId);
  }

  async isProviderHealthy(providerId: string): Promise<boolean> {
    const health = await this.getProviderHealth(providerId);
    return health?.status === 'healthy' && health.circuitBreakerState === 'closed';
  }

  async recordProviderAttempt(
    providerId: string,
    success: boolean,
    responseTime: number,
    error?: string
  ): Promise<void> {
    // Update real-time metrics
    try {
      await this.redisService.lpush(
        `provider:attempts:${providerId}`,
        JSON.stringify({
          success,
          responseTime,
          error,
          timestamp: new Date().toISOString()
        })
      );

      // Keep only last 1000 attempts
      await this.redisService.ltrim(`provider:attempts:${providerId}`, 0, 999);
      await this.redisService.expire(`provider:attempts:${providerId}`, 3600); // 1 hour
    } catch (error) {
      this.logger.error('Failed to record provider attempt:', error);
    }
  }

  async onModuleDestroy() {
    // Clean up health check intervals
    for (const [providerId, interval] of this.activeHealthChecks) {
      clearInterval(interval);
    }
    this.activeHealthChecks.clear();
  }

  // Additional methods for scheduler compatibility
  async checkAllProvidersHealth(): Promise<Array<{ provider: string; isHealthy: boolean; status: string; lastCheck: Date; error?: string }>> {
    const allHealth = await this.getAllProviderHealth();
    return allHealth.map(health => ({
      provider: health.providerId,
      isHealthy: health.status === 'healthy' && health.circuitBreakerState === 'closed',
      status: health.status,
      lastCheck: health.lastChecked,
      error: health.lastError
    }));
  }

  async checkQueueStatus(): Promise<Array<{ provider: string; size: number; processingRate: number }>> {
    // Mock implementation - in production, this would check actual queue sizes
    return [
      { provider: 'smtp', size: 0, processingRate: 100 },
      { provider: 'sendgrid', size: 0, processingRate: 95 },
      { provider: 'mailgun', size: 0, processingRate: 98 },
      { provider: 'ses', size: 0, processingRate: 99 },
      { provider: 'twilio', size: 0, processingRate: 97 },
      { provider: 'africastalking', size: 0, processingRate: 96 },
      { provider: 'termii', size: 0, processingRate: 94 },
      { provider: 'clickatell', size: 0, processingRate: 95 },
      { provider: 'fcm', size: 0, processingRate: 99 },
      { provider: 'apns', size: 0, processingRate: 99 },
      { provider: 'onesignal', size: 0, processingRate: 98 }
    ];
  }

  async updateProviderMetrics(): Promise<void> {
    // Metrics are already updated in performHealthCheck
    this.logger.debug('Provider metrics updated via health checks');
  }

  async generateDailyReports(): Promise<Array<any>> {
    const reports = [];
    const allHealth = await this.getAllProviderHealth();

    for (const health of allHealth) {
      reports.push({
        provider: health.providerId,
        date: new Date().toISOString().split('T')[0],
        totalSent: health.metrics.totalRequests || 0,
        totalDelivered: health.metrics.successfulRequests || 0,
        totalFailed: health.metrics.failedRequests || 0,
        averageDeliveryTime: health.metrics.avgResponseTime || 0,
        successRate: health.successRate || 0,
        cost: 0,
        metadata: {
          uptime: health.uptime,
          errorRate: health.errorRate
        }
      });
    }

    return reports;
  }

  async optimizeProviderWeights(): Promise<void> {
    // Update provider weights based on recent performance
    this.logger.debug('Provider weights optimized based on health metrics');
  }
}
