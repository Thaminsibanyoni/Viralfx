import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { BettingService } from '../services/betting.service';

@ApiTags('Betting')
@Controller('bets')
@UseGuards(JwtAuthGuard, ThrottlerGuard, RolesGuard)
@ApiBearerAuth()
export class BettingController {
  constructor(private readonly bettingService: BettingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Place a bet on a market' })
  @ApiResponse({ status: 201, description: 'Bet placed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid bet data' })
  @ApiResponse({ status: 402, description: 'Insufficient funds' })
  async placeBet(
    @Body() body: {
      marketId: string;
      outcomeId: string;
      amount: number;
      odds?: number;
      metadata?: any;
    },
    @Request() req,
  ) {
    return this.bettingService.placeBet({
      userId: req.user.userId,
      ...body,
    });
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current user\'s bets' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'WON', 'LOST'], description: 'Filter by bet status' })
  @ApiQuery({ name: 'marketId', required: false, description: 'Filter by market ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 50)' })
  @ApiResponse({ status: 200, description: 'User bets retrieved successfully' })
  async getMyBets(
    @Request() req,
    @Query('status') status?: string,
    @Query('marketId') marketId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const validatedLimit = Math.min(Math.max(limit, 1), 50);

    return this.bettingService.getUserBets(
      req.user.userId,
      {
        status: status as any,
        marketId,
      },
      { page, limit: validatedLimit },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bet details by ID' })
  @ApiParam({ name: 'id', description: 'Bet ID' })
  @ApiResponse({ status: 200, description: 'Bet details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Bet not found' })
  async getBet(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.bettingService.getBet(id, req.user.userId);
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending bet' })
  @ApiParam({ name: 'id', description: 'Bet ID' })
  @ApiResponse({ status: 200, description: 'Bet cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Bet not found' })
  @ApiResponse({ status: 400, description: 'Bet cannot be cancelled' })
  async cancelBet(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    await this.bettingService.cancelBet(id, req.user.userId);
    return { message: 'Bet cancelled successfully' };
  }

  @Put(':id/odds')
  @Roles('ADMIN', 'MARKET_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update bet odds (Admin only)' })
  @ApiParam({ name: 'id', description: 'Bet ID' })
  @ApiResponse({ status: 200, description: 'Bet odds updated successfully' })
  @ApiResponse({ status: 404, description: 'Bet not found' })
  @ApiResponse({ status: 400, description: 'Cannot update settled bet' })
  async updateBetOdds(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { newOdds: number },
  ) {
    await this.bettingService.updateBetOdds(id, body.newOdds);
    return { message: 'Bet odds updated successfully' };
  }

  @Get('market/:marketId')
  @ApiOperation({ summary: 'Get all bets for a specific market' })
  @ApiParam({ name: 'marketId', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'Market bets retrieved successfully' })
  async getMarketBets(@Param('marketId', ParseUUIDPipe) marketId: string) {
    return this.bettingService.getMarketBets(marketId);
  }

  @Get('stats/my')
  @ApiOperation({ summary: 'Get current user\'s betting statistics' })
  @ApiResponse({ status: 200, description: 'Betting statistics retrieved successfully' })
  async getMyBettingStats(@Request() req) {
    return this.bettingService.getUserBettingStats(req.user.userId);
  }

  @Get('stats/overview')
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Get betting system overview statistics' })
  @ApiResponse({ status: 200, description: 'Betting statistics retrieved successfully' })
  async getBettingOverview() {
    // This would return comprehensive betting statistics
    return {
      totalBets: 0,
      activeBets: 0,
      totalVolume: 0,
      averageBetSize: 0,
      totalPayouts: 0,
      platformRevenue: 0,
      topBettors: [],
      recentActivity: [],
    };
  }

  @Get('stats/top-bettors')
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Get top bettors by volume' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results (default: 10, max: 50)' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in days (default: 30)' })
  @ApiResponse({ status: 200, description: 'Top bettors retrieved successfully' })
  async getTopBettors(
    @Query('limit') limit: number = 10,
    @Query('timeWindow') timeWindow: number = 30,
  ) {
    // This would query user betting stats and return top performers
    const validatedLimit = Math.min(Math.max(limit, 1), 50);

    return {
      timeWindow,
      topBettors: [], // Would be populated with actual data
    };
  }

  @Get('history/:userId')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Get betting history for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 50)' })
  @ApiResponse({ status: 200, description: 'User betting history retrieved successfully' })
  async getUserBettingHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const validatedLimit = Math.min(Math.max(limit, 1), 50);

    return this.bettingService.getUserBets(
      userId,
      {},
      { page, limit: validatedLimit },
    );
  }

  @Get('analysis/activity')
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Get betting activity analysis' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiQuery({ name: 'granularity', required: false, enum: ['hour', 'day', 'week'], description: 'Analysis granularity' })
  @ApiResponse({ status: 200, description: 'Betting activity analysis retrieved successfully' })
  async getBettingActivityAnalysis(
    @Query('timeWindow') timeWindow: number = 24,
    @Query('granularity') granularity: string = 'hour',
  ) {
    // This would return comprehensive betting activity analysis
    return {
      timeWindow,
      granularity,
      totalBets: 0,
      totalVolume: 0,
      betFrequency: [],
      volumeTrend: [],
      outcomeDistribution: [],
      timeDistribution: [],
      insights: [],
    };
  }

  @Post('bulk/place')
  @Roles('SYSTEM')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Place multiple bets in bulk (System only)' })
  @ApiResponse({ status: 202, description: 'Bulk bet placement initiated' })
  @ApiResponse({ status: 400, description: 'Invalid bulk bet data' })
  async placeBulkBets(
    @Body() body: {
      bets: Array<{
        userId: string;
        marketId: string;
        outcomeId: string;
        amount: number;
        odds?: number;
        metadata?: any;
      }>;
    },
  ) {
    const { bets } = body;

    if (!bets || bets.length === 0) {
      throw new BadRequestException('At least one bet is required');
    }

    if (bets.length > 50) {
      throw new BadRequestException('Cannot place more than 50 bets in a single request');
    }

    // Process each bet (would be done in parallel for efficiency)
    const results = await Promise.allSettled(
      bets.map(betData =>
        this.bettingService.placeBet(betData).catch(error => ({
          error: error.message,
          data: betData,
        }))
      )
    );

    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;

    return {
      message: `Bulk bet placement completed: ${successful} successful, ${failed} failed`,
      totalBets: bets.length,
      successful,
      failed,
      errors: failed > 0 ? results.filter(r => r.error).map(r => r.error) : undefined,
    };
  }

  @Get('risk/suspicious')
  @Roles('ADMIN', 'RISK_MANAGER', 'MODERATOR')
  @ApiOperation({ summary: 'Get potentially suspicious betting patterns' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiQuery({ name: 'threshold', required: false, type: Number, description: 'Suspicion threshold (default: 0.7)' })
  @ApiResponse({ status: 200, description: 'Suspicious betting patterns retrieved' })
  async getSuspiciousBettingPatterns(
    @Query('timeWindow') timeWindow: number = 24,
    @Query('threshold') threshold: number = 0.7,
  ) {
    // This would analyze betting patterns for suspicious activity
    return {
      timeWindow,
      threshold,
      suspiciousPatterns: [],
      flaggedUsers: [],
      flaggedMarkets: [],
      recommendations: [],
    };
  }

  @Post('bet/:betId/validate')
  @Roles('ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'Validate a bet for compliance' })
  @ApiParam({ name: 'betId', description: 'Bet ID' })
  @ApiResponse({ status: 200, description: 'Bet validation completed' })
  async validateBet(
    @Param('betId', ParseUUIDPipe) betId: string,
    @Body() body: {
      validationRules?: string[];
    },
  ) {
    // This would validate bet compliance
    return {
      betId,
      isValid: true,
      riskScore: 0.3,
      violations: [],
      recommendations: [],
      validatedAt: new Date(),
    };
  }
}