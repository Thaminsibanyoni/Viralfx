import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Note: TypeORM entities removed - using Prisma models directly
// The Order and Market entities are now managed via Prisma
import { WebSocketModule } from '../websocket/websocket.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketAggregationModule } from '../market-aggregation/market-aggregation.module';
import { BrokersModule } from '../brokers/brokers.module';

import { OrderBookService } from "./services/order-book.service";
import { MatchingEngineService } from "./services/matching-engine.service";
import { SettlementService } from "./services/settlement.service";
import { OrderValidationService } from "./services/order-validation.service";
import { OrderController } from "./controllers/order.controller";
import { OrderCleanupScheduler } from "./schedulers/order-cleanup.scheduler";

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueueAsync(
      {
        name: 'order-execution',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000
            }
          },
          settings: {
            stalledInterval: 30 * 1000,
            maxStalledCount: 1
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'order-settlement',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          },
          defaultJobOptions: {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 5000
            }
          },
          settings: {
            concurrency: configService.get<number>('ORDER_SETTLEMENT_QUEUE_CONCURRENCY', 5),
            stalledInterval: 30 * 1000,
            maxStalledCount: 1
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'order-cleanup',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          },
          defaultJobOptions: {
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 2000
            }
          }
        }),
        inject: [ConfigService]
      }
    ),
    forwardRef(() => BrokersModule),
    forwardRef(() => WebSocketModule),
    forwardRef(() => WalletModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => MarketAggregationModule),
  ],
  controllers: [OrderController],
  providers: [
    OrderBookService,
    MatchingEngineService,
    SettlementService,
    OrderValidationService,
    OrderCleanupScheduler,
  ],
  exports: [
    OrderBookService,
    MatchingEngineService,
    SettlementService,
    OrderValidationService,
  ]
})
export class OrderMatchingModule {}
