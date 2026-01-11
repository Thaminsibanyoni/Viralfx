import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

import { BacktestingService } from '../services/backtesting.service';
import { PerformanceService } from '../services/performance.service';
// WebSocketGateway import removed - not a valid NestJS injection pattern
// import { WebSocketGatewayHandler } from "../../websocket/gateways/websocket.gateway";
import { BacktestConfig, OptimizationResult } from '../interfaces/backtesting.interface';

@Processor('analytics-backtest')
export class BacktestProcessor extends WorkerHost {
  private readonly logger = new Logger(BacktestProcessor.name);

  constructor(
    private readonly backtestingService: BacktestingService,
    private readonly performanceService: PerformanceService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'run':
        return this.processBacktest(job);
      case 'optimize':
        return this.processOptimization(job);
      case 'compare':
        return this.processComparison(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async processBacktest(job: Job<{
    config: BacktestConfig;
    backtestId: string;
    userId?: string;
    timestamp: Date;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing backtest job ${job.id}: ${job.data.backtestId}`);

      // Update job progress to 10%
      await job.updateProgress(10);

      // Run the backtest
      const result = await this.backtestingService.runBacktest(job.data.config);

      // Update job progress to 80%
      await job.updateProgress(80);

      // Calculate additional performance metrics
      const performanceMetrics = await this.performanceService.calculatePerformanceMetrics(result);

      // Combine results
      const completeResult = {
        ...result,
        performanceMetrics,
        userId: job.data.userId
      };

      // Save result (this is handled in the service, but we ensure completion)
      await job.updateProgress(95);

      // TODO: Re-enable WebSocket broadcast using proper NestJS pattern
      // Broadcast completion via WebSocket
      // if (job.data.userId) {
      //   this.webSocketGateway.broadcastBacktestCompleted(job.data.userId, completeResult);
      // }

      // Final progress update
      await job.updateProgress(100);

      this.logger.log(`Backtest completed: ${job.data.backtestId}`);
      return completeResult;

    } catch (error) {
      this.logger.error(`Backtest job ${job.id} failed:`, error);

      // TODO: Re-enable WebSocket broadcast using proper NestJS pattern
      // Broadcast failure via WebSocket
      // if (job.data.userId) {
      //   this.webSocketGateway.broadcastBacktestCompleted(job.data.userId, {
      //     id: job.data.backtestId,
      //     status: 'FAILED',
      //     error: error.message,
      //     config: job.data.config
      //   } as any);
      // }

      throw error;
    }
  }

  private async processOptimization(job: Job<{
    strategyId: string;
    symbol: string;
    startTime: Date;
    endTime: Date;
    initialCapital: number;
    parameterRanges: Record<string, { min: number; max: number; step: number }>;
    optimizationMetric: string;
    maxIterations: number;
    userId?: string;
    timestamp: Date;
  }>): Promise<OptimizationResult> {
    try {
      this.logger.log(`Processing optimization job ${job.id} for strategy ${job.data.strategyId}`);

      const {
        strategyId,
        symbol,
        startTime,
        endTime,
        initialCapital,
        parameterRanges,
        optimizationMetric,
        maxIterations,
        userId
      } = job.data;

      // Generate parameter combinations
      const parameterCombinations = this.generateParameterCombinations(
        parameterRanges,
        maxIterations
      );

      this.logger.log(`Generated ${parameterCombinations.length} parameter combinations to test`);

      let bestResult = null;
      let bestParameters = null;
      let bestMetricValue = optimizationMetric === 'maxDrawdown' ? Infinity : -Infinity;

      const allResults = [];

      // Test each parameter combination
      for (let i = 0; i < parameterCombinations.length; i++) {
        const parameters = parameterCombinations[i];

        try {
          // Create backtest config with current parameters
          const config: BacktestConfig = {
            strategyId,
            symbol,
            startTime,
            endTime,
            initialCapital,
            parameters
          };

          // Run backtest
          const result = await this.backtestingService.runBacktest(config);
          allResults.push(result);

          // Calculate performance metrics
          const performanceMetrics = await this.performanceService.calculatePerformanceMetrics(result);
          const metricValue = performanceMetrics[optimizationMetric as keyof typeof performanceMetrics];

          // Check if this is the best result
          const isBetter = this.isMetricBetter(metricValue, bestMetricValue, optimizationMetric);
          if (isBetter) {
            bestResult = result;
            bestParameters = parameters;
            bestMetricValue = metricValue;
          }

          // Update progress (80% for parameter testing, 20% for final processing)
          const progress = Math.floor((i / parameterCombinations.length) * 80) + 10;
          await job.updateProgress(progress);

          // Send progress update every 10% or for last iteration
          if (i % Math.max(1, Math.floor(parameterCombinations.length / 10)) === 0 || i === parameterCombinations.length - 1) {
            // TODO: Re-enable WebSocket broadcast using proper NestJS pattern
            // if (userId) {
            //   this.webSocketGateway.broadcastBacktestCompleted(userId, {
            //     id: `optimization_${job.id}`,
            //     status: 'RUNNING',
            //     progress,
            //     currentBest: bestMetricValue,
            //     iterationsCompleted: i + 1,
            //     totalIterations: parameterCombinations.length
            //   } as any);
            // }
          }

        } catch (error) {
          this.logger.warn(`Failed to test parameters ${JSON.stringify(parameters)}:`, error);
          continue;
        }
      }

      // Final processing
      await job.updateProgress(90);

      const optimizationResult: OptimizationResult = {
        strategyId,
        bestParameters: bestParameters || {},
        bestResult: bestResult || (allResults.length > 0 ? allResults[0] : null),
        allResults,
        totalIterations: parameterCombinations.length
      };

      await job.updateProgress(100);

      // TODO: Re-enable WebSocket broadcast using proper NestJS pattern
      // Broadcast completion
      // if (userId) {
      //   this.webSocketGateway.broadcastBacktestCompleted(userId, {
      //     id: `optimization_${job.id}`,
      //     status: 'COMPLETED',
      //     result: optimizationResult
      //   } as any);
      // }

      this.logger.log(`Optimization completed for strategy ${strategyId}. Best ${optimizationMetric}: ${bestMetricValue}`);
      return optimizationResult;

    } catch (error) {
      this.logger.error(`Optimization job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async processComparison(job: Job<{
    strategyIds: string[];
    symbol: string;
    startTime: Date;
    endTime: Date;
    initialCapital: number;
    userId?: string;
    timestamp: Date;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing comparison job ${job.id} for ${job.data.strategyIds.length} strategies`);

      const { strategyIds, symbol, startTime, endTime, initialCapital, userId } = job.data;

      const results = [];
      const concurrency = 3; // Run up to 3 backtests in parallel
      const chunks = this.chunkArray(strategyIds, concurrency);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];

        // Run backtests in parallel for this chunk
        const chunkPromises = chunk.map(async (strategyId, index) => {
          try {
            const config: BacktestConfig = {
              strategyId,
              symbol,
              startTime,
              endTime,
              initialCapital
            };

            const result = await this.backtestingService.runBacktest(config);
            const performanceMetrics = await this.performanceService.calculatePerformanceMetrics(result);

            return {
              strategyId,
              strategyName: result.strategyId, // This would be populated from strategy data
              result,
              performanceMetrics
            };
          } catch (error) {
            this.logger.warn(`Failed to backtest strategy ${strategyId}:`, error);
            return null;
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults.filter(result => result !== null));

        // Update progress
        const progress = Math.floor(((chunkIndex + 1) / chunks.length) * 90);
        await job.updateProgress(progress);

        // TODO: Re-enable WebSocket broadcast using proper NestJS pattern
        // Send progress update
        // if (userId) {
        //   this.webSocketGateway.broadcastBacktestCompleted(userId, {
        //     id: `comparison_${job.id}`,
        //     status: 'RUNNING',
        //     progress,
        //     completedStrategies: results.length,
        //     totalStrategies: strategyIds.length
        //   } as any);
        // }
      }

      // Sort results by performance metric (e.g., total return)
      results.sort((a, b) => b.result.totalReturn - a.result.totalReturn);

      // Create comparison analysis
      const comparisonAnalysis = {
        strategies: results,
        ranking: results.map((result, index) => ({
          rank: index + 1,
          strategyId: result.strategyId,
          strategyName: result.strategyName,
          totalReturn: result.result.totalReturn,
          sharpeRatio: result.performanceMetrics.sharpeRatio,
          maxDrawdown: result.performanceMetrics.maxDrawdown,
          winRate: result.performanceMetrics.winRate
        })),
        summary: {
          bestStrategy: results[0],
          worstStrategy: results[results.length - 1],
          averageReturn: results.reduce((sum, r) => sum + r.result.totalReturn, 0) / results.length,
          averageSharpe: results.reduce((sum, r) => sum + r.performanceMetrics.sharpeRatio, 0) / results.length
        }
      };

      await job.updateProgress(100);

      // TODO: Re-enable WebSocket broadcast using proper NestJS pattern
      // Broadcast completion
      // if (userId) {
      //   this.webSocketGateway.broadcastBacktestCompleted(userId, {
      //     id: `comparison_${job.id}`,
      //     status: 'COMPLETED',
      //     result: comparisonAnalysis
      //   } as any);
      // }

      this.logger.log(`Comparison completed for ${results.length} strategies`);
      return comparisonAnalysis;

    } catch (error) {
      this.logger.error(`Comparison job ${job.id} failed:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Backtest job ${job.id} started processing`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`Backtest job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Backtest job ${job.id} failed:`, error);
  }

  // Helper methods

  private generateParameterCombinations(
    parameterRanges: Record<string, { min: number; max: number; step: number }>,
    maxIterations: number
  ): Array<Record<string, number>> {
    const combinations: Array<Record<string, number>> = [];
    const parameterNames = Object.keys(parameterRanges);

    // Generate combinations using a simple grid search approach
    // In a real implementation, you might use more sophisticated optimization algorithms
    const stepsPerParameter = Math.ceil(Math.pow(maxIterations, 1 / parameterNames.length));

    const generateCombinations = (
      index: number,
      currentParams: Record<string, number>
    ): void => {
      if (index >= parameterNames.length) {
        combinations.push({ ...currentParams });
        return;
      }

      const paramName = parameterNames[index];
      const range = parameterRanges[paramName];
      const stepSize = (range.max - range.min) / (stepsPerParameter - 1);

      for (let i = 0; i < stepsPerParameter && combinations.length < maxIterations; i++) {
        const value = range.min + (i * stepSize);
        currentParams[paramName] = Math.round(value * 100) / 100; // Round to 2 decimal places
        generateCombinations(index + 1, currentParams);
      }
    };

    generateCombinations(0, {});
    return combinations.slice(0, maxIterations);
  }

  private isMetricBetter(
    newValue: number,
    bestValue: number,
    metric: string
  ): boolean {
    switch (metric) {
      case 'totalReturn':
      case 'sharpeRatio':
      case 'winRate':
      case 'profitFactor':
      case 'alpha':
        return newValue > bestValue;
      case 'maxDrawdown':
      case 'volatility':
        return newValue < bestValue; // Lower is better
      default:
        return newValue > bestValue;
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
