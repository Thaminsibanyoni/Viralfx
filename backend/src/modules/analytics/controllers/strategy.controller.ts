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
  ValidationPipe,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ForbiddenException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { StrategyService } from '../services/strategy.service';
import { BacktestingService } from '../services/backtesting.service';
import {
  CreateStrategyDto,
  UpdateStrategyDto,
  BacktestQueryDto
} from '../dto/index';
import { BacktestStrategy } from '../interfaces/backtesting.interface';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags('Analytics - Strategies')
@Controller('analytics/strategies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StrategyController {
  constructor(
    private readonly strategyService: StrategyService,
    private readonly backtestingService: BacktestingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new strategy' })
  @ApiResponse({ status: 201, description: 'Strategy created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid strategy data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async createStrategy(
    @Body(ValidationPipe) createDto: CreateStrategyDto,
    @Req() req: { user: { id: string } }): Promise<BacktestStrategy> {
    try {
      return await this.strategyService.createStrategy({
        ...createDto,
        userId: req.user.id
      });
    } catch (error) {
      throw new BadRequestException(`Failed to create strategy: ${error.message}`);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get strategy by ID' })
  @ApiParam({ name: 'id', description: 'Strategy ID' })
  @ApiResponse({ status: 200, description: 'Strategy retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Strategy not found' })
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getStrategy(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role?: string } }): Promise<BacktestStrategy> {
    try {
      const strategy = await this.strategyService.getStrategy(id);

      // Check authorization - users can only see their own private strategies
      if (!strategy.isPublic && strategy.userId !== req.user.id && req.user.role !== 'admin') {
        throw new NotFoundException(`Strategy not found: ${id}`);
      }

      return strategy;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get strategy: ${error.message}`);
    }
  }

  @Get()
  @ApiOperation({ summary: 'List strategies with pagination and filters' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'isPublic', required: false, description: 'Filter by public status' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field', example: 'createdAt' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order', example: 'DESC' })
  @ApiResponse({ status: 200, description: 'Strategies retrieved successfully' })
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async listStrategies(
    @Query() query: {
      category?: string;
      isPublic?: boolean;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    },
    @Req() req: { user: { id: string; role?: string } }): Promise<{
    strategies: BacktestStrategy[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { category, isPublic, page = 1, limit = 20, sortBy, sortOrder } = query;

      // Non-admin users can only see their own strategies unless they're public
      const userId = req.user.role === 'admin' ? undefined : req.user.id;

      const result = await this.strategyService.listStrategies({
        category: category as any,
        userId,
        isPublic,
        page,
        limit,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any
      });

      // Filter out private strategies that don't belong to the user
      if (req.user.role !== 'admin') {
        result.strategies = result.strategies.filter(strategy =>
          strategy.isPublic || strategy.userId === req.user.id
        );
      }

      return result;
    } catch (error) {
      throw new BadRequestException(`Failed to list strategies: ${error.message}`);
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update strategy' })
  @ApiParam({ name: 'id', description: 'Strategy ID' })
  @ApiResponse({ status: 200, description: 'Strategy updated successfully' })
  @ApiResponse({ status: 404, description: 'Strategy not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to update this strategy' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async updateStrategy(
    @Param('id') id: string,
    @Body(ValidationPipe) updateDto: UpdateStrategyDto,
    @Req() req: { user: { id: string; role?: string } }): Promise<BacktestStrategy> {
    try {
      return await this.strategyService.updateStrategy(id, {
        ...updateDto,
        userId: req.user.id // For authorization check
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update strategy: ${error.message}`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete strategy (soft delete)' })
  @ApiParam({ name: 'id', description: 'Strategy ID' })
  @ApiResponse({ status: 204, description: 'Strategy deleted successfully' })
  @ApiResponse({ status: 404, description: 'Strategy not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete this strategy' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async deleteStrategy(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role?: string } }): Promise<void> {
    try {
      await this.strategyService.deleteStrategy(id, req.user.id);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete strategy: ${error.message}`);
    }
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'Clone strategy for customization' })
  @ApiParam({ name: 'id', description: 'Strategy ID to clone' })
  @ApiResponse({ status: 201, description: 'Strategy cloned successfully' })
  @ApiResponse({ status: 404, description: 'Strategy not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to clone this strategy' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async cloneStrategy(
    @Param('id') id: string,
    @Req() req: { user: { id: string } }): Promise<BacktestStrategy> {
    try {
      return await this.strategyService.cloneStrategy(id, req.user.id);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to clone strategy: ${error.message}`);
    }
  }

  @Get('system/built-in')
  @ApiOperation({ summary: 'Get built-in system strategies' })
  @ApiResponse({ status: 200, description: 'System strategies retrieved successfully' })
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  async getSystemStrategies(): Promise<BacktestStrategy[]> {
    try {
      return await this.strategyService.getSystemStrategies();
    } catch (error) {
      throw new BadRequestException(`Failed to get system strategies: ${error.message}`);
    }
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Validate strategy configuration' })
  @ApiParam({ name: 'id', description: 'Strategy ID' })
  @ApiResponse({ status: 200, description: 'Strategy validation completed' })
  @ApiResponse({ status: 404, description: 'Strategy not found' })
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  async validateStrategy(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role?: string } }): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const strategy = await this.strategyService.getStrategy(id);

      // Check authorization
      if (!strategy.isPublic && strategy.userId !== req.user.id && req.user.role !== 'admin') {
        throw new NotFoundException(`Strategy not found: ${id}`);
      }

      const validation = this.strategyService.validateStrategy({
        parameters: strategy.parameters,
        rules: strategy.rules
      });

      // Add warnings for potentially problematic configurations
      const warnings: string[] = [];

      if (strategy.parameters.length === 0) {
        warnings.push('Strategy has no parameters - it will use fixed values');
      }

      if (strategy.rules.length === 0) {
        warnings.push('Strategy has no rules - it will not generate any signals');
      }

      const hasBuyRule = strategy.rules.some(rule => rule.type === 'BUY');
      const hasSellRule = strategy.rules.some(rule => rule.type === 'SELL');

      if (!hasBuyRule) {
        warnings.push('Strategy has no BUY rules - it will never enter positions');
      }

      if (!hasSellRule) {
        warnings.push('Strategy has no SELL rules - it will never exit positions');
      }

      return {
        ...validation,
        warnings
      };
    } catch (error) {
      throw new BadRequestException(`Failed to validate strategy: ${error.message}`);
    }
  }

  @Get(':id/backtests')
  @ApiOperation({ summary: 'Get backtest history for a strategy' })
  @ApiParam({ name: 'id', description: 'Strategy ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiQuery({ name: 'startTime', required: false, description: 'Filter by start time (ISO date)' })
  @ApiQuery({ name: 'endTime', required: false, description: 'Filter by end time (ISO date)' })
  @ApiResponse({ status: 200, description: 'Backtest history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Strategy not found' })
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getStrategyBacktests(
    @Param('id') id: string,
    @Query() query: BacktestQueryDto,
    @Req() req: { user: { id: string; role?: string } }): Promise<{
    results: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // Check if user can access this strategy
      const strategy = await this.strategyService.getStrategy(id);
      if (!strategy.isPublic && strategy.userId !== req.user.id && req.user.role !== 'admin') {
        throw new NotFoundException(`Strategy not found: ${id}`);
      }

      const { startTime, endTime, page = 1, limit = 20 } = query;

      return await this.backtestingService.getBacktestHistory(
        id,
        undefined,
        req.user.role === 'admin' ? undefined : req.user.id,
        startTime && endTime ? { startTime, endTime } : undefined,
        page,
        limit
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get strategy backtests: ${error.message}`);
    }
  }

  @Get('categories/list')
  @ApiOperation({ summary: 'Get available strategy categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  async getStrategyCategories(): Promise<{
    category: string;
    displayName: string;
    description: string;
  }[]> {
    try {
      return [
        {
          category: 'TREND_MOMENTUM',
          displayName: 'Trend Momentum',
          description: 'Strategies based on price/virality momentum and trend following'
        },
        {
          category: 'SENTIMENT_REVERSAL',
          displayName: 'Sentiment Reversal',
          description: 'Strategies that trade based on sentiment reversals and market psychology'
        },
        {
          category: 'VOLATILITY_BREAKOUT',
          displayName: 'Volatility Breakout',
          description: 'Strategies that capitalize on volatility breakouts and price movements'
        },
        {
          category: 'CUSTOM',
          displayName: 'Custom',
          description: 'User-defined custom strategies with unique logic'
        },
      ];
    } catch (error) {
      throw new BadRequestException(`Failed to get strategy categories: ${error.message}`);
    }
  }

  @Get('usage/stats')
  @ApiOperation({ summary: 'Get strategy usage statistics (admin only)' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getUsageStats(
    @Req() req: { user: { id: string; role?: string } }): Promise<{
    totalStrategies: number;
    publicStrategies: number;
    privateStrategies: number;
    systemStrategies: number;
    strategiesByCategory: Record<string, number>;
    mostUsedStrategies: Array<{
      strategyId: string;
      name: string;
      usageCount: number;
    }>;
  }> {
    try {
      if (req.user.role !== 'admin') {
        throw new ForbiddenException('Admin access required');
      }

      // This would typically query database for actual statistics
      // For now, return mock data
      return {
        totalStrategies: 156,
        publicStrategies: 89,
        privateStrategies: 65,
        systemStrategies: 2,
        strategiesByCategory: {
          TREND_MOMENTUM: 68,
          SENTIMENT_REVERSAL: 45,
          VOLATILITY_BREAKOUT: 32,
          CUSTOM: 11
        },
        mostUsedStrategies: [
          { strategyId: 'trend_momentum', name: 'Trend Momentum Strategy', usageCount: 342 },
          { strategyId: 'sentiment_reversal', name: 'Sentiment Reversal Strategy', usageCount: 256 },
        ]
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get usage stats: ${error.message}`);
    }
  }
}
