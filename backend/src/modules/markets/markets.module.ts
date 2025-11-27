import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MarketsService } from './services/markets.service';
import { MarketSettlementService } from './services/market-settlement.service';
import { BettingService } from './services/betting.service';
import { MarketController } from './controllers/market.controller';
import { BettingController } from './controllers/betting.controller';
import { MarketSettlementProcessor } from './processors/market-settlement.processor';
import { MarketsScheduler } from './schedulers/markets.scheduler';
import { PrismaModule } from '../../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { ViralModule } from '../viral/viral.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    WalletModule,
    SentimentModule,
    ViralModule,
    NotificationsModule,
    CacheModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'market-settlement',
    }),
    BullModule.registerQueue({
      name: 'bet-processing',
    }),
    BullModule.registerQueue({
      name: 'market-closure',
    }),
  ],
  controllers: [MarketController, BettingController],
  providers: [
    MarketsService,
    MarketSettlementService,
    BettingService,
    MarketSettlementProcessor,
    MarketsScheduler,
  ],
  exports: [
    MarketsService,
    MarketSettlementService,
    BettingService,
  ],
})
export class MarketsModule {}