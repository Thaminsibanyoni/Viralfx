import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderHealthService } from "./provider-health.service";
import { ProviderRoutingService } from "./provider-routing.service";
import { RedisService } from "../../redis/redis.service";

export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  type: 'failure_injection' | 'latency_injection' | 'circuit_breaker_test' | 'failover_test' | 'load_test';
  targetProvider?: string;
  targetType?: 'specific' | 'random' | 'all';
  failureRate: number; // 0-100 percentage
  latencyMs?: number;
  duration: number; // milliseconds
  enabled: boolean;
  createdAt: Date;
  lastRun?: Date;
  results?: ChaosExperimentResult[];
}

export interface ChaosExperimentResult {
  experimentId: string;
  runAt: Date;
  success: boolean;
  totalRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  failoverTriggered: boolean;
  failoverProvider?: string;
  errors: string[];
  metrics: {
    resilienceScore: number; // 0-100
    recoveryTime: number; // milliseconds
    impactScore: number; // 0-100
  };
}

export interface FailureInjectionConfig {
  providerId: string;
  failureType: 'timeout' | 'connection_error' | 'rate_limit' | 'server_error' | 'partial_failure';
  failureRate: number;
  duration: number;
  customResponse?: any;
}

export interface LatencyInjectionConfig {
  providerId: string;
  latencyMs: number;
  jitterMs: number;
  duration: number;
}

@Injectable()
export class ChaosTestingService {
  private readonly logger = new Logger(ChaosTestingService.name);
  private activeExperiments = new Map<string, ChaosExperiment>();
  private injectionStates = new Map<string, { type: string; config: any; expiresAt: Date }>();
  private experimentHistory = new Map<string, ChaosExperimentResult[]>();

  constructor(
    private readonly configService: ConfigService,
    private readonly providerHealthService: ProviderHealthService,
    private readonly providerRoutingService: ProviderRoutingService,
    private readonly redisService: RedisService) {
    this.initializeDefaultExperiments();
  }

  private initializeDefaultExperiments() {
    const defaultExperiments: ChaosExperiment[] = [
      {
        id: 'email-failover-test',
        name: 'Email Provider Failover Test',
        description: 'Test failover behavior when primary email provider fails',
        type: 'failover_test',
        targetType: 'specific',
        failureRate: 100,
        duration: 60000, // 1 minute
        enabled: false,
        createdAt: new Date()
      },
      {
        id: 'sms-latency-test',
        name: 'SMS Provider Latency Test',
        description: 'Inject latency into SMS providers to test resilience',
        type: 'latency_injection',
        targetType: 'random',
        failureRate: 50,
        latencyMs: 5000,
        duration: 30000, // 30 seconds
        enabled: false,
        createdAt: new Date()
      },
      {
        id: 'push-circuit-breaker-test',
        name: 'Push Circuit Breaker Test',
        description: 'Test circuit breaker behavior under high failure rates',
        type: 'circuit_breaker_test',
        targetType: 'all',
        failureRate: 80,
        duration: 120000, // 2 minutes
        enabled: false,
        createdAt: new Date()
      },
      {
        id: 'load-test',
        name: 'High Load Test',
        description: 'Simulate high load conditions to test system resilience',
        type: 'load_test',
        failureRate: 0,
        duration: 300000, // 5 minutes
        enabled: false,
        createdAt: new Date()
      },
    ];

    for (const experiment of defaultExperiments) {
      this.activeExperiments.set(experiment.id, experiment);
    }
  }

  async createExperiment(experiment: Omit<ChaosExperiment, 'id' | 'createdAt'>): Promise<ChaosExperiment> {
    const newExperiment: ChaosExperiment = {
      ...experiment,
      id: this.generateExperimentId(),
      createdAt: new Date()
    };

    this.activeExperiments.set(newExperiment.id, newExperiment);
    await this.persistExperiment(newExperiment);

    this.logger.log(`Created chaos experiment: ${newExperiment.name} (${newExperiment.id})`);
    return newExperiment;
  }

  async runExperiment(experimentId: string, context?: any): Promise<ChaosExperimentResult> {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (!experiment.enabled) {
      throw new Error(`Experiment ${experimentId} is not enabled`);
    }

    this.logger.log(`Running chaos experiment: ${experiment.name}`);

    const result: ChaosExperimentResult = {
      experimentId,
      runAt: new Date(),
      success: false,
      totalRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      failoverTriggered: false,
      errors: [],
      metrics: {
        resilienceScore: 0,
        recoveryTime: 0,
        impactScore: 0
      }
    };

    try {
      switch (experiment.type) {
        case 'failure_injection':
          await this.executeFailureInjection(experiment, result);
          break;
        case 'latency_injection':
          await this.executeLatencyInjection(experiment, result);
          break;
        case 'circuit_breaker_test':
          await this.executeCircuitBreakerTest(experiment, result);
          break;
        case 'failover_test':
          await this.executeFailoverTest(experiment, result);
          break;
        case 'load_test':
          await this.executeLoadTest(experiment, result);
          break;
        default:
          throw new Error(`Unknown experiment type: ${experiment.type}`);
      }

      result.success = true;
      this.logger.log(`Chaos experiment completed successfully: ${experiment.name}`);
    } catch (error) {
      result.errors.push(error.message);
      this.logger.error(`Chaos experiment failed: ${experiment.name}`, error);
    }

    // Update experiment history
    const history = this.experimentHistory.get(experimentId) || [];
    history.push(result);
    this.experimentHistory.set(experimentId, history);

    // Update experiment
    experiment.lastRun = new Date();
    if (experiment.results) {
      experiment.results.push(result);
    } else {
      experiment.results = [result];
    }

    await this.persistExperimentResult(result);
    return result;
  }

  private async executeFailureInjection(experiment: ChaosExperiment, result: ChaosExperimentResult) {
    const targetProviders = await this.getTargetProviders(experiment);

    for (const providerId of targetProviders) {
      const config: FailureInjectionConfig = {
        providerId,
        failureType: 'server_error',
        failureRate: experiment.failureRate,
        duration: experiment.duration
      };

      // Activate failure injection
      await this.activateFailureInjection(config);

      // Monitor during the experiment
      const startTime = Date.now();
      const monitoringInterval = setInterval(async () => {
        await this.collectMetrics(providerId, result);
      }, 1000);

      // Wait for experiment duration
      await new Promise(resolve => setTimeout(resolve, experiment.duration));

      clearInterval(monitoringInterval);

      // Deactivate failure injection
      await this.deactivateFailureInjection(providerId);

      result.metrics.recoveryTime = Date.now() - startTime;
    }

    result.metrics.resilienceScore = this.calculateResilienceScore(result);
    result.metrics.impactScore = this.calculateImpactScore(result);
  }

  private async executeLatencyInjection(experiment: ChaosExperiment, result: ChaosExperimentResult) {
    const targetProviders = await this.getTargetProviders(experiment);

    for (const providerId of targetProviders) {
      const config: LatencyInjectionConfig = {
        providerId,
        latencyMs: experiment.latencyMs || 2000,
        jitterMs: 500,
        duration: experiment.duration
      };

      // Activate latency injection
      await this.activateLatencyInjection(config);

      // Monitor during the experiment
      const startTime = Date.now();
      const monitoringInterval = setInterval(async () => {
        await this.collectMetrics(providerId, result);
      }, 1000);

      await new Promise(resolve => setTimeout(resolve, experiment.duration));

      clearInterval(monitoringInterval);

      // Deactivate latency injection
      await this.deactivateLatencyInjection(providerId);

      result.metrics.recoveryTime = Date.now() - startTime;
    }

    result.metrics.resilienceScore = this.calculateResilienceScore(result);
    result.metrics.impactScore = this.calculateImpactScore(result);
  }

  private async executeCircuitBreakerTest(experiment: ChaosExperiment, result: ChaosExperimentResult) {
    const targetProviders = await this.getTargetProviders(experiment);

    for (const providerId of targetProviders) {
      // Force high failure rate to trigger circuit breaker
      const config: FailureInjectionConfig = {
        providerId,
        failureType: 'connection_error',
        failureRate: 100,
        duration: experiment.duration
      };

      await this.activateFailureInjection(config);

      const startTime = Date.now();
      let circuitBreakerOpened = false;

      const monitoringInterval = setInterval(async () => {
        await this.collectMetrics(providerId, result);

        // Check if circuit breaker opened
        const health = await this.providerHealthService.getProviderHealth(providerId);
        if (health?.circuitBreakerState === 'open' && !circuitBreakerOpened) {
          circuitBreakerOpened = true;
          result.failoverTriggered = true;
          this.logger.log(`Circuit breaker opened for provider: ${providerId}`);
        }
      }, 1000);

      await new Promise(resolve => setTimeout(resolve, experiment.duration));

      clearInterval(monitoringInterval);
      await this.deactivateFailureInjection(providerId);

      result.metrics.recoveryTime = Date.now() - startTime;
    }

    result.metrics.resilienceScore = result.failoverTriggered ? 85 : 30;
    result.metrics.impactScore = this.calculateImpactScore(result);
  }

  private async executeFailoverTest(experiment: ChaosExperiment, result: ChaosExperimentResult) {
    const targetProviders = await this.getTargetProviders(experiment);

    for (const primaryProviderId of targetProviders) {
      // Inject complete failure into primary provider
      const config: FailureInjectionConfig = {
        providerId: primaryProviderId,
        failureType: 'timeout',
        failureRate: 100,
        duration: experiment.duration
      };

      await this.activateFailureInjection(config);

      const startTime = Date.now();
      let failoverProvider = '';

      // Monitor for failover behavior
      const monitoringInterval = setInterval(async () => {
        await this.collectMetrics(primaryProviderId, result);

        // Check if requests are being routed to fallback providers
        const routingDecision = await this.providerRoutingService.selectOptimalProvider({
          type: this.getProviderType(primaryProviderId),
          priority: 'normal'
        });

        if (routingDecision.primaryProvider !== primaryProviderId) {
          failoverProvider = routingDecision.primaryProvider;
          result.failoverTriggered = true;
          result.failoverProvider = failoverProvider;
          this.logger.log(`Failover triggered: ${primaryProviderId} -> ${failoverProvider}`);
        }
      }, 1000);

      await new Promise(resolve => setTimeout(resolve, experiment.duration));

      clearInterval(monitoringInterval);
      await this.deactivateFailureInjection(primaryProviderId);

      result.metrics.recoveryTime = Date.now() - startTime;
    }

    result.metrics.resilienceScore = result.failoverTriggered ? 90 : 20;
    result.metrics.impactScore = this.calculateImpactScore(result);
  }

  private async executeLoadTest(experiment: ChaosExperiment, result: ChaosExperimentResult) {
    // Simulate high load conditions
    const loadTestProviders = ['email', 'sms', 'push'];
    const startTime = Date.now();

    for (const providerType of loadTestProviders) {
      // Generate high concurrent load
      const loadPromises = [];
      for (let i = 0; i < 100; i++) { // 100 concurrent requests
        loadPromises.push(this.simulateLoadRequest(providerType, result));
      }

      await Promise.all(loadPromises);
    }

    result.metrics.recoveryTime = Date.now() - startTime;
    result.metrics.resilienceScore = this.calculateResilienceScore(result);
    result.metrics.impactScore = this.calculateImpactScore(result);
  }

  private async simulateLoadRequest(providerType: string, result: ChaosExperimentResult) {
    try {
      const routingDecision = await this.providerRoutingService.selectOptimalProvider({
        type: providerType as any,
        priority: 'normal'
      });

      // Simulate request
      result.totalRequests++;

      // Random success/failure based on health
      const isHealthy = await this.providerHealthService.isProviderHealthy(routingDecision.primaryProvider);

      if (!isHealthy || Math.random() < 0.05) { // 5% base failure rate
        result.failedRequests++;
      }

      // Simulate response time
      const responseTime = Math.random() * 1000 + 500; // 500-1500ms
      result.avgResponseTime = (result.avgResponseTime + responseTime) / 2;

    } catch (error) {
      result.totalRequests++;
      result.failedRequests++;
      result.errors.push(error.message);
    }
  }

  private async getTargetProviders(experiment: ChaosExperiment): Promise<string[]> {
    switch (experiment.targetType) {
      case 'specific':
        return experiment.targetProvider ? [experiment.targetProvider] : [];
      case 'random':
        return await this.getRandomProviders(2);
      case 'all':
        return await this.getAllProviders();
      default:
        return [];
    }
  }

  private async getRandomProviders(count: number): Promise<string[]> {
    const allProviders = await this.providerRoutingService.getAllProviders();
    const shuffled = allProviders.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(p => p.id);
  }

  private async getAllProviders(): Promise<string[]> {
    const allProviders = await this.providerRoutingService.getAllProviders();
    return allProviders.map(p => p.id);
  }

  private getProviderType(providerId: string): 'email' | 'sms' | 'push' | 'in-app' {
    if (providerId.includes('mail') || providerId === 'smtp' || providerId === 'ses') {
      return 'email';
    }
    if (providerId.includes('twilio') || providerId.includes('africa') ||
        providerId.includes('termii') || providerId.includes('clickatell')) {
      return 'sms';
    }
    if (providerId.includes('fcm') || providerId.includes('apns') || providerId.includes('onesignal')) {
      return 'push';
    }
    return 'in-app';
  }

  private async collectMetrics(providerId: string, result: ChaosExperimentResult) {
    const health = await this.providerHealthService.getProviderHealth(providerId);
    if (health) {
      result.totalRequests += health.metrics.totalRequests;
      result.failedRequests += health.metrics.failedRequests;
      result.avgResponseTime = (result.avgResponseTime + health.metrics.avgResponseTime) / 2;
    }
  }

  private calculateResilienceScore(result: ChaosExperimentResult): number {
    if (result.totalRequests === 0) return 100;

    const successRate = ((result.totalRequests - result.failedRequests) / result.totalRequests) * 100;
    const failoverBonus = result.failoverTriggered ? 20 : 0;
    const recoveryPenalty = result.metrics.recoveryTime > 30000 ? 15 : 0; // 30 second penalty

    return Math.min(100, Math.max(0, successRate + failoverBonus - recoveryPenalty));
  }

  private calculateImpactScore(result: ChaosExperimentResult): number {
    if (result.totalRequests === 0) return 0;

    const failureRate = (result.failedRequests / result.totalRequests) * 100;
    const latencyImpact = Math.min(50, result.avgResponseTime / 100); // 1 point per 100ms
    const recoveryImpact = Math.min(30, result.metrics.recoveryTime / 10000); // 1 point per 10 seconds

    return Math.min(100, failureRate + latencyImpact + recoveryImpact);
  }

  // Failure injection methods
  private async activateFailureInjection(config: FailureInjectionConfig) {
    const expiresAt = new Date(Date.now() + config.duration);

    this.injectionStates.set(config.providerId, {
      type: 'failure',
      config,
      expiresAt
    });

    // Store in Redis for distributed access
    await this.redisService.setex(
      `chaos:failure:${config.providerId}`,
      Math.ceil(config.duration / 1000),
      JSON.stringify(config)
    );

    this.logger.log(`Activated failure injection for provider: ${config.providerId}`);
  }

  private async deactivateFailureInjection(providerId: string) {
    this.injectionStates.delete(providerId);
    await this.redisService.del(`chaos:failure:${providerId}`);
    this.logger.log(`Deactivated failure injection for provider: ${providerId}`);
  }

  private async activateLatencyInjection(config: LatencyInjectionConfig) {
    const expiresAt = new Date(Date.now() + config.duration);

    this.injectionStates.set(config.providerId, {
      type: 'latency',
      config,
      expiresAt
    });

    await this.redisService.setex(
      `chaos:latency:${config.providerId}`,
      Math.ceil(config.duration / 1000),
      JSON.stringify(config)
    );

    this.logger.log(`Activated latency injection for provider: ${config.providerId}`);
  }

  private async deactivateLatencyInjection(providerId: string) {
    this.injectionStates.delete(providerId);
    await this.redisService.del(`chaos:latency:${providerId}`);
    this.logger.log(`Deactivated latency injection for provider: ${providerId}`);
  }

  // Public API methods for processors to check for chaos conditions
  async shouldInjectFailure(providerId: string): Promise<boolean> {
    // Check in-memory state first
    const injectionState = this.injectionStates.get(providerId);
    if (injectionState && injectionState.type === 'failure') {
      const config = injectionState.config as FailureInjectionConfig;
      return Math.random() * 100 < config.failureRate;
    }

    // Check Redis for distributed state
    try {
      const redisState = await this.redisService.get(`chaos:failure:${providerId}`);
      if (redisState) {
        const config = JSON.parse(redisState) as FailureInjectionConfig;
        return Math.random() * 100 < config.failureRate;
      }
    } catch (error) {
      this.logger.error('Failed to check Redis chaos state:', error);
    }

    return false;
  }

  async getInjectedLatency(providerId: string): Promise<number> {
    // Check in-memory state
    const injectionState = this.injectionStates.get(providerId);
    if (injectionState && injectionState.type === 'latency') {
      const config = injectionState.config as LatencyInjectionConfig;
      const jitter = Math.random() * config.jitterMs;
      return config.latencyMs + jitter;
    }

    // Check Redis
    try {
      const redisState = await this.redisService.get(`chaos:latency:${providerId}`);
      if (redisState) {
        const config = JSON.parse(redisState) as LatencyInjectionConfig;
        const jitter = Math.random() * config.jitterMs;
        return config.latencyMs + jitter;
      }
    } catch (error) {
      this.logger.error('Failed to check Redis latency state:', error);
    }

    return 0;
  }

  async getInjectedFailureType(providerId: string): Promise<string | null> {
    const injectionState = this.injectionStates.get(providerId);
    if (injectionState && injectionState.type === 'failure') {
      return (injectionState.config as FailureInjectionConfig).failureType;
    }

    try {
      const redisState = await this.redisService.get(`chaos:failure:${providerId}`);
      if (redisState) {
        return JSON.parse(redisState).failureType;
      }
    } catch (error) {
      this.logger.error('Failed to check Redis failure type:', error);
    }

    return null;
  }

  private generateExperimentId(): string {
    return `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async persistExperiment(experiment: ChaosExperiment): Promise<void> {
    try {
      await this.redisService.setex(
        `chaos:experiment:${experiment.id}`,
        3600, // 1 hour
        JSON.stringify(experiment)
      );
    } catch (error) {
      this.logger.error('Failed to persist experiment:', error);
    }
  }

  private async persistExperimentResult(result: ChaosExperimentResult): Promise<void> {
    try {
      await this.redisService.lpush(
        `chaos:results:${result.experimentId}`,
        JSON.stringify(result)
      );
      await this.redisService.ltrim(`chaos:results:${result.experimentId}`, 0, 99); // Keep last 100 results
      await this.redisService.expire(`chaos:results:${result.experimentId}`, 86400); // 24 hours
    } catch (error) {
      this.logger.error('Failed to persist experiment result:', error);
    }
  }

  // Public API methods
  async getExperiment(experimentId: string): Promise<ChaosExperiment | null> {
    return this.activeExperiments.get(experimentId) || null;
  }

  async getAllExperiments(): Promise<ChaosExperiment[]> {
    return Array.from(this.activeExperiments.values());
  }

  async getExperimentResults(experimentId: string): Promise<ChaosExperimentResult[]> {
    return this.experimentHistory.get(experimentId) || [];
  }

  async enableExperiment(experimentId: string): Promise<void> {
    const experiment = this.activeExperiments.get(experimentId);
    if (experiment) {
      experiment.enabled = true;
      await this.persistExperiment(experiment);
    }
  }

  async disableExperiment(experimentId: string): Promise<void> {
    const experiment = this.activeExperiments.get(experimentId);
    if (experiment) {
      experiment.enabled = false;
      await this.persistExperiment(experiment);
    }
  }

  async deleteExperiment(experimentId: string): Promise<void> {
    this.activeExperiments.delete(experimentId);
    this.experimentHistory.delete(experimentId);
    await this.redisService.del(`chaos:experiment:${experimentId}`);
    await this.redisService.del(`chaos:results:${experimentId}`);
  }

  async cleanupExpiredInjections(): Promise<void> {
    const now = new Date();
    const expiredProviders = [];

    for (const [providerId, state] of this.injectionStates) {
      if (state.expiresAt < now) {
        expiredProviders.push(providerId);
      }
    }

    for (const providerId of expiredProviders) {
      if (this.injectionStates.get(providerId)?.type === 'failure') {
        await this.deactivateFailureInjection(providerId);
      } else {
        await this.deactivateLatencyInjection(providerId);
      }
    }
  }

  async getSystemResilienceScore(): Promise<number> {
    const experiments = Array.from(this.experimentHistory.values())
      .flat()
      .filter(result => result.success && result.runAt > new Date(Date.now() - 24 * 60 * 60 * 1000)); // Last 24 hours

    if (experiments.length === 0) return 100;

    const totalScore = experiments.reduce((sum, result) => sum + result.metrics.resilienceScore, 0);
    return Math.round(totalScore / experiments.length);
  }
}
