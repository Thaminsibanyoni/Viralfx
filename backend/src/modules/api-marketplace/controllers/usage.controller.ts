import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Param,
  Request, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UsageService } from '../services/usage.service';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { AdminAuthGuard } from "../../admin/guards/admin-auth.guard";

@ApiTags('API Marketplace - Usage')
@Controller('api/v1/api-marketplace/usage')
export class UsageController {
  constructor(
    private readonly usageService: UsageService) {}

  @Get('my-usage')
  @HttpCode(HttpStatus.OK)
  @Throttle(50, 60)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user API usage' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  async getUserUsage(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'hour' | 'day' | 'month' = 'day'): Promise<any> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.usageService.getUserUsageStats(userId, brokerId, dateRange, groupBy);
  }

  @Get('key/:keyId')
  @HttpCode(HttpStatus.OK)
  @Throttle(50, 60)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get usage statistics for a specific API key' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  async getKeyUsage(
    @Param('keyId', ParseUUIDPipe) keyId: string,
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'hour' | 'day' | 'month' = 'day'): Promise<any> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.usageService.getUsageStats(keyId, dateRange, groupBy, userId, brokerId);
  }

  @Get('product/:productId')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Get usage statistics for a product' })
  @ApiResponse({ status: 200, description: 'Product usage statistics retrieved successfully' })
  async getProductUsage(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.usageService.getProductUsageStats(productId, dateRange);
  }

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Get platform-wide usage overview' })
  @ApiResponse({ status: 200, description: 'Usage overview retrieved successfully' })
  async getUsageOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.usageService.getPlatformUsageOverview(dateRange);
  }

  @Get('top-endpoints')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Get most used API endpoints' })
  @ApiResponse({ status: 200, description: 'Top endpoints retrieved successfully' })
  async getTopEndpoints(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit: number = 10): Promise<any> {
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.usageService.getTopEndpoints(dateRange, limit);
  }

  @Get('error-analysis')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Get error analysis and patterns' })
  @ApiResponse({ status: 200, description: 'Error analysis retrieved successfully' })
  async getErrorAnalysis(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.usageService.getErrorAnalysis(dateRange);
  }

  @Get('quota-alerts')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Get quota usage alerts' })
  @ApiResponse({ status: 200, description: 'Quota alerts retrieved successfully' })
  async getQuotaAlerts(): Promise<any> {
    return this.usageService.getQuotaAlerts();
  }
}
