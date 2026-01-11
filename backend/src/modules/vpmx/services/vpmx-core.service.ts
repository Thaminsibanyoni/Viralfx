import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { WebSocketGatewayHandler } from "../../websocket/gateways/websocket.gateway";
import { SentimentService } from "../../sentiment/services/sentiment.service";
import { ViralIndexService } from "../../viral/services/viral-index.service";
import { DeceptionService } from "../../deception/services/deception.service";

@Injectable()
export class VPMXCoreService {
  private readonly logger = new Logger(VPMXCoreService.name);
  private readonly CACHE_TTL = 30; // seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly wsGateway: WebSocketGatewayHandler,
    private readonly sentimentService: SentimentService,
    private readonly viralIndexService: ViralIndexService,
    private readonly deceptionService: DeceptionService) {}

  /**
   * Compute VPMX using the 8-factor weighted formula
   */
  async computeVPMX(vtsSymbol: string, timestamp?: Date): Promise<{
    vtsSymbol: string;
    value: number; // 0-1000
    components: {
      globalSentiment: number;
      viralMomentum: number;
      trendVelocity: number;
      mentionVolume: number;
      engagementQuality: number;
      trendStability: number;
      deceptionRisk: number;
      regionalWeight: number;
    };
    metadata: {
      breakoutProbability: number;
      confidence: number;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    };
  }> {
    try {
      this.logger.debug(`Computing VPMX for ${vtsSymbol}`);

      // Step 1: Get all required components
      const [
        globalSentiment,
        viralMomentum,
        trendVelocity,
        mentionVolume,
        engagementQuality,
        trendStability,
        deceptionRisk,
        regionalWeight
      ] = await Promise.all([
          this.getGlobalSentiment(vtsSymbol, timestamp),
          this.getViralMomentum(vtsSymbol, timestamp),
          this.getTrendVelocity(vtsSymbol, timestamp),
          this.getMentionVolume(vtsSymbol, timestamp),
          this.getEngagementQuality(vtsSymbol, timestamp),
          this.getTrendStability(vtsSymbol, timestamp),
          this.getDeceptionRisk(vtsSymbol, timestamp),
          this.getRegionalWeight(vtsSymbol, timestamp),
        ]);

      // Step 2: Apply weighted formula
      // VPMX = 0.20*GS + 0.20*VM + 0.15*TV + 0.15*MV + 0.10*EQ + 0.10*TS + 0.05*DR + 0.05*RW
      const value = Math.min(1000, Math.max(0,
        (globalSentiment * 0.20) +
        (viralMomentum * 0.20) +
        (trendVelocity * 0.15) +
        (mentionVolume * 0.15) +
        (engagementQuality * 0.10) +
        (trendStability * 0.10) +
        (deceptionRisk * 0.05) +
        (regionalWeight * 0.05)
      ));

      // Step 3: Calculate metadata
      const breakoutProbability = this.calculateBreakoutProbability({
        viralMomentum,
        trendVelocity,
        engagementQuality
      });

      const confidence = this.calculateConfidenceScore({
        globalSentiment,
        viralMomentum,
        engagementQuality,
        deceptionRisk
      });

      const riskLevel = this.calculateRiskLevel({
        deceptionRisk,
        trendStability,
        value
      });

      const result = {
        vtsSymbol,
        value,
        components: {
          globalSentiment,
          viralMomentum,
          trendVelocity,
          mentionVolume,
          engagementQuality,
          trendStability,
          deceptionRisk,
          regionalWeight
        },
        metadata: {
          breakoutProbability,
          confidence,
          riskLevel
        }
      };

      // Step 4: Cache result
      await this.cacheVPMXResult(vtsSymbol, result);

      // Step 5: Broadcast update
      await this.broadcastVPMXUpdate(result);

      return result;
    } catch (error) {
      this.logger.error(`Failed to compute VPMX for ${vtsSymbol}`, error);
      throw error;
    }
  }

  /**
   * Get current VPMX value (cached)
   */
  async getCurrentVPMX(vtsSymbol: string): Promise<any> {
    const cacheKey = `vpmx:current:${vtsSymbol}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Compute fresh value
    const result = await this.computeVPMX(vtsSymbol);
    return result;
  }

  /**
   * Get VPMX history
   */
  async getVPMXHistory(
    vtsSymbol: string,
    interval: '1m' | '5m' | '15m' | '1h' | '1d' = '1h',
    startDate?: Date,
    endDate?: Date,
    limit = 100
  ): Promise<any[]> {
    const where: any = { vtsSymbol };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    return await this.prisma.vpmxHistory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }

  /**
   * Batch compute VPMX for multiple symbols
   */
  async batchComputeVPMX(vtsSymbols: string[]): Promise<any[]> {
    const results = await Promise.allSettled(
      vtsSymbols.map(symbol => this.computeVPMX(symbol))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);
  }

  /**
   * Queue VPMX computation for background processing
   */
  async queueVPMXComputation(vtsSymbol: string, timestamp?: Date): Promise<string> {
    // This would integrate with BullMQ processor
    const jobId = `vpmx-${vtsSymbol}-${Date.now()}`;

    // In a real implementation, this would use the BullMQ processor
    // await this.vpmxQueue.add('compute', { vtsSymbol, timestamp, jobId });

    this.logger.log(`Queued VPMX computation for ${vtsSymbol}`);
    return jobId;
  }

  // Private Helper Methods

  private async getGlobalSentiment(vtsSymbol: string, timestamp?: Date): Promise<number> {
    try {
      // Get topic ID from VTS symbol
      const topicId = await this.getTopicIdFromVTS(vtsSymbol);
      if (!topicId) return 0.5; // Default neutral sentiment

      // Get sentiment data
      const sentiment = await this.sentimentService.getLatestSentiment(topicId);
      return sentiment ? (sentiment.scoreFloat + 1) / 2 : 0.5; // Normalize to 0-1
    } catch (error) {
      this.logger.warn(`Failed to get sentiment for ${vtsSymbol}`, error);
      return 0.5;
    }
  }

  private async getViralMomentum(vtsSymbol: string, timestamp?: Date): Promise<number> {
    try {
      const topicId = await this.getTopicIdFromVTS(vtsSymbol);
      if (!topicId) return 0.3;

      const viralIndex = await this.viralIndexService.getLatestIndex(topicId);
      return viralIndex ? Math.min(1, viralIndex.viralIndex / 100) : 0.3;
    } catch (error) {
      this.logger.warn(`Failed to get viral momentum for ${vtsSymbol}`, error);
      return 0.3;
    }
  }

  private async getTrendVelocity(vtsSymbol: string, timestamp?: Date): Promise<number> {
    try {
      // Calculate rate of change in VPMX over last hour
      const history = await this.getVPMXHistory(vtsSymbol, '1h',
        new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        new Date(),
        120
      );

      if (history.length < 2) return 0.5;

      const latest = history[0].value;
      const previous = history[history.length - 1].value;
      const timeDiff = history[0].timestamp.getTime() - history[history.length - 1].timestamp.getTime();
      const valueDiff = latest - previous;

      const velocity = (valueDiff / timeDiff) * 60 * 60 * 1000; // Normalize to per hour
      return Math.min(1, Math.max(0, (velocity + 500) / 1000)); // Normalize to 0-1
    } catch (error) {
      this.logger.warn(`Failed to get trend velocity for ${vtsSymbol}`, error);
      return 0.5;
    }
  }

  private async getMentionVolume(vtsSymbol: string, timestamp?: Date): Promise<number> {
    try {
      const topicId = await this.getTopicIdFromVTS(vtsSymbol);
      if (!topicId) return 0.2;

      // This would query mention volume from your ingestion system
      // For now, return normalized value
      return 0.6;
    } catch (error) {
      this.logger.warn(`Failed to get mention volume for ${vtsSymbol}`, error);
      return 0.2;
    }
  }

  private async getEngagementQuality(vtsSymbol: string, timestamp?: Date): Promise<number> {
    try {
      // Calculate quality of engagement (likes, shares, comments ratio)
      // This would analyze engagement patterns
      return 0.7; // Placeholder
    } catch (error) {
      this.logger.warn(`Failed to get engagement quality for ${vtsSymbol}`, error);
      return 0.5;
    }
  }

  private async getTrendStability(vtsSymbol: string, timestamp?: Date): Promise<number> {
    try {
      const history = await this.getVPMXHistory(vtsSymbol, '15m',
        new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        new Date(),
        16
      );

      if (history.length < 3) return 0.5;

      // Calculate variance in recent values
      const values = history.map(h => h.value);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Lower standard deviation = higher stability
      return Math.max(0, Math.min(1, 1 - (stdDev / 1000)));
    } catch (error) {
      this.logger.warn(`Failed to get trend stability for ${vtsSymbol}`, error);
      return 0.5;
    }
  }

  private async getDeceptionRisk(vtsSymbol: string, timestamp?: Date): Promise<number> {
    try {
      const topicId = await this.getTopicIdFromVTS(vtsSymbol);
      if (!topicId) return 0.9; // Assume low deception risk for unknown

      const deception = await this.deceptionService.getLatestDeceptionScore(topicId);
      // Return inverse of deception risk (lower risk = higher score)
      return deception ? Math.max(0, 1 - deception.drs) : 0.9;
    } catch (error) {
      this.logger.warn(`Failed to get deception risk for ${vtsSymbol}`, error);
      return 0.9;
    }
  }

  private async getRegionalWeight(vtsSymbol: string, timestamp?: Date): Promise<number> {
    try {
      // Extract region from VTS symbol
      const parts = vtsSymbol.split(':');
      const region = parts.length > 1 ? parts[1] : 'GLOBAL';

      // Regional weighting based on market significance
      const regionalWeights: Record<string, number> = {
        'US': 1.0,
        'GLOBAL': 0.9,
        'UK': 0.8,
        'EU': 0.7,
        'ZA': 0.6,
        'NG': 0.5
      };

      return regionalWeights[region] || 0.5;
    } catch (error) {
      this.logger.warn(`Failed to get regional weight for ${vtsSymbol}`, error);
      return 0.5;
    }
  }

  private calculateBreakoutProbability(components: {
    viralMomentum: number;
    trendVelocity: number;
    engagementQuality: number;
  }): number {
    const momentumScore = components.viralMomentum * 0.4;
    const velocityScore = components.trendVelocity * 0.4;
    const engagementScore = components.engagementQuality * 0.2;

    return Math.min(1, momentumScore + velocityScore + engagementScore);
  }

  private calculateConfidenceScore(components: {
    globalSentiment: number;
    viralMomentum: number;
    engagementQuality: number;
    deceptionRisk: number;
  }): number {
    const dataQuality = (components.globalSentiment + components.engagementQuality) / 2;
    const modelConfidence = 0.85; // Base model confidence
    const riskAdjustment = components.deceptionRisk * 0.3;

    return Math.max(0, Math.min(1, (dataQuality * 0.4) + (modelConfidence * 0.4) - riskAdjustment));
  }

  private calculateRiskLevel(components: {
    deceptionRisk: number;
    trendStability: number;
    value: number;
  }): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const riskScore = (1 - components.deceptionRisk) * components.trendStability;

    if (riskScore > 0.8) return 'LOW';
    if (riskScore > 0.6) return 'MEDIUM';
    if (riskScore > 0.4) return 'HIGH';
    return 'CRITICAL';
  }

  private async cacheVPMXResult(vtsSymbol: string, result: any): Promise<void> {
    const cacheKey = `vpmx:current:${vtsSymbol}`;
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
  }

  private async broadcastVPMXUpdate(result: any): Promise<void> {
    await this.wsGateway.broadcast('vpmx.update', {
      type: 'VPMX_UPDATE',
      data: {
        vtsSymbol: result.vtsSymbol,
        value: result.value,
        components: result.components,
        metadata: result.metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  private async getTopicIdFromVTS(vtsSymbol: string): Promise<string | null> {
    try {
      // Parse VTS symbol to extract topic information
      // VTS format: V:REGION:CATEGORY:IDENTIFIER
      const parts = vtsSymbol.split(':');
      if (parts.length < 3) return null;

      const identifier = parts.slice(2).join(':');

      // Query topics table for matching identifier
      const topic = await this.prisma.topic.findFirst({
        where: {
          OR: [
            { name: { contains: identifier, mode: 'insensitive' } },
            { slug: { contains: identifier, mode: 'insensitive' } },
          ]
        },
        select: { id: true }
      });

      return topic?.id || null;
    } catch (error) {
      this.logger.warn(`Failed to get topic ID from VTS symbol ${vtsSymbol}`, error);
      return null;
    }
  }
}
