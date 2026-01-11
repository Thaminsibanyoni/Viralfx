import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from "../../redis/redis.service";
// COMMENTED OUT (TypeORM entity deleted): import { Ticket } from '../entities/ticket.entity';
// COMMENTED OUT (TypeORM entity deleted): import { TicketMessage } from '../entities/ticket-message.entity';
// COMMENTED OUT (TypeORM entity deleted): import { TicketAssignment } from '../entities/ticket-assignment.entity';
import { NotificationService } from "../../notifications/services/notification.service";
// COMMENTED OUT (TypeORM entity deleted): import { User } from "../../../database/entities/user.entity";

@Processor('crm-ticket-sla')
export class CrmTicketSlaProcessor extends WorkerHost {
  private readonly logger = new Logger(CrmTicketSlaProcessor.name);

  constructor(
        private redisService: RedisService,
    private notificationsService: NotificationService,
    @Inject(ConfigService)
    private configService: ConfigService) {}

  private async handleSlaBreachCheck(job: Job<{ ticketIds?: string[] }>) {
    const { ticketIds } = job.data;

    let tickets;
    if (ticketIds) {
      tickets = await this.prisma.findByIds(ticketIds, {
        relations: ['category', 'priority', 'assignments', 'assignments.staff']
      });
    } else {
      // Find all active tickets that might breach SLA
      tickets = await this.prisma.ticket.findMany({
        where: {
          status: ['OPEN', 'IN_PROGRESS']
        },
        relations: ['category', 'priority', 'assignments', 'assignments.staff']
      });
    }

    this.logger.log(`Checking SLA breaches for ${tickets.length} tickets`);

    const now = new Date();
    const breaches = [];

    for (const ticket of tickets) {
      try {
        const slaInfo = this.calculateSLA(ticket);

        if (slaInfo.isBreached || slaInfo.timeToBreach <= 0) {
          breaches.push({
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            breachType: slaInfo.isBreached ? 'BREACHED' : 'IMMINENT',
            priority: ticket.priority.name,
            assignedTo: ticket.assignments[0]?.staff?.email,
            timeOverdue: slaInfo.timeOverdue
          });

          // Handle breach
          await this.handleSLABreach(ticket, slaInfo);
        } else if (slaInfo.timeToBreach <= slaInfo.warningThreshold) {
          // Send warning for imminent breach
          await this.sendSLAWarning(ticket, slaInfo);
        }
      } catch (error) {
        this.logger.error(`Failed to check SLA for ticket ${ticket.id}:`, error);
      }
    }

    this.logger.log(`SLA check completed. Breaches found: ${breaches.length}`);

    // Send summary to support operations
    if (breaches.length > 0) {
      await this.notificationsService.sendNotification({
        type: 'sla_breach_summary',
        channels: ['email'],
        data: {
          breaches,
          timestamp: now.toISOString(),
          total: breaches.length
        }
      });
    }

    return { checked: tickets.length, breaches: breaches.length };
  }

  private async handleAutoEscalation(job: Job<{ ticketId: string; reason: string }>) {
    const { ticketId, reason } = job.data;

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      relations: ['priority', 'category', 'assignments']
    });

    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    // Implement escalation logic
    const escalationLevel = this.calculateEscalationLevel(ticket);
    const newPriority = await this.getEscalatedPriority(ticket.priority, escalationLevel);

    // Update ticket priority and status
    ticket.priorityId = newPriority.id;
    ticket.status = 'ESCALATED';
    ticket.escalationLevel = escalationLevel;
    await this.prisma.ticket.upsert(ticket);

    // Find escalation target (higher-level support)
    const escalationTarget = await this.findEscalationTarget(ticket, escalationLevel);

    if (escalationTarget) {
      // Create new assignment
      await this.prisma.ticketAssignment.upsert({
        ticketId,
        staffId: escalationTarget.id,
        assignedAt: new Date(),
        assignedBy: 'system',
        isEscalation: true
      });

      // Notify escalation target
      await this.notificationsService.sendNotification({
        userId: escalationTarget.id,
        type: 'ticket_escalation',
        channels: ['email', 'push'],
        data: {
          ticketId,
          ticketNumber: ticket.ticketNumber,
          escalationLevel,
          reason,
          priority: newPriority.name
        }
      });
    }

    // Add system message about escalation
    await this.prisma.ticketMessage.upsert({
      ticketId,
      message: `Ticket automatically escalated to level ${escalationLevel} due to: ${reason}`,
      messageType: 'SYSTEM',
      isInternal: true,
      createdBy: 'system'
    });

    this.logger.log(`Ticket ${ticketId} escalated to level ${escalationLevel}`);

    return { escalated: true, level: escalationLevel, assignedTo: escalationTarget?.email };
  }

  private async handleSlaTimerStart(job: Job<{ ticketId: string }>) {
    const { ticketId } = job.data;

    // Store SLA start time in Redis for tracking
    const slaKey = `sla-timer:${ticketId}`;
    await this.redisService.setex(slaKey, 86400 * 7, new Date().toISOString()); // 7 days expiry

    this.logger.log(`SLA timer started for ticket ${ticketId}`);
    return { started: true, ticketId };
  }

  private calculateSLA(ticket: Ticket): {
    isBreached: boolean;
    timeToBreach: number; // minutes
    timeOverdue: number; // minutes
    warningThreshold: number; // minutes
  } {
    const now = new Date();
    const createdAt = new Date(ticket.createdAt);
    const slaHours = this.getSLAHours(ticket.priority.name, ticket.category.name);
    const slaMinutes = slaHours * 60;

    const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    const timeToBreach = slaMinutes - elapsedMinutes;
    const timeOverdue = Math.max(0, -timeToBreach);
    const isBreached = timeOverdue > 0;

    // Read warning threshold from environment variable (default 80%)
    const warningThresholdPercent = this.configService.get<number>('SLA_WARNING_THRESHOLD_PERCENT', 80) / 100;

    return {
      isBreached,
      timeToBreach: Math.round(timeToBreach),
      timeOverdue: Math.round(timeOverdue),
      warningThreshold: slaMinutes * warningThresholdPercent
    };
  }

  private getSLAHours(priority: string, category: string): number {
    // Read SLA hours from environment variables
    const envKey = `SLA_${priority.toUpperCase()}_${category.toUpperCase()}_HOURS`;
    const slaHours = this.configService.get<number>(envKey, 24); // 24h default fallback

    if (slaHours === 24) {
      // Log warning if using default value (env var not found)
      this.logger.warn(`SLA environment variable ${envKey} not found, using default 24 hours`);
    }

    return slaHours;
  }

  private getMaxConcurrentLoad(): number {
    // Read max concurrent load from environment variable
    return this.configService.get<number>('AUTO_ASSIGN_MAX_LOAD_DEFAULT', 10);
  }

  private async handleSLABreach(ticket: Ticket, slaInfo: any): Promise<void> {
    // Update ticket status
    ticket.status = 'SLA_BREACHED';
    await this.prisma.ticket.upsert(ticket);

    // Create breach message
    await this.prisma.ticketMessage.upsert({
      ticketId: ticket.id,
      message: `SLA breached! Ticket is ${slaInfo.timeOverdue} minutes overdue.`,
      messageType: 'SYSTEM',
      isInternal: true,
      createdBy: 'system'
    });

    // Escalate automatically for critical tickets
    if (ticket.priority.name === 'CRITICAL' || slaInfo.timeOverdue > 60) {
      await this.handleAutoEscalation({
        data: { ticketId: ticket.id, reason: 'SLA breach auto-escalation' }
      } as Job);
    }

    // Notify all stakeholders
    const stakeholders = await this.getTicketStakeholders(ticket);
    for (const stakeholder of stakeholders) {
      await this.notificationsService.sendNotification({
        userId: stakeholder.id,
        type: 'sla_breach',
        channels: ['email', 'push'],
        data: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          overdueMinutes: slaInfo.timeOverdue,
          priority: ticket.priority.name
        }
      });
    }
  }

  private async sendSLAWarning(ticket: Ticket, slaInfo: any): Promise<void> {
    // Only send warning if not already sent recently
    const warningKey = `sla-warning:${ticket.id}`;
    const lastWarning = await this.redisService.get(warningKey);

    if (lastWarning) {
      return; // Warning already sent recently
    }

    // Send warning to assigned staff
    if (ticket.assignments.length > 0) {
      const assignedStaff = ticket.assignments[0].staff;

      await this.notificationsService.sendNotification({
        userId: assignedStaff.id,
        type: 'sla_warning',
        channels: ['email', 'push'],
        data: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          minutesToBreach: slaInfo.timeToBreach,
          priority: ticket.priority.name
        }
      });
    }

    // Set warning flag with 2-hour expiry
    await this.redisService.setex(warningKey, 7200, 'sent');
  }

  private calculateEscalationLevel(ticket: Ticket): number {
    // Base escalation level on current state
    let level = (ticket.escalationLevel || 0) + 1;

    // Additional factors for escalation
    if (ticket.priority.name === 'CRITICAL') {
      level += 1;
    }

    if (ticket.status === 'SLA_BREACHED') {
      level += 2;
    }

    return Math.min(level, 5); // Cap at level 5
  }

  private async getEscalatedPriority(currentPriority: any, level: number): Promise<any> {
    // Escalate priority based on level
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const currentIndex = priorities.indexOf(currentPriority.name);
    const newIndex = Math.min(currentIndex + Math.ceil(level / 2), priorities.length - 1);

    // This would fetch from database - simplified for example
    return { id: newIndex, name: priorities[newIndex] };
  }

  private async findEscalationTarget(ticket: Ticket, level: number): Promise<User | null> {
    // Find appropriate escalation target based on level and department
    // This would query user repository for support managers, team leads, etc.
    const roleMap = {
      1: 'TEAM_LEAD',
      2: 'SUPPORT_MANAGER',
      3: 'HEAD_OF_SUPPORT',
      4: 'COMPLIANCE_MANAGER',
      5: 'CTO'
    };

    const targetRole = roleMap[level] || 'TEAM_LEAD';

    const target = await this.prisma.user.findFirst({
      where: { role: targetRole, isActive: true }
    });

    return target;
  }

  private async getTicketStakeholders(ticket: Ticket): Promise<User[]> {
    const stakeholders = [];

    // Add assigned staff
    for (const assignment of ticket.assignments) {
      stakeholders.push(assignment.staff);
    }

    // Add ticket creator
    if (ticket.createdBy) {
      const creator = await this.prisma.user.findFirst({
        where: { id: ticket.createdBy }
      });
      if (creator) {
        stakeholders.push(creator);
      }
    }

    // Add support managers for critical tickets
    if (ticket.priority.name === 'CRITICAL') {
      const managers = await this.prisma.user.findMany({
        where: { role: 'SUPPORT_MANAGER', isActive: true }
      });
      stakeholders.push(...managers);
    }

    return stakeholders;
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing SLA job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed SLA job ${job.id} of type ${job.name}. Result:`, result);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed SLA job ${job.id} of type ${job.name}:`, error);
  }
}
