import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

// Core modules - First 8 + MarketsModule, MarketAggregationModule
import { RedisModule } from "./modules/redis/redis.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { TopicsModule } from "./modules/topics/topics.module";
import { IngestModule } from "./modules/ingest/ingest.module";
import { SentimentModule } from "./modules/sentiment/sentiment.module";
import { DeceptionModule } from "./modules/deception/deception.module";
import { ViralModule } from "./modules/viral/viral.module";
import { MarketsModule } from "./modules/markets/markets.module";
import { MarketAggregationModule } from "./modules/market-aggregation/market-aggregation.module";

// Configuration
import appConfig from "./config/app.config";
import databaseConfig from "./config/database.config";
import redisConfig from "./config/redis.config";
import s3Config from "./config/s3.config";
import jwtConfig from "./config/jwt.config";

// Middleware
import { RequestLoggingMiddleware } from "./common/middleware/request-logging.middleware";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, s3Config, jwtConfig],
      envFilePath: ['.env.local', '.env'],
      expandVariables: true
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL', 60000),
          limit: config.get('THROTTLE_LIMIT', 100)
        },
      ],
      inject: [ConfigService]
    }),

    ScheduleModule.forRoot(),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: parseInt(config.get('REDIS_PORT', '6379')),
          password: config.get('REDIS_PASSWORD'),
          db: parseInt(config.get('REDIS_DB', '0')),
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: false
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      }),
      inject: [ConfigService]
    }),

    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => [
        {
          rootPath: join(__dirname, '..', 'uploads'),
          serveRoot: '/uploads',
          exclude: ['/api/*']
        },
      ],
      inject: [ConfigService]
    }),

    // Core modules - First 10
    ConfigModule,
    RedisModule,
    AuthModule,
    UsersModule,
    TopicsModule,
    IngestModule,
    SentimentModule,
    DeceptionModule,
    ViralModule,
    MarketsModule,
    MarketAggregationModule,
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*');

    consumer
      .apply(RequestLoggingMiddleware)
      .forRoutes('*');
  }
}
