import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { TrendAnalyzerService } from '../services/trend-analyzer.service';
import { SentimentAnalysisService } from '../services/sentiment-analysis.service';
import { RiskAssessmentService } from '../services/risk-assessment.service';
import { ViralityPredictionService } from '../services/virality-prediction.service';
import { SocialMediaService } from '../services/social-media.service';

@Injectable()
export class TrendMLScheduler {
  private readonly logger = new Logger(TrendMLScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trendAnalyzerService: TrendAnalyzerService,
    private readonly sentimentAnalysisService: SentimentAnalysisService,
    private readonly riskAssessmentService: RiskAssessmentService,
    private readonly viralityPredictionService: ViralityPredictionService,
    private readonly socialMediaService: SocialMediaService
    ) {}

  /**
   * Analyze all active trends every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async analyzeActiveTrends(): Promise<void> {
    try {
      this.logger.debug('Starting scheduled trend analysis...');

      // Get active trends from Prisma
      const activeTrends = await this.prisma.topic.findMany({
        where: {
          status: 'ACTIVE',
          totalVolume: {
            gt: 0
          }
        },
        take: 100,
        orderBy: {
          totalVolume: 'desc'
        }
      });

      if (activeTrends.length === 0) {
        this.logger.debug('No active trends to analyze');
        return;
      }

      // Batch analyze trends
      const trendIds = activeTrends.map(trend => trend.id);
      await this.trendAnalyzerService.batchAnalyzeTrends(trendIds);

      this.logger.log(`Analyzed ${trendIds.length} active trends`);

    } catch (error) {
      this.logger.error('Error in scheduled trend analysis:', error);
    }
  }

  /**
   * Update social media metrics every 2 minutes
   */
  @Cron('*/2 * * * *') // Every 2 minutes
  async updateSocialMetrics(): Promise<void> {
    try {
      this.logger.debug('Updating social media metrics...');

      // Get active trends from Prisma
      const activeTrends = await this.prisma.topic.findMany({
        where: {
          status: 'ACTIVE',
          totalVolume: {
            gt: 0
          }
        },
        take: 50,
        orderBy: {
          totalVolume: 'desc'
        }
      });

      const batchSize = 10;

      // Process trends in batches to avoid rate limiting
      for (let i = 0; i < activeTrends.length; i += batchSize) {
        const batch = activeTrends.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (trend) => {
            try {
              await this.socialMediaService.getSocialMetrics(
                trend.symbol || trend.slug,
                'all',
                trend.canonical?.hashtags || [],
                trend.canonical?.keywords || []
              );
            } catch (error) {
              this.logger.error(`Error updating social metrics for trend ${trend.id}:`, error);
            }
          })
        );

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.logger.debug(`Updated social metrics for ${activeTrends.length} trends`);

    } catch (error) {
      this.logger.error('Error updating social metrics:', error);
    }
  }

  /**
   * Perform comprehensive sentiment analysis every 15 minutes
   */
  @Cron('*/15 * * * *') // Every 15 minutes
  async updateSentimentAnalysis(): Promise<void> {
    try {
      this.logger.debug('Updating sentiment analysis...');

      // Trend service not available
      const activeTrends: any[] = [];

      for (const trend of activeTrends) {
        try {
          await this.sentimentAnalysisService.analyzeSentiment(trend);
        } catch (error) {
          this.logger.error(`Error updating sentiment for trend ${trend.id}:`, error);
        }
      }

      this.logger.debug(`Updated sentiment analysis for ${activeTrends.length} trends`);

    } catch (error) {
      this.logger.error('Error updating sentiment analysis:', error);
    }
  }

  /**
   * Update risk assessment every 10 minutes
   */
  @Cron('*/10 * * * *') // Every 10 minutes
  async updateRiskAssessment(): Promise<void> {
    try {
      this.logger.debug('Updating risk assessment...');

      // Trend service not available
      const activeTrends: any[] = [];
      const highRiskTrends = activeTrends.filter(trend =>
        trend.contentRiskScore > 70 || trend.volatilityScore > 80
      );

      // Prioritize high-risk trends
      for (const trend of highRiskTrends) {
        try {
          await this.riskAssessmentService.assessRisk(trend, [], {}, {});
        } catch (error) {
          this.logger.error(`Error updating risk assessment for trend ${trend.id}:`, error);
        }
      }

      this.logger.debug(`Updated risk assessment for ${highRiskTrends.length} high-risk trends`);

    } catch (error) {
      this.logger.error('Error updating risk assessment:', error);
    }
  }

  /**
   * Detect sentiment anomalies every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async detectSentimentAnomalies(): Promise<void> {
    try {
      this.logger.debug('Detecting sentiment anomalies...');

      // Trend service not available
      const activeTrends: any[] = [];

      for (const trend of activeTrends) {
        try {
          const anomalies = await this.sentimentAnalysisService.detectSentimentAnomalies(trend.id);

          if (anomalies.length > 0) {
            this.logger.warn(`Sentiment anomalies detected for trend ${trend.id}:`, anomalies);
            // This would trigger alerts or notifications
          }
        } catch (error) {
          this.logger.error(`Error detecting sentiment anomalies for trend ${trend.id}:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Error detecting sentiment anomalies:', error);
    }
  }

  /**
   * Update virality predictions every 30 minutes
   */
  @Cron('*/30 * * * *') // Every 30 minutes
  async updateViralityPredictions(): Promise<void> {
    try {
      this.logger.debug('Updating virality predictions...');

      // Trend service not available
      const activeTrends: any[] = [];
      const promisingTrends = activeTrends.filter(trend =>
        trend.viralityScore > 50 || trend.engagementRate > 40
      );

      const predictions = await this.viralityPredictionService.batchPredictVirality(promisingTrends);

      this.logger.debug(`Updated virality predictions for ${predictions.size} promising trends`);

    } catch (error) {
      this.logger.error('Error updating virality predictions:', error);
    }
  }

  /**
   * Clean up old ML data daily at 2 AM
   */
  @Cron('0 2 * * *') // At 2:00 AM every day
  async cleanupOldData(): Promise<void> {
    try {
      this.logger.log('Starting ML data cleanup...');

      // This would clean up old cached data, expired predictions, etc.
      // Implementation would depend on your caching strategy

      this.logger.log('ML data cleanup completed');

    } catch (error) {
      this.logger.error('Error during ML data cleanup:', error);
    }
  }

  /**
   * Generate ML insights report weekly on Monday at 9 AM
   */
  @Cron('0 9 * * 1') // At 9:00 AM on Monday
  async generateWeeklyInsights(): Promise<void> {
    try {
      this.logger.log('Generating weekly ML insights report...');

      const report = await this.generateInsightsReport();

      // This would send the report to admins or store it for analysis
      this.logger.log('Weekly insights report generated:', {
        totalTrends: report.totalTrends,
        avgViralityScore: report.avgViralityScore,
        highRiskTrends: report.highRiskTrends,
        topPerformers: report.topPerformers.length
      });

    } catch (error) {
      this.logger.error('Error generating weekly insights:', error);
    }
  }

  /**
   * Retrain ML models monthly on the 1st at 3 AM
   */
  @Cron('0 3 1 * *') // At 3:00 AM on the 1st of every month
  async retrainModels(): Promise<void> {
    try {
      this.logger.log('Starting monthly ML model retraining...');

      // Retrain virality prediction model
      await this.viralityPredictionService.trainModel();

      this.logger.log('ML model retraining completed');

    } catch (error) {
      this.logger.error('Error during ML model retraining:', error);
    }
  }

  /**
   * Monitor trend health every 20 minutes
   */
  @Cron('*/20 * * * *') // Every 20 minutes
  async monitorTrendHealth(): Promise<void> {
    try {
      this.logger.debug('Monitoring trend health...');

      // Trend service not available
      const activeTrends: any[] = [];

      for (const trend of activeTrends) {
        try {
          const health = await this.trendAnalyzerService.monitorTrendHealth(trend.id);

          if (health.healthScore < 30) {
            this.logger.warn(`Poor health detected for trend ${trend.id}:`, health.alerts);
            // This would trigger alerts or automated actions
          }
        } catch (error) {
          this.logger.error(`Error monitoring health for trend ${trend.id}:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Error monitoring trend health:', error);
    }
  }

  /**
   * Update trending topics every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateTrendingTopics(): Promise<void> {
    try {
      this.logger.debug('Updating trending topics...');

      // Trend service not available
      const activeTrends: any[] = [];

      for (const trend of activeTrends.slice(0, 20)) { // Limit to top 20 trends
        try {
          await this.socialMediaService.getTrendingTopics(trend.symbol, '24h');
        } catch (error) {
          this.logger.error(`Error updating trending topics for trend ${trend.id}:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Error updating trending topics:', error);
    }
  }

  /**
   * Perform portfolio risk assessment every 30 minutes
   */
  @Cron('*/30 * * * *') // Every 30 minutes
  async assessPortfolioRisk(): Promise<void> {
    try {
      this.logger.debug('Assessing portfolio risk...');

      // This would get all active user portfolios and assess their risk
      // Implementation would depend on your portfolio management system

    } catch (error) {
      this.logger.error('Error assessing portfolio risk:', error);
    }
  }

  // Private helper methods

  private async generateInsightsReport(): Promise<any> {
    try {
      // Trend service not available
      const activeTrends: any[] = [];

      // Calculate various metrics
      const totalTrends = activeTrends.length;
      const avgViralityScore = activeTrends.reduce((sum, trend) => sum + trend.viralityScore, 0) / totalTrends;
      const avgEngagementRate = activeTrends.reduce((sum, trend) => sum + trend.engagementRate, 0) / totalTrends;

      const highRiskTrends = activeTrends.filter(trend =>
        trend.contentRiskScore > 70 || trend.volatilityScore > 80
      ).length;

      const topPerformers = activeTrends
        .sort((a, b) => b.viralityScore - a.viralityScore)
        .slice(0, 10);

      return {
        totalTrends,
        avgViralityScore,
        avgEngagementRate,
        highRiskTrends,
        topPerformers: topPerformers.map(trend => ({
          id: trend.id,
          name: trend.name,
          symbol: trend.symbol,
          viralityScore: trend.viralityScore,
          engagementRate: trend.engagementRate
        })),
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error generating insights report:', error);
      return null;
    }
  }
}
