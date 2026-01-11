import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MarketSettlementService } from '../services/market-settlement.service';

interface MarketSettlementJob {
  type: 'process-market-settlement' | 'auto-close-market' | 'process-new-bet';
  data: {
    marketId?: string;
    reason?: string;
    winningOutcomeId?: string;
    settlementMethod?: 'MANUAL' | 'AUTOMATIC';
    settlementData?: any;
    betId?: string;
    marketId?: string;
    outcomeId?: string;
    amount?: number;
    userId?: string;
  };
}

@Processor('market-settlement')
export class MarketSettlementProcessor extends WorkerHost {
  private readonly logger = new Logger(MarketSettlementProcessor.name);

  constructor(
    private readonly settlementService: MarketSettlementService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'process-market-settlement':
        return this.handleMarketSettlement(job);
      case 'auto-close-market':
        return this.handleAutoCloseMarket(job);
      case 'process-new-bet':
        return this.handleNewBet(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async handleMarketSettlement(job: Job<MarketSettlementJob>): Promise<any> {
    const { marketId, reason, winningOutcomeId, settlementMethod } = job.data;

    this.logger.log(`Processing market settlement for ${marketId}`);

    try {
      const result = await this.settlementService.settleMarket({
        marketId,
        reason,
        winningOutcomeId,
        settlementMethod: settlementMethod || 'AUTOMATIC'
      });

      this.logger.log(`Market settlement completed: ${marketId}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to process market settlement for ${marketId}:`, error);
      throw error;
    }
  }

  private async handleAutoCloseMarket(job: Job<MarketSettlementJob>): Promise<any> {
    const { marketId, scheduledCloseTime } = job.data;

    this.logger.log(`Auto-closing market: ${marketId} (scheduled: ${scheduledCloseTime})`);

    try {
      const result = await this.settlementService.settleMarket({
        marketId,
        reason: 'Auto-closure at scheduled time',
        settlementMethod: 'AUTOMATIC'
      });

      this.logger.log(`Auto-closure completed: ${marketId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to auto-close market ${marketId}:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onJobActive(job: Job) {
    this.logger.debug(`Market settlement job ${job.id} started processing`);
  }

  @OnWorkerEvent('completed')
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Market settlement job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Market settlement job ${job.id} failed:`, error.message);
  }
}

@Processor('bet-processing')
export class BetProcessingProcessor {
  private readonly logger = new Logger(BetProcessingProcessor.name);

  private async handleNewBet(job: Job<MarketSettlementJob>): Promise<void> {
    const { betId, marketId, outcomeId, amount, userId } = job.data;

    this.logger.log(`Processing new bet: ${betId} - User: ${userId}, Market: ${marketId}`);

    try {
      // This would handle bet validation, risk assessment, and market price updates
      // For now, just log the processing

      // Update market prices based on new betting patterns
      // This would typically be handled by a separate pricing service

      this.logger.debug(`New bet processed: ${betId}`);
    } catch (error) {
      this.logger.error(`Failed to process new bet ${betId}:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onJobActive(job: Job) {
    this.logger.debug(`Bet processing job ${job.id} started processing`);
  }

  @OnWorkerEvent('completed')
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Bet processing job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Bet processing job ${job.id} failed:`, error.message);
  }
}
