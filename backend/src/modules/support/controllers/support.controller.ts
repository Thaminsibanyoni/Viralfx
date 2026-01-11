import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { UserRole } from "../../../common/enums/user-role.enum";
import { SupportService } from '../services/support.service';
import { TicketService } from '../services/ticket.service';
import { SlaService } from '../services/sla.service';
import { GenerateReportDto } from '../dto/generate-report.dto';
import { ReportFilterDto } from '../dto/report-filter.dto';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support')
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly ticketService: TicketService,
    private readonly slaService: SlaService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get support dashboard metrics' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics retrieved successfully' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async getDashboardMetrics(@Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const metrics = await this.supportService.getDashboardMetrics(period);
    return {
      success: true,
      data: metrics,
      message: 'Dashboard metrics retrieved successfully'
    };
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get comprehensive support analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @Roles(UserRole.ADMIN)
  async getSupportAnalytics() {
    return await this.supportService.getSupportAnalytics();
  }

  @Get('agents/:agentId/performance')
  @ApiOperation({ summary: 'Get agent performance metrics' })
  @ApiResponse({ status: 200, description: 'Agent performance retrieved successfully' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async getAgentPerformance(
    @Param('agentId') agentId: string,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month'
  ) {
    return await this.supportService.getAgentPerformance(agentId, period);
  }

  @Get('customer-satisfaction')
  @ApiOperation({ summary: 'Get customer satisfaction metrics' })
  @ApiResponse({ status: 200, description: 'Satisfaction metrics retrieved successfully' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async getCustomerSatisfaction(@Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month') {
    return await this.supportService.getCustomerSatisfaction(period);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get ticket trends' })
  @ApiResponse({ status: 200, description: 'Ticket trends retrieved successfully' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async getTicketTrends(@Query('period') period: 'week' | 'month' | 'quarter' | 'year' = 'month') {
    return await this.supportService.getTicketTrends(period);
  }

  @Post('reports')
  @ApiOperation({ summary: 'Generate support report' })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  @Roles(UserRole.ADMIN)
  async generateSupportReport(@Body() generateReportDto: GenerateReportDto) {
    return await this.supportService.generateSupportReport(generateReportDto);
  }

  @Get('reports/export')
  @ApiOperation({ summary: 'Export support data' })
  @ApiResponse({ status: 200, description: 'Data exported successfully' })
  @Roles(UserRole.ADMIN)
  async exportSupportData(@Query() filters: ReportFilterDto) {
    const report = await this.supportService.generateSupportReport({
      startDate: filters.startDate,
      endDate: filters.endDate,
      format: 'csv'
    });
    return report;
  }

  @Get('health')
  @ApiOperation({ summary: 'Get support system health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  @Roles(UserRole.ADMIN)
  async getSystemHealth() {
    const metrics = await this.supportService.getDashboardMetrics('day');
    const analytics = await this.supportService.getSupportAnalytics();

    return {
      status: 'healthy',
      timestamp: new Date(),
      metrics: {
        openTickets: metrics.summary.openTickets,
        overdueTickets: metrics.summary.overdueTickets,
        avgResolutionTime: metrics.summary.avgResolutionTime,
        slaComplianceRate: metrics.summary.slaComplianceRate
      },
      system: {
        activeAgents: analytics.activeAgents,
        activeCategories: analytics.activeCategories,
        knowledgeBaseArticles: analytics.knowledgeBaseUsage.totalViews
      }
    };
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get AI-powered support insights' })
  @ApiResponse({ status: 200, description: 'Insights retrieved successfully' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async getSupportInsights(@Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const dashboardMetrics = await this.supportService.getDashboardMetrics(period);
    const trends = await this.supportService.getTicketTrends(period);
    const satisfaction = await this.supportService.getCustomerSatisfaction(period);

    return {
      insights: [
        {
          type: 'volume_trend',
          title: 'Ticket Volume Trend',
          description: `Ticket volume is ${trends.trends.length > 1 ?
            (trends.trends[trends.trends.length - 1].created > trends.trends[0].created ? 'increasing' : 'decreasing') :
            'stable'} compared to last ${period}`,
          trend: trends.trends.length > 1 ?
            (trends.trends[trends.trends.length - 1].created > trends.trends[0].created ? 'up' : 'down') :
            'stable',
          value: trends.trends.length > 0 ? trends.trends[trends.trends.length - 1].created : 0
        },
        {
          type: 'sla_performance',
          title: 'SLA Performance',
          description: `SLA compliance rate is ${dashboardMetrics.summary.slaComplianceRate.toFixed(1)}%`,
          trend: dashboardMetrics.summary.slaComplianceRate >= 90 ? 'good' :
                 dashboardMetrics.summary.slaComplianceRate >= 75 ? 'warning' : 'critical',
          value: dashboardMetrics.summary.slaComplianceRate
        },
        {
          type: 'resolution_time',
          title: 'Resolution Time',
          description: `Average resolution time is ${dashboardMetrics.summary.avgResolutionTime} minutes`,
          trend: dashboardMetrics.summary.avgResolutionTime <= 240 ? 'good' :
                 dashboardMetrics.summary.avgResolutionTime <= 480 ? 'warning' : 'critical',
          value: dashboardMetrics.summary.avgResolutionTime
        },
        {
          type: 'customer_satisfaction',
          title: 'Customer Satisfaction',
          description: `Average satisfaction score is ${satisfaction.averageScore}/5`,
          trend: satisfaction.averageScore >= 4.0 ? 'good' :
                 satisfaction.averageScore >= 3.0 ? 'warning' : 'critical',
          value: satisfaction.averageScore
        },
      ],
      recommendations: this.generateRecommendations(dashboardMetrics, trends, satisfaction)
    };
  }

  private generateRecommendations(metrics: any, trends: any, satisfaction: any): string[] {
    const recommendations: string[] = [];

    if (metrics.summary.slaComplianceRate < 90) {
      recommendations.push('Consider reviewing SLA policies and agent workload distribution');
    }

    if (metrics.summary.avgResolutionTime > 480) {
      recommendations.push('Focus on reducing average resolution time through better agent training or process optimization');
    }

    if (satisfaction.averageScore < 4.0) {
      recommendations.push('Implement customer feedback collection and improve response quality');
    }

    if (metrics.summary.overdueTickets > 0) {
      recommendations.push('Address overdue tickets immediately to prevent customer dissatisfaction');
    }

    const ticketGrowth = trends.trends.length > 1 ?
      ((trends.trends[trends.trends.length - 1].created - trends.trends[0].created) / trends.trends[0].created) * 100 : 0;

    if (ticketGrowth > 20) {
      recommendations.push('Consider hiring additional support agents to handle increased ticket volume');
    }

    if (recommendations.length === 0) {
      recommendations.push('Support system is performing well. Continue monitoring key metrics.');
    }

    return recommendations;
  }
}
