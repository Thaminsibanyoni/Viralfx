import { 
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Request,
  BadRequestException,
  NotFoundException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { BacktestingService } from '../services/backtesting.service';
import { BacktestConfigDto } from '../dto/backtest-config.dto';
import { BacktestQueryDto, CompareStrategiesDto, OptimizeStrategyDto } from '../dto/index';
import { BacktestResult, OptimizationResult } from '../interfaces/backtesting.interface';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags('Analytics - Backtesting')
@Controller('analytics/backtest')
@UseGuards(JwtAuthGuard)
export class BacktestingController {
  constructor(private readonly backtestingService: BacktestingService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Run a new backtest' })
  @ApiResponse({ status: 202, description: 'Backtest queued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid backtest configuration' })
  @ApiResponse({ status: 404, description: 'Strategy not found' })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async runBacktest(
    @Body(ValidationPipe) config: BacktestConfigDto,
    @Req() req: { user: { id: string } }): Promise<{
    jobId: string;
    backtestId: string;
    message: string;
  }> {
    try {
      config.validateDateRange();
      const userId = req.user.id;
      const result = await this.backtestingService.queueBacktest(config, userId);

      return {
        jobId: result.jobId,
        backtestId: result.backtestId,
        message: 'Backtest queued successfully. Use the job ID to check status.'
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to queue backtest: ${error.message}`);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get backtest result by ID' })
  @ApiParam({ name: 'id', description: 'Backtest ID' })
  @ApiResponse({ status: 200, description: 'Backtest result retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Backtest not found' })
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  async getBacktest(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role?: string } }): Promise<BacktestResult> {
    try {
      // Get backtest history and find the specific result
      const history = await this.backtestingService.getBacktestHistory();
      const result = history.results.find(r => r.id === id);

      if (!result) {
        throw new NotFoundException(`Backtest not found: ${id}`);
      }

      // Check authorization - users can only see their own backtests unless admin
      if (req.user.role !== 'admin' && result.userId !== req.user.id) {
        throw new NotFoundException(`Backtest not found: ${id}`);
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get backtest: ${error.message}`);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get backtest history with pagination and filters' })
  @ApiQuery({ name: 'strategyId', required: false, description: 'Filter by strategy ID' })
  @ApiQuery({ name: 'symbol', required: false, description: 'Filter by symbol' })
  @ApiQuery({ name: 'startTime', required: false, description: 'Filter by start time (ISO date)' })
  @ApiQuery({ name: 'endTime', required: false, description: 'Filter by end time (ISO date)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiResponse({ status: 200, description: 'Backtest history retrieved successfully' })
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getBacktestHistory(
    @Query() query: BacktestQueryDto,
    @Req() req: { user: { id: string; role?: string } }): Promise<{
    results: BacktestResult[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // Non-admin users can only see their own backtests
      const userId = req.user.role === 'admin' ? undefined : req.user.id;

      const { strategyId, symbol, startTime, endTime, page = 1, limit = 20 } = query;

      return await this.backtestingService.getBacktestHistory(
        strategyId,
        symbol,
        userId,
        startTime && endTime ? { startTime, endTime } : undefined,
        page,
        limit
      );
    } catch (error) {
      throw new BadRequestException(`Failed to get backtest history: ${error.message}`);
    }
  }

  @Post('compare')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Compare multiple strategies' })
  @ApiResponse({ status: 202, description: 'Strategy comparison queued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid comparison configuration' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async compareStrategies(
    @Body(ValidationPipe) compareDto: CompareStrategiesDto,
    @Req() req: { user: { id: string } }): Promise<{
    jobId: string;
    message: string;
  }> {
    try {
      const userId = req.user.id;
      const result = await this.backtestingService.compareStrategies(
        compareDto.strategyIds,
        compareDto.symbol,
        {
          start: compareDto.startTime,
          end: compareDto.endTime
        },
        userId
      );

      return {
        jobId: result.jobId,
        message: 'Strategy comparison queued successfully. Use the job ID to check status.'
      };
    } catch (error) {
      throw new BadRequestException(`Failed to compare strategies: ${error.message}`);
    }
  }

  @Post('optimize')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Optimize strategy parameters' })
  @ApiResponse({ status: 202, description: 'Strategy optimization queued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid optimization configuration' })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute (resource intensive)
  async optimizeStrategy(
    @Body(ValidationPipe) optimizeDto: OptimizeStrategyDto,
    @Req() req: { user: { id: string } }): Promise<{
    jobId: string;
    message: string;
  }> {
    try {
      const userId = req.user.id;
      const result = await this.backtestingService.optimizeStrategy(
        optimizeDto.strategyId,
        optimizeDto.symbol,
        {
          start: optimizeDto.startTime,
          end: optimizeDto.endTime
        },
        optimizeDto.parameterRanges,
        optimizeDto.optimizationMetric,
        optimizeDto.maxIterations,
        userId
      );

      return {
        jobId: result.jobId,
        message: 'Strategy optimization queued successfully. Use the job ID to check status.'
      };
    } catch (error) {
      throw new BadRequestException(`Failed to optimize strategy: ${error.message}`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a backtest result' })
  @ApiParam({ name: 'id', description: 'Backtest ID to delete' })
  @ApiResponse({ status: 204, description: 'Backtest deleted successfully' })
  @ApiResponse({ status: 404, description: 'Backtest not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete this backtest' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async deleteBacktest(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role?: string } }): Promise<void> {
    try {
      // For now, this would need to be implemented in the BacktestingService
      // The service would need a deleteBacktest method
      throw new BadRequestException('Delete backtest functionality not yet implemented');
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete backtest: ${error.message}`);
    }
  }

  @Get('job/:jobId/status')
  @ApiOperation({ summary: 'Get status of a backtest job' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async getJobStatus(
    @Param('jobId') jobId: string,
    @Req() req: { user: { id: string; role?: string } }): Promise<{
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: BacktestResult;
    error?: string;
  }> {
    try {
      // This would need to be implemented to check Bull queue job status
      // For now, return a mock response
      return {
        jobId,
        status: 'pending',
        progress: 0
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get job status: ${error.message}`);
    }
  }
}
