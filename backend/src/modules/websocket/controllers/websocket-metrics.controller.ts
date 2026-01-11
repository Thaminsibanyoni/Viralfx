import { Controller, Get, UseGuards, UseInterceptors, Logger, InternalServerErrorException } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConnectionQualityMonitorService } from '../services/connection-quality-monitor.service';
import { WebSocketMetricsResponseDto } from '../dto/metrics.dto';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags('WebSocket')
@Controller('websocket')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CacheInterceptor)
export class WebSocketMetricsController {
  private readonly logger = new Logger(WebSocketMetricsController.name);

  constructor(
    private readonly connectionQualityMonitor: ConnectionQualityMonitorService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get comprehensive WebSocket metrics for monitoring' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Metrics retrieved successfully',
    type: WebSocketMetricsResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @CacheTTL(30) // 30-second cache
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getMetrics(): Promise<WebSocketMetricsResponseDto> {
    try {
      const metrics = await this.connectionQualityMonitor.getWebSocketMetrics();

      return {
        ...metrics,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to retrieve WebSocket metrics:', error);
      throw new InternalServerErrorException('Unable to retrieve WebSocket metrics');
    }
  }
}
