import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OracleCoordinatorService } from '../../oracle/services/oracle-coordinator.service';
import { AdminWebSocketService } from './admin-websocket.service';
import { randomBytes } from 'crypto';

@Injectable()
export class OracleManagementService {
  private readonly logger = new Logger(OracleManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oracleCoordinatorService: OracleCoordinatorService,
    private readonly adminWebSocketService: AdminWebSocketService,
  ) {}

  async getNodes(filters: {
    page: number;
    limit: number;
    status?: string;
    region?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.region) {
      where.region = filters.region;
    }

    if (filters.search) {
      where.OR = [
        { nodeId: { contains: filters.search, mode: 'insensitive' } },
        { endpoint: { contains: filters.search, mode: 'insensitive' } },
        { region: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [nodes, total] = await this.prisma.$transaction([
      this.prisma.validatorNode.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              oracleResponses: true,
              oracleRequests: true,
            },
          },
        },
      }),
      this.prisma.validatorNode.count({ where }),
    ]);

    // Get performance metrics for each node
    const nodesWithMetrics = await Promise.all(
      nodes.map(async (node) => {
        const recentPerformance = await this.getNodeRecentPerformance(node.id);
        return {
          ...node,
          performance: recentPerformance,
          totalRequests: node._count.oracleRequests,
          totalResponses: node._count.oracleResponses,
        };
      })
    );

    return {
      nodes: nodesWithMetrics.map(node => ({
        id: node.id,
        nodeId: node.nodeId,
        endpoint: node.endpoint,
        region: node.region,
        status: node.status,
        reputation: node.reputation,
        uptimePercentage: node.uptimePercentage,
        lastSeen: node.lastSeen,
        publicKey: node.publicKey,
        version: node.version,
        performance: node.performance,
        totalRequests: node.totalRequests,
        totalResponses: node.totalResponses,
        responseRate: node.totalRequests > 0 ? (node.totalResponses / node.totalRequests) * 100 : 0,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }

  async getNodeById(id: string) {
    const node = await this.prisma.validatorNode.findUnique({
      where: { id },
      include: {
        oracleResponses: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            oracleRequest: {
              select: {
                id: true,
                topicId: true,
                dataType: true,
                requestedAt: true,
              },
            },
          },
        },
        _count: {
          select: {
            oracleResponses: true,
            oracleRequests: true,
          },
        },
      },
    });

    if (!node) {
      throw new NotFoundException('Oracle node not found');
    }

    // Get detailed performance metrics
    const performanceMetrics = await this.getNodePerformanceMetrics(id);
    const recentActivity = await this.getNodeRecentActivity(id);

    return {
      id: node.id,
      nodeId: node.nodeId,
      endpoint: node.endpoint,
      region: node.region,
      status: node.status,
      reputation: node.reputation,
      uptimePercentage: node.uptimePercentage,
      lastSeen: node.lastSeen,
      publicKey: node.publicKey,
      version: node.version,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      performance: performanceMetrics,
      recentActivity,
      responses: node.oracleResponses.map(response => ({
        id: response.id,
        request: response.oracleRequest,
        responseData: response.responseData,
        responseTime: response.responseTime,
        consensusLevel: response.consensusLevel,
        isValid: response.isValid,
        createdAt: response.createdAt,
      })),
      stats: {
        totalRequests: node._count.oracleRequests,
        totalResponses: node._count.oracleResponses,
        responseRate: node._count.oracleRequests > 0 ?
          (node._count.oracleResponses / node._count.oracleRequests) * 100 : 0,
      },
    };
  }

  async addNode(nodeData: any, adminId: string) {
    // Validate node data
    const existingNode = await this.prisma.validatorNode.findFirst({
      where: {
        OR: [
          { nodeId: nodeData.nodeId },
          { endpoint: nodeData.endpoint },
        ],
      },
    });

    if (existingNode) {
      throw new BadRequestException('Node ID or endpoint already exists');
    }

    // Generate cryptographic key pair
    const keyPair = this.generateKeyPair();

    // Create the node
    const node = await this.prisma.validatorNode.create({
      data: {
        nodeId: nodeData.nodeId,
        endpoint: nodeData.endpoint,
        region: nodeData.region || 'GLOBAL',
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        status: 'OFFLINE',
        reputation: 100,
        uptimePercentage: 0,
        version: nodeData.version || '1.0.0',
        metadata: {
          addedBy: adminId,
          addedAt: new Date().toISOString(),
        },
      },
    });

    // Update consensus threshold if this changes the network
    await this.updateConsensusThresholdForNewNode();

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('oracle:node:added', {
      node: {
        id: node.id,
        nodeId: node.nodeId,
        endpoint: node.endpoint,
        region: node.region,
      },
      addedBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Oracle node added by admin ${adminId}: ${node.nodeId}`);

    return node;
  }

  async removeNode(id: string, adminId: string) {
    const node = await this.prisma.validatorNode.findUnique({
      where: { id },
    });

    if (!node) {
      throw new NotFoundException('Oracle node not found');
    }

    // Check if removing this node would compromise consensus
    const totalNodes = await this.prisma.validatorNode.count();
    const activeNodes = await this.prisma.validatorNode.count({
      where: { status: 'ONLINE' },
    });

    if (activeNodes <= 2) {
      throw new BadRequestException('Cannot remove node: insufficient nodes for consensus');
    }

    // Mark node as decommissioned instead of deleting
    const updatedNode = await this.prisma.validatorNode.update({
      where: { id },
      data: {
        status: 'DECOMMISSIONED',
        metadata: {
          ...node.metadata,
          removedBy: adminId,
          removedAt: new Date().toISOString(),
        },
      },
    });

    // Redistribute load if needed
    await this.redistributeNodeLoad(id);

    // Update consensus threshold
    await this.updateConsensusThresholdForRemovedNode();

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('oracle:node:removed', {
      nodeId: node.nodeId,
      removedBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Oracle node removed by admin ${adminId}: ${node.nodeId}`);

    return updatedNode;
  }

  async restartNode(id: string, adminId: string) {
    const node = await this.prisma.validatorNode.findUnique({
      where: { id },
    });

    if (!node) {
      throw new NotFoundException('Oracle node not found');
    }

    // Send restart command to node
    try {
      await this.oracleCoordinatorService.restartNode(node.nodeId);
    } catch (error) {
      this.logger.error(`Failed to restart node ${node.nodeId}:`, error);
      throw new BadRequestException('Failed to restart node');
    }

    // Update node status
    const updatedNode = await this.prisma.validatorNode.update({
      where: { id },
      data: {
        status: 'RESTARTING',
        lastSeen: new Date(),
        metadata: {
          ...node.metadata,
          restartedBy: adminId,
          restartedAt: new Date().toISOString(),
        },
      },
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('oracle:node:restarted', {
      nodeId: node.nodeId,
      restartedBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Oracle node restarted by admin ${adminId}: ${node.nodeId}`);

    return updatedNode;
  }

  async disableNode(id: string, reason: string, adminId: string) {
    const node = await this.prisma.validatorNode.findUnique({
      where: { id },
    });

    if (!node) {
      throw new NotFoundException('Oracle node not found');
    }

    // Update node status
    const updatedNode = await this.prisma.validatorNode.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        metadata: {
          ...node.metadata,
          disabledBy: adminId,
          disabledAt: new Date().toISOString(),
          disableReason: reason,
        },
      },
    });

    // Redistribute load
    await this.redistributeNodeLoad(id);

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('oracle:node:disabled', {
      nodeId: node.nodeId,
      reason,
      disabledBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Oracle node disabled by admin ${adminId}: ${node.nodeId} - ${reason}`);

    return updatedNode;
  }

  async enableNode(id: string, adminId: string) {
    const node = await this.prisma.validatorNode.findUnique({
      where: { id },
    });

    if (!node) {
      throw new NotFoundException('Oracle node not found');
    }

    // Update node status
    const updatedNode = await this.prisma.validatorNode.update({
      where: { id },
      data: {
        status: 'ONLINE',
        metadata: {
          ...node.metadata,
          enabledBy: adminId,
          enabledAt: new Date().toISOString(),
        },
      },
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('oracle:node:enabled', {
      nodeId: node.nodeId,
      enabledBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Oracle node enabled by admin ${adminId}: ${node.nodeId}`);

    return updatedNode;
  }

  async rotateNodeKeys(id: string, adminId: string) {
    const node = await this.prisma.validatorNode.findUnique({
      where: { id },
    });

    if (!node) {
      throw new NotFoundException('Oracle node not found');
    }

    // Generate new key pair
    const newKeyPair = this.generateKeyPair();

    // Update node keys
    const updatedNode = await this.prisma.validatorNode.update({
      where: { id },
      data: {
        publicKey: newKeyPair.publicKey,
        privateKey: newKeyPair.privateKey,
        metadata: {
          ...node.metadata,
          keysRotatedBy: adminId,
          keysRotatedAt: new Date().toISOString(),
          previousPublicKey: node.publicKey,
        },
      },
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('oracle:node:keys:rotated', {
      nodeId: node.nodeId,
      rotatedBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Oracle node keys rotated by admin ${adminId}: ${node.nodeId}`);

    return updatedNode;
  }

  async getRequests(filters: {
    page: number;
    limit: number;
    status?: string;
    dataType?: string;
    trendId?: string;
  }) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.dataType) {
      where.dataType = filters.dataType;
    }

    if (filters.trendId) {
      where.topicId = filters.trendId;
    }

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.oracleRequest.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { requestedAt: 'desc' },
        include: {
          topic: {
            select: {
              id: true,
              symbol: true,
              title: true,
            },
          },
          oracleResponses: {
            select: {
              id: true,
              nodeId: true,
              responseTime: true,
              isValid: true,
              consensusLevel: true,
            },
          },
          _count: {
            select: {
              oracleResponses: true,
            },
          },
        },
      }),
      this.prisma.oracleRequest.count({ where }),
    ]);

    return {
      requests: requests.map(request => ({
        id: request.id,
        topic: request.topic,
        dataType: request.dataType,
        status: request.status,
        consensusLevel: request.consensusLevel,
        requestedAt: request.requestedAt,
        completedAt: request.completedAt,
        processingTime: request.processingTime,
        totalResponses: request._count.oracleResponses,
        validResponses: request.oracleResponses.filter(r => r.isValid).length,
        averageResponseTime: request.oracleResponses.length > 0 ?
          request.oracleResponses.reduce((sum, r) => sum + r.responseTime, 0) / request.oracleResponses.length : 0,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }

  async getRequestById(id: string) {
    const request = await this.prisma.oracleRequest.findUnique({
      where: { id },
      include: {
        topic: {
          select: {
            id: true,
            symbol: true,
            title: true,
            category: true,
          },
        },
        oracleResponses: {
          include: {
            validatorNode: {
              select: {
                id: true,
                nodeId: true,
                region: true,
                reputation: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Oracle request not found');
    }

    return {
      id: request.id,
      topic: request.topic,
      dataType: request.dataType,
      parameters: request.parameters,
      status: request.status,
      consensusLevel: request.consensusLevel,
      finalResult: request.finalResult,
      requestedAt: request.requestedAt,
      completedAt: request.completedAt,
      processingTime: request.processingTime,
      responses: request.oracleResponses.map(response => ({
        id: response.id,
        node: response.validatorNode,
        responseData: response.responseData,
        responseTime: response.responseTime,
        isValid: response.isValid,
        consensusLevel: response.consensusLevel,
        createdAt: response.createdAt,
      })),
      stats: {
        totalResponses: request.oracleResponses.length,
        validResponses: request.oracleResponses.filter(r => r.isValid).length,
        averageResponseTime: request.oracleResponses.length > 0 ?
          request.oracleResponses.reduce((sum, r) => sum + r.responseTime, 0) / request.oracleResponses.length : 0,
      },
    };
  }

  async getConsensusHealth() {
    const [totalNodes, activeNodes, recentRequests, averageConsensus] = await Promise.all([
      this.prisma.validatorNode.count(),
      this.prisma.validatorNode.count({ where: { status: 'ONLINE' } }),
      this.prisma.oracleRequest.count({
        where: {
          requestedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
      this.getAverageConsensusLevel(),
    ]);

    const healthScore = Math.round(
      (activeNodes / Math.max(1, totalNodes)) * 40 + // 40% weight for node availability
      (Math.min(100, averageConsensus) / 100) * 60 // 60% weight for consensus quality
    );

    return {
      healthScore,
      status: healthScore >= 80 ? 'HEALTHY' : healthScore >= 60 ? 'WARNING' : 'CRITICAL',
      metrics: {
        totalNodes,
        activeNodes,
        nodeAvailability: totalNodes > 0 ? (activeNodes / totalNodes) * 100 : 0,
        recentRequests,
        averageConsensus: Math.round(averageConsensus),
        consensusThreshold: 67, // Default threshold
      },
    };
  }

  async getConsensusHistory(timeframe: string, page: number, limit: number) {
    const startDate = new Date();
    const timeframes = {
      '1h': 1,
      '24h': 24,
      '7d': 7 * 24,
      '30d': 30 * 24,
    };
    const hours = timeframes[timeframe] || 24;
    startDate.setHours(startDate.getHours() - hours);

    const [history, total] = await this.prisma.$transaction([
      this.prisma.oracleRequest.findMany({
        where: {
          requestedAt: { gte: startDate },
          status: 'COMPLETED',
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { requestedAt: 'desc' },
        select: {
          id: true,
          consensusLevel: true,
          processingTime: true,
          requestedAt: true,
          topic: {
            select: {
              symbol: true,
              title: true,
            },
          },
          _count: {
            select: {
              oracleResponses: true,
            },
          },
        },
      }),
      this.prisma.oracleRequest.count({
        where: {
          requestedAt: { gte: startDate },
          status: 'COMPLETED',
        },
      }),
    ]);

    return {
      history: history.map(entry => ({
        id: entry.id,
        topic: entry.topic,
        consensusLevel: entry.consensusLevel,
        processingTime: entry.processingTime,
        responseCount: entry._count.oracleResponses,
        timestamp: entry.requestedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      timeframe,
    };
  }

  async getOracleLogs(filters: {
    page: number;
    limit: number;
    level?: string;
    nodeId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (filters.level) {
      where.level = filters.level;
    }

    if (filters.nodeId) {
      where.nodeId = filters.nodeId;
    }

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.oracleLog.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { timestamp: 'desc' },
        include: {
          validatorNode: {
            select: {
              nodeId: true,
              region: true,
            },
          },
        },
      }),
      this.prisma.oracleLog.count({ where }),
    ]);

    return {
      logs: logs.map(log => ({
        id: log.id,
        level: log.level,
        message: log.message,
        nodeId: log.nodeId,
        node: log.validatorNode,
        metadata: log.metadata,
        timestamp: log.timestamp,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }

  async getPerformanceMetrics(timeframe: string = '24h') {
    const startDate = new Date();
    const timeframes = {
      '1h': 1,
      '24h': 24,
      '7d': 7 * 24,
      '30d': 30 * 24,
    };
    const hours = timeframes[timeframe] || 24;
    startDate.setHours(startDate.getHours() - hours);

    const [totalRequests, successfulRequests, averageResponseTime, consensusMetrics] = await Promise.all([
      this.prisma.oracleRequest.count({
        where: {
          requestedAt: { gte: startDate },
        },
      }),
      this.prisma.oracleRequest.count({
        where: {
          requestedAt: { gte: startDate },
          status: 'COMPLETED',
        },
      }),
      this.getAverageResponseTime(startDate),
      this.getConsensusTimeSeries(startDate),
    ]);

    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    return {
      timeframe,
      overview: {
        totalRequests,
        successfulRequests,
        failedRequests: totalRequests - successfulRequests,
        successRate,
        averageResponseTime,
      },
      consensus: consensusMetrics,
    };
  }

  async getSystemHealth() {
    const consensusHealth = await this.getConsensusHealth();
    const performanceMetrics = await this.getPerformanceMetrics('1h');

    const healthScore = Math.round(
      (consensusHealth.healthScore * 0.6) + (performanceMetrics.overview.successRate * 0.4)
    );

    return {
      healthScore,
      status: healthScore >= 80 ? 'HEALTHY' : healthScore >= 60 ? 'WARNING' : 'CRITICAL',
      consensus: consensusHealth,
      performance: performanceMetrics,
      timestamp: new Date().toISOString(),
    };
  }

  async updateConsensusThreshold(threshold: number, adminId: string) {
    if (threshold < 50 || threshold > 100) {
      throw new BadRequestException('Threshold must be between 50 and 100');
    }

    // Store threshold in platform settings
    await this.prisma.platformSetting.upsert({
      where: { key: 'ORACLE_CONSENSUS_THRESHOLD' },
      update: {
        value: String(threshold),
        updatedBy: adminId,
      },
      create: {
        key: 'ORACLE_CONSENSUS_THRESHOLD',
        value: String(threshold),
        category: 'oracle',
        type: 'number',
        description: 'Oracle consensus threshold percentage',
        updatedBy: adminId,
      },
    });

    // Notify Oracle Coordinator of the change
    await this.oracleCoordinatorService.updateConsensusThreshold(threshold);

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('oracle:consensus:threshold:updated', {
      threshold,
      updatedBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Oracle consensus threshold updated by admin ${adminId}: ${threshold}%`);

    return { threshold };
  }

  async retryRequest(id: string, adminId: string) {
    const request = await this.prisma.oracleRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Oracle request not found');
    }

    if (request.status !== 'FAILED') {
      throw new BadRequestException('Can only retry failed requests');
    }

    // Reset request status and resubmit
    const updatedRequest = await this.prisma.oracleRequest.update({
      where: { id },
      data: {
        status: 'PENDING',
        consensusLevel: null,
        finalResult: null,
        completedAt: null,
        processingTime: null,
        metadata: {
          ...request.metadata,
          retriedBy: adminId,
          retriedAt: new Date().toISOString(),
        },
      },
    });

    // Resubmit to Oracle Coordinator
    await this.oracleCoordinatorService.submitRequest(request.id);

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('oracle:request:retried', {
      requestId: id,
      retriedBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Oracle request retried by admin ${adminId}: ${id}`);

    return updatedRequest;
  }

  async setMaintenanceMode(enabled: boolean, message?: string, adminId?: string) {
    // Update platform setting
    await this.prisma.platformSetting.upsert({
      where: { key: 'ORACLE_MAINTENANCE_MODE' },
      update: {
        value: String(enabled),
        updatedBy: adminId || 'system',
      },
      create: {
        key: 'ORACLE_MAINTENANCE_MODE',
        value: String(enabled),
        category: 'oracle',
        type: 'boolean',
        description: 'Oracle maintenance mode status',
        updatedBy: adminId || 'system',
      },
    });

    if (message) {
      await this.prisma.platformSetting.upsert({
        where: { key: 'ORACLE_MAINTENANCE_MESSAGE' },
        update: {
          value: message,
          updatedBy: adminId || 'system',
        },
        create: {
          key: 'ORACLE_MAINTENANCE_MESSAGE',
          value: message,
          category: 'oracle',
          type: 'string',
          description: 'Oracle maintenance mode message',
          updatedBy: adminId || 'system',
        },
      });
    }

    // Notify Oracle Coordinator
    await this.oracleCoordinatorService.setMaintenanceMode(enabled, message);

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('oracle:maintenance:changed', {
      enabled,
      message,
      changedBy: adminId || 'system',
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Oracle maintenance mode ${enabled ? 'enabled' : 'disabled'} by ${adminId || 'system'}`);

    return { enabled, message };
  }

  async getNetworkStatus() {
    const [totalNodes, onlineNodes, totalRequests, activeRequests, maintenanceMode] = await Promise.all([
      this.prisma.validatorNode.count(),
      this.prisma.validatorNode.count({ where: { status: 'ONLINE' } }),
      this.prisma.oracleRequest.count({
        where: {
          requestedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.oracleRequest.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.platformSetting.findUnique({
        where: { key: 'ORACLE_MAINTENANCE_MODE' },
      }),
    ]);

    return {
      totalNodes,
      onlineNodes,
      nodeAvailability: totalNodes > 0 ? (onlineNodes / totalNodes) * 100 : 0,
      totalRequests,
      activeRequests,
      maintenanceMode: maintenanceMode?.value === 'true',
      timestamp: new Date().toISOString(),
    };
  }

  async syncNetwork(adminId: string) {
    // Initiate network synchronization
    const syncResult = await this.oracleCoordinatorService.synchronizeNetwork();

    // Log sync attempt
    await this.prisma.oracleSyncHistory.create({
      data: {
        initiatedBy: adminId,
        status: syncResult.success ? 'SUCCESS' : 'FAILED',
        details: syncResult,
      },
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('oracle:network:sync', {
      syncResult,
      initiatedBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Oracle network sync initiated by admin ${adminId}`);

    return syncResult;
  }

  // Helper methods
  private generateKeyPair() {
    const publicKey = randomBytes(32).toString('hex');
    const privateKey = randomBytes(64).toString('hex');

    return { publicKey, privateKey };
  }

  private async getNodeRecentPerformance(nodeId: string) {
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

    const [recentRequests, averageResponseTime, consensusScore] = await Promise.all([
      this.prisma.oracleResponse.count({
        where: {
          nodeId,
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.oracleResponse.aggregate({
        where: {
          nodeId,
          createdAt: { gte: startDate },
        },
        _avg: { responseTime: true },
      }),
      this.prisma.oracleResponse.aggregate({
        where: {
          nodeId,
          createdAt: { gte: startDate },
          isValid: true,
        },
        _avg: { consensusLevel: true },
      }),
    ]);

    return {
      recentRequests,
      averageResponseTime: averageResponseTime._avg.responseTime || 0,
      consensusScore: consensusScore._avg.consensusLevel || 0,
    };
  }

  private async getNodePerformanceMetrics(nodeId: string) {
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    const [totalResponses, validResponses, averageResponseTime] = await Promise.all([
      this.prisma.oracleResponse.count({
        where: {
          nodeId,
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.oracleResponse.count({
        where: {
          nodeId,
          createdAt: { gte: startDate },
          isValid: true,
        },
      }),
      this.prisma.oracleResponse.aggregate({
        where: {
          nodeId,
          createdAt: { gte: startDate },
        },
        _avg: { responseTime: true },
      }),
    ]);

    return {
      totalResponses,
      validResponses,
      validityRate: totalResponses > 0 ? (validResponses / totalResponses) * 100 : 0,
      averageResponseTime: averageResponseTime._avg.responseTime || 0,
    };
  }

  private async getNodeRecentActivity(nodeId: string) {
    const recentResponses = await this.prisma.oracleResponse.findMany({
      where: { nodeId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        oracleRequest: {
          select: {
            id: true,
            topicId: true,
            dataType: true,
            status: true,
          },
        },
      },
    });

    return recentResponses.map(response => ({
      id: response.id,
      request: response.oracleRequest,
      responseTime: response.responseTime,
      isValid: response.isValid,
      consensusLevel: response.consensusLevel,
      createdAt: response.createdAt,
    }));
  }

  private async updateConsensusThresholdForNewNode() {
    const totalNodes = await this.prisma.validatorNode.count({
      where: { status: { not: 'DECOMMISSIONED' } },
    });

    // Calculate minimum threshold based on node count
    const minThreshold = Math.max(51, Math.ceil((totalNodes / 2) + 1));

    const currentThreshold = await this.prisma.platformSetting.findUnique({
      where: { key: 'ORACLE_CONSENSUS_THRESHOLD' },
    });

    const currentThresholdValue = currentThreshold ? parseInt(currentThreshold.value) : 67;

    if (currentThresholdValue < minThreshold) {
      await this.prisma.platformSetting.update({
        where: { key: 'ORACLE_CONSENSUS_THRESHOLD' },
        data: { value: String(minThreshold) },
      });

      await this.oracleCoordinatorService.updateConsensusThreshold(minThreshold);
    }
  }

  private async updateConsensusThresholdForRemovedNode() {
    const totalNodes = await this.prisma.validatorNode.count({
      where: { status: { not: 'DECOMMISSIONED' } },
    });

    if (totalNodes < 2) return;

    const maxThreshold = Math.min(99, totalNodes - 1);

    const currentThreshold = await this.prisma.platformSetting.findUnique({
      where: { key: 'ORACLE_CONSENSUS_THRESHOLD' },
    });

    const currentThresholdValue = currentThreshold ? parseInt(currentThreshold.value) : 67;

    if (currentThresholdValue > maxThreshold) {
      await this.prisma.platformSetting.update({
        where: { key: 'ORACLE_CONSENSUS_THRESHOLD' },
        data: { value: String(maxThreshold) },
      });

      await this.oracleCoordinatorService.updateConsensusThreshold(maxThreshold);
    }
  }

  private async redistributeNodeLoad(nodeId: string) {
    // Get active requests for the node
    const activeRequests = await this.prisma.oracleResponse.findMany({
      where: {
        nodeId,
        oracleRequest: {
          status: 'PENDING',
        },
      },
      include: {
        oracleRequest: true,
      },
    });

    // Redistribute requests to other available nodes
    for (const response of activeRequests) {
      await this.oracleCoordinatorService.redistributeRequest(response.oracleRequest.id, nodeId);
    }
  }

  private async getAverageConsensusLevel(): Promise<number> {
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.prisma.oracleRequest.aggregate({
      where: {
        requestedAt: { gte: startDate },
        status: 'COMPLETED',
      },
      _avg: { consensusLevel: true },
    });

    return result._avg.consensusLevel || 0;
  }

  private async getAverageResponseTime(startDate: Date): Promise<number> {
    const result = await this.prisma.oracleResponse.aggregate({
      where: {
        createdAt: { gte: startDate },
      },
      _avg: { responseTime: true },
    });

    return result._avg.responseTime || 0;
  }

  private async getConsensusTimeSeries(startDate: Date) {
    return await this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC('hour', requested_at) as hour,
        AVG(consensus_level) as avg_consensus,
        COUNT(*) as request_count
      FROM oracle_requests
      WHERE requested_at >= ${startDate}
        AND status = 'COMPLETED'
      GROUP BY DATE_TRUNC('hour', requested_at)
      ORDER BY hour DESC
      LIMIT 24
    `;
  }
}