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
import { DeceptionService } from '../services/deception.service';
import { DeceptionAnalysisService } from '../services/deception-analysis.service';

@ApiTags('Deception Detection')
@Controller('deception')
@UseGuards(JwtAuthGuard, ThrottlerGuard, RolesGuard)
@ApiBearerAuth()
export class DeceptionController {
  constructor(
    private readonly deceptionService: DeceptionService,
    private readonly analysisService: DeceptionAnalysisService,
  ) {}

  @Get('topics/:topicId')
  @ApiOperation({ summary: 'Get deception analysis for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'timestamp', required: false, description: 'Get analysis at specific timestamp' })
  @ApiResponse({ status: 200, description: 'Deception analysis retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getTopicDeception(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('timestamp') timestamp?: string,
  ) {
    const snapshotTime = timestamp ? new Date(timestamp) : undefined;
    return this.deceptionService.getDeceptionSnapshot(topicId, snapshotTime);
  }

  @Get('topics/:topicId/history')
  @ApiOperation({ summary: 'Get deception history for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'startTime', required: true, description: 'Start time (ISO string)' })
  @ApiQuery({ name: 'endTime', required: true, description: 'End time (ISO string)' })
  @ApiQuery({ name: 'interval', required: false, type: Number, description: 'Interval in minutes (default: 60)' })
  @ApiResponse({ status: 200, description: 'Deception history retrieved successfully' })
  async getDeceptionHistory(
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

    return this.deceptionService.getDeceptionHistory(topicId, start, end, interval);
  }

  @Get('topics/:topicId/stats')
  @ApiOperation({ summary: 'Get deception statistics for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiResponse({ status: 200, description: 'Deception statistics retrieved successfully' })
  async getDeceptionStats(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('timeWindow') timeWindow: number = 24,
  ) {
    return this.deceptionService.getDeceptionStats(topicId, timeWindow);
  }

  @Get('high-risk')
  @ApiOperation({ summary: 'Get high-risk content requiring attention' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items (default: 20, max: 100)' })
  @ApiQuery({ name: 'minRiskLevel', required: false, enum: ['MEDIUM', 'HIGH', 'CRITICAL'], description: 'Minimum risk level (default: HIGH)' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiResponse({ status: 200, description: 'High-risk content retrieved successfully' })
  async getHighRiskContent(
    @Query('limit') limit: number = 20,
    @Query('minRiskLevel') minRiskLevel: 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH',
    @Query('timeWindow') timeWindow: number = 24,
  ) {
    const validatedLimit = Math.min(limit, 100);
    return this.deceptionService.getHighRiskContent(validatedLimit, minRiskLevel, timeWindow);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get overall deception detection overview' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiResponse({ status: 200, description: 'Deception overview retrieved successfully' })
  async getDeceptionOverview(@Query('timeWindow') timeWindow: number = 24) {
    // This would typically return system-wide statistics
    return {
      timeWindow,
      message: 'Deception overview endpoint - to be implemented with system-wide stats',
    };
  }

  @Post('analyze')
  @Roles('ADMIN', 'ANALYST', 'MODERATOR')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger deception analysis for content' })
  @ApiResponse({ status: 202, description: 'Deception analysis job queued' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async analyzeDeception(
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

    if (content.length > 50000) {
      throw new BadRequestException('Content cannot exceed 50,000 characters');
    }

    return this.deceptionService.queueDeceptionAnalysis({
      content,
      topicId,
      source,
      metadata,
    });
  }

  @Post('analyze-advanced')
  @Roles('ADMIN', 'ANALYST')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Perform advanced deception analysis' })
  @ApiResponse({ status: 202, description: 'Advanced analysis initiated' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async analyzeAdvancedDeception(
    @Body() body: {
      content: string;
      source?: string;
      includeSocialMediaAnalysis?: boolean;
      includeMediaAnalysis?: boolean;
      mediaUrl?: string;
    },
  ) {
    const { content, source, includeSocialMediaAnalysis, includeMediaAnalysis, mediaUrl } = body;

    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Content is required');
    }

    const analysis = await this.analysisService.performAdvancedAnalysis(content, source);

    const results = {
      linguisticAnalysis: analysis.linguisticPatterns,
      sourceAnalysis: analysis.sourceAnalysis,
      contentAnalysis: analysis.contentAnalysis,
      riskAssessment: analysis.riskAssessment,
    };

    if (includeSocialMediaAnalysis) {
      results['socialMediaAnalysis'] = await this.analysisService.analyzeSocialMediaAmplification(content);
    }

    if (includeMediaAnalysis && mediaUrl) {
      results['mediaAnalysis'] = await this.analysisService.detectDeepfakes(mediaUrl);
    }

    return results;
  }

  @Post('batch-analyze')
  @Roles('ADMIN', 'ANALYST')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger batch deception analysis' })
  @ApiResponse({ status: 202, description: 'Batch deception analysis job queued' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async batchAnalyzeDeception(
    @Body() body: {
      contents: Array<{
        content: string;
        topicId: string;
        source?: string;
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

    // Validate each content item
    for (const item of contents) {
      if (!item.content || item.content.trim().length === 0) {
        throw new BadRequestException('All content items must have non-empty content');
      }
      if (!item.topicId) {
        throw new BadRequestException('All content items must have a topicId');
      }
    }

    return this.deceptionService.batchAnalyzeDeception(contents);
  }

  @Post('cross-reference')
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Cross-reference claim with fact-checking sources' })
  @ApiResponse({ status: 200, description: 'Cross-reference analysis completed' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async crossReferenceClaim(
    @Body() body: {
      claim: string;
    },
  ) {
    const { claim } = body;

    if (!claim || claim.trim().length === 0) {
      throw new BadRequestException('Claim is required');
    }

    return this.analysisService.crossReferenceSources(claim);
  }

  @Put('snapshots/:snapshotId/status')
  @Roles('ADMIN', 'MODERATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update deception analysis review status' })
  @ApiParam({ name: 'snapshotId', description: 'Deception snapshot ID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 404, description: 'Snapshot not found' })
  async updateDeceptionStatus(
    @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
    @Body() body: {
      status: 'REVIEWED' | 'FALSE_POSITIVE' | 'CONFIRMED';
      notes?: string;
    },
    @Request() req,
  ) {
    const { status, notes } = body;

    if (!['REVIEWED', 'FALSE_POSITIVE', 'CONFIRMED'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    return this.deceptionService.updateDeceptionStatus(snapshotId, status, req.user.userId, notes);
  }

  @Post('cleanup')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cleanup old deception data (Admin only)' })
  @ApiResponse({ status: 200, description: 'Cleanup initiated successfully' })
  async cleanupOldData(
    @Body() body: {
      olderThanDays?: number;
    } = {},
  ) {
    const { olderThanDays = 90 } = body;

    return this.deceptionService.cleanupOldData(olderThanDays);
  }
}