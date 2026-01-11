import {Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

import { MatchingEngineService } from '../services/matching-engine.service';
import { OrderBookService } from '../services/order-book.service';
import { Order } from "../../market-aggregation/interfaces/order.interface";

interface OrderExecutionJob {
  orderId: string;
  userId: string;
  orderData: Partial<Order>;
}

interface MatchOrdersJob {
  symbol: string;
  force?: boolean;
}

@Processor('order-execution')
export class OrderExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderExecutionProcessor.name);

  constructor(
    private readonly matchingEngineService: MatchingEngineService,
    private readonly orderBookService: OrderBookService,
    @InjectQueue('order-settlement')
    private readonly settlementQueue: Queue) {}

  private async executeOrder(job: Job<OrderExecutionJob>): Promise<void> {
    try {
      const { orderId, userId, orderData } = job.data;
      this.logger.log(`Processing order execution for order ${orderId}`);

      // Create order entity from job data
      const order = Object.assign(new Order(), orderData);
      order.id = orderId;
      order.userId = userId;

      // Execute the order
      const result = await this.matchingEngineService.executeOrder(order);

      if (result.success) {
        // Broadcast order update
        await this.webSocketGateway.broadcastOrderFilled(result.order);

        // If order was filled, queue settlement
        if (result.order.status === 'FILLED') {
          await this.settlementQueue.add('settle-order', { orderId: result.order.id }, {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 5000
            },
            removeOnComplete: 10,
            removeOnFail: 50
          });
          this.logger.log(`Settlement job queued for filled order ${result.order.id}`);
        }
      } else {
        // Broadcast rejection
        await this.webSocketGateway.server?.to(`user:${userId}`).emit('order:rejected', {
          orderId,
          reason: result.errors.join('; '),
          timestamp: new Date()
        });
      }

      this.logger.log(`Order execution completed for ${orderId}. Status: ${result.order.status}`);
    } catch (error) {
      this.logger.error(`Failed to execute order in job ${job.id}:`, error);
      throw error;
    }
  }

  private async matchOrders(job: Job<MatchOrdersJob>): Promise<void> {
    try {
      const { symbol, force } = job.data;
      this.logger.log(`Processing order matching for symbol ${symbol}`);

      // Check if we should proceed with matching
      if (!force) {
        const orderBook = await this.orderBookService.getOrderBook(symbol);
        if (!orderBook || (!orderBook.bids.length && !orderBook.asks.length)) {
          this.logger.debug(`No orders to match for ${symbol}`);
          return;
        }
      }

      // Execute matching
      const matches = await this.orderBookService.matchOrders(symbol);

      // Broadcast matches
      if (matches.length > 0) {
        await this.webSocketGateway.server?.emit('market:matched', {
          symbol,
          matches,
          timestamp: new Date()
        });

        // Queue settlement for filled orders
        const settlementPromises = [];
        for (const match of matches) {
          // Add settlement job for bid order
          settlementPromises.push(
            this.settlementQueue.add('settle-order', { orderId: match.bidOrderId }, {
              attempts: 5,
              backoff: {
                type: 'exponential',
                delay: 5000
              },
              removeOnComplete: 10,
              removeOnFail: 50
            })
          );

          // Add settlement job for ask order
          settlementPromises.push(
            this.settlementQueue.add('settle-order', { orderId: match.askOrderId }, {
              attempts: 5,
              backoff: {
                type: 'exponential',
                delay: 5000
              },
              removeOnComplete: 10,
              removeOnFail: 50
            })
          );

          this.logger.log(`Settlement jobs queued for matched orders: bid=${match.bidOrderId}, ask=${match.askOrderId}`);
        }

        // Wait for all settlement jobs to be queued
        await Promise.all(settlementPromises);
      }

      this.logger.log(`Order matching completed for ${symbol}. ${matches.length} matches found`);
    } catch (error) {
      this.logger.error(`Failed to match orders for symbol ${job.data.symbol}:`, error);
      throw error;
    }
  }

  private async processStopOrders(job: Job<{ symbol: string; currentPrice: number }>): Promise<void> {
    try {
      const { symbol, currentPrice } = job.data;
      this.logger.log(`Processing stop orders for ${symbol} at price ${currentPrice}`);

      // Process stop orders
      const triggeredStopOrders = await this.orderBookService.processStopOrders(symbol, currentPrice);

      // Process take profit orders
      const triggeredTakeProfitOrders = await this.orderBookService.processTakeProfitOrders(symbol, currentPrice);

      const allTriggeredOrders = [...triggeredStopOrders, ...triggeredTakeProfitOrders];

      // Queue triggered orders for execution
      for (const order of allTriggeredOrders) {
        await job.data.queue?.add('execute-order', {
          orderId: order.id,
          userId: order.userId,
          orderData: order
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        });
      }

      this.logger.log(`Processed ${allTriggeredOrders.length} triggered orders for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to process stop orders for ${job.data.symbol}:`, error);
      throw error;
    }
  }

  private async cleanupExpiredOrders(): Promise<void> {
    try {
      this.logger.log('Cleaning up expired orders');

      await this.orderBookService.cleanupExpiredOrders();

      this.logger.log('Expired orders cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup expired orders:', error);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onQueueFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`Order execution job ${job.id} failed:`, error);

    // Notify admins of critical failures
    if (job.opts.attempts >= 3) {
      await this.notifyAdmins({
        type: 'ORDER_EXECUTION_FAILURE',
        jobId: job.id,
        error: error.message,
        data: job.data
      });
    }
  }

  private async notifyAdmins(notification: any): Promise<void> {
    try {
      // Implementation would send notification to admins
      this.logger.warn(`Admin notification: ${JSON.stringify(notification)}`);
    } catch (error) {
      this.logger.error('Failed to notify admins:', error);
    }
  }
}
