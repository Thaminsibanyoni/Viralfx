import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { ContractService } from "./contract.service";
import { BrokersService } from "../../brokers/services/brokers.service";
import { CreateOpportunityDto } from '../dto/create-opportunity.dto';
import { UpdateOpportunityDto } from '../dto/update-opportunity.dto';

type OpportunityStage = 'PROSPECTING' | 'QUALIFICATION' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';

@Injectable()
export class OpportunityService {
  constructor(
        private prisma: PrismaService,
    private readonly contractService: ContractService,
    private readonly brokersService: BrokersService) {}

  async createOpportunity(createOpportunityDto: CreateOpportunityDto) {
    const opportunity = await this.prisma.brokerDeal.create({
      data: createOpportunityDto
    });
    return opportunity;
  }

  async updateOpportunity(id: string, updateOpportunityDto: UpdateOpportunityDto) {
    const opportunity = await this.getOpportunityById(id);

    await this.prisma.brokerDeal.update({
      where: { id },
      data: updateOpportunityDto
    });
    return await this.getOpportunityById(id);
  }

  async moveStage(id: string, newStage: OpportunityStage) {
    const opportunity = await this.getOpportunityById(id);

    // Validation: Cannot skip stages
    if (!this.isValidStageTransition(opportunity.stage as OpportunityStage, newStage)) {
      throw new BadRequestException(`Cannot move from ${opportunity.stage} to ${newStage}`);
    }

    const updateData: any = {
      stage: newStage
    };

    // Update probability based on stage
    updateData.probability = this.getStageProbability(newStage);

    // Set actual close date for closed stages
    if (newStage === 'CLOSED_WON' || newStage === 'CLOSED_LOST') {
      updateData.actualCloseDate = new Date();
    }

    await this.prisma.brokerDeal.update({
      where: { id },
      data: updateData
    });
    return await this.getOpportunityById(id);
  }

  async closeWon(id: string) {
    const opportunity = await this.getOpportunityById(id);

    await this.prisma.$transaction(async (tx) => {
      // Update opportunity stage
      await tx.brokerDeal.update({
        where: { id },
        data: {
          stage: 'CLOSED_WON',
          actualCloseDate: new Date(),
          probability: 100
        }
      });

      // Create contract from opportunity
      await this.contractService.createContract(id, {
        type: 'SUBSCRIPTION',
        value: opportunity.value,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        autoRenew: true
      });

      // Update broker metrics
      if (opportunity.brokerId) {
        await this.brokersService.updateMetrics(opportunity.brokerId, {
          totalDealsWon: 1,
          totalRevenue: opportunity.value
        });
      }
    });

    return await this.getOpportunityById(id);
  }

  async closeLost(id: string, reason: string) {
    const opportunity = await this.getOpportunityById(id);

    await this.prisma.brokerDeal.update({
      where: { id },
      data: {
        stage: 'CLOSED_LOST',
        actualCloseDate: new Date(),
        probability: 0,
        lostReason: reason
      }
    });

    // Update broker metrics
    if (opportunity.brokerId) {
      await this.brokersService.updateMetrics(opportunity.brokerId, {
        totalDealsLost: 1
      });
    }

    return await this.getOpportunityById(id);
  }

  async getOpportunities(filters: {
    page?: number;
    limit?: number;
    stage?: OpportunityStage;
    assignedTo?: string;
    brokerId?: string;
    dateRange?: { start: Date; end: Date };
    valueRange?: { min: number; max: number };
  }) {
    const {
      page = 1,
      limit = 20,
      stage,
      assignedTo,
      brokerId,
      dateRange,
      valueRange
    } = filters;

    const where: any = {};

    if (stage) {
      where.stage = stage;
    }

    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    if (brokerId) {
      where.brokerId = brokerId;
    }

    if (dateRange) {
      where.createdAt = { gte: dateRange.start, lte: dateRange.end };
    }

    if (valueRange) {
      where.value = { gte: valueRange.min, lte: valueRange.max };
    }

    const skip = (page - 1) * limit;

    const [opportunities, total] = await Promise.all([
      this.prisma.brokerDeal.findMany({
        where,
        include: {
          broker: {
            select: { businessName: true }
          },
          lead: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.brokerDeal.count({ where })
    ]);

    return {
      opportunities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getOpportunityById(id: string) {
    const opportunity = await this.prisma.brokerDeal.findFirst({
      where: { id },
      include: {
        broker: true,
        lead: true,
        activities: true
      }
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    return opportunity;
  }

  async getPipeline(brokerId?: string) {
    const where: any = brokerId ? { brokerId } : {};

    if (!brokerId) {
      where.stage = {
        notIn: ['CLOSED_WON', 'CLOSED_LOST']
      };
    }

    const pipelineData = await this.prisma.brokerDeal.groupBy({
      by: ['stage'],
      where,
      _count: true,
      _sum: { value: true },
      _avg: { probability: true }
    });

    return pipelineData.map(item => ({
      stage: item.stage,
      count: item._count,
      totalValue: item._sum.value || 0,
      avgProbability: item._avg.probability || 0
    }));
  }

  async calculateWinRate(brokerId?: string, period: { start: Date; end: Date }) {
    const where: any = {
      actualCloseDate: {
        gte: period.start,
        lte: period.end
      }
    };

    if (brokerId) {
      where.brokerId = brokerId;
    }

    const total = await this.prisma.brokerDeal.count({ where });

    const won = await this.prisma.brokerDeal.count({
      where: { ...where, stage: 'CLOSED_WON' }
    });

    return total > 0 ? (won / total) * 100 : 0;
  }

  async forecastRevenue(periodDays: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + periodDays);

    const opportunities = await this.prisma.brokerDeal.findMany({
      where: {
        expectedCloseDate: {
          gte: startDate,
          lte: endDate
        },
        stage: {
          notIn: ['CLOSED_WON', 'CLOSED_LOST']
        }
      }
    });

    const forecast = opportunities.reduce((acc, opp) => {
      const weightedValue = Number(opp.value) * (opp.probability / 100);
      return acc + weightedValue;
    }, 0);

    return {
      period: `${periodDays} days`,
      forecastAmount: forecast,
      opportunityCount: opportunities.length,
      averageDealSize: opportunities.length > 0
        ? opportunities.reduce((sum, opp) => sum + Number(opp.value), 0) / opportunities.length
        : 0
    };
  }

  private isValidStageTransition(currentStage: OpportunityStage, newStage: OpportunityStage): boolean {
    // Define valid transitions
    const stageOrder = [
      'PROSPECTING',
      'QUALIFICATION',
      'PROPOSAL',
      'NEGOTIATION',
    ];

    const currentIndex = stageOrder.indexOf(currentStage);
    const newIndex = stageOrder.indexOf(newStage);

    // Can always close as won or lost
    if (newStage === 'CLOSED_WON' || newStage === 'CLOSED_LOST') {
      return true;
    }

    // Can't move backwards or skip stages
    return newIndex > currentIndex && newIndex !== -1;
  }

  private getStageProbability(stage: OpportunityStage): number {
    const stageProbabilities: Record<OpportunityStage, number> = {
      'PROSPECTING': 10,
      'QUALIFICATION': 25,
      'PROPOSAL': 50,
      'NEGOTIATION': 75,
      'CLOSED_WON': 100,
      'CLOSED_LOST': 0
    };

    return stageProbabilities[stage] || 50;
  }
}
