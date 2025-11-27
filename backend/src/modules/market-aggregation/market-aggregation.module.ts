import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';

import { MarketAggregationService } from './services/market-aggregation.service';
import { PricingEngineService } from './services/pricing-engine.service';
import { SymbolNormalizerService } from './services/symbol-normalizer.service';
import { MarketDataService } from './services/market-data.service';
import { OrderBookService } from '../../order-matching/services/order-book.service';

import { MarketController } from './controllers/market.controller';
import { OrderController } from './controllers/order.controller';
import { PortfolioController } from './controllers/portfolio.controller';

import { MarketProcessor } from './processors/market.processor';
import { OrderProcessor } from './processors/order.processor';
import { MarketUpdateScheduler } from './schedulers/market-update.scheduler';

import { Market } from './entities/market.entity';
import { Symbol } from './entities/symbol.entity';
import { Order } from './entities/order.entity';
import { Price } from './entities/price.entity';
import { Portfolio } from './entities/portfolio.entity';

import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule.forRoot({
      config: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
    }),
    TypeOrmModule.forFeature([Market, Symbol, Order, Price, Portfolio]),
    BullModule.registerQueue({
      name: 'market-updates',
    }),
    BullModule.registerQueue({
      name: 'order-processing',
    }),
    BullModule.registerQueue({
      name: 'price-calculation',
    }),
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
    OrderBookService,
    MarketProcessor,
    OrderProcessor,
    MarketUpdateScheduler,
  ],
  exports: [
    MarketAggregationService,
    PricingEngineService,
    SymbolNormalizerService,
    MarketDataService,
  ],
})
export class MarketAggregationModule {}