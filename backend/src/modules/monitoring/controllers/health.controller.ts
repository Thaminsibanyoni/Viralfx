import { Controller, Get, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckService } from '../services/health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private healthCheckService: HealthCheckService) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'viralfx-backend',
    };
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check with all services' })
  @ApiResponse({ status: 200, description: 'Detailed health status' })
  async detailedHealthCheck() {
    return this.healthCheckService.getDetailedHealth();
  }

  @Post('check/:service')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check specific service health' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async checkService(@Query('service') serviceName: string) {
    return this.healthCheckService.checkService(serviceName);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get health metrics' })
  @ApiResponse({ status: 200, description: 'Health metrics' })
  async getHealthMetrics() {
    return this.healthCheckService.getHealthMetrics();
  }
}