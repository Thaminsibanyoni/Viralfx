import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeadService } from '../services/lead.service';
import { UserRole } from '../../users/entities/user.entity';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { UpdateLeadDto } from '../dto/update-lead.dto';
import { LeadFiltersDto } from '../dto/lead-filters.dto';

@ApiTags('leads')
@ApiBearerAuth()
@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Get all leads with filters' })
  @ApiResponse({ status: 200, description: 'Leads retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({ name: 'assignedTo', required: false, type: String, description: 'Filter by assigned manager' })
  @ApiQuery({ name: 'brokerId', required: false, type: String, description: 'Filter by broker' })
  async getLeads(@Query() query: LeadFiltersDto) {
    const result = await this.leadService.getLeads(query);

    return {
      success: true,
      data: result.leads,
      pagination: result.pagination,
      filters: result.filters,
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Get lead by ID' })
  @ApiResponse({ status: 200, description: 'Lead retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async getLeadById(@Param('id') id: string) {
    const lead = await this.leadService.getLeadById(id);

    return {
      success: true,
      data: lead,
    };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Create new lead' })
  @ApiResponse({ status: 201, description: 'Lead created successfully' })
  async createLead(@Body(ValidationPipe) createLeadDto: CreateLeadDto) {
    const lead = await this.leadService.createLead(createLeadDto);

    return {
      success: true,
      message: 'Lead created successfully',
      data: lead,
    };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Update lead' })
  @ApiResponse({ status: 200, description: 'Lead updated successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async updateLead(
    @Param('id') id: string,
    @Body(ValidationPipe) updateLeadDto: UpdateLeadDto
  ) {
    const lead = await this.leadService.updateLead(id, updateLeadDto);

    return {
      success: true,
      message: 'Lead updated successfully',
      data: lead,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete lead' })
  @ApiResponse({ status: 200, description: 'Lead deleted successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async deleteLead(@Param('id') id: string) {
    await this.leadService.deleteLead(id);

    return {
      success: true,
      message: 'Lead deleted successfully',
    };
  }

  @Put(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update lead status' })
  @ApiResponse({ status: 200, description: 'Lead status updated successfully' })
  async updateLeadStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string }
  ) {
    const lead = await this.leadService.updateLeadStatus(id, body.status, body.notes);

    return {
      success: true,
      message: 'Lead status updated successfully',
      data: lead,
    };
  }

  @Post(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign lead to relationship manager' })
  @ApiResponse({ status: 200, description: 'Lead assigned successfully' })
  async assignLead(
    @Param('id') id: string,
    @Body() body: { managerId: string }
  ) {
    const lead = await this.leadService.assignLead(id, body.managerId);

    return {
      success: true,
      message: 'Lead assigned successfully',
      data: lead,
    };
  }

  @Post(':id/score')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger lead scoring' })
  @ApiResponse({ status: 200, description: 'Lead scoring initiated successfully' })
  async scoreLead(@Param('id') id: string) {
    await this.leadService.scoreLead(id);

    return {
      success: true,
      message: 'Lead scoring initiated successfully',
    };
  }

  @Get('export/csv')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Export leads to CSV' })
  @ApiResponse({ status: 200, description: 'Leads exported successfully' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({ name: 'assignedTo', required: false, type: String, description: 'Filter by assigned manager' })
  @ApiQuery({ name: 'brokerId', required: false, type: String, description: 'Filter by broker' })
  @ApiQuery({ name: 'dateRange', required: false, type: String, description: 'Date range filter (JSON)' })
  async exportLeads(@Query() query: any) {
    const filters = {
      ...(query.status && { status: query.status }),
      ...(query.assignedTo && { assignedTo: query.assignedTo }),
      ...(query.brokerId && { brokerId: query.brokerId }),
      ...(query.dateRange && { dateRange: JSON.parse(query.dateRange) }),
    };

    const csvData = await this.leadService.exportLeads(filters);

    return {
      success: true,
      data: csvData,
    };
  }

  @Get('stats/overview')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Get lead statistics overview' })
  @ApiResponse({ status: 200, description: 'Lead statistics retrieved successfully' })
  @ApiQuery({ name: 'period', required: false, type: String, description: 'Time period (day/week/month/year)', example: 'month' })
  async getLeadStats(@Query('period') period: string = 'month') {
    const stats = await this.leadService.getLeadStats(period);

    return {
      success: true,
      data: stats,
    };
  }
}