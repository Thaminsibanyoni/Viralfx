import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity, OpportunityStage } from '../entities/opportunity.entity';
import { ContractService } from './contract.service';
import { BrokersService } from '../../brokers/services/brokers.service';
import { CreateOpportunityDto } from '../dto/create-opportunity.dto';
import { UpdateOpportunityDto } from '../dto/update-opportunity.dto';

@Injectable()
export class OpportunityService {
  constructor(
    @InjectRepository(Opportunity)
    private readonly opportunityRepository: Repository<Opportunity>,
    private readonly contractService: ContractService,
    private readonly brokersService: BrokersService,
  ) {}

  async createOpportunity(createOpportunityDto: CreateOpportunityDto) {
    const opportunity = this.opportunityRepository.create(createOpportunityDto);
    return await this.opportunityRepository.save(opportunity);
  }

  async updateOpportunity(id: string, updateOpportunityDto: UpdateOpportunityDto) {
    const opportunity = await this.getOpportunityById(id);

    await this.opportunityRepository.update(id, updateOpportunityDto);
    return await this.getOpportunityById(id);
  }

  async moveStage(id: string, newStage: OpportunityStage) {
    const opportunity = await this.getOpportunityById(id);

    // Validation: Cannot skip stages
    if (!this.isValidStageTransition(opportunity.stage, newStage)) {
      throw new BadRequestException(`Cannot move from ${opportunity.stage} to ${newStage}`);
    }

    const updateData: Partial<Opportunity> = {
      stage: newStage,
    };

    // Update probability based on stage
    updateData.probability = this.getStageProbability(newStage);

    // Set actual close date for closed stages
    if (newStage === OpportunityStage.CLOSED_WON || newStage === OpportunityStage.CLOSED_LOST) {
      updateData.actualCloseDate = new Date();
    }

    await this.opportunityRepository.update(id, updateData);
    return await this.getOpportunityById(id);
  }

  async closeWon(id: string) {
    const opportunity = await this.getOpportunityById(id);

    await this.opportunityRepository.manager.transaction(async (transactionManager) => {
      // Update opportunity stage
      await transactionManager.update(Opportunity, id, {
        stage: OpportunityStage.CLOSED_WON,
        actualCloseDate: new Date(),
        probability: 100,
      });

      // Create contract from opportunity
      await this.contractService.createContract(id, {
        type: 'SUBSCRIPTION',
        value: opportunity.value,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        autoRenew: true,
      });

      // Update broker metrics
      if (opportunity.brokerId) {
        await this.brokersService.updateMetrics(opportunity.brokerId, {
          totalDealsWon: 1,
          totalRevenue: opportunity.value,
        });
      }
    });

    return await this.getOpportunityById(id);
  }

  async closeLost(id: string, reason: string) {
    const opportunity = await this.getOpportunityById(id);

    await this.opportunityRepository.update(id, {
      stage: OpportunityStage.CLOSED_LOST,
      actualCloseDate: new Date(),
      probability: 0,
      lostReason: reason,
    });

    // Update broker metrics
    if (opportunity.brokerId) {
      await this.brokersService.updateMetrics(opportunity.brokerId, {
        totalDealsLost: 1,
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
      valueRange,
    } = filters;

    const queryBuilder = this.opportunityRepository
      .createQueryBuilder('opportunity')
      .leftJoinAndSelect('opportunity.broker', 'broker')
      .leftJoinAndSelect('opportunity.lead', 'lead')
      .leftJoinAndSelect('opportunity.contract', 'contract');

    if (stage) {
      queryBuilder.andWhere('opportunity.stage = :stage', { stage });
    }

    if (assignedTo) {
      queryBuilder.andWhere('opportunity.assignedTo = :assignedTo', { assignedTo });
    }

    if (brokerId) {
      queryBuilder.andWhere('opportunity.brokerId = :brokerId', { brokerId });
    }

    if (dateRange) {
      queryBuilder.andWhere(
        'opportunity.createdAt BETWEEN :start AND :end',
        dateRange
      );
    }

    if (valueRange) {
      queryBuilder.andWhere(
        'opportunity.value BETWEEN :min AND :max',
        valueRange
      );
    }

    queryBuilder.orderBy('opportunity.createdAt', 'DESC');

    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [opportunities, total] = await queryBuilder.getManyAndCount();

    return {
      opportunities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOpportunityById(id: string) {
    const opportunity = await this.opportunityRepository.findOne({
      where: { id },
      relations: ['broker', 'lead', 'contract', 'activities'],
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    return opportunity;
  }

  async getPipeline(brokerId?: string) {
    const queryBuilder = this.opportunityRepository
      .createQueryBuilder('opportunity')
      .select('opportunity.stage', 'stage')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(opportunity.value)', 'totalValue')
      .addSelect('AVG(opportunity.probability)', 'avgProbability');

    if (brokerId) {
      queryBuilder.where('opportunity.brokerId = :brokerId', { brokerId });
    } else {
      queryBuilder.where('opportunity.stage NOT IN (:...closedStages)', {
        closedStages: [OpportunityStage.CLOSED_WON, OpportunityStage.CLOSED_LOST],
      });
    }

    const pipelineData = await queryBuilder
      .groupBy('opportunity.stage')
      .getRawMany();

    return pipelineData.map(item => ({
      stage: item.stage,
      count: parseInt(item.count),
      totalValue: parseFloat(item.totalValue) || 0,
      avgProbability: parseFloat(item.avgProbability) || 0,
    }));
  }

  async calculateWinRate(brokerId?: string, period: { start: Date; end: Date }) {
    const queryBuilder = this.opportunityRepository
      .createQueryBuilder('opportunity');

    if (brokerId) {
      queryBuilder.where('opportunity.brokerId = :brokerId', { brokerId });
    }

    queryBuilder.andWhere(
      'opportunity.actualCloseDate BETWEEN :start AND :end',
      period
    );

    const total = await queryBuilder.getCount();

    const won = await queryBuilder
      .andWhere('opportunity.stage = :stage', { stage: OpportunityStage.CLOSED_WON })
      .getCount();

    return total > 0 ? (won / total) * 100 : 0;
  }

  async forecastRevenue(periodDays: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + periodDays);

    const opportunities = await this.opportunityRepository
      .createQueryBuilder('opportunity')
      .where('opportunity.expectedCloseDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('opportunity.stage NOT IN (:...closedStages)', {
        closedStages: [OpportunityStage.CLOSED_WON, OpportunityStage.CLOSED_LOST],
      })
      .getMany();

    const forecast = opportunities.reduce((acc, opp) => {
      const weightedValue = opp.value * (opp.probability / 100);
      return acc + weightedValue;
    }, 0);

    return {
      period: `${periodDays} days`,
      forecastAmount: forecast,
      opportunityCount: opportunities.length,
      averageDealSize: opportunities.length > 0
        ? opportunities.reduce((sum, opp) => sum + opp.value, 0) / opportunities.length
        : 0,
    };
  }

  private isValidStageTransition(currentStage: OpportunityStage, newStage: OpportunityStage): boolean {
    // Define valid transitions
    const stageOrder = [
      OpportunityStage.PROSPECTING,
      OpportunityStage.QUALIFICATION,
      OpportunityStage.PROPOSAL,
      OpportunityStage.NEGOTIATION,
    ];

    const currentIndex = stageOrder.indexOf(currentStage);
    const newIndex = stageOrder.indexOf(newStage);

    // Can always close as won or lost
    if (newStage === OpportunityStage.CLOSED_WON || newStage === OpportunityStage.CLOSED_LOST) {
      return true;
    }

    // Can't move backwards or skip stages
    return newIndex > currentIndex && newIndex !== -1;
  }

  private getStageProbability(stage: OpportunityStage): number {
    const stageProbabilities = {
      [OpportunityStage.PROSPECTING]: 10,
      [OpportunityStage.QUALIFICATION]: 25,
      [OpportunityStage.PROPOSAL]: 50,
      [OpportunityStage.NEGOTIATION]: 75,
      [OpportunityStage.CLOSED_WON]: 100,
      [OpportunityStage.CLOSED_LOST]: 0,
    };

    return stageProbabilities[stage] || 50;
  }
}