import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from '../redis/redis.service';
import { BrokerSafetyMetrics } from "./interfaces/vpmx.interface";

@Injectable()
export class BrokerSafetyService {
  private readonly logger = new Logger(BrokerSafetyService.name);
  private readonly SAFETY_CACHE_KEY = 'vpmx:broker:safety';
  private readonly EXPOSURE_TRACKING_KEY = 'vpmx:broker:exposure';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService) {}

  /**
   * Get broker safety metrics
   */
  async getBrokerSafetyMetrics(brokerId: string): Promise<BrokerSafetyMetrics | null> {
    // Try cache first
    const cacheKey = `${this.SAFETY_CACHE_KEY}:${brokerId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const brokerSafety = await this.prisma.vPMXBrokerSafety.findUnique({
      where: { brokerId }
    });

    if (!brokerSafety) {
      // Initialize safety settings for new broker
      return await this.initializeBrokerSafety(brokerId);
    }

    const metrics: BrokerSafetyMetrics = {
      brokerId: brokerSafety.brokerId,
      maxExposure: brokerSafety.maxExposure,
      currentExposure: brokerSafety.currentExposure,
      exposurePercentage: brokerSafety.exposurePercentage,
      riskLevel: brokerSafety.riskLevel as any,
      allowedMarkets: brokerSafety.allowedMarkets,
      blockedMarkets: brokerSafety.blockedMarkets
    };

    // Cache for 30 seconds
    await this.redis.setex(cacheKey, 30, JSON.stringify(metrics));

    return metrics;
  }

  /**
   * Check if broker can place a bet
   */
  async canPlaceBet(
    brokerId: string,
    betAmount: number,
    marketType: string,
    region?: string): Promise<{ allowed: boolean; reason?: string; adjustedAmount?: number }> {
    const safety = await this.getBrokerSafetyMetrics(brokerId);

    if (!safety) {
      return { allowed: false, reason: 'Broker safety settings not found' };
    }

    // Check exposure limits
    if (safety.currentExposure + betAmount > safety.maxExposure) {
      return {
        allowed: false,
        reason: `Bet amount exceeds exposure limit. Current: $${safety.currentExposure}, Limit: $${safety.maxExposure}`
      };
    }

    // Check individual bet size limit
    const maxBetSize = safety.maxBetSize || safety.maxExposure * 0.1; // Default to 10% of max exposure
    if (betAmount > maxBetSize) {
      return {
        allowed: false,
        reason: `Bet size exceeds maximum limit. Max: $${maxBetSize}`,
        adjustedAmount: maxBetSize
      };
    }

    // Check market type restrictions
    if (safety.allowedMarkets.length > 0 && !safety.allowedMarkets.includes(marketType)) {
      return {
        allowed: false,
        reason: `Market type ${marketType} not allowed for this broker`
      };
    }

    if (safety.blockedMarkets.includes(marketType)) {
      return {
        allowed: false,
        reason: `Market type ${marketType} is blocked for this broker`
      };
    }

    // Check regional restrictions
    if (region && safety.regions.length > 0 && !safety.regions.includes(region)) {
      return {
        allowed: false,
        reason: `Region ${region} not allowed for this broker`
      };
    }

    // Check daily exposure limit
    const dailyExposure = await this.getDailyExposure(brokerId);
    const maxDailyExposure = safety.maxDailyExposure || safety.maxExposure * 0.5; // Default to 50% of max exposure

    if (dailyExposure + betAmount > maxDailyExposure) {
      return {
        allowed: false,
        reason: `Daily exposure limit exceeded. Current: $${dailyExposure}, Limit: $${maxDailyExposure}`
      };
    }

    return { allowed: true };
  }

  /**
   * Update broker exposure after placing a bet
   */
  async updateExposure(
    brokerId: string,
    betAmount: number,
    potentialLoss: number): Promise<void> {
    try {
      // Update current exposure
      await this.prisma.vPMXBrokerSafety.update({
        where: { brokerId },
        data: {
          currentExposure: {
            increment: potentialLoss // Use potential loss for exposure calculation
          },
          exposurePercentage: {
            increment: (potentialLoss / (await this.getBrokerSafetyMetrics(brokerId))!.maxExposure) * 100
          },
          lastRiskAssessment: new Date()
        }
      });

      // Track daily exposure
      await this.trackDailyExposure(brokerId, betAmount);

      // Re-evaluate risk level
      await this.reassessRiskLevel(brokerId);

      // Invalidate cache
      const cacheKey = `${this.SAFETY_CACHE_KEY}:${brokerId}`;
      await this.redis.del(cacheKey);

      // Check for automatic suspension
      await this.checkAutoSuspension(brokerId);

      this.logger.debug(`Updated exposure for broker ${brokerId}: +$${potentialLoss}`);
    } catch (error) {
      this.logger.error(`Failed to update exposure for broker ${brokerId}`, error);
    }
  }

  /**
   * Reduce broker exposure after bet settlement
   */
  async reduceExposure(brokerId: string, amount: number): Promise<void> {
    try {
      await this.prisma.vPMXBrokerSafety.update({
        where: { brokerId },
        data: {
          currentExposure: {
            decrement: amount
          },
          lastRiskAssessment: new Date()
        }
      });

      // Re-calculate exposure percentage
      const safety = await this.prisma.vPMXBrokerSafety.findUnique({ where: { brokerId } });
      if (safety && safety.maxExposure > 0) {
        await this.prisma.vPMXBrokerSafety.update({
          where: { brokerId },
          data: {
            exposurePercentage: Math.max(0, (safety.currentExposure / safety.maxExposure) * 100)
          }
        });
      }

      // Invalidate cache
      const cacheKey = `${this.SAFETY_CACHE_KEY}:${brokerId}`;
      await this.redis.del(cacheKey);

      // Re-evaluate risk level
      await this.reassessRiskLevel(brokerId);

      this.logger.debug(`Reduced exposure for broker ${brokerId}: -$${amount}`);
    } catch (error) {
      this.logger.error(`Failed to reduce exposure for broker ${brokerId}`, error);
    }
  }

  /**
   * Initialize safety settings for a new broker
   */
  async initializeBrokerSafety(brokerId: string): Promise<BrokerSafetyMetrics> {
    const defaultSafety = {
      brokerId,
      maxExposure: 100000, // $100,000 default
      currentExposure: 0,
      exposurePercentage: 0,
      riskLevel: 'LOW' as const,
      maxBetSize: 10000, // $10,000 default max bet
      maxDailyExposure: 50000, // $50,000 daily limit
      allowedMarkets: ['BINARY', 'RANGE'], // Allow basic markets by default
      blockedMarkets: [],
      regions: ['US', 'ZA', 'UK'], // Default allowed regions
      autoLimitReduction: true,
      suspensionThreshold: 90 // Auto-suspend at 90% exposure
    };

    await this.prisma.vPMXBrokerSafety.create({
      data: {
        brokerId,
        maxExposure: defaultSafety.maxExposure,
        currentExposure: defaultSafety.currentExposure,
        exposurePercentage: defaultSafety.exposurePercentage,
        riskLevel: defaultSafety.riskLevel,
        maxBetSize: defaultSafety.maxBetSize,
        maxDailyExposure: defaultSafety.maxDailyExposure,
        allowedMarkets: defaultSafety.allowedMarkets,
        blockedMarkets: defaultSafety.blockedMarkets,
        regions: defaultSafety.regions,
        autoLimitReduction: defaultSafety.autoLimitReduction,
        suspensionThreshold: defaultSafety.suspensionThreshold,
        lastRiskAssessment: new Date()
      }
    });

    this.logger.log(`Initialized safety settings for broker ${brokerId}`);
    return defaultSafety;
  }

  /**
   * Update broker safety settings
   */
  async updateSafetySettings(
    brokerId: string,
    settings: Partial<BrokerSafetyMetrics>): Promise<void> {
    try {
      const updateData: any = {
        lastRiskAssessment: new Date()
      };

      if (settings.maxExposure !== undefined) updateData.maxExposure = settings.maxExposure;
      if (settings.maxBetSize !== undefined) updateData.maxBetSize = settings.maxBetSize;
      if (settings.maxDailyExposure !== undefined) updateData.maxDailyExposure = settings.maxDailyExposure;
      if (settings.allowedMarkets !== undefined) updateData.allowedMarkets = settings.allowedMarkets;
      if (settings.blockedMarkets !== undefined) updateData.blockedMarkets = settings.blockedMarkets;
      if (settings.regions !== undefined) updateData.regions = settings.regions;

      await this.prisma.vPMXBrokerSafety.update({
        where: { brokerId },
        data: updateData
      });

      // Invalidate cache
      const cacheKey = `${this.SAFETY_CACHE_KEY}:${brokerId}`;
      await this.redis.del(cacheKey);

      this.logger.log(`Updated safety settings for broker ${brokerId}`);
    } catch (error) {
      this.logger.error(`Failed to update safety settings for broker ${brokerId}`, error);
    }
  }

  /**
   * Get all brokers at risk
   */
  async getBrokersAtRisk(): Promise<BrokerSafetyMetrics[]> {
    const atRiskBrokers = await this.prisma.vPMXBrokerSafety.findMany({
      where: {
        OR: [
          { exposurePercentage: { gt: 75 } },
          { riskLevel: { in: ['HIGH', 'CRITICAL'] } },
        ]
      }
    });

    return atRiskBrokers.map(broker => ({
      brokerId: broker.brokerId,
      maxExposure: broker.maxExposure,
      currentExposure: broker.currentExposure,
      exposurePercentage: broker.exposurePercentage,
      riskLevel: broker.riskLevel as any,
      allowedMarkets: broker.allowedMarkets,
      blockedMarkets: broker.blockedMarkets
    }));
  }

  /**
   * Perform automatic risk assessment for all brokers
   */
  async performRiskAssessment(): Promise<void> {
    const brokers = await this.prisma.vPMXBrokerSafety.findMany();

    for (const broker of brokers) {
      await this.reassessRiskLevel(broker.brokerId);
      await this.checkAutoLimitReduction(broker.brokerId);
      await this.checkAutoSuspension(broker.brokerId);
    }

    this.logger.log(`Performed risk assessment for ${brokers.length} brokers`);
  }

  /**
   * Get broker exposure report
   */
  async getExposureReport(brokerId: string): Promise<any> {
    const safety = await this.getBrokerSafetyMetrics(brokerId);
    if (!safety) {
      throw new Error('Broker safety settings not found');
    }

    const dailyExposure = await this.getDailyExposure(brokerId);
    const weeklyExposure = await this.getWeeklyExposure(brokerId);
    const activePositions = await this.getActivePositions(brokerId);

    return {
      brokerId,
      currentMetrics: safety,
      exposure: {
        daily: dailyExposure,
        weekly: weeklyExposure,
        activePositions: activePositions.count,
        totalActiveValue: activePositions.totalValue
      },
      risk: {
        level: safety.riskLevel,
        exposurePercentage: safety.exposurePercentage,
        distanceToLimit: safety.maxExposure - safety.currentExposure,
        recommendedAction: this.getRecommendedAction(safety)
      },
      limits: {
        maxBetSize: safety.maxBetSize,
        maxDailyExposure: safety.maxDailyExposure,
        remainingDailyExposure: (safety.maxDailyExposure || safety.maxExposure * 0.5) - dailyExposure
      },
      timestamp: new Date()
    };
  }

  // Private helper methods

  private async reassessRiskLevel(brokerId: string): Promise<void> {
    const broker = await this.prisma.vPMXBrokerSafety.findUnique({ where: { brokerId } });
    if (!broker) return;

    let newRiskLevel = broker.riskLevel;
    const exposurePercentage = broker.exposurePercentage;

    if (exposurePercentage >= 90) {
      newRiskLevel = 'CRITICAL';
    } else if (exposurePercentage >= 75) {
      newRiskLevel = 'HIGH';
    } else if (exposurePercentage >= 50) {
      newRiskLevel = 'MEDIUM';
    } else {
      newRiskLevel = 'LOW';
    }

    if (newRiskLevel !== broker.riskLevel) {
      await this.prisma.vPMXBrokerSafety.update({
        where: { brokerId },
        data: {
          riskLevel: newRiskLevel,
          lastRiskAssessment: new Date()
        }
      });

      this.logger.warn(`Broker ${brokerId} risk level changed to ${newRiskLevel}`);
    }
  }

  private async checkAutoLimitReduction(brokerId: string): Promise<void> {
    const broker = await this.prisma.vPMXBrokerSafety.findUnique({ where: { brokerId } });
    if (!broker || !broker.autoLimitReduction) return;

    // Auto-reduce limits if exposure is consistently high
    if (broker.exposurePercentage > 80) {
      const reductionFactor = 0.9; // Reduce by 10%
      const newMaxBetSize = Math.max(1000, broker.maxBetSize * reductionFactor); // Minimum $1000

      await this.prisma.vPMXBrokerSafety.update({
        where: { brokerId },
        data: {
          maxBetSize: newMaxBetSize,
          lastRiskAssessment: new Date()
        }
      });

      this.logger.warn(`Auto-reduced bet limit for broker ${brokerId} to $${newMaxBetSize}`);
    }
  }

  private async checkAutoSuspension(brokerId: string): Promise<void> {
    const broker = await this.prisma.vPMXBrokerSafety.findUnique({ where: { brokerId } });
    if (!broker) return;

    // Auto-suspend if exposure exceeds threshold
    if (broker.exposurePercentage >= broker.suspensionThreshold) {
      // In a real implementation, you might want to:
      // 1. Block new bets
      // 2. Notify broker
      // 3. Require manual review

      this.logger.error(`AUTO-SUSPENSION: Broker ${brokerId} exceeded suspension threshold (${broker.suspensionThreshold}% exposure)`);

      // Here you would implement actual suspension logic
      // For now, just log the event
    }
  }

  private async trackDailyExposure(brokerId: string, amount: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `${this.EXPOSURE_TRACKING_KEY}:daily:${brokerId}:${today}`;

    await this.redis.incrbyfloat(dailyKey, amount);
    await this.redis.expire(dailyKey, 86400 * 2); // Keep for 2 days
  }

  private async getDailyExposure(brokerId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `${this.EXPOSURE_TRACKING_KEY}:daily:${brokerId}:${today}`;

    const exposure = await this.redis.get(dailyKey);
    return parseFloat(exposure || '0');
  }

  private async getWeeklyExposure(brokerId: string): Promise<number> {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = `${this.EXPOSURE_TRACKING_KEY}:weekly:${brokerId}:${weekStart.toISOString().split('T')[0]}`;

    const exposure = await this.redis.get(weekKey);
    return parseFloat(exposure || '0');
  }

  private async getActivePositions(brokerId: string): Promise<{ count: number; totalValue: number }> {
    // In a real implementation, this would query active bets for the broker
    // For now, return placeholder values
    return {
      count: 15,
      totalValue: 25000
    };
  }

  private getRecommendedAction(safety: BrokerSafetyMetrics): string {
    if (safety.exposurePercentage >= 90) {
      return 'IMMEDIATE_ACTION_REQUIRED: Reduce exposure or suspend new positions';
    } else if (safety.exposurePercentage >= 75) {
      return 'HIGH_RISK: Monitor closely, consider reducing position sizes';
    } else if (safety.exposurePercentage >= 50) {
      return 'MODERATE_RISK: Continue normal operations with increased monitoring';
    } else {
      return 'LOW_RISK: Normal operations acceptable';
    }
  }
}
