import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpStatus,
  Query,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClientDashboardService } from '../services/client-dashboard.service';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BrokerAuthGuard } from '../guards/broker-auth.guard';
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { User } from "../../../common/enums/user-role.enum";
import { IsOptional, IsString, IsEnum, IsUUID, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

enum ExportFormat {
  CSV = 'CSV',
  PDF = 'PDF',
  JSON = 'JSON'
}

class DashboardQueryDto {
  @IsOptional()
  @IsString()
  period?: string; // '7d', '30d', '90d', '1y'

  @IsOptional()
  @IsEnum(ExportFormat)
  export?: ExportFormat;

  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';
}

class ClientListQueryDto extends DashboardQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'revenue' | 'trades' | 'lastTrade' = 'revenue';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

@ApiTags('Client Dashboard')
@Controller('brokers/client-dashboard')
@UseGuards(JwtAuthGuard, BrokerAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClientDashboardController {
  constructor(private readonly clientDashboardService: ClientDashboardService) {}

  @Get('overview')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get client dashboard overview' })
  @ApiResponse({ status: 200, description: 'Dashboard overview retrieved successfully' })
  async getDashboardOverview(
    @Query(ValidationPipe) query: DashboardQueryDto,
    @CurrentUser() user: User
  ) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const metrics = await this.clientDashboardService.getDashboardMetrics(user.brokerId);

    // Handle export if requested
    if (query.export) {
      const exportData = await this.exportDashboardData(metrics, query.export);
      return {
        statusCode: HttpStatus.OK,
        message: 'Dashboard overview exported successfully',
        data: exportData
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Dashboard overview retrieved successfully',
      data: {
        ...metrics,
        period: query.period || '30d',
        generatedAt: new Date().toISOString()
      }
    };
  }

  @Get('clients')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get detailed client list' })
  @ApiResponse({ status: 200, description: 'Client list retrieved successfully' })
  async getClientList(
    @Query(ValidationPipe) query: ClientListQueryDto,
    @CurrentUser() user: User
  ) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const dashboardMetrics = await this.clientDashboardService.getDashboardMetrics(user.brokerId);
    let clients = dashboardMetrics.performanceMetrics.topPerformers;

    // Combine top performers with at-risk clients for a comprehensive view
    clients = [
      ...clients,
      ...dashboardMetrics.performanceMetrics.atRiskClients
    ];

    // Remove duplicates
    const uniqueClients = clients.filter((client, index, self) =>
      index === self.findIndex(c => c.clientId === client.clientId)
    );

    // Apply search filter
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      uniqueClients = uniqueClients.filter(client =>
        client.clientName.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    uniqueClients.sort((a, b) => {
      let aValue, bValue;

      switch (query.sortBy) {
        case 'name':
          aValue = a.clientName;
          bValue = b.clientName;
          break;
        case 'trades':
          aValue = a.totalTrades;
          bValue = b.totalTrades;
          break;
        case 'lastTrade':
          aValue = a.lastTradeDate ? new Date(a.lastTradeDate).getTime() : 0;
          bValue = b.lastTradeDate ? new Date(b.lastTradeDate).getTime() : 0;
          break;
        case 'revenue':
        default:
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
          break;
      }

      if (query.sortOrder === 'ASC') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const startIndex = (query.page - 1) * query.limit;
    const paginatedClients = uniqueClients.slice(startIndex, startIndex + query.limit);

    // Add risk status
    const clientsWithStatus = paginatedClients.map(client => {
      const atRiskClient = dashboardMetrics.performanceMetrics.atRiskClients.find(
        c => c.clientId === client.clientId
      );

      return {
        ...client,
        status: atRiskClient ? 'AT_RISK' : 'ACTIVE',
        riskLevel: atRiskClient ? 'HIGH' : 'LOW',
        daysSinceLastTrade: atRiskClient?.daysSinceLastTrade || 0
      };
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Client list retrieved successfully',
      data: {
        clients: clientsWithStatus,
        summary: {
          totalClients: dashboardMetrics.overview.totalClients,
          activeClients: dashboardMetrics.overview.activeClients,
          atRiskClients: dashboardMetrics.performanceMetrics.atRiskClients.length,
          totalRevenue: dashboardMetrics.overview.totalRevenue
        },
        pagination: {
          page: query.page,
          limit: query.limit,
          total: uniqueClients.length,
          totalPages: Math.ceil(uniqueClients.length / query.limit)
        }
      }
    };
  }

  @Get('client/:clientId')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get detailed client metrics' })
  @ApiResponse({ status: 200, description: 'Client detail metrics retrieved successfully' })
  async getClientDetail(
    @Param('clientId') clientId: string,
    @Query(ValidationPipe) query: DashboardQueryDto,
    @CurrentUser() user: User
  ) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const clientMetrics = await this.clientDashboardService.getClientDetailMetrics(user.brokerId, clientId);

    // Handle export if requested
    if (query.export) {
      const exportData = await this.exportClientDetailData(clientMetrics, query.export);
      return {
        statusCode: HttpStatus.OK,
        message: 'Client detail exported successfully',
        data: exportData
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Client detail metrics retrieved successfully',
      data: {
        ...clientMetrics,
        period: query.period || '30d',
        generatedAt: new Date().toISOString()
      }
    };
  }

  @Get('analytics/acquisition')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get client acquisition analytics' })
  @ApiResponse({ status: 200, description: 'Acquisition analytics retrieved successfully' })
  async getAcquisitionAnalytics(@CurrentUser() user: User) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const dashboardMetrics = await this.clientDashboardService.getDashboardMetrics(user.brokerId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Acquisition analytics retrieved successfully',
      data: {
        ...dashboardMetrics.acquisitionMetrics,
        insights: this.generateAcquisitionInsights(dashboardMetrics.acquisitionMetrics)
      }
    };
  }

  @Get('analytics/retention')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get client retention analytics' })
  @ApiResponse({ status: 200, description: 'Retention analytics retrieved successfully' })
  async getRetentionAnalytics(@CurrentUser() user: User) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const dashboardMetrics = await this.clientDashboardService.getDashboardMetrics(user.brokerId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Retention analytics retrieved successfully',
      data: {
        ...dashboardMetrics.retentionMetrics,
        insights: this.generateRetentionInsights(dashboardMetrics.retentionMetrics)
      }
    };
  }

  @Get('analytics/performance')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get client performance analytics' })
  @ApiResponse({ status: 200, description: 'Performance analytics retrieved successfully' })
  async getPerformanceAnalytics(@CurrentUser() user: User) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const dashboardMetrics = await this.clientDashboardService.getDashboardMetrics(user.brokerId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Performance analytics retrieved successfully',
      data: {
        ...dashboardMetrics.performanceMetrics,
        insights: this.generatePerformanceInsights(dashboardMetrics.performanceMetrics)
      }
    };
  }

  private async exportDashboardData(metrics: any, format: string): Promise<any> {
    switch (format) {
      case 'CSV':
        return this.convertToCSV(metrics);
      case 'PDF':
        return this.convertToPDF(metrics);
      case 'JSON':
      default:
        return metrics;
    }
  }

  private async exportClientDetailData(clientMetrics: any, format: string): Promise<any> {
    switch (format) {
      case 'CSV':
        return this.convertClientDetailToCSV(clientMetrics);
      case 'PDF':
        return this.convertClientDetailToPDF(clientMetrics);
      case 'JSON':
      default:
        return clientMetrics;
    }
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - in production, use a proper CSV library
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Clients', data.overview.totalClients],
      ['Active Clients', data.overview.activeClients],
      ['Total Revenue', data.overview.totalRevenue],
      ['Average Revenue Per Client', data.overview.averageRevenuePerClient],
    ];

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToPDF(data: any): Buffer {
    // Simple PDF conversion - in production, use a proper PDF library
    const content = `Client Dashboard Report\n\n${JSON.stringify(data, null, 2)}`;
    return Buffer.from(content, 'utf-8');
  }

  private convertClientDetailToCSV(data: any): string {
    const tradingData = data.tradingActivity;
    const headers = ['Category', 'Metric', 'Value'];
    const rows = [
      ['Trading', 'Total Trades', tradingData.totalTrades],
      ['Trading', 'Total Volume', tradingData.totalVolume],
      ['Trading', 'Total Revenue', tradingData.totalRevenue],
      ['Trading', 'Win Rate', `${(tradingData.winRate * 100).toFixed(2)}%`],
    ];

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertClientDetailToPDF(data: any): Buffer {
    const content = `Client Detail Report\n\nClient: ${data.client.name}\n${JSON.stringify(data, null, 2)}`;
    return Buffer.from(content, 'utf-8');
  }

  private generateAcquisitionInsights(acquisitionMetrics: any): string[] {
    const insights = [];

    if (acquisitionMetrics.conversionRate < 0.1) {
      insights.push('Consider optimizing your referral conversion strategy');
    }

    const topChannel = acquisitionMetrics.byAttributionType.reduce((prev, current) =>
      prev.revenue > current.revenue ? prev : current
    );

    insights.push(`${topChannel.type} is your top-performing acquisition channel`);

    if (acquisitionMetrics.costPerAcquisition > 300) {
      insights.push('Your cost per acquisition is above industry average');
    }

    return insights;
  }

  private generateRetentionInsights(retentionMetrics: any): string[] {
    const insights = [];

    if (retentionMetrics.clientRetentionRate < 0.7) {
      insights.push('Client retention is below 70% - consider retention strategies');
    }

    if (retentionMetrics.churnRate > 0.15) {
      insights.push('Churn rate is high - implement client success programs');
    }

    if (retentionMetrics.averageClientLifetime < 180) {
      insights.push('Average client lifetime is less than 6 months');
    }

    return insights;
  }

  private generatePerformanceInsights(performanceMetrics: any): string[] {
    const insights = [];

    if (performanceMetrics.atRiskClients.length > 5) {
      insights.push(`${performanceMetrics.atRiskClients.length} clients haven\'t traded in 30+ days`);
    }

    if (performanceMetrics.topPerformers.length > 0) {
      const topPerformer = performanceMetrics.topPerformers[0];
      insights.push(`${topPerformer.clientName} is your top performer with R${topPerformer.totalRevenue} revenue`);
    }

    return insights;
  }
}
