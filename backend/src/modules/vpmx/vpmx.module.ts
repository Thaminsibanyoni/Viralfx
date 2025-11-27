import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { ViralModule } from '../viral/viral.module';
import { TopicsModule } from '../topics/topics.module';
import { DeceptionModule } from '../deception/deception.module';
import { OracleModule } from '../oracle/oracle.module';
import { RegionClassifierModule } from '../common/region-classifier.module';

import { VPMXController } from './vpmx.controller';
import { VPMXCoreService } from './services/vpmx-core.service';
import { VPMXPredictionService } from './services/vpmx-prediction.service';
import { VPMXRiskService } from './services/vpmx-risk.service';
import { VPMXAnalyticsService } from './services/vpmx-analytics.service';
import { VPMXEnrichmentService } from './services/vpmx-enrichment.service';
import { VPMXMLService } from './services/vpmx-ml.service';

import { VPMXComputeProcessor } from './queues/vpmx-compute.processor';
import { VPMXPredictionProcessor } from './queues/vpmx-prediction.processor';
import { VPMXBreakoutProcessor } from './queues/vpmx-breakout.processor';

import { VPMXScheduler } from './vpmx.scheduler';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    PrismaModule,
    RedisModule,
    WebSocketModule,
    SentimentModule,
    ViralModule,
    TopicsModule,
    DeceptionModule,
    OracleModule,
    RegionClassifierModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue(
      { name: 'vpmx-compute' },
      { name: 'vpmx-prediction' },
      { name: 'vpmx-breakout' },
      { name: 'vpmx-analytics' },
      { name: 'vpmx-enrichment' },
      { name: 'vpmx-ml-training' }
    ),
  ],
  controllers: [VPMXController],
  providers: [
    // Core Services
    VPMXCoreService,
    VPMXPredictionService,
    VPMXRiskService,
    VPMXAnalyticsService,
    VPMXEnrichmentService,
    VPMXMLService,

    // Background Processors
    VPMXComputeProcessor,
    VPMXPredictionProcessor,
    VPMXBreakoutProcessor,

    // Scheduler
    VPMXScheduler,
  ],
  exports: [
    VPMXCoreService,
    VPMXPredictionService,
    VPMXRiskService,
    VPMXAnalyticsService,
    VPMXEnrichmentService,
    VPMXMLService,
  ],
})
export class VPMXModule {}