import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { BrokerClient, ClientStatus } from '../entities/broker-client.entity';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../trading/entities/order.entity';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ClientDashboardMetrics {
  overview: {
    totalClients: number;
    activeClients: number;
    newClientsThisMonth: number;
    churnedClientsThisMonth: number;
    totalTrades: number;
    totalVolume: number;
    totalRevenue: number;
    averageRevenuePerClient: number;
  };
  performanceMetrics: {
    topPerformers: Array<{
      clientId: string;
      clientName: string;
      totalRevenue: number;
      totalTrades: number;
      averageTradeSize: number;
    }>;
    atRiskClients: Array<{
      clientId: string;
      clientName: string;
      lastTradeDate: Date;
      daysSinceLastTrade: number;
      totalRevenue: number;
    }>;
    recentActivity: Array<{
      clientId: string;
      clientName: string;
      action: string;
      timestamp: Date;
      details: any;
    }>;
  };
  acquisitionMetrics: {
    byAttributionType: Array<{
      type: string;
      count: number;
      revenue: number;
      averageRevenuePerClient: number;
    }>;
    monthlyAcquisition: Array<{
      month: string;
      newClients: number;
      totalRevenue: number;
    }>;
    conversionRate: number;
    costPerAcquisition: number;
  };
  retentionMetrics: {
    clientRetentionRate: number;
    averageClientLifetime: number;
    churnRate: number;
    retentionByCohort: Array<{
      cohort: string;
      initialClients: number;
      retainedClients: number;
      retentionRate: number;
    }>;
  };
}

export interface ClientDetailMetrics {
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
    joinDate: Date;
    attributionType: string;
    status: string;
  };
  tradingActivity: {
    totalTrades: number;
    totalVolume: number;
    totalRevenue: number;
    averageTradeSize: number;
    winRate: number;
    lastTradeDate: Date;
    tradingFrequency: number; // trades per month
  };
  performance: {
    monthlyPerformance: Array<{
      month: string;
      trades: number;
      volume: number;
      revenue: number;
      profit: number;
    }>;
    assetDistribution: Array<{
      asset: string;
      trades: number;
      volume: number;
      percentage: number;
    }>;
    riskMetrics: {
      maxDrawdown: number;
      volatility: number;
      sharpeRatio: number;
    };
  };
  engagement: {
    loginFrequency: number;
    lastLoginDate: Date;
    featureUsage: Record<string, number>;
    supportTickets: number;
    satisfactionScore: number;
  };
}

@Injectable()
export class ClientDashboardService {
  private readonly logger = new Logger(ClientDashboardService.name);

  constructor(
    @InjectRepository(BrokerClient)
    private brokerClientRepository: Repository<BrokerClient>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private prismaService: PrismaService,
  ) {}

  async getDashboardMetrics(brokerId: string): Promise<ClientDashboardMetrics> {
    this.logger.log(`Generating dashboard metrics for broker ${brokerId}`);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get all client relationships
    const clients = await this.brokerClientRepository.find({
      where: { brokerId },
      relations: ['client'],
    });

    // Calculate overview metrics
    const activeClients = clients.filter(c => c.status === ClientStatus.ACTIVE);
    const newClientsThisMonth = clients.filter(c =>
      new Date(c.createdAt) >= startOfMonth
    );
    const churnedClientsThisMonth = clients.filter(c =>
      c.status === ClientStatus.CHURNED &&
      c.updatedAt &&
      new Date(c.updatedAt) >= startOfMonth
    );

    const overview = {
      totalClients: clients.length,
      activeClients: activeClients.length,
      newClientsThisMonth: newClientsThisMonth.length,
      churnedClientsThisMonth: churnedClientsThisMonth.length,
      totalTrades: activeClients.reduce((sum, c) => sum + c.totalTrades, 0),
      totalVolume: activeClients.reduce((sum, c) => sum + Number(c.totalVolume), 0),
      totalRevenue: activeClients.reduce((sum, c) => sum + Number(c.totalCommission), 0),
      averageRevenuePerClient: activeClients.length > 0
        ? activeClients.reduce((sum, c) => sum + Number(c.totalCommission), 0) / activeClients.length
        : 0,
    };

    // Get performance metrics
    const performanceMetrics = await this.getPerformanceMetrics(activeClients);

    // Get acquisition metrics
    const acquisitionMetrics = await this.getAcquisitionMetrics(clients, startOfLastMonth, endOfLastMonth);

    // Get retention metrics
    const retentionMetrics = await this.getRetentionMetrics(clients);

    return {
      overview,
      performanceMetrics,
      acquisitionMetrics,
      retentionMetrics,
    };
  }

  private async getPerformanceMetrics(activeClients: BrokerClient[]) {
    // Top performers by revenue
    const topPerformers = activeClients
      .sort((a, b) => Number(b.totalCommission) - Number(a.totalCommission))
      .slice(0, 10)
      .map(client => ({
        clientId: client.clientId,
        clientName: `${client.client.firstName} ${client.client.lastName}`,
        totalRevenue: Number(client.totalCommission),
        totalTrades: client.totalTrades,
        averageTradeSize: client.totalTrades > 0 ? Number(client.totalVolume) / client.totalTrades : 0,
      }));

    // At-risk clients (no trades in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const atRiskClients = activeClients
      .filter(client =>
        !client.lastTradeDate ||
        new Date(client.lastTradeDate) < thirtyDaysAgo
      )
      .sort((a, b) => {
        const aDays = a.lastTradeDate ?
          (Date.now() - new Date(a.lastTradeDate).getTime()) / (1000 * 60 * 60 * 24) :
          Infinity;
        const bDays = b.lastTradeDate ?
          (Date.now() - new Date(b.lastTradeDate).getTime()) / (1000 * 60 * 60 * 24) :
          Infinity;
        return bDays - aDays; // Most recent trades first
      })
      .slice(0, 10)
      .map(client => ({
        clientId: client.clientId,
        clientName: `${client.client.firstName} ${client.client.lastName}`,
        lastTradeDate: client.lastTradeDate || client.createdAt,
        daysSinceLastTrade: client.lastTradeDate ?
          Math.floor((Date.now() - new Date(client.lastTradeDate).getTime()) / (1000 * 60 * 60 * 24)) :
          Math.floor((Date.now() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        totalRevenue: Number(client.totalCommission),
      }));

    // Recent activity (mock data for now)
    const recentActivity = [
      {
        clientId: topPerformers[0]?.clientId || '',
        clientName: topPerformers[0]?.clientName || '',
        action: 'Large Trade Executed',
        timestamp: new Date(),
        details: { tradeSize: 50000, asset: 'AAPL' },
      },
      {
        clientId: newClients[0]?.clientId || '',
        clientName: newClients[0]?.clientName || '',
        action: 'New Client Onboarded',
        timestamp: new Date(),
        details: { source: 'referral_code' },
      },
    ];

    const newClients = activeClients.filter(c =>
      new Date(c.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    return {
      topPerformers,
      atRiskClients,
      recentActivity,
    };
  }

  private async getAcquisitionMetrics(clients: BrokerClient[], startDate: Date, endDate: Date) {
    // Group by attribution type
    const byAttributionType = clients.reduce((acc, client) => {
      const type = client.attributionType;
      if (!acc[type]) {
        acc[type] = { count: 0, revenue: 0 };
      }
      acc[type].count += 1;
      acc[type].revenue += Number(client.totalCommission);
      return acc;
    }, {} as Record<string, { count: number; revenue: number }>);

    const attributionMetrics = Object.entries(byAttributionType).map(([type, data]) => ({
      type,
      count: data.count,
      revenue: data.revenue,
      averageRevenuePerClient: data.count > 0 ? data.revenue / data.count : 0,
    }));

    // Monthly acquisition (last 12 months)
    const monthlyAcquisition = [];
    for (let i = 11; i >= 0; i--) {
      const month = new Date();
      month.setMonth(month.getMonth() - i);
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const monthClients = clients.filter(c =>
        new Date(c.createdAt) >= monthStart && new Date(c.createdAt) <= monthEnd
      );

      monthlyAcquisition.push({
        month: monthStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        newClients: monthClients.length,
        totalRevenue: monthClients.reduce((sum, c) => sum + Number(c.totalCommission), 0),
      });
    }

    return {
      byAttributionType: attributionMetrics,
      monthlyAcquisition,
      conversionRate: 0.15, // Mock data
      costPerAcquisition: 250, // Mock data
    };
  }

  private async getRetentionMetrics(clients: BrokerClient[]) {
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.status === ClientStatus.ACTIVE);
    const churnedClients = clients.filter(c => c.status === ClientStatus.CHURNED);

    const retentionRate = totalClients > 0 ? activeClients.length / totalClients : 0;
    const churnRate = totalClients > 0 ? churnedClients.length / totalClients : 0;

    // Calculate average client lifetime (simplified)
    const averageClientLifetime = clients.length > 0
      ? clients.reduce((sum, c) => {
          const lifetime = c.status === ClientStatus.CHURNED && c.updatedAt
            ? (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
            : (Date.now() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return sum + lifetime;
        }, 0) / clients.length
      : 0;

    // Cohort analysis (simplified)
    const retentionByCohort = [
      {
        cohort: 'Q1 2024',
        initialClients: 25,
        retainedClients: 20,
        retentionRate: 0.8,
      },
      {
        cohort: 'Q2 2024',
        initialClients: 30,
        retainedClients: 24,
        retentionRate: 0.8,
      },
      {
        cohort: 'Q3 2024',
        initialClients: 35,
        retainedClients: 28,
        retentionRate: 0.8,
      },
    ];

    return {
      clientRetentionRate: retentionRate,
      averageClientLifetime: Math.round(averageClientLifetime),
      churnRate,
      retentionByCohort,
    };
  }

  async getClientDetailMetrics(brokerId: string, clientId: string): Promise<ClientDetailMetrics> {
    this.logger.log(`Getting detail metrics for client ${clientId} of broker ${brokerId}`);

    // Verify broker-client relationship
    const brokerClient = await this.brokerClientRepository.findOne({
      where: { brokerId, clientId },
      relations: ['client'],
    });

    if (!brokerClient) {
      throw new Error('Client not found for this broker');
    }

    const client = brokerClient.client;

    // Get trading activity from orders
    const orders = await this.prismaService.order.findMany({
      where: {
        userId: clientId,
        brokerId: brokerId,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalTrades = orders.length;
    const totalVolume = orders.reduce((sum, order) => sum + Number(order.totalValue), 0);
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.feeAmount), 0);
    const averageTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

    // Calculate win rate (simplified - assume profitable trades are those with positive returns)
    const profitableTrades = orders.filter(order =>
      order.status === 'FILLED' && Math.random() > 0.4 // Mock win rate of 60%
    ).length;
    const winRate = totalTrades > 0 ? profitableTrades / totalTrades : 0;

    const tradingActivity = {
      totalTrades,
      totalVolume,
      totalRevenue,
      averageTradeSize,
      winRate,
      lastTradeDate: orders[0]?.createdAt || new Date(),
      tradingFrequency: this.calculateTradingFrequency(orders),
    };

    // Performance metrics (mock data for now)
    const performance = {
      monthlyPerformance: this.generateMonthlyPerformance(orders),
      assetDistribution: this.generateAssetDistribution(orders),
      riskMetrics: {
        maxDrawdown: Math.random() * 0.2 + 0.05, // 5-25% drawdown
        volatility: Math.random() * 0.3 + 0.1, // 10-40% volatility
        sharpeRatio: Math.random() * 2 + 0.5, // 0.5-2.5 Sharpe ratio
      },
    };

    // Engagement metrics (mock data for now)
    const engagement = {
      loginFrequency: Math.floor(Math.random() * 30) + 1, // 1-30 logins per month
      lastLoginDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
      featureUsage: {
        trading: Math.floor(Math.random() * 100) + 50,
        analytics: Math.floor(Math.random() * 50) + 10,
        alerts: Math.floor(Math.random() * 30) + 5,
      },
      supportTickets: Math.floor(Math.random() * 5),
      satisfactionScore: Math.random() * 2 + 3, // 3-5 rating
    };

    return {
      client: {
        id: client.id,
        name: `${client.firstName} ${client.lastName}`,
        email: client.email,
        phone: client.phoneNumber,
        joinDate: brokerClient.createdAt,
        attributionType: brokerClient.attributionType,
        status: brokerClient.status,
      },
      tradingActivity,
      performance,
      engagement,
    };
  }

  private calculateTradingFrequency(orders: Order[]): number {
    if (orders.length === 0) return 0;

    const firstTrade = new Date(orders[orders.length - 1].createdAt);
    const lastTrade = new Date(orders[0].createdAt);
    const daysActive = Math.max(1, (lastTrade.getTime() - firstTrade.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate trades per month
    return (orders.length / daysActive) * 30;
  }

  private generateMonthlyPerformance(orders: Order[]) {
    const monthlyData = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= month && orderDate <= monthEnd;
      });

      monthlyData.push({
        month: month.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        trades: monthOrders.length,
        volume: monthOrders.reduce((sum, order) => sum + Number(order.totalValue), 0),
        revenue: monthOrders.reduce((sum, order) => sum + Number(order.feeAmount), 0),
        profit: monthOrders.reduce((sum, order) => sum + (Number(order.totalValue) * 0.02), 0), // Mock 2% profit
      });
    }

    return monthlyData;
  }

  private generateAssetDistribution(orders: Order[]) {
    const assets = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'BTC', 'ETH'];
    const distribution = [];

    const totalVolume = orders.reduce((sum, order) => sum + Number(order.totalValue), 0);

    assets.forEach(asset => {
      const assetOrders = orders.filter(order => order.asset === asset);
      const assetVolume = assetOrders.reduce((sum, order) => sum + Number(order.totalValue), 0);

      if (assetOrders.length > 0) {
        distribution.push({
          asset,
          trades: assetOrders.length,
          volume: assetVolume,
          percentage: totalVolume > 0 ? (assetVolume / totalVolume) * 100 : 0,
        });
      }
    });

    return distribution.sort((a, b) => b.volume - a.volume);
  }
}