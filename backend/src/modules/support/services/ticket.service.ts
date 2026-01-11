import { Injectable } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { TicketStatus, TicketPriority } from '../enums/support.enum';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TicketService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('support-tickets')
    private readonly supportQueue: Queue) {}

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
      dateRange
    } = filters;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priorityId = priority;
    }

    if (assignedTo) {
      where.assignedToId = assignedTo;
    }

    if (userId) {
      where.userId = userId;
    }

    if (brokerId) {
      where.brokerId = brokerId;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      };
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          category: true,
          assignedTo: true,
          user: true,
          broker: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.ticket.count({ where })
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters
    };
  }

  async getTicketById(id: string) {
    return await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        category: true,
        messages: {
          include: {
            author: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        user: true,
        broker: true,
        assignedTo: true
      }
    });
  }

  async createTicket(createTicketDto: {
    subject: string;
    description: string;
    categoryId: string;
    priority?: string;
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
    const category = await this.prisma.ticketCategory.findUnique({
      where: { id: createTicketDto.categoryId },
      include: {
        sla: true
      }
    });

    if (!category) {
      throw new Error('Ticket category not found');
    }

    // Generate unique ticket number
    const ticketNumber = await this.generateTicketNumber();

    // Calculate SLA due date based on category default
    const slaDueDate = new Date();
    slaDueDate.setHours(slaDueDate.getHours() + category.defaultSlaHours);

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        subject: createTicketDto.subject,
        description: createTicketDto.description,
        categoryId: createTicketDto.categoryId,
        priorityId: createTicketDto.priority || 'MEDIUM',
        userId: createTicketDto.userId,
        brokerId: createTicketDto.brokerId,
        slaDueDate,
        tags: createTicketDto.tags || [],
        customFields: {
          attachments: createTicketDto.attachments,
          metadata: createTicketDto.metadata
        }
      },
      include: {
        category: true
      }
    });

    // Send notifications
    await this.supportQueue.add('send-ticket-confirmation', {
      ticketId: ticket.id
    });

    return ticket;
  }

  async updateTicket(id: string, updateTicketDto: any) {
    await this.prisma.ticket.update({
      where: { id },
      data: updateTicketDto
    });
    return this.getTicketById(id);
  }

  async updateTicketStatus(
    id: string,
    status: string,
    notes?: string,
    authorId?: string
  ) {
    const ticket = await this.getTicketById(id);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const previousStatus = ticket.status;
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === TicketStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    }

    if (status === TicketStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    await this.prisma.ticket.update({
      where: { id },
      data: updateData
    });

    // Add status change message
    if (notes || status !== previousStatus) {
      await this.addTicketMessage(id, {
        content: notes || `Status changed from ${previousStatus} to ${status}`,
        isInternal: !authorId,
        authorId
      });
    }

    // Queue status change notifications
    await this.supportQueue.add('ticket-status-changed', {
      ticketId: id,
      previousStatus,
      newStatus: status,
      notes
    });

    return this.getTicketById(id);
  }

  async assignTicket(ticketId: string, assignedTo: string, assignedBy?: string) {
    const ticket = await this.getTicketById(ticketId);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId: assignedTo,
        updatedAt: new Date()
      }
    });

    // Add assignment message
    if (assignedBy) {
      await this.addTicketMessage(ticketId, {
        content: `Ticket assigned to support agent`,
        isInternal: true,
        authorId: assignedBy
      });
    }

    // Queue assignment notification
    await this.supportQueue.add('ticket-assigned', {
      ticketId,
      assignedTo,
      assignedBy
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
    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        content: messageData.content,
        isInternal: messageData.isInternal,
        authorId: messageData.authorId,
        attachments: messageData.attachments
      }
    });

    // Update ticket first response time if this is the first public response
    const ticket = await this.getTicketById(ticketId);
    if (ticket && !ticket.firstResponseAt && !messageData.isInternal) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          firstResponseAt: new Date()
        }
      });
    }

    // Queue message notification
    await this.supportQueue.add('new-ticket-message', {
      ticketId,
      messageId: message.id,
      isInternal: messageData.isInternal
    });

    return message;
  }

  async getTicketMessages(ticketId: string, includeInternal = false) {
    return await this.prisma.ticketMessage.findMany({
      where: {
        ticketId,
        ...(includeInternal ? {} : { isInternal: false })
      },
      include: {
        author: true
      },
      orderBy: {
        createdAt: 'asc'
      }
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

    const dateFilter = {
      gte: startDate,
      lte: now
    };

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
      this.prisma.ticket.count({ where: { createdAt: dateFilter } }),
      this.prisma.ticket.count({
        where: {
          createdAt: dateFilter,
          status: TicketStatus.NEW
        }
      }),
      this.prisma.ticket.count({
        where: {
          createdAt: dateFilter,
          status: TicketStatus.OPEN
        }
      }),
      this.prisma.ticket.count({
        where: {
          resolvedAt: dateFilter
        }
      }),
      this.prisma.ticket.count({
        where: {
          closedAt: dateFilter
        }
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { createdAt: dateFilter },
        _count: { id: true }
      }),
      this.prisma.ticket.groupBy({
        by: ['priorityId'],
        where: { createdAt: dateFilter },
        _count: { id: true }
      }),
      this.getAverageResolutionTime(startDate, now),
    ]);

    return {
      period,
      totalTickets,
      newTickets,
      openTickets,
      resolvedTickets,
      closedTickets,
      ticketsByStatus: ticketsByStatus.map(item => ({
        status: item.status,
        count: item._count.id
      })),
      ticketsByPriority: ticketsByPriority.map(item => ({
        priority: item.priorityId,
        count: item._count.id
      })),
      avgResolutionTime
    };
  }

  private async generateTicketNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Find the last ticket number for today
    const lastTicket = await this.prisma.ticket.findFirst({
      where: {
        ticketNumber: {
          startsWith: `TICKET-${dateStr}-`
        }
      },
      orderBy: {
        ticketNumber: 'desc'
      }
    });

    let sequence = 1;
    if (lastTicket) {
      const lastSequence = parseInt(lastTicket.ticketNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `TICKET-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }

  private async createTicketSLA(ticketId: string, sla: any) {
    await this.prisma.ticketSLA.create({
      data: {
        ticketId,
        slaId: sla.id,
        responseDueAt: new Date(Date.now() + sla.firstResponseMinutes * 60 * 1000),
        resolutionDueAt: new Date(Date.now() + sla.resolutionMinutes * 60 * 1000)
      }
    });
  }

  private async getAverageResolutionTime(startDate: Date, endDate: Date): Promise<number> {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        resolvedAt: {
          gte: startDate,
          lte: endDate
        },
        status: TicketStatus.RESOLVED
      },
      select: {
        resolvedAt: true,
        createdAt: true
      }
    });

    if (tickets.length === 0) {
      return 0;
    }

    const totalMinutes = tickets.reduce((sum, ticket) => {
      const resolutionTime = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
      return sum + resolutionTime / (1000 * 60);
    }, 0);

    return Math.round(totalMinutes / tickets.length);
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
        ticket.priorityId,
        ticket.category?.name || '',
        ticket.createdAt.toISOString(),
        ticket.resolvedAt?.toISOString() || '',
        ticket.assignedTo?.firstName + ' ' + ticket.assignedTo?.lastName || '',
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
    await this.prisma.ticketMessage.deleteMany({
      where: { ticketId: id }
    });

    // Delete the ticket
    await this.prisma.ticket.delete({
      where: { id }
    });

    return { success: true, message: 'Ticket deleted successfully' };
  }
}
