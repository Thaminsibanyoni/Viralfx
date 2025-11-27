import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiForbiddenResponse } from '@nestjs/swagger';
import { ClientsService } from '../services/clients.service';
import { CreateClientRecordDto } from '../dto/create-client-record.dto';
import { UpdateClientRecordDto } from '../dto/update-client-record.dto';
import { CreateClientInteractionDto } from '../dto/create-client-interaction.dto';
import { UpdateClientInteractionDto } from '../dto/update-client-interaction.dto';
import { UserRole } from '../../users/entities/user.entity';
import { PermissionGuard } from '../guards/permission.guard';
import { CheckPermission } from '../decorators/check-permission.decorator';

@ApiTags('CRM - Clients')
@ApiBearerAuth()
@Controller('api/v1/crm/clients')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // Client Record Endpoints
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.COMPLIANCE)
  @ApiOperation({ summary: 'Create new client record' })
  @ApiResponse({ status: 201, description: 'Client record created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @CheckPermission('crm.clients.create')
  async createClientRecord(@Body() createClientRecordDto: CreateClientRecordDto) {
    const client = await this.clientsService.createClientRecord(createClientRecordDto);

    return {
      success: true,
      message: 'Client record created successfully',
      data: client,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List client records with filtering' })
  @ApiResponse({ status: 200, description: 'Client records retrieved successfully' })
  @ApiQuery({ name: 'brokerId', required: false, type: String })
  @ApiQuery({ name: 'segment', required: false, enum: ['VIP', 'ACTIVE', 'DORMANT', 'HIGH_RISK', 'STANDARD'] })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'CHURNED'] })
  @ApiQuery({ name: 'source', required: false, enum: ['ORGANIC', 'REFERRAL', 'ADVERTISING', 'PARTNER', 'BROKER'] })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or email' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'tags', required: false, type: [String] })
  @ApiQuery({ name: 'minRiskScore', required: false, type: Number })
  @ApiQuery({ name: 'maxRiskScore', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getClientRecords(@Query() query: any) {
    const filters = {
      brokerId: query.brokerId,
      segment: query.segment,
      status: query.status,
      source: query.source,
      search: query.search,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      tags: query.tags ? (Array.isArray(query.tags) ? query.tags : [query.tags]) : undefined,
      minRiskScore: query.minRiskScore ? parseFloat(query.minRiskScore) : undefined,
      maxRiskScore: query.maxRiskScore ? parseFloat(query.maxRiskScore) : undefined,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
    };

    const result = await this.clientsService.getClientRecords(filters);

    return {
      success: true,
      data: result.clientRecords,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get('analytics')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.COMPLIANCE)
  @ApiOperation({ summary: 'Get client analytics and insights' })
  @ApiResponse({ status: 200, description: 'Client analytics retrieved successfully' })
  @ApiQuery({ name: 'brokerId', required: false, type: String })
  @ApiQuery({ name: 'segment', required: false, enum: ['VIP', 'ACTIVE', 'DORMANT', 'HIGH_RISK', 'STANDARD'] })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'CHURNED'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getClientAnalytics(@Query() query: any) {
    const filters = {
      brokerId: query.brokerId,
      segment: query.segment,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    const analytics = await this.clientsService.getClientAnalytics(filters);

    return {
      success: true,
      data: analytics,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client record details' })
  @ApiResponse({ status: 200, description: 'Client record details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Client record not found' })
  async getClientRecord(@Param('id', ParseUUIDPipe) id: string) {
    const client = await this.clientsService.getClientRecord(id);

    return {
      success: true,
      data: client,
    };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get client record by user ID' })
  @ApiResponse({ status: 200, description: 'Client record retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Client record not found' })
  async getClientRecordByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    const client = await this.clientsService.getClientRecordByUserId(userId);

    return {
      success: true,
      data: client,
    };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.COMPLIANCE)
  @ApiOperation({ summary: 'Update client record' })
  @ApiResponse({ status: 200, description: 'Client record updated successfully' })
  @ApiResponse({ status: 404, description: 'Client record not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @HttpCode(HttpStatus.OK)
  @CheckPermission('crm.clients.update')
  async updateClientRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClientRecordDto: UpdateClientRecordDto,
  ) {
    const client = await this.clientsService.updateClientRecord(id, updateClientRecordDto);

    return {
      success: true,
      message: 'Client record updated successfully',
      data: client,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete client record (soft delete)' })
  @ApiResponse({ status: 200, description: 'Client record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Client record not found' })
  @HttpCode(HttpStatus.OK)
  async deleteClientRecord(@Param('id', ParseUUIDPipe) id: string) {
    await this.clientsService.deleteClientRecord(id);

    return {
      success: true,
      message: 'Client record deleted successfully',
    };
  }

  // Client Interaction Endpoints
  @Post(':id/interactions')
  @ApiOperation({ summary: 'Create new client interaction' })
  @ApiResponse({ status: 201, description: 'Client interaction created successfully' })
  @ApiResponse({ status: 404, description: 'Client record not found' })
  async createClientInteraction(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body() createClientInteractionDto: CreateClientInteractionDto,
    @Req() req: any,
  ) {
    const interaction = await this.clientsService.createClientInteraction(
      {
        ...createClientInteractionDto,
        clientId,
      },
      req.user.id,
    );

    return {
      success: true,
      message: 'Client interaction created successfully',
      data: interaction,
    };
  }

  @Get(':id/interactions')
  @ApiOperation({ summary: 'Get client interactions' })
  @ApiResponse({ status: 200, description: 'Client interactions retrieved successfully' })
  @ApiQuery({ name: 'type', required: false, enum: ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TICKET', 'CHAT'] })
  @ApiQuery({ name: 'direction', required: false, enum: ['INBOUND', 'OUTBOUND'] })
  @ApiQuery({ name: 'priority', required: false, enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'staffId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getClientInteractions(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Query() query: any,
  ) {
    const filters = {
      type: query.type,
      direction: query.direction,
      priority: query.priority,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      staffId: query.staffId,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
    };

    const result = await this.clientsService.getClientInteractions(clientId, filters);

    return {
      success: true,
      data: result.interactions,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Patch('interactions/:interactionId')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.COMPLIANCE)
  @ApiOperation({ summary: 'Update client interaction' })
  @ApiResponse({ status: 200, description: 'Client interaction updated successfully' })
  @ApiResponse({ status: 404, description: 'Client interaction not found' })
  @HttpCode(HttpStatus.OK)
  async updateClientInteraction(
    @Param('interactionId', ParseUUIDPipe) interactionId: string,
    @Body() updateClientInteractionDto: UpdateClientInteractionDto,
  ) {
    const interaction = await this.clientsService.updateClientInteraction(
      interactionId,
      updateClientInteractionDto,
    );

    return {
      success: true,
      message: 'Client interaction updated successfully',
      data: interaction,
    };
  }

  @Delete('interactions/:interactionId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete client interaction' })
  @ApiResponse({ status: 200, description: 'Client interaction deleted successfully' })
  @ApiResponse({ status: 404, description: 'Client interaction not found' })
  @HttpCode(HttpStatus.OK)
  async deleteClientInteraction(@Param('interactionId', ParseUUIDPipe) interactionId: string) {
    await this.clientsService.deleteClientInteraction(interactionId);

    return {
      success: true,
      message: 'Client interaction deleted successfully',
    };
  }

  // Bulk Operations
  @Post('bulk/status')
  @Roles(UserRole.ADMIN, UserRole.COMPLIANCE)
  @ApiOperation({ summary: 'Bulk update client status' })
  @ApiResponse({ status: 200, description: 'Client status updated successfully' })
  @HttpCode(HttpStatus.OK)
  async bulkUpdateClientStatus(@Body() data: {
    clientIds: string[];
    status: string;
    reason?: string;
  }) {
    const clients = await this.clientsService.bulkUpdateClientStatus(
      data.clientIds,
      data.status as any,
      data.reason,
    );

    return {
      success: true,
      message: 'Client status updated successfully',
      data: clients,
    };
  }

  @Post('bulk/assign')
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Bulk assign clients to broker' })
  @ApiResponse({ status: 200, description: 'Clients assigned to broker successfully' })
  @HttpCode(HttpStatus.OK)
  async bulkAssignClientsToBroker(@Body() data: {
    clientIds: string[];
    brokerId: string;
  }) {
    const clients = await this.clientsService.bulkAssignClientsToBroker(
      data.clientIds,
      data.brokerId,
    );

    return {
      success: true,
      message: 'Clients assigned to broker successfully',
      data: clients,
    };
  }
}