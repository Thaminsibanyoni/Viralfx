import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";

import { TrendAnalyzerService } from '../services/trend-analyzer.service';
import { ViralityPredictionService } from '../services/virality-prediction.service';
import { SentimentAnalysisService } from '../services/sentiment-analysis.service';
import { RiskAssessmentService } from '../services/risk-assessment.service';
import { SocialMediaService } from '../services/social-media.service';

// DTOs
import { AnalyzeTrendDto } from '../dto/analyze-trend.dto';
import { BatchAnalyzeDto } from '../dto/batch-analyze.dto';
import { GetRecommendationsDto } from '../dto/get-recommendations.dto';

@ApiTags('Trend ML')
@Controller('trend-ml')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrendMLController {
  constructor(
    private readonly trendAnalyzerService: TrendAnalyzerService,
    private readonly viralityPredictionService: ViralityPredictionService,
    private readonly sentimentAnalysisService: SentimentAnalysisService,
    private readonly riskAssessmentService: RiskAssessmentService,
    private readonly socialMediaService: SocialMediaService) {}

  @Post('analyze')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyze a trend using ML models' })
  @ApiResponse({ status: 200, description: 'Trend analysis completed' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Trend not found' })
  async analyzeTrend(@Body() analyzeDto: AnalyzeTrendDto) {
    try {
      const analysis = await this.trendAnalyzerService.analyzeTrend(
        analyzeDto.trendId,
        analyzeDto.forceRefresh
      );

      return {
        success: true,
        data: analysis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Post('batch-analyze')
  @Roles('ADMIN', 'PREMIUM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch analyze multiple trends' })
  @ApiResponse({ status: 200, description: 'Batch analysis completed' })
  async batchAnalyze(@Body() batchDto: BatchAnalyzeDto) {
    try {
      const results = await this.trendAnalyzerService.batchAnalyzeTrends(batchDto.trendIds);

      return {
        success: true,
        data: Object.fromEntries(results),
        analyzed: results.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/predict-virality')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @ApiOperation({ summary: 'Predict virality for a trend' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiResponse({ status: 200, description: 'Virality prediction completed' })
  async predictVirality(@Param('trendId') trendId: string) {
    try {
      const trend = await this.getTrendById(trendId);
      if (!trend) {
        return {
          success: false,
          error: 'Trend not found'
        };
      }

      const socialMetrics = await this.socialMediaService.getSocialMetrics(
        trend.symbol,
        'all',
        trend.hashtags,
        trend.keywords
      );

      const prediction = await this.viralityPredictionService.predictVirality(
        trend,
        socialMetrics || [],
        {}
      );

      return {
        success: true,
        data: prediction,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/sentiment')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @ApiOperation({ summary: 'Get sentiment analysis for a trend' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiResponse({ status: 200, description: 'Sentiment analysis completed' })
  async getSentimentAnalysis(@Param('trendId') trendId: string) {
    try {
      const trend = await this.getTrendById(trendId);
      if (!trend) {
        return {
          success: false,
          error: 'Trend not found'
        };
      }

      const analysis = await this.sentimentAnalysisService.analyzeSentiment(trend);

      return {
        success: true,
        data: analysis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/sentiment/trends')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @ApiOperation({ summary: 'Get sentiment trends over time' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiQuery({ name: 'timeWindow', description: 'Time window in seconds', required: false })
  @ApiResponse({ status: 200, description: 'Sentiment trends retrieved' })
  async getSentimentTrends(
    @Param('trendId') trendId: string,
    @Query('timeWindow') timeWindow?: number
  ) {
    try {
      const trends = await this.sentimentAnalysisService.getSentimentTrends(
        trendId,
        timeWindow || 86400 // Default 24 hours
      );

      return {
        success: true,
        data: trends,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/risk-assessment')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @ApiOperation({ summary: 'Get risk assessment for a trend' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiResponse({ status: 200, description: 'Risk assessment completed' })
  async getRiskAssessment(@Param('trendId') trendId: string) {
    try {
      const trend = await this.getTrendById(trendId);
      if (!trend) {
        return {
          success: false,
          error: 'Trend not found'
        };
      }

      const socialMetrics = await this.socialMediaService.getSocialMetrics(
        trend.symbol,
        'all',
        trend.hashtags,
        trend.keywords
      );

      const marketData = await this.getMarketData(trendId);
      const sentimentAnalysis = await this.sentimentAnalysisService.analyzeSentiment(trend);

      const assessment = await this.riskAssessmentService.assessRisk(
        trend,
        socialMetrics || [],
        marketData || {},
        sentimentAnalysis
      );

      return {
        success: true,
        data: assessment,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/recommendations')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @ApiOperation({ summary: 'Get trading recommendations for a trend' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiResponse({ status: 200, description: 'Recommendations generated' })
  async getRecommendations(
    @Param('trendId') trendId: string,
    @Query() query: GetRecommendationsDto
  ) {
    try {
      const analysis = await this.trendAnalyzerService.analyzeTrend(trendId);
      const trend = await this.getTrendById(trendId);

      if (!trend) {
        return {
          success: false,
          error: 'Trend not found'
        };
      }

      const recommendations = await this.trendAnalyzerService.getTrendRecommendations(trendId);

      return {
        success: true,
        data: {
          analysis,
          recommendations,
          trend
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/social-metrics')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @ApiOperation({ summary: 'Get social media metrics for a trend' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiQuery({ name: 'platform', description: 'Social media platform', required: false })
  @ApiResponse({ status: 200, description: 'Social metrics retrieved' })
  async getSocialMetrics(
    @Param('trendId') trendId: string,
    @Query('platform') platform?: string
  ) {
    try {
      const trend = await this.getTrendById(trendId);
      if (!trend) {
        return {
          success: false,
          error: 'Trend not found'
        };
      }

      const metrics = await this.socialMediaService.getSocialMetrics(
        trend.symbol,
        platform || 'all',
        trend.hashtags,
        trend.keywords
      );

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/virality-updates')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @ApiOperation({ summary: 'Get real-time virality updates' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiQuery({ name: 'timeWindow', description: 'Time window in seconds', required: false })
  @ApiResponse({ status: 200, description: 'Virality updates retrieved' })
  async getViralityUpdates(
    @Param('trendId') trendId: string,
    @Query('timeWindow') timeWindow?: number
  ) {
    try {
      const updates = await this.viralityPredictionService.getViralityUpdates(
        trendId,
        timeWindow || 3600 // Default 1 hour
      );

      return {
        success: true,
        data: updates,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/competitor-analysis')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @ApiOperation({ summary: 'Get competitor analysis for a trend' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiResponse({ status: 200, description: 'Competitor analysis completed' })
  async getCompetitorAnalysis(@Param('trendId') trendId: string) {
    try {
      const analysis = await this.trendAnalyzerService.getCompetitorAnalysis(trendId);

      return {
        success: true,
        data: analysis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/health-monitoring')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Get trend health monitoring data' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiResponse({ status: 200, description: 'Health monitoring data retrieved' })
  async getHealthMonitoring(@Param('trendId') trendId: string) {
    try {
      const healthCheck = await this.trendAnalyzerService.monitorTrendHealth(trendId);

      return {
        success: true,
        data: healthCheck,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('portfolio-risk')
  @Roles('USER', 'ADMIN', 'PREMIUM')
  @ApiOperation({ summary: 'Get portfolio risk assessment' })
  @ApiQuery({ name: 'trendIds', description: 'Comma-separated trend IDs', required: true })
  @ApiResponse({ status: 200, description: 'Portfolio risk assessment completed' })
  async getPortfolioRisk(@Query('trendIds') trendIds: string) {
    try {
      const trendIdArray = trendIds.split(',').map(id => id.trim());
      const portfolioRisk = await this.riskAssessmentService.assessPortfolioRisk(trendIdArray);

      return {
        success: true,
        data: portfolioRisk,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('realtime-monitoring/:trendId')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Get real-time risk monitoring' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiResponse({ status: 200, description: 'Real-time monitoring data retrieved' })
  async getRealtimeMonitoring(@Param('trendId') trendId: string) {
    try {
      const monitoring = await this.riskAssessmentService.getRealtimeRiskMonitoring(trendId);

      return {
        success: true,
        data: monitoring,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/influencer-impact')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @ApiOperation({ summary: 'Analyze influencer impact for a trend' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiResponse({ status: 200, description: 'Influencer impact analysis completed' })
  async getInfluencerImpact(@Param('trendId') trendId: string) {
    try {
      const trend = await this.getTrendById(trendId);
      if (!trend) {
        return {
          success: false,
          error: 'Trend not found'
        };
      }

      const impact = await this.socialMediaService.analyzeInfluencerImpact(
        trend.symbol,
        trend.hashtags
      );

      return {
        success: true,
        data: impact,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':trendId/trending-topics')
  @Roles('USER', 'ADMIN', 'MODERATOR', 'PREMIUM')
  @ApiOperation({ summary: 'Get trending topics related to a trend' })
  @ApiParam({ name: 'trendId', description: 'Trend ID' })
  @ApiQuery({ name: 'timeframe', description: 'Timeframe (24h, 7d, 30d)', required: false })
  @ApiResponse({ status: 200, description: 'Trending topics retrieved' })
  async getTrendingTopics(
    @Param('trendId') trendId: string,
    @Query('timeframe') timeframe?: string
  ) {
    try {
      const trend = await this.getTrendById(trendId);
      if (!trend) {
        return {
          success: false,
          error: 'Trend not found'
        };
      }

      const topics = await this.socialMediaService.getTrendingTopics(
        trend.symbol,
        timeframe || '24h'
      );

      return {
        success: true,
        data: topics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Private helper methods
  private async getTrendById(trendId: string): Promise<any> {
    // This would typically use the TrendService
    // For now, return a mock trend object
    return {
      id: trendId,
      symbol: `VIRAL/SA_TREND_${trendId.slice(-6)}`,
      name: `Trend ${trendId}`,
      hashtags: ['trending', 'viral', 'social'],
      keywords: ['social', 'media', 'trend'],
      createdAt: new Date().toISOString(),
      contentRiskScore: Math.random() * 100,
      content: 'Sample content for trend analysis'
    };
  }

  private async getMarketData(trendId: string): Promise<any> {
    // This would typically use the MarketDataService
    return {
      currentPrice: Math.random() * 100,
      volume24h: Math.random() * 1000000,
      priceChange24h: (Math.random() - 0.5) * 20,
      marketCap: Math.random() * 10000000,
      bidPrice: Math.random() * 100,
      askPrice: Math.random() * 100,
      midPrice: Math.random() * 100,
      liquidity: Math.random() * 100
    };
  }
}
