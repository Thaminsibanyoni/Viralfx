import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ViralService } from '../services/viral.service';
import { ViralIndexService } from '../services/viral-index.service';
import { ViralMetricsService } from '../services/viral-metrics.service';

@ApiTags('Viral Analysis')
@Controller('viral')
@UseGuards(JwtAuthGuard, ThrottlerGuard, RolesGuard)
@ApiBearerAuth()
export class ViralController {
  constructor(
    private readonly viralService: ViralService,
    private readonly viralIndexService: ViralIndexService,
    private readonly viralMetricsService: ViralMetricsService,
  ) {}

  @Post('analyze')
  @Roles('ADMIN', 'ANALYST', 'CONTENT_CREATOR')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Analyze content virality' })
  @ApiResponse({ status: 202, description: 'Virality analysis initiated' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async analyzeVirality(
    @Body() body: {
      content: string;
      topicId: string;
      source?: string;
      authorId?: string;
      metadata?: any;
    },
  ) {
    const { content, topicId, source, authorId, metadata } = body;

    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Content is required');
    }

    if (!topicId) {
      throw new BadRequestException('Topic ID is required');
    }

    if (content.length > 10000) {
      throw new BadRequestException('Content cannot exceed 10,000 characters');
    }

    return this.viralService.analyzeContentVirality(
      content,
      topicId,
      source,
      authorId,
      metadata,
    );
  }

  @Post('batch-analyze')
  @Roles('ADMIN', 'ANALYST')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Batch analyze content virality' })
  @ApiResponse({ status: 202, description: 'Batch virality analysis initiated' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async batchAnalyzeVirality(
    @Body() body: {
      contents: Array<{
        content: string;
        topicId: string;
        source?: string;
        authorId?: string;
        metadata?: any;
      }>;
    },
  ) {
    const { contents } = body;

    if (!contents || contents.length === 0) {
      throw new BadRequestException('At least one content item is required');
    }

    if (contents.length > 50) {
      throw new BadRequestException('Cannot analyze more than 50 items in a single batch');
    }

    return this.viralService.batchAnalyzeVirality(contents);
  }

  @Post('queue-analysis')
  @Roles('ADMIN', 'ANALYST', 'CONTENT_CREATOR')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue virality analysis for background processing' })
  @ApiResponse({ status: 202, description: 'Analysis job queued' })
  async queueViralityAnalysis(
    @Body() body: {
      content: string;
      topicId: string;
      source?: string;
      authorId?: string;
      metadata?: any;
    },
  ) {
    return this.viralService.queueViralityAnalysis(body);
  }

  @Get('topics/:topicId/index')
  @ApiOperation({ summary: 'Get viral index for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiResponse({ status: 200, description: 'Viral index retrieved successfully' })
  async getTopicViralIndex(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('timeWindow') timeWindow: number = 24,
  ) {
    if (timeWindow < 1 || timeWindow > 168) {
      throw new BadRequestException('Time window must be between 1 and 168 hours (1 week)');
    }

    return this.viralIndexService.calculateTopicViralIndex(topicId, timeWindow);
  }

  @Get('topics/:topicId/index/history')
  @ApiOperation({ summary: 'Get viral index history for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'startTime', required: true, description: 'Start time (ISO string)' })
  @ApiQuery({ name: 'endTime', required: true, description: 'End time (ISO string)' })
  @ApiQuery({ name: 'interval', required: false, type: Number, description: 'Interval in minutes (default: 60)' })
  @ApiResponse({ status: 200, description: 'Viral index history retrieved successfully' })
  async getViralIndexHistory(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('interval') interval: number = 60,
  ) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end time format');
    }

    if (start >= end) {
      throw new BadRequestException('Start time must be before end time');
    }

    if (interval < 5 || interval > 1440) {
      throw new BadRequestException('Interval must be between 5 minutes and 1 day');
    }

    return this.viralIndexService.getViralIndexHistory(topicId, start, end, interval);
  }

  @Get('topics/:topicId/content')
  @ApiOperation({ summary: 'Get viral content for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items (default: 20, max: 100)' })
  @ApiQuery({ name: 'minViralScore', required: false, type: Number, description: 'Minimum viral score (default: 0.5)' })
  @ApiResponse({ status: 200, description: 'Viral content retrieved successfully' })
  async getViralContent(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('limit') limit: number = 20,
    @Query('minViralScore') minViralScore: number = 0.5,
  ) {
    const validatedLimit = Math.min(Math.max(limit, 1), 100);

    if (minViralScore < 0 || minViralScore > 1) {
      throw new BadRequestException('Minimum viral score must be between 0 and 1');
    }

    return this.viralService.getViralContent(topicId, validatedLimit, minViralScore);
  }

  @Get('topics/:topicId/virality')
  @ApiOperation({ summary: 'Get comprehensive virality analysis for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiResponse({ status: 200, description: 'Virality analysis retrieved successfully' })
  async getTopicVirality(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('timeWindow') timeWindow: number = 24,
  ) {
    if (timeWindow < 1 || timeWindow > 168) {
      throw new BadRequestException('Time window must be between 1 and 168 hours (1 week)');
    }

    return this.viralService.calculateTopicVirality(topicId, timeWindow);
  }

  @Get('topics/:topicId/velocity')
  @ApiOperation({ summary: 'Get viral velocity for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 1)' })
  @ApiResponse({ status: 200, description: 'Viral velocity retrieved successfully' })
  async getViralVelocity(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('timeWindow') timeWindow: number = 1,
  ) {
    if (timeWindow < 0.5 || timeWindow > 24) {
      throw new BadRequestException('Time window must be between 0.5 and 24 hours');
    }

    return this.viralIndexService.getViralVelocity(topicId, timeWindow);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending viral content' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items (default: 10, max: 50)' })
  @ApiResponse({ status: 200, description: 'Trending content retrieved successfully' })
  async getTrendingViralContent(
    @Query('timeWindow') timeWindow: number = 24,
    @Query('limit') limit: number = 10,
  ) {
    const validatedLimit = Math.min(Math.max(limit, 1), 50);

    if (timeWindow < 1 || timeWindow > 168) {
      throw new BadRequestException('Time window must be between 1 and 168 hours (1 week)');
    }

    return this.viralService.getTrendingViralContent(timeWindow, validatedLimit);
  }

  @Get('topics/trending')
  @ApiOperation({ summary: 'Get trending topics by viral index' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of topics (default: 10, max: 20)' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiQuery({ name: 'minIndex', required: false, type: Number, description: 'Minimum viral index (default: 0.5)' })
  @ApiResponse({ status: 200, description: 'Trending topics retrieved successfully' })
  async getTrendingTopics(
    @Query('limit') limit: number = 10,
    @Query('timeWindow') timeWindow: number = 24,
    @Query('minIndex') minIndex: number = 0.5,
  ) {
    const validatedLimit = Math.min(Math.max(limit, 1), 20);

    if (timeWindow < 1 || timeWindow > 168) {
      throw new BadRequestException('Time window must be between 1 and 168 hours (1 week)');
    }

    if (minIndex < 0 || minIndex > 1) {
      throw new BadRequestException('Minimum index must be between 0 and 1');
    }

    return this.viralIndexService.getTrendingTopics(validatedLimit, timeWindow, minIndex);
  }

  @Get('breakouts')
  @ApiOperation({ summary: 'Detect viral breakouts' })
  @ApiQuery({ name: 'threshold', required: false, type: Number, description: 'Viral score threshold (default: 0.8)' })
  @ApiQuery({ name: 'momentumThreshold', required: false, type: Number, description: 'Momentum threshold (default: 0.6)' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 1)' })
  @ApiResponse({ status: 200, description: 'Viral breakouts detected successfully' })
  async detectViralBreakouts(
    @Query('threshold') threshold: number = 0.8,
    @Query('momentumThreshold') momentumThreshold: number = 0.6,
    @Query('timeWindow') timeWindow: number = 1,
  ) {
    if (threshold < 0 || threshold > 1) {
      throw new BadRequestException('Threshold must be between 0 and 1');
    }

    if (momentumThreshold < 0 || momentumThreshold > 1) {
      throw new BadRequestException('Momentum threshold must be between 0 and 1');
    }

    if (timeWindow < 0.5 || timeWindow > 24) {
      throw new BadRequestException('Time window must be between 0.5 and 24 hours');
    }

    return this.viralIndexService.detectViralBreakouts(threshold, momentumThreshold, timeWindow);
  }

  @Get('topics/:topicId/metrics')
  @ApiOperation({ summary: 'Get detailed metrics for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiResponse({ status: 200, description: 'Topic metrics retrieved successfully' })
  async getTopicMetrics(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('timeWindow') timeWindow: number = 24,
  ) {
    if (timeWindow < 1 || timeWindow > 168) {
      throw new BadRequestException('Time window must be between 1 and 168 hours (1 week)');
    }

    return this.viralMetricsService.getTopicMetrics(topicId, timeWindow);
  }

  @Get('topics/:topicId/metrics/content')
  @ApiOperation({ summary: 'Get content metrics for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'startTime', required: true, description: 'Start time (ISO string)' })
  @ApiQuery({ name: 'endTime', required: true, description: 'End time (ISO string)' })
  @ApiResponse({ status: 200, description: 'Content metrics retrieved successfully' })
  async getContentMetrics(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end time format');
    }

    if (start >= end) {
      throw new BadRequestException('Start time must be before end time');
    }

    return this.viralMetricsService.getContentMetrics(topicId, start);
  }

  @Get('topics/:topicId/metrics/summary')
  @ApiOperation({ summary: 'Get metrics summary for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiResponse({ status: 200, description: 'Metrics summary retrieved successfully' })
  async getMetricsSummary(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('timeWindow') timeWindow: number = 24,
  ) {
    if (timeWindow < 1 || timeWindow > 168) {
      throw new BadRequestException('Time window must be between 1 and 168 hours (1 week)');
    }

    return this.viralMetricsService.getMetricsSummary(topicId, timeWindow);
  }

  @Get('system/metrics')
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Get system-wide viral metrics' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiResponse({ status: 200, description: 'System metrics retrieved successfully' })
  async getSystemMetrics(@Query('timeWindow') timeWindow: number = 24) {
    if (timeWindow < 1 || timeWindow > 168) {
      throw new BadRequestException('Time window must be between 1 and 168 hours (1 week)');
    }

    return this.viralMetricsService.getSystemMetrics(timeWindow);
  }

  @Post('topics/:topicId/update-metrics')
  @Roles('ADMIN', 'SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update viral metrics for a topic (Admin/System only)' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({ status: 200, description: 'Metrics updated successfully' })
  async updateViralMetrics(@Param('topicId', ParseUUIDPipe) topicId: string) {
    await this.viralService.updateViralMetrics(topicId);
    return { message: 'Viral metrics updated successfully', topicId };
  }

  @Post('track-metrics')
  @Roles('SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track viral metrics (System only)' })
  @ApiResponse({ status: 200, description: 'Metrics tracked successfully' })
  async trackMetrics(
    @Body() body: {
      topicId: string;
      contentType: string;
      score: number;
      metadata?: any;
    },
  ) {
    await this.viralMetricsService.trackMetrics(
      body.topicId,
      body.contentType,
      body.score,
      body.metadata,
    );

    return { message: 'Metrics tracked successfully' };
  }
}