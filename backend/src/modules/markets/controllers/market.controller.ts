import {
  Controller,
  Get,
  Post,
  Put,
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
import { MarketsService } from '../services/markets.service';
import { MarketSettlementService } from '../services/market-settlement.service';

@ApiTags('Markets')
@Controller('markets')
@UseGuards(JwtAuthGuard, ThrottlerGuard, RolesGuard)
@ApiBearerAuth()
export class MarketController {
  constructor(
    private readonly marketsService: MarketsService,
    private readonly settlementService: MarketSettlementService,
  ) {}

  @Post()
  @Roles('ADMIN', 'MARKET_CREATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new market' })
  @ApiResponse({ status: 201, description: 'Market created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async createMarket(
    @Body() body: {
      title: string;
      description: string;
      topicId: string;
      marketType: 'BINARY' | 'MULTIPLE_CHOICE' | 'RANGE' | 'VOLUME';
      category: string;
      endDate: string;
      settlementConditions: any;
      initialPrice?: number;
      minBetAmount: number;
      maxBetAmount?: number;
      liquidityPool?: number;
      metadata?: any;
    },
    @Request() req,
  ) {
    const { endDate, ...marketData } = body;

    if (!endDate || new Date(endDate) <= new Date()) {
      throw new BadRequestException('End date must be in the future');
    }

    return this.marketsService.createMarket(
      {
        ...marketData,
        endDate: new Date(endDate),
      },
      req.user.userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all markets with filtering and pagination' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'ACTIVE', 'CLOSED', 'SETTLED'], description: 'Filter by market status' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'topicId', required: false, description: 'Filter by topic ID' })
  @ApiQuery({ name: 'createdBy', required: false, description: 'Filter by creator ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Markets retrieved successfully' })
  async getMarkets(
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('topicId') topicId?: string,
    @Query('createdBy') createdBy?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const validatedLimit = Math.min(Math.max(limit, 1), 100);

    return this.marketsService.getMarkets(
      {
        status: status as any,
        category,
        topicId,
        createdBy,
      },
      { page, limit: validatedLimit },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get market details by ID' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'Market details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  async getMarket(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketsService.getMarket(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get market price history' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'Market history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  async getMarketHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketsService.getMarketHistory(id);
  }

  @Get(':id/performance')
  @ApiOperation({ summary: 'Get market performance metrics' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'Market performance retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  async getMarketPerformance(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketsService.getMarketPerformance(id);
  }

  @Put(':id/prices')
  @Roles('ADMIN', 'SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update market prices (Admin/System only)' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'Market prices updated successfully' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  @ApiResponse({ status: 400, description: 'Cannot update prices for inactive market' })
  async updateMarketPrices(@Param('id', ParseUUIDPipe) id: string) {
    await this.marketsService.updateMarketPrices(id);
    return { message: 'Market prices updated successfully' };
  }

  @Put(':id/close')
  @Roles('ADMIN', 'MARKET_CREATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a market manually' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'Market closed successfully' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  @ApiResponse({ status: 400, description: 'Cannot close inactive market' })
  async closeMarket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    const { reason } = body;
    return this.marketsService.closeMarket(id, reason);
  }

  @Post(':id/settle')
  @Roles('ADMIN', 'SYSTEM')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Settle a market (Admin/System only)' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 202, description: 'Market settlement initiated' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  @ApiResponse({ status: 400, description: 'Market cannot be settled' })
  async settleMarket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      winningOutcomeId?: string;
      settlementMethod?: 'MANUAL' | 'AUTOMATIC';
      reason?: string;
      settlementData?: any;
    },
  ) {
    return this.settlementService.settleMarket({
      marketId: id,
      ...body,
    });
  }

  @Post(':id/settle/partial')
  @Roles('ADMIN', 'SYSTEM')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Process partial settlement for a market' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 202, description: 'Partial settlement initiated' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  async processPartialSettlement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      winningOutcomeId: string;
    },
  ) {
    return this.settlementService.processPartialSettlement(id, body.winningOutcomeId);
  }

  @Get(':id/settlement/history')
  @ApiOperation({ summary: 'Get settlement history for a market' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'Settlement history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  async getSettlementHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.settlementService.getSettlementHistory(id);
  }

  @Post(':id/verify-settlement')
  @Roles('ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'Verify market settlement (Admin/Auditor only)' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  @ApiResponse({ status: 200, description: 'Settlement verification completed' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  async verifySettlement(@Param('id', ParseUUIDPipe) id: string) {
    const settlementId = id; // In a real implementation, this would be a separate settlement ID
    return this.settlementService.verifySettlement(settlementId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search markets by query' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results (default: 10, max: 20)' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchMarkets(
    @Query('q') query: string,
    @Query('limit') limit: number = 10,
  ) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }

    const validatedLimit = Math.min(Math.max(limit, 1), 20);
    return this.marketsService.searchMarkets(query.trim(), validatedLimit);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get currently active markets' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results (default: 20, max: 50)' })
  @ApiResponse({ status: 200, description: 'Active markets retrieved successfully' })
  async getActiveMarkets(@Query('limit') limit: number = 20) {
    return this.marketsService.getMarkets(
      { status: 'ACTIVE' },
      { page: 1, limit: Math.min(limit, 50) },
    );
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending markets by volume' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results (default: 10, max: 25)' })
  @ApiResponse({ status: 200, description: 'Trending markets retrieved successfully' })
  async getTrendingMarkets(
    @Query('timeWindow') timeWindow: number = 24,
    @Query('limit') limit: number = 10,
  ) {
    return this.marketsService.getMarkets(
      {},
      { page: 1, limit: Math.min(limit, 25) },
    );
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all market categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories() {
    // This would typically query distinct categories from markets
    // For now, return mock data
    return [
      { category: 'POLITICS', count: 0, description: 'Political markets and predictions' },
      { category: 'SPORTS', count: 0, description: 'Sports betting markets' },
      { category: 'ENTERTAINMENT', count: 0, description: 'Entertainment and media markets' },
      { category: 'TECHNOLOGY', count: 0, description: 'Tech and cryptocurrency markets' },
      { category: 'BUSINESS', count: 0, description: 'Business and financial markets' },
      { category: 'SOCIAL', count: 0, description: 'Social and cultural trends' },
    ];
  }

  @Get('stats/overview')
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Get market system overview statistics' })
  @ApiQuery({ name: 'timeWindow', required: false, type: Number, description: 'Time window in hours (default: 24)' })
  @ApiResponse({ status: 200, description: 'Market statistics retrieved successfully' })
  async getMarketOverview(@Query('timeWindow') timeWindow: number = 24) {
    // This would return comprehensive market statistics
    return {
      timeWindow,
      totalMarkets: 0,
      activeMarkets: 0,
      settledMarkets: 0,
      totalVolume: 0,
      averageMarketSize: 0,
      topCategories: [],
      recentActivity: [],
    };
  }
}