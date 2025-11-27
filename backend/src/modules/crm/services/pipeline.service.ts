import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PipelineStage } from '../entities/pipeline-stage.entity';
import { BrokerDeal } from '../entities/broker-deal.entity';
import { DealActivity } from '../entities/deal-activity.entity';
import { CreateDealDto } from '../dto/create-deal.dto';
import { UpdateDealDto } from '../dto/update-deal.dto';
import { CreateDealActivityDto } from '../dto/create-deal-activity.dto';
import { CreatePipelineStageDto } from '../dto/create-pipeline-stage.dto';

@Injectable()
export class PipelineService {
  constructor(
    @InjectRepository(PipelineStage)
    private pipelineStageRepository: Repository<PipelineStage>,
    @InjectRepository(BrokerDeal)
    private brokerDealRepository: Repository<BrokerDeal>,
    @InjectRepository(DealActivity)
    private dealActivityRepository: Repository<DealActivity>,
  ) {}

  async initializePipeline(): Promise<PipelineStage[]> {
    const defaultStages = [
      { name: 'Lead', stageOrder: 1, defaultProbability: 10, color: '#6B7280' },
      { name: 'Qualified', stageOrder: 2, defaultProbability: 25, color: '#3B82F6' },
      { name: 'Needs Analysis', stageOrder: 3, defaultProbability: 40, color: '#8B5CF6' },
      { name: 'Proposal', stageOrder: 4, defaultProbability: 60, color: '#EC4899' },
      { name: 'Negotiation', stageOrder: 5, defaultProbability: 75, color: '#F59E0B' },
      { name: 'Contract', stageOrder: 6, defaultProbability: 90, color: '#10B981' },
      { name: 'Onboarding', stageOrder: 7, defaultProbability: 95, color: '#06B6D4' },
      { name: 'Live', stageOrder: 8, defaultProbability: 100, color: '#059669' },
    ];

    const stages: PipelineStage[] = [];

    for (const stageData of defaultStages) {
      const existingStage = await this.pipelineStageRepository.findOne({
        where: { name: stageData.name },
      });

      if (!existingStage) {
        const stage = this.pipelineStageRepository.create(stageData);
        stages.push(await this.pipelineStageRepository.save(stage));
      } else {
        stages.push(existingStage);
      }
    }

    return stages;
  }

  async getPipelineStages(): Promise<PipelineStage[]> {
    return await this.pipelineStageRepository.find({
      where: { isActive: true },
      order: { stageOrder: 'ASC' },
      relations: ['deals'],
    });
  }

  async createPipelineStage(createDto: CreatePipelineStageDto): Promise<PipelineStage> {
    const stage = this.pipelineStageRepository.create(createDto);
    return await this.pipelineStageRepository.save(stage);
  }

  async createDeal(createDto: CreateDealDto): Promise<BrokerDeal> {
    // Get the first stage as default
    const defaultStage = await this.pipelineStageRepository.findOne({
      where: { stageOrder: 1 },
    });

    if (!defaultStage) {
      throw new BadRequestException('Pipeline stages not initialized');
    }

    const deal = this.brokerDealRepository.create({
      ...createDto,
      stageId: defaultStage.id,
      probability: defaultStage.defaultProbability,
      weightedValue: (createDto.value * defaultStage.defaultProbability) / 100,
    });

    return await this.brokerDealRepository.save(deal);
  }

  async getDeal(dealId: string): Promise<BrokerDeal> {
    const deal = await this.brokerDealRepository.findOne({
      where: { id: dealId },
      relations: [
        'broker',
        'stage',
        'assignedTo',
        'activities',
        'activities.author',
      ],
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    return deal;
  }

  async getDeals(filters: {
    brokerId?: string;
    stageId?: string;
    assignedToId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ deals: BrokerDeal[]; total: number }> {
    const {
      brokerId,
      stageId,
      assignedToId,
      status,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = {};
    if (brokerId) where.brokerId = brokerId;
    if (stageId) where.stageId = stageId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (status) where.status = status;

    const [deals, total] = await this.brokerDealRepository.findAndCount({
      where,
      relations: ['broker', 'stage', 'assignedTo'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { deals, total };
  }

  async updateDeal(dealId: string, updateDto: UpdateDealDto): Promise<BrokerDeal> {
    const deal = await this.getDeal(dealId);

    // If stage is changing, update probability
    if (updateDto.stageId && updateDto.stageId !== deal.stageId) {
      const newStage = await this.pipelineStageRepository.findOne({
        where: { id: updateDto.stageId },
      });

      if (newStage) {
        updateDto.probability = newStage.defaultProbability;
        updateDto.weightedValue = (deal.value * newStage.defaultProbability) / 100;
      }
    }

    // Update weighted value if value or probability changed
    if (updateDto.value || updateDto.probability) {
      const value = updateDto.value || deal.value;
      const probability = updateDto.probability || deal.probability;
      updateDto.weightedValue = (value * probability) / 100;
    }

    // Set close date if deal is won/lost
    if (updateDto.status && ['WON', 'LOST'].includes(updateDto.status)) {
      updateDto.actualCloseDate = new Date();
    }

    Object.assign(deal, updateDto);
    return await this.brokerDealRepository.save(deal);
  }

  async moveDealToStage(dealId: string, stageId: string, assignedToId?: string): Promise<BrokerDeal> {
    const deal = await this.getDeal(dealId);
    const stage = await this.pipelineStageRepository.findOne({
      where: { id: stageId },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    deal.stageId = stageId;
    deal.probability = stage.defaultProbability;
    deal.weightedValue = (deal.value * stage.defaultProbability) / 100;

    if (assignedToId) {
      deal.assignedToId = assignedToId;
    }

    return await this.brokerDealRepository.save(deal);
  }

  async createDealActivity(
    dealId: string,
    createDto: CreateDealActivityDto,
    authorId: string,
  ): Promise<DealActivity> {
    const activity = this.dealActivityRepository.create({
      ...createDto,
      dealId,
      authorId,
    });

    return await this.dealActivityRepository.save(activity);
  }

  async getDealActivities(dealId: string): Promise<DealActivity[]> {
    return await this.dealActivityRepository.find({
      where: { dealId },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }

  async getPipelineMetrics(): Promise<any> {
    const stages = await this.getPipelineStages();
    const metrics = [];

    for (const stage of stages) {
      const dealCount = await this.brokerDealRepository.count({
        where: { stageId: stage.id, status: 'OPEN' },
      });

      const totalValue = await this.brokerDealRepository
        .createQueryBuilder('deal')
        .select('SUM(deal.value)', 'total')
        .where('deal.stageId = :stageId', { stageId: stage.id })
        .andWhere('deal.status = :status', { status: 'OPEN' })
        .getRawOne();

      const weightedValue = await this.brokerDealRepository
        .createQueryBuilder('deal')
        .select('SUM(deal.weightedValue)', 'total')
        .where('deal.stageId = :stageId', { stageId: stage.id })
        .andWhere('deal.status = :status', { status: 'OPEN' })
        .getRawOne();

      metrics.push({
        stageId: stage.id,
        stageName: stage.name,
        dealCount,
        totalValue: totalValue?.total || 0,
        weightedValue: weightedValue?.total || 0,
        probability: stage.defaultProbability,
      });
    }

    // Overall metrics
    const [totalDeals, wonDeals, lostDeals] = await Promise.all([
      this.brokerDealRepository.count({ where: { status: 'OPEN' } }),
      this.brokerDealRepository.count({ where: { status: 'WON' } }),
      this.brokerDealRepository.count({ where: { status: 'LOST' } }),
    ]);

    const totalPipelineValue = await this.brokerDealRepository
      .createQueryBuilder('deal')
      .select('SUM(deal.value)', 'total')
      .where('deal.status = :status', { status: 'OPEN' })
      .getRawOne();

    const totalWeightedValue = await this.brokerDealRepository
      .createQueryBuilder('deal')
      .select('SUM(deal.weightedValue)', 'total')
      .where('deal.status = :status', { status: 'OPEN' })
      .getRawOne();

    return {
      stageMetrics: metrics,
      totalDeals,
      wonDeals,
      lostDeals,
      totalPipelineValue: totalPipelineValue?.total || 0,
      totalWeightedValue: totalWeightedValue?.total || 0,
      winRate: totalDeals + wonDeals + lostDeals > 0
        ? (wonDeals / (totalDeals + wonDeals + lostDeals)) * 100
        : 0,
    };
  }

  async getDealsByMonth(year: number): Promise<any[]> {
    const monthlyData = [];

    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      const [createdDeals, wonDeals, totalValue] = await Promise.all([
        this.brokerDealRepository.count({
          where: {
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        }),
        this.brokerDealRepository.count({
          where: {
            status: 'WON',
            actualCloseDate: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        }),
        this.brokerDealRepository
          .createQueryBuilder('deal')
          .select('SUM(deal.value)', 'total')
          .where('deal.status = :status', { status: 'WON' })
          .andWhere('deal.actualCloseDate BETWEEN :start AND :end', {
            start: startDate,
            end: endDate,
          })
          .getRawOne(),
      ]);

      monthlyData.push({
        month: month + 1,
        createdDeals,
        wonDeals,
        wonValue: totalValue?.total || 0,
      });
    }

    return monthlyData;
  }

  async deleteDeal(dealId: string): Promise<void> {
    const deal = await this.getDeal(dealId);
    await this.brokerDealRepository.remove(deal);
  }

  // Additional methods needed by PipelineController
  async getStages(filters: { isActive?: boolean } = {}): Promise<PipelineStage[]> {
    return this.getPipelineStages();
  }

  async createStage(createDto: any): Promise<PipelineStage> {
    return this.createPipelineStage(createDto);
  }

  async updateStage(stageId: string, updateDto: any): Promise<PipelineStage> {
    const stage = await this.pipelineStageRepository.findOne({
      where: { id: stageId },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    Object.assign(stage, updateDto);
    return await this.pipelineStageRepository.save(stage);
  }

  async deleteStage(stageId: string): Promise<void> {
    const stage = await this.pipelineStageRepository.findOne({
      where: { id: stageId },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    // Check if there are deals in this stage
    const dealCount = await this.brokerDealRepository.count({
      where: { stageId },
    });

    if (dealCount > 0) {
      throw new BadRequestException('Cannot delete stage with existing deals');
    }

    await this.pipelineStageRepository.remove(stage);
  }

  async getDealById(dealId: string): Promise<BrokerDeal> {
    return this.getDeal(dealId);
  }

  async moveDeal(dealId: string, targetStageId: string, notes: string): Promise<BrokerDeal> {
    // Create activity for the move
    await this.createDealActivity(dealId, {
      type: 'STAGE_CHANGE',
      description: `Moved to stage ${targetStageId}: ${notes}`,
    }, 'system'); // This would be replaced with actual user ID

    return this.moveDealToStage(dealId, targetStageId);
  }

  async addActivity(dealId: string, activityData: any): Promise<DealActivity> {
    return this.createDealActivity(dealId, activityData, activityData.authorId || 'system');
  }

  async closeDealWon(dealId: string, actualCloseValue: number, notes: string): Promise<BrokerDeal> {
    const deal = await this.getDeal(dealId);

    // Create activity for closing deal as won
    await this.createDealActivity(dealId, {
      type: 'DEAL_WON',
      description: `Deal won: ${notes}`,
      scheduledFor: new Date(),
    }, 'system'); // This would be replaced with actual user ID

    // Update deal status
    return this.updateDeal(dealId, {
      status: 'WON',
      actualCloseValue,
      actualCloseDate: new Date(),
    });
  }

  async closeDealLost(dealId: string, lossReason: string, notes: string): Promise<BrokerDeal> {
    const deal = await this.getDeal(dealId);

    // Create activity for closing deal as lost
    await this.createDealActivity(dealId, {
      type: 'DEAL_LOST',
      description: `Deal lost: ${lossReason}. ${notes}`,
      scheduledFor: new Date(),
    }, 'system'); // This would be replaced with actual user ID

    // Update deal status
    return this.updateDeal(dealId, {
      status: 'LOST',
      lossReason,
      actualCloseDate: new Date(),
    });
  }

  async getForecast(filters: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'week' | 'month' | 'quarter';
  }): Promise<any> {
    const { startDate, endDate, groupBy = 'month' } = filters;

    // Get deals that are projected to close within the date range
    const projectedDeals = await this.brokerDealRepository.find({
      where: {
        status: 'OPEN',
        projectedCloseDate: {
          $gte: startDate || new Date(),
          $lte: endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Default 90 days
        },
      },
      relations: ['stage'],
      order: { projectedCloseDate: 'ASC' },
    });

    // Group by the specified period
    const groupedData = {};
    projectedDeals.forEach(deal => {
      const date = new Date(deal.projectedCloseDate);
      let key;

      switch (groupBy) {
        case 'week':
          const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'quarter':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          key = `${date.getFullYear()}-Q${quarter}`;
          break;
        default: // month
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          period: key,
          projectedValue: 0,
          weightedValue: 0,
          dealCount: 0,
          deals: [],
        };
      }

      groupedData[key].projectedValue += deal.value;
      groupedData[key].weightedValue += deal.weightedValue;
      groupedData[key].dealCount++;
      groupedData[key].deals.push({
        id: deal.id,
        title: deal.title,
        value: deal.value,
        probability: deal.probability,
        projectedCloseDate: deal.projectedCloseDate,
      });
    });

    // Convert to array and calculate averages
    return Object.values(groupedData).map((period: any) => ({
      ...period,
      averageProbability: period.dealCount > 0 ?
        period.deals.reduce((sum, deal) => sum + deal.probability, 0) / period.dealCount : 0,
      confidence: period.weightedValue / period.projectedValue * 100 || 0,
    }));
  }

  async getAnalytics(filters: {
    startDate?: Date;
    endDate?: Date;
    ownerId?: string;
  }): Promise<any> {
    const { startDate, endDate, ownerId } = filters;

    const baseQuery = this.brokerDealRepository.createQueryBuilder('deal')
      .leftJoinAndSelect('deal.stage', 'stage')
      .leftJoinAndSelect('deal.assignedTo', 'assignedTo');

    if (startDate) {
      baseQuery.andWhere('deal.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      baseQuery.andWhere('deal.createdAt <= :endDate', { endDate });
    }

    if (ownerId) {
      baseQuery.andWhere('deal.assignedToId = :ownerId', { ownerId });
    }

    const deals = await baseQuery.getMany();

    // Calculate analytics
    const totalDeals = deals.length;
    const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);
    const weightedValue = deals.reduce((sum, deal) => sum + deal.weightedValue, 0);
    const wonDeals = deals.filter(deal => deal.status === 'WON').length;
    const lostDeals = deals.filter(deal => deal.status === 'LOST').length;
    const openDeals = deals.filter(deal => deal.status === 'OPEN').length;

    // Average deal size and conversion rate
    const averageDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;
    const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

    // Average sales cycle
    const closedDeals = deals.filter(deal => deal.status === 'WON' && deal.actualCloseDate);
    const averageSalesCycle = closedDeals.length > 0 ?
      closedDeals.reduce((sum, deal) => {
        const cycleTime = deal.actualCloseDate.getTime() - deal.createdAt.getTime();
        return sum + cycleTime;
      }, 0) / closedDeals.length / (1000 * 60 * 60 * 24) : 0; // Convert to days

    // Top performing stages
    const stagePerformance = {};
    deals.forEach(deal => {
      const stageName = deal.stage?.name || 'Unknown';
      if (!stagePerformance[stageName]) {
        stagePerformance[stageName] = { count: 0, value: 0, won: 0 };
      }
      stagePerformance[stageName].count++;
      stagePerformance[stageName].value += deal.value;
      if (deal.status === 'WON') {
        stagePerformance[stageName].won++;
      }
    });

    return {
      summary: {
        totalDeals,
        totalValue,
        weightedValue,
        wonDeals,
        lostDeals,
        openDeals,
        averageDealSize,
        conversionRate,
        averageSalesCycle: Math.round(averageSalesCycle * 10) / 10, // Round to 1 decimal
      },
      stagePerformance: Object.entries(stagePerformance).map(([stage, data]: [string, any]) => ({
        stage,
        ...data,
        winRate: data.count > 0 ? (data.won / data.count) * 100 : 0,
        averageValue: data.count > 0 ? data.value / data.count : 0,
      })),
    };
  }

  async getKanbanView(filters: {
    ownerId?: string;
    status?: string;
  }): Promise<any> {
    const { ownerId, status } = filters;

    // Get all stages
    const stages = await this.getPipelineStages();

    // Get deals for each stage
    const kanbanData = await Promise.all(
      stages.map(async (stage) => {
        const deals = await this.brokerDealRepository.find({
          where: {
            stageId: stage.id,
            ...(ownerId && { assignedToId: ownerId }),
            ...(status && { status }),
          },
          relations: ['broker', 'assignedTo'],
          order: { createdAt: 'ASC' },
        });

        return {
          stageId: stage.id,
          stageName: stage.name,
          stageOrder: stage.stageOrder,
          color: stage.color,
          defaultProbability: stage.defaultProbability,
          deals: deals.map(deal => ({
            id: deal.id,
            title: deal.title,
            value: deal.value,
            probability: deal.probability,
            weightedValue: deal.weightedValue,
            status: deal.status,
            createdAt: deal.createdAt,
            projectedCloseDate: deal.projectedCloseDate,
            broker: deal.broker ? {
              id: deal.broker.id,
              companyName: deal.broker.companyName,
            } : null,
            assignedTo: deal.assignedTo ? {
              id: deal.assignedTo.id,
              firstName: deal.assignedTo.firstName,
              lastName: deal.assignedTo.lastName,
            } : null,
          })),
        };
      })
    );

    return kanbanData.sort((a, b) => a.stageOrder - b.stageOrder);
  }
}