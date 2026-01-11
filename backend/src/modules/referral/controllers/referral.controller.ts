import { 
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  ParseUUIDPipe, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam
} from '@nestjs/swagger';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ReferralService,
  ReferralTrackingService
} from '../services/index';
import {
  ReferralStatsDto,
  ReferralCodeDto,
  CreateReferralCodeDto,
  ValidateReferralDto,
  ReferralHistoryDto,
  LeaderboardDto,
  ReferralAnalyticsDto,
  ReferralTermsDto,
  ReferralTierDto,
  TrackClickDto
} from '../dto/referral.dto';

@ApiTags('Referral')
@Controller('referral')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@ApiBearerAuth()
export class ReferralController {
  constructor(
    private readonly referralService: ReferralService,
    private readonly referralTrackingService: ReferralTrackingService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user referral statistics' })
  @ApiResponse({ status: 200, description: 'Referral statistics retrieved successfully', type: ReferralStatsDto })
  @ApiQuery({ name: 'timeWindow', required: false, description: 'Time window for stats (e.g., 7d, 30d, 90d)' })
  async getMyReferralStats(
    @Req() req,
    @Query('timeWindow') timeWindow?: string): Promise<ReferralStatsDto> {
    return this.referralService.getReferralStats(req.user.id, timeWindow);
  }

  @Get('code')
  @ApiOperation({ summary: 'Get current user referral code' })
  @ApiResponse({ status: 200, description: 'Referral code retrieved successfully', type: ReferralCodeDto })
  async getMyReferralCode(@Req() req): Promise<ReferralCodeDto> {
    const codes = await this.referralService.getUserReferralCodes(req.user.id, { isActive: true, limit: 1 });
    if (codes.codes.length === 0) {
      // Create a default referral code if none exists
      return this.referralService.createReferralCode(req.user.id, {
        description: 'Default referral code'
      });
    }
    return codes.codes[0];
  }

  @Post('code')
  @ApiOperation({ summary: 'Create a new referral code' })
  @ApiResponse({ status: 201, description: 'Referral code created successfully', type: ReferralCodeDto })
  @Roles('USER', 'ADMIN')
  async createReferralCode(
    @Req() req,
    @Body() createData: CreateReferralCodeDto): Promise<ReferralCodeDto> {
    return this.referralService.createReferralCode(req.user.id, createData);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a referral code' })
  @ApiResponse({ status: 200, description: 'Referral code validation result', type: ValidateReferralDto })
  @ApiQuery({ name: 'code', required: true, description: 'Referral code to validate' })
  async validateReferralCode(
    @Query('code') code: string,
    @Req() req): Promise<ValidateReferralDto> {
    const result = await this.referralService.useReferralCode(code, req.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    return {
      isValid: result.success,
      referralCode: result.referralCode,
      message: result.message
    };
  }

  @Post('track-click')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track referral code click (public endpoint)' })
  @ApiResponse({ status: 200, description: 'Click tracked successfully' })
  @ApiQuery({ name: 'code', required: true, description: 'Referral code' })
  async trackReferralClick(
    @Query('code') code: string,
    @Body() clickData: TrackClickDto,
    @Req() req): Promise<{ success: boolean; message: string }> {
    try {
      await this.referralTrackingService.trackReferralClick(code, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer,
        ...clickData
      });

      return { success: true, message: 'Click tracked successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to track click' };
    }
  }

  @Get('history')
  @ApiOperation({ summary: 'Get referral history' })
  @ApiResponse({ status: 200, description: 'Referral history retrieved successfully', type: ReferralHistoryDto })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  async getReferralHistory(
    @Req() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string): Promise<ReferralHistoryDto> {
    // This would need to be implemented in ReferralService
    // For now, return a placeholder
    return {
      referrals: [],
      total: 0,
      page,
      totalPages: 0
    };
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get referral leaderboard' })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully', type: LeaderboardDto })
  @ApiQuery({ name: 'timeWindow', required: false, description: 'Time window (daily, weekly, monthly)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of entries' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  async getLeaderboard(
    @Query('timeWindow') timeWindow = 'monthly',
    @Query('limit') limit = 50,
    @Query('page') page = 1): Promise<LeaderboardDto> {
    return this.referralService.getLeaderboard(timeWindow, limit, page);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get referral analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully', type: ReferralAnalyticsDto })
  @Roles('ADMIN')
  @ApiQuery({ name: 'timeWindow', required: false, description: 'Time window for analytics' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'], description: 'Group results by' })
  async getAnalytics(
    @Query('timeWindow') timeWindow = '30d',
    @Query('groupBy') groupBy: 'day' | 'week' | 'month' = 'day'): Promise<ReferralAnalyticsDto> {
    return this.referralTrackingService.getReferralAnalytics(timeWindow, groupBy);
  }

  @Get('tiers')
  @ApiOperation({ summary: 'Get available referral tiers' })
  @ApiResponse({ status: 200, description: 'Referral tiers retrieved successfully', type: [ReferralTierDto] })
  async getReferralTiers(): Promise<ReferralTierDto[]> {
    // This would typically come from a database or config
    return [
      {
        name: 'Bronze',
        minReferrals: 1,
        multiplier: 1.0,
        benefits: ['Basic referral rewards'],
        color: '#CD7F32'
      },
      {
        name: 'Silver',
        minReferrals: 5,
        multiplier: 1.5,
        benefits: ['Increased rewards', 'Priority support'],
        color: '#C0C0C0'
      },
      {
        name: 'Gold',
        minReferrals: 10,
        multiplier: 2.0,
        benefits: ['Double rewards', 'Exclusive features'],
        color: '#FFD700'
      },
      {
        name: 'Platinum',
        minReferrals: 20,
        multiplier: 3.0,
        benefits: ['Triple rewards', 'Premium features'],
        color: '#E5E4E2'
      },
      {
        name: 'Diamond',
        minReferrals: 50,
        multiplier: 5.0,
        benefits: ['5x rewards', 'VIP access', 'Personal manager'],
        color: '#B9F2FF'
      },
    ];
  }

  @Get('terms')
  @ApiOperation({ summary: 'Get referral program terms and conditions' })
  @ApiResponse({ status: 200, description: 'Terms retrieved successfully', type: ReferralTermsDto })
  async getReferralTerms(): Promise<ReferralTermsDto> {
    return {
      version: '1.0',
      effectiveDate: new Date().toISOString(),
      programDescription: 'ViralFX Referral Program - Earn rewards by referring new users',
      eligibility: 'All verified users can participate in the referral program',
      rewardStructure: {
        signup: 'Earn rewards when referred users complete registration',
        kyc: 'Additional rewards when referred users complete KYC verification',
        firstTrade: 'Bonus rewards when referred users make their first trade'
      },
      paymentTerms: 'Rewards are credited to your wallet within 24 hours of completion',
      restrictions: [
        'Self-referrals are strictly prohibited',
        'Each user can only use one referral code',
        'Referral codes expire after 365 days',
        'Rewards are subject to ViralFX terms and conditions',
      ],
      termination: 'ViralFX reserves the right to terminate the referral program at any time',
      lastUpdated: new Date().toISOString()
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get real-time referral metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  @Roles('ADMIN')
  async getRealTimeMetrics() {
    return this.referralTrackingService.getRealTimeMetrics();
  }

  @Get('events/:referralId')
  @ApiOperation({ summary: 'Get events for a specific referral' })
  @ApiResponse({ status: 200, description: 'Referral events retrieved successfully' })
  @ApiParam({ name: 'referralId', description: 'Referral ID' })
  @Roles('ADMIN')
  async getReferralEvents(@Param('referralId', ParseUUIDPipe) referralId: string) {
    return this.referralTrackingService.getReferralEvents(referralId);
  }
}
