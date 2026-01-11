import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

export interface WebSocketMessage {
  event: string;
  payload: any;
  room?: string;
  targetUsers?: string[];
  timestamp?: string;
}

export interface MarketDataUpdate {
  trendId: string;
  price: number;
  volume24h: number;
  priceChange24h: number;
  bidPrice?: number;
  askPrice?: number;
  bidSize?: number;
  askSize?: number;
  timestamp: string;
}

export interface OrderBookUpdate {
  trendId: string;
  bids: Array<[number, number]>; // [price, quantity]
  asks: Array<[number, number]>; // [price, quantity]
  timestamp: string;
}

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);
  private server?: Server;

  constructor(
    @InjectRedis() private readonly redis: Redis) {}

  setServer(server: Server): void {
    this.server = server;
  }

  // Market data broadcasting
  async broadcastMarketData(update: MarketDataUpdate): Promise<void> {
    const message: WebSocketMessage = {
      event: 'market-data:update',
      payload: update,
      room: `market:${update.trendId}`,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastOrderBook(update: OrderBookUpdate): Promise<void> {
    const message: WebSocketMessage = {
      event: 'orderbook:update',
      payload: update,
      room: `trend:${update.trendId}`,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastPriceAlert(alert: {
    userId: string;
    trendId: string;
    alertType: 'ABOVE' | 'BELOW';
    targetPrice: number;
    currentPrice: number;
    message: string;
  }): Promise<void> {
    const message: WebSocketMessage = {
      event: 'price-alert:triggered',
      payload: alert,
      targetUsers: [alert.userId],
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  // Order broadcasting
  async broadcastOrderPlaced(order: any): Promise<void> {
    const message: WebSocketMessage = {
      event: 'order:placed',
      payload: order,
      room: `trend:${order.trendId}`,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastOrderUpdated(order: any, changes?: any): Promise<void> {
    const message: WebSocketMessage = {
      event: 'order:updated',
      payload: { order, changes },
      room: `trend:${order.trendId}`,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastOrderCancelled(order: any): Promise<void> {
    const message: WebSocketMessage = {
      event: 'order:cancelled',
      payload: order,
      room: `trend:${order.trendId}`,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastOrderMatched(match: {
    makerOrder: any;
    takerOrder: any;
    fill: any;
    price: number;
    quantity: number;
  }): Promise<void> {
    const message: WebSocketMessage = {
      event: 'order:matched',
      payload: match,
      room: `trend:${match.makerOrder.trendId}`,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);

    // Also notify individual users
    await this.sendToUser(match.makerOrder.userId, 'order:matched', {
      order: match.makerOrder,
      fill: match.fill,
      role: 'maker'
    });

    await this.sendToUser(match.takerOrder.userId, 'order:matched', {
      order: match.takerOrder,
      fill: match.fill,
      role: 'taker'
    });
  }

  // Wallet broadcasting
  async broadcastWalletUpdate(userId: string, wallet: any, transaction?: any): Promise<void> {
    const message: WebSocketMessage = {
      event: 'wallet:updated',
      payload: { wallet, transaction },
      room: `wallets:${userId}`,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastTransactionCreated(userId: string, transaction: any): Promise<void> {
    const message: WebSocketMessage = {
      event: 'transaction:created',
      payload: transaction,
      targetUsers: [userId],
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  // Trend broadcasting
  async broadcastTrendCreated(trend: any): Promise<void> {
    const message: WebSocketMessage = {
      event: 'trend:created',
      payload: trend,
      room: 'trends:all',
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastTrendUpdated(trend: any, changes?: any): Promise<void> {
    const message: WebSocketMessage = {
      event: 'trend:updated',
      payload: { trend, changes },
      room: `trend:${trend.id}`,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastTrendPriceUpdate(trendId: string, priceData: {
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
  }): Promise<void> {
    const message: WebSocketMessage = {
      event: 'trend:price-update',
      payload: {
        trendId,
        ...priceData,
        timestamp: new Date().toISOString()
      },
      room: `trend:${trendId}`
    };

    await this.broadcast(message);
  }

  // Notification broadcasting
  async broadcastNotificationCreated(userId: string, notification: any): Promise<void> {
    const message: WebSocketMessage = {
      event: 'notification:new',
      payload: notification,
      targetUsers: [userId],
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);

    // Update unread count
    await this.updateUnreadCount(userId);
  }

  private async updateUnreadCount(userId: string): Promise<void> {
    try {
      // Get unread count from database or cache
      const unreadCount = await this.getUnreadCountFromCache(userId);

      const message: WebSocketMessage = {
        event: 'notifications:unread-count',
        payload: { count: unreadCount },
        targetUsers: [userId],
        timestamp: new Date().toISOString()
      };

      await this.broadcast(message);
    } catch (error) {
      this.logger.error('Error updating unread count:', error);
    }
  }

  private async getUnreadCountFromCache(userId: string): Promise<number> {
    const key = `notifications:unread:${userId}`;
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  // System broadcasting
  async broadcastSystemMaintenance(maintenance: {
    title: string;
    message: string;
    startTime: string;
    duration: number;
  }): Promise<void> {
    const message: WebSocketMessage = {
      event: 'system:maintenance',
      payload: maintenance,
      room: 'system:all',
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastSystemAlert(alert: {
    type: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    title: string;
    message: string;
    targetUsers?: string[];
  }): Promise<void> {
    const message: WebSocketMessage = {
      event: 'system:alert',
      payload: alert,
      room: alert.targetUsers ? undefined : 'system:all',
      targetUsers: alert.targetUsers,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  // Real-time analytics broadcasting
  async broadcastTradingVolume(volume: {
    totalVolume24h: number;
    tradeCount24h: number;
    topTrends: Array<{
      trendId: string;
      volume: number;
      trades: number;
    }>;
  }): Promise<void> {
    const message: WebSocketMessage = {
      event: 'analytics:trading-volume',
      payload: volume,
      room: 'analytics:trading',
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastLeaderboard(leaderboard: {
    period: '1h' | '24h' | '7d' | '30d';
    topTraders: Array<{
      userId: string;
      username: string;
      profit: number;
      profitPercent: number;
      trades: number;
    }>;
  }): Promise<void> {
    const message: WebSocketMessage = {
      event: 'analytics:leaderboard',
      payload: leaderboard,
      room: 'analytics:leaderboard',
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  // User presence broadcasting
  async broadcastUserOnline(userId: string, username: string): Promise<void> {
    const message: WebSocketMessage = {
      event: 'user:online',
      payload: { userId, username },
      room: 'presence:all',
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastUserOffline(userId: string): Promise<void> {
    const message: WebSocketMessage = {
      event: 'user:offline',
      payload: { userId },
      room: 'presence:all',
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  // Custom broadcasting
  async broadcastToRoom(room: string, event: string, payload: any): Promise<void> {
    const message: WebSocketMessage = {
      event,
      payload,
      room,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async sendToUser(userId: string, event: string, payload: any): Promise<void> {
    const message: WebSocketMessage = {
      event,
      payload,
      targetUsers: [userId],
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  async broadcastToAll(event: string, payload: any): Promise<void> {
    const message: WebSocketMessage = {
      event,
      payload,
      timestamp: new Date().toISOString()
    };

    await this.broadcast(message);
  }

  // Core broadcasting method
  private async broadcast(message: WebSocketMessage): Promise<void> {
    try {
      // Use the gateway's broadcast method if available
      if (this.websocketGateway) {
        if (message.room) {
          await this.websocketGateway.broadcastToRoom(message.room, message.event, message.payload);
        } else if (message.targetUsers) {
          for (const userId of message.targetUsers) {
            await this.websocketGateway.broadcastToUser(userId, message.event, message.payload);
          }
        } else {
          // Broadcast to all connected clients
          if (this.server) {
            this.server.emit(message.event, message.payload);
          }
        }
      }

      // Also publish to Redis for cross-instance communication
      await this.redis.publish('ws:broadcast', JSON.stringify(message));

    } catch (error) {
      this.logger.error('Error broadcasting WebSocket message:', error);
    }
  }

  // Connection management utilities
  async getConnectedUserCount(): Promise<number> {
    try {
      const connections = await this.redis.keys('ws:connection:*');
      return connections.length;
    } catch (error) {
      this.logger.error('Error getting connected user count:', error);
      return 0;
    }
  }

  async getUsersInRoom(room: string): Promise<string[]> {
    try {
      const key = `ws:room:${room}`;
      const members = await this.redis.smembers(key);
      return members;
    } catch (error) {
      this.logger.error('Error getting users in room:', error);
      return [];
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const userRooms = await this.redis.keys(`ws:room:*:${userId}`);
      return userRooms.length > 0;
    } catch (error) {
      this.logger.error('Error checking if user is online:', error);
      return false;
    }
  }

  // Performance monitoring
  async getWebSocketMetrics(): Promise<{
    totalConnections: number;
    messagesPerSecond: number;
    averageLatency: number;
    errorRate: number;
  }> {
    try {
      const metrics = await this.redis.hmget('ws:metrics', [
        'total_connections',
        'messages_per_second',
        'average_latency',
        'error_rate',
      ]);

      return {
        totalConnections: parseInt(metrics[0] || '0', 10),
        messagesPerSecond: parseFloat(metrics[1] || '0'),
        averageLatency: parseFloat(metrics[2] || '0'),
        errorRate: parseFloat(metrics[3] || '0')
      };
    } catch (error) {
      this.logger.error('Error getting WebSocket metrics:', error);
      return {
        totalConnections: 0,
        messagesPerSecond: 0,
        averageLatency: 0,
        errorRate: 0
      };
    }
  }

  // Batch operations for efficiency
  async batchBroadcast(messages: WebSocketMessage[]): Promise<void> {
    const batch = this.redis.pipeline();

    for (const message of messages) {
      batch.publish('ws:broadcast', JSON.stringify(message));
    }

    try {
      await batch.exec();
    } catch (error) {
      this.logger.error('Error in batch broadcast:', error);
    }
  }
}
