import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { MetricsService } from '../services/metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get metrics with optional filtering' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getMetrics(
    @Query('name') name?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('aggregation') aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count',
    @Query('limit') limit?: number) {
  const query = {
  name,
  startTime: startTime ? new Date(startTime) : undefined,
  endTime: endTime ? new Date(endTime) : undefined,
  aggregation,
  limit: limit || 100
};
  return this.metricsService.getMetrics(query);
}

  @Post()
  @Roles('admin', 'system')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a new metric' })
  @ApiResponse({ status: 201, description: 'Metric recorded successfully' })
  async recordMetric(@Body() metricData: any) {
  return this.metricsService.recordMetric(metricData);
}

  @Get(':name/latest')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get latest value for a specific metric' })
  @ApiResponse({ status: 200, description: 'Latest metric value retrieved successfully' })
  async getLatestMetric(@Param('name') name: string) {
  return this.metricsService.getLatestMetric(name);
}

  @Get(':name/history')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get historical data for a specific metric' })
  @ApiResponse({ status: 200, description: 'Historical metric data retrieved successfully' })
  async getMetricHistory(
    @Param('name') name: string,
    @Query('timeRange') timeRange?: string,
    @Query('aggregation') aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count',
    @Query('interval') interval?: string) {
  return this.metricsService.getMetricHistory(name, {
  timeRange,
  aggregation,
  interval
});
}

  @Get('dashboard/overview')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get metrics dashboard overview' })
  @ApiResponse({ status: 200, description: 'Dashboard overview retrieved successfully' })
  async getDashboardOverview() {
  return this.metricsService.getDashboardOverview();
}

  @Get('system/summary')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get system metrics summary' })
  @ApiResponse({ status: 200, description: 'System metrics summary retrieved successfully' })
  async getSystemMetricsSummary(
    @Query('timeRange') timeRange: string = '1h') {
  return this.metricsService.getSystemMetricsSummary(timeRange);
}

  @Post('batch')
  @Roles('admin', 'system')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record multiple metrics at once' })
  @ApiResponse({ status: 201, description: 'Metrics recorded successfully' })
  async recordBatchMetrics(@Body() metricsData: any[]) {
  return this.metricsService.recordBatchMetrics(metricsData);
}

  @Get('export/csv')
  @Roles('admin')
  @ApiOperation({ summary: 'Export metrics as CSV' })
  @ApiResponse({ status: 200, description: 'Metrics exported successfully' })
  async exportMetricsAsCSV(
    @Query('name') name?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string) {
  return this.metricsService.exportMetricsAsCSV({
  name,
  startTime: startTime ? new Date(startTime) : undefined,
  endTime: endTime ? new Date(endTime) : undefined
});
}
}