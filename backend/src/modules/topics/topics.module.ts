import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TopicsService } from './services/topics.service';
import { TopicMergingService } from './services/topic-merging.service';
import { TrendingService } from './services/trending.service';
import { TopicsController } from './controllers/topics.controller';
import { TopicProcessingProcessor } from './processors/topic-processing.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { TrendMLModule } from '../trend-ml/trend-ml.module';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    TrendMLModule,
    CacheModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'topic-processing',
    }),
  ],
  controllers: [TopicsController],
  providers: [
    TopicsService,
    TopicMergingService,
    TrendingService,
    TopicProcessingProcessor,
  ],
  exports: [
    TopicsService,
    TopicMergingService,
    TrendingService,
  ],
})
export class TopicsModule {}