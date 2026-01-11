import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { MrrService } from "./mrr.service";

@Injectable()
export class NrrService {
  private readonly logger = new Logger(NrrService.name);
  private readonly CACHE_TTL = 21600; // 6 hours

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly mrrService: MrrService) {}

  async calculateNRR(
    startDate: Date,
    endDate: Date): Promise<{
    startingMRR: number;
    endingMRR: number;
    expansionMRR: number;
    churnedMRR: number;
    contractionMRR: number;
    nrr: number;
    nrrPercentage: number;
  }> {
    const cacheKey = `nrr:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get MRR data for the period
      const startMRRData = await this.mrrService.calculateMRR(startDate);
      const endMRRData = await this.mrrService.calculateMRR(endDate);

      // Get expansion and churn data
      const expansionData = await this.mrrService.getExpansionMRR(endDate);
      const churnData = await this.mrrService.getMRRChurn(endDate);

      // Calculate contraction (downgrades)
      const contractionMRR = await this.calculateContractionMRR(startDate, endDate);

      const startingMRR = startMRRData.total;
      const endingMRR = endMRRData.total;
      const expansionMRR = expansionData.expansionMRR;
      const churnedMRR = churnData.churnedMRR;

      // NRR = (Starting MRR + Expansion MRR - Churned MRR - Contraction MRR) / Starting MRR * 100
      const nrr =
        startingMRR > 0
          ? ((startingMRR + expansionMRR - churnedMRR - contractionMRR) / startingMRR) * 100
          : 100;

      const nrrData = {
        startingMRR,
        endingMRR,
        expansionMRR,
        churnedMRR,
        contractionMRR,
        nrr,
        nrrPercentage: nrr
      };

      await this.redisService.setex(cacheKey, this.CACHE_TTL, JSON.stringify(nrrData));
      this.logger.log(`Calculated NRR for ${startDate.toISOString()} to ${endDate.toISOString()}: ${nrr.toFixed(2)}%`);

      return nrrData;

    } catch (error) {
      this.logger.error(`Failed to calculate NRR:`, error);
      throw error;
    }
  }

  async getNRRBySegment(
    segment: 'tier' | 'region' | 'acquisitionChannel',
    startDate: Date,
    endDate: Date): Promise<{
    segment: string;
    nrr: number;
    startingMRR: number;
    expansionMRR: number;
    churnedMRR: number;
    contractionMRR: number;
    segments: Array<{
      value: string;
      nrr: number;
      startingMRR: number;
      expansionMRR: number;
      churnedMRR: number;
      contractionMRR: number;
    }>;
  }> {
    try {
      let segments: Array<{
        value: string;
        nrr: number;
        startingMRR: number;
        expansionMRR: number;
        churnedMRR: number;
        contractionMRR: number;
      }> = [];

      if (segment === 'tier') {
        segments = await this.getNRRByTier(startDate, endDate);
      } else if (segment === 'region') {
        segments = await this.getNRRByRegion(startDate, endDate);
      } else if (segment === 'acquisitionChannel') {
        segments = await this.getNRRByAcquisitionChannel(startDate, endDate);
      }

      // Calculate overall NRR for this segment
      const totalStartingMRR = segments.reduce((sum, s) => sum + s.startingMRR, 0);
      const totalExpansionMRR = segments.reduce((sum, s) => sum + s.expansionMRR, 0);
      const totalChurnedMRR = segments.reduce((sum, s) => sum + s.churnedMRR, 0);
      const totalContractionMRR = segments.reduce((sum, s) => sum + s.contractionMRR, 0);

      const overallNRR =
        totalStartingMRR > 0
          ? ((totalStartingMRR + totalExpansionMRR - totalChurnedMRR - totalContractionMRR) / totalStartingMRR) * 100
          : 100;

      return {
        segment,
        nrr: overallNRR,
        startingMRR: totalStartingMRR,
        expansionMRR: totalExpansionMRR,
        churnedMRR: totalChurnedMRR,
        contractionMRR: totalContractionMRR,
        segments
      };

    } catch (error) {
      this.logger.error(`Failed to get NRR by segment ${segment}:`, error);
      throw error;
    }
  }

  async getNRRTrend(months: number = 12): Promise<{
    trend: Array<{
      period: string;
      nrr: number;
      startingMRR: number;
      expansionMRR: number;
      churnedMRR: number;
      contractionMRR: number;
    }>;
    averageNRR: number;
    bestMonth: {
      period: string;
      nrr: number;
    };
    worstMonth: {
      period: string;
      nrr: number;
    };
  }> {
    try {
      const endDate = new Date();
      const trend = [];

      for (let i = months - 1; i >= 0; i--) {
        const periodDate = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
        const nrrData = await this.calculateNRR(
          new Date(periodDate.getFullYear(), periodDate.getMonth(), 1),
          new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0));

        trend.push({
          period: periodDate.toISOString().slice(0, 7), // YYYY-MM
          ...nrrData
        });
      }

      // Calculate average NRR
      const averageNRR = trend.length > 0 ? trend.reduce((sum, t) => sum + t.nrr, 0) / trend.length : 0;

      // Find best and worst months
      const bestMonth = trend.reduce((best, current) => (current.nrr > best.nrr ? current : best), trend[0]);
      const worstMonth = trend.reduce((worst, current) => (current.nrr < worst.nrr ? current : worst), trend[0]);

      return {
        trend,
        averageNRR,
        bestMonth,
        worstMonth
      };

    } catch (error) {
      this.logger.error('Failed to get NRR trend:', error);
      throw error;
    }
  }

  private async calculateContractionMRR(startDate: Date, endDate: Date): Promise<number> {
    // Get brokers who downgraded their tier or reduced services
    const previousMonth = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
    const previousMonthEnd = new Date(startDate.getFullYear(), startDate.getMonth(), 0);

    // Get broker bills for previous month
    const previousBills = await this.prismaService.brokerBill.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: previousMonth,
          lte: previousMonthEnd
        }
      },
      include: {
        broker: {
          select: {
            id: true,
            tier: true
          }
        }
      }
    });

    // Get broker bills for current period
    const currentBills = await this.prismaService.brokerBill.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        broker: {
          select: {
            id: true,
            tier: true
          }
        }
      }
    });

    // Create maps of MRR by broker
    const previousMRRMap = new Map();
    previousBills.forEach((bill) => {
      const mrr = bill.baseFee + bill.additionalServices;
      previousMRRMap.set(bill.brokerId, { mrr, tier: bill.broker.tier });
    });

    const currentMRRMap = new Map();
    currentBills.forEach((bill) => {
      const mrr = bill.baseFee + bill.additionalServices;
      currentMRRMap.set(bill.brokerId, { mrr, tier: bill.broker.tier });
    });

    let totalContractionMRR = 0;

    // Calculate contraction for each broker
    for (const [brokerId, currentData] of currentMRRMap) {
      const previousData = previousMRRMap.get(brokerId);
      if (previousData) {
        const contraction = previousData.mrr - currentData.mrr;
        if (contraction > 0) {
          totalContractionMRR += contraction;
        }
      }
    }

    return totalContractionMRR;
  }

  private async getNRRByTier(startDate: Date, endDate: Date) {
    const tiers = ['STARTER', 'VERIFIED', 'PREMIUM', 'ENTERPRISE'];
    const segments = [];

    for (const tier of tiers) {
      const brokersWithTier = await this.prismaService.broker.findMany({
        where: { tier },
        select: { id: true }
      });

      const brokerIds = brokersWithTier.map(b => b.id);

      // Calculate NRR for this tier
      const tierMRR = await this.calculateTierNRR(brokerIds, startDate, endDate);

      segments.push({
        value: tier,
        ...tierMRR
      });
    }

    return segments;
  }

  private async getNRRByRegion(startDate: Date, endDate: Date) {
    // Get unique regions from brokers
    const brokers = await this.prismaService.broker.findMany({
      where: {
        region: {
          not: null
        }
      },
      select: { id: true, region: true },
      distinct: ['region']
    });

    const regions = [...new Set(brokers.map(b => b.region))];
    const segments = [];

    for (const region of regions) {
      const brokersWithRegion = await this.prismaService.broker.findMany({
        where: { region },
        select: { id: true }
      });

      const brokerIds = brokersWithRegion.map(b => b.id);

      // Calculate NRR for this region
      const regionMRR = await this.calculateTierNRR(brokerIds, startDate, endDate);

      segments.push({
        value: region,
        ...regionMRR
      });
    }

    return segments;
  }

  private async getNRRByAcquisitionChannel(startDate: Date, endDate: Date) {
    // This would require tracking acquisition channel in the broker entity
    // For now, return empty segments
    return [];
  }

  private async calculateTierNRR(brokerIds: string[], startDate: Date, endDate: Date) {
    // Get bills for these brokers in the period
    const startBills = await this.prismaService.brokerBill.findMany({
      where: {
        brokerId: { in: brokerIds },
        status: 'PAID',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const endBills = await this.prismaService.brokerBill.findMany({
      where: {
        brokerId: { in: brokerIds },
        status: 'PAID',
        createdAt: {
          gte: new Date(endDate.getFullYear(), endDate.getMonth(), 1),
          lte: new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0)
        }
      }
    });

    const startingMRR = startBills.reduce((sum, bill) => sum + bill.baseFee + bill.additionalServices, 0);
    const endingMRR = endBills.reduce((sum, bill) => sum + bill.baseFee + bill.additionalServices, 0);

    // For simplicity, return basic metrics
    // In a real implementation, you'd calculate expansion, churn, and contraction for this specific segment
    return {
      startingMRR,
      expansionMRR: 0,
      churnedMRR: 0,
      contractionMRR: 0,
      nrr: startingMRR > 0 ? (endingMRR / startingMRR) * 100 : 100
    };
  }
}
