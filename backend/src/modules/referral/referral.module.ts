import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ReferralService } from "./services/referral.service";
import { RewardService } from "./services/reward.service";
import { ReferralTrackingService } from "./services/referral-tracking.service";
import { ReferralController } from "./controllers/referral.controller";
import { RewardController } from "./controllers/reward.controller";
import { ReferralProcessingProcessor } from "./processors/referral-processing.processor";
import { RewardDistributionProcessor } from "./processors/reward-distribution.processor";
import { ReferralScheduler } from "./schedulers/referral.scheduler";
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'referral-processing'
    }),
    BullModule.registerQueue({
      name: 'reward-distribution'
    }),
    BullModule.registerQueue({
      name: 'notifications'
    }),
    BullModule.registerQueue({
      name: 'wallet'
    }),
    ScheduleModule.forRoot(),
    ConfigModule,
    CacheModule.register({
      ttl: 300, // 5 minutes default TTL
      max: 100 // Maximum number of items in cache
    }),
    UsersModule,
    WalletModule,
    NotificationsModule,
  ],
  controllers: [ReferralController, RewardController],
  providers: [
    ReferralService,
    RewardService,
    ReferralTrackingService,
    // ReferralProcessingProcessor,  // TEMP_DISABLED
    // RewardDistributionProcessor,  // TEMP_DISABLED
    ReferralScheduler,
  ],
  exports: [
    ReferralService,
    RewardService,
    ReferralTrackingService,
  ]
})
export class ReferralModule {}
