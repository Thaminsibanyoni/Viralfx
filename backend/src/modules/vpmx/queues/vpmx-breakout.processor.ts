import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from "bull";
import { Logger } from "@nestjs/common";
import { VPMXCoreService } from '../services/vpmx-core.service';

export interface VPMBreakoutJob {
  symbol: string;
  priceData: number[];
  volumeData: number[];
  timeframe: string;
}

@Processor("vpmx-breakout")
export class VPMBreakoutProcessor extends WorkerHost {
  private readonly logger = new Logger(VPMBreakoutProcessor.name);

  constructor(private readonly vpmxCoreService: VPMXCoreService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'detect-breakout':
        return this.handleDetectBreakout(job);
      case 'analyze-breakout-strength':
        return this.handleAnalyzeBreakoutStrength(job);
      case 'validate-breakout':
        return this.handleValidateBreakout(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async handleDetectBreakout(job: Job<VPMBreakoutJob>) {
    try {
      const { symbol, priceData, volumeData, timeframe } = job.data;
      this.logger.log(
        `Processing breakout detection for ${symbol} (${timeframe})`
      );

      // Detect breakout patterns using the core service
      const breakout = await this.vpmxCoreService.detectBreakout(
        symbol,
        priceData,
        volumeData,
        timeframe
      );

      this.logger.log(
        `Breakout analysis completed for ${symbol}: ${JSON.stringify(breakout)}`);

      return {
        success: true,
        breakout,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(
        `Failed to detect breakout: ${error.message}`,
        error.stack);
      throw error;
    }
  }

  private async handleAnalyzeBreakoutStrength(
    job: Job<{
      symbol: string;
      breakoutPattern: Record<string, any>;
      marketData: Record<string, any>;
    }>
  ) {
    try {
      const { symbol, breakoutPattern, marketData } = job.data;
      this.logger.log(`Analyzing breakout strength for ${symbol}`);

      // Analyze the strength of detected breakout
      const strength = await this.vpmxCoreService.analyzeBreakoutStrength(
        symbol,
        breakoutPattern,
        marketData
      );

      this.logger.log(
        `Breakout strength analysis completed for ${symbol}: ${strength.score}`);

      return {
        success: true,
        strength,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze breakout strength: ${error.message}`,
        error.stack);
      throw error;
    }
  }

  private async handleValidateBreakout(
    job: Job<{
      symbol: string;
      breakoutData: Record<string, any>;
      validationPeriod: number;
    }>
  ) {
    try {
      const { symbol, breakoutData, validationPeriod } = job.data;
      this.logger.log(
        `Validating breakout for ${symbol} over ${validationPeriod} periods`);

      // Validate if the breakout was successful
      const validation = await this.vpmxCoreService.validateBreakout(
        symbol,
        breakoutData,
        validationPeriod
      );

      this.logger.log(
        `Breakout validation completed for ${symbol}: ${validation.isValid}`);

      return {
        success: true,
        validation,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(
        `Failed to validate breakout: ${error.message}`,
        error.stack);
      throw error;
    }
  }
}