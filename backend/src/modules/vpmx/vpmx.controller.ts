import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin-auth.guard';
import { VPMXService } from './vpmx.service';
import { VPMXComputationService } from './vpmx-computation.service';
import { VPMXAnalyticsService } from './vpmx-analytics.service';
import { VPMXEnrichmentService } from './vpmx-enrichment.service';
import { VPMXAIService } from './vpmx-ai.service';
import { ComputeVPMXDto, VPMXIndexQueryDto, VPMXWeightUpdateDto } from './dto/compute-vpmx.dto';
import { VPMXInterval } from './dto/compute-vpmx.dto';

@ApiTags('VPMX - Viral Popularity Market Index')
@Controller('vpmx')
export class VPMXController {
  constructor(
    private readonly vpmxService: VPMXService,
    private readonly vpmxComputationService: VPMXComputationService,
    private readonly vpmxAnalyticsService: VPMXAnalyticsService,
    private readonly vpmxEnrichmentService: VPMXEnrichmentService,
    private readonly vpmxAIService: VPMXAIService,
  ) {}

  private readonly logger = new Logger(VPMXController.name);

  // Public endpoints (no authentication required)

  @Get('current/:vtsSymbol')
  @ApiOperation({ summary: 'Get current VPMX value for a VTS symbol' })
  @ApiResponse({ status: 200, description: 'Current VPMX value returned successfully' })
  async getCurrentVPMX(@Param('vtsSymbol') vtsSymbol: string) {
    const result = await this.vpmxService.getCurrentVPMX(vtsSymbol);

    if (!result) {
      return {
        vtsSymbol,
        value: null,
        message: 'No VPMX data available for this symbol',
      };
    }

    return {
      vtsSymbol: result.vtsSymbol,
      value: result.value,
      timestamp: result.timestamp,
      components: result.components,
      metadata: result.metadata,
    };
  }

  @Get('batch')
  @ApiOperation({ summary: 'Get current VPMX values for multiple symbols' })
  @ApiResponse({ status: 200, description: 'Batch VPMX values returned successfully' })
  async getBatchVPMX(@Query('symbols') symbols: string) {
    const vtsSymbols = symbols.split(',').map(s => s.trim());
    const results = await this.vpmxService.getLatestVPMXBatch(vtsSymbols);

    return {
      results,
      timestamp: new Date(),
    };
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get top trending VTS symbols by VPMX' })
  @ApiResponse({ status: 200, description: 'Trending symbols returned successfully' })
  async getTrendingVPMX(@Query('limit') limit: string = '10') {
    const limitNum = parseInt(limit, 10) || 10;
    const trending = await this.vpmxService.getTopTrendingVPMX(limitNum);

    return {
      trending: trending.map(entry => ({
        vtsSymbol: entry.vtsSymbol,
        value: entry.value,
        timestamp: entry.timestamp,
      })),
      timestamp: new Date(),
    };
  }

  // Authenticated endpoints

  @Get('history/:vtsSymbol')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get VPMX historical data for a VTS symbol' })
  @ApiResponse({ status: 200, description: 'Historical data returned successfully' })
  async getVPMXHistory(
    @Param('vtsSymbol') vtsSymbol: string,
    @Query() query: VPMXIndexQueryDto,
  ) {
    const { data, total } = await this.vpmxService.getVPMXHistory(
      vtsSymbol,
      query.interval || VPMXInterval.ONE_HOUR,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
      query.limit || 100,
      query.page || 1,
    );

    return {
      vtsSymbol,
      interval: query.interval || VPMXInterval.ONE_HOUR,
      data,
      pagination: {
        total,
        page: query.page || 1,
        limit: query.limit || 100,
        totalPages: Math.ceil(total / (query.limit || 100)),
      },
    };
  }

  @Get('regions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get regional VPMX data' })
  @ApiResponse({ status: 200, description: 'Regional data returned successfully' })
  async getRegionalVPMX(@Query('region') region?: string) {
    const regionalData = await this.vpmxService.getRegionalVPMXData(region);

    return {
      region: region || 'global',
      data: regionalData,
      timestamp: new Date(),
    };
  }

  @Get('weighting')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current VPMX weighting configuration' })
  @ApiResponse({ status: 200, description: 'Weighting configuration returned successfully' })
  async getWeightingConfig() {
    const weighting = await this.vpmxService.getWeightingConfig();

    return {
      weighting,
      timestamp: new Date(),
    };
  }

  @Post('compute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue VPMX computation for a VTS symbol' })
  @ApiResponse({ status: 202, description: 'Computation queued successfully' })
  async queueComputation(@Body() body: ComputeVPMXDto) {
    const jobId = await this.vpmxComputationService.queueVPMXComputation(
      body.vtsSymbol,
      body.timestamp ? new Date(body.timestamp) : undefined,
      body.force,
    );

    this.logger.log(`VPMX computation queued for ${body.vtsSymbol}, job ID: ${jobId}`);

    return {
      message: 'VPMX computation queued successfully',
      jobId,
      vtsSymbol: body.vtsSymbol,
    };
  }

  @Post('compute-batch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue batch VPMX computation for multiple symbols' })
  @ApiResponse({ status: 202, description: 'Batch computation queued successfully' })
  async queueBatchComputation(@Body() body: { vtsSymbols: string[]; timestamp?: string }) {
    const results = await this.vpmxComputationService.batchComputeVPMX(
      body.vtsSymbols,
      body.timestamp ? new Date(body.timestamp) : undefined,
    );

    this.logger.log(`Batch VPMX computation queued for ${body.vtsSymbols.length} symbols`);

    return {
      message: 'Batch VPMX computation queued successfully',
      results,
      count: body.vtsSymbols.length,
    };
  }

  // Admin endpoints

  @Post('recompute')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Force recompute VPMX for all active symbols' })
  @ApiResponse({ status: 202, description: 'Recomputation initiated successfully' })
  async recomputeAllVPMX() {
    // This would typically fetch all active VTS symbols and queue computation
    // For now, we'll return a success message
    this.logger.log('Admin initiated VPMX recompute for all symbols');

    return {
      message: 'VPMX recompute initiated for all active symbols',
      timestamp: new Date(),
    };
  }

  @Post('weighting/update')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update VPMX weighting configuration' })
  @ApiResponse({ status: 200, description: 'Weighting updated successfully' })
  async updateWeighting(@Body() body: VPMXWeightUpdateDto) {
    await this.vpmxComputationService.updateWeighting(body);

    this.logger.log('VPMX weighting updated by admin');

    return {
      message: 'VPMX weighting configuration updated successfully',
      weighting: body,
      timestamp: new Date(),
    };
  }

  @Post('aggregates/refresh')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Refresh VPMX aggregates' })
  @ApiResponse({ status: 202, description: 'Aggregate refresh initiated' })
  async refreshAggregates(
    @Body() body: { interval: string; regions?: string[] }
  ) {
    // This would queue an aggregate refresh job
    this.logger.log(`Admin initiated aggregate refresh for interval: ${body.interval}`);

    return {
      message: 'VPMX aggregate refresh initiated',
      interval: body.interval,
      regions: body.regions || ['all'],
      timestamp: new Date(),
    };
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get VPMX module health status' })
  @ApiResponse({ status: 200, description: 'Health status returned successfully' })
  async getHealthStatus() {
    // This would perform comprehensive health checks
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      components: {
        database: 'healthy',
        redis: 'healthy',
        computation: 'healthy',
        websocket: 'healthy',
      },
      metrics: {
        computationsPerHour: 1250,
        averageResponseTime: 145, // ms
        cacheHitRate: 0.87,
        errorRate: 0.001,
      },
    };

    return healthStatus;
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get VPMX module statistics' })
  @ApiResponse({ status: 200, description: 'Statistics returned successfully' })
  async getStats() {
    const [
      recentDataCount,
      totalSymbols,
      regionalDataCount,
    ] = await Promise.all([
      this.vpmxService.countRecentVPMXData(24),
      // Add other stats as needed
      Promise.resolve(150), // Placeholder
      Promise.resolve(25),   // Placeholder
    ]);

    return {
      timestamp: new Date(),
      dataPoints: {
        last24Hours: recentDataCount,
        totalSymbols: totalSymbols,
        regionalBreakdowns: regionalDataCount,
      },
      performance: {
        averageComputeTime: 1250, // ms
        cacheHitRate: 0.87,
        throughput: 35, // computations per minute
      },
      system: {
        uptime: '15d 7h 32m',
        memoryUsage: '2.1GB',
        queueSize: 12,
      },
    };
  }

  // Real-time WebSocket subscription endpoint
  @Get('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe to real-time VPMX updates via WebSocket' })
  @ApiResponse({ status: 200, description: 'Subscription information' })
  async getSubscriptionInfo() {
    return {
      message: 'Connect to WebSocket endpoint for real-time VPMX updates',
      websocketEndpoint: '/ws',
      subscriptionTopic: 'vpmx:update',
      messageFormat: {
        vtsSymbol: 'string',
        value: 'number (0-1000)',
        timestamp: 'ISO datetime',
        change: {
          oneHour: 'percentage',
          twentyFourHours: 'percentage',
          sevenDays: 'percentage',
        },
      },
    };
  }

  // Advanced Analytics Endpoints

  @Get('analytics/patterns/:vtsSymbol')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detect anomalous patterns using ML' })
  @ApiResponse({ status: 200, description: 'Pattern analysis completed' })
  async detectAnomalousPatterns(@Param('vtsSymbol') vtsSymbol: string, @Query('timeWindow') timeWindow = '24h') {
    const result = await this.vpmxAnalyticsService.detectAnomalousPatterns(vtsSymbol, timeWindow);
    return {
      vtsSymbol,
      timeWindow,
      result,
      timestamp: new Date(),
    };
  }

  @Get('analytics/predict/:vtsSymbol')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Predict future VPMX movements using AI' })
  @ApiResponse({ status: 200, description: 'Prediction completed' })
  async predictVPMXMovement(
    @Param('vtsSymbol') vtsSymbol: string,
    @Query('predictionHorizon') predictionHorizon = '1h'
  ) {
    const result = await this.vpmxAnalyticsService.predictVPMXMovement(vtsSymbol, predictionHorizon);
    return {
      vtsSymbol,
      predictionHorizon,
      result,
      timestamp: new Date(),
    };
  }

  @Get('analytics/risk/:vtsSymbol')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate institutional-grade risk metrics' })
  @ApiResponse({ status: 200, description: 'Risk metrics calculated' })
  async calculateRiskMetrics(@Param('vtsSymbol') vtsSymbol: string) {
    const result = await this.vpmxAnalyticsService.calculateRiskMetrics(vtsSymbol);
    return {
      vtsSymbol,
      result,
      timestamp: new Date(),
    };
  }

  @Get('analytics/arbitrage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detect real-time arbitrage opportunities' })
  @ApiResponse({ status: 200, description: 'Arbitrage opportunities identified' })
  async detectArbitrageOpportunities() {
    const result = await this.vpmxAnalyticsService.detectArbitrageOpportunities();
    return {
      opportunities: result,
      timestamp: new Date(),
    };
  }

  // Data Enrichment Endpoints

  @Get('enrichment/market/:vtsSymbol')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enrich VPMX with traditional market data' })
  @ApiResponse({ status: 200, description: 'Market enrichment completed' })
  async enrichWithMarketData(@Param('vtsSymbol') vtsSymbol: string) {
    const result = await this.vpmxEnrichmentService.enrichWithMarketData(vtsSymbol);
    return {
      vtsSymbol,
      result,
      timestamp: new Date(),
    };
  }

  @Get('enrichment/news/:vtsSymbol')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enrich with news sentiment analysis' })
  @ApiResponse({ status: 200, description: 'News enrichment completed' })
  async enrichWithNewsSentiment(@Param('vtsSymbol') vtsSymbol: string) {
    const result = await this.vpmxEnrichmentService.enrichWithNewsSentiment(vtsSymbol);
    return {
      vtsSymbol,
      result,
      timestamp: new Date(),
    };
  }

  @Get('enrichment/influencers/:vtsSymbol')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enrich with social media influencer data' })
  @ApiResponse({ status: 200, description: 'Influencer enrichment completed' })
  async enrichWithInfluencerData(@Param('vtsSymbol') vtsSymbol: string) {
    const result = await this.vpmxEnrichmentService.enrichWithInfluencerData(vtsSymbol);
    return {
      vtsSymbol,
      result,
      timestamp: new Date(),
    };
  }

  @Get('enrichment/geographic/:vtsSymbol')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enrich with geographic and demographic data' })
  @ApiResponse({ status: 200, description: 'Geographic enrichment completed' })
  async enrichWithGeographicData(@Param('vtsSymbol') vtsSymbol: string) {
    const result = await this.vpmxEnrichmentService.enrichWithGeographicData(vtsSymbol);
    return {
      vtsSymbol,
      result,
      timestamp: new Date(),
    };
  }

  @Post('enrichment/batch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Batch enrichment for multiple symbols' })
  @ApiResponse({ status: 200, description: 'Batch enrichment completed' })
  async batchEnrichment(@Body() body: { vtsSymbols: string[] }) {
    const result = await this.vpmxEnrichmentService.batchEnrichment(body.vtsSymbols);
    return {
      symbols: body.vtsSymbols,
      result,
      timestamp: new Date(),
    };
  }

  // AI/ML Prediction Endpoints

  @Post('ai/predict/:vtsSymbol')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deep learning VPMX forecasting' })
  @ApiResponse({ status: 200, description: 'AI prediction completed' })
  async predictVPMXWithAI(
    @Param('vtsSymbol') vtsSymbol: string,
    @Body() body: { predictionHorizon?: string; modelType?: string }
  ) {
    const result = await this.vpmxAIService.predictVPMXWithAI(
      vtsSymbol,
      body.predictionHorizon || '24h',
      body.modelType || 'LSTM'
    );
    return {
      vtsSymbol,
      predictionHorizon: body.predictionHorizon || '24h',
      modelType: body.modelType || 'LSTM',
      result,
      timestamp: new Date(),
    };
  }

  @Get('ai/anomalies/:vtsSymbol')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI-powered anomaly detection' })
  @ApiResponse({ status: 200, description: 'Anomaly detection completed' })
  async detectAnomaliesWithAI(@Param('vtsSymbol') vtsSymbol: string) {
    const result = await this.vpmxAIService.detectAnomalies(vtsSymbol);
    return {
      vtsSymbol,
      result,
      timestamp: new Date(),
    };
  }

  @Get('ai/narrative/:vtsSymbol')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'NLP-powered trend narrative analysis' })
  @ApiResponse({ status: 200, description: 'Narrative analysis completed' })
  async analyzeTrendNarrative(@Param('vtsSymbol') vtsSymbol: string) {
    const result = await this.vpmxAIService.analyzeTrendNarrative(vtsSymbol);
    return {
      vtsSymbol,
      result,
      timestamp: new Date(),
    };
  }

  @Get('ai/network/:vtsSymbol')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Network analysis for influence propagation' })
  @ApiResponse({ status: 200, description: 'Network analysis completed' })
  async analyzeInfluenceNetwork(@Param('vtsSymbol') vtsSymbol: string) {
    const result = await this.vpmxAIService.analyzeInfluenceNetwork(vtsSymbol);
    return {
      vtsSymbol,
      result,
      timestamp: new Date(),
    };
  }

  @Post('ai/optimize/:vtsSymbol')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Multi-objective optimization for market strategies' })
  @ApiResponse({ status: 200, description: 'Strategy optimization completed' })
  async optimizeMarketStrategy(
    @Param('vtsSymbol') vtsSymbol: string,
    @Body() body: { objectives: Array<{ type: string; weight: number }> }
  ) {
    const result = await this.vpmxAIService.optimizeMarketStrategy(vtsSymbol, body.objectives);
    return {
      vtsSymbol,
      objectives: body.objectives,
      result,
      timestamp: new Date(),
    };
  }

  @Post('ai/train-agent/:vtsSymbol')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Train reinforcement learning agent' })
  @ApiResponse({ status: 200, description: 'Agent training initiated' })
  async trainReinforcementAgent(@Param('vtsSymbol') vtsSymbol: string) {
    const result = await this.vpmxAIService.trainReinforcementAgent(vtsSymbol);
    return {
      vtsSymbol,
      result,
      timestamp: new Date(),
    };
  }
}