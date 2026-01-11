import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { MonitoringService } from '../services/monitoring.service';
import { MetricsService } from '../services/metrics.service';
import { AlertingService } from '../services/alerting.service';
import { PerformanceService } from '../services/performance.service';

@ApiTags('Monitoring')
@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MonitoringController {
  constructor(
  private readonly monitoringService: MonitoringService,
  private readonly metricsService: MetricsService,
  private readonly alertingService: AlertingService,
  private readonly performanceService: PerformanceService) {}

  @Get('status')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get monitoring system status' })
  @ApiResponse({ status: 200, description: 'Monitoring status retrieved successfully' })
  async getMonitoringStatus() {
  return this.monitoringService.getStatus();
}

  @Post('start')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start monitoring system' })
  @ApiResponse({ status: 200, description: 'Monitoring started successfully' })
  async startMonitoring() {
  return this.monitoringService.startMonitoring();
}

  @Post('stop')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop monitoring system' })
  @ApiResponse({ status: 200, description: 'Monitoring stopped successfully' })
  async stopMonitoring() {
  return this.monitoringService.stopMonitoring();
}

  @Get('alerts')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get active alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts retrieved successfully' })
  async getActiveAlerts() {
  return this.alertingService.getActiveAlerts();
}

  @Post('alerts/:alertId/acknowledge')
  @Roles('admin', 'monitoring')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged successfully' })
  async acknowledgeAlert(@Param('alertId') alertId: string) {
  return this.alertingService.acknowledgeAlert(alertId);
}

  @Get('performance/summary')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get performance summary' })
  @ApiResponse({ status: 200, description: 'Performance summary retrieved successfully' })
  async getPerformanceSummary(
    @Query('timeRange') timeRange: string = '1h') {
  return this.performanceService.getPerformanceSummary(timeRange);
}

  @Get('health-check')
  @ApiOperation({ summary: 'Perform comprehensive health check' })
  @ApiResponse({ status: 200, description: 'Health check completed successfully' })
  async performHealthCheck() {
  return this.monitoringService.performHealthCheck();
}

  @Post('test-alert')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test alert' })
  @ApiResponse({ status: 200, description: 'Test alert sent successfully' })
  async sendTestAlert(@Body() alertData: { type: string; message: string }) {
  return this.alertingService.sendTestAlert(alertData.type, alertData.message);
}
}