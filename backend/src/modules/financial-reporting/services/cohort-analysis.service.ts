import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class CohortAnalysisService {
  private readonly logger = new Logger(CohortAnalysisService.name);
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService) {}

  async analyzeCohort(cohortMonth: Date): Promise<{
    cohortMonth: string;
    totalBrokers: number;
    retention: Record<string, number>; // Month0, Month1, Month2, etc.
    revenueRetention: Record<string, number>;
    ltv: number;
    averageRevenue: number;
  }> {
    const cacheKey = `cohort:${cohortMonth.toISOString().slice(0, 7)}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get brokers who signed up in this cohort month
      const startOfMonth = new Date(cohortMonth.getFullYear(), cohortMonth.getMonth(), 1);
      const endOfMonth = new Date(cohortMonth.getFullYear(), cohortMonth.getMonth() + 1, 0);

      const cohortBrokers = await this.prismaService.broker.findMany({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        include: {
          bills: {
            where: {
              status: 'PAID'
            },
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      });

      const totalBrokers = cohortBrokers.length;

      if (totalBrokers === 0) {
        return {
          cohortMonth: cohortMonth.toISOString().slice(0, 7),
          totalBrokers: 0,
          retention: {},
          revenueRetention: {},
          ltv: 0,
          averageRevenue: 0
        };
      }

      // Calculate retention by month
      const retention: Record<string, number> = {};
      const revenueRetention: Record<string, number> = {};

      // Calculate retention for up to 12 months
      for (let monthOffset = 0; monthOffset <= 12; monthOffset++) {
        const checkDate = new Date(cohortMonth.getFullYear(), cohortMonth.getMonth() + monthOffset, 1);
        const checkDateEnd = new Date(cohortMonth.getFullYear(), cohortMonth.getMonth() + monthOffset + 1, 0);

        let activeBrokers = 0;
        let totalRevenue = 0;

        for (const broker of cohortBrokers) {
          // Check if broker has a paid bill in this month
          const monthlyBill = broker.bills.find(bill => {
            const billDate = new Date(bill.createdAt);
            return billDate >= checkDate && billDate <= checkDateEnd;
          });

          if (monthlyBill) {
            activeBrokers++;
            totalRevenue += monthlyBill.baseFee + monthlyBill.additionalServices;
          }
        }

        const retentionRate = (activeBrokers / totalBrokers) * 100;
        const revenueRetentionRate = totalRevenue > 0 ? (totalRevenue / totalBrokers) : 0;

        retention[`Month${monthOffset}`] = retentionRate;
        revenueRetention[`Month${monthOffset}`] = revenueRetentionRate;
      }

      // Calculate LTV (Lifetime Value)
      const ltv = this.calculateLTV(retention, revenueRetention);

      // Calculate average revenue per broker
      const totalRevenue = cohortBrokers.reduce((sum, broker) => {
        return sum + broker.bills.reduce((billSum, bill) => {
          return billSum + bill.baseFee + bill.additionalServices;
        }, 0);
      }, 0);

      const averageRevenue = totalRevenue / totalBrokers;

      const cohortData = {
        cohortMonth: cohortMonth.toISOString().slice(0, 7),
        totalBrokers,
        retention,
        revenueRetention,
        ltv,
        averageRevenue
      };

      await this.redisService.setex(cacheKey, this.CACHE_TTL, JSON.stringify(cohortData));
      this.logger.log(`Analyzed cohort ${cohortMonth.toISOString().slice(0, 7)}: ${totalBrokers} brokers`);

      return cohortData;

    } catch (error) {
      this.logger.error(`Failed to analyze cohort ${cohortMonth}:`, error);
      throw error;
    }
  }

  async getRetentionCurves(months: number = 12): Promise<{
    cohorts: Array<{
      cohortMonth: string;
      totalBrokers: number;
      retention: Record<string, number>;
    }>;
    averageRetention: Record<string, number>;
  }> {
    try {
      const cohorts = [];
      const currentDate = new Date();

      // Get cohort data for the last N months
      for (let i = months - 1; i >= 0; i--) {
        const cohortDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const cohortData = await this.analyzeCohort(cohortDate);

        cohorts.push({
          cohortMonth: cohortData.cohortMonth,
          totalBrokers: cohortData.totalBrokers,
          retention: cohortData.retention
        });
      }

      // Calculate average retention across all cohorts
      const averageRetention: Record<string, number> = {};
      const retentionKeys = cohorts.length > 0 ? Object.keys(cohorts[0].retention) : [];

      retentionKeys.forEach(key => {
        const sum = cohorts.reduce((total, cohort) => total + (cohort.retention[key] || 0), 0);
        averageRetention[key] = cohorts.length > 0 ? sum / cohorts.length : 0;
      });

      return {
        cohorts,
        averageRetention
      };

    } catch (error) {
      this.logger.error('Failed to get retention curves:', error);
      throw error;
    }
  }

  async getRevenueByAcquisitionChannel(): Promise<{
    channels: Array<{
      channel: string;
      totalRevenue: number;
      brokerCount: number;
      averageRevenue: number;
      ltv: number;
    }>;
    totalRevenue: number;
  }> {
    try {
      // This would require tracking acquisition channels
      // For now, return basic revenue data
      const brokers = await this.prismaService.broker.findMany({
        include: {
          bills: {
            where: {
              status: 'PAID'
            }
          }
        }
      });

      const channelMap = new Map();

      brokers.forEach(broker => {
        const channel = broker.metadata?.acquisitionChannel || 'Direct';

        if (!channelMap.has(channel)) {
          channelMap.set(channel, {
            channel,
            totalRevenue: 0,
            brokerCount: 0,
            revenue: []
          });
        }

        const channelData = channelMap.get(channel);
        const brokerRevenue = broker.bills.reduce((sum, bill) => sum + bill.baseFee + bill.additionalServices, 0);

        channelData.totalRevenue += brokerRevenue;
        channelData.brokerCount++;
        channelData.revenue.push(brokerRevenue);
      });

      const channels = Array.from(channelMap.values()).map(channelData => ({
        ...channelData,
        averageRevenue: channelData.totalRevenue / channelData.brokerCount,
        ltv: this.calculateSimpleLTV(channelData.revenue)
      }));

      const totalRevenue = channels.reduce((sum, channel) => sum + channel.totalRevenue, 0);

      return {
        channels,
        totalRevenue
      };

    } catch (error) {
      this.logger.error('Failed to get revenue by acquisition channel:', error);
      throw error;
    }
  }

  async getLTVByCohort(months: number = 12): Promise<{
    cohorts: Array<{
      cohortMonth: string;
      ltv: number;
      averageRevenue: number;
      retentionRate12Month: number;
    }>;
    averageLTV: number;
    trend: 'improving' | 'declining' | 'stable';
  }> {
    try {
      const cohorts = [];
      const currentDate = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const cohortDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const cohortData = await this.analyzeCohort(cohortDate);

        cohorts.push({
          cohortMonth: cohortData.cohortMonth,
          ltv: cohortData.ltv,
          averageRevenue: cohortData.averageRevenue,
          retentionRate12Month: cohortData.retention['Month12'] || 0
        });
      }

      // Calculate average LTV
      const averageLTV = cohorts.length > 0
        ? cohorts.reduce((sum, cohort) => sum + cohort.ltv, 0) / cohorts.length
        : 0;

      // Determine trend
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (cohorts.length >= 2) {
        const recent = cohorts.slice(-3).map(c => c.ltv);
        const earlier = cohorts.slice(0, 3).map(c => c.ltv);

        const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const earlierAvg = earlier.reduce((sum, val) => sum + val, 0) / earlier.length;

        if (recentAvg > earlierAvg * 1.05) {
          trend = 'improving';
        } else if (recentAvg < earlierAvg * 0.95) {
          trend = 'declining';
        }
      }

      return {
        cohorts,
        averageLTV,
        trend
      };

    } catch (error) {
      this.logger.error('Failed to get LTV by cohort:', error);
      throw error;
    }
  }

  private calculateLTV(retention: Record<string, number>, revenueRetention: Record<string, number>): number {
    // Simple LTV calculation: Average monthly revenue * average customer lifetime
    const averageMonthlyRevenue = Object.values(revenueRetention).reduce((sum, val) => sum + val, 0) / Object.keys(revenueRetention).length;

    // Estimate customer lifetime based on retention rates
    const retentionRates = Object.values(retention).filter((rate, index) => index > 0); // Exclude Month 0
    const averageRetentionRate = retentionRates.reduce((sum, rate) => sum + rate, 0) / retentionRates.length;

    // Estimate months a customer stays (simplified)
    const estimatedLifetime = averageRetentionRate > 0 ? 12 / (1 - averageRetentionRate / 100) : 12;

    return averageMonthlyRevenue * estimatedLifetime;
  }

  private calculateSimpleLTV(revenueValues: number[]): number {
    // Simple LTV calculation based on historical revenue
    if (revenueValues.length === 0) return 0;

    const totalRevenue = revenueValues.reduce((sum, val) => sum + val, 0);
    return totalRevenue / revenueValues.length * 12; // Annualized
  }
}
