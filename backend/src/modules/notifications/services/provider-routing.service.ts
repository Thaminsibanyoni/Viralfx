import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderHealthService, ProviderHealthCheck } from './provider-health.service';
import { RedisService } from '../../redis/redis.service';

export interface ProviderConfig {
  id: string;
  type: 'email' | 'sms' | 'push' | 'in-app';
  name: string;
  priority: number; // Lower number = higher priority
  costPerRequest: number; // In USD
  supportedRegions?: string[]; // ISO country codes
  supportedPlatforms?: string[]; // For push: 'ios', 'android', 'web'
  maxThroughput: number; // Requests per second
  features: string[]; // 'high_throughput', 'low_latency', 'analytics', 'templates'
  isEnabled: boolean;
}

export interface RoutingDecision {
  primaryProvider: string;
  fallbackProviders: string[];
  routingReason: string;
  confidence: number; // 0-100
  metadata: {
    costScore: number;
    performanceScore: number;
    reliabilityScore: number;
    regionalOptimization: boolean;
    loadBalancing: boolean;
  };
}

export interface RoutingContext {
  type: 'email' | 'sms' | 'push' | 'in-app';
  recipientCountry?: string;
  recipientPlatform?: string; // For push: 'ios', 'android', 'web'
  priority: 'low' | 'medium' | 'high' | 'critical';
  messageSize?: number; // For email in bytes
  requiresHighThroughput?: boolean;
  requiresLowLatency?: boolean;
  budgetConstraint?: number; // Maximum cost per request in USD
  preferredProviders?: string[];
  excludedProviders?: string[];
  geographicRouting?: boolean;
  costOptimization?: boolean;
}

@Injectable()
export class ProviderRoutingService {
  private readonly logger = new Logger(ProviderRoutingService.name);
  private providerConfigs = new Map<string, ProviderConfig>();
  private routingCache = new Map<string, RoutingDecision>();
  private loadBalancingState = new Map<string, { currentLoad: number; lastUpdate: Date }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly providerHealthService: ProviderHealthService,
    private readonly redisService: RedisService,
  ) {
    this.initializeProviderConfigs();
  }

  private initializeProviderConfigs() {
    const defaultConfigs: ProviderConfig[] = [
      // Email providers
      {
        id: 'smtp',
        type: 'email',
        name: 'SMTP Server',
        priority: 10, // Highest priority for internal SMTP
        costPerRequest: 0.001, // $0.001 per email
        maxThroughput: 100,
        features: ['templates', 'analytics'],
        isEnabled: true,
      },
      {
        id: 'sendgrid',
        type: 'email',
        name: 'SendGrid',
        priority: 20,
        costPerRequest: 0.01, // $0.01 per email
        maxThroughput: 1000,
        features: ['high_throughput', 'low_latency', 'analytics', 'templates'],
        isEnabled: true,
      },
      {
        id: 'mailgun',
        type: 'email',
        name: 'Mailgun',
        priority: 30,
        costPerRequest: 0.008, // $0.008 per email
        maxThroughput: 800,
        features: ['analytics', 'templates'],
        isEnabled: true,
      },
      {
        id: 'ses',
        type: 'email',
        name: 'Amazon SES',
        priority: 15,
        costPerRequest: 0.0001, // $0.0001 per email (very cheap)
        maxThroughput: 2000,
        features: ['high_throughput', 'low_latency', 'analytics'],
        isEnabled: true,
      },
      // SMS providers
      {
        id: 'twilio',
        type: 'sms',
        name: 'Twilio',
        priority: 10,
        costPerRequest: 0.0079, // $0.0079 per SMS
        supportedRegions: ['US', 'CA', 'GB', 'AU'],
        maxThroughput: 500,
        features: ['high_throughput', 'low_latency', 'analytics'],
        isEnabled: true,
      },
      {
        id: 'africastalking',
        type: 'sms',
        name: 'Africa\'s Talking',
        priority: 5,
        costPerRequest: 0.004, // $0.004 per SMS
        supportedRegions: ['ZA', 'NG', 'KE', 'GH', 'UG', 'TZ', 'RW', 'BW', 'ZW', 'MZ'],
        maxThroughput: 300,
        features: ['analytics'],
        isEnabled: true,
      },
      {
        id: 'termii',
        type: 'sms',
        name: 'Termii',
        priority: 15,
        costPerRequest: 0.0035, // $0.0035 per SMS
        supportedRegions: ['NG', 'GH', 'KE', 'ZA', 'UG'],
        maxThroughput: 250,
        features: ['analytics'],
        isEnabled: true,
      },
      {
        id: 'clickatell',
        type: 'sms',
        name: 'Clickatell',
        priority: 20,
        costPerRequest: 0.006, // $0.006 per SMS
        supportedRegions: ['ZA', 'NG', 'KE', 'GH', 'UG', 'TZ', 'RW'],
        maxThroughput: 400,
        features: ['high_throughput', 'analytics'],
        isEnabled: true,
      },
      // Push providers
      {
        id: 'fcm',
        type: 'push',
        name: 'Firebase Cloud Messaging',
        priority: 5,
        costPerRequest: 0, // Free up to certain limits
        supportedPlatforms: ['android', 'web'],
        maxThroughput: 5000,
        features: ['high_throughput', 'low_latency', 'analytics'],
        isEnabled: true,
      },
      {
        id: 'apns',
        type: 'push',
        name: 'Apple Push Notification Service',
        priority: 5,
        costPerRequest: 0, // Free
        supportedPlatforms: ['ios'],
        maxThroughput: 5000,
        features: ['high_throughput', 'low_latency'],
        isEnabled: true,
      },
      {
        id: 'onesignal',
        type: 'push',
        name: 'OneSignal',
        priority: 15,
        costPerRequest: 0.002,
        supportedPlatforms: ['ios', 'android', 'web'],
        maxThroughput: 2000,
        features: ['high_throughput', 'analytics', 'segmentation'],
        isEnabled: true,
      },
      // In-app providers
      {
        id: 'websocket',
        type: 'in-app',
        name: 'WebSocket Gateway',
        priority: 5,
        costPerRequest: 0,
        maxThroughput: 10000,
        features: ['high_throughput', 'low_latency', 'real_time'],
        isEnabled: true,
      },
    ];

    for (const config of defaultConfigs) {
      this.providerConfigs.set(config.id, config);
    }
  }

  async selectOptimalProvider(context: RoutingContext): Promise<RoutingDecision> {
    const cacheKey = this.generateCacheKey(context);

    // Check cache first
    const cachedDecision = this.routingCache.get(cacheKey);
    if (cachedDecision && this.isCacheValid(cachedDecision)) {
      return cachedDecision;
    }

    // Get available providers for the type
    const availableProviders = Array.from(this.providerConfigs.values())
      .filter(config =>
        config.type === context.type &&
        config.isEnabled &&
        !context.excludedProviders?.includes(config.id)
      );

    // Get health status for all available providers
    const healthStatuses = new Map<string, ProviderHealthCheck>();
    for (const provider of availableProviders) {
      const health = await this.providerHealthService.getProviderHealth(provider.id);
      if (health) {
        healthStatuses.set(provider.id, health);
      }
    }

    // Filter by health status
    const healthyProviders = availableProviders.filter(provider => {
      const health = healthStatuses.get(provider.id);
      return health?.status === 'healthy' && health.circuitBreakerState === 'closed';
    });

    if (healthyProviders.length === 0) {
      // No healthy providers, try degraded ones
      const degradedProviders = availableProviders.filter(provider => {
        const health = healthStatuses.get(provider.id);
        return health?.status === 'degraded';
      });

      if (degradedProviders.length === 0) {
        throw new Error(`No healthy or degraded providers available for ${context.type}`);
      }

      return this.makeRoutingDecision(degradedProviders, context, healthStatuses, true);
    }

    return this.makeRoutingDecision(healthyProviders, context, healthStatuses, false);
  }

  private makeRoutingDecision(
    providers: ProviderConfig[],
    context: RoutingContext,
    healthStatuses: Map<string, ProviderHealthCheck>,
    isDegraded: boolean
  ): RoutingDecision {
    // Score each provider
    const scoredProviders = providers.map(provider => {
      const score = this.calculateProviderScore(provider, context, healthStatuses.get(provider.id));
      return { provider, score };
    });

    // Sort by score (highest first)
    scoredProviders.sort((a, b) => b.score.overall - a.score.overall);

    const primaryProvider = scoredProviders[0].provider;
    const fallbackProviders = scoredProviders.slice(1, 4).map(sp => sp.provider.id);

    const decision: RoutingDecision = {
      primaryProvider: primaryProvider.id,
      fallbackProviders,
      routingReason: this.determineRoutingReason(primaryProvider, context, scoredProviders[0].score),
      confidence: Math.min(95, scoredProviders[0].score.overall),
      metadata: {
        costScore: scoredProviders[0].score.cost,
        performanceScore: scoredProviders[0].score.performance,
        reliabilityScore: scoredProviders[0].score.reliability,
        regionalOptimization: this.isRegionalOptimization(primaryProvider, context),
        loadBalancing: this.isLoadBalancing(primaryProvider, context),
      },
    };

    // Cache the decision
    const cacheKey = this.generateCacheKey(context);
    this.routingCache.set(cacheKey, decision);

    return decision;
  }

  private calculateProviderScore(
    provider: ProviderConfig,
    context: RoutingContext,
    health: ProviderHealthCheck | undefined
  ): {
    overall: number;
    cost: number;
    performance: number;
    reliability: number;
    regionalFit: number;
    featureFit: number;
  } {
    let costScore = 0;
    let performanceScore = 0;
    let reliabilityScore = 0;
    let regionalFitScore = 0;
    let featureFitScore = 0;

    // Cost scoring (lower cost = higher score)
    if (context.costOptimization && context.budgetConstraint) {
      if (provider.costPerRequest <= context.budgetConstraint) {
        costScore = 100 - (provider.costPerRequest / context.budgetConstraint) * 50;
      } else {
        costScore = 0; // Over budget
      }
    } else {
      // Standard cost scoring (cheapest gets 100, most expensive gets 0)
      const maxCost = Math.max(...Array.from(this.providerConfigs.values())
        .filter(p => p.type === context.type)
        .map(p => p.costPerRequest));
      costScore = 100 - (provider.costPerRequest / maxCost) * 100;
    }

    // Performance scoring
    if (health) {
      // Response time scoring (lower is better)
      const avgResponseTime = health.metrics.avgResponseTime;
      performanceScore = Math.max(0, 100 - (avgResponseTime / 1000) * 50); // 1000ms = 0 points

      // Reliability scoring
      reliabilityScore = health.successRate;
    } else {
      // Default scores for unknown health
      performanceScore = 70;
      reliabilityScore = 95;
    }

    // Regional fit scoring
    if (context.geographicRouting && context.recipientCountry) {
      if (provider.supportedRegions?.includes(context.recipientCountry)) {
        regionalFitScore = 100; // Perfect regional match
      } else {
        regionalFitScore = 50; // Not optimized for region but might work
      }
    } else {
      regionalFitScore = 80; // Neutral
    }

    // Feature fit scoring
    if (context.requiresHighThroughput && provider.features.includes('high_throughput')) {
      featureFitScore += 25;
    }
    if (context.requiresLowLatency && provider.features.includes('low_latency')) {
      featureFitScore += 25;
    }
    if (context.priority === 'critical' && provider.features.includes('low_latency')) {
      featureFitScore += 20;
    }
    featureFitScore = Math.min(100, featureFitScore + 50); // Base score of 50

    // Platform fit scoring (for push notifications)
    if (context.type === 'push' && context.recipientPlatform) {
      if (provider.supportedPlatforms?.includes(context.recipientPlatform)) {
        featureFitScore += 30;
      }
    }

    // Preferred provider bonus
    if (context.preferredProviders?.includes(provider.id)) {
      reliabilityScore += 10;
    }

    // Priority penalty (lower priority number = higher reliability score bonus)
    reliabilityScore += Math.max(0, 20 - provider.priority);

    // Overall score calculation
    const weights = {
      cost: context.costOptimization ? 0.25 : 0.15,
      performance: context.requiresLowLatency ? 0.35 : 0.25,
      reliability: 0.30,
      regionalFit: context.geographicRouting ? 0.20 : 0.10,
      featureFit: 0.10,
    };

    const overall =
      (costScore * weights.cost) +
      (performanceScore * weights.performance) +
      (reliabilityScore * weights.reliability) +
      (regionalFitScore * weights.regionalFit) +
      (featureFitScore * weights.featureFit);

    return {
      overall: Math.min(100, Math.max(0, overall)),
      cost: costScore,
      performance: performanceScore,
      reliability: reliabilityScore,
      regionalFit: regionalFitScore,
      featureFit: featureFitScore,
    };
  }

  private determineRoutingReason(provider: ProviderConfig, context: RoutingContext, score: any): string {
    const reasons = [];

    if (score.reliability > 90) {
      reasons.push('high reliability');
    }
    if (context.costOptimization && score.cost > 80) {
      reasons.push('cost effective');
    }
    if (context.requiresLowLatency && score.performance > 80) {
      reasons.push('low latency');
    }
    if (context.geographicRouting && this.isRegionalOptimization(provider, context)) {
      reasons.push('regional optimization');
    }
    if (context.requiresHighThroughput && provider.features.includes('high_throughput')) {
      reasons.push('high throughput support');
    }
    if (context.preferredProviders?.includes(provider.id)) {
      reasons.push('preferred provider');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'best overall match';
  }

  private isRegionalOptimization(provider: ProviderConfig, context: RoutingContext): boolean {
    return context.geographicRouting &&
           context.recipientCountry &&
           provider.supportedRegions?.includes(context.recipientCountry);
  }

  private isLoadBalancing(provider: ProviderConfig, context: RoutingContext): boolean {
    // Implementation would check current load and balance across providers
    const currentLoad = this.loadBalancingState.get(provider.id)?.currentLoad || 0;
    return currentLoad > (provider.maxThroughput * 0.8); // 80% threshold
  }

  private generateCacheKey(context: RoutingContext): string {
    const parts = [
      context.type,
      context.recipientCountry || 'global',
      context.recipientPlatform || 'any',
      context.priority,
      context.requiresHighThroughput ? 'ht' : '',
      context.requiresLowLatency ? 'll' : '',
      context.costOptimization ? 'co' : '',
      context.geographicRouting ? 'gr' : '',
    ];

    return parts.filter(Boolean).join(':');
  }

  private isCacheValid(decision: RoutingDecision): boolean {
    // Cache decisions for 5 minutes
    return true; // Simplified for now
  }

  // Public API methods
  async getProviderConfig(providerId: string): Promise<ProviderConfig | null> {
    return this.providerConfigs.get(providerId) || null;
  }

  async getAllProviders(type?: 'email' | 'sms' | 'push' | 'in-app'): Promise<ProviderConfig[]> {
    const providers = Array.from(this.providerConfigs.values());
    return type ? providers.filter(p => p.type === type) : providers;
  }

  async updateProviderLoad(providerId: string, currentLoad: number): Promise<void> {
    this.loadBalancingState.set(providerId, {
      currentLoad,
      lastUpdate: new Date(),
    });

    // Update Redis for distributed load tracking
    await this.redisService.hset('provider:loads', providerId, currentLoad.toString());
    await this.redisService.expire('provider:loads', 300); // 5 minutes
  }

  async getProviderLoad(providerId: string): Promise<number> {
    const state = this.loadBalancingState.get(providerId);
    if (state && Date.now() - state.lastUpdate.getTime() < 60000) { // 1 minute
      return state.currentLoad;
    }

    // Check Redis
    try {
      const redisLoad = await this.redisService.hget('provider:loads', providerId);
      return redisLoad ? parseFloat(redisLoad) : 0;
    } catch (error) {
      this.logger.error('Failed to get provider load from Redis:', error);
      return 0;
    }
  }

  async getOptimalProvidersByRegion(
    type: 'email' | 'sms' | 'push' | 'in-app',
    countryCode: string
  ): Promise<string[]> {
    const providers = Array.from(this.providerConfigs.values())
      .filter(provider =>
        provider.type === type &&
        provider.isEnabled &&
        (!provider.supportedRegions || provider.supportedRegions.includes(countryCode))
      )
      .sort((a, b) => a.priority - b.priority);

    // Check health status
    const healthyProviders = [];
    for (const provider of providers) {
      const isHealthy = await this.providerHealthService.isProviderHealthy(provider.id);
      if (isHealthy) {
        healthyProviders.push(provider.id);
      }
    }

    return healthyProviders.length > 0 ? healthyProviders : providers.slice(0, 3).map(p => p.id);
  }

  async getCostOptimizedProviders(
    type: 'email' | 'sms' | 'push' | 'in-app',
    maxCostPerRequest: number
  ): Promise<string[]> {
    const providers = Array.from(this.providerConfigs.values())
      .filter(provider =>
        provider.type === type &&
        provider.isEnabled &&
        provider.costPerRequest <= maxCostPerRequest
      )
      .sort((a, b) => a.costPerRequest - b.costPerRequest);

    // Check health status
    const healthyProviders = [];
    for (const provider of providers) {
      const isHealthy = await this.providerHealthService.isProviderHealthy(provider.id);
      if (isHealthy) {
        healthyProviders.push(provider.id);
      }
    }

    return healthyProviders.length > 0 ? healthyProviders : providers.slice(0, 3).map(p => p.id);
  }

  async clearRoutingCache(): Promise<void> {
    this.routingCache.clear();
  }

  // Fallback handling
  async getFallbackProviders(primaryProviderId: string, maxProviders: number = 3): Promise<string[]> {
    const primaryProvider = this.providerConfigs.get(primaryProviderId);
    if (!primaryProvider) {
      return [];
    }

    const sameTypeProviders = Array.from(this.providerConfigs.values())
      .filter(provider =>
        provider.type === primaryProvider.type &&
        provider.id !== primaryProviderId &&
        provider.isEnabled
      )
      .sort((a, b) => a.priority - b.priority);

    const healthyFallbacks = [];
    for (const provider of sameTypeProviders) {
      const isHealthy = await this.providerHealthService.isProviderHealthy(provider.id);
      if (isHealthy) {
        healthyFallbacks.push(provider.id);
        if (healthyFallbacks.length >= maxProviders) {
          break;
        }
      }
    }

    return healthyFallbacks;
  }
}