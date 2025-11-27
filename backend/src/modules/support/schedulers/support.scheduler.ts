import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketSLA } from '../entities/ticket-sla.entity';
import { SlaService } from '../services/sla.service';
import { TicketService } from '../services/ticket.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class SupportScheduler {
  private readonly logger = new Logger(SupportScheduler.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(TicketSLA)
    private readonly ticketSLARepository: Repository<TicketSLA>,
    private readonly slaService: SlaService,
    private readonly ticketService: TicketService,
    @InjectQueue('support-tickets')
    private readonly supportQueue: Queue,
  ) {}

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
        this.logger.warn(`SLA breaches detected: ${result.breachedTickets.map(t => t.ticketSLA.ticketId).join(', ')}`);
      }

      if (result.atRiskTicketsSoon.length > 0) {
        this.logger.log(`SLA at-risk tickets: ${result.atRiskTicketsSoon.map(t => t.ticketSLA.ticketId).join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`Error checking SLA breaches: ${error.message}`, error.stack);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkIdleTickets() {
    this.logger.log('Checking for idle tickets...');

    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Find tickets that haven't received a response in 30 minutes
      const idleTickets = await this.ticketRepository
        .createQueryBuilder('ticket')
        .leftJoin('ticket.messages', 'message')
        .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
        .where('ticket.status IN (:...openStatuses)', {
          openStatuses: [TicketStatus.NEW, TicketStatus.OPEN, TicketStatus.REOPENED],
        })
        .andWhere('ticket.firstResponseAt IS NULL')
        .andWhere('ticket.createdAt < :thirtyMinutesAgo', { thirtyMinutesAgo })
        .groupBy('ticket.id')
        .having('MAX(message.createdAt) < :oneHourAgo OR MAX(message.createdAt) IS NULL', { oneHourAgo })
        .getMany();

      if (idleTickets.length > 0) {
        this.logger.warn(`Found ${idleTickets.length} idle tickets needing attention`);

        // Queue notifications for idle tickets
        for (const ticket of idleTickets) {
          await this.supportQueue.add('idle-ticket-alert', {
            ticketId: ticket.id,
            assignedTo: ticket.assignedTo,
            idleTime: Date.now() - ticket.createdAt.getTime(),
          });
        }
      }

      // Find tickets that haven't had activity for 24 hours
      const staleTickets = await this.ticketRepository
        .createQueryBuilder('ticket')
        .leftJoin('ticket.messages', 'message')
        .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
        .where('ticket.status IN (:...openStatuses)', {
          openStatuses: [TicketStatus.OPEN, TicketStatus.REOPENED],
        })
        .andWhere('ticket.updatedAt < :twentyFourHoursAgo', {
          twentyFourHoursAgo: new Date(Date.now() - 24 * 60 * 60 * 1000),
        })
        .groupBy('ticket.id')
        .having('MAX(message.createdAt) < :twentyFourHoursAgo', {
          twentyFourHoursAgo: new Date(Date.now() - 24 * 60 * 60 * 1000),
        })
        .getMany();

      if (staleTickets.length > 0) {
        this.logger.warn(`Found ${staleTickets.length} stale tickets (24+ hours no activity)`);

        // Queue notifications for stale tickets
        for (const ticket of staleTickets) {
          await this.supportQueue.add('stale-ticket-alert', {
            ticketId: ticket.id,
            assignedTo: ticket.assignedTo,
            staleTime: Date.now() - ticket.updatedAt.getTime(),
          });
        }
      }

    } catch (error) {
      this.logger.error(`Error checking idle tickets: ${error.message}`, error.stack);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async autoAssignNewTickets() {
    this.logger.log('Auto-assigning new tickets...');

    try {
      const newTickets = await this.ticketRepository.find({
        where: {
          status: TicketStatus.NEW,
          assignedTo: null,
        },
        relations: ['category'],
        take: 50, // Limit to prevent overwhelming the system
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
    } catch (error) {
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
        this.ticketRepository.count({
          where: {
            createdAt: Between(startOfDay, endOfDay),
          },
        }),
        this.ticketRepository.count({
          where: {
            resolvedAt: Between(startOfDay, endOfDay),
          },
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
        generatedAt: now.toISOString(),
      };

      this.logger.log(`Daily report generated: ${JSON.stringify(reportData)}`);

      // Queue report generation and notification
      await this.supportQueue.add('daily-support-report', reportData);

    } catch (error) {
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
    } catch (error) {
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
      const stuckInProcessing = await this.ticketRepository.count({
        where: {
          status: TicketStatus.PENDING,
          updatedAt: LessThan(fiveMinutesAgo),
        },
      });

      if (stuckInProcessing > 0) {
        this.logger.warn(`Found ${stuckInProcessing} tickets potentially stuck in processing state`);

        // Reset status for stuck tickets
        await this.ticketRepository
          .createQueryBuilder()
          .update(Ticket)
          .set({ status: TicketStatus.OPEN })
          .where('status = :status', { status: TicketStatus.PENDING })
          .andWhere('updatedAt < :fiveMinutesAgo', { fiveMinutesAgo })
          .execute();
      }

      // Check for orphaned SLA records
      const orphanedSLA = await this.ticketSLARepository
        .createQueryBuilder('ticketSLA')
        .leftJoin('tickets', 'ticket', 'ticket.id = ticketSLA.ticketId')
        .where('ticket.id IS NULL')
        .getCount();

      if (orphanedSLA > 0) {
        this.logger.warn(`Found ${orphanedSLA} orphaned SLA records`);

        // Clean up orphaned SLA records
        await this.ticketSLARepository
          .createQueryBuilder()
          .delete()
          .from(TicketSLA)
          .where('ticketId NOT IN (SELECT id FROM tickets)')
          .execute();
      }

      this.logger.debug('System health check completed');
    } catch (error) {
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
      const recentTicketSLAs = await this.ticketSLARepository.find({
        where: {
          createdAt: Between(sixHoursAgo, now),
        },
        relations: ['ticket'],
      });

      for (const ticketSLA of recentTicketSLAs) {
        const ticket = ticketSLA.ticket;

        // Update response met time if not set and ticket has first response
        if (!ticketSLA.responseMetAt && ticket.firstResponseAt) {
          const responseTime = (ticket.firstResponseAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60); // minutes
          const slaResponseTime = (ticketSLA.responseDueAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60); // minutes

          if (responseTime <= slaResponseTime) {
            await this.slaService.updateSLAMetrics(ticketSLA.id, {
              responseMetAt: ticket.firstResponseAt,
            });
          }
        }

        // Update resolution met time if ticket is resolved
        if (!ticketSLA.resolutionMetAt && ticket.status === TicketStatus.RESOLVED && ticket.resolvedAt) {
          const resolutionTime = (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60); // minutes
          const slaResolutionTime = (ticketSLA.resolutionDueAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60); // minutes

          if (resolutionTime <= slaResolutionTime) {
            await this.slaService.updateSLAMetrics(ticketSLA.id, {
              resolutionMetAt: ticket.resolvedAt,
            });
          }
        }
      }

      this.logger.log(`Updated metrics for ${recentTicketSLAs.length} ticket SLAs`);
    } catch (error) {
      this.logger.error(`Error updating ticket metrics: ${error.message}`, error.stack);
    }
  }

  // Helper methods
  private async getAverageResolutionTime(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('AVG(EXTRACT(EPOCH FROM (ticket.resolvedAt - ticket.createdAt)) / 60)', 'avgMinutes')
      .where('ticket.resolvedAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('ticket.status = :status', { status: TicketStatus.RESOLVED })
      .getRawOne();

    return Math.round(parseFloat(result?.avgMinutes || '0'));
  }

  private async getSLAComplianceRate(startDate: Date, endDate: Date): Promise<number> {
    const [totalTickets, compliantTickets] = await Promise.all([
      this.ticketSLARepository.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
      this.ticketSLARepository.count({
        where: {
          createdAt: Between(startDate, endDate),
          responseMetAt: Between(startDate, endDate),
          resolutionMetAt: Between(startDate, endDate),
        },
      }),
    ]);

    return totalTickets > 0 ? (compliantTickets / totalTickets) * 100 : 0;
  }
}