import {Processor, WorkerHost} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
// COMMENTED OUT (TypeORM entity deleted): import { Ticket, TicketStatus } from '../entities/ticket.entity';
// COMMENTED OUT (TypeORM entity deleted): import { TicketMessage } from '../entities/ticket-message.entity';
// COMMENTED OUT (TypeORM entity deleted): import { TicketSLA } from '../entities/ticket-sla.entity';
import { SlaService } from '../services/sla.service';
import { NotificationService } from "../../notifications/services/notification.service";

export interface SupportJobData {
  ticketId: string;
  messageId?: string;
  assignedTo?: string;
  assignedBy?: string;
  previousStatus?: string;
  newStatus?: string;
  notes?: string;
  isInternal?: boolean;
  ticketSLAId?: string;
  breachType?: 'response' | 'resolution';
  dueAt?: Date;
  reason?: string;
  notify?: boolean;
}

@Processor('support-tickets')
export class SupportProcessor extends WorkerHost {
  private readonly logger = new Logger(SupportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slaService: SlaService,
    private readonly notificationsService: NotificationService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'send-ticket-confirmation':
        return this.handleTicketConfirmation(job);
      case 'assign-ticket':
        return this.handleTicketAssignment(job);
      case 'ticket-status-changed':
        return this.handleTicketStatusChange(job);
      case 'new-ticket-message':
        return this.handleNewTicketMessage(job);
      case 'sla-breached':
        return this.handleSLABreach(job);
      case 'sla-at-risk':
        return this.handleSLAAtRisk(job);
      case 'escalate-ticket':
        return this.handleTicketEscalation(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async handleTicketConfirmation(job: Job<SupportJobData>) {
    this.logger.log(`Processing ticket confirmation for ticket ${job.data.ticketId}`);

    try {
      const ticket = await this.prisma.ticket.findFirst({
        where: { id: job.data.ticketId },
        relations: ['user', 'category']
      });

      if (!ticket) {
        this.logger.error(`Ticket ${job.data.ticketId} not found`);
        return;
      }

      // Send email confirmation to user
      if (ticket.user) {
        await this.notificationsService.sendEmail({
          to: ticket.user.email,
          subject: `Support Ticket Created - ${ticket.ticketNumber}`,
          template: 'ticket-confirmation',
          data: {
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            category: ticket.category?.name,
            priority: ticket.priority,
            description: ticket.description
          }
        });
      }

      // Send in-app notification
      await this.notificationsService.sendInAppNotification({
        userId: ticket.userId,
        title: 'Support Ticket Created',
        message: `Your ticket ${ticket.ticketNumber} has been created successfully`,
        type: 'support',
        data: { ticketId: ticket.id }
      });

      // Send SMS if user has phone number and ticket is high priority
      if (ticket.user?.phone && ticket.priority === 'HIGH' || ticket.priority === 'CRITICAL') {
        await this.notificationsService.sendSMS({
          to: ticket.user.phone,
          message: `Your support ticket ${ticket.ticketNumber} has been created. We will respond shortly.`
        });
      }

      this.logger.log(`Ticket confirmation sent successfully for ticket ${ticket.ticketNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send ticket confirmation: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleTicketAssignment(job: Job<SupportJobData>) {
    this.logger.log(`Processing ticket assignment for ticket ${job.data.ticketId}`);

    try {
      const { ticketId, assignedTo, assignedBy } = job.data;

      const ticket = await this.prisma.ticket.findFirst({
        where: { id: ticketId },
        relations: ['assignedToUser', 'category']
      });

      if (!ticket) {
        this.logger.error(`Ticket ${ticketId} not found`);
        return;
      }

      // Send notification to assigned agent
      if (assignedTo) {
        await this.notificationsService.sendEmail({
          to: assignedTo, // This should be agent's email
          subject: `New Ticket Assignment - ${ticket.ticketNumber}`,
          template: 'ticket-assignment',
          data: {
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            priority: ticket.priority,
            category: ticket.category?.name,
            assignedBy: assignedBy
          }
        });

        // Send in-app notification to agent
        await this.notificationsService.sendInAppNotification({
          userId: assignedTo,
          title: 'New Ticket Assigned',
          message: `Ticket ${ticket.ticketNumber} has been assigned to you`,
          type: 'support',
          data: { ticketId: ticket.id }
        });

        // Send push notification
        await this.notificationsService.sendPushNotification({
          userId: assignedTo,
          title: 'New Support Ticket',
          message: `You've been assigned ticket ${ticket.ticketNumber}`,
          data: { ticketId: ticket.id }
        });
      }

      this.logger.log(`Ticket assignment notification sent successfully for ticket ${ticket.ticketNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send ticket assignment notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleTicketStatusChange(job: Job<SupportJobData>) {
    this.logger.log(`Processing ticket status change for ticket ${job.data.ticketId}`);

    try {
      const { ticketId, previousStatus, newStatus, notes } = job.data;

      const ticket = await this.prisma.ticket.findFirst({
        where: { id: ticketId },
        relations: ['user', 'assignedToUser']
      });

      if (!ticket) {
        this.logger.error(`Ticket ${ticketId} not found`);
        return;
      }

      // Send notification to user for major status changes
      if (ticket.user && (newStatus === 'RESOLVED' || newStatus === 'CLOSED')) {
        const statusMessage = newStatus === 'RESOLVED' ? 'resolved' : 'closed';

        await this.notificationsService.sendEmail({
          to: ticket.user.email,
          subject: `Support Ticket ${statusMessage} - ${ticket.ticketNumber}`,
          template: 'ticket-status-change',
          data: {
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            previousStatus,
            newStatus,
            notes
          }
        });

        await this.notificationsService.sendInAppNotification({
          userId: ticket.userId,
          title: `Support Ticket ${statusMessage}`,
          message: `Your ticket ${ticket.ticketNumber} has been ${statusMessage}`,
          type: 'support',
          data: { ticketId: ticket.id, status: newStatus }
        });
      }

      this.logger.log(`Status change notification sent successfully for ticket ${ticket.ticketNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send status change notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleNewTicketMessage(job: Job<SupportJobData>) {
    this.logger.log(`Processing new ticket message for ticket ${job.data.ticketId}`);

    try {
      const { ticketId, messageId, isInternal } = job.data;

      const ticket = await this.prisma.ticket.findFirst({
        where: { id: ticketId },
        relations: ['user', 'assignedToUser']
      });

      const message = await this.prisma.ticketMessage.findFirst({
        where: { id: messageId },
        relations: ['author']
      });

      if (!ticket || !message) {
        this.logger.error(`Ticket ${ticketId} or message ${messageId} not found`);
        return;
      }

      // Notify appropriate parties based on message type
      if (isInternal) {
        // Internal message - notify user if needed
        if (ticket.user && ticket.status !== 'CLOSED') {
          await this.notificationsService.sendInAppNotification({
            userId: ticket.userId,
            title: 'Support Ticket Update',
            message: `There's an update on your ticket ${ticket.ticketNumber}`,
            type: 'support',
            data: { ticketId: ticket.id }
          });
        }
      } else {
        // Customer message - notify assigned agent
        if (ticket.assignedToUser) {
          await this.notificationsService.sendEmail({
            to: ticket.assignedToUser.email,
            subject: `New Message - ${ticket.ticketNumber}`,
            template: 'new-ticket-message',
            data: {
              ticketNumber: ticket.ticketNumber,
              subject: ticket.subject,
              message: message.content,
              sender: message.author?.name || 'Customer'
            }
          });

          await this.notificationsService.sendInAppNotification({
            userId: ticket.assignedTo,
            title: 'New Customer Message',
            message: `New message on ticket ${ticket.ticketNumber}`,
            type: 'support',
            data: { ticketId: ticket.id, messageId: message.id }
          });

          // Send push notification for immediate attention
          await this.notificationsService.sendPushNotification({
            userId: ticket.assignedTo,
            title: 'New Customer Message',
            message: `${message.author?.name || 'Customer'} sent a message on ${ticket.ticketNumber}`,
            data: { ticketId: ticket.id }
          });
        }
      }

      this.logger.log(`Message notification sent successfully for ticket ${ticket.ticketNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send message notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleSLABreach(job: Job<SupportJobData>) {
    this.logger.log(`Processing SLA breach for ticket ${job.data.ticketId}`);

    try {
      const { ticketId, breachType } = job.data;

      const ticketSLA = await this.prisma.ticketslarepository.findFirst({
        where: { id: job.data.ticketSLAId },
        relations: ['ticket', 'sla', 'ticket.assignedToUser']
      });

      if (!ticketSLA || !ticketSLA.ticket) {
        this.logger.error(`Ticket SLA or ticket not found`);
        return;
      }

      const ticket = ticketSLA.ticket;

      // Send breach notification to assigned agent
      if (ticket.assignedToUser) {
        await this.notificationsService.sendEmail({
          to: ticket.assignedToUser.email,
          subject: `URGENT: SLA Breach - ${ticket.ticketNumber}`,
          template: 'sla-breach',
          data: {
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            breachType,
            ticketId: ticket.id
          }
        });

        await this.notificationsService.sendInAppNotification({
          userId: ticket.assignedTo,
          title: 'SLA Breach Alert',
          message: `SLA ${breachType} breach detected for ticket ${ticket.ticketNumber}`,
          type: 'alert',
          priority: 'high',
          data: { ticketId: ticket.id, breachType }
        });
      }

      // Send high-priority push notification
      await this.notificationsService.sendPushNotification({
        userId: ticket.assignedTo,
        title: 'URGENT: SLA Breach',
        message: `SLA ${breachType} breach on ${ticket.ticketNumber}`,
        priority: 'high',
        data: { ticketId: ticket.id, breachType }
      });

      // Notify support team lead/admin
      await this.notificationsService.sendInAppNotification({
        userId: 'support-team-lead', // This should be dynamic
        title: 'Team SLA Breach',
        message: `Agent ${ticket.assignedToUser?.name} has SLA breach on ${ticket.ticketNumber}`,
        type: 'management',
        priority: 'medium',
        data: { ticketId: ticket.id, agentId: ticket.assignedTo }
      });

      this.logger.log(`SLA breach notification sent successfully for ticket ${ticket.ticketNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send SLA breach notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleSLAAtRisk(job: Job<SupportJobData>) {
    this.logger.log(`Processing SLA at-risk for ticket ${job.data.ticketId}`);

    try {
      const { ticketId, riskType, dueAt } = job.data;

      const ticket = await this.prisma.ticket.findFirst({
        where: { id: ticketId },
        relations: ['assignedToUser']
      });

      if (!ticket) {
        this.logger.error(`Ticket ${ticketId} not found`);
        return;
      }

      // Send at-risk notification to assigned agent
      if (ticket.assignedToUser) {
        await this.notificationsService.sendInAppNotification({
          userId: ticket.assignedTo,
          title: 'SLA At Risk',
          message: `SLA ${riskType} at risk for ${ticket.ticketNumber} - Due: ${dueAt}`,
          type: 'warning',
          priority: 'medium',
          data: { ticketId: ticket.id, riskType, dueAt }
        });
      }

      this.logger.log(`SLA at-risk notification sent successfully for ticket ${ticket.ticketNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send SLA at-risk notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleTicketEscalation(job: Job<SupportJobData>) {
    this.logger.log(`Processing ticket escalation for ticket ${job.data.ticketId}`);

    try {
      const { ticketId, assignedTo, notify, reason } = job.data;

      const ticket = await this.prisma.ticket.findFirst({
        where: { id: ticketId },
        relations: ['user', 'assignedToUser', 'category']
      });

      if (!ticket) {
        this.logger.error(`Ticket ${ticketId} not found`);
        return;
      }

      // Update ticket assignment
      await this.prisma.ticket.update(ticketId, {
        assignedTo,
        updatedAt: new Date()
      });

      // Send escalation notification
      if (notify && assignedTo) {
        await this.notificationsService.sendEmail({
          to: assignedTo, // This should be escalation target's email
          subject: `Escalated Ticket - ${ticket.ticketNumber}`,
          template: 'ticket-escalation',
          data: {
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            reason,
            previousAssignee: ticket.assignedToUser?.name
          }
        });

        await this.notificationsService.sendInAppNotification({
          userId: assignedTo,
          title: 'Escalated Ticket',
          message: `Ticket ${ticket.ticketNumber} has been escalated to you`,
          type: 'support',
          priority: 'high',
          data: { ticketId: ticket.id, escalationReason: reason }
        });

        // Send high-priority push notification
        await this.notificationsService.sendPushNotification({
          userId: assignedTo,
          title: 'Escalated Ticket',
          message: `URGENT: Ticket ${ticket.ticketNumber} escalated to you`,
          priority: 'high',
          data: { ticketId: ticket.id }
        });
      }

      // Notify previous assignee about escalation
      if (ticket.assignedTo && ticket.assignedTo !== assignedTo) {
        await this.notificationsService.sendInAppNotification({
          userId: ticket.assignedTo,
          title: 'Ticket Escalated',
          message: `Ticket ${ticket.ticketNumber} has been escalated`,
          type: 'support',
          data: { ticketId: ticket.id }
        });
      }

      this.logger.log(`Escalation notification sent successfully for ticket ${ticket.ticketNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send escalation notification: ${error.message}`, error.stack);
      throw error;
    }
  }
}
