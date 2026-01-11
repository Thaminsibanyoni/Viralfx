import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

// Import all modules
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
import { OrderMatchingModule } from "./modules/order-matching/order-matching.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { PaymentModule } from "./modules/payment/payment.module";
import { WebSocketModule } from "./modules/websocket/websocket.module";
import { ChatModule } from "./modules/chat/chat.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { FilesModule } from "./modules/files/files.module";
import { AdminModule } from "./modules/admin/admin.module";
import { OracleModule } from "./modules/oracle/oracle.module";
import { BrokersModule } from "./modules/brokers/brokers.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { TrendMLModule } from "./modules/trend-ml/trend-ml.module";
import { ReferralModule } from "./modules/referral/referral.module";
import { StorageModule } from "./modules/storage/storage.module";
import { CrmModule } from "./modules/crm/crm.module";
import { FinancialReportingModule } from "./modules/financial-reporting/financial-reporting.module";
import { SupportModule } from "./modules/support/support.module";
import { ApiMarketplaceModule } from "./modules/api-marketplace/api-marketplace.module";
import { VPMXModule } from "./modules/vpmx/vpmx.module";

// Configuration
import appConfig from "./config/app.config";
import databaseConfig from "./config/database.config";
import redisConfig from "./config/redis.config";
import s3Config from "./config/s3.config";
import jwtConfig from "./config/jwt.config";

// Middleware
import { RequestLoggingMiddleware } from "./common/middleware/request-logging.middleware";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";

// Group modules for testing
const CORE_MODULES = [
  ConfigModule,
  RedisModule,
  StorageModule,
];

const FIRST_BATCH = [
  ...CORE_MODULES,
  WebSocketModule,
  OrderMatchingModule,
  WalletModule,
  PaymentModule,
  MarketAggregationModule,
  AuthModule,
  UsersModule,
];

const SECOND_BATCH = [
  ...FIRST_BATCH,
  TopicsModule,
  IngestModule,
  SentimentModule,
  DeceptionModule,
  ViralModule,
  TrendMLModule,
  MarketsModule,
];

const THIRD_BATCH = [
  ...SECOND_BATCH,
  ChatModule,
  NotificationsModule,
  FilesModule,
];

const FOURTH_BATCH = [
  ...THIRD_BATCH,
  AdminModule,
  OracleModule,
  BrokersModule,
];

const FIFTH_BATCH = [
  ...FOURTH_BATCH,
  CrmModule,
  FinancialReportingModule,
  SupportModule,
  AnalyticsModule,
  ReferralModule,
  ApiMarketplaceModule,
  VPMXModule,
];

// Select which batch to test (change this to test different batches)
const SELECTED_BATCH = CORE_MODULES; // Change to CORE_MODULES, FIRST_BATCH, SECOND_BATCH, etc.

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, s3Config, jwtConfig],
      envFilePath: ['.env.local', '.env'],
      expandVariables: true
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL', 60000),
          limit: config.get('THROTTLE_LIMIT', 100)
        },
        {
          name: 'auth',
          ttl: config.get('THROTTLE_AUTH_TTL', 60000),
          limit: config.get('THROTTLE_AUTH_LIMIT', 10)
        },
        {
          name: 'payments',
          ttl: config.get('THROTTLE_PAYMENTS_TTL', 60000),
          limit: config.get('THROTTLE_PAYMENTS_LIMIT', 5)
        },
      ],
      inject: [ConfigService]
    }),

    // Task scheduling
    ScheduleModule.forRoot(),

    // Queue management
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

    // Static file serving (uploads)
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

    // Selected batch of modules for testing
    ...SELECTED_BATCH,
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Global middleware order matters
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*');

    consumer
      .apply(RequestLoggingMiddleware)
      .forRoutes('*');
  }
}
