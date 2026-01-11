import { 
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { UserRole } from "../../../common/enums/user-role.enum";
import { TicketService } from '../services/ticket.service';
import { SlaService } from '../services/sla.service';
import { NotificationService } from "../../notifications/services/notification.service";
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { AddMessageDto } from '../dto/add-message.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { UpdateTicketStatusDto } from '../dto/update-ticket-status.dto';
import { AssignTicketDto } from '../dto/assign-ticket.dto';
import { TicketFilterDto } from '../dto/ticket-filter.dto';
// COMMENTED OUT (TypeORM entity deleted): import { Ticket, TicketStatus, TicketPriority } from '../entities/ticket.entity';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly slaService: SlaService,
    private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all tickets with filtering' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  async getTickets(@Query() filters: TicketFilterDto, @Req() req) {
    const tickets = await this.ticketService.getTickets(filters, req.user);
    return {
      success: true,
      data: tickets,
      message: 'Tickets retrieved successfully'
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get ticket statistics' })
  @ApiResponse({ status: 200, description: 'Ticket statistics retrieved successfully' })
  async getTicketStats(@Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const stats = await this.ticketService.getTicketStats(period);
    return {
      success: true,
      data: stats,
      message: 'Ticket statistics retrieved successfully'
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export tickets to CSV' })
  @ApiResponse({ status: 200, description: 'Tickets exported successfully' })
  async exportTickets(@Query() filters: TicketFilterDto) {
    const csvData = await this.ticketService.exportTickets(filters);
    return csvData;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  @ApiResponse({ status: 200, description: 'Ticket retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicketById(@Param('id') id: string) {
    return await this.ticketService.getTicketById(id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get ticket messages' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  async getTicketMessages(
    @Param('id') id: string,
    @Query('includeInternal') includeInternal: boolean = false
  ) {
    return await this.ticketService.getTicketMessages(id, includeInternal);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createTicket(@Body() createTicketDto: CreateTicketDto, @Req() req) {
    const ticket = await this.ticketService.createTicket({
      ...createTicketDto,
      userId: req.user.id
    });

    // Send WebSocket notification for new ticket
    await this.notificationService.sendTicketNotification('ticket_created', ticket);

    // Create SLA tracking for the ticket
    await this.slaService.createTicketSLA(ticket.id, ticket.categoryId, ticket.priority);

    return {
      success: true,
      data: ticket,
      message: 'Ticket created successfully'
    };
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Add message to ticket' })
  @ApiResponse({ status: 201, description: 'Message added successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async addTicketMessage(
    @Param('id') id: string,
    @Body() addMessageDto: AddMessageDto,
    @Req() req
  ) {
    const message = await this.ticketService.addTicketMessage(id, {
      message: addMessageDto.message,
      isInternal: addMessageDto.isInternal || false,
      authorId: req.user.id,
      authorType: req.user.role === UserRole.SUPPORT ? 'AGENT' : 'USER',
      attachments: addMessageDto.attachments
    });

    // Get ticket details for notification
    const ticket = await this.ticketService.getTicketById(id);

    // Send WebSocket notification for new message
    await this.notificationService.sendTicketNotification('message_added', {
      ticket,
      message,
      author: req.user
    });

    return {
      success: true,
      data: message,
      message: 'Message added successfully'
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ticket' })
  @ApiResponse({ status: 200, description: 'Ticket updated successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async updateTicket(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto
  ) {
    return await this.ticketService.updateTicket(id, updateTicketDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update ticket status' })
  @ApiResponse({ status: 200, description: 'Ticket status updated successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPPORT, UserRole.ADMIN)
  async updateTicketStatus(
    @Param('id') id: string,
    @Body() updateTicketStatusDto: UpdateTicketStatusDto,
    @Req() req
  ) {
    const ticket = await this.ticketService.updateTicketStatus(
      id,
      updateTicketStatusDto.status,
      updateTicketStatusDto.notes,
      req.user.id
    );

    // Send WebSocket notification for status change
    await this.notificationService.sendTicketNotification('status_changed', {
      ticket,
      oldStatus: updateTicketStatusDto.previousStatus,
      newStatus: updateTicketStatusDto.status,
      changedBy: req.user
    });

    // Handle SLA for resolved tickets
    if (updateTicketStatusDto.status === TicketStatus.RESOLVED) {
      await this.slaService.markTicketResolved(id);
    }

    return {
      success: true,
      data: ticket,
      message: 'Ticket status updated successfully'
    };
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign ticket to agent' })
  @ApiResponse({ status: 200, description: 'Ticket assigned successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPPORT, UserRole.ADMIN)
  async assignTicket(
    @Param('id') id: string,
    @Body() assignTicketDto: AssignTicketDto,
    @Req() req
  ) {
    const ticket = await this.ticketService.assignTicket(
      id,
      assignTicketDto.assignedTo,
      req.user.id
    );

    // Send WebSocket notification for assignment
    await this.notificationService.sendTicketNotification('ticket_assigned', {
      ticket,
      assignedTo: assignTicketDto.assignedTo,
      assignedBy: req.user
    });

    return {
      success: true,
      data: ticket,
      message: 'Ticket assigned successfully'
    };
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reopen a closed ticket' })
  @ApiResponse({ status: 200, description: 'Ticket reopened successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async reopenTicket(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req
  ) {
    const ticket = await this.ticketService.updateTicketStatus(
      id,
      TicketStatus.REOPENED,
      reason,
      req.user.id
    );

    // Send WebSocket notification for reopening
    await this.notificationService.sendTicketNotification('ticket_reopened', {
      ticket,
      reason,
      reopenedBy: req.user
    });

    return {
      success: true,
      data: ticket,
      message: 'Ticket reopened successfully'
    };
  }

  @Post(':id/escalate')
  @ApiOperation({ summary: 'Escalate ticket to higher priority' })
  @ApiResponse({ status: 200, description: 'Ticket escalated successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPPORT, UserRole.ADMIN)
  async escalateTicket(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Body('priority') priority: TicketPriority,
    @Req() req
  ) {
    const ticket = await this.ticketService.escalateTicket(id, priority, reason, req.user.id);

    // Send WebSocket notification for escalation
    await this.notificationService.sendTicketNotification('ticket_escalated', {
      ticket,
      reason,
      escalatedBy: req.user
    });

    return {
      success: true,
      data: ticket,
      message: 'Ticket escalated successfully'
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete ticket' })
  @ApiResponse({ status: 204, description: 'Ticket deleted successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async deleteTicket(@Param('id') id: string) {
    await this.ticketService.deleteTicket(id);
  }
}
