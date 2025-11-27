import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth/services/auth.service';
import { MatchingEngineService } from '../../order-matching/services/matching-engine.service';
import { OrderBookService } from '../../order-matching/services/order-book.service';
import { WalletService } from '../../wallet/services/wallet.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { MarketDataService } from '../../market-aggregation/services/market-data.service';
import { TrendService } from '../../moderation/services/trend.service';
import { AnalyticsService } from '../../analytics/services/analytics.service';
import { ConnectionQualityMonitorService } from '../services/connection-quality-monitor.service';
import { DifferentialSyncService } from '../services/differential-sync.service';

// DTOs for WebSocket messages
import { SubscribeToTrendsDto } from '../dto/subscribe-to-trends.dto';
import { SubscribeToOrdersDto } from '../dto/subscribe-to-orders.dto';
import { SubscribeToWalletsDto } from '../dto/subscribe-to-wallets.dto';
import { SubscribeToNotificationsDto } from '../dto/subscribe-to-notifications.dto';
import { PlaceOrderDto } from '../dto/place-order.dto';
import { CancelOrderDto } from '../dto/cancel-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { QualityMetricsDto, LamportClockDto, BandwidthValidationDto, SyncRequestDto, SyncResponseDto } from '../dto/sync.dto';

// Guards
import { WsJwtAuthGuard } from '../guards/ws-jwt-auth.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  namespace: '/ws',
  pingTimeout: 60000,
  pingInterval: 25000,
})
@UseGuards(WsJwtAuthGuard)
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);

  // Store active connections and their subscriptions
  private readonly connectedClients = new Map<string, {
    socket: Socket;
    userId: string;
    subscriptions: {
      trends: string[];
      orders: boolean;
      wallets: boolean;
      notifications: boolean;
      marketData: string[];
      analytics: string[];
    };
    lastActivity: Date;
    syncMetrics: {
      latency: number;
      qualityScore: number;
      lastSyncTime: Date;
    };
    lamportClock: LamportClockDto;
    qualityMetrics: QualityMetricsDto;
  }>();

  // Store room memberships
  private readonly roomMemberships = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly matchingEngineService: MatchingEngineService,
    private readonly orderBookService: OrderBookService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly marketDataService: MarketDataService,
    private readonly trendService: TrendService,
    private readonly analyticsService: AnalyticsService,
    private readonly connectionQualityMonitor: ConnectionQualityMonitorService,
    private readonly differentialSyncService: DifferentialSyncService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Set up internal event listeners
    this.setupInternalEventListeners();

    // Set up Redis pub/sub for multi-instance communication
    this.setupRedisPubSub();
  }

  async handleConnection(client: Socket) {
    try {
      // Extract JWT token from query parameters or headers
      const token = this.extractTokenFromSocket(client);

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided for socket ${client.id}`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      const user = await this.authService.getUserById(payload.sub);

      if (!user || !user.isActive) {
        this.logger.warn(`Connection rejected: Invalid user for socket ${client.id}`);
        client.disconnect();
        return;
      }

      // Initialize client with differential sync services
      await this.connectionQualityMonitor.recordConnectionEvent(client.id, 'connect');
      const vectorClock = await this.differentialSyncService.initializeClient(client.id);
      const lamportClock = await this.differentialSyncService.getLamportClock(client.id) || {
        counter: 0,
        nodeId: client.id,
        timestamp: Date.now()
      };

      // Get initial quality metrics
      const qualityMetrics = await this.connectionQualityMonitor.getQualityMetrics(client.id) || {
        qualityScore: 100,
        latency: 0,
        packetLoss: 0,
        jitter: 0,
        connectionStability: 1,
        usingPollingFallback: false,
        meetsLatencyTarget: true,
        timestamp: Date.now(),
        qualityScoreBreakdown: {
          latencyScore: 100,
          latencyWeight: 0.35,
          packetLossScore: 100,
          packetLossWeight: 0.25,
          jitterScore: 100,
          jitterWeight: 0.20,
          stabilityScore: 100,
          stabilityWeight: 0.20
        }
      };

      // Store client connection with sync metrics
      this.connectedClients.set(client.id, {
        socket: client,
        userId: user.id,
        subscriptions: {
          trends: [],
          orders: false,
          wallets: false,
          notifications: false,
          marketData: [],
          analytics: [],
        },
        lastActivity: new Date(),
        syncMetrics: {
          latency: 0,
          qualityScore: qualityMetrics.qualityScore,
          lastSyncTime: new Date(),
        },
        lamportClock,
        qualityMetrics,
      });

      // Join user-specific room
      await client.join(`user:${user.id}`);

      // Send initial data
      await this.sendInitialData(client, user.id);

      // Notify other clients about user coming online
      client.broadcast.emit('user:online', {
        userId: user.id,
        username: user.username,
      });

      this.logger.log(`User ${user.username} connected with socket ${client.id}`);

      // Send connection confirmation with quality metrics
      client.emit('connected', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        qualityMetrics,
        lamportClock,
      });

      // Start quality monitoring for this client
      await this.startQualityMonitoringForClient(client.id);

    } catch (error) {
      this.logger.error(`Connection error for socket ${client.id}:`, error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);

    if (clientInfo) {
      const { userId, subscriptions, qualityMetrics } = clientInfo;

      // Get final bandwidth validation
      const bandwidthValidation = await this.differentialSyncService.getBandwidthValidationResult(client.id);

      // Record disconnection event
      await this.connectionQualityMonitor.recordConnectionEvent(client.id, 'disconnect');

      // Stop quality monitoring
      await this.stopQualityMonitoringForClient(client.id);

      // Leave all subscription rooms
      await this.leaveAllSubscriptionRooms(client, subscriptions);

      // Remove from user room
      await client.leave(`user:${userId}`);

      // Clean up Lamport clock data via DifferentialSyncService
      await this.differentialSyncService.cleanupClient(client.id);

      // Remove from connected clients
      this.connectedClients.delete(client.id);

      // Notify other clients about user going offline with quality metrics
      client.broadcast.emit('user:offline', {
        userId,
        timestamp: new Date().toISOString(),
        qualityMetrics: {
          finalQualityScore: qualityMetrics.qualityScore,
          meetsLatencyTarget: qualityMetrics.latency <= 100,
        },
        bandwidthValidation,
      });

      this.logger.log(`User ${userId} disconnected from socket ${client.id} with final quality score: ${qualityMetrics.qualityScore}`);
    }
  }

  // Message handlers
  @SubscribeMessage('subscribe:trends')
  async handleSubscribeTrends(
    @MessageBody() data: SubscribeToTrendsDto,
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const { trendIds, subscribeAll } = data;

    if (subscribeAll) {
      // Subscribe to all active trends
      const activeTrends = await this.trendService.getActiveTrends();
      const trendIds = activeTrends.map(trend => trend.id);

      for (const trendId of trendIds) {
        await client.join(`trend:${trendId}`);
        if (!clientInfo.subscriptions.trends.includes(trendId)) {
          clientInfo.subscriptions.trends.push(trendId);
        }
      }
    } else {
      // Subscribe to specific trends
      for (const trendId of trendIds) {
        await client.join(`trend:${trendId}`);
        if (!clientInfo.subscriptions.trends.includes(trendId)) {
          clientInfo.subscriptions.trends.push(trendId);
        }
      }
    }

    // Update last activity
    clientInfo.lastActivity = new Date();

    client.emit('subscription:confirmed', {
      type: 'trends',
      trendIds: clientInfo.subscriptions.trends,
    });
  }

  @SubscribeMessage('unsubscribe:trends')
  async handleUnsubscribeTrends(
    @MessageBody() data: { trendIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const { trendIds } = data;

    for (const trendId of trendIds) {
      await client.leave(`trend:${trendId}`);
      const index = clientInfo.subscriptions.trends.indexOf(trendId);
      if (index > -1) {
        clientInfo.subscriptions.trends.splice(index, 1);
      }
    }

    client.emit('subscription:confirmed', {
      type: 'trends',
      trendIds: clientInfo.subscriptions.trends,
    });
  }

  @SubscribeMessage('subscribe:orders')
  async handleSubscribeOrders(
    @MessageBody() data: SubscribeToOrdersDto,
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const { userId } = data;
    const targetUserId = userId || clientInfo.userId;

    // Join user's orders room
    await client.join(`orders:${targetUserId}`);
    clientInfo.subscriptions.orders = true;

    // Send existing orders
    const orders = await this.orderMatchingService.getUserOrders(targetUserId);
    client.emit('orders:initial', orders);

    client.emit('subscription:confirmed', {
      type: 'orders',
      userId: targetUserId,
    });
  }

  @SubscribeMessage('subscribe:wallets')
  async handleSubscribeWallets(
    @MessageBody() data: SubscribeToWalletsDto,
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const { userId } = data;
    const targetUserId = userId || clientInfo.userId;

    // Join user's wallets room
    await client.join(`wallets:${targetUserId}`);
    clientInfo.subscriptions.wallets = true;

    // Send current wallet balances
    const wallets = await this.walletService.getUserWallets(targetUserId);
    client.emit('wallets:initial', wallets);

    client.emit('subscription:confirmed', {
      type: 'wallets',
      userId: targetUserId,
    });
  }

  @SubscribeMessage('subscribe:notifications')
  async handleSubscribeNotifications(
    @MessageBody() data: SubscribeToNotificationsDto,
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    // Join user's notifications room
    await client.join(`notifications:${clientInfo.userId}`);
    clientInfo.subscriptions.notifications = true;

    // Send recent notifications
    const notifications = await this.notificationService.getRecentNotifications(clientInfo.userId);
    client.emit('notifications:initial', notifications);

    client.emit('subscription:confirmed', {
      type: 'notifications',
    });
  }

  @SubscribeMessage('subscribe:market-data')
  async handleSubscribeMarketData(
    @MessageBody() data: { trendIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const { trendIds } = data;

    for (const trendId of trendIds) {
      await client.join(`market:${trendId}`);
      if (!clientInfo.subscriptions.marketData.includes(trendId)) {
        clientInfo.subscriptions.marketData.push(trendId);
      }
    }

    // Send current market data
    const marketData = await this.marketDataService.getMarketDataForTrends(trendIds);
    client.emit('market-data:initial', marketData);

    client.emit('subscription:confirmed', {
      type: 'market-data',
      trendIds: clientInfo.subscriptions.marketData,
    });
  }

  @SubscribeMessage('order:place')
  async handlePlaceOrder(
    @MessageBody() orderData: PlaceOrderDto,
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    try {
      // Place the order
      const order = await this.orderMatchingService.placeOrder({
        ...orderData,
        userId: clientInfo.userId,
      });

      // Emit order confirmation
      client.emit('order:placed', order);

      // Broadcast to order book subscribers
      this.server.to(`trend:${order.trendId}`).emit('order:new', order);

      // Update market data
      await this.updateAndBroadcastMarketData(order.trendId);

    } catch (error) {
      client.emit('order:error', {
        message: error.message,
        orderId: orderData.clientOrderId,
      });
    }
  }

  @SubscribeMessage('order:cancel')
  async handleCancelOrder(
    @MessageBody() data: CancelOrderDto,
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    try {
      const { orderId } = data;

      // Cancel the order
      const cancelledOrder = await this.orderMatchingService.cancelOrder(
        orderId,
        clientInfo.userId,
      );

      // Emit cancellation confirmation
      client.emit('order:cancelled', cancelledOrder);

      // Broadcast to order book subscribers
      this.server.to(`trend:${cancelledOrder.trendId}`).emit('order:cancelled', cancelledOrder);

    } catch (error) {
      client.emit('order:error', {
        message: error.message,
        orderId,
      });
    }
  }

  @SubscribeMessage('order:update')
  async handleUpdateOrder(
    @MessageBody() data: UpdateOrderDto,
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    try {
      const { orderId, updates } = data;

      // Update the order
      const updatedOrder = await this.orderMatchingService.updateOrder(
        orderId,
        updates,
        clientInfo.userId,
      );

      // Emit update confirmation
      client.emit('order:updated', updatedOrder);

      // Broadcast to order book subscribers
      this.server.to(`trend:${updatedOrder.trendId}`).emit('order:updated', updatedOrder);

    } catch (error) {
      client.emit('order:error', {
        message: error.message,
        orderId,
      });
    }
  }

  // Differential sync event handlers
  @SubscribeMessage('sync:request')
  async handleSyncRequest(
    @MessageBody() data: SyncRequestDto,
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const startTime = Date.now();

    try {
      // Update Lamport clock based on client's clock
      if (data.clientLamportClock) {
        await this.differentialSyncService.mergeLamportClocks(client.id, data.clientLamportClock);
      }

      // Calculate state deltas
      const syncRequest = {
        clientId: client.id,
        entityType: data.entityType,
        lastKnownVectorClock: data.lastKnownVectorClock,
        clientLamportClock: data.clientLamportClock,
        maxDeltaSize: data.maxDeltaSize,
        includeQualityMetrics: data.includeQualityMetrics !== false
      };

      const deltas = await this.differentialSyncService.calculateStateDelta(syncRequest);
      const currentLamportClock = await this.differentialSyncService.getLamportClock(client.id);

      // Calculate sync latency
      const syncLatency = Date.now() - startTime;

      // Update sync metrics
      clientInfo.syncMetrics = {
        latency: syncLatency,
        qualityScore: clientInfo.qualityMetrics.qualityScore,
        lastSyncTime: new Date(),
      };

      // Log warning if sync latency exceeds 100ms threshold
      if (syncLatency > 100) {
        this.logger.warn(`Sync latency ${syncLatency}ms exceeds 100ms threshold for client ${client.id}`);
      }

      // Get current vector clock
      const currentVectorClock = await this.differentialSyncService.getClientVectorClock(client.id);

      // Get quality metrics if requested
      let qualityMetrics;
      if (data.includeQualityMetrics) {
        await this.connectionQualityMonitor.recordLatency(client.id, syncLatency);
        qualityMetrics = await this.connectionQualityMonitor.getQualityMetrics(client.id);
        if (qualityMetrics) {
          clientInfo.qualityMetrics = qualityMetrics as QualityMetricsDto;
        }
      }

      // Get bandwidth validation if available
      const bandwidthValidation = await this.differentialSyncService.getBandwidthValidationResult(client.id);

      const response: SyncResponseDto = {
        clientId: client.id,
        entityType: data.entityType,
        deltas,
        currentVectorClock: currentVectorClock ? {
          clientId: currentVectorClock.clientId,
          versions: currentVectorClock.versions,
          timestamp: currentVectorClock.timestamp,
          lamportCounter: currentVectorClock.lamportCounter,
          nodeId: currentVectorClock.nodeId
        } : undefined,
        serverLamportClock: currentLamportClock || undefined,
        qualityMetrics: qualityMetrics ? {
          qualityScore: qualityMetrics.qualityScore,
          qualityScoreBreakdown: qualityMetrics.qualityScoreBreakdown,
          latency: qualityMetrics.avgLatency,
          packetLoss: qualityMetrics.packetLoss,
          jitter: qualityMetrics.jitter,
          connectionStability: qualityMetrics.connectionStability,
          usingPollingFallback: qualityMetrics.usingPollingFallback,
          meetsLatencyTarget: qualityMetrics.avgLatency <= 100,
          timestamp: Date.now()
        } : undefined,
        bandwidthValidation: bandwidthValidation ? {
          isValid: bandwidthValidation.isValid,
          actualReduction: bandwidthValidation.actualReduction,
          targetReduction: bandwidthValidation.targetReduction,
          fullSize: bandwidthValidation.fullSize,
          deltaSize: bandwidthValidation.deltaSize,
          timestamp: bandwidthValidation.timestamp
        } : undefined,
        timestamp: Date.now(),
      };

      client.emit('sync:response', response);

      // Record bandwidth metrics for this sync
      const fullSize = 1024; // Estimated full state size
      const deltaSize = JSON.stringify(response).length;
      await this.differentialSyncService.recordBandwidthMetrics(client.id, fullSize, deltaSize);

      this.logger.debug(`Sync completed for client ${client.id} in ${syncLatency}ms with ${deltas.length} deltas`);

    } catch (error) {
      this.logger.error(`Sync request failed for client ${client.id}:`, error);
      client.emit('sync:error', {
        message: 'Sync request failed',
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('sync:ping')
  async handleSyncPing(
    @MessageBody() data: { timestamp?: number; qualityMetrics?: QualityMetricsDto },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const pingTimestamp = data?.timestamp || Date.now();
    const responseTimestamp = Date.now();
    const latency = responseTimestamp - pingTimestamp;

    try {
      // Update Lamport clock
      const currentLamportClock = await this.differentialSyncService.incrementLamportClock(client.id);
      clientInfo.lamportClock = currentLamportClock;

      // Record latency measurement with 100ms threshold
      await this.connectionQualityMonitor.recordLatency(client.id, latency);

      // Update client's sync metrics
      clientInfo.syncMetrics.latency = latency;
      clientInfo.syncMetrics.lastSyncTime = new Date();

      // Get current quality metrics with breakdown
      const qualityMetrics = await this.connectionQualityMonitor.getQualityMetrics(client.id);
      if (qualityMetrics) {
        clientInfo.qualityMetrics = {
          qualityScore: qualityMetrics.qualityScore,
          qualityScoreBreakdown: {
            latencyScore: qualityMetrics.qualityScoreBreakdown.latencyScore,
            latencyWeight: qualityMetrics.qualityScoreBreakdown.latencyWeight,
            packetLossScore: qualityMetrics.qualityScoreBreakdown.packetLossScore,
            packetLossWeight: qualityMetrics.qualityScoreBreakdown.packetLossWeight,
            jitterScore: qualityMetrics.qualityScoreBreakdown.jitterScore,
            jitterWeight: qualityMetrics.qualityScoreBreakdown.jitterWeight,
            stabilityScore: qualityMetrics.qualityScoreBreakdown.stabilityScore,
            stabilityWeight: qualityMetrics.qualityScoreBreakdown.stabilityWeight
          },
          latency: qualityMetrics.avgLatency,
          packetLoss: qualityMetrics.packetLoss,
          jitter: qualityMetrics.jitter,
          connectionStability: qualityMetrics.connectionStability,
          usingPollingFallback: qualityMetrics.usingPollingFallback,
          meetsLatencyTarget: qualityMetrics.avgLatency <= 100,
          timestamp: Date.now()
        };
      }

      // Get bandwidth validation
      const bandwidthValidation = await this.differentialSyncService.getBandwidthValidationResult(client.id);

      // Set up ping/pong timeout of 2000ms for faster packet loss detection
      const pongTimeout = setTimeout(() => {
        this.logger.warn(`Pong timeout for client ${client.id} - possible packet loss`);
        this.connectionQualityMonitor.recordPacketLoss(client.id);
      }, 2000);

      // Send pong response with comprehensive quality metrics
      client.emit('sync:pong', {
        pingTimestamp,
        pongTimestamp: responseTimestamp,
        latency,
        lamportClock: currentLamportClock,
        qualityScore: qualityMetrics?.qualityScore || 0,
        qualityScoreBreakdown: qualityMetrics?.qualityScoreBreakdown,
        bandwidthValidation,
        timestamp: Date.now(),
      });

      // Clear timeout on successful pong
      client.once('sync:ack', () => {
        clearTimeout(pongTimeout);
      });

      this.logger.debug(`Ping/pong completed for client ${client.id} with latency ${latency}ms`);

    } catch (error) {
      this.logger.error(`Ping/pong failed for client ${client.id}:`, error);
    }
  }

  @SubscribeMessage('sync:get-quality-metrics')
  async handleGetQualityMetrics(
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    try {
      const qualityMetrics = await this.connectionQualityMonitor.getQualityMetrics(client.id);
      const lamportClock = await this.differentialSyncService.getLamportClock(client.id);
      const bandwidthValidation = await this.differentialSyncService.getBandwidthValidationResult(client.id);

      const response = {
        clientId: client.id,
        qualityMetrics: qualityMetrics ? {
          qualityScore: qualityMetrics.qualityScore,
          qualityScoreBreakdown: qualityMetrics.qualityScoreBreakdown,
          latency: qualityMetrics.avgLatency,
          packetLoss: qualityMetrics.packetLoss,
          jitter: qualityMetrics.jitter,
          connectionStability: qualityMetrics.connectionStability,
          usingPollingFallback: qualityMetrics.usingPollingFallback,
          meetsLatencyTarget: qualityMetrics.avgLatency <= 100,
          timestamp: Date.now()
        } : null,
        lamportClock,
        bandwidthValidation,
        timestamp: Date.now(),
      };

      client.emit('sync:quality-metrics', response);

    } catch (error) {
      this.logger.error(`Failed to get quality metrics for client ${client.id}:`, error);
      client.emit('sync:error', {
        message: 'Failed to retrieve quality metrics',
        timestamp: Date.now(),
      });
    }
  }

  // Private helper methods
  private extractTokenFromSocket(client: Socket): string | null {
    // Try query parameters first
    const token = client.handshake.query.token as string;
    if (token) return token;

    // Try authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  private async sendInitialData(client: Socket, userId: string): Promise<void> {
    try {
      // Send user profile
      const user = await this.authService.getUserById(userId);
      client.emit('user:profile', user);

      // Send active trends
      const trends = await this.trendService.getActiveTrends();
      client.emit('trends:list', trends);

      // Send user's open orders
      const openOrders = await this.orderMatchingService.getUserOpenOrders(userId);
      client.emit('orders:open', openOrders);

      // Send user's wallet balances
      const wallets = await this.walletService.getUserWallets(userId);
      client.emit('wallets:balances', wallets);

      // Send unread notifications count
      const unreadCount = await this.notificationService.getUnreadCount(userId);
      client.emit('notifications:unread-count', unreadCount);

    } catch (error) {
      this.logger.error('Error sending initial data:', error);
    }
  }

  private async leaveAllSubscriptionRooms(client: Socket, subscriptions: any): Promise<void> {
    const rooms = [
      ...subscriptions.trends.map((id: string) => `trend:${id}`),
      ...subscriptions.marketData.map((id: string) => `market:${id}`),
      `orders:${subscriptions.orders ? 'all' : ''}`,
      `wallets:${subscriptions.wallets ? 'all' : ''}`,
      `notifications:${subscriptions.notifications ? 'all' : ''}`,
    ].filter(Boolean);

    for (const room of rooms) {
      await client.leave(room);
    }
  }

  private async updateAndBroadcastMarketData(trendId: string): Promise<void> {
    try {
      const marketData = await this.marketDataService.getMarketData(trendId);

      // Broadcast to market data subscribers
      this.server.to(`market:${trendId}`).emit('market-data:update', {
        trendId,
        ...marketData,
      });

      // Also broadcast to trend subscribers
      this.server.to(`trend:${trendId}`).emit('trend:market-update', {
        trendId,
        ...marketData,
      });

    } catch (error) {
      this.logger.error('Error updating market data:', error);
    }
  }

  private setupInternalEventListeners(): void {
    // Listen to order matching events
    this.orderMatchingService.on('order:matched', (data) => {
      this.handleOrderMatched(data);
    });

    // Listen to wallet events
    this.walletService.on('wallet:updated', (data) => {
      this.handleWalletUpdated(data);
    });

    // Listen to notification events
    this.notificationService.on('notification:created', (data) => {
      this.handleNotificationCreated(data);
    });

    // Listen to trend events
    this.trendService.on('trend:updated', (data) => {
      this.handleTrendUpdated(data);
    });
  }

  private setupRedisPubSub(): void {
    // Subscribe to Redis channels for cross-instance communication
    this.redis.subscribe('ws:broadcast', (err, count) => {
      if (err) {
        this.logger.error('Redis subscription error:', err);
      } else {
        this.logger.log(`Subscribed to ${count} Redis channel(s)`);
      }
    });

    this.redis.on('message', (channel, message) => {
      if (channel === 'ws:broadcast') {
        try {
          const data = JSON.parse(message);
          this.handleRedisBroadcast(data);
        } catch (error) {
          this.logger.error('Error parsing Redis message:', error);
        }
      }
    });
  }

  private async handleOrderMatched(data: any): Promise<void> {
    const { makerOrder, takerOrder, fill } = data;

    // Update order book for the trend
    await this.updateAndBroadcastMarketData(makerOrder.trendId);

    // Notify users involved
    this.server.to(`orders:${makerOrder.userId}`).emit('order:matched', {
      order: makerOrder,
      fill,
      role: 'maker',
    });

    this.server.to(`orders:${takerOrder.userId}`).emit('order:matched', {
      order: takerOrder,
      fill,
      role: 'taker',
    });

    // Update wallets
    await this.broadcastWalletUpdate(makerOrder.userId);
    await this.broadcastWalletUpdate(takerOrder.userId);
  }

  private async handleWalletUpdated(data: any): Promise<void> {
    const { userId, wallet, transaction } = data;

    this.server.to(`wallets:${userId}`).emit('wallet:updated', {
      wallet,
      transaction,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleNotificationCreated(data: any): Promise<void> {
    const { userId, notification } = data;

    // Send to specific user
    this.server.to(`notifications:${userId}`).emit('notification:new', notification);

    // Update unread count
    const unreadCount = await this.notificationService.getUnreadCount(userId);
    this.server.to(`user:${userId}`).emit('notifications:unread-count', unreadCount);
  }

  private async handleTrendUpdated(data: any): Promise<void> {
    const { trend, changes } = data;

    // Broadcast to trend subscribers
    this.server.to(`trend:${trend.id}`).emit('trend:updated', {
      trend,
      changes,
      timestamp: new Date().toISOString(),
    });

    // Update market data
    await this.updateAndBroadcastMarketData(trend.id);
  }

  private async handleRedisBroadcast(data: any): Promise<void> {
    const { event, payload, room, targetUsers } = data;

    if (room) {
      this.server.to(room).emit(event, payload);
    } else if (targetUsers) {
      for (const userId of targetUsers) {
        this.server.to(`user:${userId}`).emit(event, payload);
      }
    } else {
      this.server.emit(event, payload);
    }
  }

  private async broadcastWalletUpdate(userId: string): Promise<void> {
    try {
      const wallets = await this.walletService.getUserWallets(userId);
      this.server.to(`wallets:${userId}`).emit('wallets:balances', wallets);
    } catch (error) {
      this.logger.error('Error broadcasting wallet update:', error);
    }
  }

  // Broker-specific event handlers
  @SubscribeMessage('subscribe:broker-dashboard')
  async handleSubscribeBrokerDashboard(
    @MessageBody() data: { brokerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);

    if (!clientInfo) {
      client.emit('error', { message: 'Client not found' });
      return;
    }

    // Validate that user has access to this broker
    // In a real implementation, this would check user permissions
    const { brokerId } = data;

    try {
      // Join broker-specific room
      client.join(`broker-dashboard:${brokerId}`);

      // Add broker dashboard subscription
      if (!clientInfo.subscriptions) {
        (clientInfo.subscriptions as any) = { brokerDashboards: [] };
      }
      if (!clientInfo.subscriptions.brokerDashboards) {
        (clientInfo.subscriptions.brokerDashboards as any) = [];
      }
      (clientInfo.subscriptions.brokerDashboards as any).push(brokerId);

      // Update room memberships
      if (!this.roomMemberships.has(`broker-dashboard:${brokerId}`)) {
        this.roomMemberships.set(`broker-dashboard:${brokerId}`, new Set());
      }
      this.roomMemberships.get(`broker-dashboard:${brokerId}`).add(client.id);

      this.logger.log(`Client ${client.id} subscribed to broker dashboard: ${brokerId}`);

      client.emit('subscription:confirmed', {
        type: 'broker-dashboard',
        brokerId,
      });
    } catch (error) {
      this.logger.error(`Failed to subscribe client to broker dashboard:`, error);
      client.emit('error', { message: 'Failed to subscribe to broker dashboard' });
    }
  }

  @SubscribeMessage('unsubscribe:broker-dashboard')
  async handleUnsubscribeBrokerDashboard(
    @MessageBody() data: { brokerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);

    if (!clientInfo) {
      client.emit('error', { message: 'Client not found' });
      return;
    }

    const { brokerId } = data;

    try {
      // Leave broker-specific room
      client.leave(`broker-dashboard:${brokerId}`);

      // Remove subscription
      if (clientInfo.subscriptions?.brokerDashboards) {
        const index = (clientInfo.subscriptions.brokerDashboards as string[]).indexOf(brokerId);
        if (index > -1) {
          (clientInfo.subscriptions.brokerDashboards as string[]).splice(index, 1);
        }
      }

      // Update room memberships
      const roomMembers = this.roomMemberships.get(`broker-dashboard:${brokerId}`);
      if (roomMembers) {
        roomMembers.delete(client.id);
        if (roomMembers.size === 0) {
          this.roomMemberships.delete(`broker-dashboard:${brokerId}`);
        }
      }

      this.logger.log(`Client ${client.id} unsubscribed from broker dashboard: ${brokerId}`);

      client.emit('unsubscription:confirmed', {
        type: 'broker-dashboard',
        brokerId,
      });
    } catch (error) {
      this.logger.error(`Failed to unsubscribe client from broker dashboard:`, error);
    }
  }

  // Enhanced methods for order matching and wallet modules
  @SubscribeMessage('subscribe:orderbook')
  async handleSubscribeOrderBook(
    @MessageBody() data: { symbol: string; depth?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const { symbol, depth = 20 } = data;

    try {
      // Join order book room for the symbol
      await client.join(`orderbook:${symbol}`);

      // Fetch current order book snapshot
      const orderBook = await this.orderBookService.getOrderBook(symbol, depth);

      if (orderBook) {
        // Send immediate order book snapshot to the client
        client.emit('orderbook:snapshot', {
          symbol,
          orderBook,
          timestamp: new Date(),
        });
      }

      client.emit('subscription:confirmed', {
        type: 'orderbook',
        symbol,
        depth,
      });

      this.logger.debug(`Client ${client.id} subscribed to order book for ${symbol} with depth ${depth}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe client ${client.id} to order book for ${symbol}:`, error);

      client.emit('subscription:error', {
        type: 'orderbook',
        symbol,
        error: 'Failed to subscribe to order book',
      });
    }
  }

  @SubscribeMessage('unsubscribe:orderbook')
  async handleUnsubscribeOrderBook(
    @MessageBody() data: { symbol: string },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const { symbol } = data;

    try {
      // Leave order book room for the symbol
      await client.leave(`orderbook:${symbol}`);

      client.emit('subscription:confirmed', {
        type: 'orderbook',
        symbol,
        action: 'unsubscribed',
      });

      this.logger.debug(`Client ${client.id} unsubscribed from order book for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe client ${client.id} from order book for ${symbol}:`, error);

      client.emit('subscription:error', {
        type: 'orderbook',
        symbol,
        error: 'Failed to unsubscribe from order book',
      });
    }
  }

  // Public methods for broadcasting from other services
  public async broadcastOrderBookUpdate(symbol: string, orderBook: any): Promise<void> {
    try {
      await this.server.to(`orderbook:${symbol}`).emit('orderbook:update', {
        symbol,
        orderBook,
        timestamp: new Date(),
      });

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'orderbook:update',
        payload: { symbol, orderBook },
        room: `orderbook:${symbol}`,
      }));
    } catch (error) {
      this.logger.error(`Failed to broadcast order book update for ${symbol}:`, error);
    }
  }

  public async broadcastOrderFilled(order: any): Promise<void> {
    try {
      // Send to user's personal room
      await this.server.to(`user:${order.userId}`).emit('order:filled', {
        orderId: order.id,
        userId: order.userId,
        symbol: order.symbol,
        side: order.side,
        filledQuantity: order.filled_quantity,
        remainingQuantity: order.remaining_quantity,
        avgFillPrice: order.avg_fill_price,
        totalValue: order.total_value,
        commission: order.commission,
        fee: order.fee,
        fills: order.fills,
        status: order.status,
        timestamp: new Date(),
      });

      // Also publish to Redis
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'order:filled',
        payload: order,
        targetUsers: [order.userId],
      }));
    } catch (error) {
      this.logger.error(`Failed to broadcast order filled for ${order.id}:`, error);
    }
  }

  public async broadcastWalletBalanceUpdate(userId: string, wallets: any[]): Promise<void> {
    try {
      const portfolioValue = await this.walletService.getPortfolioValue(userId);

      await this.server.to(`user:${userId}`).emit('wallet:balance-update', {
        userId,
        wallets,
        portfolioValue,
        timestamp: new Date(),
      });

      // Also publish to Redis
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'wallet:balance-update',
        payload: { userId, wallets, portfolioValue },
        targetUsers: [userId],
      }));
    } catch (error) {
      this.logger.error(`Failed to broadcast wallet balance update for user ${userId}:`, error);
    }
  }

  public async broadcastToRoom(room: string, event: string, payload: any): Promise<void> {
    try {
      this.server.to(room).emit(event, payload);

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event,
        payload,
        room,
      }));
    } catch (error) {
      this.logger.error(`Failed to broadcast to room ${room}:`, error);
    }
  }

  public async broadcastToUser(userId: string, event: string, payload: any): Promise<void> {
    try {
      this.server.to(`user:${userId}`).emit(event, payload);

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event,
        payload,
        targetUsers: [userId],
      }));
    } catch (error) {
      this.logger.error(`Failed to broadcast to user ${userId}:`, error);
    }
  }

  // Get connection statistics
  public getConnectionStats(): {
    totalConnections: number;
    activeUsers: number;
    subscriptions: {
      trends: number;
      orders: number;
      wallets: number;
      notifications: number;
      marketData: number;
      orderbook: number;
    };
  } {
    const stats = {
      totalConnections: this.connectedClients.size,
      activeUsers: new Set([...this.connectedClients.values()].map(c => c.userId)).size,
      subscriptions: {
        trends: 0,
        orders: 0,
        wallets: 0,
        notifications: 0,
        marketData: 0,
        orderbook: 0,
      },
    };

    for (const client of this.connectedClients.values()) {
      stats.subscriptions.trends += client.subscriptions.trends.length;
      if (client.subscriptions.orders) stats.subscriptions.orders++;
      if (client.subscriptions.wallets) stats.subscriptions.wallets++;
      if (client.subscriptions.notifications) stats.subscriptions.notifications++;
      stats.subscriptions.marketData += client.subscriptions.marketData.length;
      // Orderbook subscriptions are tracked separately in room memberships
    }

    // Count orderbook subscriptions from room memberships
    for (const [room, members] of this.roomMemberships.entries()) {
      if (room.startsWith('orderbook:')) {
        stats.subscriptions.orderbook += members.size;
      }
    }

    return stats;
  }

  // Broker-specific public methods
  public async broadcastBrokerMetrics(brokerId: string, metrics: any): Promise<void> {
    try {
      this.server.to(`broker-dashboard:${brokerId}`).emit('broker:metrics', {
        brokerId,
        metrics,
        timestamp: new Date().toISOString(),
      });

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'broker:metrics',
        payload: {
          brokerId,
          metrics,
          timestamp: new Date().toISOString(),
        },
        room: `broker-dashboard:${brokerId}`,
      }));
    } catch (error) {
      this.logger.error(`Failed to broadcast broker metrics for ${brokerId}:`, error);
    }
  }

  public async broadcastComplianceAlert(brokerId: string, alert: any): Promise<void> {
    try {
      this.server.to(`broker-dashboard:${brokerId}`).emit('broker:compliance-alert', {
        brokerId,
        alert,
        timestamp: new Date().toISOString(),
      });

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'broker:compliance-alert',
        payload: {
          brokerId,
          alert,
          timestamp: new Date().toISOString(),
        },
        room: `broker-dashboard:${brokerId}`,
      }));
    } catch (error) {
      this.logger.error(`Failed to broadcast compliance alert for broker ${brokerId}:`, error);
    }
  }

  public async broadcastBillNotification(brokerId: string, bill: any): Promise<void> {
    try {
      this.server.to(`broker-dashboard:${brokerId}`).emit('broker:bill-notification', {
        brokerId,
        bill,
        timestamp: new Date().toISOString(),
      });

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'broker:bill-notification',
        payload: {
          brokerId,
          bill,
          timestamp: new Date().toISOString(),
        },
        room: `broker-dashboard:${brokerId}`,
      }));
    } catch (error) {
      this.logger.error(`Failed to broadcast bill notification for broker ${brokerId}:`, error);
    }
  }

  public async broadcastIntegrationTestResult(brokerId: string, testResult: any): Promise<void> {
    try {
      this.server.to(`broker-dashboard:${brokerId}`).emit('broker:integration-test-result', {
        brokerId,
        testResult,
        timestamp: new Date().toISOString(),
      });

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'broker:integration-test-result',
        payload: {
          brokerId,
          testResult,
          timestamp: new Date().toISOString(),
        },
        room: `broker-dashboard:${brokerId}`,
      }));
    } catch (error) {
      this.logger.error(`Failed to broadcast integration test result for broker ${brokerId}:`, error);
    }
  }

  public async broadcastVerificationResult(brokerId: string, verificationResult: any): Promise<void> {
    try {
      this.server.to(`broker-dashboard:${brokerId}`).emit('broker:verification-result', {
        brokerId,
        verificationResult,
        timestamp: new Date().toISOString(),
      });

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'broker:verification-result',
        payload: {
          brokerId,
          verificationResult,
          timestamp: new Date().toISOString(),
        },
        room: `broker-dashboard:${brokerId}`,
      }));
    } catch (error) {
      this.logger.error(`Failed to broadcast verification result for broker ${brokerId}:`, error);
    }
  }

  // Analytics subscription methods
  @SubscribeMessage('subscribe:analytics')
  async handleSubscribeAnalytics(
    @MessageBody() data: { symbol: string; timeframe?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const { symbol, timeframe = '1h' } = data;

    try {
      // Join analytics room for the symbol
      await client.join(`analytics:${symbol}`);

      // Update client subscriptions
      if (!clientInfo.subscriptions.analytics.includes(symbol)) {
        clientInfo.subscriptions.analytics.push(symbol);
      }

      // Get initial analytics data
      // This would typically call AnalyticsService
      const initialAnalyticsData = await this.getInitialAnalyticsData(symbol, timeframe);

      // Send initial data to the client
      client.emit('analytics:initial-data', {
        symbol,
        timeframe,
        data: initialAnalyticsData,
        timestamp: new Date(),
      });

      client.emit('subscription:confirmed', {
        type: 'analytics',
        symbol,
        timeframe,
      });

      this.logger.debug(`Client ${client.id} subscribed to analytics for ${symbol} with timeframe ${timeframe}`);

    } catch (error) {
      this.logger.error(`Failed to subscribe client to analytics for ${symbol}:`, error);
      client.emit('subscription:error', {
        type: 'analytics',
        symbol,
        error: 'Failed to subscribe to analytics',
      });
    }
  }

  @SubscribeMessage('unsubscribe:analytics')
  async handleUnsubscribeAnalytics(
    @MessageBody() data: { symbol: string },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const { symbol } = data;

    try {
      // Leave analytics room
      await client.leave(`analytics:${symbol}`);

      // Update client subscriptions
      const index = clientInfo.subscriptions.analytics.indexOf(symbol);
      if (index > -1) {
        clientInfo.subscriptions.analytics.splice(index, 1);
      }

      // Clean up room membership
      const roomMembers = this.roomMemberships.get(`analytics:${symbol}`);
      if (roomMembers) {
        roomMembers.delete(client.id);
        if (roomMembers.size === 0) {
          this.roomMemberships.delete(`analytics:${symbol}`);
        }
      }

      this.logger.debug(`Client ${client.id} unsubscribed from analytics for ${symbol}`);

      client.emit('unsubscription:confirmed', {
        type: 'analytics',
        symbol,
      });

    } catch (error) {
      this.logger.error(`Failed to unsubscribe client from analytics for ${symbol}:`, error);
    }
  }

  @SubscribeMessage('subscribe:backtest-updates')
  async handleSubscribeBacktestUpdates(
    @MessageBody() data: { userId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    const { userId } = data;

    try {
      // Users can only subscribe to their own backtest updates unless admin
      const targetUserId = userId || clientInfo.userId;

      if (targetUserId !== clientInfo.userId) {
        client.emit('subscription:error', {
          type: 'backtest-updates',
          error: 'Not authorized to subscribe to other users backtest updates',
        });
        return;
      }

      // Join backtest updates room for the user
      await client.join(`backtest-updates:${targetUserId}`);

      client.emit('subscription:confirmed', {
        type: 'backtest-updates',
        userId: targetUserId,
      });

      this.logger.debug(`Client ${client.id} subscribed to backtest updates for user ${targetUserId}`);

    } catch (error) {
      this.logger.error(`Failed to subscribe client to backtest updates:`, error);
      client.emit('subscription:error', {
        type: 'backtest-updates',
        error: 'Failed to subscribe to backtest updates',
      });
    }
  }

  // Analytics broadcast methods
  public async broadcastAnalyticsUpdate(symbol: string, analyticsData: any): Promise<void> {
    try {
      this.server.to(`analytics:${symbol}`).emit('analytics:update', {
        symbol,
        data: analyticsData,
        timestamp: new Date(),
      });

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'analytics:update',
        payload: {
          symbol,
          data: analyticsData,
          timestamp: new Date(),
        },
        room: `analytics:${symbol}`,
      }));

    } catch (error) {
      this.logger.error(`Failed to broadcast analytics update for ${symbol}:`, error);
    }
  }

  public async broadcastBacktestCompleted(userId: string, backtestResult: any): Promise<void> {
    try {
      this.server.to(`backtest-updates:${userId}`).emit('backtest:completed', {
        userId,
        result: backtestResult,
        timestamp: new Date(),
      });

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'backtest:completed',
        payload: {
          userId,
          result: backtestResult,
          timestamp: new Date(),
        },
        room: `backtest-updates:${userId}`,
      }));

    } catch (error) {
      this.logger.error(`Failed to broadcast backtest completion for user ${userId}:`, error);
    }
  }

  public async broadcastReportReady(userId: string, reportId: string): Promise<void> {
    try {
      this.server.to(`backtest-updates:${userId}`).emit('report:ready', {
        userId,
        reportId,
        timestamp: new Date(),
      });

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'report:ready',
        payload: {
          userId,
          reportId,
          timestamp: new Date(),
        },
        room: `backtest-updates:${userId}`,
      }));

    } catch (error) {
      this.logger.error(`Failed to broadcast report readiness for user ${userId}:`, error);
    }
  }

  public async broadcastPerformanceUpdate(entityType: string, entityId: string, performanceData: any): Promise<void> {
    try {
      this.server.to(`analytics:${entityId}`).emit('performance:update', {
        entityType,
        entityId,
        data: performanceData,
        timestamp: new Date(),
      });

      // Also publish to Redis for cross-instance broadcasting
      await this.redis.publish('ws:broadcast', JSON.stringify({
        event: 'performance:update',
        payload: {
          entityType,
          entityId,
          data: performanceData,
          timestamp: new Date(),
        },
        room: `analytics:${entityId}`,
      }));

    } catch (error) {
      this.logger.error(`Failed to broadcast performance update for ${entityType}:${entityId}:`, error);
    }
  }

  // Helper methods for analytics
  private async getInitialAnalyticsData(symbol: string, timeframe: string): Promise<any> {
    try {
      // Build AnalyticsQuery with sensible defaults
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24h default
      const interval = this.mapTimeframeToInterval(timeframe);

      const analyticsQuery = {
        symbol,
        startTime,
        endTime,
        interval,
        metrics: ['viralityScore', 'sentimentScore', 'velocity', 'engagementRate', 'momentumScore'],
      };

      // Get real analytics data from AnalyticsService
      const analyticsData = await this.analyticsService.getAnalyticsData(analyticsQuery);

      if (!analyticsData || !analyticsData.data || analyticsData.data.length === 0) {
        // Fallback to real-time metrics if no historical data
        const realTimeMetrics = await this.analyticsService.calculateRealTimeMetrics(symbol);
        return {
          viralityScore: realTimeMetrics.viralityScore || 0,
          sentimentScore: realTimeMetrics.sentimentScore || 0,
          velocity: realTimeMetrics.velocity || 0,
          engagementRate: realTimeMetrics.engagementRate || 0,
          momentumScore: realTimeMetrics.momentumScore || 0,
          lastUpdated: realTimeMetrics.timestamp,
        };
      }

      // Return the latest data point from analytics data
      const latestData = analyticsData.data[analyticsData.data.length - 1];
      return {
        viralityScore: latestData.viralityScore || 0,
        sentimentScore: latestData.sentimentScore || 0,
        velocity: latestData.velocity || 0,
        engagementRate: latestData.engagementRate || 0,
        momentumScore: latestData.momentumScore || 0,
        lastUpdated: latestData.timestamp,
        historicalDataPoints: analyticsData.data.length,
        source: analyticsData.metadata?.source || 'analytics_service',
      };
    } catch (error) {
      this.logger.error(`Failed to get initial analytics data for ${symbol}:`, error);
      // Return minimal fallback data
      return {
        viralityScore: 0,
        sentimentScore: 0,
        velocity: 0,
        engagementRate: 0,
        momentumScore: 0,
        lastUpdated: new Date(),
        error: 'Failed to fetch analytics data',
      };
    }
  }

  /**
   * Map WebSocket timeframe strings to AnalyticsService interval format
   */
  private mapTimeframeToInterval(timeframe: string): string {
    switch (timeframe.toLowerCase()) {
      case '1m':
        return '1m';
      case '5m':
        return '5m';
      case '15m':
        return '15m';
      case '1h':
        return '1h';
      case '4h':
        return '4h';
      case '1d':
        return '1d';
      default:
        return '1h'; // Default to 1 hour
    }
  }

  /**
   * Start quality monitoring for a client with configurable ping interval
   */
  async startQualityMonitoringForClient(clientId: string): Promise<void> {
    const clientInfo = this.connectedClients.get(clientId);
    if (!clientInfo) {
      this.logger.warn(`Cannot start quality monitoring for client ${clientId} - not found`);
      return;
    }

    // Get configurable ping interval (default 30000ms)
    const pingInterval = this.configService.get<number>('WS_QUALITY_MONITORING_INTERVAL', 30000);

    // Track sub-100ms latency success percentage
    let totalPings = 0;
    let sub100msCount = 0;

    this.logger.debug(`Starting quality monitoring for client ${clientId} with ${pingInterval}ms interval`);

    const monitoringInterval = setInterval(async () => {
      const currentClientInfo = this.connectedClients.get(clientId);
      if (!currentClientInfo) {
        clearInterval(monitoringInterval);
        this.logger.debug(`Quality monitoring stopped for client ${clientId} - client disconnected`);
        return;
      }

      try {
        // Send ping with timestamp
        const pingTimestamp = Date.now();

        // Set up pong timeout of 2000ms for faster packet loss detection
        const pongTimeout = setTimeout(() => {
          this.logger.warn(`Quality monitoring ping timeout for client ${clientId} - possible connection issues`);
          this.connectionQualityMonitor.recordPacketLoss(clientId);
          this.connectionQualityMonitor.recordConnectionEvent(clientId, 'packet_loss', 'Quality monitoring timeout');
        }, 2000);

        // Listen for pong response
        const onPong = (data: any) => {
          clearTimeout(pongTimeout);

          const responseTimestamp = Date.now();
          const latency = responseTimestamp - data.pingTimestamp;

          totalPings++;
          if (latency <= 100) {
            sub100msCount++;
          }

          // Update client sync metrics
          currentClientInfo.syncMetrics.latency = latency;
          currentClientInfo.syncMetrics.lastSyncTime = new Date();
          currentClientInfo.syncMetrics.qualityScore = currentClientInfo.qualityMetrics.qualityScore;

          // Record latency measurement
          this.connectionQualityMonitor.recordLatency(clientId, latency);

          // Update Lamport clock
          this.differentialSyncService.incrementLamportClock(clientId);

          // Calculate and log sub-100ms success percentage
          const successPercentage = totalPings > 0 ? (sub100msCount / totalPings) * 100 : 0;

          if (successPercentage < 80) {
            this.logger.warn(`Client ${clientId} sub-100ms latency success rate: ${successPercentage.toFixed(1)}%`);
          }

          this.logger.debug(`Quality monitoring ping for client ${clientId}: ${latency}ms latency, ${successPercentage.toFixed(1)}% success`);
        };

        // Add one-time listener for this ping
        currentClientInfo.socket.once('quality-monitor:pong', onPong);

        // Send ping
        currentClientInfo.socket.emit('quality-monitor:ping', {
          timestamp: pingTimestamp,
          monitoringInterval: pingInterval,
          targetLatency: 100,
        });

      } catch (error) {
        this.logger.error(`Quality monitoring error for client ${clientId}:`, error);
        this.connectionQualityMonitor.recordConnectionEvent(clientId, 'latency_spike', 'Quality monitoring error');
      }
    }, pingInterval);

    // Store interval reference for cleanup
    (clientInfo as any).qualityMonitoringInterval = monitoringInterval;
  }

  /**
   * Stop quality monitoring for a client
   */
  async stopQualityMonitoringForClient(clientId: string): Promise<void> {
    const clientInfo = this.connectedClients.get(clientId);
    if (clientInfo && (clientInfo as any).qualityMonitoringInterval) {
      clearInterval((clientInfo as any).qualityMonitoringInterval);
      delete (clientInfo as any).qualityMonitoringInterval;
      this.logger.debug(`Quality monitoring stopped for client ${clientId}`);
    }
  }
}