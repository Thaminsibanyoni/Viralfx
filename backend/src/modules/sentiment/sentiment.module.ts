import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { SentimentService } from './services/sentiment.service';
import { SentimentAggregationService } from './services/sentiment-aggregation.service';
import { SentimentController } from './controllers/sentiment.controller';
import { SentimentAnalysisProcessor } from './processors/sentiment-analysis.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { TrendMLModule } from '../trend-ml/trend-ml.module';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    TrendMLModule,
    HttpModule,
    CacheModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'sentiment-analysis',
    }),
  ],
  controllers: [SentimentController],
  providers: [
    SentimentService,
    SentimentAggregationService,
    SentimentAnalysisProcessor,
  ],
  exports: [
    SentimentService,
    SentimentAggregationService,
  ],
})
export class SentimentModule {}