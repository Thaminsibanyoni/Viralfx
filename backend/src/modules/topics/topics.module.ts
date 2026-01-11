import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TopicsService } from "./services/topics.service";
import { TopicMergingService } from "./services/topic-merging.service";
import { TrendingService } from "./services/trending.service";
import { TopicsController } from "./controllers/topics.controller";
// import { TopicProcessingProcessor } from "./processors/topic-processing.processor"; // Temporarily disabled - files not found
import { TrendMLModule } from '../trend-ml/trend-ml.module';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
   // TrendMLModule, // Temporarily disabled - Processor file not found
   // CacheModule, // Temporarily disabled - Processor file not found
   // RedisModule, // Temporarily disabled - Processor file not found
    BullModule.registerQueue({
      name: 'topic-processing'
    }),
  ],
  controllers: [TopicsController],
  providers: [
    TopicsService,
    TopicMergingService,
    TrendingService,
   // TopicProcessingProcessor, // Temporarily disabled - Processor file not found
  ],
  exports: [
    TopicsService,
    TopicMergingService,
    TrendingService,
  ]
})
export class TopicsModule {}
