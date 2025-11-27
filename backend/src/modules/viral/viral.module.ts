import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { ViralService } from './services/viral.service';
import { ViralIndexService } from './services/viral-index.service';
import { ViralMetricsService } from './services/viral-metrics.service';
import { ViralController } from './controllers/viral.controller';
import { ViralProcessor } from './processors/viral.processor';
import { ViralScheduler } from './schedulers/viral.scheduler';
import { PrismaModule } from '../../prisma/prisma.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { DeceptionModule } from '../deception/deception.module';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    CacheModule,
    RedisModule,
    SentimentModule,
    DeceptionModule,
    BullModule.registerQueue({
      name: 'viral-index-calculation',
    }),
    BullModule.registerQueue({
      name: 'viral-metrics-update',
    }),
    BullModule.registerQueue({
      name: 'viral-content-analysis',
    }),
  ],
  controllers: [ViralController],
  providers: [
    ViralService,
    ViralIndexService,
    ViralMetricsService,
    ViralProcessor,
    ViralScheduler,
  ],
  exports: [
    ViralService,
    ViralIndexService,
    ViralMetricsService,
  ],
})
export class ViralModule {}