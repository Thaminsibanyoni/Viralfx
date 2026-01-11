import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { RedisModule } from '../redis/redis.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { ViralModule } from '../viral/viral.module';
import { TopicsModule } from '../topics/topics.module';
import { DeceptionModule } from '../deception/deception.module';
import { OracleModule } from '../oracle/oracle.module';

import { VPMXController } from "./vpmx.controller";
import { VPMXService } from "./vpmx.service";
// import { VPMXComputationService } from "./vpmx-computation.service";
import { VPMXIndexService } from "./vpmx-index.service";
import { VPMXCoreService } from "./services/vpmx-core.service";
import { VPMXPredictionService } from "./services/vpmx-prediction.service";
import { VPMXRiskService } from "./services/vpmx-risk.service";
import { VPMXAnalyticsService } from "./services/vpmx-analytics.service";
import { VPMXEnrichmentService } from "./services/vpmx-enrichment.service";
import { VPMXMLService } from "./services/vpmx-ml.service";

import { VPMXComputeProcessor } from "./queues/vpmx-compute.processor";
import { VPMXPredictionProcessor } from "./queues/vpmx-prediction.processor";
import { VPMXBreakoutProcessor } from "./queues/vpmx-breakout.processor";

import { VPMXScheduler } from "./vpmx.scheduler";

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '60s' }
    }),
    RedisModule,
    WebSocketModule,
    SentimentModule,
    ViralModule,
    TopicsModule,
    DeceptionModule,
    OracleModule,
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
    // Root Level Services
    VPMXService,
    // VPMXComputationService,  // TEMP_DISABLED
    VPMXIndexService,

    // Core Services
    VPMXCoreService,
    VPMXPredictionService,
    VPMXRiskService,
    VPMXAnalyticsService,
    VPMXEnrichmentService,
    VPMXMLService,

    // Background Processors
    // VPMXComputeProcessor,  // TEMP_DISABLED
    // VPMXPredictionProcessor,  // TEMP_DISABLED
    // VPMXBreakoutProcessor,  // TEMP_DISABLED

    // Scheduler
    VPMXScheduler,
  ],
  exports: [
    // Root Level Services
    VPMXService,
    // VPMXComputationService,  // TEMP_DISABLED
    VPMXIndexService,

    // Core Services
    VPMXCoreService,
    VPMXPredictionService,
    VPMXRiskService,
    VPMXAnalyticsService,
    VPMXEnrichmentService,
    VPMXMLService,
  ]
})
export class VPMXModule {}
