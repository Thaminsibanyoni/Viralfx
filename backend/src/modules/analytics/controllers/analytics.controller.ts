import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
  Request,
  CacheInterceptor,
  UseInterceptors,
  CacheTTL,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AnalyticsService } from '../services/analytics.service';
import { PerformanceService } from '../services/performance.service';
import { ReportService } from '../services/report.service';
import { AnalyticsQueryDto, PerformanceQueryDto, LeaderboardQueryDto, CreateReportDto } from '../dto/index';
import {
  AnalyticsData,
  TrendAnalytics,
  PerformanceMetrics,
  DashboardData,
  Report,
} from '../interfaces/analytics.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CacheInterceptor)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly performanceService: PerformanceService,
    private readonly reportService: ReportService,
  ) {}

  @Get('trends/:symbol')
  @ApiOperation({ summary: 'Get trend analytics for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Symbol to analyze' })
  @ApiQuery({ name: 'timeRange', required: false, description: 'Time range for analysis', example: '7D' })
  @ApiResponse({ status: 200, description: 'Trend analytics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No data found for symbol' })
  @CacheTTL(60) // 1 minute cache
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getTrendAnalytics(
    @Param('symbol') symbol: string,
    @Query('timeRange') timeRange?: string,
  ): Promise<TrendAnalytics> {
    try {
      // Map symbol to trendId using PrismaService
      const trend = await this.analyticsService.findTrendBySymbol(symbol);
      if (!trend) {
        throw new NotFoundException(`No trend found for symbol: ${symbol}`);
      }

      return await this.analyticsService.getTrendAnalytics(trend.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to get trend analytics: ${error.message}`);
    }
  }

  @Get('dashboard/:assetId')
  @ApiOperation({ summary: 'Get complete dashboard data for an asset' })
  @ApiParam({ name: 'assetId', description: 'Asset ID (usually symbol)' })
  @ApiQuery({ name: 'timeRange', required: false, description: 'Time range for dashboard data', example: '7D' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  @CacheTTL(60) // 1 minute cache
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getDashboardData(
    @Param('assetId') assetId: string,
    @Query('timeRange') timeRange?: string,
  ): Promise<DashboardData> {
    try {
      return await this.analyticsService.getDashboardData(assetId, timeRange);
    } catch (error) {
      throw new Error(`Failed to get dashboard data: ${error.message}`);
    }
  }

  @Get('performance/:entityType/:entityId')
  @ApiOperation({ summary: 'Get performance metrics for an entity' })
  @ApiParam({ name: 'entityType', description: 'Entity type (STRATEGY, USER, SYMBOL)' })
  @ApiParam({ name: 'entityId', description: 'Entity ID' })
  @ApiQuery({ name: 'period', required: false, description: 'Performance period', example: '7D' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No performance data found' })
  @CacheTTL(300) // 5 minute cache
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getPerformanceMetrics(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('period') period: string = 'ALL_TIME',
  ): Promise<PerformanceMetrics> {
    try {
      return await this.analyticsService.getPerformanceMetrics(entityType, entityId, period);
    } catch (error) {
      throw new Error(`Failed to get performance metrics: ${error.message}`);
    }
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get performance leaderboard' })
  @ApiQuery({ name: 'metricType', required: false, description: 'Metric type for ranking', example: 'TOTAL_RETURN' })
  @ApiQuery({ name: 'period', required: false, description: 'Time period', example: '7D' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results', example: 50 })
  @ApiQuery({ name: 'entityType', required: false, description: 'Entity type (STRATEGY, USER)', example: 'STRATEGY' })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully' })
  @CacheTTL(600) // 10 minute cache
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getLeaderboard(
    @Query() query: LeaderboardQueryDto,
  ): Promise<Array<{
    entityId: string;
    entityName?: string;
    metricValue: number;
    rank: number;
    metadata?: any;
  }>> {
    try {
      const {
        metricType = 'TOTAL_RETURN',
        period = '7D',
        limit = 50,
        entityType = 'STRATEGY',
      } = query;

      return await this.performanceService.getLeaderboard(metricType, period, limit, entityType);
    } catch (error) {
      throw new Error(`Failed to get leaderboard: ${error.message}`);
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Query time-series analytics metrics' })
  @ApiResponse({ status: 200, description: 'Analytics data retrieved successfully' })
  @CacheTTL(300) // 5 minute cache
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getMetrics(
    @Query(ValidationPipe) query: AnalyticsQueryDto,
  ): Promise<AnalyticsData> {
    try {
      query.validateDateRange();
      return await this.analyticsService.getAnalyticsData(query);
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  @Get('realtime/:symbol')
  @ApiOperation({ summary: 'Get real-time metrics for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Symbol to get real-time data for' })
  @ApiResponse({ status: 200, description: 'Real-time metrics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No recent data found for symbol' })
  @Throttle({ default: { limit: 200, ttl: 60000 } }) // Higher limit for real-time data
  async getRealTimeMetrics(
    @Param('symbol') symbol: string,
  ): Promise<{
    timestamp: Date;
    viralityScore: number;
    sentimentScore: number;
    velocity: number;
    engagementRate: number;
    momentumScore: number;
  }> {
    try {
      const metrics = await this.analyticsService.calculateRealTimeMetrics(symbol);
      return {
        timestamp: metrics.timestamp,
        viralityScore: metrics.viralityScore || 0,
        sentimentScore: metrics.sentimentScore || 0,
        velocity: metrics.velocity || 0,
        engagementRate: metrics.engagementRate || 0,
        momentumScore: metrics.momentumScore || 0,
      };
    } catch (error) {
      throw new Error(`Failed to get real-time metrics: ${error.message}`);
    }
  }

  @Post('reports')
  @ApiOperation({ summary: 'Generate analytics report' })
  @ApiResponse({ status: 201, description: 'Report generation queued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid report configuration' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async generateReport(
    @Body(ValidationPipe) reportConfig: CreateReportDto,
    @Request() req: { user: { id: string } },
  ): Promise<{
    reportId: string;
    status: string;
    message: string;
  }> {
    try {
      const userId = req.user.id;
      const reportId = await this.reportService.queueReportGeneration(reportConfig, userId);

      return {
        reportId,
        status: 'generating',
        message: 'Report generation queued. Use the report ID to check status.',
      };
    } catch (error) {
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  @Get('reports/:reportId')
  @ApiOperation({ summary: 'Get generated report by ID' })
  @ApiParam({ name: 'reportId', description: 'Report ID' })
  @ApiResponse({ status: 200, description: 'Report retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getReport(
    @Param('reportId') reportId: string,
    @Request() req: { user: { id: string; role?: string } },
  ): Promise<Report> {
    try {
      const report = await this.reportService.getReport(reportId);
      if (!report) {
        throw new Error(`Report not found: ${reportId}`);
      }

      // Check authorization - users can only see their own reports unless admin
      if (req.user.role !== 'admin' && report.metadata.generatedBy !== req.user.id) {
        throw new Error(`Report not found: ${reportId}`);
      }

      return report;
    } catch (error) {
      throw new Error(`Failed to get report: ${error.message}`);
    }
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get report history for user' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiResponse({ status: 200, description: 'Report history retrieved successfully' })
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getReportHistory(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Request() req: { user: { id: string; role?: string } },
  ): Promise<{
    reports: Report[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // Non-admin users can only see their own reports
      const userId = req.user.role === 'admin' ? undefined : req.user.id;
      return await this.reportService.getReportHistory(userId, page, limit);
    } catch (error) {
      throw new Error(`Failed to get report history: ${error.message}`);
    }
  }

  @Get('reports/:reportId/export')
  @ApiOperation({ summary: 'Export report in specified format' })
  @ApiParam({ name: 'reportId', description: 'Report ID' })
  @ApiQuery({ name: 'format', required: false, description: 'Export format', enum: ['json', 'csv', 'pdf'], example: 'json' })
  @ApiResponse({ status: 200, description: 'Report exported successfully' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @ApiResponse({ status: 400, description: 'Export failed or format not supported' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async exportReport(
    @Param('reportId') reportId: string,
    @Query('format') format: 'json' | 'csv' | 'pdf' = 'json',
    @Request() req: { user: { id: string; role?: string } },
  ): Promise<string> {
    try {
      // Check authorization first
      const report = await this.reportService.getReport(reportId);
      if (!report) {
        throw new Error(`Report not found: ${reportId}`);
      }

      if (req.user.role !== 'admin' && report.metadata.generatedBy !== req.user.id) {
        throw new Error(`Report not found: ${reportId}`);
      }

      return await this.reportService.exportReport(reportId, format);
    } catch (error) {
      throw new Error(`Failed to export report: ${error.message}`);
    }
  }

  @Get('stats/overview')
  @ApiOperation({ summary: 'Get analytics platform overview statistics' })
  @ApiResponse({ status: 200, description: 'Overview statistics retrieved successfully' })
  @CacheKey('analytics:stats:overview')
  @CacheTTL(1800) // 30 minute cache
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  async getOverviewStats(): Promise<{
    totalBacktests: number;
    activeStrategies: number;
    totalReports: number;
    avgPerformance: number;
    topPerformingAsset: string;
  }> {
    try {
      // This would typically query database for actual statistics
      // For now, return mock data
      return {
        totalBacktests: 1247,
        activeStrategies: 89,
        totalReports: 423,
        avgPerformance: 15.7,
        topPerformingAsset: 'AAPL',
      };
    } catch (error) {
      throw new Error(`Failed to get overview stats: ${error.message}`);
    }
  }

  @Post('performance')
  @ApiOperation({ summary: 'Submit performance metrics for predictive notifications validation' })
  @ApiResponse({ status: 201, description: 'Performance metrics recorded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid performance data' })
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async submitPerformanceMetrics(
    @Body() performanceData: {
      baseline: {
        averageLoadTime: number;
        cacheHitRate: number;
        predictionAccuracy: number;
      } | null;
      history: Array<{
        timestamp: number;
        loadTime: number;
        cacheHitRate: number;
        predictionAccuracy: number;
        networkLatency: number;
      }>;
      currentMetrics: {
        battery: { level: number; charging: boolean };
        memory: { used: number; total: number; percentage: number };
        performance: { loadTime: number; fps: number; cpuUsage: number };
        network: { online: boolean; type: string; speed: string; rtt: number };
        device: { cores: number; memory: number; type: string };
      };
      analysis: {
        loadTimeImprovement: number | null;
        cacheHitRateImprovement: number | null;
        predictionAccuracyImprovement: number | null;
        overallImprovement: number | null;
        meetsTarget: boolean;
      };
      abTest: {
        group: 'control' | 'treatment' | null;
        performance: {
          averageLoadTime: number;
          cacheHitRate: number;
          predictionAccuracy: number;
        } | null;
      };
      recommendations: Array<{
        type: string;
        severity: string;
        message: string;
        action: string;
        autoFix: boolean;
      }>;
      generatedAt: string;
    },
    @Request() req: { user: { id: string } },
  ): Promise<{
    success: boolean;
    id: string;
    message: string;
  }> {
    try {
      const userId = req.user.id;

      // Store performance data for analysis
      const id = await this.analyticsService.storePerformanceMetrics({
        userId,
        performanceData,
        timestamp: new Date(),
      });

      // If we have enough data points, analyze and report
      if (performanceData.history.length > 50) {
        await this.analyticsService.analyzePerformanceTrends(userId, performanceData);
      }

      return {
        success: true,
        id,
        message: 'Performance metrics recorded successfully',
      };
    } catch (error) {
      throw new Error(`Failed to submit performance metrics: ${error.message}`);
    }
  }
}