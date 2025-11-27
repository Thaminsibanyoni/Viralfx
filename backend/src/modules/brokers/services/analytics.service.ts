import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import Redis from 'ioredis';
import { BrokerApiUsage, ApiMethod } from '../entities/broker-api-usage.entity';
import { BrokerMarketingAnalytics } from '../entities/broker-marketing-analytics.entity';
import { BrokerBill, BillStatus } from '../entities/broker-bill.entity';
import { Broker } from '../entities/broker.entity';
import { BrokerDashboardMetrics, ApiUsageMetrics, MarketingMetrics, BrokerAnalytics } from '../interfaces/broker.interface';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private redis: Redis;

  constructor(
    @InjectRepository(BrokerApiUsage)
    private apiUsageRepository: Repository<BrokerApiUsage>,
    @InjectRepository(BrokerMarketingAnalytics)
    private marketingAnalyticsRepository: Repository<BrokerMarketingAnalytics>,
    @InjectRepository(BrokerBill)
    private billRepository: Repository<BrokerBill>,
    @InjectRepository(Broker)
    private brokerRepository: Repository<Broker>,
    private configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
    });
  }

  async getBrokerDashboard(brokerId: string): Promise<BrokerDashboardMetrics> {
    this.logger.log(`Generating dashboard metrics for broker ${brokerId}`);

    const cacheKey = `broker:dashboard:${brokerId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      this.logger.debug(`Returning cached dashboard for broker ${brokerId}`);
      return JSON.parse(cached);
    }

    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    // Get metrics for different time periods
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [
      volumeMetrics,
      clientMetrics,
      apiUsageMetrics,
      complianceMetrics,
      recentActivity,
      financialMetrics,
      performanceMetrics,
    ] = await Promise.all([
      this.getVolumeMetrics(brokerId, today, monthAgo, yearAgo),
      this.getClientMetrics(brokerId, monthAgo),
      this.getApiUsageMetrics(brokerId, today, monthAgo),
      this.getComplianceMetrics(brokerId),
      this.getRecentActivity(brokerId),
      this.getFinancialMetrics(brokerId, monthAgo),
      this.getCurrentPerformanceMetrics(brokerId),
    ]);

    const dashboard: BrokerDashboardMetrics = {
      totalVolume: volumeMetrics,
      activeClients: clientMetrics,
      apiUsage: apiUsageMetrics,
      complianceScore: complianceMetrics,
      recentActivity,
      financialMetrics,
      performanceMetrics,
    };

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(dashboard));

    return dashboard;
  }

  async getApiUsageStats(brokerId: string, period: { start: Date; end: Date }): Promise<ApiUsageMetrics[]> {
    const apiUsage = await this.apiUsageRepository.find({
      where: {
        brokerId,
        date: Between(period.start, period.end),
      },
      order: { date: 'DESC', endpoint: 'ASC', method: 'ASC' },
    });

    // Transform into metrics format
    const metrics = apiUsage.map(usage => ({
      brokerId: usage.brokerId,
      date: usage.date,
      endpoint: usage.endpoint,
      method: usage.method,
      requestCount: usage.requestCount,
      averageResponseTime: usage.responseTimeAvg,
      errorCount: usage.errorCount,
      errorRate: usage.requestCount > 0 ? (usage.errorCount / usage.requestCount) * 100 : 0,
    }));

    return metrics;
  }

  async getPerformanceMetrics(brokerId: string, period: { start: Date; end: Date }): Promise<any> {
    const apiUsage = await this.getApiUsageStats(brokerId, period);

    // Aggregate performance metrics
    const totalRequests = apiUsage.reduce((sum, metric) => sum + metric.requestCount, 0);
    const totalErrors = apiUsage.reduce((sum, metric) => sum + metric.errorCount, 0);
    const avgResponseTime = apiUsage.reduce((sum, metric) => sum + metric.averageResponseTime, 0) / (apiUsage.length || 1);

    // Get top endpoints by usage
    const endpointUsage = new Map<string, number>();
    apiUsage.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      endpointUsage.set(key, (endpointUsage.get(key) || 0) + metric.requestCount);
    });

    const topEndpoints = Array.from(endpointUsage.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    // Calculate uptime (simulated)
    const uptime = 99.9; // Would calculate from actual monitoring data

    return {
      totalRequests,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      averageResponseTime: Math.round(avgResponseTime),
      uptime,
      topEndpoints,
      errorCodes: [], // Would track actual HTTP error codes
      performanceScore: this.calculatePerformanceScore(uptime, 100 - (totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0), avgResponseTime),
    };
  }

  async getMarketingAnalytics(brokerId: string, period: { start: Date; end: Date }): Promise<MarketingMetrics[]> {
    const marketingData = await this.marketingAnalyticsRepository.find({
      where: {
        brokerId,
        date: Between(period.start, period.end),
      },
      order: { date: 'ASC' },
    });

    return marketingData.map(data => ({
      brokerId: data.brokerId,
      date: data.date,
      profileViews: data.profileViews,
      contactClicks: data.contactClicks,
      websiteClicks: data.websiteClicks,
      referralsSent: data.referralsSent,
      referralsConverted: data.referralsConverted,
      referralRevenue: data.referralRevenue,
      conversionRate: data.conversionRate,
      averageRating: data.averageRating,
      reviewCount: data.reviewCount,
      searchRanking: Math.floor(Math.random() * 10) + 1, // Simulated ranking
      socialMediaMentions: Math.floor(Math.random() * 50), // Simulated mentions
    }));
  }

  async getRevenueAnalytics(brokerId: string, period: { start: Date; end: Date }): Promise<any> {
    // Get bills for the period
    const bills = await this.billRepository.find({
      where: {
        brokerId,
        period: Between(period.start, period.end),
        status: BillStatus.PAID,
      },
    });

    // Calculate revenue metrics
    const grossRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);
    const commissionRevenue = bills.reduce((sum, bill) => sum + bill.transactionFees, 0);
    const feeRevenue = bills.reduce((sum, bill) => sum + bill.baseFee, 0);
    const otherRevenue = bills.reduce((sum, bill) => sum + bill.additionalServices, 0);

    // Calculate net revenue (after costs)
    const estimatedCosts = grossRevenue * 0.3; // Assume 30% costs
    const netRevenue = grossRevenue - estimatedCosts;

    return {
      grossRevenue,
      netRevenue,
      commissionRevenue,
      feeRevenue,
      otherRevenue,
      revenueBySource: {
        commissions: commissionRevenue,
        fees: feeRevenue,
        services: otherRevenue,
      },
      profitMargin: grossRevenue > 0 ? (netRevenue / grossRevenue) * 100 : 0,
      averageRevenuePerMonth: grossRevenue / Math.max(1, bills.length),
    };
  }

  async generateCustomReport(brokerId: string, reportConfig: any): Promise<Buffer> {
    this.logger.log(`Generating custom report for broker ${brokerId}`);

    const { reportType, period, metrics, format } = reportConfig;

    // Collect data based on report type
    let data: any = {};

    switch (reportType) {
      case 'PERFORMANCE':
        data = await this.getPerformanceMetrics(brokerId, period);
        break;
      case 'API_USAGE':
        data = await this.getApiUsageStats(brokerId, period);
        break;
      case 'REVENUE':
        data = await this.getRevenueAnalytics(brokerId, period);
        break;
      case 'MARKETING':
        data = await this.getMarketingAnalytics(brokerId, period);
        break;
      case 'COMPREHENSIVE':
        data = await this.getBrokerDashboard(brokerId);
        break;
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    // Generate report based on format
    if (format === 'PDF') {
      return this.generatePDFReport(reportType, data, period);
    } else if (format === 'CSV') {
      return this.generateCSVReport(data);
    } else if (format === 'JSON') {
      return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
  }

  async getAdminDashboard(): Promise<any> {
    const cacheKey = 'admin:dashboard';
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const [
      totalBrokers,
      activeBrokers,
      totalVolume,
      totalRevenue,
      brokerMetrics,
    ] = await Promise.all([
      this.brokerRepository.count(),
      this.brokerRepository.count({ where: { isActive: true } }),
      this.getTotalPlatformVolume(),
      this.getTotalPlatformRevenue(),
      this.getBrokerMetrics(),
    ]);

    const dashboard = {
      overview: {
        totalBrokers,
        activeBrokers,
        totalVolume,
        totalRevenue,
        averageComplianceScore: 0.85, // Would calculate from actual data
      },
      brokerMetrics,
      recentActivity: await this.getRecentPlatformActivity(),
    };

    // Cache for 2 minutes
    await this.redis.setex(cacheKey, 120, JSON.stringify(dashboard));

    return dashboard;
  }

  async trackApiRequest(brokerId: string, endpoint: string, method: ApiMethod, responseTime: number, success: boolean): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find or create today's usage record
    let usage = await this.apiUsageRepository.findOne({
      where: {
        brokerId,
        date: today,
        endpoint,
        method,
      },
    });

    if (!usage) {
      usage = this.apiUsageRepository.create({
        brokerId,
        date: today,
        endpoint,
        method,
        requestCount: 0,
        responseTimeAvg: 0,
        errorCount: 0,
      });
    }

    // Update metrics
    usage.requestCount += 1;
    if (!success) {
      usage.errorCount += 1;
    }

    // Update average response time
    const totalRequests = usage.requestCount;
    usage.responseTimeAvg = Math.round(
      ((usage.responseTimeAvg * (totalRequests - 1)) + responseTime) / totalRequests
    );

    await this.apiUsageRepository.save(usage);

    // Update real-time metrics cache
    await this.updateRealtimeMetrics(brokerId, {
      endpoint,
      method,
      responseTime,
      success: success ? 1 : 0,
      timestamp: new Date(),
    });
  }

  private async getVolumeMetrics(brokerId: string, today: Date, monthAgo: Date, yearAgo: Date): Promise<any> {
    // In a real implementation, this would query actual trading data
    // For now, simulate volume metrics
    return {
      daily: Math.floor(Math.random() * 100000) + 50000,
      weekly: Math.floor(Math.random() * 500000) + 250000,
      monthly: Math.floor(Math.random() * 2000000) + 1000000,
      yearly: Math.floor(Math.random() * 24000000) + 12000000,
    };
  }

  private async getClientMetrics(brokerId: string, monthAgo: Date): Promise<any> {
    // In a real implementation, this would query actual client data
    return {
      total: Math.floor(Math.random() * 1000) + 100,
      newThisMonth: Math.floor(Math.random() * 50) + 5,
      churnRate: Math.random() * 0.05 + 0.01,
      averageAccountSize: Math.floor(Math.random() * 100000) + 10000,
    };
  }

  private async getApiUsageMetrics(brokerId: string, today: Date, monthAgo: Date): Promise<any> {
    const [todayUsage, monthUsage] = await Promise.all([
      this.apiUsageRepository
        .createQueryBuilder('usage')
        .select('SUM(usage.requestCount)', 'total')
        .where('usage.brokerId = :brokerId', { brokerId })
        .andWhere('usage.date = :today', { today })
        .getRawOne(),
      this.apiUsageRepository
        .createQueryBuilder('usage')
        .select('SUM(usage.requestCount)', 'total')
        .addSelect('AVG(usage.responseTimeAvg)', 'avgResponseTime')
        .addSelect('SUM(usage.errorCount)', 'totalErrors')
        .where('usage.brokerId = :brokerId', { brokerId })
        .andWhere('usage.date >= :monthAgo', { monthAgo })
        .getRawOne(),
    ]);

    const requestsToday = parseInt(todayUsage?.total || '0');
    const requestsThisMonth = parseInt(monthUsage?.total || '0');
    const averageResponseTime = parseInt(monthUsage?.avgResponseTime || '0');
    const totalErrors = parseInt(monthUsage?.totalErrors || '0');

    // Get top endpoints
    const topEndpoints = await this.apiUsageRepository
      .createQueryBuilder('usage')
      .select('usage.endpoint', 'endpoint')
      .addSelect('SUM(usage.requestCount)', 'count')
      .where('usage.brokerId = :brokerId', { brokerId })
      .andWhere('usage.date >= :monthAgo', { monthAgo })
      .groupBy('usage.endpoint')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      requestsToday,
      requestsThisMonth,
      averageResponseTime,
      errorRate: requestsThisMonth > 0 ? (totalErrors / requestsThisMonth) * 100 : 0,
      topEndpoints: topEndpoints.map(ep => ({ endpoint: ep.endpoint, count: parseInt(ep.count) })),
    };
  }

  private async getComplianceMetrics(brokerId: string): Promise<any> {
    // In a real implementation, this would query actual compliance data
    return {
      overall: 0.92,
      fscaStatus: 'VERIFIED',
      lastCheck: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      recommendations: ['Enable two-factor authentication', 'Update security policies'],
      alerts: [
        {
          type: 'SECURITY',
          severity: 'LOW',
          message: 'API key rotation recommended',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
      ],
    };
  }

  private async getRecentActivity(brokerId: string): Promise<any[]> {
    // In a real implementation, this would query actual activity logs
    return [
      {
        type: 'API_CALL',
        description: 'Processed 1,250 API requests',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        status: 'SUCCESS',
      },
      {
        type: 'COMPLIANCE_CHECK',
        description: 'Daily compliance check completed',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'SUCCESS',
      },
      {
        type: 'BILL_PAYMENT',
        description: 'Monthly bill payment received',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'SUCCESS',
      },
    ];
  }

  private async getFinancialMetrics(brokerId: string, monthAgo: Date): Promise<any> {
    const bills = await this.billRepository.find({
      where: {
        brokerId,
        createdAt: MoreThanOrEqual(monthAgo),
        status: BillStatus.PAID,
      },
    });

    const totalPaid = bills.reduce((sum, bill) => sum + bill.total, 0);
    const fees = bills.reduce((sum, bill) => sum + bill.transactionFees, 0);

    return {
      revenueThisMonth: totalPaid,
      feesThisMonth: fees,
      averageCommission: bills.length > 0 ? fees / bills.length : 0,
      profitMargin: 0.15, // Would calculate from actual costs
    };
  }

  private async getCurrentPerformanceMetrics(brokerId: string): Promise<any> {
    // Simulate current performance metrics
    return {
      uptime: 99.9,
      systemHealth: 95,
      orderExecutionTime: 120,
      settlementTime: 300,
    };
  }

  private async getTotalPlatformVolume(): Promise<number> {
    // In a real implementation, this would query actual trading volume
    return 500000000; // R500M
  }

  private async getTotalPlatformRevenue(): Promise<number> {
    const total = await this.billRepository
      .createQueryBuilder('bill')
      .select('SUM(bill.total)', 'total')
      .where('bill.status = :status', { status: BillStatus.PAID })
      .getRawOne();

    return parseFloat(total?.total || '0');
  }

  private async getBrokerMetrics(): Promise<any> {
    const brokersByTier = await this.brokerRepository
      .createQueryBuilder('broker')
      .select('broker.tier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .groupBy('broker.tier')
      .getRawMany();

    return {
      byTier: brokersByTier.reduce((acc, item) => ({ ...acc, [item.tier]: parseInt(item.count) }), {}),
      byStatus: {}, // Would query broker status distribution
    };
  }

  private async getRecentPlatformActivity(): Promise<any[]> {
    // In a real implementation, this would query actual platform activity
    return [
      {
        type: 'NEW_BROKER',
        description: 'New broker registered: ABC Financial Services',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        type: 'COMPLIANCE_ALERT',
        description: 'Compliance issue detected for XYZ Investments',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
      },
    ];
  }

  private calculatePerformanceScore(uptime: number, successRate: number, avgResponseTime: number): number {
    // Simple performance score calculation
    const uptimeScore = uptime;
    const successScore = successRate;
    const responseScore = Math.max(0, 100 - (avgResponseTime / 10)); // Penalize slow responses

    return Math.round((uptimeScore + successScore + responseScore) / 3);
  }

  private async updateRealtimeMetrics(brokerId: string, metric: any): Promise<void> {
    const key = `realtime:${brokerId}:metrics`;

    // Add metric to a sorted set with timestamp as score
    await this.redis.zadd(key, Date.now(), JSON.stringify(metric));

    // Remove old metrics (keep only last 1000)
    await this.redis.zremrangebyrank(key, 0, -1001);

    // Set expiry
    await this.redis.expire(key, 300); // 5 minutes
  }

  private generatePDFReport(reportType: string, data: any, period: any): Buffer {
    // In a real implementation, this would use a PDF library like pdf-lib
    const reportContent = `
${reportType} Report
Period: ${period.start.toISOString()} to ${period.end.toISOString()}

${JSON.stringify(data, null, 2)}
    `.trim();

    return Buffer.from(reportContent, 'utf-8');
  }

  private generateCSVReport(data: any): Buffer {
    // Convert data to CSV format
    if (Array.isArray(data)) {
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => row[header]).join(',')),
      ].join('\n');

      return Buffer.from(csvContent, 'utf-8');
    } else {
      return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
    }
  }
}