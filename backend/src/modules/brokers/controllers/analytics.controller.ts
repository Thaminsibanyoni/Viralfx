import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Res,
  Request, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { AnalyticsService } from '../services/analytics.service';
import { BrokerDashboardMetrics, BrokerAnalytics } from '../interfaces/broker.interface';
import { UserRole } from '@prisma/client';
import { Response } from 'express';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get admin dashboard with platform-wide analytics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Admin dashboard data retrieved successfully' })
  async getAdminDashboard(): Promise<any> {
    const dashboard = await this.analyticsService.getAdminDashboard();
    return {
      success: true,
      data: dashboard
    };
  }

  @Get(':brokerId/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get broker dashboard metrics' })
  @ApiParam({ name: 'brokerId', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Broker dashboard data retrieved successfully' })
  async getBrokerDashboard(@Param('brokerId') brokerId: string): Promise<any> {
    const dashboard = await this.analyticsService.getBrokerDashboard(brokerId);
    return {
      success: true,
      data: dashboard
    };
  }

  @Get(':brokerId/performance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get broker performance metrics' })
  @ApiParam({ name: 'brokerId', description: 'Broker ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO string)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Performance metrics retrieved successfully' })
  async getPerformanceMetrics(
    @Param('brokerId') brokerId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    const defaultPeriod = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date()
    };

    const metrics = await this.analyticsService.getPerformanceMetrics(brokerId, defaultPeriod);
    return {
      success: true,
      data: metrics
    };
  }

  @Get(':brokerId/api-usage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get broker API usage statistics' })
  @ApiParam({ name: 'brokerId', description: 'Broker ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO string)' })
  @ApiQuery({ name: 'endpoint', required: false, description: 'Filter by endpoint' })
  @ApiQuery({ name: 'method', required: false, description: 'Filter by HTTP method' })
  @ApiResponse({ status: HttpStatus.OK, description: 'API usage statistics retrieved successfully' })
  async getApiUsageStats(
    @Param('brokerId') brokerId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('endpoint') endpoint?: string,
    @Query('method') method?: string): Promise<any> {
    const defaultPeriod = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date()
    };

    let stats = await this.analyticsService.getApiUsageStats(brokerId, defaultPeriod);

    // Apply additional filters
    if (endpoint) {
      stats = stats.filter(stat => stat.endpoint.includes(endpoint));
    }
    if (method) {
      stats = stats.filter(stat => stat.method.toUpperCase() === method.toUpperCase());
    }

    return {
      success: true,
      data: stats
    };
  }

  @Get(':brokerId/marketing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get broker marketing analytics' })
  @ApiParam({ name: 'brokerId', description: 'Broker ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO string)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Marketing analytics retrieved successfully' })
  async getMarketingAnalytics(
    @Param('brokerId') brokerId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    const defaultPeriod = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date()
    };

    const analytics = await this.analyticsService.getMarketingAnalytics(brokerId, defaultPeriod);
    return {
      success: true,
      data: analytics
    };
  }

  @Get(':brokerId/revenue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get broker revenue analytics' })
  @ApiParam({ name: 'brokerId', description: 'Broker ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO string)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Revenue analytics retrieved successfully' })
  async getRevenueAnalytics(
    @Param('brokerId') brokerId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    const defaultPeriod = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date()
    };

    const analytics = await this.analyticsService.getRevenueAnalytics(brokerId, defaultPeriod);
    return {
      success: true,
      data: analytics
    };
  }

  @Post('reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Generate custom analytics report' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        brokerId: { type: 'string', description: 'Broker ID (optional for platform-wide reports)' },
        reportType: {
          type: 'string',
          enum: ['PERFORMANCE', 'API_USAGE', 'REVENUE', 'MARKETING', 'COMPREHENSIVE']
        },
        period: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' }
          }
        },
        metrics: { type: 'array', items: { type: 'string' } },
        format: { type: 'string', enum: ['PDF', 'CSV', 'JSON'] }
      },
      required: ['reportType', 'format']
    }
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Report generated successfully' })
  @HttpCode(HttpStatus.OK)
  async generateReport(
    @Body() reportConfig: any,
    @Res() res: Response): Promise<void> {
    const reportBuffer = await this.analyticsService.generateCustomReport(
      reportConfig.brokerId,
      reportConfig);

    const filename = `${reportConfig.reportType.toLowerCase()}-report-${Date.now()}.${reportConfig.format.toLowerCase()}`;

    res.setHeader('Content-Type', this.getContentType(reportConfig.format));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', reportBuffer.length);

    res.send(reportBuffer);
  }

  @Get('reports/templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get available report templates' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Report templates retrieved successfully' })
  async getReportTemplates(): Promise<any> {
    return {
      success: true,
      data: {
        templates: [
          {
            id: 'monthly-performance',
            name: 'Monthly Performance Report',
            description: 'Comprehensive monthly performance metrics',
            reportType: 'COMPREHENSIVE',
            format: 'PDF',
            metrics: ['volume', 'clients', 'revenue', 'compliance']
          },
          {
            id: 'api-usage-analysis',
            name: 'API Usage Analysis',
            description: 'Detailed API usage statistics and trends',
            reportType: 'API_USAGE',
            format: 'CSV',
            metrics: ['requests', 'response_time', 'errors']
          },
          {
            id: 'revenue-breakdown',
            name: 'Revenue Breakdown',
            description: 'Revenue analysis by source and period',
            reportType: 'REVENUE',
            format: 'PDF',
            metrics: ['commissions', 'fees', 'services']
          },
        ]
      }
    };
  }

  // Broker self-service analytics endpoints
  @Get('me/dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current broker dashboard metrics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Dashboard metrics retrieved successfully' })
  async getMyDashboard(@Req() req): Promise<any> {
    // This would be implemented when broker authentication is added
    return {
      success: true,
      message: 'My dashboard endpoint - requires broker authentication'
    };
  }

  @Get('me/performance')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current broker performance metrics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Performance metrics retrieved successfully' })
  async getMyPerformance(@Req() req): Promise<any> {
    return {
      success: true,
      message: 'My performance endpoint - requires broker authentication'
    };
  }

  @Get('me/api-usage')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current broker API usage statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'API usage statistics retrieved successfully' })
  async getMyApiUsage(@Req() req): Promise<any> {
    return {
      success: true,
      message: 'My API usage endpoint - requires broker authentication'
    };
  }

  @Post('me/reports')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate report for current broker' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Report generated successfully' })
  async generateMyReport(@Req() req, @Body() reportConfig: any): Promise<any> {
    return {
      success: true,
      message: 'Generate my report endpoint - requires broker authentication'
    };
  }

  @Get('insights/realtime')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get real-time platform insights' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Real-time insights retrieved successfully' })
  async getRealtimeInsights(): Promise<any> {
    // Return placeholder for real-time insights
    return {
      success: true,
      data: {
        activeConnections: 1247,
        requestsPerMinute: 3421,
        averageLatency: 87,
        errorRate: 0.2,
        topMarkets: ['BTC/ZAR', 'ETH/ZAR', 'USDT/ZAR'],
        brokerActivity: {
          online: 89,
          offline: 12,
          maintenance: 3
        }
      }
    };
  }

  @Get('insights/trends')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get platform trend analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['24h', '7d', '30d', '90d'], description: 'Time period' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Trend analytics retrieved successfully' })
  async getTrendAnalytics(@Query('period') period: string = '7d'): Promise<any> {
    return {
      success: true,
      data: {
        period,
        volumeGrowth: 15.3,
        userGrowth: 8.7,
        brokerGrowth: 12.1,
        revenueGrowth: 18.9,
        predictions: {
          nextMonthVolume: 2500000,
          nextMonthRevenue: 125000,
          topPerformingBrokers: ['ABC Brokers', 'XYZ Investments', 'Financial Services Ltd']
        }
      }
    };
  }

  private getContentType(format: string): string {
    const contentTypes = {
      PDF: 'application/pdf',
      CSV: 'text/csv',
      JSON: 'application/json'
    };
    return contentTypes[format.toUpperCase()] || 'application/octet-stream';
  }
}
