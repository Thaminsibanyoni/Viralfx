import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketAssignment } from '../entities/ticket-assignment.entity';
import { SupportService } from '../services/support.service';
import { NotificationsService } from '../../notifications/notifications.service';

interface SLACheckJob {
  ticketIds: string[];
}

interface AutoAssignJob {
  ticketId: string;
  category?: string;
  priority?: string;
}

interface AutoCloseJob {
  ticketId: string;
  reason: string;
}

interface SatisfactionSurveyJob {
  ticketId: string;
  clientId: string;
  ticketRating?: number;
}

interface EscalationJob {
  ticketId: string;
  escalationReason: string;
  escalateTo: string;
}

@Processor('crm-support')
export class CrmSupportProcessor {
  private readonly logger = new Logger(CrmSupportProcessor.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly ticketMessageRepository: Repository<TicketMessage>,
    @InjectRepository(TicketAssignment)
    private readonly ticketAssignmentRepository: Repository<TicketAssignment>,
    private readonly supportService: SupportService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process('check-sla-compliance')
  async handleSLAComplianceCheck(job: Job<SLACheckJob>) {
    try {
      this.logger.log(`Processing SLA compliance check for ${job.data.ticketIds.length} tickets`);

      const { ticketIds } = job.data;

      // Get active tickets that need SLA checking
      const tickets = await this.ticketRepository
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.category', 'category')
        .leftJoinAndSelect('ticket.priority', 'priority')
        .leftJoinAndSelect('ticket.assignee', 'assignee')
        .leftJoinAndSelect('ticket.client', 'client')
        .leftJoinAndSelect('client.user', 'clientUser')
        .where('ticket.id IN (:...ticketIds)', { ticketIds })
        .andWhere('ticket.status NOT IN (:...closedStatus)', { closedStatus: ['RESOLVED', 'CLOSED'] })
        .getMany();

      const results = [];

      for (const ticket of tickets) {
        const now = new Date();
        const createdAt = new Date(ticket.createdAt);
        const slaDeadline = ticket.slaDeadline ? new Date(ticket.slaDeadline) : null;
        const lastMessageAt = ticket.lastMessageAt ? new Date(ticket.lastMessageAt) : createdAt;

        // Calculate SLA metrics
        const responseTimeHours = ticket.firstResponseAt ?
          (new Date(ticket.firstResponseAt).getTime() - createdAt.getTime()) / (1000 * 60 * 60) :
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        const resolutionTimeHours = ticket.resolvedAt ?
          (new Date(ticket.resolvedAt).getTime() - createdAt.getTime()) / (1000 * 60 * 60) :
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        const timeSinceLastMessage = (now.getTime() - lastMessageAt.getTime()) / (1000 * 60 * 60);

        // Determine SLA status
        let slaStatus: 'COMPLIANT' | 'WARNING' | 'BREACHED' = 'COMPLIANT';
        let alerts = [];

        if (slaDeadline && now > slaDeadline) {
          slaStatus = 'BREACHED';
          alerts.push('SLA deadline breached');
        } else if (slaDeadline) {
          const hoursToDeadline = (slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hoursToDeadline <= 2) {
            slaStatus = 'WARNING';
            alerts.push(`SLA deadline in ${Math.ceil(hoursToDeadline)} hours`);
          }
        }

        // Check response time SLA
        const maxResponseTime = this.getMaxResponseTime(ticket.priority?.name);
        if (!ticket.firstResponseAt && responseTimeHours > maxResponseTime) {
          slaStatus = 'BREACHED';
          alerts.push(`Response time SLA breached (${responseTimeHours.toFixed(1)}h > ${maxResponseTime}h)`);
        }

        // Check resolution time SLA
        const maxResolutionTime = this.getMaxResolutionTime(ticket.priority?.name);
        if (ticket.status === 'RESOLVED' && resolutionTimeHours > maxResolutionTime) {
          alerts.push(`Resolution time SLA breached (${resolutionTimeHours.toFixed(1)}h > ${maxResolutionTime}h)`);
        }

        // Check for stale tickets (no response for too long)
        const maxStaleHours = ticket.priority?.name === 'URGENT' ? 2 :
                            ticket.priority?.name === 'HIGH' ? 8 :
                            ticket.priority?.name === 'NORMAL' ? 24 : 48;

        if (timeSinceLastMessage > maxStaleHours && ticket.status !== 'RESOLVED') {
          alerts.push(`Ticket stale for ${Math.floor(timeSinceLastMessage)} hours`);
        }

        // Update ticket SLA status
        await this.ticketRepository.update(ticket.id, {
          slaStatus,
          responseTime: Math.round(responseTimeHours * 100) / 100,
          resolutionTime: Math.round(resolutionTimeHours * 100) / 100,
        });

        results.push({
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          slaStatus,
          alerts,
          responseTime: responseTimeHours,
          resolutionTime: resolutionTimeHours,
        });

        // Send notifications for SLA breaches and warnings
        if (slaStatus === 'BREACHED') {
          await this.handleSLABreach(ticket, alerts);
        } else if (slaStatus === 'WARNING') {
          await this.handleSLAWarning(ticket, alerts);
        }

        // Handle stale tickets
        if (timeSinceLastMessage > maxStaleHours) {
          await this.handleStaleTicket(ticket, timeSinceLastMessage);
        }
      }

      this.logger.log(`Completed SLA check for ${results.length} tickets`);
      return { success: true, processed: results.length, results };

    } catch (error) {
      this.logger.error(`Error processing SLA compliance check: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @Process('auto-assign-tickets')
  async handleAutoAssignTicket(job: Job<AutoAssignJob>) {
    try {
      this.logger.log(`Processing auto-assignment for ticket ${job.data.ticketId}`);

      const { ticketId, category, priority } = job.data;

      // Get ticket details
      const ticket = await this.ticketRepository.findOne({
        where: { id: ticketId },
        relations: ['category', 'priority', 'client'],
      });

      if (!ticket) {
        this.logger.warn(`Ticket ${ticketId} not found for auto-assignment`);
        return { success: false, error: 'Ticket not found' };
      }

      // Check if ticket is already assigned
      if (ticket.assigneeId) {
        this.logger.log(`Ticket ${ticketId} is already assigned to ${ticket.assigneeId}`);
        return { success: true, message: 'Ticket already assigned', assigneeId: ticket.assigneeId };
      }

      // Get auto-assignment rules (from settings or database)
      const assignmentRules = await this.supportService.getAssignmentRules();

      // Find suitable assignee based on rules
      const suitableAssignee = await this.findSuitableAssignee(ticket, assignmentRules);

      if (!suitableAssignee) {
        this.logger.log(`No suitable assignee found for ticket ${ticketId}`);

        // Create escalation task for unassigned high-priority tickets
        if (ticket.priority?.name === 'URGENT' || ticket.priority?.name === 'HIGH') {
          await this.createEscalationTask(ticket, 'No suitable assignee found');
        }

        return { success: false, error: 'No suitable assignee found' };
      }

      // Assign ticket
      await this.supportService.assignTicket(ticketId, {
        assignedToId: suitableAssignee.id,
        reason: 'Auto-assigned based on workload and expertise',
      });

      // Send notification to assignee
      await this.notificationsService.sendNotification({
        userId: suitableAssignee.userId,
        title: 'New Ticket Assigned',
        message: `Ticket ${ticket.ticketNumber} has been auto-assigned to you. ${ticket.title}`,
        type: 'INFO',
        priority: 'HIGH',
        metadata: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          category: ticket.category?.name,
          priority: ticket.priority?.name,
        },
      });

      this.logger.log(`Auto-assigned ticket ${ticketId} to ${suitableAssignee.fullName}`);
      return { success: true, assigneeId: suitableAssignee.id, assigneeName: suitableAssignee.fullName };

    } catch (error) {
      this.logger.error(`Error processing auto-assignment: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @Process('auto-close-resolved-tickets')
  async handleAutoCloseTickets(job: Job<AutoCloseJob>) {
    try {
      this.logger.log(`Processing auto-close for ticket ${job.data.ticketId}`);

      const { ticketId, reason } = job.data;

      // Get ticket details
      const ticket = await this.ticketRepository.findOne({
        where: { id: ticketId },
        relations: ['client', 'client.user'],
      });

      if (!ticket) {
        this.logger.warn(`Ticket ${ticketId} not found for auto-close`);
        return { success: false, error: 'Ticket not found' };
      }

      if (ticket.status !== 'RESOLVED') {
        this.logger.warn(`Ticket ${ticketId} is not in RESOLVED status`);
        return { success: false, error: 'Ticket not resolved' };
      }

      // Check if auto-close criteria are met
      const resolvedAt = ticket.resolvedAt ? new Date(ticket.resolvedAt) : null;
      const now = new Date();
      const hoursSinceResolved = resolvedAt ? (now.getTime() - resolvedAt.getTime()) / (1000 * 60 * 60) : 0;

      // Auto-close after 72 hours (3 days) if no customer response
      const autoCloseHours = 72;
      if (hoursSinceResolved < autoCloseHours) {
        this.logger.log(`Ticket ${ticketId} resolved ${hoursSinceResolved.toFixed(1)} hours ago, not yet eligible for auto-close`);
        return { success: true, message: 'Not yet eligible for auto-close', hoursSinceResolved };
      }

      // Check if there are any recent customer messages
      const lastCustomerMessage = await this.ticketMessageRepository.findOne({
        where: {
          ticketId,
          isInternal: false,
        },
        order: { createdAt: 'DESC' },
      });

      const lastCustomerMessageTime = lastCustomerMessage ?
        new Date(lastCustomerMessage.createdAt) : null;
      const hoursSinceLastCustomerMessage = lastCustomerMessageTime ?
        (now.getTime() - lastCustomerMessageTime.getTime()) / (1000 * 60 * 60) : Infinity;

      if (hoursSinceLastCustomerMessage < 24) {
        this.logger.log(`Recent customer message found for ticket ${ticketId}, postponing auto-close`);
        return { success: false, error: 'Recent customer message found' };
      }

      // Close the ticket
      await this.supportService.closeTicket(ticketId, {
        reason: reason || 'Auto-closed after 72 hours of resolution without customer response',
        sendSatisfactionSurvey: true,
      });

      // Send notification to customer
      if (ticket.client?.user) {
        await this.notificationsService.sendNotification({
          userId: ticket.client.user.id,
          title: 'Ticket Auto-Closed',
          message: `Your support ticket ${ticket.ticketNumber} has been automatically closed due to inactivity. If you have further questions, please create a new ticket.`,
          type: 'INFO',
          metadata: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
          },
        });
      }

      this.logger.log(`Auto-closed ticket ${ticketId}`);
      return { success: true, ticketId, closedAt: now };

    } catch (error) {
      this.logger.error(`Error processing auto-close: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @Process('send-satisfaction-survey')
  async handleSatisfactionSurvey(job: Job<SatisfactionSurveyJob>) {
    try {
      this.logger.log(`Processing satisfaction survey for ticket ${job.data.ticketId}`);

      const { ticketId, clientId, ticketRating } = job.data;

      // Get ticket details
      const ticket = await this.ticketRepository.findOne({
        where: { id: ticketId },
        relations: ['client', 'client.user'],
      });

      if (!ticket || !ticket.client?.user) {
        this.logger.warn(`Ticket or client not found for satisfaction survey`);
        return { success: false, error: 'Ticket or client not found' };
      }

      // Generate satisfaction survey link
      const surveyLink = await this.supportService.generateSatisfactionSurveyLink(ticketId, clientId);

      // Send satisfaction survey notification
      await this.notificationsService.sendNotification({
        userId: ticket.client.user.id,
        title: 'Customer Satisfaction Survey',
        message: `Please rate your experience with support ticket ${ticket.ticketNumber}. Your feedback helps us improve our service.`,
        type: 'INFO',
        metadata: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          surveyLink,
        },
        actions: [
          {
            label: 'Take Survey',
            url: surveyLink,
            type: 'PRIMARY',
          },
        ],
      });

      this.logger.log(`Sent satisfaction survey for ticket ${ticketId}`);
      return { success: true, surveyLink };

    } catch (error) {
      this.logger.error(`Error processing satisfaction survey: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @Process('escalate-ticket')
  async handleTicketEscalation(job: Job<EscalationJob>) {
    try {
      this.logger.log(`Processing escalation for ticket ${job.data.ticketId}`);

      const { ticketId, escalationReason, escalateTo } = job.data;

      // Get ticket details
      const ticket = await this.ticketRepository.findOne({
        where: { id: ticketId },
        relations: ['category', 'priority', 'client', 'assignee'],
      });

      if (!ticket) {
        this.logger.warn(`Ticket ${ticketId} not found for escalation`);
        return { success: false, error: 'Ticket not found' };
      }

      // Update ticket escalation status
      await this.ticketRepository.update(ticketId, {
        escalated: true,
        escalatedAt: new Date(),
        escalationReason,
        escalatedTo: escalateTo,
      });

      // Send escalation notifications
      const escalatedUsers = await this.supportService.getEscalationUsers(escalateTo);

      for (const user of escalatedUsers) {
        await this.notificationsService.sendNotification({
          userId: user.id,
          title: 'Ticket Escalated',
          message: `Ticket ${ticket.ticketNumber} has been escalated: ${escalationReason}`,
          type: 'WARNING',
          priority: 'HIGH',
          metadata: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            category: ticket.category?.name,
            priority: ticket.priority?.name,
            escalationReason,
            escalateTo,
          },
        });
      }

      // Notify current assignee if different from escalation target
      if (ticket.assignee && !escalatedUsers.some(user => user.id === ticket.assignee.userId)) {
        await this.notificationsService.sendNotification({
          userId: ticket.assignee.userId,
          title: 'Ticket Escalated',
          message: `Your assigned ticket ${ticket.ticketNumber} has been escalated to ${escalateTo}`,
          type: 'INFO',
          metadata: {
            ticketId: ticket.id,
            escalationReason,
            escalateTo,
          },
        });
      }

      this.logger.log(`Escalated ticket ${ticketId} to ${escalateTo}`);
      return { success: true, escalatedTo, escalatedCount: escalatedUsers.length };

    } catch (error) {
      this.logger.error(`Error processing ticket escalation: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @Process('cleanup-old-tickets')
  async handleOldTicketCleanup(job: Job) {
    try {
      this.logger.log('Processing old ticket cleanup');

      const { olderThanDays = 365, status = 'CLOSED' } = job.data;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Find old tickets to archive
      const oldTickets = await this.ticketRepository.find({
        where: {
          status,
          createdAt: { $lt: cutoffDate },
        },
      });

      // Archive old tickets
      for (const ticket of oldTickets) {
        await this.supportService.archiveTicket(ticket.id);
      }

      this.logger.log(`Cleaned up ${oldTickets.length} old tickets`);
      return { success: true, archived: oldTickets.length };

    } catch (error) {
      this.logger.error(`Error processing old ticket cleanup: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  // Helper methods
  private getMaxResponseTime(priorityName: string): number {
    const responseTimes: Record<string, number> = {
      'URGENT': 1,
      'HIGH': 4,
      'NORMAL': 8,
      'LOW': 24,
    };
    return responseTimes[priorityName] || 24;
  }

  private getMaxResolutionTime(priorityName: string): number {
    const resolutionTimes: Record<string, number> = {
      'URGENT': 4,
      'HIGH': 12,
      'NORMAL': 24,
      'LOW': 72,
    };
    return resolutionTimes[priorityName] || 72;
  }

  private async handleSLABreach(ticket: Ticket, alerts: string[]) {
    // Send breach notifications to assignee and managers
    const notifications = [
      {
        userId: ticket.assigneeId,
        title: 'SLA Breach Alert',
        message: `Ticket ${ticket.ticketNumber} has breached SLA requirements: ${alerts.join(', ')}`,
        type: 'ERROR' as const,
        priority: 'HIGH' as const,
      },
    ];

    for (const notification of notifications) {
      if (notification.userId) {
        await this.notificationsService.sendNotification({
          ...notification,
          metadata: {
            ticketId: ticket.id,
            alerts,
          },
        });
      }
    }

    // Create escalation task for critical breaches
    const criticalAlerts = alerts.filter(alert =>
      alert.includes('SLA deadline breached') ||
      alert.includes('Response time SLA breached')
    );

    if (criticalAlerts.length > 0) {
      await this.createEscalationTask(ticket, `Critical SLA breach: ${criticalAlerts.join(', ')}`);
    }
  }

  private async handleSLAWarning(ticket: Ticket, alerts: string[]) {
    // Send warning notifications
    if (ticket.assigneeId) {
      await this.notificationsService.sendNotification({
        userId: ticket.assigneeId,
        title: 'SLA Warning',
        message: `Ticket ${ticket.ticketNumber} approaching SLA deadline: ${alerts.join(', ')}`,
        type: 'WARNING',
        priority: 'MEDIUM',
        metadata: {
          ticketId: ticket.id,
          alerts,
        },
      });
    }
  }

  private async handleStaleTicket(ticket: Ticket, hoursSinceLastMessage: number) {
    // Send notification about stale ticket
    if (ticket.assigneeId) {
      await this.notificationsService.sendNotification({
        userId: ticket.assigneeId,
        title: 'Stale Ticket Alert',
        message: `Ticket ${ticket.ticketNumber} has been inactive for ${Math.floor(hoursSinceLastMessage)} hours`,
        type: 'WARNING',
        priority: 'MEDIUM',
        metadata: {
          ticketId: ticket.id,
          hoursSinceLastMessage: Math.floor(hoursSinceLastMessage),
        },
      });
    }
  }

  private async findSuitableAssignee(ticket: Ticket, rules: any[]) {
    // Implementation to find suitable assignee based on rules
    // This would consider factors like:
    // - Current workload
    // - Expertise in ticket category
    // - Availability status
    // - Past performance with similar tickets

    // For now, return null to indicate no auto-assignment
    return null;
  }

  private async createEscalationTask(ticket: Ticket, reason: string) {
    // Create escalation task and notifications
    await this.notificationsService.sendAdminNotification({
      title: 'Ticket Escalation Required',
      message: `Ticket ${ticket.ticketNumber} requires escalation: ${reason}`,
      type: 'WARNING',
      priority: 'HIGH',
      metadata: {
        ticketId: ticket.id,
        escalationReason: reason,
      },
    });
  }
}