import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { IngestService } from './services/ingest.service';
import {
  TwitterIngestProcessor,
  TikTokIngestProcessor,
  InstagramIngestProcessor,
  YouTubeIngestProcessor,
  FacebookIngestProcessor
} from './processors/ingest.processor';
import { IngestScheduler } from './schedulers/ingest.scheduler';
import { IngestController } from './controllers/ingest.controller';
import { TwitterConnector } from './connectors/twitter.connector';
import { TikTokConnector } from './connectors/tiktok.connector';
import { InstagramConnector } from './connectors/instagram.connector';
import { YouTubeConnector } from './connectors/youtube.connector';
import { FacebookConnector } from './connectors/facebook.connector';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HttpModule,
    RedisModule.forRootAsync({
      useFactory: () => ({
        config: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
        },
      }),
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
      },
    }),
    BullModule.registerQueue(
      { name: 'ingest:twitter' },
      { name: 'ingest:tiktok' },
      { name: 'ingest:instagram' },
      { name: 'ingest:youtube' },
      { name: 'ingest:facebook' }
    ),
  ],
  controllers: [IngestController],
  providers: [
    IngestService,
    IngestScheduler,
    TwitterIngestProcessor,
    TikTokIngestProcessor,
    InstagramIngestProcessor,
    YouTubeIngestProcessor,
    FacebookIngestProcessor,
    TwitterConnector,
    TikTokConnector,
    InstagramConnector,
    YouTubeConnector,
    FacebookConnector,
  ],
  exports: [
    IngestService,
    TwitterConnector,
    TikTokConnector,
    InstagramConnector,
    YouTubeConnector,
    FacebookConnector,
  ],
})
export class IngestModule {}