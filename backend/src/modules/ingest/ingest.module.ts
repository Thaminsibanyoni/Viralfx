import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { IngestService } from "./services/ingest.service";
// import {
//   TwitterIngestProcessor,
//   TikTokIngestProcessor,
//   InstagramIngestProcessor,
//   YouTubeIngestProcessor,
//   FacebookIngestProcessor
// } from "./processors/ingest.processor"; // Temporarily disabled - files not found
import { IngestScheduler } from "./schedulers/ingest.scheduler";
import { IngestController } from "./controllers/ingest.controller";
import { TwitterConnector } from "./connectors/twitter.connector";
import { TikTokConnector } from "./connectors/tiktok.connector";
import { InstagramConnector } from "./connectors/instagram.connector";
import { YouTubeConnector } from "./connectors/youtube.connector";
import { FacebookConnector } from "./connectors/facebook.connector";
import { FreeTrendFetcherService } from "./services/free-trend-fetcher.service";

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    ScheduleModule.forRoot(), // Enable cron jobs
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0')
      }
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
    FreeTrendFetcherService, // NEW: Free trend fetcher
    // TwitterIngestProcessor, // Temporarily disabled - file not found
    // TikTokIngestProcessor, // Temporarily disabled - file not found
    // InstagramIngestProcessor, // Temporarily disabled - file not found
    // YouTubeIngestProcessor, // Temporarily disabled - file not found
    // FacebookIngestProcessor, // Temporarily disabled - file not found
    TwitterConnector,
    TikTokConnector,
    InstagramConnector,
    YouTubeConnector,
    FacebookConnector,
  ],
  exports: [
    IngestService,
    FreeTrendFetcherService, // NEW: Export for use in other modules
    TwitterConnector,
    TikTokConnector,
    InstagramConnector,
    YouTubeConnector,
    FacebookConnector,
  ]
})
export class IngestModule {}
