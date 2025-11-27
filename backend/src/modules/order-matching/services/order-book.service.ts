import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, LessThan } from 'typeorm';

import { Order } from '../../market-aggregation/entities/order.entity';
import { Market } from '../../market-aggregation/entities/market.entity';
import { MatchResult } from '../interfaces/order-matching.interface';
import { WebSocketGateway } from '../../websocket/gateways/websocket.gateway';

interface OrderBookEntry {
  orderId: string;
  userId: string;
  quantity: number;
  price: number;
  timestamp: Date;
}

interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  bestBid: number;
  bestAsk: number;
  lastUpdate: Date;
  volume: number;
  high24h: number;
  low24h: number;
}

@Injectable()
export class OrderBookService implements OnModuleInit {
  private readonly logger = new Logger(OrderBookService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Market)
    private readonly marketRepository: Repository<Market>,
    private readonly webSocketGateway: WebSocketGateway,
  ) {}

  async onModuleInit() {
    this.logger.log('OrderBookService initialized');
  }

  /**
   * Get order book for a symbol
   */
  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook | null> {
    try {
      const orderBookKey = `orderbook:${symbol}`;

      // Check if we have order book data stored in hash
      const bookData = await this.redis.hgetall(orderBookKey);

      if (bookData && bookData.bids && bookData.asks) {
        // Use cached hash data if available
        const bids: OrderBookEntry[] = [];
        const asks: OrderBookEntry[] = [];

        // Parse bids (BUY orders)
        const bidsData = JSON.parse(bookData.bids);
        for (const bid of bidsData.slice(0, depth)) {
          bids.push({
            orderId: bid.orderId,
            userId: bid.userId,
            quantity: parseFloat(bid.quantity),
            price: parseFloat(bid.price),
            timestamp: new Date(bid.timestamp)
          });
        }

        // Parse asks (SELL orders)
        const asksData = JSON.parse(bookData.asks);
        for (const ask of asksData.slice(0, depth)) {
          asks.push({
            orderId: ask.orderId,
            userId: ask.userId,
            quantity: parseFloat(ask.quantity),
            price: parseFloat(ask.price),
            timestamp: new Date(ask.timestamp)
          });
        }

        const bestBid = bids.length > 0 ? bids[0].price : 0;
        const bestAsk = asks.length > 0 ? asks[0].price : 0;
        const spread = bestBid && bestAsk ? bestAsk - bestBid : 0;

        return {
          symbol,
          bids,
          asks,
          spread,
          bestBid,
          bestAsk,
          lastUpdate: new Date(bookData.lastUpdate),
          volume: parseFloat(bookData.volume || '0'),
          high24h: parseFloat(bookData.high24h || '0'),
          low24h: parseFloat(bookData.low24h || '0')
        };
      }

      // If no cached hash data, construct from list keys
      const bids: OrderBookEntry[] = [];
      const asks: OrderBookEntry[] = [];

      // Get orders from Redis lists
      const bidOrders = await this.redis.lrange(`${orderBookKey}:bids:orders`, 0, depth - 1);
      const askOrders = await this.redis.lrange(`${orderBookKey}:asks:orders`, 0, depth - 1);

      // Parse bid orders
      for (const orderData of bidOrders) {
        const order = JSON.parse(orderData);
        bids.push({
          orderId: order.orderId,
          userId: order.userId,
          quantity: parseFloat(order.quantity),
          price: parseFloat(order.price),
          timestamp: new Date(order.timestamp)
        });
      }

      // Parse ask orders
      for (const orderData of askOrders) {
        const order = JSON.parse(orderData);
        asks.push({
          orderId: order.orderId,
          userId: order.userId,
          quantity: parseFloat(order.quantity),
          price: parseFloat(order.price),
          timestamp: new Date(order.timestamp)
        });
      }

      if (bids.length === 0 && asks.length === 0) {
        return null;
      }

      // Sort by price-time priority
      bids.sort((a, b) => {
        if (b.price !== a.price) return b.price - a.price; // Higher price first
        return a.timestamp.getTime() - b.timestamp.getTime(); // Earlier timestamp first
      });

      asks.sort((a, b) => {
        if (a.price !== b.price) return a.price - b.price; // Lower price first
        return a.timestamp.getTime() - b.timestamp.getTime(); // Earlier timestamp first
      });

      const bestBid = bids.length > 0 ? bids[0].price : 0;
      const bestAsk = asks.length > 0 ? asks[0].price : 0;
      const spread = bestBid && bestAsk ? bestAsk - bestBid : 0;

      return {
        symbol,
        bids,
        asks,
        spread,
        bestBid,
        bestAsk,
        lastUpdate: new Date(),
        volume: 0,
        high24h: 0,
        low24h: 0
      };
    } catch (error) {
      this.logger.error(`Failed to get order book for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Add order to order book
   */
  async addOrder(order: Order): Promise<void> {
    try {
      const orderBookKey = `orderbook:${order.symbol}`;
      const side = order.side === 'BUY' ? 'bids' : 'asks';

      // Add order to the appropriate side list
      await this.redis.lpush(`${orderBookKey}:${side}:orders`, JSON.stringify({
        orderId: order.id,
        userId: order.userId,
        quantity: order.quantity,
        price: order.price,
        timestamp: order.created_at
      }));

      // Update the hash structure for consistency
      const currentBook = await this.getOrderBook(order.symbol, 100);
      if (currentBook) {
        const bidsData = JSON.stringify(currentBook.bids.slice(0, 50));
        const asksData = JSON.stringify(currentBook.asks.slice(0, 50));

        await this.redis.hset(orderBookKey, {
          bids: bidsData,
          asks: asksData,
          lastUpdate: new Date().toISOString(),
          volume: currentBook.volume.toString(),
          high24h: currentBook.high24h.toString(),
          low24h: currentBook.low24h.toString()
        });
      }

      this.logger.log(`Added ${order.side} order ${order.id} to order book for ${order.symbol}`);
    } catch (error) {
      this.logger.error(`Failed to add order to order book:`, error);
      throw error;
    }
  }

  /**
   * Remove order from order book
   */
  async removeOrder(order: Order): Promise<void> {
    try {
      const orderBookKey = `orderbook:${order.symbol}`;
      const side = order.side === 'BUY' ? 'bids' : 'asks';

      // Remove order from the side list
      const orders = await this.redis.lrange(`${orderBookKey}:${side}:orders`, 0, -1);
      const filteredOrders = orders.filter(orderData => {
        const parsed = JSON.parse(orderData);
        return parsed.orderId !== order.id;
      });

      // Update the list
      await this.redis.del(`${orderBookKey}:${side}:orders`);
      if (filteredOrders.length > 0) {
        await this.redis.lpush(`${orderBookKey}:${side}:orders`, ...filteredOrders);
      }

      this.logger.log(`Removed order ${order.id} from order book for ${order.symbol}`);
    } catch (error) {
      this.logger.error(`Failed to remove order from order book:`, error);
      throw error;
    }
  }

  
  /**
   * Get market depth for a symbol
   */
  async getMarketDepth(symbol: string, levels: number = 10): Promise<{
    bids: Array<{ price: number; quantity: number; total: number }>;
    asks: Array<{ price: number; quantity: number; total: number }>;
  }> {
    try {
      const orderBook = await this.getOrderBook(symbol, levels * 2);

      if (!orderBook) {
        return { bids: [], asks: [] };
      }

      // Process bids (aggregate by price)
      const bidsMap = new Map<number, number>();
      let runningTotal = 0;

      for (const bid of orderBook.bids) {
        const currentQuantity = bidsMap.get(bid.price) || 0;
        bidsMap.set(bid.price, currentQuantity + bid.quantity);
      }

      const bids = Array.from(bidsMap.entries())
        .sort(([priceA], [priceB]) => priceB - priceA) // Sort by price descending
        .slice(0, levels)
        .map(([price, quantity]) => {
          runningTotal += quantity;
          return {
            price,
            quantity,
            total: runningTotal
          };
        });

      // Process asks (aggregate by price)
      const asksMap = new Map<number, number>();
      runningTotal = 0;

      for (const ask of orderBook.asks) {
        const currentQuantity = asksMap.get(ask.price) || 0;
        asksMap.set(ask.price, currentQuantity + ask.quantity);
      }

      const asks = Array.from(asksMap.entries())
        .sort(([priceA], [priceB]) => priceA - priceB) // Sort by price ascending
        .slice(0, levels)
        .map(([price, quantity]) => {
          runningTotal += quantity;
          return {
            price,
            quantity,
            total: runningTotal
          };
        });

      return { bids, asks };
    } catch (error) {
      this.logger.error(`Failed to get market depth for ${symbol}:`, error);
      return { bids: [], asks: [] };
    }
  }

  /**
   * Get order book statistics
   */
  async getOrderBookStats(symbol: string): Promise<{
    totalBids: number;
    totalAsks: number;
    totalVolume: number;
    spread: number;
    midPrice: number;
    bestBid: number;
    bestAsk: number;
  }> {
    try {
      const orderBook = await this.getOrderBook(symbol);

      if (!orderBook) {
        return {
          totalBids: 0,
          totalAsks: 0,
          totalVolume: 0,
          spread: 0,
          midPrice: 0,
          bestBid: 0,
          bestAsk: 0
        };
      }

      const totalBids = orderBook.bids.reduce((sum, bid) => sum + bid.quantity, 0);
      const totalAsks = orderBook.asks.reduce((sum, ask) => sum + ask.quantity, 0);
      const midPrice = orderBook.bestBid && orderBook.bestAsk
        ? (orderBook.bestBid + orderBook.bestAsk) / 2
        : 0;

      return {
        totalBids,
        totalAsks,
        totalVolume: orderBook.volume,
        spread: orderBook.spread,
        midPrice,
        bestBid: orderBook.bestBid,
        bestAsk: orderBook.bestAsk
      };
    } catch (error) {
      this.logger.error(`Failed to get order book stats for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Update order book after matches
   */
  private async updateOrderBookAfterMatches(symbol: string, matches: MatchResult[]): Promise<void> {
    try {
      const orderBookKey = `orderbook:${symbol}`;

      // Update order quantities or remove filled orders
      for (const match of matches) {
        // Update bid order
        await this.updateOrderQuantity(match.bidOrderId, match.quantity);

        // Update ask order
        await this.updateOrderQuantity(match.askOrderId, match.quantity);
      }

      // Update order book timestamp and volume
      await this.redis.hset(orderBookKey, 'lastUpdate', new Date().toISOString());

      this.logger.log(`Updated order book for ${symbol} after ${matches.length} matches`);
    } catch (error) {
      this.logger.error(`Failed to update order book after matches:`, error);
      throw error;
    }
  }

  /**
   * Update order quantity after partial fill
   */
  private async updateOrderQuantity(orderId: string, filledQuantity: number): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) return;

      order.filled_quantity += filledQuantity;
      order.remaining_quantity -= filledQuantity;

      if (order.remaining_quantity <= 0) {
        order.status = 'FILLED';
        order.filled_at = new Date();
      } else {
        order.status = 'PARTIAL_FILLED';
      }

      await this.orderRepository.save(order);

      // Remove from order book if fully filled
      if (order.status === 'FILLED') {
        await this.removeOrder(order);
      }
    } catch (error) {
      this.logger.error(`Failed to update order quantity for ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup expired orders
   */
  async cleanupExpiredOrders(): Promise<void> {
    try {
      const now = new Date();
      const expiredOrders = await this.orderRepository.find({
        where: {
          status: 'OPEN',
          expires_at: LessThan(now)
        }
      });

      for (const order of expiredOrders) {
        order.status = 'EXPIRED';
        await this.orderRepository.save(order);
        await this.removeOrder(order);
      }

      this.logger.log(`Cleaned up ${expiredOrders.length} expired orders`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired orders:', error);
    }
  }

  /**
   * Process stop orders based on current market price
   */
  async processStopOrders(symbol: string, currentPrice: number): Promise<Order[]> {
    try {
      const triggeredOrders: Order[] = [];

      // Find stop loss orders (SELL when price drops below stop price)
      const stopLossOrders = await this.orderRepository.find({
        where: {
          symbol,
          order_type: 'STOP',
          side: 'SELL',
          status: 'OPEN',
          stop_price: MoreThanOrEqual(currentPrice),
        },
        order: { stop_price: 'ASC' },
      });

      // Find stop buy orders (BUY when price rises above stop price)
      const stopBuyOrders = await this.orderRepository.find({
        where: {
          symbol,
          order_type: 'STOP',
          side: 'BUY',
          status: 'OPEN',
          stop_price: LessThanOrEqual(currentPrice),
        },
        order: { stop_price: 'DESC' },
      });

      const allTriggeredOrders = [...stopLossOrders, ...stopBuyOrders];

      for (const order of allTriggeredOrders) {
        // Convert stop order to market order
        order.order_type = 'MARKET';
        order.status = 'PENDING';
        order.stop_price = null;

        await this.orderRepository.save(order);
        triggeredOrders.push(order);

        this.logger.log(`Stop order ${order.id} triggered at price ${currentPrice}`);
      }

      return triggeredOrders;
    } catch (error) {
      this.logger.error(`Failed to process stop orders for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Process take profit orders based on current market price
   */
  async processTakeProfitOrders(symbol: string, currentPrice: number): Promise<Order[]> {
    try {
      const triggeredOrders: Order[] = [];

      // Find take profit orders (SELL when price reaches or exceeds target)
      const takeProfitSellOrders = await this.orderRepository.find({
        where: {
          symbol,
          order_type: 'STOP_LIMIT',
          side: 'SELL',
          status: 'OPEN',
          stop_price: LessThanOrEqual(currentPrice),
        },
        order: { stop_price: 'ASC' },
      });

      // Find take profit buy orders (BUY when price drops to or below target)
      const takeProfitBuyOrders = await this.orderRepository.find({
        where: {
          symbol,
          order_type: 'STOP_LIMIT',
          side: 'BUY',
          status: 'OPEN',
          stop_price: MoreThanOrEqual(currentPrice),
        },
        order: { stop_price: 'DESC' },
      });

      const allTriggeredOrders = [...takeProfitSellOrders, ...takeProfitBuyOrders];

      for (const order of allTriggeredOrders) {
        // Convert take profit order to limit order at target price
        order.order_type = 'LIMIT';
        order.price = order.stop_price;
        order.stop_price = null;
        order.status = 'OPEN';

        await this.orderRepository.save(order);
        await this.addOrder(order);
        triggeredOrders.push(order);

        this.logger.log(`Take profit order ${order.id} triggered at price ${currentPrice}, converted to LIMIT at ${order.price}`);
      }

      return triggeredOrders;
    } catch (error) {
      this.logger.error(`Failed to process take profit orders for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Enhanced match orders with strict price-time priority
   */
  async matchOrders(symbol: string): Promise<MatchResult[]> {
    try {
      const matches: MatchResult[] = [];

      // Get open orders sorted by price-time priority
      const bids = await this.orderRepository.find({
        where: {
          symbol,
          side: 'BUY',
          status: 'OPEN',
          order_type: 'LIMIT',
        },
        order: { price: 'DESC', created_at: 'ASC' },
      });

      const asks = await this.orderRepository.find({
        where: {
          symbol,
          side: 'SELL',
          status: 'OPEN',
          order_type: 'LIMIT',
        },
        order: { price: 'ASC', created_at: 'ASC' },
      });

      let bidIndex = 0;
      let askIndex = 0;

      while (bidIndex < bids.length && askIndex < asks.length) {
        const bid = bids[bidIndex];
        const ask = asks[askIndex];

        // Check if orders can be matched
        if (bid.price >= ask.price) {
          const matchQuantity = Math.min(bid.remaining_quantity, ask.remaining_quantity);
          const matchPrice = ask.price; // Use ask price for execution
          const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          const match: MatchResult = {
            bidOrderId: bid.id,
            askOrderId: ask.id,
            quantity: matchQuantity,
            price: matchPrice,
            bidUserId: bid.userId,
            askUserId: ask.userId,
            timestamp: new Date(),
            tradeId,
          };

          matches.push(match);

          // Update bid order
          const bidFill = {
            id: `fill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            quantity: matchQuantity,
            price: matchPrice,
            commission: matchQuantity * matchPrice * 0.001, // 0.1% commission
            fee: matchQuantity * matchPrice * 0.0001, // 0.01% fee
            timestamp: new Date(),
            tradeId,
          };

          if (!bid.fills) bid.fills = [];
          bid.fills.push(bidFill);
          bid.filled_quantity += matchQuantity;
          bid.remaining_quantity -= matchQuantity;
          bid.commission += bidFill.commission;
          bid.fee += bidFill.fee;

          if (bid.remaining_quantity <= 0) {
            bid.status = 'FILLED';
            bid.filled_at = new Date();
            bid.avg_fill_price = ((bid.avg_fill_price || 0) * (bid.filled_quantity - matchQuantity) + matchPrice * matchQuantity) / bid.filled_quantity;
          } else {
            bid.status = 'PARTIAL_FILLED';
            bid.avg_fill_price = ((bid.avg_fill_price || 0) * (bid.filled_quantity - matchQuantity) + matchPrice * matchQuantity) / bid.filled_quantity;
          }

          // Update ask order
          const askFill = {
            id: `fill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            quantity: matchQuantity,
            price: matchPrice,
            commission: matchQuantity * matchPrice * 0.001, // 0.1% commission
            fee: matchQuantity * matchPrice * 0.0001, // 0.01% fee
            timestamp: new Date(),
            tradeId,
          };

          if (!ask.fills) ask.fills = [];
          ask.fills.push(askFill);
          ask.filled_quantity += matchQuantity;
          ask.remaining_quantity -= matchQuantity;
          ask.commission += askFill.commission;
          ask.fee += askFill.fee;

          if (ask.remaining_quantity <= 0) {
            ask.status = 'FILLED';
            ask.filled_at = new Date();
            ask.avg_fill_price = ((ask.avg_fill_price || 0) * (ask.filled_quantity - matchQuantity) + matchPrice * matchQuantity) / ask.filled_quantity;
          } else {
            ask.status = 'PARTIAL_FILLED';
            ask.avg_fill_price = ((ask.avg_fill_price || 0) * (ask.filled_quantity - matchQuantity) + matchPrice * matchQuantity) / ask.filled_quantity;
          }

          // Move to next order if fully filled
          if (bid.remaining_quantity <= 0) bidIndex++;
          if (ask.remaining_quantity <= 0) askIndex++;

          // Broadcast individual matches
          await this.webSocketGateway.broadcastOrderFilled(bid);
          await this.webSocketGateway.broadcastOrderFilled(ask);
        } else {
          // No more matches possible
          break;
        }
      }

      // Save updated orders
      const updatedOrders = [...bids, ...asks].filter(order =>
        order.filled_quantity > 0 || order.status !== 'OPEN'
      );

      if (updatedOrders.length > 0) {
        await this.orderRepository.save(updatedOrders);

        // Remove filled orders from order book
        for (const order of updatedOrders) {
          if (order.status === 'FILLED') {
            await this.removeOrder(order);
          }
        }
      }

      // Broadcast order book update
      if (matches.length > 0) {
        await this.updateOrderBookSnapshot(symbol);
        await this.broadcastOrderBookUpdate(symbol);
      }

      return matches;
    } catch (error) {
      this.logger.error(`Failed to match orders for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Update order book snapshot in Redis cache
   */
  async updateOrderBookSnapshot(symbol: string): Promise<void> {
    try {
      const orderBook = await this.getOrderBook(symbol, 100);
      if (!orderBook) return;

      const snapshotKey = `orderbook:${symbol}:snapshot`;
      await this.redis.setex(snapshotKey, 5, JSON.stringify(orderBook)); // TTL 5 seconds

      this.logger.debug(`Updated order book snapshot for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to update order book snapshot for ${symbol}:`, error);
    }
  }

  /**
   * Broadcast order book updates via WebSocket
   */
  async broadcastOrderBookUpdate(symbol: string): Promise<void> {
    try {
      const orderBook = await this.getOrderBook(symbol, 20);
      if (!orderBook) return;

      await this.webSocketGateway.broadcastOrderBookUpdate(symbol, orderBook);

      this.logger.debug(`Broadcasted order book update for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast order book update for ${symbol}:`, error);
    }
  }

  /**
   * Get order book snapshot for all symbols
   */
  async getAllOrderBooks(): Promise<Array<{ symbol: string; stats: any }>> {
    try {
      const markets = await this.marketRepository.find({
        where: { is_active: true, status: 'ACTIVE' }
      });

      const orderBooks = [];
      for (const market of markets) {
        const stats = await this.getOrderBookStats(market.symbol);
        if (stats.totalBids > 0 || stats.totalAsks > 0) {
          orderBooks.push({
            symbol: market.symbol,
            stats
          });
        }
      }

      return orderBooks;
    } catch (error) {
      this.logger.error('Failed to get all order books:', error);
      return [];
    }
  }
}