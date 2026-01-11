import { Controller, Get, Post, Query, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { FinancialReportingService } from '../services/financial-reporting.service';
import { MrrService } from '../services/mrr.service';
import { NrrService } from '../services/nrr.service';
import { CohortAnalysisService } from '../services/cohort-analysis.service';
import { RevenueAnalyticsService } from '../services/revenue-analytics.service';
import { UserRole } from "../../../common/enums/user-role.enum";

@ApiTags('financial-reporting')
@ApiBearerAuth()
@Controller('financial-reporting')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialReportingController {
  constructor(
    private readonly financialReportingService: FinancialReportingService,
    private readonly mrrService: MrrService,
    private readonly nrrService: NrrService,
    private readonly cohortAnalysisService: CohortAnalysisService,
    private readonly revenueAnalyticsService: RevenueAnalyticsService) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get financial dashboard overview' })
  @ApiResponse({ status: 200, description: 'Financial dashboard data retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date for filtering' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date for filtering' })
  async getDashboard(@Query() query: any) {
    const period = query.startDate && query.endDate ? {
      start: new Date(query.startDate),
      end: new Date(query.endDate)
    } : undefined;

    const dashboard = await this.financialReportingService.getDashboard(period);

    return {
      success: true,
      data: dashboard
    };
  }

  @Get('mrr')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get MRR metrics' })
  @ApiResponse({ status: 200, description: 'MRR data retrieved successfully' })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'Date for MRR calculation (YYYY-MM-DD)' })
  async getMRR(@Query('date') date?: string) {
    const calculationDate = date ? new Date(date) : new Date();

    const mrrData = await this.mrrService.calculateMRR(calculationDate);

    return {
      success: true,
      data: mrrData
    };
  }

  @Get('mrr/growth')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get MRR growth metrics' })
  @ApiResponse({ status: 200, description: 'MRR growth data retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (YYYY-MM-DD)' })
  async getMRRGrowth(@Query() query: { startDate: string; endDate: string }) {
    const growthData = await this.mrrService.getMRRGrowth(
      new Date(query.startDate),
      new Date(query.endDate)
    );

    return {
      success: true,
      data: growthData
    };
  }

  @Get('mrr/by-tier')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get MRR breakdown by broker tier' })
  @ApiResponse({ status: 200, description: 'MRR by tier data retrieved successfully' })
  async getMRRByTier() {
    const tierData = await this.mrrService.getMRRByTier();

    return {
      success: true,
      data: tierData
    };
  }

  @Get('mrr/churn')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get MRR churn metrics' })
  @ApiResponse({ status: 200, description: 'MRR churn data retrieved successfully' })
  @ApiQuery({ name: 'month', required: false, type: String, description: 'Month for churn analysis (YYYY-MM)' })
  async getMRRChurn(@Query('month') month?: string) {
    const analysisMonth = month ? new Date(month + '-01') : new Date();

    const churnData = await this.mrrService.getMRRChurn(analysisMonth);

    return {
      success: true,
      data: churnData
    };
  }

  @Get('nrr')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get NRR metrics' })
  @ApiResponse({ status: 200, description: 'NRR data retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (YYYY-MM-DD)' })
  async getNRR(@Query() query: { startDate: string; endDate: string }) {
    const nrrData = await this.nrrService.calculateNRR(
      new Date(query.startDate),
      new Date(query.endDate)
    );

    return {
      success: true,
      data: nrrData
    };
  }

  @Get('nrr/by-segment')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get NRR by segment' })
  @ApiResponse({ status: 200, description: 'NRR by segment data retrieved successfully' })
  @ApiQuery({ name: 'segment', required: true, enum: ['tier', 'region', 'acquisitionChannel'], description: 'Segment type' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (YYYY-MM-DD)' })
  async getNRRBySegment(@Query() query: {
    segment: 'tier' | 'region' | 'acquisitionChannel';
    startDate: string;
    endDate: string;
  }) {
    const segmentData = await this.nrrService.getNRRBySegment(
      query.segment,
      new Date(query.startDate),
      new Date(query.endDate)
    );

    return {
      success: true,
      data: segmentData
    };
  }

  @Get('nrr/trend')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get NRR trend over time' })
  @ApiResponse({ status: 200, description: 'NRR trend data retrieved successfully' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Number of months for trend analysis', default: 12 })
  async getNRRTrend(@Query('months') months: number = 12) {
    const trendData = await this.nrrService.getNRRTrend(months);

    return {
      success: true,
      data: trendData
    };
  }

  @Get('cohorts')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get cohort analysis' })
  @ApiResponse({ status: 200, description: 'Cohort analysis data retrieved successfully' })
  @ApiQuery({ name: 'cohortMonth', required: false, type: String, description: 'Cohort month (YYYY-MM)' })
  async getCohortAnalysis(@Query('cohortMonth') cohortMonth?: string) {
    const analysisDate = cohortMonth ? new Date(cohortMonth + '-01') : new Date();

    const cohortData = await this.cohortAnalysisService.analyzeCohort(analysisDate);

    return {
      success: true,
      data: cohortData
    };
  }

  @Get('cohorts/retention-curves')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get retention curves for all cohorts' })
  @ApiResponse({ status: 200, description: 'Retention curves data retrieved successfully' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Number of months to analyze', default: 12 })
  async getRetentionCurves(@Query('months') months: number = 12) {
    const retentionData = await this.cohortAnalysisService.getRetentionCurves(months);

    return {
      success: true,
      data: retentionData
    };
  }

  @Get('cohorts/revenue-by-channel')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get revenue by acquisition channel' })
  @ApiResponse({ status: 200, description: 'Revenue by channel data retrieved successfully' })
  async getRevenueByAcquisitionChannel() {
    const channelData = await this.cohortAnalysisService.getRevenueByAcquisitionChannel();

    return {
      success: true,
      data: channelData
    };
  }

  @Get('revenue')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get revenue analytics' })
  @ApiResponse({ status: 200, description: 'Revenue analytics data retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (YYYY-MM-DD)' })
  async getRevenueAnalytics(@Query() query: { startDate: string; endDate: string }) {
    const period = {
      start: new Date(query.startDate),
      end: new Date(query.endDate)
    };

    const [
      revenueByRegion,
      revenueByTier,
      revenueByProduct,
      revenueGrowth,
      arpu,
    ] = await Promise.all([
      this.revenueAnalyticsService.getRevenueByRegion(period),
      this.revenueAnalyticsService.getRevenueByTier(period),
      this.revenueAnalyticsService.getRevenueByProduct(period),
      this.revenueAnalyticsService.getRevenueGrowth(period),
      this.revenueAnalyticsService.getARPU(period),
    ]);

    return {
      success: true,
      data: {
        byRegion: revenueByRegion,
        byTier: revenueByTier,
        byProduct: revenueByProduct,
        growth: revenueGrowth,
        arpu
      }
    };
  }

  @Get('revenue/by-region')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get revenue breakdown by region' })
  @ApiResponse({ status: 200, description: 'Revenue by region data retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (YYYY-MM-DD)' })
  async getRevenueByRegion(@Query() query: { startDate: string; endDate: string }) {
    const period = {
      start: new Date(query.startDate),
      end: new Date(query.endDate)
    };

    const regionData = await this.revenueAnalyticsService.getRevenueByRegion(period);

    return {
      success: true,
      data: regionData
    };
  }

  @Get('revenue/by-tier')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get revenue breakdown by tier' })
  @ApiResponse({ status: 200, description: 'Revenue by tier data retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (YYYY-MM-DD)' })
  async getRevenueByTier(@Query() query: { startDate: string; endDate: string }) {
    const period = {
      start: new Date(query.startDate),
      end: new Date(query.endDate)
    };

    const tierData = await this.revenueAnalyticsService.getRevenueByTier(period);

    return {
      success: true,
      data: tierData
    };
  }

  @Post('reports')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Generate financial report' })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  @ApiQuery({ name: 'type', required: true, enum: ['executive', 'broker', 'revenue'], description: 'Report type' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv', 'pdf'], description: 'Report format', default: 'json' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'brokerId', required: false, type: String, description: 'Broker ID (required for broker reports)' })
  async generateReport(@Query() query: {
    type: 'executive' | 'broker' | 'revenue';
    format?: 'json' | 'csv' | 'pdf';
    startDate: string;
    endDate: string;
    brokerId?: string;
  }) {
    const period = {
      start: new Date(query.startDate),
      end: new Date(query.endDate)
    };

    let reportData;
    switch (query.type) {
      case 'executive':
        reportData = await this.financialReportingService.generateExecutiveReport(period);
        break;
      case 'broker':
        if (!query.brokerId) {
          return {
            success: false,
            message: 'Broker ID is required for broker reports'
          };
        }
        reportData = await this.financialReportingService.generateBrokerReport(query.brokerId, period);
        break;
      case 'revenue':
        reportData = await this.revenueAnalyticsService.generateRevenueReport(
          period.start,
          period.end,
          query.format
        );
        break;
      default:
        return {
          success: false,
          message: 'Invalid report type'
        };
    }

    return {
      success: true,
      data: reportData,
      format: query.format || 'json'
    };
  }

  @Post('schedule')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule automated report' })
  @ApiResponse({ status: 201, description: 'Report scheduled successfully' })
  async scheduleReport(@Body() config: {
    type: 'executive' | 'broker' | 'revenue';
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    filters?: any;
  }) {
    const scheduleData = await this.financialReportingService.scheduleReport(config);

    return {
      success: true,
      message: 'Report scheduled successfully',
      data: scheduleData
    };
  }

  @Get('reports/:reportId/export')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Export saved report' })
  @ApiResponse({ status: 200, description: 'Report exported successfully' })
  @ApiParam({ name: 'reportId', description: 'Report ID' })
  @ApiQuery({ name: 'format', required: true, enum: ['json', 'csv', 'pdf'], description: 'Export format' })
  async exportReport(
    @Param('reportId') reportId: string,
    @Query('format') format: 'json' | 'csv' | 'pdf') {
    const exportData = await this.financialReportingService.exportReport(reportId, format);

    return {
      success: true,
      data: exportData,
      format,
      filename: `report_${reportId}.${format}`
    };
  }
}
