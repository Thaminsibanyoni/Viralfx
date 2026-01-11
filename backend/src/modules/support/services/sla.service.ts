import { Injectable } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SlaService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('support-tickets')
    private readonly supportQueue: Queue) {}

  async getSLAs() {
    return await this.prisma.sLA.findMany({
      include: {
        categories: true
      },
      orderBy: { name: 'asc' }
    });
  }

  async getSLAById(id: string) {
    return await this.prisma.sLA.findFirst({
      where: { id },
      include: { categories: true }
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
    return await this.prisma.sLA.create({
      data: createSLADto,
      include: { categories: true }
    });
  }

  async updateSLA(id: string, updateSLADto: any) {
    // Check if SLA is being used by any categories
    const sla = await this.getSLAById(id);
    if (sla && sla.categories.length > 0) {
      // Can still update, but warn if deactivating
      if (updateSLADto.isActive === false) {
        console.warn('Deactivating SLA that is assigned to categories');
      }
    }

    return await this.prisma.sLA.update({
      where: { id },
      data: updateSLADto,
      include: { categories: true }
    });
  }

  async deleteSLA(id: string) {
    // Check if SLA is being used by any categories
    const sla = await this.getSLAById(id);
    if (sla && sla.categories.length > 0) {
      throw new Error('Cannot delete SLA that is assigned to categories');
    }

    await this.prisma.sLA.delete({ where: { id } });
    return { success: true, message: 'SLA deleted successfully' };
  }

  async getTicketSLAs(filters: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'breached' | 'met';
    risk?: 'low' | 'medium' | 'high';
  }) {
    const { page = 1, limit = 20, status, risk } = filters;
    const now = new Date();

    const where: any = {
      ticket: {
        status: { notIn: ['RESOLVED', 'CLOSED'] }
      }
    };

    if (status === 'pending') {
      where.responseDueAt = { gt: now };
      where.resolutionDueAt = { gt: now };
    } else if (status === 'breached') {
      where.OR = [
        { responseDueAt: { lt: now } },
        { resolutionDueAt: { lt: now } }
      ];
    } else if (status === 'met') {
      where.responseMetAt = { not: null };
      where.resolutionMetAt = { not: null };
    }

    if (risk === 'high') {
      where.resolutionDueAt = { lt: new Date(Date.now() + 60 * 60 * 1000) }; // 1 hour
    } else if (risk === 'medium') {
      where.resolutionDueAt = { lt: new Date(Date.now() + 4 * 60 * 60 * 1000) }; // 4 hours
    } else if (risk === 'low') {
      where.resolutionDueAt = { gte: new Date(Date.now() + 4 * 60 * 60 * 1000) }; // 4 hours
    }

    const [ticketSLAs, total] = await Promise.all([
      this.prisma.ticketSLA.findMany({
        where,
        include: {
          ticket: {
            include: {
              assignedTo: true
            }
          },
          sla: true
        },
        orderBy: { resolutionDueAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.ticketSLA.count({ where })
    ]);

    return {
      ticketSLAs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters
    };
  }

  async checkSLABreaches() {
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    // Find tickets that are about to breach or have already breached
    const atRiskTicketSLAs = await this.prisma.ticketSLA.findMany({
      where: {
        ticket: {
          status: { notIn: ['RESOLVED', 'CLOSED'] }
        },
        OR: [
          { responseDueAt: { lt: now } },
          { resolutionDueAt: { lt: now } },
          { responseDueAt: { lt: thirtyMinutesFromNow } },
          { resolutionDueAt: { lt: thirtyMinutesFromNow } }
        ]
      },
      include: {
        ticket: {
          include: {
            assignedTo: true
          }
        },
        sla: true
      }
    });

    const breachedTickets = [];
    const atRiskTicketsSoon = [];

    for (const ticketSLA of atRiskTicketSLAs) {
      const isResponseBreached = ticketSLA.responseDueAt < now && !ticketSLA.responseMetAt;
      const isResolutionBreached = ticketSLA.resolutionDueAt < now && !ticketSLA.resolutionMetAt;

      const isResponseAtRisk = ticketSLA.responseDueAt < thirtyMinutesFromNow && !ticketSLA.responseMetAt;
      const isResolutionAtRisk = ticketSLA.resolutionDueAt < thirtyMinutesFromNow && !ticketSLA.resolutionMetAt;

      if (isResponseBreached || isResolutionBreached) {
        breachedTickets.push({
          ticketSLA,
          breachType: isResponseBreached ? 'response' : 'resolution'
        });

        // Mark as breached
        if (isResponseBreached && !ticketSLA.responseBreachedAt) {
          await this.prisma.ticketSLA.update({
            where: { id: ticketSLA.id },
            data: { responseBreachedAt: now }
          });
        }

        if (isResolutionBreached && !ticketSLA.resolutionBreachedAt) {
          await this.prisma.ticketSLA.update({
            where: { id: ticketSLA.id },
            data: { resolutionBreachedAt: now }
          });
        }

        // Queue breach notifications and escalations
        await this.handleSLABreach(ticketSLA, isResponseBreached ? 'response' : 'resolution');
      }

      if (isResponseAtRisk || isResolutionAtRisk) {
        atRiskTicketsSoon.push({
          ticketSLA,
          riskType: isResponseAtRisk ? 'response' : 'resolution'
        });

        // Queue at-risk notifications
        await this.supportQueue.add('sla-at-risk', {
          ticketSLAId: ticketSLA.id,
          riskType: isResponseAtRisk ? 'response' : 'resolution',
          dueAt: isResponseAtRisk ? ticketSLA.responseDueAt : ticketSLA.resolutionDueAt
        });
      }
    }

    return {
      breachedTickets,
      atRiskTicketsSoon
    };
  }

  async updateSLAMetrics(ticketSLAId: string, metrics: {
    responseMetAt?: Date;
    resolutionMetAt?: Date;
  }) {
    await this.prisma.ticketSLA.update({
      where: { id: ticketSLAId },
      data: metrics
    });
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

    const dateFilter = { gte: startDate, lte: now };

    const [
      totalTickets,
      responseMetCount,
      resolutionMetCount,
      responseBreachedCount,
      resolutionBreachedCount,
      avgResponseTime,
      avgResolutionTime,
    ] = await Promise.all([
      this.prisma.ticketSLA.count({
        where: { createdAt: dateFilter }
      }),
      this.prisma.ticketSLA.count({
        where: {
          createdAt: dateFilter,
          responseMetAt: dateFilter
        }
      }),
      this.prisma.ticketSLA.count({
        where: {
          createdAt: dateFilter,
          resolutionMetAt: dateFilter
        }
      }),
      this.prisma.ticketSLA.count({
        where: {
          createdAt: dateFilter,
          responseBreachedAt: dateFilter
        }
      }),
      this.prisma.ticketSLA.count({
        where: {
          createdAt: dateFilter,
          resolutionBreachedAt: dateFilter
        }
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
      avgResolutionTime
    };
  }

  private async handleSLABreach(ticketSLA: any, breachType: 'response' | 'resolution') {
    const now = new Date();

    // Queue breach notification
    await this.supportQueue.add('sla-breached', {
      ticketSLAId: ticketSLA.id,
      breachType,
      ticketId: ticketSLA.ticketId
    });

    // Check escalation rules
    const sla = await this.prisma.sLA.findFirst({
      where: { id: ticketSLA.slaId }
    });

    if (sla && sla.escalationRules) {
      for (const rule of sla.escalationRules) {
        // Find if this breach matches any escalation rule
        const breachTime = breachType === 'response' ? ticketSLA.responseBreachedAt : ticketSLA.resolutionBreachedAt;
        if (breachTime) {
          const minutesSinceBreach = (now.getTime() - new Date(breachTime).getTime()) / (1000 * 60);

          if (minutesSinceBreach >= rule.delay) {
            await this.supportQueue.add('escalate-ticket', {
              ticketId: ticketSLA.ticketId,
              assignedTo: rule.assignedTo,
              notify: rule.notify,
              reason: `SLA ${breachType} breach escalation`
            });
          }
        }
      }
    }
  }

  private async getAverageResponseTime(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ avgMinutes: string }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (ts."responseMetAt" - t."createdAt")) / 60) as "avgMinutes"
      FROM "TicketSLA" ts
      INNER JOIN "Ticket" t ON t.id = ts."ticketId"
      WHERE ts."responseMetAt" >= ${startDate} AND ts."responseMetAt" <= ${endDate}
    `;

    return Math.round(parseFloat(result[0]?.avgMinutes || '0'));
  }

  private async getAverageResolutionTime(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ avgMinutes: string }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (ts."resolutionMetAt" - t."createdAt")) / 60) as "avgMinutes"
      FROM "TicketSLA" ts
      INNER JOIN "Ticket" t ON t.id = ts."ticketId"
      WHERE ts."resolutionMetAt" >= ${startDate} AND ts."resolutionMetAt" <= ${endDate}
    `;

    return Math.round(parseFloat(result[0]?.avgMinutes || '0'));
  }
}
