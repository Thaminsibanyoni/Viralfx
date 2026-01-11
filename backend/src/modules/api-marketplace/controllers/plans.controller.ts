import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  Request
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PlansService } from '../services/plans.service';
import { CreatePlanDto, UpdatePlanDto } from '../dto/create-plan.dto';
import { ApiPlan } from '../interfaces/api-marketplace.interface';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { AdminAuthGuard } from "../../admin/guards/admin-auth.guard";
import { ProductsService } from '../services/products.service';

@ApiTags('API Marketplace - Plans')
@Controller('api/v1/api-marketplace/plans')
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly productsService: ProductsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Throttle(50, 60)
  @ApiOperation({ summary: 'List available API plans' })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  async listPlans(
    @Query('productId') productId?: string): Promise<ApiPlan[]> {
    return this.plansService.listPlans(productId);
  }

  @Get(':code')
  @HttpCode(HttpStatus.OK)
  @Throttle(50, 60)
  @ApiOperation({ summary: 'Get plan details by code' })
  @ApiResponse({ status: 200, description: 'Plan details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getPlan(@Param('code') code: string): Promise<ApiPlan | null> {
    return this.plansService.getPlan(code);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Create a new API plan' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  async createPlan(
    @Body(ValidationPipe) dto: CreatePlanDto,
    @Query('productId') productId: string): Promise<ApiPlan> {
    return this.plansService.createPlan(productId, dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Update an API plan' })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: UpdatePlanDto): Promise<ApiPlan> {
    return this.plansService.updatePlan(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle(10, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Delete an API plan' })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async deletePlan(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.plansService.deletePlan(id);
    return { message: 'Plan deleted successfully' };
  }

  @Get(':id/revenue')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Get plan revenue statistics' })
  @ApiResponse({ status: 200, description: 'Revenue statistics retrieved successfully' })
  async getPlanRevenue(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.plansService.getPlanRevenue(id, dateRange);
  }

  @Get(':id/usage')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Get plan usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  async getPlanUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.plansService.getPlanUsageStats(id, dateRange);
  }

  @Post(':id/validate-limits')
  @HttpCode(HttpStatus.OK)
  @Throttle(100, 60)
  @ApiOperation({ summary: 'Validate plan usage limits' })
  @ApiResponse({ status: 200, description: 'Usage limits validated successfully' })
  async validatePlanLimits(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('currentUsage') currentUsage: number): Promise<any> {
    return this.plansService.validatePlanLimits(id, currentUsage);
  }

  @Post(':id/calculate-overage')
  @HttpCode(HttpStatus.OK)
  @Throttle(100, 60)
  @ApiOperation({ summary: 'Calculate overage fees' })
  @ApiResponse({ status: 200, description: 'Overage fees calculated successfully' })
  async calculateOverageFees(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('overageCalls') overageCalls: number): Promise<{ fees: number }> {
    const fees = await this.plansService.calculateOverageFees(id, overageCalls);
    return { fees };
  }
}
