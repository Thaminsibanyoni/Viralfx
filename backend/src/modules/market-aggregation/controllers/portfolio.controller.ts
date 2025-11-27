import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { Portfolio } from '../entities/portfolio.entity';
import { MarketDataService } from '../services/market-data.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PortfolioResponseDto } from '../dto/portfolio-response.dto';

// Custom decorator to get current user (simplified for this example)
const CurrentUser = () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const req = args.find(arg => arg && arg.user);
    return originalMethod.apply(this, [req?.user, ...args]);
  };
};

@ApiTags('Portfolio')
@Controller('portfolio')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortfolioController {
  constructor(
    private readonly marketDataService: MarketDataService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user portfolio' })
  @ApiResponse({ status: 200, description: 'Portfolio retrieved', type: PortfolioResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPortfolio(@CurrentUser() user: any): Promise<any> {
    try {
      if (!user || !user.id) {
        throw new BadRequestException('Invalid user information');
      }

      // In a real implementation, you would query the database
      // For now, we'll return a mock response

      const positions = [
        {
          symbol: 'VIRAL/SA_DJ_ZINHLE_001',
          name: 'DJ Zinhle',
          quantity: 1000,
          averagePrice: 100.00,
          currentPrice: 105.50,
          totalCost: 100000,
          currentValue: 105500,
          unrealizedPnL: 5500,
          unrealizedPnLPercent: 5.50,
          realizedPnL: 1200,
          totalPnL: 6700,
          allocation: 21.10,
          firstPurchaseAt: '2024-01-01T10:00:00Z',
          lastTradeAt: '2024-01-15T14:30:00Z',
        },
        {
          symbol: 'VIRAL/SA_TREVOR_NOAH_001',
          name: 'Trevor Noah',
          quantity: 500,
          averagePrice: 180.00,
          currentPrice: 195.25,
          totalCost: 90000,
          currentValue: 97625,
          unrealizedPnL: 7625,
          unrealizedPnLPercent: 8.47,
          realizedPnL: 350,
          totalPnL: 7975,
          allocation: 19.53,
          firstPurchaseAt: '2024-01-02T09:15:00Z',
          lastTradeAt: '2024-01-14T11:20:00Z',
        },
        {
          symbol: 'VIRAL/SA_CASSPER_NYOVEST_001',
          name: 'Cassper Nyovest',
          quantity: 2000,
          averagePrice: 50.00,
          currentPrice: 48.75,
          totalCost: 100000,
          currentValue: 97500,
          unrealizedPnL: -2500,
          unrealizedPnLPercent: -2.50,
          realizedPnL: 800,
          totalPnL: -1700,
          allocation: 19.50,
          firstPurchaseAt: '2024-01-03T13:45:00Z',
          lastTradeAt: '2024-01-13T16:10:00Z',
        },
      ];

      const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
      const totalCost = positions.reduce((sum, pos) => sum + pos.totalCost, 0);
      const totalPnL = totalValue - totalCost;
      const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

      // Generate portfolio summary
      const profitablePositions = positions.filter(pos => pos.totalPnL > 0).length;
      const losingPositions = positions.filter(pos => pos.totalPnL < 0).length;
      const winRate = positions.length > 0 ? (profitablePositions / positions.length) * 100 : 0;

      const bestPerformer = positions.reduce((best, current) =>
        current.totalPnL > (best?.totalPnL || -Infinity) ? current : best, null);

      const worstPerformer = positions.reduce((worst, current) =>
        current.totalPnL < (worst?.totalPnL || Infinity) ? current : worst, null);

      const largestPosition = positions.reduce((largest, current) =>
        current.currentValue > (largest?.currentValue || -Infinity) ? current : largest, null);

      const summary = {
        totalPositions: positions.length,
        profitablePositions,
        losingPositions,
        winRate: Math.round(winRate * 100) / 100,
        bestPerformer,
        worstPerformer,
        largestPosition,
        diversificationScore: this.calculateDiversificationScore(positions),
      };

      return {
        success: true,
        data: {
          userId: user.id,
          totalValue,
          totalCost,
          totalPnL,
          totalPnLPercent: Math.round(totalPnLPercent * 100) / 100,
          positions,
          summary,
          lastUpdated: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve portfolio');
    }
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Get position details for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading symbol' })
  @ApiResponse({ status: 200, description: 'Position details retrieved' })
  @ApiResponse({ status: 404, description: 'Position not found' })
  async getPosition(
    @Param('symbol') symbol: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    try {
      if (!symbol || symbol.trim() === '') {
        throw new BadRequestException('Symbol is required');
      }

      if (!user || !user.id) {
        throw new BadRequestException('Invalid user information');
      }

      // In a real implementation, you would query the database
      // For now, we'll return a mock response

      const position = {
        symbol,
        name: 'DJ Zinhle',
        quantity: 1000,
        averagePrice: 100.00,
        currentPrice: 105.50,
        totalCost: 100000,
        currentValue: 105500,
        unrealizedPnL: 5500,
        unrealizedPnLPercent: 5.50,
        realizedPnL: 1200,
        totalPnL: 6700,
        firstPurchaseAt: '2024-01-01T10:00:00Z',
        lastTradeAt: '2024-01-15T14:30:00Z',
      };

      // Check if position exists (mock)
      if (position.quantity === 0) {
        throw new NotFoundException('Position not found');
      }

      return {
        success: true,
        data: position,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve position details');
    }
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get portfolio summary' })
  @ApiResponse({ status: 200, description: 'Portfolio summary retrieved' })
  async getPortfolioSummary(@CurrentUser() user: any): Promise<any> {
    try {
      if (!user || !user.id) {
        throw new BadRequestException('Invalid user information');
      }

      // Get full portfolio and extract summary
      const portfolioResponse = await this.getPortfolio(user);

      return {
        success: true,
        data: portfolioResponse.data.summary,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve portfolio summary');
    }
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get portfolio performance over time' })
  @ApiQuery({ name: 'timeframe', enum: ['1d', '7d', '30d', '90d', '1y'], required: false })
  @ApiResponse({ status: 200, description: 'Performance data retrieved' })
  async getPortfolioPerformance(
    @CurrentUser() user: any,
    @Query('timeframe') timeframe: string = '30d',
  ): Promise<any> {
    try {
      if (!user || !user.id) {
        throw new BadRequestException('Invalid user information');
      }

      const validTimeframes = ['1d', '7d', '30d', '90d', '1y'];
      if (!validTimeframes.includes(timeframe)) {
        throw new BadRequestException('Invalid timeframe. Must be one of: 1d, 7d, 30d, 90d, 1y');
      }

      // In a real implementation, you would query historical portfolio values
      // For now, we'll return a mock performance chart

      const now = new Date();
      const days = this.getTimeframeDays(timeframe);
      const performanceData = [];

      let portfolioValue = 450000; // Starting value

      for (let i = days; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const randomChange = (Math.random() - 0.5) * 0.02; // ±1% daily change
        portfolioValue *= (1 + randomChange);

        performanceData.push({
          date: date.toISOString().split('T')[0],
          value: Math.round(portfolioValue),
          change: i === 0 ? portfolioValue - 450000 : performanceData[performanceData.length - 1]?.change || 0,
          changePercent: i === 0 ? ((portfolioValue - 450000) / 450000) * 100 : 0,
        });
      }

      const currentValue = performanceData[performanceData.length - 1].value;
      const initialValue = 450000;
      const totalReturn = currentValue - initialValue;
      const totalReturnPercent = (totalReturn / initialValue) * 100;

      // Calculate volatility (standard deviation of daily returns)
      const dailyReturns = performanceData.slice(1).map((point, index) =>
        ((point.value - performanceData[index].value) / performanceData[index].value) * 100
      );
      const volatility = this.calculateStandardDeviation(dailyReturns);

      return {
        success: true,
        data: {
          timeframe,
          currentValue,
          initialValue,
          totalReturn,
          totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
          volatility: Math.round(volatility * 100) / 100,
          sharpeRatio: totalReturnPercent / (volatility || 1),
          performanceChart: performanceData,
          maxDrawdown: this.calculateMaxDrawdown(performanceData),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve portfolio performance');
    }
  }

  @Get('allocation')
  @ApiOperation({ summary: 'Get portfolio allocation breakdown' })
  @ApiResponse({ status: 200, description: 'Allocation breakdown retrieved' })
  async getPortfolioAllocation(@CurrentUser() user: any): Promise<any> {
    try {
      if (!user || !user.id) {
        throw new BadRequestException('Invalid user information');
      }

      // Get portfolio to extract allocation data
      const portfolioResponse = await this.getPortfolio(user);

      const positions = portfolioResponse.data.positions;
      const totalValue = portfolioResponse.data.totalValue;

      // Allocation by symbol
      const bySymbol = positions.map(pos => ({
        symbol: pos.symbol,
        name: pos.name,
        value: pos.currentValue,
        allocation: pos.allocation,
      }));

      // Allocation by category
      const byCategory = {};
      positions.forEach(pos => {
        // In a real implementation, you would get category from symbol data
        const category = pos.name.includes('DJ') || pos.name.includes('Trevor') ? 'CELEB' : 'SPORTS';
        byCategory[category] = (byCategory[category] || 0) + pos.currentValue;
      });

      const categoryAllocation = Object.entries(byCategory).map(([category, value]) => ({
        category,
        value,
        allocation: Math.round((value / totalValue) * 10000) / 100,
      }));

      // Allocation by region
      const byRegion = {};
      positions.forEach(pos => {
        // In a real implementation, you would get region from symbol data
        const region = 'SA'; // Default to South Africa for this mock
        byRegion[region] = (byRegion[region] || 0) + pos.currentValue;
      });

      const regionAllocation = Object.entries(byRegion).map(([region, value]) => ({
        region,
        value,
        allocation: Math.round((value / totalValue) * 10000) / 100,
      }));

      return {
        success: true,
        data: {
          bySymbol,
          byCategory: categoryAllocation,
          byRegion: regionAllocation,
          diversificationScore: this.calculateDiversificationScore(positions),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve portfolio allocation');
    }
  }

  private calculateDiversificationScore(positions: any[]): number {
    if (positions.length === 0) return 0;
    if (positions.length === 1) return 0;

    // Calculate Herfindahl-Hirschman Index (HHI)
    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const hhi = positions.reduce((sum, pos) => {
      const weight = pos.currentValue / totalValue;
      return sum + (weight * weight);
    }, 0);

    // Convert HHI to diversification score (0-100)
    // Lower HHI = better diversification
    const maxHHI = 1; // Maximum possible HHI
    const diversificationScore = Math.round(((maxHHI - hhi) / maxHHI) * 100);

    return Math.max(0, Math.min(100, diversificationScore));
  }

  private getTimeframeDays(timeframe: string): number {
    const timeframes = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };
    return timeframes[timeframe] || 30;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

    return Math.sqrt(avgSquaredDiff);
  }

  private calculateMaxDrawdown(performanceData: any[]): number {
    if (performanceData.length < 2) return 0;

    let maxDrawdown = 0;
    let peak = performanceData[0].value;

    for (let i = 1; i < performanceData.length; i++) {
      const currentValue = performanceData[i].value;

      if (currentValue > peak) {
        peak = currentValue;
      } else {
        const drawdown = ((peak - currentValue) / peak) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }

    return Math.round(maxDrawdown * 100) / 100;
  }
}