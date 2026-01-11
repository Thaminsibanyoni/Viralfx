import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from "bull";
import { Logger } from "@nestjs/common";
import { VPMXCoreService } from '../services/vpmx-core.service';

export interface VPMPredictionJob {
  symbol: string;
  timeframe: string;
  features: Record<string, any>;
}

@Processor("vpmx-prediction")
export class VPMPredictionProcessor extends WorkerHost {
  private readonly logger = new Logger(VPMPredictionProcessor.name);

  constructor(private readonly vpmxCoreService: VPMXCoreService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'predict-movement':
        return this.handlePredictMovement(job);
      case 'batch-predict':
        return this.handleBatchPredict(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async handlePredictMovement(job: Job<VPMPredictionJob>) {
    try {
      const { symbol, timeframe, features } = job.data;
      this.logger.log(`Processing prediction job for ${symbol} (${timeframe})`);

      // Generate prediction using the core service
      const prediction = await this.vpmxCoreService.generatePrediction(
        symbol,
        features
      );

      this.logger.log(
        `Prediction generated for ${symbol}: ${JSON.stringify(prediction)}`);

      return {
        success: true,
        prediction,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(
        `Failed to process prediction job: ${error.message}`,
        error.stack);
      throw error;
    }
  }

  private async handleBatchPredict(job: Job<{ symbols: string[]; timeframe: string }>) {
    try {
      const { symbols, timeframe } = job.data;
      this.logger.log(
        `Processing batch prediction for ${symbols.length} symbols`);

      const predictions = await Promise.allSettled(
        symbols.map(async (symbol) => {
          const features = await this.vpmxCoreService.extractFeatures(symbol);
          return await this.vpmxCoreService.generatePrediction(
            symbol,
            features
          );
        })
      );

      const results = predictions.map((result, index) => ({
        symbol: symbols[index],
        success: result.status === "fulfilled",
        prediction: result.status === "fulfilled" ? result.value : null,
        error: result.status === "rejected" ? result.reason.message : null,
      }));

      this.logger.log(
        `Batch prediction completed for ${results.length} symbols`);

      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(
        `Failed to process batch prediction: ${error.message}`,
        error.stack);
      throw error;
    }
  }
}