import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule } from '@nestjs/config';

import { TrendAnalyzerService } from './services/trend-analyzer.service';
import { ViralityPredictionService } from './services/virality-prediction.service';
import { SentimentAnalysisService } from './services/sentiment-analysis.service';
import { RiskAssessmentService } from './services/risk-assessment.service';
import { SocialMediaService } from './services/social-media.service';
import { TrendMLController } from './controllers/trend-ml.controller';
import { TrendMLScheduler } from './schedulers/trend-ml.scheduler';

// Import entities
import { Trend } from '../database/entities/trend.entity';
import { User } from '../database/entities/user.entity';

// Import other modules
import { MarketAggregationModule } from '../market-aggregation/market-aggregation.module';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trend,
      User,
    ]),
    HttpModule,
    RedisModule.forRoot({
      config: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      },
    }),
    ConfigModule,
    MarketAggregationModule,
    ModerationModule,
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
  ],
})
export class TrendMLModule {}