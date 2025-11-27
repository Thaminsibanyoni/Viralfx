import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { Opportunity } from '../entities/opportunity.entity';
import { Activity, ActivityEntityType, ActivityType, ActivityStatus } from '../entities/activity.entity';
import { RelationshipManager } from '../entities/relationship-manager.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisService } from '../../redis/redis.service';
import { LeadStatus } from '../entities/lead.entity';
import { OpportunityStage } from '../entities/opportunity.entity';

@Injectable()
export class CrmService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(Opportunity)
    private readonly opportunityRepository: Repository<Opportunity>,
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(RelationshipManager)
    private readonly relationshipManagerRepository: Repository<RelationshipManager>,
    @InjectQueue('crm-tasks')
    private readonly crmQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

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

    // Lead metrics
    const leadsByStatus = await this.leadRepository
      .createQueryBuilder('lead')
      .select('lead.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(assignedTo ? 'lead.assignedTo = :assignedTo' : '1=1', { assignedTo })
      .andWhere(brokerId ? 'lead.brokerId = :brokerId' : '1=1', { brokerId })
      .andWhere(dateRange ? 'lead.createdAt BETWEEN :start AND :end' : '1=1', dateRange || {})
      .groupBy('lead.status')
      .getRawMany();

    // Opportunity pipeline
    const opportunitiesByStage = await this.opportunityRepository
      .createQueryBuilder('opportunity')
      .select('opportunity.stage', 'stage')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(opportunity.value)', 'totalValue')
      .where(assignedTo ? 'opportunity.assignedTo = :assignedTo' : '1=1', { assignedTo })
      .andWhere(brokerId ? 'opportunity.brokerId = :brokerId' : '1=1', { brokerId })
      .andWhere(dateRange ? 'opportunity.createdAt BETWEEN :start AND :end' : '1=1', dateRange || {})
      .groupBy('opportunity.stage')
      .getRawMany();

    // Conversion rates
    const conversionMetrics = await this.calculateConversionRates(dateRange, assignedTo, brokerId);

    // Revenue forecast
    const revenueForecast = await this.generateSalesForecast(30); // Next 30 days

    const dashboard = {
      leads: {
        byStatus: leadsByStatus,
        total: leadsByStatus.reduce((sum, item) => sum + parseInt(item.count), 0),
        qualified: leadsByStatus.find(item => item.status === LeadStatus.QUALIFIED)?.count || 0,
      },
      opportunities: {
        byStage: opportunitiesByStage,
        totalValue: opportunitiesByStage.reduce((sum, item) => sum + parseFloat(item.totalValue || 0), 0),
        pipelineValue: opportunitiesByStage
          .filter(item => item.stage !== OpportunityStage.CLOSED_WON && item.stage !== OpportunityStage.CLOSED_LOST)
          .reduce((sum, item) => sum + parseFloat(item.totalValue || 0), 0),
      },
      conversion: conversionMetrics,
      forecast: revenueForecast,
    };

    await this.redisService.setex(cacheKey, 300, JSON.stringify(dashboard)); // 5 minutes TTL
    return dashboard;
  }

  async assignLeadToManager(leadId: string, managerId: string) {
    const manager = await this.relationshipManagerRepository.findOne({
      where: { id: managerId, isActive: true },
    });

    if (!manager) {
      throw new Error('Relationship manager not found or inactive');
    }

    if (manager.currentLeads >= manager.maxLeads) {
      throw new Error('Relationship manager has reached maximum lead capacity');
    }

    await this.leadRepository.update(leadId, {
      assignedTo: managerId,
    });

    await this.relationshipManagerRepository.increment(
      { id: managerId },
      'currentLeads',
      1,
    );

    // Log activity
    await this.logActivity(ActivityEntityType.LEAD, leadId, {
      type: ActivityType.ASSIGNMENT,
      subject: 'Lead assigned to relationship manager',
      description: `Lead assigned to ${manager.name}`,
      assignedTo: managerId,
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
    return await this.leadRepository.manager.transaction(async (transactionManager) => {
      // Update lead status
      await transactionManager.update(Lead, leadId, {
        status: LeadStatus.CONVERTED,
        convertedAt: new Date(),
      });

      const lead = await transactionManager.findOne(Lead, {
        where: { id: leadId },
        relations: ['broker'],
      });

      // Create opportunity
      const opportunity = transactionManager.create(Opportunity, {
        leadId,
        brokerId: lead.brokerId,
        assignedTo: lead.assignedTo,
        stage: OpportunityStage.PROSPECTING,
        ...opportunityData,
      });

      const savedOpportunity = await transactionManager.save(opportunity);

      // Update manager metrics
      if (lead.assignedTo) {
        await transactionManager.decrement(
          RelationshipManager,
          { id: lead.assignedTo },
          'currentLeads',
          1,
        );
      }

      // Log conversion activity
      await this.logActivity(ActivityEntityType.LEAD, leadId, {
        type: ActivityType.CONVERSION,
        subject: 'Lead converted to opportunity',
        description: `Converted to opportunity: ${opportunityData.name}`,
        assignedTo: lead.assignedTo,
      });

      await this.logActivity(ActivityEntityType.OPPORTUNITY, savedOpportunity.id, {
        type: ActivityType.CREATION,
        subject: 'Opportunity created from lead',
        description: `Created from lead: ${lead.firstName} ${lead.lastName}`,
        assignedTo: lead.assignedTo,
      });

      return savedOpportunity;
    });
  }

  async scoreLeads() {
    await this.crmQueue.add('score-leads', {}, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async getActivityTimeline(entityType: string, entityId: string) {
    return await this.activityRepository.find({
      where: {
        entityType: entityType as any,
        entityId,
      },
      order: {
        createdAt: 'DESC',
      },
      take: 50,
    });
  }

  async generateSalesForecast(periodDays: number) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + periodDays);

    const opportunities = await this.opportunityRepository
      .createQueryBuilder('opportunity')
      .leftJoinAndSelect('opportunity.broker', 'broker')
      .where('opportunity.expectedCloseDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('opportunity.stage NOT IN (:...closedStages)', {
        closedStages: [OpportunityStage.CLOSED_WON, OpportunityStage.CLOSED_LOST],
      })
      .getMany();

    const forecast = opportunities.map(opp => ({
      id: opp.id,
      name: opp.name,
      brokerName: opp.broker.businessName,
      expectedCloseDate: opp.expectedCloseDate,
      value: opp.value,
      probability: opp.probability,
      weightedValue: opp.value * (opp.probability / 100),
      stage: opp.stage,
    }));

    const totalForecast = forecast.reduce((sum, item) => sum + item.weightedValue, 0);

    return {
      period: `${periodDays} days`,
      opportunities: forecast,
      totalValue: totalForecast,
      averageProbability: forecast.length > 0
        ? forecast.reduce((sum, item) => sum + item.probability, 0) / forecast.length
        : 0,
    };
  }

  private async calculateConversionRates(
    dateRange?: { start: Date; end: Date },
    assignedTo?: string,
    brokerId?: string,
  ) {
    // Lead queries
    const leadsQueryBuilder = this.leadRepository.createQueryBuilder('lead')
      .select('COUNT(*)', 'count');

    if (assignedTo) {
      leadsQueryBuilder.andWhere('lead.assignedTo = :assignedTo', { assignedTo });
    }
    if (brokerId) {
      leadsQueryBuilder.andWhere('lead.brokerId = :brokerId', { brokerId });
    }
    if (dateRange) {
      leadsQueryBuilder.andWhere('lead.createdAt BETWEEN :start AND :end', dateRange);
    }

    const totalLeads = await leadsQueryBuilder.getRawOne();

    const convertedLeadsQueryBuilder = this.leadRepository.createQueryBuilder('lead')
      .select('COUNT(*)', 'count')
      .where('lead.status = :status', { status: LeadStatus.CONVERTED });

    if (assignedTo) {
      convertedLeadsQueryBuilder.andWhere('lead.assignedTo = :assignedTo', { assignedTo });
    }
    if (brokerId) {
      convertedLeadsQueryBuilder.andWhere('lead.brokerId = :brokerId', { brokerId });
    }
    if (dateRange) {
      convertedLeadsQueryBuilder.andWhere('lead.createdAt BETWEEN :start AND :end', dateRange);
    }

    const convertedLeads = await convertedLeadsQueryBuilder.getRawOne();

    // Opportunity queries
    const opportunitiesQueryBuilder = this.opportunityRepository.createQueryBuilder('opportunity')
      .select('COUNT(*)', 'count');

    if (assignedTo) {
      opportunitiesQueryBuilder.andWhere('opportunity.assignedTo = :assignedTo', { assignedTo });
    }
    if (brokerId) {
      opportunitiesQueryBuilder.andWhere('opportunity.brokerId = :brokerId', { brokerId });
    }
    if (dateRange) {
      opportunitiesQueryBuilder.andWhere('opportunity.createdAt BETWEEN :start AND :end', dateRange);
    }

    const totalOpportunities = await opportunitiesQueryBuilder.getRawOne();

    const wonOpportunitiesQueryBuilder = this.opportunityRepository.createQueryBuilder('opportunity')
      .select('COUNT(*)', 'count')
      .where('opportunity.stage = :stage', { stage: OpportunityStage.CLOSED_WON });

    if (assignedTo) {
      wonOpportunitiesQueryBuilder.andWhere('opportunity.assignedTo = :assignedTo', { assignedTo });
    }
    if (brokerId) {
      wonOpportunitiesQueryBuilder.andWhere('opportunity.brokerId = :brokerId', { brokerId });
    }
    if (dateRange) {
      wonOpportunitiesQueryBuilder.andWhere('opportunity.createdAt BETWEEN :start AND :end', dateRange);
    }

    const wonOpportunities = await wonOpportunitiesQueryBuilder.getRawOne();

    return {
      leadToOpportunity: parseInt(totalLeads?.count || 0) > 0
        ? (parseInt(convertedLeads?.count || 0) / parseInt(totalLeads?.count || 0)) * 100
        : 0,
      opportunityToWin: parseInt(totalOpportunities?.count || 0) > 0
        ? (parseInt(wonOpportunities?.count || 0) / parseInt(totalOpportunities?.count || 0)) * 100
        : 0,
      overallConversion: parseInt(totalLeads?.count || 0) > 0
        ? (parseInt(wonOpportunities?.count || 0) / parseInt(totalLeads?.count || 0)) * 100
        : 0,
    };
  }

  private async logActivity(
    entityType: ActivityEntityType,
    entityId: string,
    activityData: {
      type: ActivityType;
      subject: string;
      description: string;
      assignedTo?: string;
    },
  ) {
    const activity = this.activityRepository.create({
      entityType,
      entityId,
      type: activityData.type,
      subject: activityData.subject,
      description: activityData.description,
      status: ActivityStatus.COMPLETED,
      completedAt: new Date(),
      assignedTo: activityData.assignedTo,
    });

    await this.activityRepository.save(activity);
  }
}