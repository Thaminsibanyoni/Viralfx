import { Injectable } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('crm-tasks')
    private readonly crmQueue: Queue,
    private readonly redisService: RedisService) {}

  async getDashboard(filters: {
    dateRange?: { start: Date; end: Date };
    assignedTo?: string;
    brokerId?: string;
  }) {
    const cacheKey = `crm:dashboard:${JSON.stringify(filters)}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const { dateRange, assignedTo, brokerId } = filters;

    // Build where clause
    const leadWhere: any = {};
    const dealWhere: any = {};

    if (assignedTo) {
      leadWhere.assignedTo = assignedTo;
      dealWhere.assignedTo = assignedTo;
    }
    if (brokerId) {
      leadWhere.brokerId = brokerId;
      dealWhere.brokerId = brokerId;
    }
    if (dateRange) {
      leadWhere.createdAt = { gte: dateRange.start, lte: dateRange.end };
      dealWhere.createdAt = { gte: dateRange.start, lte: dateRange.end };
    }

    // Lead metrics using Prisma groupBy
    const leadsByStatus = await this.prisma.clientRecord.groupBy({
      by: ['status'],
      where: leadWhere,
      _count: true
    });

    // Opportunity (BrokerDeal) pipeline metrics using Prisma groupBy
    const dealsByStage = await this.prisma.brokerDeal.groupBy({
      by: ['stage'],
      where: dealWhere,
      _count: true,
      _sum: { value: true }
    });

    // Conversion rates
    const conversionMetrics = await this.calculateConversionRates(dateRange, assignedTo, brokerId);

    // Revenue forecast
    const revenueForecast = await this.generateSalesForecast(30); // Next 30 days

    const dashboard = {
      leads: {
        byStatus: leadsByStatus.map(item => ({
          status: item.status,
          count: item._count
        })),
        total: leadsByStatus.reduce((sum, item) => sum + item._count, 0),
        qualified: leadsByStatus.find(item => item.status === 'QUALIFIED')?._count || 0
      },
      opportunities: {
        byStage: dealsByStage.map(item => ({
          stage: item.stage,
          count: item._count,
          totalValue: item._sum.value || 0
        })),
        totalValue: dealsByStage.reduce((sum, item) => sum + (item._sum.value || 0), 0),
        pipelineValue: dealsByStage
          .filter(item => item.stage !== 'CLOSED_WON' && item.stage !== 'CLOSED_LOST')
          .reduce((sum, item) => sum + (item._sum.value || 0), 0)
      },
      conversion: conversionMetrics,
      forecast: revenueForecast
    };

    await this.redisService.setex(cacheKey, 300, JSON.stringify(dashboard)); // 5 minutes TTL
    return dashboard;
  }

  async assignLeadToManager(leadId: string, managerId: string) {
    const manager = await this.prisma.relationshipManager.findFirst({
      where: { id: managerId, isActive: true }
    });

    if (!manager) {
      throw new Error('Relationship manager not found or inactive');
    }

    if (manager.currentLeads >= manager.maxLeads) {
      throw new Error('Relationship manager has reached maximum lead capacity');
    }

    await this.prisma.clientRecord.update({
      where: { id: leadId },
      data: { assignedTo: managerId }
    });

    await this.prisma.relationshipManager.update({
      where: { id: managerId },
      data: { currentLeads: { increment: 1 } }
    });

    return { success: true, managerId };
  }

  async convertLeadToOpportunity(leadId: string, opportunityData: {
    name: string;
    value: number;
    probability?: number;
    expectedCloseDate?: Date;
    products?: string[];
    competitors?: string[];
    notes?: string;
  }) {
    return await this.prisma.$transaction(async (tx) => {
      // Update lead (ClientRecord) status
      const lead = await tx.clientRecord.update({
        where: { id: leadId },
        data: {
          status: 'CONVERTED',
          convertedAt: new Date()
        },
        include: { broker: true }
      });

      // Create opportunity (BrokerDeal)
      const opportunity = await tx.brokerDeal.create({
        data: {
          leadId,
          brokerId: lead.brokerId,
          assignedTo: lead.assignedTo,
          stage: 'PROSPECTING',
          name: opportunityData.name,
          value: opportunityData.value,
          probability: opportunityData.probability,
          expectedCloseDate: opportunityData.expectedCloseDate,
          metadata: {
            products: opportunityData.products,
            competitors: opportunityData.competitors,
            notes: opportunityData.notes
          }
        }
      });

      // Update manager metrics
      if (lead.assignedTo) {
        await tx.relationshipManager.update({
          where: { id: lead.assignedTo },
          data: { currentLeads: { decrement: 1 } }
        });
      }

      return opportunity;
    });
  }

  async scoreLeads() {
    await this.crmQueue.add('score-leads', {}, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }

  async getActivityTimeline(entityType: string, entityId: string) {
    return await this.prisma.dealActivity.findMany({
      where: {
        entityType: entityType as any,
        dealId: entityId
      },
      orderBy: {
        createdAt: 'DESC'
      },
      take: 50
    });
  }

  async generateSalesForecast(periodDays: number) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + periodDays);

    const opportunities = await this.prisma.brokerDeal.findMany({
      where: {
        expectedCloseDate: {
          gte: startDate,
          lte: endDate
        },
        stage: {
          notIn: ['CLOSED_WON', 'CLOSED_LOST']
        }
      },
      include: {
        broker: {
          select: { businessName: true }
        }
      }
    });

    const forecast = opportunities.map(opp => ({
      id: opp.id,
      name: opp.name,
      brokerName: opp.broker.businessName,
      expectedCloseDate: opp.expectedCloseDate,
      value: opp.value,
      probability: opp.probability,
      weightedValue: opp.value * (opp.probability / 100),
      stage: opp.stage
    }));

    const totalForecast = forecast.reduce((sum, item) => sum + item.weightedValue, 0);

    return {
      period: `${periodDays} days`,
      opportunities: forecast,
      totalValue: totalForecast,
      averageProbability: forecast.length > 0
        ? forecast.reduce((sum, item) => sum + item.probability, 0) / forecast.length
        : 0
    };
  }

  private async calculateConversionRates(
    dateRange?: { start: Date; end: Date },
    assignedTo?: string,
    brokerId?: string) {
    // Build where clauses
    const leadWhere: any = {};
    const dealWhere: any = {};

    if (assignedTo) {
      leadWhere.assignedTo = assignedTo;
      dealWhere.assignedTo = assignedTo;
    }
    if (brokerId) {
      leadWhere.brokerId = brokerId;
      dealWhere.brokerId = brokerId;
    }
    if (dateRange) {
      leadWhere.createdAt = { gte: dateRange.start, lte: dateRange.end };
      dealWhere.createdAt = { gte: dateRange.start, lte: dateRange.end };
    }

    // Count leads
    const totalLeads = await this.prisma.clientRecord.count({ where: leadWhere });
    const convertedLeads = await this.prisma.clientRecord.count({
      where: { ...leadWhere, status: 'CONVERTED' }
    });

    // Count deals (opportunities)
    const totalDeals = await this.prisma.brokerDeal.count({ where: dealWhere });
    const wonDeals = await this.prisma.brokerDeal.count({
      where: { ...dealWhere, stage: 'CLOSED_WON' }
    });

    return {
      leadToOpportunity: totalLeads > 0
        ? (convertedLeads / totalLeads) * 100
        : 0,
      opportunityToWin: totalDeals > 0
        ? (wonDeals / totalDeals) * 100
        : 0,
      overallConversion: totalLeads > 0
        ? (wonDeals / totalLeads) * 100
        : 0
    };
  }
}
