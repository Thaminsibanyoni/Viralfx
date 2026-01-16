import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { TrendApprovalService } from '../services/trend-approval.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

/**
 * Trend Approval Controller
 *
 * Admin endpoints for managing auto-generated trends from free API sources.
 * All endpoints require admin authentication.
 */

@ApiTags('admin-trends')
@Controller('admin/trends')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
export class TrendApprovalController {
  private readonly logger = new Logger(TrendApprovalController.name);

  constructor(private readonly trendApprovalService: TrendApprovalService) {}

  /**
   * Get all pending trends awaiting approval
   */
  @Get('pending')
  @ApiOperation({
    summary: 'Get pending trends',
    description: 'Fetch all trends awaiting admin approval. These are auto-generated from free API sources.'
  })
  @ApiResponse({ status: 200, description: 'Pending trends retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of trends to return' })
  async getPendingTrends(@Query('limit') limit?: number) {
    this.logger.log(`Fetching pending trends (limit: ${limit || 50})`);

    const trends = await this.trendApprovalService.getPendingTrends(limit || 50);

    return {
      success: true,
      data: trends,
      count: trends.length,
      message: `Found ${trends.length} pending trends`
    };
  }

  /**
   * Get approval statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get approval statistics',
    description: 'Get statistics about trend approvals and rejections'
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getApprovalStats() {
    this.logger.log('Fetching approval statistics');

    const stats = await this.trendApprovalService.getApprovalStats();

    return {
      success: true,
      data: stats,
      message: 'Approval statistics retrieved'
    };
  }

  /**
   * Search trends by keyword
   */
  @Get('search')
  @ApiOperation({
    summary: 'Search trends',
    description: 'Search trends by keyword in name or description'
  })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  async searchTrends(@Query('q') query: string) {
    this.logger.log(`Searching trends with query: "${query}"`);

    const trends = await this.trendApprovalService.searchTrends(query);

    return {
      success: true,
      data: trends,
      count: trends.length,
      query
    };
  }

  /**
   * Get trends by source
   */
  @Get('source/:source')
  @ApiOperation({
    summary: 'Get trends by source',
    description: 'Fetch trends from a specific source (google_trends, reddit, newsapi, etc.)'
  })
  @ApiResponse({ status: 200, description: 'Trends retrieved successfully' })
  @ApiParam({ name: 'source', description: 'Trend source name' })
  async getTrendsBySource(@Param('source') source: string) {
    this.logger.log(`Fetching trends from source: ${source}`);

    const trends = await this.trendApprovalService.getTrendsBySource(source);

    return {
      success: true,
      data: trends,
      count: trends.length,
      source
    };
  }

  /**
   * Get approval history
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get approval history',
    description: 'Get history of approved and rejected trends'
  })
  @ApiResponse({ status: 200, description: 'History retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getApprovalHistory(@Query('limit') limit?: number) {
    this.logger.log(`Fetching approval history (limit: ${limit || 50})`);

    const history = await this.trendApprovalService.getApprovalHistory(limit || 50);

    return {
      success: true,
      data: history,
      count: history.length
    };
  }

  /**
   * Approve a single trend
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a trend',
    description: 'Approve a pending trend to make it active and visible to users'
  })
  @ApiResponse({ status: 200, description: 'Trend approved successfully' })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  async approveTrend(
    @Param('id') topicId: string,
    @Body('adminId') adminId: string
  ) {
    this.logger.log(`Approving trend ${topicId} by admin ${adminId}`);

    const result = await this.trendApprovalService.approveTrend(topicId, adminId);

    return result;
  }

  /**
   * Reject a single trend
   */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a trend',
    description: 'Reject a pending trend. It will be archived and not shown to users.'
  })
  @ApiResponse({ status: 200, description: 'Trend rejected successfully' })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  async rejectTrend(
    @Param('id') topicId: string,
    @Body() body: { adminId: string; reason?: string }
  ) {
    this.logger.log(`Rejecting trend ${topicId} by admin ${body.adminId}. Reason: ${body.reason}`);

    const result = await this.trendApprovalService.rejectTrend(
      topicId,
      body.adminId,
      body.reason
    );

    return result;
  }

  /**
   * Bulk approve multiple trends
   */
  @Post('bulk/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk approve trends',
    description: 'Approve multiple trends at once'
  })
  @ApiResponse({ status: 200, description: 'Bulk approval completed' })
  async bulkApproveTrends(
    @Body() body: { topicIds: string[]; adminId: string }
  ) {
    this.logger.log(`Bulk approving ${body.topicIds.length} trends by admin ${body.adminId}`);

    const result = await this.trendApprovalService.bulkApprove(
      body.topicIds,
      body.adminId
    );

    return {
      success: true,
      data: result,
      message: `Bulk approved ${result.successful.length} trends, ${result.failed.length} failed`
    };
  }

  /**
   * Bulk reject multiple trends
   */
  @Post('bulk/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk reject trends',
    description: 'Reject multiple trends at once'
  })
  @ApiResponse({ status: 200, description: 'Bulk rejection completed' })
  async bulkRejectTrends(
    @Body() body: { topicIds: string[]; adminId: string; reason?: string }
  ) {
    this.logger.log(`Bulk rejecting ${body.topicIds.length} trends by admin ${body.adminId}`);

    const result = await this.trendApprovalService.bulkReject(
      body.topicIds,
      body.adminId,
      body.reason
    );

    return {
      success: true,
      data: result,
      message: `Bulk rejected ${result.successful.length} trends, ${result.failed.length} failed`
    };
  }

  /**
   * Get trend details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get trend details',
    description: 'Get detailed information about a specific trend'
  })
  @ApiResponse({ status: 200, description: 'Trend details retrieved' })
  @ApiParam({ name: 'id', description: 'Topic ID' })
  async getTrendDetails(@Param('id') topicId: string) {
    this.logger.log(`Fetching details for trend ${topicId}`);

    // Use Prisma directly to get full trend details
    const { PrismaService } = require('../../prisma/prisma.service');
    const prisma = new PrismaService();

    const trend = await prisma.topic.findUnique({
      where: { id: topicId }
    });

    if (!trend) {
      return {
        success: false,
        message: 'Trend not found'
      };
    }

    return {
      success: true,
      data: trend,
      message: 'Trend details retrieved'
    };
  }
}
