import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MarketsService } from "./services/markets.service";
import { MarketSettlementService } from "./services/market-settlement.service";
import { BettingService } from "./services/betting.service";
import { MarketController } from "./controllers/market.controller";
import { BettingController } from "./controllers/betting.controller";
// import { MarketSettlementProcessor } from "./processors/market-settlement.processor"; // Temporarily disabled - files not found
import { MarketsScheduler } from "./schedulers/markets.scheduler";
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    WalletModule,
    NotificationsModule,
    BullModule.registerQueue({
      name: 'market-settlement'
    }),
    BullModule.registerQueue({
      name: 'bet-processing'
    }),
    BullModule.registerQueue({
      name: 'market-closure'
    }),
  ],
  controllers: [MarketController, BettingController],
  providers: [
    MarketsService,
    MarketSettlementService,
    BettingService,
   // MarketSettlementProcessor, // Temporarily disabled - Processor file not found
    MarketsScheduler,
  ],
  exports: [
    MarketsService,
    MarketSettlementService,
    BettingService,
  ]
})
export class MarketsModule {}
