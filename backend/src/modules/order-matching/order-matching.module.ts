import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Order } from '../market-aggregation/entities/order.entity';
import { Market } from '../market-aggregation/entities/market.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { WalletModule } from '../wallet/wallet.module';

import { OrderBookService } from './services/order-book.service';
import { MatchingEngineService } from './services/matching-engine.service';
import { SettlementService } from './services/settlement.service';
import { OrderValidationService } from './services/order-validation.service';
import { OrderController } from './controllers/order.controller';
import { OrderExecutionProcessor } from './processors/order-execution.processor';
import { SettlementProcessor } from './processors/settlement.processor';
import { OrderCleanupScheduler } from './schedulers/order-cleanup.scheduler';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Order, Market]),
    BullModule.registerQueueAsync(
      {
        name: 'order-execution',
        useFactory: (configService: ConfigService) => ({
          settings: {
            redis: {
              host: configService.get('REDIS_HOST', 'localhost'),
              port: configService.get('REDIS_PORT', 6379),
            },
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
          settings: {
            stalledInterval: 30 * 1000,
            maxStalledCount: 1,
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'order-settlement',
        useFactory: (configService: ConfigService) => ({
          settings: {
            redis: {
              host: configService.get('REDIS_HOST', 'localhost'),
              port: configService.get('REDIS_PORT', 6379),
            },
          },
          defaultJobOptions: {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
          settings: {
            concurrency: configService.get('ORDER_SETTLEMENT_QUEUE_CONCURRENCY', 5),
            stalledInterval: 30 * 1000,
            maxStalledCount: 1,
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'order-cleanup',
        useFactory: (configService: ConfigService) => ({
          settings: {
            redis: {
              host: configService.get('REDIS_HOST', 'localhost'),
              port: configService.get('REDIS_PORT', 6379),
            },
          },
          defaultJobOptions: {
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        }),
        inject: [ConfigService],
      }
    ),
    RedisModule,
    WebSocketModule,
    WalletModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderBookService,
    MatchingEngineService,
    SettlementService,
    OrderValidationService,
    OrderExecutionProcessor,
    SettlementProcessor,
    OrderCleanupScheduler,
  ],
  exports: [
    OrderBookService,
    MatchingEngineService,
    SettlementService,
    OrderValidationService,
  ],
})
export class OrderMatchingModule {}