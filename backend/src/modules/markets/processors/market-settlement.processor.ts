import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bullmq';
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
export class MarketSettlementProcessor {
  private readonly logger = new Logger(MarketSettlementProcessor.name);

  constructor(
    private readonly settlementService: MarketSettlementService,
  ) {}

  @Process('process-market-settlement')
  async handleMarketSettlement(job: Job<MarketSettlementJob>): Promise<any> {
    const { marketId, reason, winningOutcomeId, settlementMethod } = job.data;

    this.logger.log(`Processing market settlement for ${marketId}`);

    try {
      const result = await this.settlementService.settleMarket({
        marketId,
        reason,
        winningOutcomeId,
        settlementMethod: settlementMethod || 'AUTOMATIC',
      });

      this.logger.log(`Market settlement completed: ${marketId}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to process market settlement for ${marketId}:`, error);
      throw error;
    }
  }

  @Process('auto-close-market')
  async handleAutoCloseMarket(job: Job<MarketSettlementJob>): Promise<any> {
    const { marketId, scheduledCloseTime } = job.data;

    this.logger.log(`Auto-closing market: ${marketId} (scheduled: ${scheduledCloseTime})`);

    try {
      const result = await this.settlementService.settleMarket({
        marketId,
        reason: 'Auto-closure at scheduled time',
        settlementMethod: 'AUTOMATIC',
      });

      this.logger.log(`Auto-closure completed: ${marketId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to auto-close market ${marketId}:`, error);
      throw error;
    }
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`Market settlement job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Market settlement job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Market settlement job ${job.id} failed:`, error.message);
  }
}

@Processor('bet-processing')
export class BetProcessingProcessor {
  private readonly logger = new Logger(BetProcessingProcessor.name);

  @Process('process-new-bet')
  async handleNewBet(job: Job<MarketSettlementJob>): Promise<void> {
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

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`Bet processing job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Bet processing job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Bet processing job ${job.id} failed:`, error.message);
  }
}