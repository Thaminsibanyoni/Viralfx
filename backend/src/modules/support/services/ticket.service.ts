import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { Ticket, TicketStatus, TicketPriority } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketCategory } from '../entities/ticket-category.entity';
import { TicketSLA } from '../entities/ticket-sla.entity';
import { SLA } from '../entities/sla.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly ticketMessageRepository: Repository<TicketMessage>,
    @InjectRepository(TicketCategory)
    private readonly ticketCategoryRepository: Repository<TicketCategory>,
    @InjectRepository(TicketSLA)
    private readonly ticketSLARepository: Repository<TicketSLA>,
    @InjectRepository(SLA)
    private readonly slaRepository: Repository<SLA>,
    @InjectQueue('support-tickets')
    private readonly supportQueue: Queue,
  ) {}

  async getTickets(filters: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    assignedTo?: string;
    userId?: string;
    brokerId?: string;
    categoryId?: string;
    dateRange?: { start: Date; end: Date };
  }) {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assignedTo,
      userId,
      brokerId,
      categoryId,
      dateRange,
    } = filters;

    const queryBuilder = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.category', 'category')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedUser')
      .leftJoinAndSelect('ticket.user', 'user')
      .leftJoinAndSelect('ticket.broker', 'broker')
      .leftJoinAndSelect('ticket.ticketSLA', 'ticketSLA')
      .leftJoinAndSelect('ticketSLA.sla', 'sla')
      .where('1 = 1');

    if (status) {
      queryBuilder.andWhere('ticket.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('ticket.priority = :priority', { priority });
    }

    if (assignedTo) {
      queryBuilder.andWhere('ticket.assignedTo = :assignedTo', { assignedTo });
    }

    if (userId) {
      queryBuilder.andWhere('ticket.userId = :userId', { userId });
    }

    if (brokerId) {
      queryBuilder.andWhere('ticket.brokerId = :brokerId', { brokerId });
    }

    if (categoryId) {
      queryBuilder.andWhere('ticket.categoryId = :categoryId', { categoryId });
    }

    if (dateRange) {
      queryBuilder.andWhere('ticket.createdAt BETWEEN :start AND :end', {
        start: dateRange.start,
        end: dateRange.end,
      });
    }

    const [tickets, total] = await queryBuilder
      .orderBy('ticket.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters,
    };
  }

  async getTicketById(id: string): Promise<Ticket> {
    return await this.ticketRepository.findOne({
      where: { id },
      relations: [
        'category',
        'messages',
        'messages.author',
        'ticketSLA',
        'ticketSLA.sla',
        'user',
        'broker',
        'assignedTo',
      ],
    });
  }

  async createTicket(createTicketDto: {
    subject: string;
    description: string;
    categoryId: string;
    priority?: TicketPriority;
    userId?: string;
    brokerId?: string;
    tags?: string[];
    attachments?: Array<{
      url: string;
      name: string;
      size: number;
      type: string;
    }>;
    metadata?: Record<string, any>;
  }) {
    const category = await this.ticketCategoryRepository.findOne({
      where: { id: createTicketDto.categoryId },
      relations: ['sla'],
    });

    if (!category) {
      throw new Error('Ticket category not found');
    }

    // Generate unique ticket number
    const ticketNumber = await this.generateTicketNumber();

    const ticket = this.ticketRepository.create({
      ticketNumber,
      subject: createTicketDto.subject,
      description: createTicketDto.description,
      categoryId: createTicketDto.categoryId,
      priority: createTicketDto.priority || category.defaultPriority || TicketPriority.MEDIUM,
      userId: createTicketDto.userId,
      brokerId: createTicketDto.brokerId,
      assignedTo: category.defaultAssignedTo,
      tags: createTicketDto.tags,
      attachments: createTicketDto.attachments,
      metadata: createTicketDto.metadata,
    });

    const savedTicket = await this.ticketRepository.save(ticket);

    // Create SLA tracking if category has SLA
    if (category.sla) {
      await this.createTicketSLA(savedTicket.id, category.sla);
    }

    // Assign ticket if default assignee is set
    if (category.defaultAssignedTo) {
      await this.supportQueue.add('assign-ticket', {
        ticketId: savedTicket.id,
        assignedTo: category.defaultAssignedTo,
      });
    }

    // Send notifications
    await this.supportQueue.add('send-ticket-confirmation', {
      ticketId: savedTicket.id,
    });

    return savedTicket;
  }

  async updateTicket(id: string, updateTicketDto: Partial<Ticket>) {
    await this.ticketRepository.update(id, updateTicketDto);
    return this.getTicketById(id);
  }

  async updateTicketStatus(
    id: string,
    status: TicketStatus,
    notes?: string,
    authorId?: string
  ) {
    const ticket = await this.getTicketById(id);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const previousStatus = ticket.status;
    await this.ticketRepository.update(id, {
      status,
      updatedAt: new Date(),
      ...(status === TicketStatus.RESOLVED && { resolvedAt: new Date() }),
      ...(status === TicketStatus.CLOSED && { closedAt: new Date() }),
    });

    // Add status change message
    if (notes || status !== previousStatus) {
      await this.addTicketMessage(id, {
        content: notes || `Status changed from ${previousStatus} to ${status}`,
        isInternal: !authorId,
        authorId,
      });
    }

    // Queue status change notifications
    await this.supportQueue.add('ticket-status-changed', {
      ticketId: id,
      previousStatus,
      newStatus: status,
      notes,
    });

    return this.getTicketById(id);
  }

  async assignTicket(ticketId: string, assignedTo: string, assignedBy?: string) {
    const ticket = await this.getTicketById(ticketId);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await this.ticketRepository.update(ticketId, {
      assignedTo,
      updatedAt: new Date(),
    });

    // Add assignment message
    if (assignedBy) {
      await this.addTicketMessage(ticketId, {
        content: `Ticket assigned to support agent`,
        isInternal: true,
        authorId: assignedBy,
      });
    }

    // Queue assignment notification
    await this.supportQueue.add('ticket-assigned', {
      ticketId,
      assignedTo,
      assignedBy,
    });

    return this.getTicketById(ticketId);
  }

  async addTicketMessage(ticketId: string, messageData: {
    content: string;
    isInternal: boolean;
    authorId: string;
    attachments?: Array<{
      url: string;
      name: string;
      size: number;
      type: string;
    }>;
  }) {
    const message = this.ticketMessageRepository.create({
      ticketId,
      content: messageData.content,
      isInternal: messageData.isInternal,
      authorId: messageData.authorId,
      attachments: messageData.attachments,
    });

    const savedMessage = await this.ticketMessageRepository.save(message);

    // Update ticket first response time if this is the first public response
    const ticket = await this.getTicketById(ticketId);
    if (ticket && !ticket.firstResponseAt && !messageData.isInternal) {
      await this.ticketRepository.update(ticketId, {
        firstResponseAt: new Date(),
      });
    }

    // Queue message notification
    await this.supportQueue.add('new-ticket-message', {
      ticketId,
      messageId: savedMessage.id,
      isInternal: messageData.isInternal,
    });

    return savedMessage;
  }

  async getTicketMessages(ticketId: string, includeInternal = false) {
    return await this.ticketMessageRepository.find({
      where: { ticketId },
      ...(includeInternal ? {} : { where: { isInternal: false } }),
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });
  }

  async getTicketStats(period: 'day' | 'week' | 'month' | 'year' = 'month') {
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
      newTickets,
      openTickets,
      resolvedTickets,
      closedTickets,
      ticketsByStatus,
      ticketsByPriority,
      avgResolutionTime,
    ] = await Promise.all([
      this.ticketRepository.count({ where: { createdAt: Between(startDate, now) } }),
      this.ticketRepository.count({
        where: {
          createdAt: Between(startDate, now),
          status: TicketStatus.NEW,
        },
      }),
      this.ticketRepository.count({
        where: {
          createdAt: Between(startDate, now),
          status: TicketStatus.OPEN,
        },
      }),
      this.ticketRepository.count({
        where: {
          resolvedAt: Between(startDate, now),
        },
      }),
      this.ticketRepository.count({
        where: {
          closedAt: Between(startDate, now),
        },
      }),
      this.ticketRepository
        .createQueryBuilder('ticket')
        .select('ticket.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
        .groupBy('ticket.status')
        .getRawMany(),
      this.ticketRepository
        .createQueryBuilder('ticket')
        .select('ticket.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
        .groupBy('ticket.priority')
        .getRawMany(),
      this.getAverageResolutionTime(startDate, now),
    ]);

    return {
      period,
      totalTickets,
      newTickets,
      openTickets,
      resolvedTickets,
      closedTickets,
      ticketsByStatus,
      ticketsByPriority,
      avgResolutionTime,
    };
  }

  private async generateTicketNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Find the last ticket number for today
    const lastTicket = await this.ticketRepository.findOne({
      where: {
        ticketNumber: Like(`TICKET-${dateStr}-%`),
      },
      order: { ticketNumber: 'DESC' },
    });

    let sequence = 1;
    if (lastTicket) {
      const lastSequence = parseInt(lastTicket.ticketNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `TICKET-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }

  private async createTicketSLA(ticketId: string, sla: SLA) {
    const ticketSLA = this.ticketSLARepository.create({
      ticketId,
      slaId: sla.id,
      responseDueAt: new Date(Date.now() + sla.responseTime * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + sla.resolutionTime * 60 * 1000),
    });

    await this.ticketSLARepository.save(ticketSLA);
  }

  private async getAverageResolutionTime(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('AVG(EXTRACT(EPOCH FROM (ticket.resolvedAt - ticket.createdAt)) / 60)', 'avgMinutes')
      .where('ticket.resolvedAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('ticket.status = :status', { status: TicketStatus.RESOLVED })
      .getRawOne();

    return Math.round(parseFloat(result?.avgMinutes || 0));
  }

  async exportTickets(filters: any) {
    const tickets = await this.getTickets({ ...filters, limit: 10000 });

    const csvData = [
      [
        'Ticket Number',
        'Subject',
        'Status',
        'Priority',
        'Category',
        'Created At',
        'Resolved At',
        'Assigned To',
      ],
      ...tickets.tickets.map(ticket => [
        ticket.ticketNumber,
        ticket.subject,
        ticket.status,
        ticket.priority,
        ticket.category?.name || '',
        ticket.createdAt.toISOString(),
        ticket.resolvedAt?.toISOString() || '',
        ticket.assignedTo?.name || '',
      ]),
    ];

    return csvData.map(row => row.join(',')).join('\n');
  }

  async deleteTicket(id: string) {
    const ticket = await this.getTicketById(id);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Delete related records first due to foreign key constraints
    await this.ticketMessageRepository.delete({ ticketId: id });
    await this.ticketSLARepository.delete({ ticketId: id });

    // Delete the ticket
    await this.ticketRepository.delete(id);

    return { success: true, message: 'Ticket deleted successfully' };
  }
}