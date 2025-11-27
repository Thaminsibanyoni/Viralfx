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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PipelineService } from '../services/pipeline.service';
import { CreateStageDto } from '../dto/create-stage.dto';
import { UpdateStageDto } from '../dto/update-stage.dto';
import { CreateDealDto } from '../dto/create-deal.dto';
import { UpdateDealDto } from '../dto/update-deal.dto';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('CRM - Pipeline')
@ApiBearerAuth()
@Controller('api/v1/crm/pipeline')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SALES)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post('stages')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create pipeline stage' })
  @ApiResponse({ status: 201, description: 'Stage created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createStage(@Body() createStageDto: CreateStageDto) {
    const stage = await this.pipelineService.createStage(createStageDto);

    return {
      success: true,
      message: 'Stage created successfully',
      data: stage,
    };
  }

  @Get('stages')
  @ApiOperation({ summary: 'List all pipeline stages' })
  @ApiResponse({ status: 200, description: 'Stages retrieved successfully' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, example: true })
  async getStages(@Query('isActive') isActive?: boolean) {
    const stages = await this.pipelineService.getStages({ isActive });

    return {
      success: true,
      data: stages,
    };
  }

  @Patch('stages/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update pipeline stage' })
  @ApiResponse({ status: 200, description: 'Stage updated successfully' })
  @ApiResponse({ status: 404, description: 'Stage not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @HttpCode(HttpStatus.OK)
  async updateStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStageDto: UpdateStageDto,
  ) {
    const stage = await this.pipelineService.updateStage(id, updateStageDto);

    return {
      success: true,
      message: 'Stage updated successfully',
      data: stage,
    };
  }

  @Delete('stages/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete pipeline stage' })
  @ApiResponse({ status: 200, description: 'Stage deleted successfully' })
  @ApiResponse({ status: 404, description: 'Stage not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @HttpCode(HttpStatus.OK)
  async deleteStage(@Param('id', ParseUUIDPipe) id: string) {
    await this.pipelineService.deleteStage(id);

    return {
      success: true,
      message: 'Stage deleted successfully',
    };
  }

  @Post('deals')
  @ApiOperation({ summary: 'Create new deal' })
  @ApiResponse({ status: 201, description: 'Deal created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async createDeal(
    @Body() createDealDto: CreateDealDto,
    @Req() req: any,
  ) {
    const deal = await this.pipelineService.createDeal({
      ...createDealDto,
      ownerId: req.user.id,
    });

    return {
      success: true,
      message: 'Deal created successfully',
      data: deal,
    };
  }

  @Get('deals')
  @ApiOperation({ summary: 'List deals with filtering' })
  @ApiResponse({ status: 200, description: 'Deals retrieved successfully' })
  @ApiQuery({ name: 'stageId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'WON', 'LOST'] })
  @ApiQuery({ name: 'minValue', required: false, type: Number })
  @ApiQuery({ name: 'maxValue', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getDeals(@Query() query: any) {
    const filters = {
      stageId: query.stageId,
      ownerId: query.ownerId,
      status: query.status,
      minValue: query.minValue ? parseFloat(query.minValue) : undefined,
      maxValue: query.maxValue ? parseFloat(query.maxValue) : undefined,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
    };

    const result = await this.pipelineService.getDeals(filters);

    return {
      success: true,
      data: result.deals,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get('deals/:id')
  @ApiOperation({ summary: 'Get deal details' })
  @ApiResponse({ status: 200, description: 'Deal details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async getDealById(@Param('id', ParseUUIDPipe) id: string) {
    const deal = await this.pipelineService.getDealById(id);

    return {
      success: true,
      data: deal,
    };
  }

  @Patch('deals/:id')
  @ApiOperation({ summary: 'Update deal' })
  @ApiResponse({ status: 200, description: 'Deal updated successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  @HttpCode(HttpStatus.OK)
  async updateDeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDealDto: UpdateDealDto,
  ) {
    const deal = await this.pipelineService.updateDeal(id, updateDealDto);

    return {
      success: true,
      message: 'Deal updated successfully',
      data: deal,
    };
  }

  @Post('deals/:id/move')
  @ApiOperation({ summary: 'Move deal to different stage' })
  @ApiResponse({ status: 200, description: 'Deal moved successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  @HttpCode(HttpStatus.OK)
  async moveDeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() moveData: { targetStageId: string; notes: string },
  ) {
    const deal = await this.pipelineService.moveDeal(
      id,
      moveData.targetStageId,
      moveData.notes,
    );

    return {
      success: true,
      message: 'Deal moved successfully',
      data: deal,
    };
  }

  @Post('deals/:id/activities')
  @ApiOperation({ summary: 'Add activity to deal' })
  @ApiResponse({ status: 201, description: 'Activity added successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async addActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() activityData: { type: string; description: string; scheduledFor?: string },
  ) {
    const activity = await this.pipelineService.addActivity(id, {
      ...activityData,
      dealId: id,
    });

    return {
      success: true,
      message: 'Activity added successfully',
      data: activity,
    };
  }

  @Get('deals/:id/activities')
  @ApiOperation({ summary: 'Get deal activities' })
  @ApiResponse({ status: 200, description: 'Deal activities retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async getDealActivities(@Param('id', ParseUUIDPipe) id: string) {
    const activities = await this.pipelineService.getDealActivities(id);

    return {
      success: true,
      data: activities,
    };
  }

  @Post('deals/:id/close-won')
  @ApiOperation({ summary: 'Mark deal as won' })
  @ApiResponse({ status: 200, description: 'Deal marked as won successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  @HttpCode(HttpStatus.OK)
  async closeDealWon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() closeData: { actualCloseValue: number; notes: string },
  ) {
    const deal = await this.pipelineService.closeDealWon(
      id,
      closeData.actualCloseValue,
      closeData.notes,
    );

    return {
      success: true,
      message: 'Deal marked as won successfully',
      data: deal,
    };
  }

  @Post('deals/:id/close-lost')
  @ApiOperation({ summary: 'Mark deal as lost' })
  @ApiResponse({ status: 200, description: 'Deal marked as lost successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  @HttpCode(HttpStatus.OK)
  async closeDealLost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() closeData: { lossReason: string; notes: string },
  ) {
    const deal = await this.pipelineService.closeDealLost(
      id,
      closeData.lossReason,
      closeData.notes,
    );

    return {
      success: true,
      message: 'Deal marked as lost successfully',
      data: deal,
    };
  }

  @Get('forecast')
  @ApiOperation({ summary: 'Get sales forecast' })
  @ApiResponse({ status: 200, description: 'Sales forecast retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['week', 'month', 'quarter'], example: 'month' })
  async getForecast(@Query() query: any) {
    const filters = {
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      groupBy: query.groupBy || 'month',
    };

    const forecast = await this.pipelineService.getForecast(filters);

    return {
      success: true,
      data: forecast,
    };
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get pipeline analytics' })
  @ApiResponse({ status: 200, description: 'Pipeline analytics retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  async getAnalytics(@Query() query: any) {
    const filters = {
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      ownerId: query.ownerId,
    };

    const analytics = await this.pipelineService.getAnalytics(filters);

    return {
      success: true,
      data: analytics,
    };
  }

  @Get('kanban')
  @ApiOperation({ summary: 'Get Kanban board view' })
  @ApiResponse({ status: 200, description: 'Kanban board view retrieved successfully' })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'WON', 'LOST'] })
  async getKanbanView(@Query() query: any) {
    const filters = {
      ownerId: query.ownerId,
      status: query.status,
    };

    const kanbanData = await this.pipelineService.getKanbanView(filters);

    return {
      success: true,
      data: kanbanData,
    };
  }
}