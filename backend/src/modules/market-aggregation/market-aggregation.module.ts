import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrderMatchingModule } from '../order-matching/order-matching.module';

import { MarketAggregationService } from "./services/market-aggregation.service";
import { PricingEngineService } from "./services/pricing-engine.service";
import { SymbolNormalizerService } from "./services/symbol-normalizer.service";
import { MarketDataService } from "./services/market-data.service";

import { MarketController } from "./controllers/market.controller";
import { OrderController } from "./controllers/order.controller";
import { PortfolioController } from "./controllers/portfolio.controller";

import { MarketUpdateScheduler } from "./schedulers/market-update.scheduler";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => OrderMatchingModule),
    BullModule.registerQueue(
      {
        name: 'market-updates'
      },
      {
        name: 'order-processing'
      },
      {
        name: 'price-calculation'
      }
    ),
  ],
  controllers: [
    MarketController,
    OrderController,
    PortfolioController,
  ],
  providers: [
    MarketAggregationService,
    PricingEngineService,
    SymbolNormalizerService,
    MarketDataService,
    MarketUpdateScheduler,
  ],
  exports: [
    MarketAggregationService,
    PricingEngineService,
    SymbolNormalizerService,
    MarketDataService,
  ]
})
export class MarketAggregationModule {}
