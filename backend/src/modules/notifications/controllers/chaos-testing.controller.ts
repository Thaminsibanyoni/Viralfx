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
import { ChaosTestingService } from '../services/chaos-testing.service';

@ApiTags('Chaos Testing')
@Controller('chaos-testing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ChaosTestingController {
  constructor(private readonly chaosTestingService: ChaosTestingService) {}
  @Post('simulate-failure')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simulate a notification system failure' })
  @ApiResponse({ status: 200, description: 'Failure simulation completed successfully' })
  async simulateFailure(@Body() simulationConfig: any) {
  return this.chaosTestingService.simulateFailure(simulationConfig);
  }
  @Post('inject-latency')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inject latency into notification processing' })
  @ApiResponse({ status: 200, description: 'Latency injection completed successfully' })
  async injectLatency(@Body() latencyConfig: { duration: number; provider?: string }) {
  return this.chaosTestingService.injectLatency(latencyConfig);
  }
  @Post('disable-provider')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Temporarily disable a notification provider' })
  @ApiResponse({ status: 200, description: 'Provider disabled successfully' })
  async disableProvider(@Body() providerConfig: { provider: string; duration?: number }) {
  return this.chaosTestingService.disableProvider(providerConfig);
  }
  @Post('enable-provider')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-enable a disabled notification provider' })
  @ApiResponse({ status: 200, description: 'Provider enabled successfully' })
  async enableProvider(@Body() providerConfig: { provider: string }) {
  return this.chaosTestingService.enableProvider(providerConfig);
  }
  @Get('status')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get current chaos testing status' })
  @ApiResponse({ status: 200, description: 'Chaos testing status retrieved successfully' })
  async getChaosStatus() {
  return this.chaosTestingService.getChaosStatus();
  }
  @Get('experiments')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get list of chaos experiments' })
  @ApiResponse({ status: 200, description: 'Chaos experiments retrieved successfully' })
  async getExperiments(
    @Query('status') status?: 'active' | 'completed' | 'failed',
    @Query('limit') limit?: number) {
  return this.chaosTestingService.getExperiments({ status, limit });
  }
  @Get('experiments/:experimentId')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get details of a specific chaos experiment' })
  @ApiResponse({ status: 200, description: 'Experiment details retrieved successfully' })
  async getExperiment(@Param('experimentId') experimentId: string) {
  return this.chaosTestingService.getExperiment(experimentId);
  }
  @Post('experiments/:experimentId/stop')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop an active chaos experiment' })
  @ApiResponse({ status: 200, description: 'Experiment stopped successfully' })
  async stopExperiment(@Param('experimentId') experimentId: string) {
  return this.chaosTestingService.stopExperiment(experimentId);
  }
  @Post('test-load')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform load testing on notification system' })
  @ApiResponse({ status: 200, description: 'Load test completed successfully' })
  async performLoadTest(@Body() loadTestConfig: any) {
  return this.chaosTestingService.performLoadTest(loadTestConfig);
  }
  @Get('metrics')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get chaos testing metrics' })
  @ApiResponse({ status: 200, description: 'Chaos testing metrics retrieved successfully' })
  async getChaosMetrics(@Query('timeRange') timeRange?: string) {
  return this.chaosTestingService.getChaosMetrics(timeRange);
  }
  @Post('create-scenario')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom chaos testing scenario' })
  @ApiResponse({ status: 201, description: 'Chaos scenario created successfully' })
  async createScenario(@Body() scenarioConfig: any) {
  return this.chaosTestingService.createScenario(scenarioConfig);
  }
  @Get('scenarios')
  @Roles('admin', 'monitoring')
  @ApiOperation({ summary: 'Get available chaos testing scenarios' })
  @ApiResponse({ status: 200, description: 'Chaos scenarios retrieved successfully' })
  async getScenarios() {
  return this.chaosTestingService.getScenarios();
  }
  @Post('rollback')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rollback all active chaos experiments' })
  @ApiResponse({ status: 200, description: 'Rollback completed successfully' })
  async rollbackAllExperiments() {
  return this.chaosTestingService.rollbackAllExperiments();
  }
}