import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth
} from '@nestjs/swagger';

import { MarketAggregationService } from '../services/market-aggregation.service';
import { MarketDataService } from '../services/market-data.service';
import { PricingEngineService } from '../services/pricing-engine.service';
import { SymbolNormalizerService } from '../services/symbol-normalizer.service';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { GetMarketDto, PriceInterval } from '../dto/get-market.dto';
import { GetTrendingMarketsDto, SortBy, Timeframe } from '../dto/get-trending-markets.dto';
import { MarketDataResponseDto, TrendingMarketDto } from '../dto/market-response.dto';

@ApiTags('Market Data')
@Controller()
export class MarketController {
  constructor(
    private readonly marketAggregationService: MarketAggregationService,
    private readonly marketDataService: MarketDataService,
    private readonly pricingEngineService: PricingEngineService,
    private readonly symbolNormalizerService: SymbolNormalizerService) {}

  @Get('market/:symbol')
  @ApiOperation({ summary: 'Get market data for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading symbol (e.g., VIRAL/SA_DJ_ZINHLE_001)' })
  @ApiResponse({ status: 200, description: 'Market data retrieved', type: MarketDataResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid symbol format' })
  @ApiResponse({ status: 404, description: 'Symbol not found' })
  async getMarket(
    @Param('symbol') symbol: string,
    @Query() query: GetMarketDto): Promise<any> {
    try {
      // Validate symbol format using SymbolNormalizerService
      const isValidSymbol = await this.symbolNormalizerService.validateSymbol(symbol);
      if (!isValidSymbol) {
        throw new BadRequestException('Invalid symbol format');
      }

      // Get symbol with latest data
      const symbolData = await this.marketAggregationService.getSymbolWithLatestData(symbol);

      // Build response
      const response: MarketDataResponseDto = {
        symbol: symbolData.symbol,
        name: symbolData.name,
        category: symbolData.category,
        region: symbolData.region,
        currentPrice: symbolData.currentPrice || symbolData.latestPrice?.price || 0,
        priceChange24h: symbolData.priceChange24h || 0,
        priceChangePercent24h: symbolData.priceChangePercent24h || 0,
        volume24h: symbolData.volume24h || 0,
        high24h: symbolData.high24h || 0,
        low24h: symbolData.low24h || 0,
        viralityScore: symbolData.lastViralityScore || 0,
        velocity: symbolData.lastVelocity || 0,
        sentiment: symbolData.lastSentiment || 0,
        totalTrades: symbolData.totalTrades || 0,
        marketCap: symbolData.market_cap || 0,
        lastUpdated: symbolData.updatedAt.toISOString()
      };

      // Include order book if requested
      if (query.includeOrderBook && symbolData.topicId) {
        const orderBook = await this.marketDataService.getOrderBook(symbolData.topicId);
        if (orderBook) {
          response.orderBook = {
            bids: orderBook.bids || [],
            asks: orderBook.asks || [],
            spread: orderBook.spread || 0,
            bestBid: orderBook.bestBid || 0,
            bestAsk: orderBook.bestAsk || 0,
            midPrice: orderBook.midPrice || 0
          };
        }
      }

      // Include price history if requested
      if (query.includeHistory) {
        const priceHistory = await this.marketDataService.getPriceHistory(
          symbol,
          query.historyInterval,
          query.historyLimit);
        response.priceHistory = priceHistory.map(price => ({
          timestamp: price.timestamp.toISOString(),
          open: price.open || price.price,
          high: price.high || price.price,
          low: price.low || price.price,
          close: price.close || price.price,
          volume: price.volume,
          viralityScore: price.viralityScore
        }));
      }

      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Rethrow as appropriate HTTP exception
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      } else if (error.message.includes('Invalid') || error.message.includes('required')) {
        throw new BadRequestException(error.message);
      } else {
        throw error; // Let global exception filter handle it
      }
    }
  }

  @Get('markets/trending')
  @ApiOperation({ summary: 'Get trending markets' })
  @ApiResponse({ status: 200, description: 'Trending markets retrieved', type: [TrendingMarketDto] })
  async getTrendingMarkets(@Query() query: GetTrendingMarketsDto): Promise<any> {
    try {
      const trendingSymbols = await this.marketAggregationService.getTrendingSymbols(
        query.limit,
        query.sortBy,
        query.timeframe);

      const trendingMarkets = await Promise.all(
        trendingSymbols.map(async (symbol, index) => {
          const marketData = await this.marketDataService.getMarketData(symbol.topicId);
          return {
            ...marketData,
            rank: index + 1,
            trendScore: this.calculateTrendScore(symbol)
          };
        }));

      // Apply filters
      let filtered = trendingMarkets;
      if (query.category) {
        filtered = filtered.filter(market => market.category === query.category);
      }
      if (query.region) {
        filtered = filtered.filter(market => market.region === query.region);
      }
      if (query.minViralityScore) {
        filtered = filtered.filter(market => market.viralityScore >= query.minViralityScore);
      }

      return {
        success: true,
        data: filtered,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve trending markets');
    }
  }

  @Get('markets/category/:category')
  @ApiOperation({ summary: 'Get markets by category' })
  @ApiParam({ name: 'category', description: 'Category (CELEB, SPORTS, etc.)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMarketsByCategory(
    @Param('category') category: string,
    @Query('limit') limit?: number): Promise<any> {
    try {
      const symbols = await this.marketAggregationService.getSymbolsByCategory(category);
      const limitedSymbols = limit ? symbols.slice(0, limit) : symbols;

      const markets = await Promise.all(
        limitedSymbols.map(async symbol => {
          return await this.marketDataService.getMarketData(symbol.topicId);
        }));

      return {
        success: true,
        data: markets.filter(Boolean),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve markets by category');
    }
  }

  @Get('markets/region/:region')
  @ApiOperation({ summary: 'Get markets by region' })
  @ApiParam({ name: 'region', description: 'Region code (SA, GP, WC, etc.)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMarketsByRegion(
    @Param('region') region: string,
    @Query('limit') limit?: number): Promise<any> {
    try {
      const symbols = await this.marketAggregationService.getSymbolsByRegion(region);
      const limitedSymbols = limit ? symbols.slice(0, limit) : symbols;

      const markets = await Promise.all(
        limitedSymbols.map(async symbol => {
          return await this.marketDataService.getMarketData(symbol.topicId);
        }));

      return {
        success: true,
        data: markets.filter(Boolean),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve markets by region');
    }
  }

  @Get('market/:symbol/history')
  @ApiOperation({ summary: 'Get price history for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading symbol' })
  @ApiQuery({ name: 'interval', enum: ['1m', '5m', '15m', '1h', '4h', '1d'] })
  @ApiQuery({ name: 'limit', type: Number })
  async getPriceHistory(
    @Param('symbol') symbol: string,
    @Query('interval') interval: string = '1h',
    @Query('limit') limit: number = 100): Promise<any> {
    try {
      // Validate symbol format using SymbolNormalizerService
      const isValidSymbol = await this.symbolNormalizerService.validateSymbol(symbol);
      if (!isValidSymbol) {
        throw new BadRequestException('Invalid symbol format');
      }

      const priceHistory = await this.marketDataService.getPriceHistory(symbol, interval, limit);

      return {
        success: true,
        data: priceHistory.map(price => ({
          timestamp: price.timestamp.toISOString(),
          open: price.open || price.price,
          high: price.high || price.price,
          low: price.low || price.price,
          close: price.close || price.price,
          volume: price.volume,
          viralityScore: price.viralityScore
        })),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve price history');
    }
  }

  @Get('market/:symbol/stats')
  @ApiOperation({ summary: 'Get market statistics for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading symbol' })
  async getMarketStats(@Param('symbol') symbol: string): Promise<any> {
    try {
      // Validate symbol format using SymbolNormalizerService
      const isValidSymbol = await this.symbolNormalizerService.validateSymbol(symbol);
      if (!isValidSymbol) {
        throw new BadRequestException('Invalid symbol format');
      }

      const stats = await this.pricingEngineService.getMarketStats(symbol);

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve market statistics');
    }
  }

  @Get('markets/summary')
  @ApiOperation({ summary: 'Get overall market summary' })
  async getMarketSummary(): Promise<any> {
    try {
      const summary = await this.marketDataService.getMarketSummary();

      return {
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve market summary');
    }
  }

  private calculateTrendScore(symbol: any): number {
    let score = 0;

    // Volume component (40% weight)
    if (symbol.volume24h > 100000) score += 40;
    else if (symbol.volume24h > 50000) score += 30;
    else if (symbol.volume24h > 10000) score += 20;
    else if (symbol.volume24h > 1000) score += 10;

    // Price change component (30% weight)
    const priceChange = Math.abs(symbol.priceChangePercent24h || 0);
    if (priceChange > 20) score += 30;
    else if (priceChange > 10) score += 25;
    else if (priceChange > 5) score += 20;
    else if (priceChange > 2) score += 15;
    else if (priceChange > 1) score += 10;

    // Virality component (30% weight)
    const virality = symbol.lastViralityScore || 0;
    if (virality > 80) score += 30;
    else if (virality > 60) score += 25;
    else if (virality > 40) score += 20;
    else if (virality > 20) score += 15;
    else if (virality > 10) score += 10;

    return Math.round(score);
  }
}
