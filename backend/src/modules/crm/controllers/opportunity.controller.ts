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
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OpportunityService } from '../services/opportunity.service';
import { UserRole } from "../../../common/enums/user-role.enum";
import { CreateOpportunityDto } from '../dto/create-opportunity.dto';
import { UpdateOpportunityDto } from '../dto/update-opportunity.dto';
import { OpportunityFiltersDto } from '../dto/opportunity-filters.dto';

@ApiTags('opportunities')
@ApiBearerAuth()
@Controller('opportunities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpportunityController {
  constructor(private readonly opportunityService: OpportunityService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Get all opportunities with filters' })
  @ApiResponse({ status: 200, description: 'Opportunities retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'stage', required: false, type: String, description: 'Filter by stage' })
  @ApiQuery({ name: 'assignedTo', required: false, type: String, description: 'Filter by assigned manager' })
  @ApiQuery({ name: 'brokerId', required: false, type: String, description: 'Filter by broker' })
  async getOpportunities(@Query() query: OpportunityFiltersDto) {
    const result = await this.opportunityService.getOpportunities(query);

    return {
      success: true,
      data: result.opportunities,
      pagination: result.pagination,
      filters: result.filters
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Get opportunity by ID' })
  @ApiResponse({ status: 200, description: 'Opportunity retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  async getOpportunityById(@Param('id') id: string) {
    const opportunity = await this.opportunityService.getOpportunityById(id);

    return {
      success: true,
      data: opportunity
    };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Create new opportunity' })
  @ApiResponse({ status: 201, description: 'Opportunity created successfully' })
  async createOpportunity(@Body(ValidationPipe) createOpportunityDto: CreateOpportunityDto) {
    const opportunity = await this.opportunityService.createOpportunity(createOpportunityDto);

    return {
      success: true,
      message: 'Opportunity created successfully',
      data: opportunity
    };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Update opportunity' })
  @ApiResponse({ status: 200, description: 'Opportunity updated successfully' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  async updateOpportunity(
    @Param('id') id: string,
    @Body(ValidationPipe) updateOpportunityDto: UpdateOpportunityDto
  ) {
    const opportunity = await this.opportunityService.updateOpportunity(id, updateOpportunityDto);

    return {
      success: true,
      message: 'Opportunity updated successfully',
      data: opportunity
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete opportunity' })
  @ApiResponse({ status: 200, description: 'Opportunity deleted successfully' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  async deleteOpportunity(@Param('id') id: string) {
    await this.opportunityService.deleteOpportunity(id);

    return {
      success: true,
      message: 'Opportunity deleted successfully'
    };
  }

  @Put(':id/stage')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update opportunity stage' })
  @ApiResponse({ status: 200, description: 'Opportunity stage updated successfully' })
  async updateOpportunityStage(
    @Param('id') id: string,
    @Body() body: { stage: string; notes?: string }
  ) {
    const opportunity = await this.opportunityService.updateOpportunityStage(id, body.stage, body.notes);

    return {
      success: true,
      message: 'Opportunity stage updated successfully',
      data: opportunity
    };
  }

  @Post(':id/won')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark opportunity as won' })
  @ApiResponse({ status: 200, description: 'Opportunity marked as won successfully' })
  async closeWonOpportunity(
    @Param('id') id: string,
    @Body() body: { actualValue?: number; notes?: string }
  ) {
    const opportunity = await this.opportunityService.closeWon(id, body.actualValue, body.notes);

    return {
      success: true,
      message: 'Opportunity marked as won successfully',
      data: opportunity
    };
  }

  @Post(':id/lost')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark opportunity as lost' })
  @ApiResponse({ status: 200, description: 'Opportunity marked as lost successfully' })
  async closeLostOpportunity(
    @Param('id') id: string,
    @Body() body: { lostReason: string; notes?: string }
  ) {
    const opportunity = await this.opportunityService.closeLost(id, body.lostReason, body.notes);

    return {
      success: true,
      message: 'Opportunity marked as lost successfully',
      data: opportunity
    };
  }

  @Post(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign opportunity to relationship manager' })
  @ApiResponse({ status: 200, description: 'Opportunity assigned successfully' })
  async assignOpportunity(
    @Param('id') id: string,
    @Body() body: { managerId: string }
  ) {
    const opportunity = await this.opportunityService.assignOpportunity(id, body.managerId);

    return {
      success: true,
      message: 'Opportunity assigned successfully',
      data: opportunity
    };
  }

  @Get('export/csv')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Export opportunities to CSV' })
  @ApiResponse({ status: 200, description: 'Opportunities exported successfully' })
  @ApiQuery({ name: 'stage', required: false, type: String, description: 'Filter by stage' })
  @ApiQuery({ name: 'assignedTo', required: false, type: String, description: 'Filter by assigned manager' })
  @ApiQuery({ name: 'brokerId', required: false, type: String, description: 'Filter by broker' })
  @ApiQuery({ name: 'dateRange', required: false, type: String, description: 'Date range filter (JSON)' })
  async exportOpportunities(@Query() query: any) {
    const filters = {
      ...(query.stage && { stage: query.stage }),
      ...(query.assignedTo && { assignedTo: query.assignedTo }),
      ...(query.brokerId && { brokerId: query.brokerId }),
      ...(query.dateRange && { dateRange: JSON.parse(query.dateRange) })
    };

    const csvData = await this.opportunityService.exportOpportunities(filters);

    return {
      success: true,
      data: csvData
    };
  }

  @Get('stats/overview')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Get opportunity statistics overview' })
  @ApiResponse({ status: 200, description: 'Opportunity statistics retrieved successfully' })
  @ApiQuery({ name: 'period', required: false, type: String, description: 'Time period (day/week/month/year)', example: 'month' })
  async getOpportunityStats(@Query('period') period: string = 'month') {
    const stats = await this.opportunityService.getOpportunityStats(period);

    return {
      success: true,
      data: stats
    };
  }

  @Get('pipeline/value')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Get pipeline value by stage' })
  @ApiResponse({ status: 200, description: 'Pipeline value retrieved successfully' })
  async getPipelineValue() {
    const pipelineValue = await this.opportunityService.getPipelineValue();

    return {
      success: true,
      data: pipelineValue
    };
  }
}
