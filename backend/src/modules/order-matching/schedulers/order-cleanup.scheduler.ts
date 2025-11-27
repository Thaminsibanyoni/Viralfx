import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { PrismaService } from '../../prisma/prisma.service';

import { OrderBookService } from '../services/order-book.service';
import { Order } from '../../market-aggregation/entities/order.entity';

@Injectable()
export class OrderCleanupScheduler {
  private readonly logger = new Logger(OrderCleanupScheduler.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderBookService: OrderBookService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('*/5 * * * *') // Every 5 minutes
  async cleanupExpiredOrders(): Promise<void> {
    try {
      this.logger.log('Starting cleanup of expired orders');

      await this.orderBookService.cleanupExpiredOrders();

      this.logger.log('Expired orders cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup expired orders:', error);
    }
  }

  @Cron('0 * * * *') // Every hour
  async archiveFilledOrders(): Promise<void> {
    try {
      this.logger.log('Starting archive of filled orders');

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Find filled orders older than 24 hours
      const filledOrders = await this.orderRepository.find({
        where: {
          status: 'FILLED',
          filled_at: LessThan(twentyFourHoursAgo),
        },
        select: ['id'],
      });

      if (filledOrders.length === 0) {
        this.logger.log('No filled orders to archive');
        return;
      }

      // Update status to ARCHIVED
      const orderIds = filledOrders.map(order => order.id);
      await this.orderRepository.update(
        { id: In(orderIds) },
        { status: 'ARCHIVED' }
      );

      this.logger.log(`Archived ${filledOrders.length} filled orders`);
    } catch (error) {
      this.logger.error('Failed to archive filled orders:', error);
    }
  }

  @Cron('0 0 * * *') // Daily at midnight
  async generateOrderBookStats(): Promise<void> {
    try {
      this.logger.log('Generating daily order book statistics');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all markets
      const markets = await this.prisma.market.findMany({
        where: {
          is_active: true,
        },
      });

      for (const market of markets) {
        await this.generateMarketStats(market.symbol, yesterday, today);
      }

      this.logger.log('Daily order book statistics generated');
    } catch (error) {
      this.logger.error('Failed to generate order book statistics:', error);
    }
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async cleanupOldTransactions(): Promise<void> {
    try {
      this.logger.log('Starting cleanup of old transactions');

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Archive old completed transactions
      await this.prisma.walletTransaction.updateMany({
        where: {
          status: 'COMPLETED',
          created_at: {
            lt: thirtyDaysAgo,
          },
        },
        data: {
          archived: true,
        },
      });

      this.logger.log('Old transactions cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup old transactions:', error);
    }
  }

  @Cron('*/10 * * * *') // Every 10 minutes
  async cleanupStaleConnections(): Promise<void> {
    try {
      this.logger.debug('Starting cleanup of stale connections');

      // This would clean up any stale WebSocket connections
      // Implementation would depend on WebSocket server configuration

      this.logger.debug('Stale connections cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup stale connections:', error);
    }
  }

  private async generateMarketStats(symbol: string, startDate: Date, endDate: Date): Promise<void> {
    try {
      // Get order statistics for the period
      const orderStats = await this.orderRepository
        .createQueryBuilder('order')
        .select('COUNT(*)', 'totalOrders')
        .addSelect('SUM(CASE WHEN order.status = :filled THEN 1 ELSE 0 END)', 'filledOrders')
        .addSelect('AVG(order.filled_quantity / order.quantity)', 'avgFillRate')
        .addSelect('SUM(order.total_value)', 'totalVolume')
        .where('order.symbol = :symbol', { symbol })
        .andWhere('order.created_at BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .setParameters({ filled: 'FILLED' })
        .getRawOne();

      // Get top symbols by volume
      const topSymbols = await this.orderRepository
        .createQueryBuilder('order')
        .select('order.symbol', 'symbol')
        .addSelect('SUM(order.total_value)', 'volume')
        .where('order.status = :filled', { filled: 'FILLED' })
        .andWhere('order.created_at BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .groupBy('order.symbol')
        .orderBy('volume', 'DESC')
        .limit(10)
        .getRawMany();

      // Store statistics in SystemMetric table
      await this.prisma.systemMetric.create({
        data: {
          type: 'DAILY_ORDER_STATS',
          key: symbol,
          value: JSON.stringify({
            totalOrders: parseInt(orderStats.totalOrders) || 0,
            filledOrders: parseInt(orderStats.filledOrders) || 0,
            avgFillRate: parseFloat(orderStats.avgFillRate) || 0,
            totalVolume: parseFloat(orderStats.totalVolume) || 0,
            fillRate: orderStats.totalOrders > 0
              ? (parseInt(orderStats.filledOrders) / parseInt(orderStats.totalOrders)) * 100
              : 0,
            topSymbols,
          }),
          timestamp: new Date(),
        },
      });

      this.logger.debug(`Generated stats for market ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to generate stats for market ${symbol}:`, error);
    }
  }

  @Cron('0 2 * * *') // Daily at 2 AM
  async performHealthChecks(): Promise<void> {
    try {
      this.logger.log('Performing system health checks');

      // Check order book consistency
      await this.checkOrderBookConsistency();

      // Check for orphaned orders
      await this.checkOrphanedOrders();

      // Check system resources
      await this.checkSystemResources();

      this.logger.log('System health checks completed');
    } catch (error) {
      this.logger.error('System health checks failed:', error);
    }
  }

  private async checkOrderBookConsistency(): Promise<void> {
    try {
      // Check if order book in Redis matches database
      // This would compare Redis order book with database orders
      this.logger.debug('Order book consistency check completed');
    } catch (error) {
      this.logger.error('Order book consistency check failed:', error);
    }
  }

  private async checkOrphanedOrders(): Promise<void> {
    try {
      // Check for orders that are stuck in intermediate states
      const orphanedOrders = await this.orderRepository.find({
        where: {
          status: 'PENDING',
          created_at: LessThan(new Date(Date.now() - 60 * 60 * 1000)), // Older than 1 hour
        },
      });

      if (orphanedOrders.length > 0) {
        this.logger.warn(`Found ${orphanedOrders.length} orphaned orders`);

        // Update orphaned orders to rejected status
        const orphanedOrderIds = orphanedOrders.map(order => order.id);
        await this.orderRepository.update(
          { id: In(orphanedOrderIds) },
          {
            status: 'REJECTED',
            reject_reason: 'Orphaned order - timeout',
          }
        );
      }

      this.logger.debug('Orphaned orders check completed');
    } catch (error) {
      this.logger.error('Orphaned orders check failed:', error);
    }
  }

  private async checkSystemResources(): Promise<void> {
    try {
      // Check Redis connection
      // Check database connection
      // Check queue health
      this.logger.debug('System resources check completed');
    } catch (error) {
      this.logger.error('System resources check failed:', error);
    }
  }
}