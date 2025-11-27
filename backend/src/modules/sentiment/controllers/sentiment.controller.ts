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
import { SentimentService } from '../services/sentiment.service';
import { SentimentAggregationService } from '../services/sentiment-aggregation.service';

@ApiTags('Sentiment')
@Controller('sentiment')
@UseGuards(JwtAuthGuard, ThrottlerGuard, RolesGuard)
@ApiBearerAuth()
export class SentimentController {
  constructor(
    private readonly sentimentService: SentimentService,
    private readonly aggregationService: SentimentAggregationService,
  ) {}

  @Get('topics/:topicId')
  @ApiOperation({ summary: 'Get sentiment analysis for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'timeWindow', required: false, enum: ['1h', '24h', '7d'], description: 'Time window for analysis' })
  @ApiResponse({ status: 200, description: 'Sentiment analysis retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getTopicSentiment(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('timeWindow') timeWindow?: '1h' | '24h' | '7d',
  ) {
    const timeFilter = timeWindow ? this.getTimeFilter(timeWindow) : undefined;
    return this.aggregationService.aggregateSentiment(topicId, timeFilter);
  }

  @Get('topics/:topicId/history')
  @ApiOperation({ summary: 'Get sentiment history for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'interval', required: false, enum: ['hour', 'day', 'week'], description: 'Time interval for history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of data points (default: 24)' })
  @ApiResponse({ status: 200, description: 'Sentiment history retrieved successfully' })
  async getSentimentHistory(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('interval') interval: 'hour' | 'day' | 'week' = 'hour',
    @Query('limit') limit: number = 24,
  ) {
    if (limit > 100) {
      throw new BadRequestException('Limit cannot exceed 100 data points');
    }
    return this.aggregationService.getSentimentHistory(topicId, interval, limit);
  }

  @Get('topics/:topicId/entries')
  @ApiOperation({ summary: 'Get raw sentiment entries for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'source', required: false, description: 'Filter by source' })
  @ApiQuery({ name: 'minConfidence', required: false, type: Number, description: 'Minimum confidence score (0-1)' })
  @ApiResponse({ status: 200, description: 'Sentiment entries retrieved successfully' })
  async getSentimentEntries(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('source') source?: string,
    @Query('minConfidence') minConfidence?: number,
  ) {
    const validatedLimit = Math.min(limit, 100);
    const validatedPage = Math.max(page, 1);

    return this.sentimentService.getSentimentEntries(
      topicId,
      validatedPage,
      validatedLimit,
      source,
      minConfidence
    );
  }

  @Get('top')
  @ApiOperation({ summary: 'Get topics with highest sentiment activity' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of topics (default: 10, max: 50)' })
  @ApiQuery({ name: 'timeWindow', required: false, enum: ['1h', '24h', '7d'], description: 'Time window (default: 24h)' })
  @ApiResponse({ status: 200, description: 'Top sentiment topics retrieved successfully' })
  async getTopSentimentTopics(
    @Query('limit') limit: number = 10,
    @Query('timeWindow') timeWindow: '1h' | '24h' | '7d' = '24h',
  ) {
    const validatedLimit = Math.min(limit, 50);
    return this.aggregationService.getTopSentimentTopics(validatedLimit, timeWindow);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get overall sentiment analysis overview' })
  @ApiQuery({ name: 'timeWindow', required: false, enum: ['1h', '24h', '7d'], description: 'Time window (default: 24h)' })
  @ApiResponse({ status: 200, description: 'Sentiment overview retrieved successfully' })
  async getSentimentOverview(
    @Query('timeWindow') timeWindow: '1h' | '24h' | '7d' = '24h',
  ) {
    return this.sentimentService.getSentimentOverview(timeWindow);
  }

  @Post('analyze')
  @Roles('ADMIN', 'ANALYST')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger sentiment analysis for content' })
  @ApiResponse({ status: 202, description: 'Sentiment analysis job queued' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async analyzeSentiment(
    @Body() body: {
      content: string;
      topicId?: string;
      source?: string;
      metadata?: any;
    },
  ) {
    const { content, topicId, source, metadata } = body;

    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Content is required');
    }

    if (content.length > 10000) {
      throw new BadRequestException('Content cannot exceed 10,000 characters');
    }

    return this.sentimentService.queueSentimentAnalysis({
      content,
      topicId,
      source: source || 'manual',
      metadata,
    });
  }

  @Post('batch-analyze')
  @Roles('ADMIN', 'ANALYST')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger sentiment analysis for multiple topics' })
  @ApiResponse({ status: 202, description: 'Batch sentiment analysis job queued' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async batchAnalyzeSentiment(
    @Body() body: {
      topicIds: string[];
      forceRefresh?: boolean;
    },
  ) {
    const { topicIds, forceRefresh = false } = body;

    if (!topicIds || topicIds.length === 0) {
      throw new BadRequestException('At least one topic ID is required');
    }

    if (topicIds.length > 50) {
      throw new BadRequestException('Cannot analyze more than 50 topics in a single batch');
    }

    return this.sentimentService.queueBatchSentimentAnalysis(topicIds, forceRefresh);
  }

  @Get('topics/:topicId/stats')
  @ApiOperation({ summary: 'Get detailed sentiment statistics for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'timeWindow', required: false, enum: ['1h', '24h', '7d'], description: 'Time window (default: 24h)' })
  @ApiResponse({ status: 200, description: 'Sentiment statistics retrieved successfully' })
  async getTopicSentimentStats(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('timeWindow') timeWindow: '1h' | '24h' | '7d' = '24h',
  ) {
    const timeFilter = this.getTimeFilter(timeWindow);
    return this.sentimentService.getTopicSentimentStats(topicId, timeFilter);
  }

  @Post('cleanup')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cleanup old sentiment data (Admin only)' })
  @ApiResponse({ status: 200, description: 'Cleanup initiated successfully' })
  async cleanupOldData(
    @Body() body: {
      olderThanDays?: number;
      keepAggregated?: boolean;
    } = {},
  ) {
    const { olderThanDays = 30, keepAggregated = true } = body;

    return this.sentimentService.cleanupOldData(olderThanDays, keepAggregated);
  }

  private getTimeFilter(timeWindow: '1h' | '24h' | '7d'): { from: Date; to: Date } {
    const now = new Date();
    let from: Date;

    switch (timeWindow) {
      case '1h':
        from = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { from, to: now };
  }
}