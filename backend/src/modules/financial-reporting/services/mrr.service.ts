import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class MrrService {
  private readonly logger = new Logger(MrrService.name);
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService) {}

  async calculateMRR(date: Date): Promise<{
    total: number;
    byTier: Record<string, number>;
    components: {
      baseFee: number;
      transactionFees: number;
      additionalServices: number;
    };
  }> {
    const cacheKey = `mrr:${date.toISOString().split('T')[0]}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Calculate MRR for the given month
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      // Get paid bills for the month
      const paidBills = await this.prismaService.brokerBill.findMany({
        where: {
          status: 'PAID',
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        include: {
          broker: {
            select: {
              tier: true
            }
          }
        }
      });

      // Calculate MRR by tier
      const mrrByTier: Record<string, number> = {};
      let totalMRR = 0;
      let baseFeeTotal = 0;
      let transactionFeesTotal = 0;
      let additionalServicesTotal = 0;

      paidBills.forEach((bill) => {
        const tier = bill.broker.tier || 'STARTER';

        if (!mrrByTier[tier]) {
          mrrByTier[tier] = 0;
        }

        // Only include recurring revenue (base fees and recurring services)
        const recurringAmount = bill.baseFee + bill.additionalServices;
        mrrByTier[tier] += recurringAmount;
        totalMRR += recurringAmount;

        // Track components for analysis
        baseFeeTotal += bill.baseFee;
        transactionFeesTotal += bill.transactionFees;
        additionalServicesTotal += bill.additionalServices;
      });

      const mrrData = {
        total: totalMRR,
        byTier: mrrByTier,
        components: {
          baseFee: baseFeeTotal,
          transactionFees: transactionFeesTotal,
          additionalServices: additionalServicesTotal
        }
      };

      await this.redisService.setex(cacheKey, this.CACHE_TTL, JSON.stringify(mrrData));
      this.logger.log(`Calculated MRR for ${date.toISOString()}: R${totalMRR.toFixed(2)}`);

      return mrrData;

    } catch (error) {
      this.logger.error(`Failed to calculate MRR for ${date}:`, error);
      throw error;
    }
  }

  async getMRRGrowth(startDate: Date, endDate: Date): Promise<{
    currentPeriod: number;
    previousPeriod: number;
    growthRate: number;
    monthlyData: Array<{
      month: string;
      mrr: number;
      growth: number;
    }>;
  }> {
    const months = this.getMonthsBetweenDates(startDate, endDate);
    const monthlyData = [];

    for (const month of months) {
      const mrrData = await this.calculateMRR(month);
      monthlyData.push({
        month: month.toISOString().slice(0, 7), // YYYY-MM format
        mrr: mrrData.total,
        growth: 0 // Will be calculated below
      });
    }

    // Calculate growth rates
    for (let i = 1; i < monthlyData.length; i++) {
      const previousMRR = monthlyData[i - 1].mrr;
      const currentMRR = monthlyData[i].mrr;
      monthlyData[i].growth = previousMRR > 0 ? ((currentMRR - previousMRR) / previousMRR) * 100 : 0;
    }

    const currentPeriod = monthlyData[monthlyData.length - 1]?.mrr || 0;
    const previousPeriod = monthlyData[monthlyData.length - 2]?.mrr || 0;
    const growthRate = previousPeriod > 0 ? ((currentPeriod - previousPeriod) / previousPeriod) * 100 : 0;

    return {
      currentPeriod,
      previousPeriod,
      growthRate,
      monthlyData
    };
  }

  async getMRRByTier(): Promise<{
    tiers: Record<string, number>;
    percentages: Record<string, number>;
    total: number;
  }> {
    const currentDate = new Date();
    const mrrData = await this.calculateMRR(currentDate);
    const total = mrrData.total;

    const percentages: Record<string, number> = {};
    Object.entries(mrrData.byTier).forEach(([tier, amount]) => {
      percentages[tier] = total > 0 ? (amount / total) * 100 : 0;
    });

    return {
      tiers: mrrData.byTier,
      percentages,
      total
    };
  }

  async getMRRChurn(month: Date): Promise<{
    churnedMRR: number;
    churnRate: number;
    churnedBrokers: number;
    details: Array<{
      brokerId: string;
      brokerName: string;
      mrrAmount: number;
      churnReason?: string;
    }>;
  }> {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    // Get brokers who churned (became inactive/suspended) this month
    const churnedBrokers = await this.prismaService.broker.findMany({
      where: {
        OR: [
          {
            status: 'SUSPENDED',
            updatedAt: {
              gte: startOfMonth,
              lte: endOfMonth
            }
          },
          {
            isActive: false,
            updatedAt: {
              gte: startOfMonth,
              lte: endOfMonth
            }
          },
        ]
      },
      include: {
        bills: {
          where: {
            status: 'PAID',
            createdAt: {
              lt: startOfMonth
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    let totalChurnedMRR = 0;
    const details = [];

    for (const broker of churnedBrokers) {
      const lastBill = broker.bills[0];
      if (lastBill) {
        const mrrAmount = lastBill.baseFee + lastBill.additionalServices;
        totalChurnedMRR += mrrAmount;

        details.push({
          brokerId: broker.id,
          brokerName: broker.businessName || broker.name,
          mrrAmount,
          churnReason: broker.status === 'SUSPENDED' ? 'Payment suspension' : 'Account deactivated'
        });
      }
    }

    // Calculate churn rate
    const previousMonthMRR = await this.calculateMRR(
      new Date(month.getFullYear(), month.getMonth() - 1, 1)
    );

    const churnRate = previousMonthMRR.total > 0 ? (totalChurnedMRR / previousMonthMRR.total) * 100 : 0;

    this.logger.log(`MRR Churn for ${month.toISOString().slice(0, 7)}: R${totalChurnedMRR.toFixed(2)} (${churnRate.toFixed(2)}%)`);

    return {
      churnedMRR: totalChurnedMRR,
      churnRate,
      churnedBrokers: churnedBrokers.length,
      details
    };
  }

  async getNewMRR(month: Date): Promise<{
    newMRR: number;
    newBrokers: number;
    averageMRRPerBroker: number;
    details: Array<{
      brokerId: string;
      brokerName: string;
      mrrAmount: number;
      tier: string;
    }>;
  }> {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    // Get new brokers who started this month
    const newBrokers = await this.prismaService.broker.findMany({
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
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    let totalNewMRR = 0;
    const details = [];

    for (const broker of newBrokers) {
      const firstBill = broker.bills[0];
      if (firstBill) {
        const mrrAmount = firstBill.baseFee + firstBill.additionalServices;
        totalNewMRR += mrrAmount;

        details.push({
          brokerId: broker.id,
          brokerName: broker.businessName || broker.name,
          mrrAmount,
          tier: broker.tier
        });
      }
    }

    const averageMRRPerBroker = newBrokers.length > 0 ? totalNewMRR / newBrokers.length : 0;

    this.logger.log(`New MRR for ${month.toISOString().slice(0, 7)}: R${totalNewMRR.toFixed(2)} from ${newBrokers.length} brokers`);

    return {
      newMRR: totalNewMRR,
      newBrokers: newBrokers.length,
      averageMRRPerBroker,
      details
    };
  }

  async getExpansionMRR(month: Date): Promise<{
    expansionMRR: number;
    expansionBrokers: number;
    details: Array<{
      brokerId: string;
      brokerName: string;
      oldMRR: number;
      newMRR: number;
      expansionAmount: number;
      tier: string;
    }>;
  }> {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);

    // Get brokers who expanded (tier upgrade or additional services)
    const currentMonthBills = await this.prismaService.brokerBill.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        broker: {
          select: {
            id: true,
            businessName: true,
            name: true,
            tier: true
          }
        }
      }
    });

    const previousMonthBills = await this.prismaService.brokerBill.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1),
          lte: new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0)
        }
      },
      include: {
        broker: {
          select: {
            id: true
          }
        }
      }
    });

    // Create a map of previous month MRR by broker
    const previousMRRMap = new Map();
    previousMonthBills.forEach((bill) => {
      const mrr = bill.baseFee + bill.additionalServices;
      previousMRRMap.set(bill.brokerId, mrr);
    });

    let totalExpansionMRR = 0;
    const details = [];

    for (const currentBill of currentMonthBills) {
      const previousMRR = previousMRRMap.get(currentBill.brokerId) || 0;
      const currentMRR = currentBill.baseFee + currentBill.additionalServices;
      const expansionAmount = currentMRR - previousMRR;

      if (expansionAmount > 0) {
        totalExpansionMRR += expansionAmount;
        details.push({
          brokerId: currentBill.brokerId,
          brokerName: currentBill.broker.businessName || currentBill.broker.name,
          oldMRR: previousMRR,
          newMRR: currentMRR,
          expansionAmount,
          tier: currentBill.broker.tier
        });
      }
    }

    this.logger.log(`Expansion MRR for ${month.toISOString().slice(0, 7)}: R${totalExpansionMRR.toFixed(2)}`);

    return {
      expansionMRR: totalExpansionMRR,
      expansionBrokers: details.length,
      details
    };
  }

  private getMonthsBetweenDates(startDate: Date, endDate: Date): Date[] {
    const months = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      months.push(new Date(currentDate));
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months;
  }
}
