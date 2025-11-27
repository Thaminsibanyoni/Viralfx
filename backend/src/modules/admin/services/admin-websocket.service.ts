import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway as WSGateway } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { ConnectionQualityMonitorService, ConnectionQualityMetrics } from '../../websocket/services/connection-quality-monitor.service';
import { DifferentialSyncService, BandwidthValidationResult } from '../../websocket/services/differential-sync.service';

interface AdminClient {
  socket: Socket;
  adminId: string;
  department?: string;
  subscriptions: string[];
  lastActivity: Date;
}

interface SystemQualityMetrics {
  totalConnections: number;
  averageQualityScore: number;
  sub100msLatencyPercentage: number;
  bandwidth87ReductionPercentage: number;
  connectionsInFallback: number;
  qualityDistribution: {
    excellent: number;  // 90-100
    good: number;       // 70-89
    fair: number;       // 50-69
    poor: number;       // <50
  };
  systemAverages: {
    latency: number;
    packetLoss: number;
    jitter: number;
    stability: number;
  };
  timestamp: Date;
}

interface BandwidthValidationReport {
  totalClients: number;
  averageReduction: number;
  targetReduction: number;
  meetingTarget: number;
  belowTarget: number;
  clientsBelowTarget: Array<{
    clientId: string;
    actualReduction: number;
    targetReduction: number;
    fullSize: number;
    deltaSize: number;
  }>;
  timestamp: Date;
}

@Injectable()
@WSGateway({
  namespace: '/admin',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket'],
})
export class AdminWebSocketService implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdminWebSocketService.name);
  private connectedClients: Map<string, AdminClient> = new Map();
  private roomSubscriptions: Map<string, Set<string>> = new Map();

  // Cache prefixes for admin dashboard data
  private readonly DASHBOARD_CACHE_PREFIX = 'admin:dashboard:';
  private readonly DEPARTMENT_CACHE_PREFIX = 'admin:department:';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly connectionQualityMonitor: ConnectionQualityMonitorService,
    private readonly differentialSync: DifferentialSyncService,
  ) {
    this.startPeriodicUpdates();
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Admin client connected: ${client.id}`);

    try {
      // Verify admin token from auth query
      const token = client.handshake.auth.token || client.handshake.query.token;
      if (!token) {
        this.logger.warn(`Connection rejected - no token provided: ${client.id}`);
        client.disconnect(true);
        return;
      }

      // This would verify the JWT token and extract admin info
      // const admin = await this.verifyAdminToken(token);

      // For now, mock admin data
      const mockAdmin = {
        id: 'mock-admin-id',
        email: 'admin@viralfx.com',
        role: 'SuperAdmin',
        department: 'all',
      };

      const adminClient: AdminClient = {
        socket: client,
        adminId: mockAdmin.id,
        department: mockAdmin.department,
        subscriptions: [],
        lastActivity: new Date(),
      };

      this.connectedClients.set(client.id, adminClient);

      // Send initial data
      client.emit('connected', {
        clientId: client.id,
        adminId: mockAdmin.id,
        timestamp: new Date(),
      });

      // Join admin to default rooms
      client.join(`admin:${mockAdmin.id}`);
      client.join('dashboard:global');

      if (mockAdmin.department && mockAdmin.department !== 'all') {
        client.join(`department:${mockAdmin.department}`);
      }

      // Send initial dashboard data
      await this.sendDashboardUpdate(client);

    } catch (error) {
      this.logger.error(`Failed to authenticate admin client ${client.id}:`, error);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Admin client disconnected: ${client.id}`);

    const adminClient = this.connectedClients.get(client.id);
    if (adminClient) {
      // Remove from all rooms
      client.leaveAll();

      // Clean up subscriptions
      this.connectedClients.delete(client.id);

      // Broadcast user count update
      this.broadcastConnectedCount();
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscription(client: Socket, data: { channels: string[] }) {
    const adminClient = this.connectedClients.get(client.id);
    if (!adminClient) return;

    data.channels.forEach(channel => {
      client.join(channel);
      adminClient.subscriptions.push(channel);

      // Track room subscriptions
      if (!this.roomSubscriptions.has(channel)) {
        this.roomSubscriptions.set(channel, new Set());
      }
      this.roomSubscriptions.get(channel)?.add(client.id);
    });

    this.logger.log(`Client ${client.id} subscribed to channels:`, data.channels);
    client.emit('subscribed', { channels: data.channels });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscription(client: Socket, data: { channels: string[] }) {
    const adminClient = this.connectedClients.get(client.id);
    if (!adminClient) return;

    data.channels.forEach(channel => {
      client.leave(channel);
      adminClient.subscriptions = adminClient.subscriptions.filter(s => s !== channel);

      // Remove from room tracking
      this.roomSubscriptions.get(channel)?.delete(client.id);
    });

    this.logger.log(`Client ${client.id} unsubscribed from channels:`, data.channels);
    client.emit('unsubscribed', { channels: data.channels });
  }

  @SubscribeMessage('request_dashboard_data')
  async handleDashboardRequest(client: Socket, data: { timeframe?: string }) {
    await this.sendDashboardUpdate(client, data.timeframe);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    const adminClient = this.connectedClients.get(client.id);
    if (adminClient) {
      adminClient.lastActivity = new Date();
      client.emit('pong', { timestamp: new Date() });
    }
  }

  @SubscribeMessage('admin:quality-metrics')
  async handleQualityMetricsRequest(client: Socket) {
    const adminClient = this.connectedClients.get(client.id);
    if (!adminClient) return;

    try {
      const qualityMetrics = await this.getSystemQualityMetrics();
      const bandwidthReport = await this.getBandwidthValidationReport();

      client.emit('admin:quality-metrics-response', {
        qualityMetrics,
        bandwidthReport,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to fetch quality metrics for admin ${adminClient.adminId}:`, error);
      client.emit('admin:quality-metrics-error', {
        message: 'Failed to fetch quality metrics',
        timestamp: new Date(),
      });
    }
  }

  // Real-time update methods
  async broadcastDashboardUpdate(data: any) {
    try {
      // Calculate delta using the helper method
      const deltaResult = await this.calculateDashboardDeltas(data);

      // Emit with delta information
      this.server.to('dashboard:global').emit('dashboard_update', {
        data: deltaResult.data,
        isDelta: deltaResult.isDelta,
        bandwidthSavings: deltaResult.isDelta ?
          ((deltaResult.fullSize - deltaResult.deltaSize) / deltaResult.fullSize * 100).toFixed(2) + '%' :
          '0%',
        fullSize: deltaResult.fullSize,
        deltaSize: deltaResult.deltaSize,
        timestamp: new Date(),
      });

      this.logger.debug(`Dashboard update broadcasted: ${deltaResult.isDelta ? 'delta' : 'full'} data (${deltaResult.deltaSize}/${deltaResult.fullSize} bytes)`);

    } catch (error) {
      this.logger.error('Failed to broadcast dashboard update with delta:', error);

      // Fallback to original behavior without delta calculation
      this.server.to('dashboard:global').emit('dashboard_update', {
        data,
        isDelta: false,
        bandwidthSavings: '0%',
        timestamp: new Date(),
      });
    }
  }

  async broadcastDepartmentUpdate(department: string, data: any) {
    try {
      // Calculate delta using the helper method
      const deltaResult = await this.calculateDepartmentDeltas(department, data);

      // Emit with delta information
      this.server.to(`department:${department}`).emit('department_update', {
        department,
        data: deltaResult.data,
        isDelta: deltaResult.isDelta,
        bandwidthSavings: deltaResult.isDelta ?
          ((deltaResult.fullSize - deltaResult.deltaSize) / deltaResult.fullSize * 100).toFixed(2) + '%' :
          '0%',
        fullSize: deltaResult.fullSize,
        deltaSize: deltaResult.deltaSize,
        timestamp: new Date(),
      });

      this.logger.debug(`Department ${department} update broadcasted: ${deltaResult.isDelta ? 'delta' : 'full'} data (${deltaResult.deltaSize}/${deltaResult.fullSize} bytes)`);

    } catch (error) {
      this.logger.error(`Failed to broadcast department update for ${department} with delta:`, error);

      // Fallback to original behavior without delta calculation
      this.server.to(`department:${department}`).emit('department_update', {
        department,
        data,
        isDelta: false,
        bandwidthSavings: '0%',
        timestamp: new Date(),
      });
    }
  }

  async broadcastAlert(alert: any) {
    this.server.emit('alert', {
      ...alert,
      timestamp: new Date(),
    });

    // Also send to specific departments if relevant
    if (alert.department) {
      this.server.to(`department:${alert.department}`).emit('alert', alert);

      // Invalidate department cache on critical alerts
      if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
        await this.invalidateDepartmentCache(alert.department);
      }
    }

    // Invalidate dashboard cache on critical alerts
    if (alert.severity === 'CRITICAL') {
      await this.invalidateDashboardCache();
      // Send critical alerts to all connected admins
      this.server.emit('critical_alert', alert);
    }
  }

  async broadcastUserActivity(activity: any) {
    this.server.to('department:UserOps').emit('user_activity', {
      ...activity,
      timestamp: new Date(),
    });
  }

  async broadcastBrokerActivity(activity: any) {
    this.server.to('department:BrokerOps').emit('broker_activity', {
      ...activity,
      timestamp: new Date(),
    });
  }

  async broadcastTrendUpdate(trend: any) {
    this.server.to('department:TrendOps').emit('trend_update', {
      ...trend,
      timestamp: new Date(),
    });
  }

  async broadcastRiskAlert(alert: any) {
    this.server.to('department:RiskOps').emit('risk_alert', {
      ...alert,
      timestamp: new Date(),
    });
  }

  async broadcastSystemStatus(status: any) {
    this.server.to('department:TechOps').emit('system_status', {
      ...status,
      timestamp: new Date(),
    });

    // Invalidate TechOps cache on significant system status changes
    if (status.severity === 'CRITICAL' || status.status === 'DOWN' || status.status === 'DEGRADED') {
      await this.invalidateDepartmentCache('TechOps');
    }

    // Invalidate dashboard cache for major system issues
    if (status.severity === 'CRITICAL' || status.status === 'DOWN') {
      await this.invalidateDashboardCache();
    }
  }

  async broadcastFinanceUpdate(update: any) {
    this.server.to('department:FinanceOps').emit('finance_update', {
      ...update,
      timestamp: new Date(),
    });
  }

  async sendDirectMessage(adminId: string, event: string, data: any) {
    this.server.to(`admin:${adminId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  async broadcastQualityMetrics() {
    try {
      const qualityMetrics = await this.getSystemQualityMetrics();
      const bandwidthReport = await this.getBandwidthValidationReport();

      this.server.to('dashboard:global').emit('admin:quality-metrics-update', {
        qualityMetrics,
        bandwidthReport,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to broadcast quality metrics:', error);
    }
  }

  // Delta calculation methods
  private async calculateDashboardDeltas(newData: any): Promise<{ data: any; isDelta: boolean; fullSize: number; deltaSize: number }> {
    const cacheKey = `${this.DASHBOARD_CACHE_PREFIX}global`;
    const startTime = Date.now();

    try {
      // Get cached data with proper await
      const cachedDataStr = await this.redis.get(cacheKey);
      let cachedData: any = null;

      // Parse cached data safely with error handling
      if (cachedDataStr) {
        try {
          cachedData = JSON.parse(cachedDataStr);
        } catch (parseError) {
          this.logger.warn(`Failed to parse cached dashboard data: ${parseError.message}`);
          cachedData = null;
        }
      }

      // If no cached data, return full data
      if (!cachedData) {
        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(newData));

        const dataSize = JSON.stringify(newData).length;
        this.logger.debug(`No cached dashboard data found, sending full data (${dataSize} bytes)`);

        return {
          data: newData,
          isDelta: false,
          fullSize: dataSize,
          deltaSize: dataSize
        };
      }

      // Calculate delta using differential sync service
      try {
        const syncRequest = {
          clientId: 'admin-dashboard-global',
          entityType: 'dashboard',
          lastKnownVectorClock: cachedData.vectorClock || { versions: new Map(), timestamp: 0 }
        };

        const deltas = await this.differentialSync.calculateStateDelta(syncRequest);

        // If no deltas, send minimal update
        if (deltas.length === 0) {
          const timestampUpdate = { timestamp: newData.timestamp, metrics: newData.metrics };
          const deltaSize = JSON.stringify(timestampUpdate).length;
          const fullSize = JSON.stringify(newData).length;

          return {
            data: { type: 'timestamp_update', data: timestampUpdate },
            isDelta: true,
            fullSize,
            deltaSize
          };
        }

        // Create delta payload
        const deltaPayload = {
          type: 'delta',
          deltas: deltas,
          timestamp: newData.timestamp,
          vectorClock: newData.vectorClock
        };

        const deltaSize = JSON.stringify(deltaPayload).length;
        const fullSize = JSON.stringify(newData).length;
        const bandwidthReduction = ((fullSize - deltaSize) / fullSize) * 100;

        // Update cache with new data
        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(newData));

        // Record bandwidth metrics
        await this.differentialSync.recordBandwidthMetrics('admin-dashboard-global', fullSize, deltaSize);

        this.logger.debug(`Dashboard delta calculated: ${bandwidthReduction.toFixed(2)}% reduction (${deltaSize}/${fullSize} bytes)`);

        return {
          data: deltaPayload,
          isDelta: true,
          fullSize,
          deltaSize
        };

      } catch (syncError) {
        this.logger.error(`Failed to calculate dashboard delta: ${syncError.message}`);

        // Fallback to full data
        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(newData));
        const dataSize = JSON.stringify(newData).length;

        return {
          data: newData,
          isDelta: false,
          fullSize: dataSize,
          deltaSize: dataSize
        };
      }

    } catch (error) {
      this.logger.error(`Critical error in calculateDashboardDeltas: ${error.message}`);

      // Ultimate fallback - send data without caching
      const dataSize = JSON.stringify(newData).length;
      return {
        data: newData,
        isDelta: false,
        fullSize: dataSize,
        deltaSize: dataSize
      };
    } finally {
      const duration = Date.now() - startTime;
      this.logger.debug(`Dashboard delta calculation completed in ${duration}ms`);
    }
  }

  private async calculateDepartmentDeltas(department: string, newData: any): Promise<{ data: any; isDelta: boolean; fullSize: number; deltaSize: number }> {
    const cacheKey = `${this.DEPARTMENT_CACHE_PREFIX}${department}`;
    const startTime = Date.now();

    try {
      // Get cached data with proper await
      const cachedDataStr = await this.redis.get(cacheKey);
      let cachedData: any = null;

      // Parse cached data safely with error handling
      if (cachedDataStr) {
        try {
          cachedData = JSON.parse(cachedDataStr);
        } catch (parseError) {
          this.logger.warn(`Failed to parse cached department data for ${department}: ${parseError.message}`);
          cachedData = null;
        }
      }

      // If no cached data, return full data
      if (!cachedData) {
        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(newData));

        const dataSize = JSON.stringify(newData).length;
        this.logger.debug(`No cached department data found for ${department}, sending full data (${dataSize} bytes)`);

        return {
          data: newData,
          isDelta: false,
          fullSize: dataSize,
          deltaSize: dataSize
        };
      }

      // Calculate delta using differential sync service
      try {
        const syncRequest = {
          clientId: `admin-department-${department}`,
          entityType: `department-${department}`,
          lastKnownVectorClock: cachedData.vectorClock || { versions: new Map(), timestamp: 0 }
        };

        const deltas = await this.differentialSync.calculateStateDelta(syncRequest);

        // If no deltas, send minimal update
        if (deltas.length === 0) {
          const timestampUpdate = { timestamp: newData.timestamp, department };
          const deltaSize = JSON.stringify(timestampUpdate).length;
          const fullSize = JSON.stringify(newData).length;

          return {
            data: { type: 'timestamp_update', data: timestampUpdate },
            isDelta: true,
            fullSize,
            deltaSize
          };
        }

        // Create delta payload
        const deltaPayload = {
          type: 'delta',
          deltas: deltas,
          department,
          timestamp: newData.timestamp,
          vectorClock: newData.vectorClock
        };

        const deltaSize = JSON.stringify(deltaPayload).length;
        const fullSize = JSON.stringify(newData).length;
        const bandwidthReduction = ((fullSize - deltaSize) / fullSize) * 100;

        // Update cache with new data
        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(newData));

        // Record bandwidth metrics
        await this.differentialSync.recordBandwidthMetrics(`admin-department-${department}`, fullSize, deltaSize);

        this.logger.debug(`Department ${department} delta calculated: ${bandwidthReduction.toFixed(2)}% reduction (${deltaSize}/${fullSize} bytes)`);

        return {
          data: deltaPayload,
          isDelta: true,
          fullSize,
          deltaSize
        };

      } catch (syncError) {
        this.logger.error(`Failed to calculate department delta for ${department}: ${syncError.message}`);

        // Fallback to full data
        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(newData));
        const dataSize = JSON.stringify(newData).length;

        return {
          data: newData,
          isDelta: false,
          fullSize: dataSize,
          deltaSize: dataSize
        };
      }

    } catch (error) {
      this.logger.error(`Critical error in calculateDepartmentDeltas for ${department}: ${error.message}`);

      // Ultimate fallback - send data without caching
      const dataSize = JSON.stringify(newData).length;
      return {
        data: newData,
        isDelta: false,
        fullSize: dataSize,
        deltaSize: dataSize
      };
    } finally {
      const duration = Date.now() - startTime;
      this.logger.debug(`Department ${department} delta calculation completed in ${duration}ms`);
    }
  }

  // Cache management methods
  private async invalidateCache(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate cache pattern ${pattern}: ${error.message}`);
    }
  }

  private async invalidateDepartmentCache(department: string): Promise<void> {
    await this.invalidateCache(`${this.DEPARTMENT_CACHE_PREFIX}${department}*`);
  }

  private async invalidateDashboardCache(): Promise<void> {
    await this.invalidateCache(`${this.DASHBOARD_CACHE_PREFIX}*`);
  }

  // Private methods
  private async sendDashboardUpdate(client: Socket, timeframe?: string) {
    try {
      // This would fetch real dashboard data
      const mockDashboardData = {
        overview: {
          totalUsers: 15420,
          activeUsers: 892,
          totalBrokers: 45,
          activeBrokers: 38,
          marketVolume: 2847560.50,
          oracleHealth: 98.5,
          nodeUptime: 99.9,
          paymentRevenue: 42765.25,
          systemAlerts: 3,
          abuseDetections: 12,
          riskScore: 75.5,
        },
        departments: {
          userOps: { pendingTasks: 23, criticalIssues: 2 },
          brokerOps: { pendingApplications: 5, complianceIssues: 1 },
          trendOps: { activeTrends: 156, pendingReviews: 8 },
          riskOps: { highRiskAlerts: 3, contentReviews: 14 },
          financeOps: { pendingPayouts: 7, revenueMetrics: { daily: 42765.25 } },
          techOps: { systemHealth: 95.2, activeNodes: 12 },
        },
        timestamp: new Date(),
      };

      client.emit('dashboard_data', {
        timeframe: timeframe || '24h',
        data: mockDashboardData,
      });

    } catch (error) {
      this.logger.error(`Failed to send dashboard update to ${client.id}:`, error);
      client.emit('error', { message: 'Failed to fetch dashboard data' });
    }
  }

  private broadcastConnectedCount() {
    this.server.emit('connected_admins', {
      count: this.connectedClients.size,
      timestamp: new Date(),
    });
  }

  private startPeriodicUpdates() {
    // Send dashboard updates every 30 seconds
    setInterval(async () => {
      if (this.connectedClients.size > 0) {
        const mockUpdate = {
          timestamp: new Date(),
          metrics: {
            activeUsers: Math.floor(Math.random() * 1000) + 800,
            marketVolume: Math.floor(Math.random() * 100000) + 2800000,
            systemAlerts: Math.floor(Math.random() * 5),
          },
        };

        await this.broadcastDashboardUpdate(mockUpdate);
      }
    }, 30000);

    // Send quality metrics updates every 60 seconds
    setInterval(async () => {
      if (this.connectedClients.size > 0) {
        await this.broadcastQualityMetrics();
      }
    }, 60000);

    // Update connected count every 10 seconds
    setInterval(() => {
      this.broadcastConnectedCount();
    }, 10000);

    // Clean up inactive connections every 5 minutes
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 300000);
  }

  private cleanupInactiveConnections() {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [clientId, client] of this.connectedClients) {
      if (now.getTime() - client.lastActivity.getTime() > inactiveThreshold) {
        this.logger.log(`Cleaning up inactive connection: ${clientId}`);
        client.socket.disconnect(true);
        this.connectedClients.delete(clientId);
      }
    }

    this.broadcastConnectedCount();
  }

  // Public utility methods
  getConnectedClients(): number {
    return this.connectedClients.size;
  }

  getRoomSubscriptions(room: string): number {
    return this.roomSubscriptions.get(room)?.size || 0;
  }

  getClientInfo(clientId: string): AdminClient | undefined {
    return this.connectedClients.get(clientId);
  }

  // Public cache management methods
  async invalidateAllCaches(): Promise<void> {
    try {
      await Promise.all([
        this.invalidateDashboardCache(),
        this.invalidateCache(`${this.DEPARTMENT_CACHE_PREFIX}*`)
      ]);

      this.logger.log('All admin caches invalidated successfully');
    } catch (error) {
      this.logger.error('Failed to invalidate all admin caches:', error);
    }
  }

  async getCacheStats(): Promise<{ dashboard: number; departments: number; total: number }> {
    try {
      const dashboardKeys = await this.redis.keys(`${this.DASHBOARD_CACHE_PREFIX}*`);
      const departmentKeys = await this.redis.keys(`${this.DEPARTMENT_CACHE_PREFIX}*`);

      return {
        dashboard: dashboardKeys.length,
        departments: departmentKeys.length,
        total: dashboardKeys.length + departmentKeys.length
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return { dashboard: 0, departments: 0, total: 0 };
    }
  }

  // Quality Metrics Methods
  async getSystemQualityMetrics(): Promise<SystemQualityMetrics> {
    try {
      const systemHealth = await this.connectionQualityMonitor.getSystemHealthMetrics();
      const allClientMetrics = await this.connectionQualityMonitor.getAllClientMetrics();
      const sub100msLatencyPercentage = await this.connectionQualityMonitor.getSub100msLatencyPercentage();

      // Get real bandwidth validation data
      const bandwidthResults = await this.differentialSync.getAllBandwidthValidationResults();
      const actualBandwidthReduction = bandwidthResults.length > 0
        ? bandwidthResults.reduce((sum, result) => sum + result.actualReduction, 0) / bandwidthResults.length
        : 0;

      // Calculate real quality distribution from client metrics
      const qualityDistribution = {
        excellent: allClientMetrics.filter(m => m.qualityScore >= 90).length,
        good: allClientMetrics.filter(m => m.qualityScore >= 70 && m.qualityScore < 90).length,
        fair: allClientMetrics.filter(m => m.qualityScore >= 50 && m.qualityScore < 70).length,
        poor: allClientMetrics.filter(m => m.qualityScore < 50).length,
      };

      // Calculate real system averages from client metrics
      const systemAverages = allClientMetrics.length > 0 ? {
        latency: allClientMetrics.reduce((sum, m) => sum + m.avgLatency, 0) / allClientMetrics.length,
        packetLoss: allClientMetrics.reduce((sum, m) => sum + m.packetLoss, 0) / allClientMetrics.length,
        jitter: allClientMetrics.reduce((sum, m) => sum + m.jitter, 0) / allClientMetrics.length,
        stability: allClientMetrics.reduce((sum, m) => sum + m.connectionStability, 0) / allClientMetrics.length,
      } : { latency: 0, packetLoss: 0, jitter: 0, stability: 0 };

      return {
        totalConnections: systemHealth.totalConnections,
        averageQualityScore: systemHealth.averageQualityScore,
        sub100msLatencyPercentage,
        bandwidth87ReductionPercentage: parseFloat(actualBandwidthReduction.toFixed(2)),
        connectionsInFallback: systemHealth.connectionsInFallback,
        qualityDistribution,
        systemAverages,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get system quality metrics:', error);
      return {
        totalConnections: 0,
        averageQualityScore: 0,
        sub100msLatencyPercentage: 0,
        bandwidth87ReductionPercentage: 0,
        connectionsInFallback: 0,
        qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
        systemAverages: { latency: 0, packetLoss: 0, jitter: 0, stability: 0 },
        timestamp: new Date(),
      };
    }
  }

  async getBandwidthValidationReport(): Promise<BandwidthValidationReport> {
    try {
      const targetReduction = 87; // 87% target reduction

      // Get real bandwidth validation results
      const bandwidthResults = await this.differentialSync.getAllBandwidthValidationResults();

      const totalClients = bandwidthResults.length;

      if (totalClients === 0) {
        return {
          totalClients: 0,
          averageReduction: 0,
          targetReduction,
          meetingTarget: 0,
          belowTarget: 0,
          clientsBelowTarget: [],
          timestamp: new Date(),
        };
      }

      // Calculate real average reduction
      const totalReduction = bandwidthResults.reduce((sum, result) => sum + result.actualReduction, 0);
      const averageReduction = totalReduction / totalClients;

      // Separate clients meeting target vs below target
      const meetingTarget = bandwidthResults.filter(result => result.actualReduction >= targetReduction).length;
      const belowTarget = totalClients - meetingTarget;

      // Get detailed info for clients below target
      const clientsBelowTarget = bandwidthResults
        .filter(result => result.actualReduction < targetReduction)
        .map(result => ({
          clientId: result.clientId,
          actualReduction: result.actualReduction,
          targetReduction,
          fullSize: result.fullSize,
          deltaSize: result.deltaSize,
        }));

      return {
        totalClients,
        averageReduction: parseFloat(averageReduction.toFixed(2)),
        targetReduction,
        meetingTarget,
        belowTarget,
        clientsBelowTarget,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get bandwidth validation report:', error);
      return {
        totalClients: 0,
        averageReduction: 0,
        targetReduction: 87,
        meetingTarget: 0,
        belowTarget: 0,
        clientsBelowTarget: [],
        timestamp: new Date(),
      };
    }
  }

  }