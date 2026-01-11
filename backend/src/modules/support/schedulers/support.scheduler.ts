import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from "../../../prisma/prisma.service";
import { SlaService } from "../services/sla.service";
import { TicketService } from "../services/ticket.service";

enum TicketStatus {
  NEW = 'NEW',
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  REOPENED = 'REOPENED',
  CLOSED = 'CLOSED'
}

@Injectable()
export class SupportScheduler {
  private readonly logger = new Logger(SupportScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slaService: SlaService,
    private readonly ticketService: TicketService,
    @InjectQueue('support-tickets')
    private readonly supportQueue: Queue) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSLABreaches() {
    this.logger.log('Checking for SLA breaches...');

    try {
      const result = await this.slaService.checkSLABreaches();

      this.logger.log(
        `SLA breach check completed: ${result.breachedTickets.length} breached, ${result.atRiskTicketsSoon.length} at risk`
      );

      // Log detailed breach information
      if (result.breachedTickets.length > 0) {
        this.logger.warn(`SLA breaches detected: ${result.breachedTickets.map((t: any) => t.ticketSLA.ticketId).join(', ')}`);
      }

      if (result.atRiskTicketsSoon.length > 0) {
        this.logger.log(`SLA at-risk tickets: ${result.atRiskTicketsSoon.map((t: any) => t.ticketSLA.ticketId).join(', ')}`);
      }
    } catch (error: any) {
      this.logger.error(`Error checking SLA breaches: ${error.message}`, error.stack);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkIdleTickets() {
    this.logger.log('Checking for idle tickets...');

    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Find tickets that haven't received a response in 30 minutes using Prisma
      const idleTickets = await this.prisma.$queryRaw<Array<any>>`
        SELECT DISTINCT t.id, t.assignedTo, t."createdAt"
        FROM "Ticket" t
        LEFT JOIN "TicketMessage" tm ON t.id = tm."ticketId"
        WHERE t.status IN (${TicketStatus.NEW}, ${TicketStatus.OPEN}, ${TicketStatus.REOPENED})
          AND t."firstResponseAt" IS NULL
          AND t."createdAt" < ${thirtyMinutesAgo}
        GROUP BY t.id, t.assignedTo, t."createdAt"
        HAVING MAX(tm."createdAt") < ${oneHourAgo} OR MAX(tm."createdAt") IS NULL
      `;

      if (idleTickets.length > 0) {
        this.logger.warn(`Found ${idleTickets.length} idle tickets needing attention`);

        // Queue notifications for idle tickets
        for (const ticket of idleTickets) {
          await this.supportQueue.add('idle-ticket-alert', {
            ticketId: ticket.id,
            assignedTo: ticket.assignedTo,
            idleTime: Date.now() - new Date(ticket.createdAt).getTime()
          });
        }
      }

      // Find tickets that haven't had activity for 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const staleTickets = await this.prisma.$queryRaw<Array<any>>`
        SELECT DISTINCT t.id, t.assignedTo, t."updatedAt"
        FROM "Ticket" t
        LEFT JOIN "TicketMessage" tm ON t.id = tm."ticketId"
        WHERE t.status IN (${TicketStatus.OPEN}, ${TicketStatus.REOPENED})
          AND t."updatedAt" < ${twentyFourHoursAgo}
        GROUP BY t.id, t.assignedTo, t."updatedAt"
        HAVING MAX(tm."createdAt") < ${twentyFourHoursAgo}
      `;

      if (staleTickets.length > 0) {
        this.logger.warn(`Found ${staleTickets.length} stale tickets (24+ hours no activity)`);

        // Queue notifications for stale tickets
        for (const ticket of staleTickets) {
          await this.supportQueue.add('stale-ticket-alert', {
            ticketId: ticket.id,
            assignedTo: ticket.assignedTo,
            staleTime: Date.now() - new Date(ticket.updatedAt).getTime()
          });
        }
      }

    } catch (error: any) {
      this.logger.error(`Error checking idle tickets: ${error.message}`, error.stack);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async autoAssignNewTickets() {
    this.logger.log('Auto-assigning new tickets...');

    try {
      const newTickets = await this.prisma.ticket.findMany({
        where: {
          status: TicketStatus.NEW,
          assignedTo: null
        },
        include: {
          category: true
        },
        take: 50 // Limit to prevent overwhelming the system
      });

      if (newTickets.length > 0) {
        this.logger.log(`Found ${newTickets.length} new tickets to auto-assign`);

        for (const ticket of newTickets) {
          if (ticket.category?.defaultAssignedTo) {
            await this.ticketService.assignTicket(
              ticket.id,
              ticket.category.defaultAssignedTo,
              null // System assignment
            );

            this.logger.log(`Auto-assigned ticket ${ticket.ticketNumber} to agent ${ticket.category.defaultAssignedTo}`);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Error auto-assigning tickets: ${error.message}`, error.stack);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyReport() {
    this.logger.log('Generating daily support report...');

    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1);

      // Get daily statistics
      const [
        totalTickets,
        resolvedTickets,
        avgResolutionTime,
        slaComplianceRate,
      ] = await Promise.all([
        this.prisma.ticket.count({
          where: {
            createdAt: { gte: startOfDay, lte: endOfDay }
          }
        }),
        this.prisma.ticket.count({
          where: {
            resolvedAt: { gte: startOfDay, lte: endOfDay }
          }
        }),
        this.getAverageResolutionTime(startOfDay, endOfDay),
        this.getSLAComplianceRate(startOfDay, endOfDay),
      ]);

      const reportData = {
        date: yesterday.toISOString().split('T')[0],
        totalTickets,
        resolvedTickets,
        avgResolutionTime,
        slaComplianceRate,
        generatedAt: now.toISOString()
      };

      this.logger.log(`Daily report generated: ${JSON.stringify(reportData)}`);

      // Queue report generation and notification
      await this.supportQueue.add('daily-support-report', reportData);

    } catch (error: any) {
      this.logger.error(`Error generating daily report: ${error.message}`, error.stack);
    }
  }

  @Cron(CronExpression.EVERY_WEEKEND)
  async cleanupOldNotifications() {
    this.logger.log('Cleaning up old support notifications...');

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // This would clean up old notifications from the notifications table
      // Implementation depends on your notification system structure
      this.logger.log('Cleanup completed for old notifications');
    } catch (error: any) {
      this.logger.error(`Error cleaning up old notifications: ${error.message}`, error.stack);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkSystemHealth() {
    this.logger.debug('Checking support system health...');

    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Check for tickets that might be stuck in processing
      const stuckInProcessing = await this.prisma.ticket.count({
        where: {
          status: TicketStatus.PENDING,
          updatedAt: { lt: fiveMinutesAgo }
        }
      });

      if (stuckInProcessing > 0) {
        this.logger.warn(`Found ${stuckInProcessing} tickets potentially stuck in processing state`);

        // Reset status for stuck tickets using Prisma updateMany
        await this.prisma.ticket.updateMany({
          where: {
            status: TicketStatus.PENDING,
            updatedAt: { lt: fiveMinutesAgo }
          },
          data: {
            status: TicketStatus.OPEN
          }
        });
      }

      // Check for orphaned SLA records using raw SQL
      const orphanedSLA = await this.prisma.$queryRaw<Array<{ count: BigInt }>>`
        SELECT COUNT(*) as count
        FROM "TicketSLA" ts
        LEFT JOIN "Ticket" t ON t.id = ts."ticketId"
        WHERE t.id IS NULL
      `;

      const orphanedCount = Number(orphanedSLA[0]?.count || 0);

      if (orphanedCount > 0) {
        this.logger.warn(`Found ${orphanedCount} orphaned SLA records`);

        // Clean up orphaned SLA records using raw SQL
        await this.prisma.$executeRaw`
          DELETE FROM "TicketSLA"
          WHERE "ticketId" NOT IN (SELECT id FROM "Ticket")
        `;
      }

      this.logger.debug('System health check completed');
    } catch (error: any) {
      this.logger.error(`Error during system health check: ${error.message}`, error.stack);
    }
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async updateTicketMetrics() {
    this.logger.log('Updating ticket metrics and analytics...');

    try {
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

      // Update SLA metrics for recent tickets
      const recentTicketSLAs = await this.prisma.ticketSLA.findMany({
        where: {
          createdAt: { gte: sixHoursAgo, lte: now }
        },
        include: {
          ticket: true
        }
      });

      for (const ticketSLA of recentTicketSLAs) {
        const ticket = ticketSLA.ticket;

        // Update response met time if not set and ticket has first response
        if (!ticketSLA.responseMetAt && ticket.firstResponseAt) {
          const responseTime = (new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60); // minutes
          const slaResponseTime = (new Date(ticketSLA.responseDueAt).getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60); // minutes

          if (responseTime <= slaResponseTime) {
            await this.slaService.updateSLAMetrics(ticketSLA.id, {
              responseMetAt: ticket.firstResponseAt
            });
          }
        }

        // Update resolution met time if ticket is resolved
        if (!ticketSLA.resolutionMetAt && ticket.status === TicketStatus.RESOLVED && ticket.resolvedAt) {
          const resolutionTime = (new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60); // minutes
          const slaResolutionTime = (new Date(ticketSLA.resolutionDueAt).getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60); // minutes

          if (resolutionTime <= slaResolutionTime) {
            await this.slaService.updateSLAMetrics(ticketSLA.id, {
              resolutionMetAt: ticket.resolvedAt
            });
          }
        }
      }

      this.logger.log(`Updated metrics for ${recentTicketSLAs.length} ticket SLAs`);
    } catch (error: any) {
      this.logger.error(`Error updating ticket metrics: ${error.message}`, error.stack);
    }
  }

  // Helper methods
  private async getAverageResolutionTime(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ avgMinutes: string }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (t."resolvedAt" - t."createdAt")) / 60) as "avgMinutes"
      FROM "Ticket" t
      WHERE t."resolvedAt" >= ${startDate} AND t."resolvedAt" <= ${endDate}
        AND t.status = ${TicketStatus.RESOLVED}
    `;

    return Math.round(parseFloat(result[0]?.avgMinutes || '0'));
  }

  private async getSLAComplianceRate(startDate: Date, endDate: Date): Promise<number> {
    const [totalTickets, compliantTickets] = await Promise.all([
      this.prisma.ticket.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      this.prisma.ticketSLA.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          responseMetAt: { not: null },
          resolutionMetAt: { not: null }
        }
      }),
    ]);

    return totalTickets > 0 ? (compliantTickets / totalTickets) * 100 : 0;
  }
}
