import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
// COMMENTED OUT (TypeORM entity deleted): import { Ticket } from '../entities/ticket.entity';
// COMMENTED OUT (TypeORM entity deleted): import { TicketMessage } from '../entities/ticket-message.entity';
// COMMENTED OUT (TypeORM entity deleted): import { TicketCategory } from '../entities/ticket-category.entity';
// COMMENTED OUT (TypeORM entity deleted): import { TicketPriority } from '../entities/ticket-priority.entity';
// COMMENTED OUT (TypeORM entity deleted): import { TicketAssignment } from '../entities/ticket-assignment.entity';
// COMMENTED OUT (TypeORM entity deleted): import { User } from "../../../database/entities/user.entity";
// COMMENTED OUT (TypeORM entity deleted): import { UserStatus, UserRole } from "../../../database/entities/user.entity";
// COMMENTED OUT (cross-module entity import): import { Broker } from "../../brokers/entities/broker.entity";
import { NotificationService } from "../../notifications/services/notification.service";
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { CreateTicketMessageDto } from '../dto/create-ticket-message.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { AssignTicketDto } from '../dto/assign-ticket.dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
        private notificationService: NotificationService) {}

  async createTicket(createDto: CreateTicketDto, creatorId?: string): Promise<Ticket> {
    // Validate category and priority
    const category = await this.prisma.ticketCategory.findFirst({
      where: { id: createDto.categoryId, isActive: true }
    });

    if (!category) {
      throw new NotFoundException('Ticket category not found');
    }

    const priority = await this.prisma.ticketPriority.findFirst({
      where: { id: createDto.priorityId, isActive: true }
    });

    if (!priority) {
      throw new NotFoundException('Ticket priority not found');
    }

    // Validate user/broker if provided
    if (createDto.userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: createDto.userId }
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
    }

    if (createDto.brokerId) {
      const broker = await this.prisma.broker.findFirst({
        where: { id: createDto.brokerId }
      });
      if (!broker) {
        throw new NotFoundException('Broker not found');
      }
    }

    // Generate ticket number
    const ticketNumber = await this.generateTicketNumber();

    // Calculate SLA due date
    const slaDueDate = this.calculateSlaDueDate(category, priority);

    const ticket = this.prisma.ticket.create({
      ...createDto,
      ticketNumber,
      slaDueDate,
      title: createDto.title || createDto.subject // Always populate title, fallback to subject
    });

    const savedTicket = await this.prisma.ticket.upsert(ticket);

    // Auto-assign if there's a default assignee for the category
    await this.autoAssignTicket(savedTicket.id, category.id);

    return savedTicket;
  }

  async getTicket(ticketId: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      relations: [
        'user',
        'broker',
        'category',
        'priority',
        'assignedTo',
        'messages',
        'messages.author',
        'assignments',
        'assignments.assignedBy',
        'assignments.assignedTo',
      ]
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async getTickets(filters: {
    status?: string;
    categoryId?: string;
    priorityId?: string;
    assignedToId?: string;
    userId?: string;
    brokerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ tickets: Ticket[]; total: number }> {
    const {
      status,
      categoryId,
      priorityId,
      assignedToId,
      userId,
      brokerId,
      page = 1,
      limit = 20
    } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (priorityId) where.priorityId = priorityId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (userId) where.userId = userId;
    if (brokerId) where.brokerId = brokerId;

    const [tickets, total] = await this.prisma.findAndCount({
      where,
      relations: ['user', 'broker', 'category', 'priority', 'assignedTo'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    });

    return { tickets, total };
  }

  async performTicketUpdate(ticketId: string, updateDto: UpdateTicketDto): Promise<Ticket> {
    const ticket = await this.getTicket(ticketId);

    Object.assign(ticket, updateDto);

    // Update SLA if priority or category changed
    if (updateDto.categoryId || updateDto.priorityId) {
      const category = updateDto.categoryId
        ? await this.prisma.ticketCategory.findFirst({ where: { id: updateDto.categoryId } })
        : ticket.category;
      const priority = updateDto.priorityId
        ? await this.prisma.ticketPriority.findFirst({ where: { id: updateDto.priorityId } })
        : ticket.priority;

      if (category && priority) {
        ticket.slaDueDate = this.calculateSlaDueDate(category, priority);
      }
    }

    // Set resolved timestamp if status is RESOLVED
    if (updateDto.status === 'RESOLVED' && ticket.status !== 'RESOLVED') {
      ticket.resolvedAt = new Date();
    }

    return await this.prisma.ticket.upsert(ticket);
  }

  async performTicketAssignment(ticketId: string, assignDto: AssignTicketDto, assignedById: string): Promise<Ticket> {
    const ticket = await this.getTicket(ticketId);
    const assignee = await this.prisma.user.findFirst({
      where: { id: assignDto.assignedToId }
    });

    if (!assignee) {
      throw new NotFoundException('Assignee not found');
    }

    // Mark previous assignments as not current
    await this.prisma.ticketAssignment.update(
      { ticketId, isCurrent: true },
      { isCurrent: false });

    // Create new assignment
    const assignment = this.prisma.ticketAssignment.create({
      ticketId,
      assignedById,
      assignedToId: assignDto.assignedToId,
      reason: assignDto.reason,
      isCurrent: true
    });

    await this.prisma.ticketAssignment.upsert(assignment);

    // Update ticket
    ticket.assignedToId = assignDto.assignedToId;
    return await this.prisma.ticket.upsert(ticket);
  }

  async addTicketMessage(
    ticketId: string,
    createDto: CreateTicketMessageDto,
    authorId: string): Promise<TicketMessage> {
    const ticket = await this.getTicket(ticketId);

    const message = this.prisma.ticketMessage.create({
      ...createDto,
      ticketId,
      authorId
    });

    const savedMessage = await this.prisma.ticketMessage.upsert(message);

    // Update ticket first response time if this is the first staff message
    if (!ticket.firstResponseAt && ticket.assignedToId !== authorId) {
      ticket.firstResponseAt = new Date();
      await this.prisma.ticket.upsert(ticket);
    }

    return savedMessage;
  }

  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    return await this.prisma.ticketMessage.findMany({
      where: { ticketId },
      relations: ['author'],
      order: { createdAt: 'ASC' }
    });
  }

  async getTicketCategories(): Promise<TicketCategory[]> {
    return await this.prisma.ticketCategory.findMany({
      where: { isActive: true },
      order: { name: 'ASC' }
    });
  }

  async getTicketPriorities(): Promise<TicketPriority[]> {
    return await this.prisma.ticketPriority.findMany({
      where: { isActive: true },
      order: { level: 'ASC' }
    });
  }

  async getSlaBreaches(): Promise<Ticket[]> {
    const now = new Date();
    return await this.prisma.ticket.findMany({
      where: {
        slaDueDate: { $lt: now },
        status: { $nin: ['RESOLVED', 'CLOSED'] },
        slaBreach: false
      },
      relations: ['assignedTo', 'category', 'priority']
    });
  }

  async updateSlaBreaches(): Promise<void> {
    const now = new Date();
    const overdueTickets = await this.prisma.ticket.findMany({
      where: {
        slaDueDate: { $lt: now },
        status: { $nin: ['RESOLVED', 'CLOSED'] }
      },
      relations: ['assignedTo', 'category', 'priority']
    });

    for (const ticket of overdueTickets) {
      if (!ticket.slaBreach) {
        ticket.slaBreach = true;
        await this.prisma.ticket.upsert(ticket);

        // Send SLA breach notifications
        await this.sendSlaBreachNotifications(ticket);
      }
    }
  }

  /**
   * Send SLA breach notifications to ticket owner and supervisor
   */
  private async sendSlaBreachNotifications(ticket: Ticket): Promise<void> {
    try {
      const now = new Date();
      const overdueHours = Math.floor((now.getTime() - ticket.slaDueDate.getTime()) / (1000 * 60 * 60));

      // Send notification to assigned agent
      if (ticket.assignedTo) {
        await this.notificationService.sendEmail({
          to: ticket.assignedTo.email,
          subject: `🚨 SLA Breach Alert: Ticket ${ticket.ticketNumber}`,
          template: 'ticket-sla-breach',
          data: {
            agentName: `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`,
            ticketNumber: ticket.ticketNumber,
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            ticketCategory: ticket.category?.name || 'Unknown',
            ticketPriority: ticket.priority?.name || 'Unknown',
            slaDueDate: ticket.slaDueDate,
            overdueHours,
            customerName: ticket.user ? `${ticket.user.firstName} ${ticket.user.lastName}` : ticket.broker?.companyName || 'Customer'
          }
        });

        this.logger.log(`SLA breach notification sent to agent ${ticket.assignedTo.email} for ticket ${ticket.ticketNumber}`);
      }

      // Send notification to supervisor/manager
      await this.sendSlaBreachEscalation(ticket, overdueHours);

    } catch (error) {
      this.logger.error(`Failed to send SLA breach notifications for ticket ${ticket.id}:`, error);
    }
  }

  /**
   * Send SLA breach escalation to supervisor/manager
   */
  private async sendSlaBreachEscalation(ticket: Ticket, overdueHours: number): Promise<void> {
    try {
      // Find supervisors and managers
      const supervisors = await this.prisma.user.findMany({
        where: {
          role: In(['ADMIN', 'SUPERVISOR', 'SUPPORT_LEAD']),
          status: UserStatus.ACTIVE
        }
      });

      if (supervisors.length === 0) {
        this.logger.warn(`No supervisors found for SLA breach escalation of ticket ${ticket.ticketNumber}`);
        return;
      }

      const escalationData = {
        ticketNumber: ticket.ticketNumber,
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        ticketCategory: ticket.category?.name || 'Unknown',
        ticketPriority: ticket.priority?.name || 'Unknown',
        slaDueDate: ticket.slaDueDate,
        overdueHours,
        assignedAgent: ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : 'Unassigned',
        customerName: ticket.user ? `${ticket.user.firstName} ${ticket.user.lastName}` : ticket.broker?.companyName || 'Customer',
        escalationLevel: this.getEscalationLevel(overdueHours)
      };

      // Send escalation notifications
      for (const supervisor of supervisors) {
        await this.notificationService.sendEmail({
          to: supervisor.email,
          subject: `🔥 SLA Breach Escalation: Ticket ${ticket.ticketNumber}`,
          template: 'ticket-sla-escalation',
          data: {
            supervisorName: `${supervisor.firstName} ${supervisor.lastName}`,
            ...escalationData
          }
        });
      }

      this.logger.log(`SLA breach escalation sent to ${supervisors.length} supervisors for ticket ${ticket.ticketNumber}`);

    } catch (error) {
      this.logger.error(`Failed to send SLA breach escalation for ticket ${ticket.id}:`, error);
    }
  }

  /**
   * Determine escalation level based on how overdue the ticket is
   */
  private getEscalationLevel(overdueHours: number): string {
    if (overdueHours >= 24) {
      return 'CRITICAL';
    } else if (overdueHours >= 12) {
      return 'HIGH';
    } else if (overdueHours >= 6) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  async getSupportMetrics(): Promise<any> {
    const [
      totalTickets,
      openTickets,
      resolvedTickets,
      overdueTickets,
    ] = await Promise.all([
      this.prisma.count(),
      this.prisma.count({ where: { status: 'OPEN' } }),
      this.prisma.count({ where: { status: 'RESOLVED' } }),
      this.getTicketCountByStatus('OVERDUE'),
    ]);

    // Get average response time (simplified calculation)
    const avgResponseTime = await this.getAverageResponseTime();

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      overdueTickets,
      averageResponseTime: avgResponseTime,
      resolutionRate: totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0
    };
  }

  private async generateTicketNumber(): Promise<string> {
    const prefix = 'TKT';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Get count for this month
    const count = await this.prisma.count({
      where: {
        createdAt: {
          $gte: new Date(year, date.getMonth(), 1),
          $lt: new Date(year, date.getMonth() + 1, 1)
        }
      }
    });

    return `${prefix}${year}${month}${String(count + 1).padStart(4, '0')}`;
  }

  private calculateSlaDueDate(category: TicketCategory, priority: TicketPriority): Date {
    const responseHours = priority.responseTimeHours;
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + responseHours);
    return dueDate;
  }

  private async autoAssignTicket(ticketId: string, categoryId: string): Promise<void> {
    try {
      const category = await this.prisma.ticketCategory.findFirst({
        where: { id: categoryId },
        relations: ['autoAssignAgent']
      });

      // Check if auto-assignment is enabled for this category
      if (!category || !category.enableAutoAssign) {
        return; // Auto-assignment not enabled for this category
      }

      // Query agents by category expertise and current ticket count
      const availableAgents = await this.getAvailableAgentsForCategory(categoryId);

      if (availableAgents.length === 0) {
        this.logger.warn(`No available agents found for category ${categoryId}`);

        // Fall back to default agent if available
        if (category.autoAssignAgent) {
          await this.performTicketAssignment(ticketId, {
            assignedToId: category.autoAssignAgent.id,
            reason: `Auto-assigned to default agent for category "${category.name}" (no available agents found)`
          }, 'system');

          this.logger.log(`Ticket ${ticketId} auto-assigned to default agent ${category.autoAssignAgent.id} (${category.autoAssignAgent.firstName} ${category.autoAssignAgent.lastName})`);
        }
        return;
      }

      // Find the least busy agent with matching skills
      const selectedAgent = await this.findLeastBusyAgent(availableAgents, category);

      if (selectedAgent) {
        // Assign the ticket to the selected agent
        await this.performTicketAssignment(ticketId, {
          assignedToId: selectedAgent.id,
          reason: `Auto-assigned based on category "${category.name}" and workload`
        }, 'system');

        this.logger.log(`Ticket ${ticketId} auto-assigned to agent ${selectedAgent.id} (${selectedAgent.firstName} ${selectedAgent.lastName})`);
      } else {
        // Fallback to default agent if available
        if (category.autoAssignAgent) {
          await this.performTicketAssignment(ticketId, {
            assignedToId: category.autoAssignAgent.id,
            reason: `Auto-assigned to default agent for category "${category.name}" (all agents at capacity)`
          }, 'system');

          this.logger.log(`Ticket ${ticketId} auto-assigned to default agent ${category.autoAssignAgent.id} (${category.autoAssignAgent.firstName} ${category.autoAssignAgent.lastName})`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to auto-assign ticket ${ticketId}:`, error);
    }
  }

  /**
   * Get available agents for a specific category
   */
  private async getAvailableAgentsForCategory(categoryId: string): Promise<User[]> {
    return await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.ticketAssignments', 'assignedTickets')
      .where('user.role = :role', { role: 'SUPPORT' })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('(user.agent_categories::jsonb ? :categoryId OR :categoryId = ANY(user.categories))', {
        categoryId
      })
      .andWhere('(assignedTickets.status IS NULL OR assignedTickets.status IN (:openStatuses))', {
        openStatuses: ['OPEN', 'IN_PROGRESS']
      })
      .addSelect('COUNT(assignedTickets.id)', 'ticketCount')
      .groupBy('user.id')
      .orderBy('ticketCount', 'ASC')
      .limit(10) // Get top 10 least busy agents
      .getMany();
  }

  /**
   * Find the least busy agent from available agents
   */
  private async findLeastBusyAgent(agents: User[], category: TicketCategory): Promise<User | null> {
    if (agents.length === 0) {
      return null;
    }

    // Get current ticket counts and performance scores for all agents in parallel
    const agentMetrics = await Promise.all(
      agents.map(async (agent) => {
        const ticketCount = await this.prisma.count({
          where: {
            assignedToId: agent.id,
            status: ['OPEN', 'IN_PROGRESS']
          }
        });
        const performanceScore = await this.getAgentPerformanceScore(agent.id);
        return {
          agent,
          ticketCount,
          performanceScore
        };
      })
    );

    // Sort agents by ticket count (ascending) and performance score (descending)
    agentMetrics.sort((a, b) => {
      // Primary sort: by ticket count (less busy first)
      if (a.ticketCount !== b.ticketCount) {
        return a.ticketCount - b.ticketCount;
      }

      // Secondary sort: by performance score (higher performance first)
      return b.performanceScore - a.performanceScore;
    });

    // Check if the least busy agent is under the maximum load threshold
    const leastBusyMetric = agentMetrics[0];
    const maxLoad = category.maxConcurrentTickets || 10;

    if (leastBusyMetric.ticketCount >= maxLoad) {
      // Agent is at maximum capacity, look for escalation
      const supervisor = await this.findEscalationAgent(category);
      return supervisor;
    }

    return leastBusyMetric.agent;
  }

  /**
   * Calculate agent performance score for assignment preference
   */
  private async getAgentPerformanceScore(agentId: string): Promise<number> {
    try {
      // Get agent's recent performance metrics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const agentTickets = await this.prisma.ticket.findMany({
        where: {
          assignedToId: agentId,
          createdAt: { $gte: thirtyDaysAgo }
        }
      });

      if (agentTickets.length === 0) {
        return 50; // Neutral score for new agents
      }

      // Calculate metrics
      const resolvedTickets = agentTickets.filter(t => t.status === 'RESOLVED').length;
      const resolutionRate = (resolvedTickets / agentTickets.length) * 100;

      // Calculate average resolution time (lower is better)
      const resolvedWithTime = agentTickets.filter(t =>
        t.status === 'RESOLVED' && t.resolvedAt && t.createdAt
      );

      let avgResolutionHours = 48; // Default
      if (resolvedWithTime.length > 0) {
        const totalTime = resolvedWithTime.reduce((sum, ticket) => {
          const resolutionTime = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
          return sum + resolutionTime;
        }, 0);
        avgResolutionHours = totalTime / resolvedWithTime.length / (1000 * 60 * 60);
      }

      // Calculate performance score (0-100)
      let performanceScore = (resolutionRate * 0.6) + // 60% weight on resolution rate
                           ((Math.max(0, 100 - (avgResolutionHours / 48) * 100)) * 0.4); // 40% weight on resolution time

      return Math.min(100, Math.max(0, performanceScore));
    } catch (error) {
      this.logger.warn(`Failed to calculate performance score for agent ${agentId}:`, error);
      return 50; // Neutral score on error
    }
  }

  /**
   * Find escalation agent when primary agents are at capacity
   */
  private async findEscalationAgent(category: TicketCategory): Promise<User | null> {
    // Try to find a supervisor or team lead for escalation
    const escalationAgents = await this.prisma.user.findMany({
      where: {
        role: In(['ADMIN', 'SUPPORT_LEAD', 'SUPERVISOR']),
        status: UserStatus.ACTIVE
      },
      order: { role: 'ASC' } // Prefer lower escalation level first
    });

    if (escalationAgents.length === 0) {
      return null;
    }

    // Find escalation agent with lowest current load
    const agentLoads = await Promise.all(
      escalationAgents.map(async agent => ({
        agent,
        load: await this.prisma.count({
          where: {
            assignedToId: agent.id,
            status: ['OPEN', 'IN_PROGRESS']
          }
        })
      }))
    );

    agentLoads.sort((a, b) => a.load - b.load);
    return agentLoads[0].agent;
  }

  private async getTicketCountByStatus(status: string): Promise<number> {
    return await this.prisma.count({ where: { status } });
  }

  private async getAverageResponseTime(): Promise<number> {
    // Simplified calculation - in production, you'd want a more sophisticated approach
    const tickets = await this.prisma.ticket.findMany({
      where: { firstResponseAt: { $ne: null } },
      select: ['createdAt', 'firstResponseAt']
    });

    if (tickets.length === 0) return 0;

    const totalTime = tickets.reduce((sum, ticket) => {
      const responseTime = ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
      return sum + responseTime;
    }, 0);

    return totalTime / tickets.length / (1000 * 60 * 60); // Convert to hours
  }

  // Additional methods needed by SupportController
  async getTicketById(ticketId: string, user: any): Promise<Ticket> {
    const ticket = await this.getTicket(ticketId);

    // Check access permissions
    if (user.role === 'USER' && ticket.userId !== user.id) {
      throw new BadRequestException('Access denied: You can only view your own tickets');
    }

    if (user.role === 'BROKER' && ticket.brokerId !== user.brokerId) {
      throw new BadRequestException('Access denied: You can only view tickets for your broker account');
    }

    return ticket;
  }

  async updateTicket(ticketId: string, updateDto: UpdateTicketDto, user: any): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId, user);

    // Only support staff can modify certain fields
    if (user.role === 'USER' || user.role === 'BROKER') {
      const allowedFields = ['description'];
      const hasRestrictedFields = Object.keys(updateDto).some(
        key => !allowedFields.includes(key)
      );

      if (hasRestrictedFields) {
        throw new BadRequestException('You can only modify ticket description');
      }
    }

    return this.performTicketUpdate(ticketId, updateDto);
  }

  async addMessage(ticketId: string, messageData: any, authorId?: string): Promise<TicketMessage> {
    const { content, attachment, isInternal = false } = messageData;

    const createDto: CreateTicketMessageDto = {
      content,
      attachment,
      isInternal
    };

    return this.addTicketMessage(ticketId, createDto, authorId);
  }

  async getMessages(ticketId: string, user: any): Promise<TicketMessage[]> {
    const ticket = await this.getTicketById(ticketId, user);
    return this.getTicketMessages(ticketId);
  }

  async assignTicket(ticketId: string, assigneeId: string, notes: string, assignedById: string): Promise<Ticket> {
    const assignDto: AssignTicketDto = {
      assignedToId: assigneeId,
      reason: notes
    };

    return this.performTicketAssignment(ticketId, assignDto, assignedById);
  }

  async closeTicket(ticketId: string, resolutionNotes: string, satisfactionRating?: number, user?: any): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId, user);

    const updateDto: UpdateTicketDto = {
      status: 'CLOSED',
      resolvedAt: new Date(),
      resolutionNotes,
      satisfactionRating
    };

    return this.performTicketUpdate(ticketId, updateDto);
  }

  async getCategories(): Promise<TicketCategory[]> {
    return this.getTicketCategories();
  }

  async getPriorities(): Promise<TicketPriority[]> {
    return this.getTicketPriorities();
  }

  async getSLAStatus(ticketId: string, user: any): Promise<any> {
    const ticket = await this.getTicketById(ticketId, user);
    const now = new Date();

    const createdAt = new Date(ticket.createdAt);
    const slaDeadline = ticket.slaDueDate ? new Date(ticket.slaDueDate) : null;
    const firstResponseAt = ticket.firstResponseAt ? new Date(ticket.firstResponseAt) : null;
    const resolvedAt = ticket.resolvedAt ? new Date(ticket.resolvedAt) : null;

    // Calculate times
    const responseTime = firstResponseAt ?
      (firstResponseAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60) : null;
    const resolutionTime = resolvedAt ?
      (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60) : null;

    // Determine SLA status
    let status: 'COMPLIANT' | 'WARNING' | 'BREACHED' = 'COMPLIANT';
    let timeToBreached = null;
    let isBreached = false;

    if (slaDeadline) {
      const timeToDeadline = slaDeadline.getTime() - now.getTime();

      if (timeToDeadline < 0) {
        status = 'BREACHED';
        isBreached = true;
        timeToBreached = Math.abs(timeToDeadline) / (1000 * 60 * 60);
      } else if (timeToDeadline < 2 * 60 * 60 * 1000) { // Less than 2 hours
        status = 'WARNING';
        timeToBreached = timeToDeadline / (1000 * 60 * 60);
      }
    }

    // Check response time compliance
    if (!firstResponseAt && ticket.priority?.responseTimeHours) {
      const maxResponseTime = ticket.priority.responseTimeHours * 60 * 60 * 1000;
      const timeSinceCreation = now.getTime() - createdAt.getTime();

      if (timeSinceCreation > maxResponseTime) {
        status = 'BREACHED';
        isBreached = true;
      }
    }

    return {
      ticketId,
      ticketNumber: ticket.ticketNumber,
      status,
      isBreached,
      createdAt: ticket.createdAt,
      slaDeadline: ticket.slaDueDate,
      firstResponseAt: ticket.firstResponseAt,
      resolvedAt: ticket.resolvedAt,
      responseTime,
      resolutionTime,
      timeToBreached,
      priority: ticket.priority?.name,
      category: ticket.category?.name,
      metrics: {
        responseTarget: ticket.priority?.responseTimeHours,
        resolutionTarget: ticket.priority?.resolutionTimeHours
      }
    };
  }

  // Additional helper methods for job processing
  async getAssignmentRules(): Promise<any[]> {
    // Return auto-assignment rules - would typically come from settings database
    return [
      {
        category: 'TECHNICAL',
        assignToRole: 'SUPPORT',
        maxLoad: 10
      },
      {
        category: 'BILLING',
        assignToRole: 'FINANCE',
        maxLoad: 5
      },
    ];
  }

  async getEscalationUsers(escalationType: string): Promise<any[]> {
    // Get users who can handle escalations
    return await this.prisma.user.findMany({
      where: {
        role: In(['ADMIN', 'SUPPORT']),
        status: UserStatus.ACTIVE
      }
    });
  }

  async archiveTicket(ticketId: string): Promise<void> {
    await this.prisma.ticket.update(ticketId, {
      isArchived: true,
      archivedAt: new Date()
    });
  }

  async generateSatisfactionSurveyLink(ticketId: string, clientId: string): Promise<string> {
    // Generate satisfaction survey link
    const surveyToken = Buffer.from(`${ticketId}:${clientId}:${Date.now()}`).toString('base64');
    return `${process.env.FRONTEND_URL}/support/survey/${surveyToken}`;
  }
}
