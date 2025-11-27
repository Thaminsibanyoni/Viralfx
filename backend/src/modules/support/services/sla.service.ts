import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SLA } from '../entities/sla.entity';
import { TicketSLA } from '../entities/ticket-sla.entity';
import { Ticket } from '../entities/ticket.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class SlaService {
  constructor(
    @InjectRepository(SLA)
    private readonly slaRepository: Repository<SLA>,
    @InjectRepository(TicketSLA)
    private readonly ticketSLARepository: Repository<TicketSLA>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectQueue('support-tickets')
    private readonly supportQueue: Queue,
  ) {}

  async getSLAs() {
    return await this.slaRepository.find({
      relations: ['categories'],
      order: { name: 'ASC' },
    });
  }

  async getSLAById(id: string): Promise<SLA> {
    return await this.slaRepository.findOne({
      where: { id },
      relations: ['categories'],
    });
  }

  async createSLA(createSLADto: {
    name: string;
    description: string;
    responseTime: number; // in minutes
    resolutionTime: number; // in minutes
    businessHoursOnly: boolean;
    timezone: string;
    workingDays: number[]; // 0-6 (Sunday-Saturday)
    workingHours: {
      start: string; // HH:mm
      end: string; // HH:mm
    };
    escalationRules: Array<{
      delay: number; // minutes after SLA breach
      assignedTo: string;
      notify: boolean;
    }>;
    isActive: boolean;
  }) {
    const sla = this.slaRepository.create(createSLADto);
    return await this.slaRepository.save(sla);
  }

  async updateSLA(id: string, updateSLADto: Partial<SLA>) {
    await this.slaRepository.update(id, updateSLADto);
    return this.getSLAById(id);
  }

  async deleteSLA(id: string) {
    // Check if SLA is being used by any categories
    const sla = await this.getSLAById(id);
    if (sla && sla.categories.length > 0) {
      throw new Error('Cannot delete SLA that is assigned to categories');
    }

    await this.slaRepository.delete(id);
    return { success: true, message: 'SLA deleted successfully' };
  }

  async getTicketSLAs(filters: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'breached' | 'met';
    risk?: 'low' | 'medium' | 'high';
  }) {
    const { page = 1, limit = 20, status, risk } = filters;

    const queryBuilder = this.ticketSLARepository
      .createQueryBuilder('ticketSLA')
      .leftJoinAndSelect('ticketSLA.ticket', 'ticket')
      .leftJoinAndSelect('ticketSLA.sla', 'sla')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .where('ticket.status NOT IN (:...closedStatuses)', {
        closedStatuses: ['RESOLVED', 'CLOSED'],
      });

    if (status === 'pending') {
      queryBuilder.andWhere('ticketSLA.responseDueAt > :now', { now: new Date() });
      queryBuilder.andWhere('ticketSLA.resolutionDueAt > :now', { now: new Date() });
    } else if (status === 'breached') {
      queryBuilder.andWhere(
        '(ticketSLA.responseDueAt < :now OR ticketSLA.resolutionDueAt < :now)',
        { now: new Date() }
      );
    } else if (status === 'met') {
      queryBuilder.andWhere('ticketSLA.responseMetAt IS NOT NULL');
      queryBuilder.andWhere('ticketSLA.resolutionMetAt IS NOT NULL');
    }

    if (risk === 'high') {
      queryBuilder.andWhere('ticketSLA.resolutionDueAt < :highRisk', {
        highRisk: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      });
    } else if (risk === 'medium') {
      queryBuilder.andWhere('ticketSLA.resolutionDueAt < :mediumRisk', {
        mediumRisk: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      });
    } else if (risk === 'low') {
      queryBuilder.andWhere('ticketSLA.resolutionDueAt >= :lowRisk', {
        lowRisk: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      });
    }

    const [ticketSLAs, total] = await queryBuilder
      .orderBy('ticketSLA.resolutionDueAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      ticketSLAs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters,
    };
  }

  async checkSLABreaches() {
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    // Find tickets that are about to breach or have already breached
    const atRiskTickets = await this.ticketSLARepository
      .createQueryBuilder('ticketSLA')
      .leftJoinAndSelect('ticketSLA.ticket', 'ticket')
      .leftJoinAndSelect('ticketSLA.sla', 'sla')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .where('ticket.status NOT IN (:...closedStatuses)', {
        closedStatuses: ['RESOLVED', 'CLOSED'],
      })
      .andWhere(
        '(ticketSLA.responseDueAt < :now OR ticketSLA.resolutionDueAt < :now OR ticketSLA.responseDueAt < :thirtyMinutes OR ticketSLA.resolutionDueAt < :thirtyMinutes)',
        { now, thirtyMinutes: thirtyMinutesFromNow }
      )
      .getMany();

    const breachedTickets = [];
    const atRiskTicketsSoon = [];

    for (const ticketSLA of atRiskTickets) {
      const isResponseBreached = ticketSLA.responseDueAt < now && !ticketSLA.responseMetAt;
      const isResolutionBreached = ticketSLA.resolutionDueAt < now && !ticketSLA.resolutionMetAt;

      const isResponseAtRisk = ticketSLA.responseDueAt < thirtyMinutesFromNow && !ticketSLA.responseMetAt;
      const isResolutionAtRisk = ticketSLA.resolutionDueAt < thirtyMinutesFromNow && !ticketSLA.resolutionMetAt;

      if (isResponseBreached || isResolutionBreached) {
        breachedTickets.push({
          ticketSLA,
          breachType: isResponseBreached ? 'response' : 'resolution',
        });

        // Mark as breached
        if (isResponseBreached && !ticketSLA.responseBreachedAt) {
          await this.ticketSLARepository.update(ticketSLA.id, {
            responseBreachedAt: now,
          });
        }

        if (isResolutionBreached && !ticketSLA.resolutionBreachedAt) {
          await this.ticketSLARepository.update(ticketSLA.id, {
            resolutionBreachedAt: now,
          });
        }

        // Queue breach notifications and escalations
        await this.handleSLABreach(ticketSLA, isResponseBreached ? 'response' : 'resolution');
      }

      if (isResponseAtRisk || isResolutionAtRisk) {
        atRiskTicketsSoon.push({
          ticketSLA,
          riskType: isResponseAtRisk ? 'response' : 'resolution',
        });

        // Queue at-risk notifications
        await this.supportQueue.add('sla-at-risk', {
          ticketSLAId: ticketSLA.id,
          riskType: isResponseAtRisk ? 'response' : 'resolution',
          dueAt: isResponseAtRisk ? ticketSLA.responseDueAt : ticketSLA.resolutionDueAt,
        });
      }
    }

    return {
      breachedTickets,
      atRiskTicketsSoon,
    };
  }

  async updateSLAMetrics(ticketSLAId: string, metrics: {
    responseMetAt?: Date;
    resolutionMetAt?: Date;
  }) {
    await this.ticketSLARepository.update(ticketSLAId, metrics);
  }

  async getSLAStats(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const [
      totalTickets,
      responseMetCount,
      resolutionMetCount,
      responseBreachedCount,
      resolutionBreachedCount,
      avgResponseTime,
      avgResolutionTime,
    ] = await Promise.all([
      this.ticketSLARepository.count({
        where: { createdAt: Between(startDate, now) },
      }),
      this.ticketSLARepository.count({
        where: {
          createdAt: Between(startDate, now),
          responseMetAt: Between(startDate, now),
        },
      }),
      this.ticketSLARepository.count({
        where: {
          createdAt: Between(startDate, now),
          resolutionMetAt: Between(startDate, now),
        },
      }),
      this.ticketSLARepository.count({
        where: {
          createdAt: Between(startDate, now),
          responseBreachedAt: Between(startDate, now),
        },
      }),
      this.ticketSLARepository.count({
        where: {
          createdAt: Between(startDate, now),
          resolutionBreachedAt: Between(startDate, now),
        },
      }),
      this.getAverageResponseTime(startDate, now),
      this.getAverageResolutionTime(startDate, now),
    ]);

    return {
      period,
      totalTickets,
      responseMetCount,
      resolutionMetCount,
      responseBreachedCount,
      resolutionBreachedCount,
      responseComplianceRate: totalTickets > 0 ? (responseMetCount / totalTickets) * 100 : 0,
      resolutionComplianceRate: totalTickets > 0 ? (resolutionMetCount / totalTickets) * 100 : 0,
      avgResponseTime,
      avgResolutionTime,
    };
  }

  private async handleSLABreach(ticketSLA: TicketSLA, breachType: 'response' | 'resolution') {
    const now = new Date();

    // Queue breach notification
    await this.supportQueue.add('sla-breached', {
      ticketSLAId: ticketSLA.id,
      breachType,
      ticketId: ticketSLA.ticketId,
    });

    // Check escalation rules
    const sla = await this.slaRepository.findOne({
      where: { id: ticketSLA.slaId },
    });

    if (sla && sla.escalationRules) {
      for (const rule of sla.escalationRules) {
        // Find if this breach matches any escalation rule
        const breachTime = breachType === 'response' ? ticketSLA.responseBreachedAt : ticketSLA.resolutionBreachedAt;
        if (breachTime) {
          const minutesSinceBreach = (now.getTime() - breachTime.getTime()) / (1000 * 60);

          if (minutesSinceBreach >= rule.delay) {
            await this.supportQueue.add('escalate-ticket', {
              ticketId: ticketSLA.ticketId,
              assignedTo: rule.assignedTo,
              notify: rule.notify,
              reason: `SLA ${breachType} breach escalation`,
            });
          }
        }
      }
    }
  }

  private async getAverageResponseTime(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.ticketSLARepository
      .createQueryBuilder('ticketSLA')
      .leftJoin('ticketSLA.ticket', 'ticket')
      .select('AVG(EXTRACT(EPOCH FROM (ticketSLA.responseMetAt - ticket.createdAt)) / 60)', 'avgMinutes')
      .where('ticketSLA.responseMetAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();

    return Math.round(parseFloat(result?.avgMinutes || 0));
  }

  private async getAverageResolutionTime(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.ticketSLARepository
      .createQueryBuilder('ticketSLA')
      .leftJoin('ticketSLA.ticket', 'ticket')
      .select('AVG(EXTRACT(EPOCH FROM (ticketSLA.resolutionMetAt - ticket.createdAt)) / 60)', 'avgMinutes')
      .where('ticketSLA.resolutionMetAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();

    return Math.round(parseFloat(result?.avgMinutes || 0));
  }
}