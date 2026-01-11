import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { TrendAnalyzerService } from "./services/trend-analyzer.service";
import { ViralityPredictionService } from "./services/virality-prediction.service";
import { SentimentAnalysisService } from "./services/sentiment-analysis.service";
import { RiskAssessmentService } from "./services/risk-assessment.service";
import { SocialMediaService } from "./services/social-media.service";
import { TrendMLController } from "./controllers/trend-ml.controller";
import { TrendMLScheduler } from "./schedulers/trend-ml.scheduler";

// Note: TypeORM entities removed - using Prisma models directly
// The Trend and User entities are now managed via Prisma

// Import other modules
import { MarketAggregationModule } from '../market-aggregation/market-aggregation.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    MarketAggregationModule,
  ],
  controllers: [
    TrendMLController,
  ],
  providers: [
    TrendAnalyzerService,
    ViralityPredictionService,
    SentimentAnalysisService,
    RiskAssessmentService,
    SocialMediaService,
    TrendMLScheduler,
  ],
  exports: [
    TrendAnalyzerService,
    ViralityPredictionService,
    SentimentAnalysisService,
    RiskAssessmentService,
    SocialMediaService,
  ]
})
export class TrendMLModule {}
