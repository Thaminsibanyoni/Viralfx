import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../market-aggregation/entities/order.entity';
import { register, Registry } from 'prom-client';

import { SettlementService } from '../services/settlement.service';
import { WebSocketGateway } from '../../websocket/gateways/websocket.gateway';
import { NotificationService } from '../../notification/services/notification.service';

interface SettleBetJob {
  betId: string;
}

interface SettleMarketJob {
  marketId: string;
  settlementValue: number;
  proof: any;
  signature?: string;
}

interface SettleOrderJob {
  orderId: string;
}

@Processor('order-settlement')
@Injectable()
export class SettlementProcessor {
  private readonly logger = new Logger(SettlementProcessor.name);

  // Prometheus metrics
  private readonly settlementDuration = new register.Histogram({
    name: 'settlement_duration_seconds',
    help: 'Duration of order settlement processing',
    labelNames: ['queue', 'error'],
  });

  private readonly settlementSuccess = new register.Counter({
    name: 'settlement_success_total',
    help: 'Total number of successful settlements',
    labelNames: ['queue'],
  });

  private readonly settlementFailure = new register.Counter({
    name: 'settlement_failure_total',
    help: 'Total number of failed settlements',
    labelNames: ['queue'],
  });

  constructor(
    private readonly settlementService: SettlementService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly notificationService: NotificationService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly registry: Registry,
  ) {
    registry.registerMetric(this.settlementDuration);
    registry.registerMetric(this.settlementSuccess);
    registry.registerMetric(this.settlementFailure);
  }

  @Process('settle-bet')
  async settleBet(job: Job<SettleBetJob>): Promise<void> {
    try {
      const { betId } = job.data;
      this.logger.log(`Processing bet settlement for ${betId}`);

      const result = await this.settlementService.settleBet(betId);

      // Broadcast settlement result
      await this.webSocketGateway.server?.emit('bet:settled', {
        betId,
        success: result.success,
        payout: result.payout,
        status: result.status,
        timestamp: result.timestamp,
      });

      // Send comprehensive notification
      await this.notificationService.sendNotification({
        userId: await this.getUserIdFromBet(betId),
        type: 'BET_SETTLEMENT_COMPLETE',
        title: `Bet ${result.status}`,
        message: `Your bet has been settled. Payout: ${result.payout}`,
        metadata: {
          betId,
          payout: result.payout,
          status: result.status,
        },
      });

      this.logger.log(`Bet settlement completed for ${betId}. Status: ${result.status}`);
    } catch (error) {
      this.logger.error(`Failed to settle bet ${job.data.betId}:`, error);
      throw error;
    }
  }

  @Process('settle-market')
  async settleMarket(job: Job<SettleMarketJob>): Promise<void> {
    try {
      const { marketId, settlementValue, proof, signature } = job.data;
      this.logger.log(`Processing market settlement for ${marketId}`);

      await this.settlementService.settleMarket(marketId, settlementValue, proof, signature);

      // Trigger bulk bet settlement
      await this.settlementService.bulkSettleBets(marketId);

      // Broadcast market settlement
      await this.webSocketGateway.server?.emit('market:settlement:processed', {
        marketId,
        settlementValue,
        timestamp: new Date(),
      });

      // Notify all market subscribers
      await this.notifyMarketSubscribers(marketId, {
        type: 'MARKET_SETTLED',
        marketId,
        settlementValue,
        timestamp: new Date(),
      });

      this.logger.log(`Market settlement completed for ${marketId}`);
    } catch (error) {
      this.logger.error(`Failed to settle market ${job.data.marketId}:`, error);
      throw error;
    }
  }

  @Process('settle-order')
  async settleOrder(job: Job<SettleOrderJob>): Promise<void> {
    const start = process.hrtime.bigint();
    try {
      const { orderId } = job.data;
      this.logger.log(`Processing order settlement for ${orderId}`);

      // Get order details for user-specific broadcasting
      const order = await this.orderRepository.findOne({ where: { id: orderId }, relations: ['user'] });
      if (!order || order.status !== 'FILLED') {
        throw new Error(`Invalid order ${orderId} for settlement`);
      }

      await this.settlementService.processOrderSettlement(orderId);

      // Broadcast order settlement to specific user
      await this.webSocketGateway.broadcastToUser(order.userId, 'order:settled', {
        orderId: job.data.orderId,
        status: 'SETTLED',
        timestamp: new Date(),
      });

      // Send notification to user
      await this.notificationService.sendNotification({
        userId: order.userId,
        type: 'ORDER_SETTLED',
        title: 'Order Settled',
        message: `Order ${orderId} settled successfully.`,
        metadata: { orderId: job.data.orderId },
      });

      // Update Prometheus metrics
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e9;
      this.settlementDuration.observe({ queue: 'order-settlement' }, duration);
      this.settlementSuccess.inc({ queue: 'order-settlement' });

      this.logger.log(`Order settlement completed for ${orderId}`);
    } catch (error) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e9;
      this.settlementDuration.observe({ queue: 'order-settlement', error: 'true' }, duration);
      this.settlementFailure.inc({ queue: 'order-settlement' });

      this.logger.error(`Failed to settle order ${job.data.orderId}:`, error);
      throw error;
    }
  }

  @Process('bulk-settle-bets')
  async bulkSettleBets(job: Job<{ marketId: string }>): Promise<void> {
    try {
      const { marketId } = job.data;
      this.logger.log(`Processing bulk bet settlement for market ${marketId}`);

      await this.settlementService.bulkSettleBets(marketId);

      this.logger.log(`Bulk bet settlement completed for market ${marketId}`);
    } catch (error) {
      this.logger.error(`Failed to bulk settle bets for market ${job.data.marketId}:`, error);
      throw error;
    }
  }

  @Process('retry-failed-settlements')
  async retryFailedSettlements(): Promise<void> {
    try {
      this.logger.log('Retrying failed settlements');

      await this.settlementService.retryFailedSettlements();

      this.logger.log('Failed settlements retry completed');
    } catch (error) {
      this.logger.error('Failed to retry failed settlements:', error);
      throw error;
    }
  }

  @OnQueueFailed()
  async onQueueFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`Settlement job ${job.id} failed after ${job.attemptsMade} attempts:`, error);

    // Move to dead letter queue after max attempts
    if (job.opts.attempts >= 5) {
      await this.moveToDeadLetterQueue(job);
      await this.notifyAdmins({
        type: 'CRITICAL',
        title: 'Order Settlement Failure',
        message: `Settlement for ${job.data.orderId} failed: ${error.message}`,
        metadata: {
          jobId: job.id,
          orderId: job.data.orderId,
          attempts: job.attemptsMade,
          error: error.stack,
        },
        priority: 'high',
      });
    }
  }

  private async getUserIdFromBet(betId: string): Promise<string> {
    // This would need to be implemented using the bet repository
    // For now, return a mock user ID
    return 'user-id-from-bet';
  }

  private async notifyMarketSubscribers(marketId: string, notification: any): Promise<void> {
    try {
      // Broadcast to all subscribers of the market
      await this.webSocketGateway.server?.emit(`market:${marketId}:notification`, notification);

      // Send push notifications to active bettors
      await this.notificationService.sendBulkNotification({
        type: 'MARKET_SETTLED',
        title: 'Market Settled',
        message: `Market ${marketId} has been settled`,
        metadata: notification,
        filters: { marketId },
      });
    } catch (error) {
      this.logger.error('Failed to notify market subscribers:', error);
    }
  }

  private async moveToDeadLetterQueue(job: Job): Promise<void> {
    try {
      this.logger.warn(`Moving job ${job.id} to dead letter queue`);

      // Create a dead letter queue job with increased priority
      await job.queue.add('dlq-settlement', job.data, {
        attempts: 1,
        priority: 10,
        delay: 0,
        removeOnComplete: 100,
        removeOnFail: 10,
        lifo: false,
      });
    } catch (error) {
      this.logger.error('Failed to move job to dead letter queue:', error);
    }
  }

  private async notifyAdmins(notification: any): Promise<void> {
    try {
      // Send notification to admin users
      await this.notificationService.sendAdminNotification({
        type: 'SYSTEM_ALERT',
        title: 'Settlement Failure',
        message: `Critical settlement failure: ${notification.error}`,
        metadata: notification,
        priority: 'high',
      });

      this.logger.warn(`Admin notification sent: ${JSON.stringify(notification)}`);
    } catch (error) {
      this.logger.error('Failed to notify admins:', error);
    }
  }
}