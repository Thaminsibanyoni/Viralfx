import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VPMXComponents, VPMXResult, VPMXWeighting } from './interfaces/vpmx.interface';
import { SentimentModule } from '../sentiment/sentiment.module';
import { ViralModule } from '../viral/viral.module';
import { DeceptionModule } from '../deception/deception.module';

@Injectable()
export class VPMXComputationService {
  private readonly logger = new Logger(VPMXComputationService.name);
  private readonly DEFAULT_WEIGHTING: VPMXWeighting = {
    globalSentimentWeight: 0.20,
    viralMomentumWeight: 0.20,
    trendVelocityWeight: 0.15,
    mentionVolumeWeight: 0.15,
    engagementQualityWeight: 0.10,
    trendStabilityWeight: 0.10,
    deceptionRiskWeight: 0.05,
    regionalWeightingWeight: 0.05,
  };

  constructor(
    @InjectQueue('vpmx-computation') private readonly vpmxQueue: Queue,
    @InjectQueue('vpmx-weighting') private readonly weightingQueue: Queue,
  ) {}

  /**
   * Compute VPMX using the weighted composite formula
   */
  async computeVPMX(
    vtsSymbol: string,
    timestamp?: Date,
    weighting: VPMXWeighting = this.DEFAULT_WEIGHTING,
  ): Promise<VPMXResult> {
    this.logger.log(`Computing VPMX for ${vtsSymbol}`);

    // Get all required components
    const components = await this.getVPMXComponents(vtsSymbol, timestamp);

    // Apply weighted formula
    const value = this.applyWeightingFormula(components, weighting);

    // Calculate metadata
    const metadata = await this.computeMetadata(vtsSymbol, components, value);

    return {
      vtsSymbol,
      timestamp: timestamp || new Date(),
      value: Math.max(0, Math.min(1000, value)), // Clamp between 0-1000
      components,
      metadata,
    };
  }

  /**
   * Get all VPMX components from various modules
   */
  private async getVPMXComponents(
    vtsSymbol: string,
    timestamp?: Date,
  ): Promise<VPMXComponents> {
    // Parallel fetch all component data
    const [
      globalSentimentScore,
      viralMomentumIndex,
      trendVelocity,
      mentionVolumeData,
      engagementQuality,
      trendStability,
      deceptionRisk,
      regionalWeighting,
    ] = await Promise.all([
      this.getGlobalSentimentScore(vtsSymbol, timestamp),
      this.getViralMomentumIndex(vtsSymbol, timestamp),
      this.getTrendVelocity(vtsSymbol, timestamp),
      this.getMentionVolumeNormalized(vtsSymbol, timestamp),
      this.getEngagementQualityScore(vtsSymbol, timestamp),
      this.getTrendStability(vtsSymbol, timestamp),
      this.getDeceptionRiskInverse(vtsSymbol, timestamp),
      this.getRegionalWeighting(vtsSymbol, timestamp),
    ]);

    return {
      globalSentimentScore,
      viralMomentumIndex,
      trendVelocity,
      mentionVolumeNormalized: mentionVolumeData,
      engagementQualityScore: engagementQuality,
      trendStability,
      deceptionRiskInverse: deceptionRisk,
      regionalWeighting,
    };
  }

  /**
   * Apply the weighted VPMX formula
   */
  private applyWeightingFormula(
    components: VPMXComponents,
    weighting: VPMXWeighting,
  ): number {
    return (
      components.globalSentimentScore * weighting.globalSentimentWeight +
      components.viralMomentumIndex * weighting.viralMomentumWeight +
      components.trendVelocity * weighting.trendVelocityWeight +
      components.mentionVolumeNormalized * weighting.mentionVolumeWeight +
      components.engagementQualityScore * weighting.engagementQualityWeight +
      components.trendStability * weighting.trendStabilityWeight +
      components.deceptionRiskInverse * weighting.deceptionRiskWeight +
      components.regionalWeighting * weighting.regionalWeightingWeight
    ) * 1000; // Scale to 0-1000 range
  }

  /**
   * Compute VPMX metadata
   */
  private async computeMetadata(
    vtsSymbol: string,
    components: VPMXComponents,
    vpmxValue: number,
  ): Promise<any> {
    return {
      breakoutProbability: this.calculateBreakoutProbability(components, vpmxValue),
      smiCorrelation: await this.calculateSMICorrelation(vtsSymbol),
      volatilityIndex: this.calculateVolatilityIndex(components),
      confidenceScore: this.calculateConfidenceScore(components),
    };
  }

  // Component data retrieval methods
  private async getGlobalSentimentScore(vtsSymbol: string, timestamp?: Date): Promise<number> {
    // Integration with SentimentModule
    // Placeholder: would call sentiment service
    return 0.75; // 0-1 range
  }

  private async getViralMomentumIndex(vtsSymbol: string, timestamp?: Date): Promise<number> {
    // Integration with ViralModule
    // Placeholder: would call viral momentum service
    return 0.82; // 0-1 range
  }

  private async getTrendVelocity(vtsSymbol: string, timestamp?: Date): Promise<number> {
    // Calculate rate of change in mentions/engagement
    // Placeholder implementation
    return 0.68; // 0-1 range
  }

  private async getMentionVolumeNormalized(vtsSymbol: string, timestamp?: Date): Promise<number> {
    // Normalize mention volume to 0-1 range
    // Placeholder implementation
    return 0.71; // 0-1 range
  }

  private async getEngagementQualityScore(vtsSymbol: string, timestamp?: Date): Promise<number> {
    // Calculate quality of engagement (likes, shares, comments ratio)
    // Placeholder implementation
    return 0.64; // 0-1 range
  }

  private async getTrendStability(vtsSymbol: string, timestamp?: Date): Promise<number> {
    // Calculate stability of trend over time
    // Placeholder implementation
    return 0.77; // 0-1 range
  }

  private async getDeceptionRiskInverse(vtsSymbol: string, timestamp?: Date): Promise<number> {
    // Integration with DeceptionModule
    // Return inverse of deception risk (lower risk = higher score)
    const deceptionRisk = 0.15; // 15% deception risk
    return 1 - deceptionRisk; // 0.85
  }

  private async getRegionalWeighting(vtsSymbol: string, timestamp?: Date): Promise<number> {
    // Calculate regional relevance weighting
    // Placeholder implementation
    return 0.73; // 0-1 range
  }

  // Metadata calculation methods
  private calculateBreakoutProbability(components: VPMXComponents, vpmxValue: number): number {
    // Calculate probability of trend breaking out
    const momentumScore = components.viralMomentumIndex;
    const velocityScore = components.trendVelocity;
    const stabilityScore = components.trendStability;

    return Math.min(1, (momentumScore + velocityScore + stabilityScore) / 2.5);
  }

  private async calculateSMICorrelation(vtsSymbol: string): Promise<number> {
    // Calculate correlation with Social Mood Index
    // Placeholder implementation
    return 0.67; // 0-1 range
  }

  private calculateVolatilityIndex(components: VPMXComponents): number {
    // Calculate volatility based on component variance
    const values = Object.values(components);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    return Math.min(1, Math.sqrt(variance) * 2);
  }

  private calculateConfidenceScore(components: VPMXComponents): number {
    // Calculate overall confidence in the VPMX score
    const dataQuality = this.assessDataQuality(components);
    const modelConfidence = 0.85; // Placeholder model confidence

    return (dataQuality + modelConfidence) / 2;
  }

  private assessDataQuality(components: VPMXComponents): number {
    // Assess the quality and completeness of component data
    const values = Object.values(components);
    const validValues = values.filter(val => !isNaN(val) && isFinite(val));

    return validValues.length / values.length;
  }

  /**
   * Queue VPMX computation for background processing
   */
  async queueVPMXComputation(
    vtsSymbol: string,
    timestamp?: Date,
    force = false,
  ): Promise<string> {
    const job = await this.vpmxQueue.add(
      'compute-index',
      {
        vtsSymbol,
        timestamp: timestamp?.toISOString(),
        force,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    return job.id!;
  }

  /**
   * Update VPMX weighting configuration
   */
  async updateWeighting(weighting: VPMXWeighting): Promise<void> {
    await this.weightingQueue.add('update-weighting', weighting);
  }

  /**
   * Batch compute VPMX for multiple symbols
   */
  async batchComputeVPMX(
    vtsSymbols: string[],
    timestamp?: Date,
  ): Promise<VPMXResult[]> {
    const jobs = vtsSymbols.map(symbol =>
      this.queueVPMXComputation(symbol, timestamp)
    );

    // Return job IDs for tracking
    return await Promise.all(
      jobs.map(async (jobId) => {
        // Wait for job completion or timeout
        const job = await this.vpmxQueue.getJob(jobId);
        return job?.waitUntilFinished(Date.now() + 30000);
      })
    );
  }
}