import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RevenueAnalyticsService {
  private readonly logger = new Logger(RevenueAnalyticsService.name);
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getRevenueByRegion(period: { start: Date; end: Date }): Promise<{
    regions: Array<{
      region: string;
      totalRevenue: number;
      brokerCount: number;
      averageRevenue: number;
      growth: number;
    }>;
    totalRevenue: number;
    topRegion: string;
  }> {
    const cacheKey = `revenue:region:${period.start.toISOString()}:${period.end.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get revenue data with broker regions
      const revenueData = await this.prismaService.brokerBill.findMany({
        where: {
          status: 'PAID',
          createdAt: {
            gte: period.start,
            lte: period.end,
          },
        },
        include: {
          broker: {
            select: {
              id: true,
              region: true,
              businessName: true,
            },
          },
        },
      });

      const regionMap = new Map();

      revenueData.forEach(bill => {
        const region = bill.broker.region || 'Unknown';
        const revenue = bill.baseFee + bill.additionalServices + bill.transactionFees;

        if (!regionMap.has(region)) {
          regionMap.set(region, {
            region,
            totalRevenue: 0,
            brokerCount: new Set(),
          });
        }

        const regionData = regionMap.get(region);
        regionData.totalRevenue += revenue;
        regionData.brokerCount.add(bill.brokerId);
      });

      const regions = Array.from(regionMap.values()).map(regionData => ({
        region: regionData.region,
        totalRevenue: regionData.totalRevenue,
        brokerCount: regionData.brokerCount.size,
        averageRevenue: regionData.totalRevenue / regionData.brokerCount.size,
        growth: 0, // Would need previous period data for accurate growth
      }));

      const totalRevenue = regions.reduce((sum, region) => sum + region.totalRevenue, 0);
      const topRegion = regions.length > 0
        ? regions.reduce((top, current) => current.totalRevenue > top.totalRevenue ? current : top).region
        : '';

      const result = {
        regions,
        totalRevenue,
        topRegion,
      };

      await this.redisService.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
      this.logger.log(`Generated revenue by region for ${period.start.toISOString()} to ${period.end.toISOString()}`);

      return result;

    } catch (error) {
      this.logger.error('Failed to get revenue by region:', error);
      throw error;
    }
  }

  async getRevenueByTier(period: { start: Date; end: Date }): Promise<{
    tiers: Array<{
      tier: string;
      totalRevenue: number;
      brokerCount: number;
      averageRevenue: number;
      revenuePerBroker: number;
      growth: number;
    }>;
    totalRevenue: number;
    tierDistribution: Record<string, number>;
  }> {
    const cacheKey = `revenue:tier:${period.start.toISOString()}:${period.end.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const revenueData = await this.prismaService.brokerBill.findMany({
        where: {
          status: 'PAID',
          createdAt: {
            gte: period.start,
            lte: period.end,
          },
        },
        include: {
          broker: {
            select: {
              id: true,
              tier: true,
            },
          },
        },
      });

      const tierMap = new Map();

      revenueData.forEach(bill => {
        const tier = bill.broker.tier || 'STARTER';
        const revenue = bill.baseFee + bill.additionalServices + bill.transactionFees;

        if (!tierMap.has(tier)) {
          tierMap.set(tier, {
            tier,
            totalRevenue: 0,
            brokerCount: new Set(),
          });
        }

        const tierData = tierMap.get(tier);
        tierData.totalRevenue += revenue;
        tierData.brokerCount.add(bill.brokerId);
      });

      const tiers = Array.from(tierMap.values()).map(tierData => ({
        tier: tierData.tier,
        totalRevenue: tierData.totalRevenue,
        brokerCount: tierData.brokerCount.size,
        averageRevenue: tierData.totalRevenue / tierData.brokerCount.size,
        revenuePerBroker: tierData.totalRevenue / tierData.brokerCount.size,
        growth: 0, // Would need previous period data
      }));

      const totalRevenue = tiers.reduce((sum, tier) => sum + tier.totalRevenue, 0);

      const tierDistribution: Record<string, number> = {};
      tiers.forEach(tier => {
        tierDistribution[tier.tier] = totalRevenue > 0 ? (tier.totalRevenue / totalRevenue) * 100 : 0;
      });

      const result = {
        tiers,
        totalRevenue,
        tierDistribution,
      };

      await this.redisService.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
      return result;

    } catch (error) {
      this.logger.error('Failed to get revenue by tier:', error);
      throw error;
    }
  }

  async getRevenueByProduct(period: { start: Date; end: Date }): Promise<{
    products: Array<{
      product: string;
      totalRevenue: number;
      percentage: number;
      growth: number;
    }>;
    totalRevenue: number;
    productMix: Record<string, number>;
  }> {
    const cacheKey = `revenue:product:${period.start.toISOString()}:${period.end.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const revenueData = await this.prismaService.brokerBill.findMany({
        where: {
          status: 'PAID',
          createdAt: {
            gte: period.start,
            lte: period.end,
          },
        },
      });

      const products = {
        'Base Fees': revenueData.reduce((sum, bill) => sum + bill.baseFee, 0),
        'Transaction Fees': revenueData.reduce((sum, bill) => sum + bill.transactionFees, 0),
        'Additional Services': revenueData.reduce((sum, bill) => sum + bill.additionalServices, 0),
      };

      const totalRevenue = Object.values(products).reduce((sum, val) => sum + val, 0);

      const productArray = Object.entries(products).map(([product, revenue]) => ({
        product,
        totalRevenue: revenue,
        percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
        growth: 0, // Would need previous period data
      }));

      const result = {
        products: productArray,
        totalRevenue,
        productMix: products,
      };

      await this.redisService.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
      return result;

    } catch (error) {
      this.logger.error('Failed to get revenue by product:', error);
      throw error;
    }
  }

  async getRevenueGrowth(period: { start: Date; end: Date }): Promise<{
    currentPeriodRevenue: number;
    previousPeriodRevenue: number;
    growthRate: number;
    yearOverYear: number;
    monthOverMonth: number;
    trend: Array<{
      period: string;
      revenue: number;
      growth: number;
    }>;
  }> {
    try {
      const currentPeriodRevenue = await this.getTotalRevenue(period);

      // Calculate previous period (same length, immediately before)
      const periodLength = period.end.getTime() - period.start.getTime();
      const previousPeriodStart = new Date(period.start.getTime() - periodLength);
      const previousPeriodEnd = new Date(period.end.getTime() - periodLength);

      const previousPeriodRevenue = await this.getTotalRevenue({
        start: previousPeriodStart,
        end: previousPeriodEnd,
      });

      const growthRate = previousPeriodRevenue > 0
        ? ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : 0;

      // Calculate YoY (previous year)
      const yearAgoStart = new Date(period.start.getFullYear() - 1, period.start.getMonth(), period.start.getDate());
      const yearAgoEnd = new Date(period.end.getFullYear() - 1, period.end.getMonth(), period.end.getDate());

      const yearAgoRevenue = await this.getTotalRevenue({
        start: yearAgoStart,
        end: yearAgoEnd,
      });

      const yearOverYear = yearAgoRevenue > 0
        ? ((currentPeriodRevenue - yearAgoRevenue) / yearAgoRevenue) * 100
        : 0;

      // Get monthly trend for the last 12 months
      const trend = await this.getRevenueTrend(12);

      const monthOverMonth = trend.length >= 2
        ? ((trend[trend.length - 1].revenue - trend[trend.length - 2].revenue) / trend[trend.length - 2].revenue) * 100
        : 0;

      return {
        currentPeriodRevenue,
        previousPeriodRevenue,
        growthRate,
        yearOverYear,
        monthOverMonth,
        trend,
      };

    } catch (error) {
      this.logger.error('Failed to get revenue growth:', error);
      throw error;
    }
  }

  async getARPU(period: { start: Date; end: Date }): Promise<{
    overall: number;
    byTier: Record<string, number>;
    byRegion: Record<string, number>;
    trend: Array<{
      period: string;
      arpu: number;
    }>;
  }> {
    try {
      // Get overall ARPU (Average Revenue Per User/Broker)
      const totalRevenue = await this.getTotalRevenue(period);
      const activeBrokers = await this.getActiveBrokers(period);
      const overall = activeBrokers > 0 ? totalRevenue / activeBrokers : 0;

      // Get ARPU by tier
      const revenueByTier = await this.getRevenueByTier(period);
      const byTier: Record<string, number> = {};
      revenueByTier.tiers.forEach(tier => {
        byTier[tier.tier] = tier.averageRevenue;
      });

      // Get ARPU by region
      const revenueByRegion = await this.getRevenueByRegion(period);
      const byRegion: Record<string, number> = {};
      revenueByRegion.regions.forEach(region => {
        byRegion[region.region] = region.averageRevenue;
      });

      // Get ARPU trend
      const trend = await this.getARPUTrend(6);

      return {
        overall,
        byTier,
        byRegion,
        trend,
      };

    } catch (error) {
      this.logger.error('Failed to get ARPU:', error);
      throw error;
    }
  }

  async generateRevenueReport(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' | 'pdf' = 'json',
  ): Promise<any> {
    try {
      const period = { start: startDate, end: endDate };

      const reportData = {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        generatedAt: new Date().toISOString(),
        summary: {
          totalRevenue: await this.getTotalRevenue(period),
          activeBrokers: await this.getActiveBrokers(period),
          arpu: 0, // Will be calculated below
        },
        revenueByRegion: await this.getRevenueByRegion(period),
        revenueByTier: await this.getRevenueByTier(period),
        revenueByProduct: await this.getRevenueByProduct(period),
        growth: await this.getRevenueGrowth(period),
        arpu: await this.getARPU(period),
      };

      // Calculate overall ARPU
      reportData.summary.arpu = reportData.summary.activeBrokers > 0
        ? reportData.summary.totalRevenue / reportData.summary.activeBrokers
        : 0;

      if (format === 'csv') {
        return this.convertToCSV(reportData);
      } else if (format === 'pdf') {
        return this.convertToPDF(reportData);
      }

      return reportData;

    } catch (error) {
      this.logger.error('Failed to generate revenue report:', error);
      throw error;
    }
  }

  private async getTotalRevenue(period: { start: Date; end: Date }): Promise<number> {
    const revenueData = await this.prismaService.brokerBill.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: period.start,
          lte: period.end,
        },
      },
      select: {
        baseFee: true,
        transactionFees: true,
        additionalServices: true,
      },
    });

    return revenueData.reduce((sum, bill) => {
      return sum + bill.baseFee + bill.transactionFees + bill.additionalServices;
    }, 0);
  }

  private async getActiveBrokers(period: { start: Date; end: Date }): Promise<number> {
    const activeBrokers = await this.prismaService.brokerBill.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: period.start,
          lte: period.end,
        },
      },
      select: {
        brokerId: true,
      },
      distinct: ['brokerId'],
    });

    return activeBrokers.length;
  }

  private async getRevenueTrend(months: number): Promise<Array<{ period: string; revenue: number; growth: number }>> {
    const trend = [];
    const currentDate = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const periodDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const startOfMonth = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
      const endOfMonth = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0);

      const revenue = await this.getTotalRevenue({ start: startOfMonth, end: endOfMonth });
      const growth = i > 0
        ? ((revenue - trend[trend.length - 1].revenue) / trend[trend.length - 1].revenue) * 100
        : 0;

      trend.push({
        period: periodDate.toISOString().slice(0, 7),
        revenue,
        growth,
      });
    }

    return trend;
  }

  private async getARPUTrend(months: number): Promise<Array<{ period: string; arpu: number }>> {
    const trend = [];
    const currentDate = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const periodDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const startOfMonth = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
      const endOfMonth = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0);

      const period = { start: startOfMonth, end: endOfMonth };
      const totalRevenue = await this.getTotalRevenue(period);
      const activeBrokers = await this.getActiveBrokers(period);
      const arpu = activeBrokers > 0 ? totalRevenue / activeBrokers : 0;

      trend.push({
        period: periodDate.toISOString().slice(0, 7),
        arpu,
      });
    }

    return trend;
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion - in a real implementation, you'd want more sophisticated CSV generation
    const headers = ['Metric', 'Value', 'Details'];
    const rows = [
      ['Total Revenue', data.summary.totalRevenue.toFixed(2), 'ZAR'],
      ['Active Brokers', data.summary.activeBrokers.toString(), 'Count'],
      ['ARPU', data.summary.arpu.toFixed(2), 'ZAR per broker'],
      // Add more rows as needed
    ];

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToPDF(data: any): Buffer {
    // This would integrate with a PDF generation library like pdf-lib
    // For now, return a simple placeholder
    return Buffer.from(`Revenue Report\n\n${JSON.stringify(data, null, 2)}`);
  }
}