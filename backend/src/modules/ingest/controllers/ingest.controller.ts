import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { IngestService } from '../services/ingest.service';
import { TriggerCollectionDto } from '../dto/trigger-collection.dto';
import { CollectionStatusResponseDto } from '../dto/collection-status.dto';
import { CollectionResult } from '../interfaces/ingest.interface';

@ApiTags('ingest')
@Controller('ingest')
export class IngestController {
  private readonly logger = new Logger(IngestController.name);

  constructor(private readonly ingestService: IngestService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually trigger content collection from social platforms' })
  @ApiResponse({ status: 200, description: 'Collection triggered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async triggerCollection(
    @Body(new ValidationPipe()) triggerDto: TriggerCollectionDto,
  ): Promise<CollectionResult | CollectionResult[]> {
    try {
      this.logger.log(`Manual collection trigger received: ${JSON.stringify(triggerDto)}`);

      if (triggerDto.platform && triggerDto.platform !== 'all') {
        // Collect from specific platform
        const result = await this.ingestService.collectFromPlatform(
          triggerDto.platform,
          triggerDto,
        );
        this.logger.log(`Collection completed for platform ${triggerDto.platform}: ${result.collected} items`);
        return result;
      } else {
        // Collect from all platforms
        const results = await this.ingestService.collectFromAllPlatforms();
        const totalCollected = results.reduce((sum, result) => sum + result.collected, 0);
        this.logger.log(`Collection completed for all platforms: ${totalCollected} total items`);
        return results;
      }
    } catch (error) {
      this.logger.error('Failed to trigger collection:', error);
      throw error;
    }
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current collection status for all platforms' })
  @ApiResponse({ status: 200, description: 'Status retrieved successfully', type: CollectionStatusResponseDto })
  async getCollectionStatus(): Promise<CollectionStatusResponseDto> {
    try {
      const status = await this.ingestService.getCollectionStatus();
      return status;
    } catch (error) {
      this.logger.error('Failed to get collection status:', error);
      throw error;
    }
  }

  @Get('stats/:platform')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get detailed statistics for a specific platform' })
  @ApiParam({ name: 'platform', description: 'Platform name (twitter, tiktok, instagram, youtube, facebook)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Platform not found' })
  async getPlatformStats(@Param('platform') platform: string): Promise<any> {
    try {
      const stats = await this.ingestService.getPlatformStatistics(platform);
      return stats;
    } catch (error) {
      this.logger.error(`Failed to get stats for platform ${platform}:`, error);
      throw error;
    }
  }

  @Post('stop/:platform')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stop ongoing collection for a platform' })
  @ApiParam({ name: 'platform', description: 'Platform name to stop' })
  @ApiResponse({ status: 200, description: 'Collection stopped successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Platform not found' })
  async stopCollection(@Param('platform') platform: string): Promise<{ message: string }> {
    try {
      await this.ingestService.stopCollection(platform);
      this.logger.log(`Collection stopped for platform: ${platform}`);
      return { message: `Collection stopped for platform: ${platform}` };
    } catch (error) {
      this.logger.error(`Failed to stop collection for platform ${platform}:`, error);
      throw error;
    }
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get ingest system health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  async getHealthStatus(): Promise<any> {
    try {
      const status = await this.ingestService.getCollectionStatus();

      const healthStatus = {
        status: status.isAnyRunning ? 'running' : 'idle',
        timestamp: new Date(),
        platforms: status.platforms.map(platform => ({
          platform: platform.platform,
          status: platform.isRunning ? 'running' : 'idle',
          lastRun: platform.lastRun,
          lastRunStatus: platform.lastRun ? 'completed' : 'never',
          totalCollected: platform.totalCollected,
          totalFailed: platform.totalFailed,
          healthScore: platform.totalFailed > platform.totalCollected * 0.1 ? 'poor' :
                      platform.totalFailed > 0 ? 'warning' : 'good',
        })),
        summary: {
          totalCollected: status.totalCollected,
          totalFailed: status.totalFailed,
          successRate: status.totalCollected + status.totalFailed > 0
            ? ((status.totalCollected / (status.totalCollected + status.totalFailed)) * 100).toFixed(2) + '%'
            : 'N/A',
          activeCollectors: status.platforms.filter(p => p.isRunning).length,
        },
      };

      return healthStatus;
    } catch (error) {
      this.logger.error('Failed to get health status:', error);
      throw error;
    }
  }

  @Get('platforms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get list of available platforms and their configurations' })
  @ApiResponse({ status: 200, description: 'Platforms list retrieved successfully' })
  async getAvailablePlatforms(): Promise<any[]> {
    try {
      const platforms = ['twitter', 'tiktok', 'instagram', 'youtube', 'facebook'];
      const platformInfo = [];

      for (const platform of platforms) {
        const stats = await this.ingestService.getPlatformStatistics(platform);
        const connector = this.ingestService.getConnector(platform);

        platformInfo.push({
          platform,
          enabled: connector['isPlatformEnabled'] ? connector['isPlatformEnabled']() : false,
          statistics: stats,
          capabilities: {
            supportsRealtime: ['twitter', 'tiktok'].includes(platform),
            supportsVideo: ['tiktok', 'youtube', 'instagram'].includes(platform),
            supportsImages: ['instagram', 'twitter', 'facebook'].includes(platform),
            supportsLongForm: ['youtube', 'facebook'].includes(platform),
          },
        });
      }

      return platformInfo;
    } catch (error) {
      this.logger.error('Failed to get available platforms:', error);
      throw error;
    }
  }
}