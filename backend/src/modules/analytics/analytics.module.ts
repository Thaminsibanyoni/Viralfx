import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '../redis/redis.module';
import { WebSocketModule } from '../websocket/websocket.module';

// Entities - Using Prisma models directly

// Services
import { BacktestingService } from "./services/backtesting.service";
import { AnalyticsService } from "./services/analytics.service";
import { StrategyService } from "./services/strategy.service";
import { PerformanceService } from "./services/performance.service";
import { ReportService } from "./services/report.service";
import { MarketDataAggregationService } from "./services/market-data-aggregation.service";

// Controllers
import { BacktestingController } from "./controllers/backtesting.controller";
import { AnalyticsController } from "./controllers/analytics.controller";
import { StrategyController } from "./controllers/strategy.controller";

// Processors
// import { BacktestProcessor } from "./processors/backtest.processor"; // Temporarily disabled due to BullMQ issue
// import { AnalyticsProcessor } from "./processors/analytics.processor"; // Temporarily disabled - files not found
// import { ReportProcessor } from "./processors/report.processor"; // Temporarily disabled - files not found

// Schedulers
import { AnalyticsScheduler } from "./schedulers/analytics.scheduler";

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      {
        name: 'analytics-backtest',
        settings: {
          retryProcessDelay: 5000,
          maxStalledCount: 1
        },
        config: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      },
      {
        name: 'analytics-report',
        settings: {
          retryProcessDelay: 5000,
          maxStalledCount: 1
        },
        config: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      },
      {
        name: 'analytics-calculation',
        settings: {
          retryProcessDelay: 5000,
          maxStalledCount: 1
        },
        config: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      }),
    RedisModule,
    forwardRef(() => WebSocketModule),
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
    // BacktestProcessor, // Temporarily disabled due to BullMQ issue
    // AnalyticsProcessor, // Temporarily disabled - files not found
    // ReportProcessor, // Temporarily disabled - files not found
    AnalyticsScheduler,
  ],
  exports: [
    BacktestingService,
    AnalyticsService,
    StrategyService,
    PerformanceService,
    MarketDataAggregationService,
  ]
})
export class AnalyticsModule {}
