import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Order } from '../entities/order.entity';
import { Portfolio } from '../entities/portfolio.entity';
import { OrderBookService } from '../../order-matching/services/order-book.service';
import { MarketDataService } from '../services/market-data.service';
import { WebSocketGateway } from '../../websocket/websocket.gateway';

@Processor('order-processing')
export class OrderProcessor {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    private readonly orderBookService: OrderBookService,
    private readonly marketDataService: MarketDataService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly dataSource: DataSource,
  ) {}

  @Process('process-order')
  async handleProcessOrder(job: Job<{ orderId: string }>): Promise<void> {
    await this.dataSource.transaction(async manager => {
      try {
        const { orderId } = job.data;

        // Load Order entity
        const order = await manager.findOne(Order, {
          where: { id: orderId },
        });

        if (!order) {
          throw new Error(`Order ${orderId} not found`);
        }

        await job.progress(10);

        // Validate order
        await this.validateOrder(order, manager);
        await job.progress(30);

        // Add to order book
        await this.orderBookService.addOrder(order);
        await job.progress(50);

        // Attempt to match orders
        const matches = await this.orderBookService.matchOrders(order.symbol);
        await job.progress(70);

        // Update order status based on matches
        if (matches.length > 0) {
          order.status = 'PARTIALLY_FILLED';
          order.filledQuantity = matches.reduce((sum, match) => sum + match.quantity, 0);
        } else {
          order.status = 'OPEN';
        }

        await manager.save(order);

        // Process matches (update portfolios, etc.)
        for (const match of matches) {
          await this.processMatch(match, manager);
        }

        await job.progress(90);

        // Broadcast order update via WebSocket
        await this.webSocketGateway.broadcastToUser(order.userId, {
          event: 'order-update',
          data: {
            orderId: order.id,
            status: order.status,
            filledQuantity: order.filledQuantity,
            timestamp: new Date().toISOString(),
          },
        });

        await job.progress(100);

        this.logger.log(`Processed order ${orderId} with ${matches.length} matches`);
      } catch (error) {
        this.logger.error(`Failed to process order ${job.data.orderId}:`, error);
        throw error;
      }
    });
  }

  @Process('match-orders')
  async handleMatchOrders(job: Job<{ symbol: string }>): Promise<void> {
    try {
      const { symbol } = job.data;

      await job.progress(10);

      // Call OrderBookService.matchOrders
      const matches = await this.orderBookService.matchOrders(symbol);
      await job.progress(50);

      // For each match, update orders and portfolios
      for (const match of matches) {
        await this.processMatch(match);
      }

      await job.progress(80);

      // Broadcast matches via WebSocket
      await this.webSocketGateway.broadcastToRoom(`trades:${symbol}`, {
        event: 'trades-update',
        data: {
          symbol,
          matches,
          timestamp: new Date().toISOString(),
        },
      });

      await job.progress(100);

      this.logger.log(`Processed ${matches.length} matches for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to match orders for ${job.data.symbol}:`, error);
      throw error;
    }
  }

  @Process('update-portfolio')
  async handleUpdatePortfolio(job: Job<{ userId: string, symbol: string, trade: any }>): Promise<void> {
    await this.dataSource.transaction(async manager => {
      try {
        const { userId, symbol, trade } = job.data;

        await job.progress(10);

        // Find or create Portfolio entity
        let portfolio = await manager.findOne(Portfolio, {
          where: { userId, symbol },
        });

        if (!portfolio) {
          portfolio = manager.create(Portfolio, {
            userId,
            symbol,
            quantity: 0,
            averagePrice: 0,
            totalCost: 0,
            realizedPnL: 0,
            firstPurchaseAt: trade.tradeDate,
            lastTradeAt: trade.tradeDate,
          });
        }

        await job.progress(30);

        // Update portfolio from trade
        portfolio.updateFromTrade(trade);
        portfolio.lastTradeAt = trade.tradeDate;

        await manager.save(portfolio);

        await job.progress(80);

        // Broadcast portfolio update via WebSocket
        await this.webSocketGateway.broadcastToUser(userId, {
          event: 'portfolio-update',
          data: {
            symbol,
            quantity: portfolio.quantity,
            averagePrice: portfolio.averagePrice,
            unrealizedPnL: portfolio.unrealizedPnL,
            timestamp: new Date().toISOString(),
          },
        });

        await job.progress(100);

        this.logger.log(`Updated portfolio for user ${userId}, symbol ${symbol}`);
      } catch (error) {
        this.logger.error(`Failed to update portfolio for user ${job.data.userId}:`, error);
        throw error;
      }
    });
  }

  @Process('settle-order')
  async handleSettleOrder(job: Job<{ orderId: string }>): Promise<void> {
    await this.dataSource.transaction(async manager => {
      try {
        const { orderId } = job.data;

        await job.progress(10);

        // Load Order entity
        const order = await manager.findOne(Order, {
          where: { id: orderId },
          relations: ['user'],
        });

        if (!order) {
          throw new Error(`Order ${orderId} not found`);
        }

        await job.progress(30);

        // Update wallet balances (simplified - would integrate with wallet service)
        // This would typically involve debiting/crediting user wallets
        await this.updateWalletBalances(order, manager);
        await job.progress(60);

        // Update portfolio positions
        if (order.status === 'FILLED') {
          await this.updatePortfolioFromOrder(order, manager);
        }

        await job.progress(80);

        // Mark order as settled
        order.status = 'SETTLED';
        order.settledAt = new Date();
        await manager.save(order);

        await job.progress(90);

        // Broadcast settlement via WebSocket
        await this.webSocketGateway.broadcastToUser(order.userId, {
          event: 'order-settled',
          data: {
            orderId: order.id,
            status: order.status,
            settledAt: order.settledAt,
            timestamp: new Date().toISOString(),
          },
        });

        await job.progress(100);

        this.logger.log(`Settled order ${orderId}`);
      } catch (error) {
        this.logger.error(`Failed to settle order ${job.data.orderId}:`, error);
        throw error;
      }
    });
  }

  private async validateOrder(order: Order, manager: any): Promise<void> {
    // Check if order can be processed
    if (order.status !== 'PENDING') {
      throw new Error(`Order ${order.id} is not in PENDING status`);
    }

    // Check market hours (if applicable)
    // Additional business logic validation would go here
  }

  private async processMatch(match: any, manager?: any): Promise<void> {
    // Update matched orders
    if (match.buyOrder && match.sellOrder) {
      if (manager) {
        await manager.update(Order, match.buyOrder.id, {
          status: 'FILLED',
          filledQuantity: match.buyOrder.filledQuantity + match.quantity,
        });
        await manager.update(Order, match.sellOrder.id, {
          status: 'FILLED',
          filledQuantity: match.sellOrder.filledQuantity + match.quantity,
        });
      }

      // Update portfolios for both sides
      await this.updatePortfolioFromMatch(match);
    }
  }

  private async updatePortfolioFromMatch(match: any): Promise<void> {
    // Update buyer's portfolio
    await this.portfolioRepository.manager.query(
      `INSERT INTO portfolios (userId, symbol, quantity, averagePrice, totalCost, firstPurchaseAt, lastTradeAt, createdAt, updatedAt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (userId, symbol) DO UPDATE SET
       quantity = portfolios.quantity + $3,
       totalCost = portfolios.totalCost + $5,
       lastTradeAt = $7,
       updatedAt = NOW()`,
      [
        match.buyOrder.userId,
        match.symbol,
        match.quantity,
        match.price,
        match.quantity * match.price,
        new Date(),
        new Date(),
      ]
    );

    // Update seller's portfolio
    await this.portfolioRepository.manager.query(
      `UPDATE portfolios
       SET quantity = portfolios.quantity - $3,
           realizedPnL = portfolios.realizedPnL + ($8 - $4) * $3,
           lastTradeAt = $7,
           updatedAt = NOW()
       WHERE userId = $1 AND symbol = $2`,
      [
        match.sellOrder.userId,
        match.symbol,
        match.quantity,
        match.sellOrder.averagePrice || match.price,
        match.price,
        match.quantity * match.price,
        new Date(),
        match.price,
      ]
    );
  }

  private async updateWalletBalances(order: Order, manager: any): Promise<void> {
    // This would integrate with the wallet service
    // For now, we'll just log the action
    this.logger.log(`Updating wallet balances for order ${order.id}`);
  }

  private async updatePortfolioFromOrder(order: Order, manager: any): Promise<void> {
    const trade = {
      quantity: order.filledQuantity,
      price: order.price,
      side: order.side,
      tradeDate: order.updatedAt,
    };

    await this.portfolioRepository.manager.query(
      `INSERT INTO portfolios (userId, symbol, quantity, averagePrice, totalCost, firstPurchaseAt, lastTradeAt, createdAt, updatedAt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (userId, symbol) DO UPDATE SET
       quantity = CASE
         WHEN $8 = 'BUY' THEN portfolios.quantity + $3
         WHEN $8 = 'SELL' THEN portfolios.quantity - $3
         ELSE portfolios.quantity
       END,
       totalCost = CASE
         WHEN $8 = 'BUY' THEN portfolios.totalCost + $5
         ELSE portfolios.totalCost
       END,
       lastTradeAt = $7,
       updatedAt = NOW()`,
      [
        order.userId,
        order.symbol,
        order.filledQuantity,
        order.price,
        order.filledQuantity * order.price,
        order.createdAt,
        order.updatedAt,
        order.side,
      ]
    );
  }
}