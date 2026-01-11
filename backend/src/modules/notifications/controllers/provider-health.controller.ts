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
import { ProviderHealthService } from '../services/provider-health.service';

@ApiTags('Provider Health')
@Controller('provider-health')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProviderHealthController {
  constructor(private readonly providerHealthService: ProviderHealthService) {}
  @Get()
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get health status of all notification providers' })
  @ApiResponse({ status: 200, description: 'Provider health status retrieved successfully' })
  async getAllProvidersHealth() {
  return this.providerHealthService.getAllProvidersHealth();
  }
  @Get(':provider')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get health status of a specific provider' })
  @ApiResponse({ status: 200, description: 'Provider health status retrieved successfully' })
  async getProviderHealth(@Param('provider') provider: string) {
  return this.providerHealthService.getProviderHealth(provider);
  }
  @Post(':provider/check')
  @Roles('admin', 'monitoring')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger health check for a provider' })
  @ApiResponse({ status: 200, description: 'Health check completed successfully' })
  async checkProviderHealth(@Param('provider') provider: string) {
  return this.providerHealthService.checkProviderHealth(provider);
  }
  @Post('check-all')
  @Roles('admin', 'monitoring')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger health check for all providers' })
  @ApiResponse({ status: 200, description: 'All health checks completed successfully' })
  async checkAllProvidersHealth() {
  return this.providerHealthService.checkAllProvidersHealth();
  }
  @Get(':provider/metrics')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get detailed metrics for a provider' })
  @ApiResponse({ status: 200, description: 'Provider metrics retrieved successfully' })
  async getProviderMetrics(
    @Param('provider') provider: string,
    @Query('timeRange') timeRange?: string) {
  return this.providerHealthService.getProviderMetrics(provider, timeRange);
  }
  @Get(':provider/history')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get health history for a provider' })
  @ApiResponse({ status: 200, description: 'Provider health history retrieved successfully' })
  async getProviderHealthHistory(
    @Param('provider') provider: string,
    @Query('timeRange') timeRange?: string,
    @Query('limit') limit?: number) {
  return this.providerHealthService.getProviderHealthHistory(provider, {
  timeRange,
  limit: limit || 100
  });
  }
  @Post(':provider/failover')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger failover for a provider' })
  @ApiResponse({ status: 200, description: 'Failover completed successfully' })
  async triggerFailover(
    @Param('provider') provider: string,
    @Body() failoverConfig: { targetProvider?: string }
  ) {
  return this.providerHealthService.triggerFailover(provider, failoverConfig);
  }
  @Get('failover/status')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get current failover status' })
  @ApiResponse({ status: 200, description: 'Failover status retrieved successfully' })
  async getFailoverStatus() {
  return this.providerHealthService.getFailoverStatus();
  }
  @Post('failover/reset')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset failover to normal routing' })
  @ApiResponse({ status: 200, description: 'Failover reset completed successfully' })
  async resetFailover() {
  return this.providerHealthService.resetFailover();
  }
  @Get('alerts')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get provider health alerts' })
  @ApiResponse({ status: 200, description: 'Provider health alerts retrieved successfully' })
  async getProviderHealthAlerts(
    @Query('severity') severity?: 'low' | 'medium' | 'high' | 'critical',
    @Query('status') status?: 'active' | 'resolved') {
  return this.providerHealthService.getProviderHealthAlerts({ severity, status });
  }
  @Post('alerts/:alertId/resolve')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a provider health alert' })
  @ApiResponse({ status: 200, description: 'Alert resolved successfully' })
  async resolveAlert(@Param('alertId') alertId: string) {
  return this.providerHealthService.resolveAlert(alertId);
  }
  @Get('statistics')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get provider health statistics' })
  @ApiResponse({ status: 200, description: 'Provider health statistics retrieved successfully' })
  async getProviderStatistics(@Query('timeRange') timeRange?: string) {
  return this.providerHealthService.getProviderStatistics(timeRange);
  }
  @Post(':provider/configure')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Configure health check settings for a provider' })
  @ApiResponse({ status: 200, description: 'Provider configuration updated successfully' })
  async configureProviderHealth(
    @Param('provider') provider: string,
    @Body() config: any
  ) {
  return this.providerHealthService.configureProviderHealth(provider, config);
  }
  @Get('dashboard')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get provider health dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getProviderHealthDashboard() {
  return this.providerHealthService.getProviderHealthDashboard();
  }
}