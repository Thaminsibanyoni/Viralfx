import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { SentimentService } from "./services/sentiment.service";
import { SentimentAggregationService } from "./services/sentiment-aggregation.service";
import { SentimentController } from "./controllers/sentiment.controller";
// import { SentimentAnalysisProcessor } from "./processors/sentiment-analysis.processor"; // Temporarily disabled - files not found
import { TrendMLModule } from '../trend-ml/trend-ml.module';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
   // TrendMLModule, // Temporarily disabled - Processor file not found
    HttpModule,
   // CacheModule, // Temporarily disabled - Processor file not found
   // RedisModule, // Temporarily disabled - Processor file not found
    BullModule.registerQueue({
      name: 'sentiment-analysis'
    }),
  ],
  controllers: [SentimentController],
  providers: [
    SentimentService,
    SentimentAggregationService,
   // SentimentAnalysisProcessor, // Temporarily disabled - Processor file not found
  ],
  exports: [
    SentimentService,
    SentimentAggregationService,
  ]
})
export class SentimentModule {}
