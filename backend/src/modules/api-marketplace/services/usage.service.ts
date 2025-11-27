import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { UsageStats, ApiUsageLog } from '../interfaces/api-marketplace.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsageService {
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async logUsage(logData: ApiUsageLog): Promise<void> {
    await this.prisma.apiUsage.create({
      data: {
        apiKeyId: logData.apiKeyId,
        productId: logData.productId,
        path: logData.path,
        method: logData.method,
        statusCode: logData.statusCode,
        bytesIn: logData.bytesIn,
        bytesOut: logData.bytesOut,
        latencyMs: logData.latencyMs,
      },
    });

    // Update Redis counters for real-time analytics
    await this.updateRedisCounters(logData);
  }

  async getUsageStats(
    apiKeyId: string,
    dateRange?: { start: Date; end: Date },
    groupBy: 'hour' | 'day' | 'month' = 'day',
  ): Promise<UsageStats> {
    const cacheKey = `usage:stats:${apiKeyId}:${groupBy}:${dateRange?.start?.toISOString()}:${dateRange?.end?.toISOString()}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const where: any = { apiKeyId };
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    // Basic aggregations
    const [totalRequests, bandwidth, latency, statusCodes] = await Promise.all([
      this.prisma.apiUsage.count({ where }),
      this.prisma.apiUsage.aggregate({
        where,
        _sum: { bytesIn: true, bytesOut: true },
      }),
      this.prisma.apiUsage.aggregate({
        where,
        _avg: { latencyMs: true },
      }),
      this.prisma.apiUsage.groupBy({
        by: ['statusCode'],
        where,
        _count: { id: true },
      }),
    ]);

    // Top endpoints
    const topEndpoints = await this.prisma.apiUsage.groupBy({
      by: ['path', 'method'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Time series data based on groupBy
    let requestsByHour = [];
    if (groupBy === 'hour') {
      requestsByHour = await this.prisma.$queryRaw`
        SELECT
          DATE_TRUNC('hour', "createdAt") as hour,
          COUNT(*) as count
        FROM "ApiUsage"
        WHERE "apiKeyId" = ${apiKeyId}
        ${dateRange ? Prisma.sql`AND "createdAt" >= ${dateRange.start} AND "createdAt" <= ${dateRange.end}` : Prisma.empty}
        GROUP BY DATE_TRUNC('hour', "createdAt")
        ORDER BY hour DESC
        LIMIT 168
      `;
    } else if (groupBy === 'day') {
      requestsByHour = await this.prisma.$queryRaw`
        SELECT
          DATE_TRUNC('day', "createdAt") as hour,
          COUNT(*) as count
        FROM "ApiUsage"
        WHERE "apiKeyId" = ${apiKeyId}
        ${dateRange ? Prisma.sql`AND "createdAt" >= ${dateRange.start} AND "createdAt" <= ${dateRange.end}` : Prisma.empty}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY hour DESC
        LIMIT 90
      `;
    }

    const totalBandwidth = (bandwidth._sum.bytesIn || 0) + (bandwidth._sum.bytesOut || 0);
    const errorCount = statusCodes
      .filter(s => s.statusCode >= 400)
      .reduce((sum, s) => sum + s._count.id, 0);
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const stats: UsageStats = {
      totalRequests,
      totalBandwidth,
      averageLatency: latency._avg.latencyMs || 0,
      errorRate,
      topEndpoints: topEndpoints.map(e => ({
        path: e.path,
        count: e._count.id,
      })),
      requestsByHour: requestsByHour.map((r: any) => ({
        hour: r.hour,
        count: Number(r.count),
      })),
      statusCodeDistribution: statusCodes.reduce((acc, curr) => {
        acc[curr.statusCode] = curr._count.id;
        return acc;
      }, {} as Record<string, number>),
    };

    // Cache the result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats));

    return stats;
  }

  async getProductUsage(
    productId: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<UsageStats> {
    const where: any = { productId };
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const [totalRequests, bandwidth, latency, statusCodes] = await Promise.all([
      this.prisma.apiUsage.count({ where }),
      this.prisma.apiUsage.aggregate({
        where,
        _sum: { bytesIn: true, bytesOut: true },
      }),
      this.prisma.apiUsage.aggregate({
        where,
        _avg: { latencyMs: true },
      }),
      this.prisma.apiUsage.groupBy({
        by: ['statusCode'],
        where,
        _count: { id: true },
      }),
    ]);

    const topEndpoints = await this.prisma.apiUsage.groupBy({
      by: ['path', 'method'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const totalBandwidth = (bandwidth._sum.bytesIn || 0) + (bandwidth._sum.bytesOut || 0);
    const errorCount = statusCodes
      .filter(s => s.statusCode >= 400)
      .reduce((sum, s) => sum + s._count.id, 0);
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    return {
      totalRequests,
      totalBandwidth,
      averageLatency: latency._avg.latencyMs || 0,
      errorRate,
      topEndpoints: topEndpoints.map(e => ({
        path: e.path,
        count: e._count.id,
      })),
      requestsByHour: [],
      statusCodeDistribution: statusCodes.reduce((acc, curr) => {
        acc[curr.statusCode] = curr._count.id;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async getUserUsage(
    userId: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<{ totalRequests: number; totalCost: number; breakdown: Array<{ product: string; requests: number; cost: number }> }> {
    const where: any = {
      apiKey: {
        userId,
        revoked: false,
      },
    };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    // Get usage by product
    const usageByProduct = await this.prisma.apiUsage.groupBy({
      by: ['productId'],
      where,
      _count: { id: true },
    });

    const breakdown = [];
    let totalRequests = 0;
    let totalCost = 0;

    for (const usage of usageByProduct) {
      const product = await this.prisma.apiProduct.findUnique({
        where: { id: usage.productId },
        include: {
          plans: {
            include: {
              _count: {
                select: {
                  apiKeys: {
                    where: {
                      userId,
                      revoked: false,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (product) {
        const requests = usage._count.id;
        totalRequests += requests;

        // Calculate cost based on plan
        let cost = 0;
        for (const plan of product.plans) {
          if (plan._count.apiKeys > 0) {
            if (plan.perCallFee) {
              cost = Number(plan.perCallFee) * requests;
            } else if (plan.monthlyFee > 0) {
              cost = Number(plan.monthlyFee); // Simplified - monthly fee divided by usage
            }
            break;
          }
        }

        totalCost += cost;
        breakdown.push({
          product: product.name,
          requests,
          cost,
        });
      }
    }

    return {
      totalRequests,
      totalCost,
      breakdown,
    };
  }

  async exportUsageReport(
    filters: {
      apiKeyId?: string;
      productId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    format: 'csv' | 'json' = 'csv',
  ): Promise<string> {
    const where: any = {};

    if (filters.apiKeyId) where.apiKeyId = filters.apiKeyId;
    if (filters.productId) where.productId = filters.productId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const usage = await this.prisma.apiUsage.findMany({
      where,
      include: {
        apiKey: {
          select: {
            label: true,
            user: {
              select: { email: true },
            },
            broker: {
              select: { companyName: true },
            },
          },
        },
        product: {
          select: {
            name: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit for export
    });

    if (format === 'json') {
      return JSON.stringify(usage, null, 2);
    }

    // CSV format
    const headers = [
      'Timestamp',
      'API Key Label',
      'User/Broker',
      'Product',
      'Method',
      'Path',
      'Status Code',
      'Latency (ms)',
      'Bytes In',
      'Bytes Out',
    ];

    const rows = usage.map(u => [
      u.createdAt.toISOString(),
      u.apiKey.label || 'N/A',
      u.apiKey.user?.email || u.apiKey.broker?.companyName || 'N/A',
      u.product.name,
      u.method,
      u.path,
      u.statusCode,
      u.latencyMs,
      u.bytesIn,
      u.bytesOut,
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private async updateRedisCounters(logData: ApiUsageLog): Promise<void> {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Increment various counters
    const counters = [
      `api:usage:${logData.apiKeyId}`,
      `api:usage:${logData.productId}`,
      `api:usage:daily:${dateKey}`,
      `api:usage:product:${logData.productId}:${dateKey}`,
    ];

    for (const counter of counters) {
      await this.redis.incr(counter);
      await this.redis.expire(counter, 86400 * 30); // 30 days
    }

    // Track endpoints
    const endpointKey = `api:endpoints:${logData.apiKeyId}`;
    await this.redis.hincrby(endpointKey, `${logData.method}:${logData.path}`, 1);
    await this.redis.expire(endpointKey, 86400 * 7); // 7 days

    // Track status codes
    const statusKey = `api:status:${logData.productId}:${dateKey}`;
    await this.redis.hincrby(statusKey, logData.statusCode.toString(), 1);
    await this.redis.expire(statusKey, 86400 * 30);
  }

  async getUserUsageStats(
    userId: string | undefined,
    brokerId: string | undefined,
    dateRange?: { start: Date; end: Date },
    groupBy: 'hour' | 'day' | 'month' = 'day',
  ): Promise<UsageStats> {
    const cacheKey = `usage:user:${userId || brokerId}:${groupBy}:${dateRange?.start?.toISOString()}:${dateRange?.end?.toISOString()}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const where: any = {};
    if (userId) {
      where.apiKey = { userId };
    }
    if (brokerId) {
      where.apiKey = { brokerId };
    }

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const [totalRequests, bandwidth, latency, statusCodes] = await Promise.all([
      this.prisma.apiUsage.count({ where }),
      this.prisma.apiUsage.aggregate({
        where,
        _sum: { bytesIn: true, bytesOut: true },
      }),
      this.prisma.apiUsage.aggregate({
        where,
        _avg: { latencyMs: true },
      }),
      this.prisma.apiUsage.groupBy({
        by: ['statusCode'],
        where,
        _count: { id: true },
      }),
    ]);

    const topEndpoints = await this.prisma.apiUsage.groupBy({
      by: ['path', 'method'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const totalBandwidth = (bandwidth._sum.bytesIn || 0) + (bandwidth._sum.bytesOut || 0);
    const errorCount = statusCodes
      .filter(s => s.statusCode >= 400)
      .reduce((sum, s) => sum + s._count.id, 0);
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const stats: UsageStats = {
      totalRequests,
      totalBandwidth,
      averageLatency: latency._avg.latencyMs || 0,
      errorRate,
      topEndpoints: topEndpoints.map(e => ({
        path: e.path,
        count: e._count.id,
      })),
      requestsByHour: [],
      statusCodeDistribution: statusCodes.reduce((acc, curr) => {
        acc[curr.statusCode] = curr._count.id;
        return acc;
      }, {} as Record<string, number>),
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats));
    return stats;
  }

  async getProductUsageStats(
    productId: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<any> {
    const where: any = { productId };
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const [totalRequests, uniqueKeys, topEndpoints] = await Promise.all([
      this.prisma.apiUsage.count({ where }),
      this.prisma.apiUsage.groupBy({
        by: ['apiKeyId'],
        where,
        _count: { id: true },
      }),
      this.prisma.apiUsage.groupBy({
        by: ['path', 'method'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalRequests,
      uniqueKeys: uniqueKeys.length,
      topEndpoints: topEndpoints.map(e => ({
        path: e.path,
        method: e.method,
        count: e._count.id,
      })),
    };
  }

  async getPlatformUsageOverview(
    dateRange?: { start: Date; end: Date },
  ): Promise<any> {
    const where: any = {};
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const [totalRequests, uniqueKeys, totalUsers, totalBrokers, topProducts] = await Promise.all([
      this.prisma.apiUsage.count({ where }),
      this.prisma.apiUsage.groupBy({
        by: ['apiKeyId'],
        where,
      }),
      this.prisma.apiUsage.findMany({
        where,
        distinct: ['apiKeyId'],
        include: {
          apiKey: {
            select: {
              userId: true,
            },
          },
        },
      }),
      this.prisma.apiUsage.findMany({
        where,
        distinct: ['apiKeyId'],
        include: {
          apiKey: {
            select: {
              brokerId: true,
            },
          },
        },
      }),
      this.prisma.apiUsage.groupBy({
        by: ['productId'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    const usersCount = new Set(totalUsers.map(u => u.apiKey.userId).filter(Boolean)).size;
    const brokersCount = new Set(totalBrokers.map(u => u.apiKey.brokerId).filter(Boolean)).size;

    return {
      totalRequests,
      uniqueKeys: uniqueKeys.length,
      totalUsers: usersCount,
      totalBrokers: brokersCount,
      topProducts: topProducts.slice(0, 5),
    };
  }

  async getTopEndpoints(
    dateRange?: { start: Date; end: Date },
    limit: number = 10,
  ): Promise<any[]> {
    const where: any = {};
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const topEndpoints = await this.prisma.apiUsage.groupBy({
      by: ['path', 'method', 'productId'],
      where,
      _count: { id: true },
      _avg: { latencyMs: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const productIds = [...new Set(topEndpoints.map(e => e.productId))];
    const products = await this.prisma.apiProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: true },
    });

    const productMap = products.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, any>);

    return topEndpoints.map(endpoint => ({
      path: endpoint.path,
      method: endpoint.method,
      count: endpoint._count.id,
      averageLatency: endpoint._avg.latencyMs || 0,
      product: productMap[endpoint.productId]?.name || 'Unknown',
      category: productMap[endpoint.productId]?.category || 'Unknown',
    }));
  }

  async getErrorAnalysis(
    dateRange?: { start: Date; end: Date },
  ): Promise<any> {
    const where: any = {
      statusCode: { gte: 400 },
    };
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const [errorsByStatus, errorsByEndpoint, recentErrors] = await Promise.all([
      this.prisma.apiUsage.groupBy({
        by: ['statusCode'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.apiUsage.groupBy({
        by: ['path', 'method'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.apiUsage.findMany({
        where,
        include: {
          apiKey: {
            select: {
              label: true,
              user: { select: { email: true } },
              broker: { select: { companyName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      errorsByStatus,
      errorsByEndpoint: errorsByEndpoint.map(e => ({
        path: e.path,
        method: e.method,
        count: e._count.id,
      })),
      recentErrors: recentErrors.map(e => ({
        timestamp: e.createdAt,
        statusCode: e.statusCode,
        path: e.path,
        method: e.method,
        apiKeyLabel: e.apiKey.label,
        user: e.apiKey.user?.email || e.apiKey.broker?.companyName,
      })),
    };
  }

  async getQuotaAlerts(): Promise<any[]> {
    const keysWithQuota = await this.prisma.apiKey.findMany({
      where: {
        revoked: false,
        plan: {
          quota: { not: null },
        },
      },
      include: {
        plan: {
          select: { quota: true },
        },
        user: {
          select: { email: true, firstName: true },
        },
        broker: {
          select: { companyName: true, contactEmail: true },
        },
      },
    });

    const alerts = [];
    for (const key of keysWithQuota) {
      const usagePercentage = (key.usageCount / key.plan.quota) * 100;
      if (usagePercentage >= 80) {
        alerts.push({
          keyId: key.id,
          keyLabel: key.label,
          usageCount: key.usageCount,
          quota: key.plan.quota,
          usagePercentage: Math.round(usagePercentage),
          quotaResetAt: key.quotaResetAt,
          user: key.user?.email || key.broker?.contactEmail,
          severity: usagePercentage >= 95 ? 'critical' : usagePercentage >= 90 ? 'high' : 'warning',
        });
      }
    }

    return alerts.sort((a, b) => b.usagePercentage - a.usagePercentage);
  }

  async getUserInvoices(
    userId: string | undefined,
    brokerId: string | undefined,
    status?: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<any> {
    const where: any = {};
    if (userId) {
      where.customerId = userId;
      where.customerType = 'USER';
    }
    if (brokerId) {
      where.customerId = brokerId;
      where.customerType = 'BROKER';
    }
    if (status) {
      where.status = status;
    }

    const [invoices, total] = await Promise.all([
      this.prisma.apiInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.apiInvoice.count({ where }),
    ]);

    return {
      invoices,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getInvoice(
    invoiceId: string,
    userId: string | undefined,
    brokerId: string | undefined,
  ): Promise<any> {
    const where: any = { id: invoiceId };
    if (userId) {
      where.customerId = userId;
      where.customerType = 'USER';
    }
    if (brokerId) {
      where.customerId = brokerId;
      where.customerType = 'BROKER';
    }

    return this.prisma.apiInvoice.findFirst({ where });
  }

  async payInvoice(
    invoiceId: string,
    userId: string | undefined,
    brokerId: string | undefined,
    paymentMethod: string,
  ): Promise<any> {
    const invoice = await this.getInvoice(invoiceId, userId, brokerId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // This would integrate with actual payment providers
    return {
      success: true,
      paymentUrl: `https://payment.provider.com/pay/${invoiceId}?method=${paymentMethod}`,
      message: 'Payment initiated successfully',
    };
  }

  async downloadInvoicePdf(
    invoiceId: string,
    userId: string | undefined,
    brokerId: string | undefined,
  ): Promise<any> {
    const invoice = await this.getInvoice(invoiceId, userId, brokerId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return {
      pdfUrl: invoice.invoicePdfUrl || `/invoices/${invoiceId}/pdf`,
      message: 'Invoice PDF generated successfully',
    };
  }

  async getBillingUsageSummary(
    userId: string | undefined,
    brokerId: string | undefined,
    dateRange?: { start: Date; end: Date },
  ): Promise<any> {
    return this.getUserUsage(userId || '', brokerId || '', dateRange);
  }

  async getAvailablePaymentMethods(): Promise<any[]> {
    return [
      { id: 'paystack', name: 'Paystack', description: 'Nigerian card payments', currencies: ['NGN', 'USD'] },
      { id: 'payfast', name: 'PayFast', description: 'South African payments', currencies: ['ZAR', 'USD'] },
      { id: 'ozow', name: 'Ozow', description: 'Instant EFT', currencies: ['ZAR'] },
    ];
  }

  async getPlatformBillingOverview(
    dateRange?: { start: Date; end: Date },
  ): Promise<any> {
    const where: any = {};
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const [totalRevenue, pendingInvoices, paidInvoices, overdueInvoices] = await Promise.all([
      this.prisma.apiInvoice.aggregate({
        where,
        _sum: { amountDue: true },
      }),
      this.prisma.apiInvoice.count({
        where: { ...where, status: 'PENDING' },
      }),
      this.prisma.apiInvoice.count({
        where: { ...where, status: 'PAID' },
      }),
      this.prisma.apiInvoice.count({
        where: { ...where, status: 'OVERDUE' },
      }),
    ]);

    return {
      totalRevenue: totalRevenue._sum.amountDue || 0,
      pendingInvoices,
      paidInvoices,
      overdueInvoices,
    };
  }

  async generateInvoice(data: any): Promise<any> {
    return this.prisma.apiInvoice.create({
      data: {
        customerId: data.customerId,
        customerType: data.customerType,
        billingPeriodStart: new Date(data.billingPeriodStart),
        billingPeriodEnd: new Date(data.billingPeriodEnd),
        amountDue: data.amount || 0,
        status: 'PENDING',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        metadata: data.customItems || {},
      },
    });
  }

  async getRevenueAnalytics(
    dateRange?: { start: Date; end: Date },
    groupBy: string = 'month',
  ): Promise<any> {
    const where: any = { status: 'PAID' };
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const revenue = await this.prisma.apiInvoice.groupBy({
      by: ['createdAt'],
      where,
      _sum: { amountDue: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      revenue: revenue.map(r => ({
        date: r.createdAt,
        amount: r._sum.amountDue || 0,
      })),
    };
  }

  async getOverdueInvoices(limit: number = 50, offset: number = 0): Promise<any> {
    const [invoices, total] = await Promise.all([
      this.prisma.apiInvoice.findMany({
        where: {
          status: 'OVERDUE',
          dueDate: { lt: new Date() },
        },
        include: {
          // Include customer details based on type
        },
        orderBy: { dueDate: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.apiInvoice.count({
        where: {
          status: 'OVERDUE',
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    return {
      invoices,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit),
      },
    };
  }
}