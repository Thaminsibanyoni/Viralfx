import { Controller, Get, Post, Param, Query, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CrmService } from '../services/crm.service';
import { UserRole } from "../../../common/enums/user-role.enum";

@ApiTags('crm')
@ApiBearerAuth()
@Controller('crm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Get CRM dashboard overview' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date for filtering' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date for filtering' })
  @ApiQuery({ name: 'assignedTo', required: false, type: String, description: 'Filter by relationship manager' })
  @ApiQuery({ name: 'brokerId', required: false, type: String, description: 'Filter by broker' })
  async getDashboard(@Query() query: any) {
    const filters = {
      ...(query.startDate && query.endDate && {
        dateRange: {
          start: new Date(query.startDate),
          end: new Date(query.endDate)
        }
      }),
      ...(query.assignedTo && { assignedTo: query.assignedTo }),
      ...(query.brokerId && { brokerId: query.brokerId })
    };

    const dashboard = await this.crmService.getDashboard(filters);

    return {
      success: true,
      data: dashboard
    };
  }

  @Post('leads/:id/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign lead to relationship manager' })
  @ApiResponse({ status: 200, description: 'Lead assigned successfully' })
  async assignLeadToManager(
    @Param('id') id: string,
    @Query('managerId') managerId: string) {
    const result = await this.crmService.assignLeadToManager(id, managerId);

    return {
      success: true,
      message: 'Lead assigned successfully',
      data: result
    };
  }

  @Post('leads/:id/convert')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convert lead to opportunity' })
  @ApiResponse({ status: 200, description: 'Lead converted to opportunity successfully' })
  async convertLeadToOpportunity(
    @Param('id') id: string,
    @Body() opportunityData: any) {
    const opportunity = await this.crmService.convertLeadToOpportunity(id, opportunityData);

    return {
      success: true,
      message: 'Lead converted to opportunity successfully',
      data: opportunity
    };
  }

  @Get('forecast')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Get sales forecast' })
  @ApiResponse({ status: 200, description: 'Sales forecast retrieved successfully' })
  @ApiQuery({ name: 'periodDays', required: false, type: Number, description: 'Forecast period in days', example: 30 })
  async getSalesForecast(@Query('periodDays') periodDays: number = 30) {
    const forecast = await this.crmService.generateSalesForecast(periodDays);

    return {
      success: true,
      data: forecast
    };
  }

  @Get('activities/:entityType/:entityId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Get activity timeline for entity' })
  @ApiResponse({ status: 200, description: 'Activity timeline retrieved successfully' })
  async getActivityTimeline(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string) {
    const activities = await this.crmService.getActivityTimeline(entityType, entityId);

    return {
      success: true,
      data: activities
    };
  }

  @Post('leads/score')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger lead scoring' })
  @ApiResponse({ status: 200, description: 'Lead scoring initiated successfully' })
  async scoreLeads() {
    await this.crmService.scoreLeads();

    return {
      success: true,
      message: 'Lead scoring initiated successfully'
    };
  }
}
