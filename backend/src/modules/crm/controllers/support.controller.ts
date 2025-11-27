import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { SupportService } from '../services/support.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('CRM - Support')
@ApiBearerAuth()
@Controller('api/v1/crm/support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Create new support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async createTicket(
    @Body() createTicketDto: CreateTicketDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const ticket = await this.supportService.createTicket({
      ...createTicketDto,
      userId,
    });

    return {
      success: true,
      message: 'Ticket created successfully',
      data: ticket,
    };
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List tickets with filtering' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'priority', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @ApiQuery({ name: 'assignedTo', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getTickets(
    @Query() query: any,
    @Req() req: any,
  ) {
    const filters = {
      status: query.status,
      category: query.category,
      priority: query.priority,
      assignedTo: query.assignedTo,
      userId: req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPPORT ? req.user.id : query.userId,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
    };

    const result = await this.supportService.getTickets(filters);

    return {
      success: true,
      data: result.tickets,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket details' })
  @ApiResponse({ status: 200, description: 'Ticket details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getTicketById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const ticket = await this.supportService.getTicketById(id, req.user);

    return {
      success: true,
      data: ticket,
    };
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Update ticket' })
  @ApiResponse({ status: 200, description: 'Ticket updated successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @HttpCode(HttpStatus.OK)
  async updateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Req() req: any,
  ) {
    const ticket = await this.supportService.updateTicket(id, updateTicketDto, req.user);

    return {
      success: true,
      message: 'Ticket updated successfully',
      data: ticket,
    };
  }

  @Post('tickets/:id/messages')
  @UseInterceptors(FileInterceptor('attachment'))
  @ApiOperation({ summary: 'Add message to ticket' })
  @ApiResponse({ status: 201, description: 'Message added successfully' })
  @ApiConsumes('multipart/form-data')
  async addMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('content') content: string,
    @UploadedFile() attachment?: Express.Multer.File,
    @Req() req: any,
  ) {
    const messageData = {
      content,
      attachment,
      authorId: req.user.id,
    };

    const message = await this.supportService.addMessage(id, messageData);

    return {
      success: true,
      message: 'Message added successfully',
      data: message,
    };
  }

  @Get('tickets/:id/messages')
  @ApiOperation({ summary: 'Get ticket messages' })
  @ApiResponse({ status: 200, description: 'Ticket messages retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getTicketMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const messages = await this.supportService.getTicketMessages(id, req.user);

    return {
      success: true,
      data: messages,
    };
  }

  @Patch('tickets/:id/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Assign ticket to staff' })
  @ApiResponse({ status: 200, description: 'Ticket assigned successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async assignTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignmentData: { assignedToId: string; reason: string },
    @Req() req: any,
  ) {
    const assignment = await this.supportService.assignTicket(
      id,
      assignmentData.assignedToId,
      assignmentData.reason,
      req.user.id,
    );

    return {
      success: true,
      message: 'Ticket assigned successfully',
      data: assignment,
    };
  }

  @Patch('tickets/:id/close')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Close ticket' })
  @ApiResponse({ status: 200, description: 'Ticket closed successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async closeTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() closeData: { reason: string; satisfactionRating?: number },
    @Req() req: any,
  ) {
    const ticket = await this.supportService.closeTicket(
      id,
      closeData.reason,
      closeData.satisfactionRating,
      req.user,
    );

    return {
      success: true,
      message: 'Ticket closed successfully',
      data: ticket,
    };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get ticket categories' })
  @ApiResponse({ status: 200, description: 'Ticket categories retrieved successfully' })
  async getCategories() {
    const categories = await this.supportService.getCategories();

    return {
      success: true,
      data: categories,
    };
  }

  @Get('priorities')
  @ApiOperation({ summary: 'Get ticket priorities' })
  @ApiResponse({ status: 200, description: 'Ticket priorities retrieved successfully' })
  async getPriorities() {
    const priorities = await this.supportService.getPriorities();

    return {
      success: true,
      data: priorities,
    };
  }

  @Get('tickets/:id/sla')
  @ApiOperation({ summary: 'Get SLA status for ticket' })
  @ApiResponse({ status: 200, description: 'SLA status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getSLAStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const slaStatus = await this.supportService.getSLAStatus(id, req.user);

    return {
      success: true,
      data: slaStatus,
    };
  }
}