import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  NotFoundException,
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
import { TopicsService } from '../services/topics.service';
import { TopicMergingService } from '../services/topic-merging.service';
import { TrendingService } from '../services/trending.service';
import { CreateTopicDto } from '../dto/create-topic.dto';

@ApiTags('Topics')
@Controller('topics')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly topicMergingService: TopicMergingService,
    private readonly trendingService: TrendingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List topics with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search query' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiResponse({ status: 200, description: 'Topics retrieved successfully' })
  async listTopics(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;

    if (search || category) {
      return this.topicsService.searchTopics(search, category, pageNum, limitNum);
    }

    // If no search or category filter, get active topics
    return this.topicsService.searchTopics('', undefined, pageNum, limitNum);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending topics' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of topics (default: 10)' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiQuery({ name: 'region', required: false, type: String, description: 'Filter by region' })
  @ApiResponse({ status: 200, description: 'Trending topics retrieved successfully' })
  async getTrendingTopics(
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('region') region?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : 10;

    if (region) {
      return this.trendingService.getTrendingByRegion(region, limitNum, category);
    }

    if (category) {
      return this.trendingService.getTrendingByCategory(category, limitNum);
    }

    return this.topicsService.getTrendingTopics(limitNum, category);
  }

  @Get('spikes')
  @ApiOperation({ summary: 'Detect viral spikes' })
  @ApiQuery({ name: 'threshold', required: false, type: Number, description: 'Spike threshold multiplier (default: 2.0)' })
  @ApiQuery({ name: 'windowSize', required: false, type: Number, description: 'Window size in minutes (default: 60)' })
  @ApiResponse({ status: 200, description: 'Viral spikes detected successfully' })
  async getViralSpikes(
    @Query('threshold') threshold?: string,
    @Query('windowSize') windowSize?: string,
  ) {
    const thresholdNum = threshold ? parseFloat(threshold) : 2.0;
    const windowSizeNum = windowSize ? parseInt(windowSize) : 60;

    return this.trendingService.detectViralSpikes(thresholdNum, windowSizeNum);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all topic categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories() {
    // This would typically be implemented in TopicsService
    // For now, return common categories
    return {
      categories: [
        'POLITICS',
        'SPORTS',
        'ENTERTAINMENT',
        'TECHNOLOGY',
        'BUSINESS',
        'HEALTH',
        'SCIENCE',
        'ENVIRONMENT',
        'FINANCE',
        'CRYPTOCURRENCY',
        'SOCIAL_MEDIA',
        'BREAKING_NEWS',
        'INTERNATIONAL',
        'LOCAL',
        'OTHER',
      ],
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get topic by ID' })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  @ApiResponse({ status: 200, description: 'Topic retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getTopicById(@Param('id', ParseUUIDPipe) id: string) {
    const topic = await this.topicsService.findById(id);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Get topic stats
    const stats = await this.topicsService.getTopicStats(id);

    return {
      ...topic,
      stats,
    };
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get topic by slug' })
  @ApiParam({ name: 'slug', description: 'Topic slug' })
  @ApiResponse({ status: 200, description: 'Topic retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getTopicBySlug(@Param('slug') slug: string) {
    const topic = await this.topicsService.findBySlug(slug);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Get topic stats
    const stats = await this.topicsService.getTopicStats(topic.id);

    return {
      ...topic,
      stats,
    };
  }

  @Get(':id/trending-history')
  @ApiOperation({ summary: 'Get trending history for a topic' })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  @ApiQuery({ name: 'timeRange', required: false, type: Number, description: 'Time range in hours (default: 24)' })
  @ApiQuery({ name: 'interval', required: false, type: Number, description: 'Interval in minutes (default: 60)' })
  @ApiResponse({ status: 200, description: 'Trending history retrieved successfully' })
  async getTopicTrendingHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('timeRange') timeRange?: string,
    @Query('interval') interval?: string,
  ) {
    const timeRangeNum = timeRange ? parseInt(timeRange) : 24;
    const intervalNum = interval ? parseInt(interval) : 60;

    return this.trendingService.getTrendingHistory(id, timeRangeNum, intervalNum);
  }

  @Get(':id/merge-history')
  @ApiOperation({ summary: 'Get merge history for a topic' })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  @ApiResponse({ status: 200, description: 'Merge history retrieved successfully' })
  async getTopicMergeHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.topicMergingService.getMergeHistory(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create new topic (Admin only)' })
  @ApiResponse({ status: 201, description: 'Topic created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Topic already exists' })
  async createTopic(@Body() createTopicDto: CreateTopicDto) {
    return this.topicsService.createTopic(createTopicDto);
  }

  @Put(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update topic (Admin only)' })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  @ApiResponse({ status: 200, description: 'Topic updated successfully' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async updateTopic(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: Partial<CreateTopicDto>,
  ) {
    return this.topicsService.updateTopic(id, updateData);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete topic (Admin only)' })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  @ApiResponse({ status: 200, description: 'Topic deleted successfully' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async deleteTopic(@Param('id', ParseUUIDPipe) id: string) {
    await this.topicsService.deleteTopic(id);
    return { message: 'Topic deleted successfully' };
  }

  @Post('detect-duplicates')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Detect duplicate topics (Admin only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of topics to check (default: 100)' })
  @ApiResponse({ status: 200, description: 'Duplicate detection completed successfully' })
  async detectDuplicates(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 100;
    return this.topicMergingService.detectDuplicates(limitNum);
  }

  @Post('propose-merge')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Propose topic merge (Admin only)' })
  @ApiResponse({ status: 200, description: 'Merge proposal created successfully' })
  async proposeMerge(@Body() body: {
    primaryTopicId: string;
    duplicateTopicIds: string[];
  }) {
    return this.topicMergingService.proposeMerge(
      body.primaryTopicId,
      body.duplicateTopicIds,
    );
  }

  @Post('execute-merge')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Execute topic merge (Admin only)' })
  @ApiResponse({ status: 200, description: 'Merge execution queued successfully' })
  async executeMerge(
    @Body() body: {
      primaryTopic: { id: string; name: string; slug: string };
      duplicateTopics: Array<{
        id: string;
        name: string;
        slug: string;
        similarityScore: number;
        reason: string;
      }>;
      confidence: number;
      reason: string;
    },
    @Request() req,
  ) {
    return this.topicMergingService.executeMerge(body, req.user.userId);
  }

  @Post('rollback-merge')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rollback topic merge (Admin only)' })
  @ApiResponse({ status: 200, description: 'Merge rollback queued successfully' })
  async rollbackMerge(
    @Body() body: {
      mergeId: string;
      reason?: string;
    },
  ) {
    return this.topicMergingService.rollbackMerge(body.mergeId, body.reason);
  }

  @Post('update-trending-cache')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update trending cache (Admin only)' })
  @ApiResponse({ status: 200, description: 'Trending cache updated successfully' })
  async updateTrendingCache() {
    await this.trendingService.updateTrendingCache();
    return { message: 'Trending cache updated successfully' };
  }
}