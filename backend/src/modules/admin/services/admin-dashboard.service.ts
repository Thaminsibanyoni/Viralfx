import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditLog, AuditAction, AuditSeverity } from '../entities/admin-audit-log.entity';

// These interfaces would typically be defined in a shared types file
interface DashboardMetrics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalBrokers: number;
    activeBrokers: number;
    marketVolume: number;
    oracleHealth: number;
    nodeUptime: number;
    paymentRevenue: number;
    systemAlerts: number;
    abuseDetections: number;
    riskScore: number;
    systemHealth: number;
  };
  departments: {
    userOps: { pendingTasks: number; criticalIssues: number };
    brokerOps: { pendingApplications: number; complianceIssues: number };
    trendOps: { activeTrends: number; pendingReviews: number };
    riskOps: { highRiskAlerts: number; contentReviews: number };
    financeOps: { pendingPayouts: number; revenueMetrics: any };
    techOps: { systemHealth: number; activeNodes: number };
  };
}

interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  status: string;
  kycStatus: string;
  balanceUsd: number;
  createdAt: Date;
  lastLoginAt?: Date;
  riskScore: number;
}

interface Broker {
  id: string;
  name: string;
  email: string;
  status: string;
  tier: string;
  fscaLicense?: string;
  createdAt: Date;
  tradingVolume: number;
  complianceScore: number;
}

interface Trend {
  id: string;
  title: string;
  category: string;
  region: string;
  status: string;
  viralityScore: number;
  volume: number;
  createdAt: Date;
}

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private auditLogRepository: Repository<AdminAuditLog>,
    private prisma: PrismaService,
  ) {}

  async getDashboardMetrics(timeframe: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<DashboardMetrics> {
    // This would typically aggregate data from multiple sources
    // For now, returning mock data structure

    const now = new Date();
    const startTime = this.calculateStartTime(now, timeframe);

    return {
      overview: {
        totalUsers: await this.getTotalUsers(),
        activeUsers: await this.getActiveUsers(startTime),
        totalBrokers: await this.getTotalBrokers(),
        activeBrokers: await this.getActiveBrokers(startTime),
        marketVolume: await this.getMarketVolume(startTime, now),
        oracleHealth: await this.getOracleHealth(),
        nodeUptime: await this.getNodeUptime(),
        paymentRevenue: await this.getPaymentRevenue(startTime, now),
        systemAlerts: await this.getSystemAlerts(),
        abuseDetections: await this.getAbuseDetections(startTime, now),
        riskScore: await this.calculateRiskScore(),
        systemHealth: await this.getSystemHealth(),
      },
      departments: {
        userOps: {
          pendingTasks: await this.getPendingUserOpsTasks(),
          criticalIssues: await this.getCriticalUserIssues(),
        },
        brokerOps: {
          pendingApplications: await this.getPendingBrokerApplications(),
          complianceIssues: await this.getComplianceIssues(),
        },
        trendOps: {
          activeTrends: await this.getActiveTrends(),
          pendingReviews: await this.getPendingTrendReviews(),
        },
        riskOps: {
          highRiskAlerts: await this.getHighRiskAlerts(),
          contentReviews: await this.getPendingContentReviews(),
        },
        financeOps: {
          pendingPayouts: await this.getPendingPayouts(),
          revenueMetrics: await this.getRevenueMetrics(startTime, now),
        },
        techOps: {
          systemHealth: await this.getSystemHealth(),
          activeNodes: await this.getActiveNodes(),
        },
      },
    };
  }

  async getPredictiveInsights(): Promise<any> {
    // This would integrate with ML/AI services
    return {
      brokerComplianceRisks: [],
      userChurnRisks: [],
      marketVolatilityPredictions: [],
      systemPerformanceRisks: [],
      securityThreats: [],
      overallRiskAssessment: {
        score: 85.5,
        level: 'LOW',
        trend: 'STABLE',
      },
    };
  }

  async getUsers(filters: {
    page: number;
    limit: number;
    status?: string;
    kycStatus?: string;
    search?: string;
  }): Promise<{ users: User[]; total: number }> {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.kycStatus) where.kycStatus = filters.kycStatus;
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        status: true,
        kycStatus: true,
        balanceUsd: true,
        createdAt: true,
        lastLoginAt: true,
        riskScore: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });

    return { users, total };
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        status: true,
        kycStatus: true,
        balanceUsd: true,
        createdAt: true,
        lastLoginAt: true,
        riskScore: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async suspendUser(userId: string, reason: string, adminId: string): Promise<void> {
    // Update user status
    // Create audit log
    await this.auditLogRepository.save({
      adminId,
      action: AuditAction.USER_SUSPEND,
      severity: AuditSeverity.MEDIUM,
      targetType: 'User',
      targetId: userId,
      metadata: { reason },
      description: `Suspended user ${userId}: ${reason}`,
    });

    this.logger.log(`User ${userId} suspended by admin ${adminId}: ${reason}`);
  }

  async unsuspendUser(userId: string, adminId: string): Promise<void> {
    // Update user status
    // Create audit log
    await this.auditLogRepository.save({
      adminId,
      action: AuditAction.USER_UNSUSPEND,
      severity: AuditSeverity.LOW,
      targetType: 'User',
      targetId: userId,
      description: `Unsuspended user ${userId}`,
    });

    this.logger.log(`User ${userId} unsuspended by admin ${adminId}`);
  }

  async banUser(userId: string, reason: string, adminId: string): Promise<void> {
    // Update user status
    // Create audit log
    await this.auditLogRepository.save({
      adminId,
      action: AuditAction.USER_BAN,
      severity: AuditSeverity.HIGH,
      targetType: 'User',
      targetId: userId,
      metadata: { reason },
      description: `Banned user ${userId}: ${reason}`,
    });

    this.logger.log(`User ${userId} banned by admin ${adminId}: ${reason}`);
  }

  async unbanUser(userId: string, adminId: string): Promise<void> {
    // Update user status
    // Create audit log
    await this.auditLogRepository.save({
      adminId,
      action: AuditAction.USER_UNBAN,
      severity: AuditSeverity.LOW,
      targetType: 'User',
      targetId: userId,
      description: `Unbanned user ${userId}`,
    });

    this.logger.log(`User ${userId} unbanned by admin ${adminId}`);
  }

  async getUserAuditTrail(userId: string): Promise<AdminAuditLog[]> {
    return await this.auditLogRepository.find({
      where: { targetId: userId, targetType: 'User' },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async approveKYC(userId: string, adminId: string): Promise<void> {
    // Update KYC status
    // Create audit log
    await this.auditLogRepository.save({
      adminId,
      action: AuditAction.USER_SUSPEND, // Would be a KYC_APPROVED action
      severity: AuditSeverity.MEDIUM,
      targetType: 'User',
      targetId: userId,
      description: `Approved KYC for user ${userId}`,
    });

    this.logger.log(`KYC approved for user ${userId} by admin ${adminId}`);
  }

  async rejectKYC(userId: string, reason: string, adminId: string): Promise<void> {
    // Update KYC status
    // Create audit log
    await this.auditLogRepository.save({
      adminId,
      action: AuditAction.USER_SUSPEND, // Would be a KYC_REJECTED action
      severity: AuditSeverity.MEDIUM,
      targetType: 'User',
      targetId: userId,
      metadata: { reason },
      description: `Rejected KYC for user ${userId}: ${reason}`,
    });

    this.logger.log(`KYC rejected for user ${userId} by admin ${adminId}: ${reason}`);
  }

  async getBrokers(filters: {
    page: number;
    limit: number;
    status?: string;
    tier?: string;
    search?: string;
  }): Promise<{ brokers: Broker[]; total: number }> {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.tier) where.tier = filters.tier;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [brokers, total] = await this.prisma.broker.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        tier: true,
        fscaLicense: true,
        createdAt: true,
        tradingVolume: true,
        complianceScore: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });

    return { brokers, total };
  }

  async getBrokerById(brokerId: string): Promise<Broker> {
    const broker = await this.prisma.broker.findUnique({
      where: { id: brokerId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        tier: true,
        fscaLicense: true,
        createdAt: true,
        tradingVolume: true,
        complianceScore: true,
      },
    });

    if (!broker) {
      throw new NotFoundException('Broker not found');
    }
    return broker;
  }

  async approveBroker(brokerId: string, adminId: string): Promise<void> {
    // Update broker status
    await this.auditLogRepository.save({
      adminId,
      action: AuditAction.BROKER_APPROVE,
      severity: AuditSeverity.HIGH,
      targetType: 'Broker',
      targetId: brokerId,
      description: `Approved broker ${brokerId}`,
    });

    this.logger.log(`Broker ${brokerId} approved by admin ${adminId}`);
  }

  async suspendBroker(brokerId: string, reason: string, adminId: string): Promise<void> {
    // Update broker status
    await this.auditLogRepository.save({
      adminId,
      action: AuditAction.BROKER_SUSPEND,
      severity: AuditSeverity.HIGH,
      targetType: 'Broker',
      targetId: brokerId,
      metadata: { reason },
      description: `Suspended broker ${brokerId}: ${reason}`,
    });

    this.logger.log(`Broker ${brokerId} suspended by admin ${adminId}: ${reason}`);
  }

  async verifyBroker(brokerId: string, verificationData: any, adminId: string): Promise<void> {
    // Update broker verification status
    await this.auditLogRepository.save({
      adminId,
      action: AuditAction.BROKER_APPROVE, // Would be BROKER_VERIFY action
      severity: AuditSeverity.MEDIUM,
      targetType: 'Broker',
      targetId: brokerId,
      metadata: verificationData,
      description: `Verified broker ${brokerId}`,
    });

    this.logger.log(`Broker ${brokerId} verified by admin ${adminId}`);
  }

  async getAuditLogs(filters: {
    page: number;
    limit: number;
    action?: string;
    adminId?: string;
    targetType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: AdminAuditLog[]; total: number }> {
    const where: any = {};

    if (filters.action) where.action = filters.action;
    if (filters.adminId) where.adminId = filters.adminId;
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.startDate || filters.endDate) {
      if (filters.startDate && filters.endDate) {
        where.createdAt = this.auditLogRepository.manager.createQueryBuilder()
          .select('*')
          .from(AdminAuditLog, 'log')
          .where('log.createdAt BETWEEN :start AND :end', {
            start: filters.startDate,
            end: filters.endDate
          })
          .getExpression();
      } else if (filters.startDate) {
        where.createdAt = { $gte: filters.startDate };
      } else if (filters.endDate) {
        where.createdAt = { $lte: filters.endDate };
      }
    }

    const [logs, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });

    return { logs, total };
  }

  async getAuditStatistics(): Promise<any> {
    return {
      totalLogs: await this.auditLogRepository.count(),
      actionsByType: await this.auditLogRepository
        .createQueryBuilder('log')
        .select('log.action', 'action')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.action')
        .getRawMany(),
      severityDistribution: await this.auditLogRepository
        .createQueryBuilder('log')
        .select('log.severity', 'severity')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.severity')
        .getRawMany(),
      recentActivity: await this.auditLogRepository.find({
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    };
  }

  // Private helper methods with real data queries
  private async getTotalUsers(): Promise<number> {
    return await this.prisma.user.count();
  }

  private async getActiveUsers(startTime: Date): Promise<number> {
    return await this.prisma.user.count({
      where: {
        lastLoginAt: {
          gte: startTime,
        },
      },
    });
  }

  private async getTotalBrokers(): Promise<number> {
    return await this.prisma.broker.count();
  }

  private async getActiveBrokers(startTime: Date): Promise<number> {
    return await this.prisma.broker.count({
      where: {
        OR: [
          {
            lastLoginAt: {
              gte: startTime,
            },
          },
          {
            createdAt: {
              gte: startTime,
            },
          },
        ],
      },
    });
  }

  private async getMarketVolume(startTime: Date, endTime: Date): Promise<number> {
    const volumeData = await this.prisma.transaction.aggregate({
      where: {
        type: {
          in: ['BET_STAKE', 'BET_PAYOUT'],
        },
        status: 'COMPLETED',
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      _sum: {
        amountZar: true,
        amountUsd: true,
      },
    });

    return (volumeData._sum.amountZar || 0) + (volumeData._sum.amountUsd || 0);
  }

  private async getOracleHealth(): Promise<number> {
    const totalNodes = await this.prisma.validatorNode.count();
    const activeNodes = await this.prisma.validatorNode.count({
      where: {
        status: 'ONLINE',
      },
    });

    if (totalNodes === 0) return 100;
    return (activeNodes / totalNodes) * 100;
  }

  private async getNodeUptime(): Promise<number> {
    const nodes = await this.prisma.validatorNode.findMany({
      where: {
        status: 'ONLINE',
      },
      select: {
        uptimePercentage: true,
      },
    });

    if (nodes.length === 0) return 100;
    const totalUptime = nodes.reduce((sum, node) => sum + (node.uptimePercentage || 0), 0);
    return totalUptime / nodes.length;
  }

  private async getPaymentRevenue(startTime: Date, endTime: Date): Promise<number> {
    const revenueData = await this.prisma.transaction.aggregate({
      where: {
        type: {
          in: ['DEPOSIT', 'WITHDRAWAL'],
        },
        status: 'COMPLETED',
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      _sum: {
        amountZar: true,
        amountUsd: true,
      },
    });

    return (revenueData._sum.amountZar || 0) + (revenueData._sum.amountUsd || 0);
  }

  private async getSystemAlerts(): Promise<number> {
    return await this.prisma.monitoringAlert.count({
      where: {
        status: 'OPEN',
        severity: {
          in: ['HIGH', 'CRITICAL'],
        },
      },
    });
  }

  private async getAbuseDetections(startTime: Date, endTime: Date): Promise<number> {
    return await this.prisma.ingestEvent.count({
      where: {
        moderationStatus: 'FLAGGED',
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
    });
  }

  private async calculateRiskScore(): Promise<number> {
    const highRiskAlerts = await this.prisma.monitoringAlert.count({
      where: {
        status: 'OPEN',
        severity: 'CRITICAL',
      },
    });

    const totalUsers = await this.prisma.user.count();
    const suspendedUsers = await this.prisma.user.count({
      where: {
        status: 'SUSPENDED',
      },
    });

    const baseScore = 90;

    // Guard against division by zero when no users exist
    const userSuspensionRatio = totalUsers > 0 ? suspendedUsers / totalUsers : 0;

    const riskPenalty = (highRiskAlerts * 5) + (userSuspensionRatio * 10);
    const riskScore = Math.max(0, Math.min(100, baseScore - riskPenalty));

    return riskScore;
  }

  private async getPendingUserOpsTasks(): Promise<number> {
    return await this.prisma.user.count({
      where: {
        OR: [
          {
            kycStatus: 'PENDING',
          },
          {
            status: 'PENDING_VERIFICATION',
          },
        ],
      },
    });
  }

  private async getCriticalUserIssues(): Promise<number> {
    return await this.prisma.monitoringAlert.count({
      where: {
        type: 'USER_SECURITY',
        severity: 'CRITICAL',
        status: 'OPEN',
      },
    });
  }

  private async getPendingBrokerApplications(): Promise<number> {
    return await this.prisma.broker.count({
      where: {
        status: 'PENDING',
      },
    });
  }

  private async getComplianceIssues(): Promise<number> {
    return await this.prisma.broker.count({
      where: {
        AND: [
          {
            fscaVerified: false,
          },
          {
            createdAt: {
              lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Older than 7 days
            },
          },
        ],
      },
    });
  }

  private async getActiveTrends(): Promise<number> {
    return await this.prisma.topic.count({
      where: {
        status: 'ACTIVE',
        viralIndex: {
          gt: 50, // Trends with significant virality
        },
      },
    });
  }

  private async getPendingTrendReviews(): Promise<number> {
    return await this.prisma.topic.count({
      where: {
        status: 'PENDING_REVIEW',
      },
    });
  }

  private async getHighRiskAlerts(): Promise<number> {
    return await this.prisma.monitoringAlert.count({
      where: {
        severity: {
          in: ['HIGH', 'CRITICAL'],
        },
        status: 'OPEN',
      },
    });
  }

  private async getPendingContentReviews(): Promise<number> {
    return await this.prisma.ingestEvent.count({
      where: {
        moderationStatus: 'PENDING_REVIEW',
      },
    });
  }

  private async getPendingPayouts(): Promise<number> {
    return await this.prisma.brokerBill.count({
      where: {
        status: 'PENDING',
        dueDate: {
          lte: new Date(),
        },
      },
    });
  }

  private async getRevenueMetrics(startTime: Date, endTime: Date): Promise<any> {
    const transactions = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      _sum: {
        amountZar: true,
        amountUsd: true,
      },
      _count: true,
    });

    const brokerCommissions = await this.prisma.commission.aggregate({
      where: {
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return {
      transactions,
      totalBrokerCommissions: brokerCommissions._sum.amount || 0,
      platformFees: transactions.reduce((sum, tx) => {
        const amount = (tx._sum.amountZar || 0) + (tx._sum.amountUsd || 0);
        return sum + (amount * 0.002); // 0.2% platform fee
      }, 0),
    };
  }

  private async getSystemHealth(): Promise<number> {
    const components = [
      await this.getOracleHealth(),
      await this.getNodeUptime(),
      95, // Mock API health
      98, // Mock database health
    ];

    return components.reduce((sum, health) => sum + health, 0) / components.length;
  }

  private async getActiveNodes(): Promise<number> {
    return await this.prisma.validatorNode.count({
      where: {
        status: 'ONLINE',
      },
    });
  }

  private calculateStartTime(now: Date, timeframe: string): Date {
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    return new Date(now.getTime() - timeframes[timeframe as keyof typeof timeframes]);
  }
}