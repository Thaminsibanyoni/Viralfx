import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { WebSocketModule } from '../websocket/websocket.module';

// Entities
import { BacktestingStrategy } from '../../database/entities/backtesting-strategy.entity';
import { BacktestingResult } from '../../database/entities/backtesting-result.entity';
import { MarketData } from '../../database/entities/market-data.entity';
import { PerformanceMetric } from '../../database/entities/performance-metric.entity';

// Services
import { BacktestingService } from './services/backtesting.service';
import { AnalyticsService } from './services/analytics.service';
import { StrategyService } from './services/strategy.service';
import { PerformanceService } from './services/performance.service';
import { ReportService } from './services/report.service';
import { MarketDataAggregationService } from './services/market-data-aggregation.service';

// Controllers
import { BacktestingController } from './controllers/backtesting.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { StrategyController } from './controllers/strategy.controller';

// Processors
import { BacktestProcessor } from './processors/backtest.processor';
import { AnalyticsProcessor } from './processors/analytics.processor';
import { ReportProcessor } from './processors/report.processor';

// Schedulers
import { AnalyticsScheduler } from './schedulers/analytics.scheduler';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    TypeOrmModule.forFeature([
      BacktestingStrategy,
      BacktestingResult,
      MarketData,
      PerformanceMetric,
    ]),
    BullModule.registerQueue(
      {
        name: 'analytics-backtest',
        settings: {
          retryProcessDelay: 5000,
          maxStalledCount: 1,
        },
        config: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'analytics-report',
        settings: {
          retryProcessDelay: 5000,
          maxStalledCount: 1,
        },
        config: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'analytics-calculation',
        settings: {
          retryProcessDelay: 5000,
          maxStalledCount: 1,
        },
        config: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
    ),
    RedisModule,
    WebSocketModule,
  ],
  controllers: [
    BacktestingController,
    AnalyticsController,
    StrategyController,
  ],
  providers: [
    BacktestingService,
    AnalyticsService,
    StrategyService,
    PerformanceService,
    ReportService,
    MarketDataAggregationService,
    BacktestProcessor,
    AnalyticsProcessor,
    ReportProcessor,
    AnalyticsScheduler,
  ],
  exports: [
    BacktestingService,
    AnalyticsService,
    StrategyService,
    PerformanceService,
    MarketDataAggregationService,
  ],
})
export class AnalyticsModule {}