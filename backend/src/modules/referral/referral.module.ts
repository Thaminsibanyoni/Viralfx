import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ReferralService } from './services/referral.service';
import { RewardService } from './services/reward.service';
import { ReferralTrackingService } from './services/referral-tracking.service';
import { ReferralController } from './controllers/referral.controller';
import { RewardController } from './controllers/reward.controller';
import { ReferralProcessingProcessor } from './processors/referral-processing.processor';
import { RewardDistributionProcessor } from './processors/reward-distribution.processor';
import { ReferralScheduler } from './schedulers/referral.scheduler';
import { Referral } from './entities/referral.entity';
import { Reward } from './entities/reward.entity';
import { ReferralTier } from './entities/referral-tier.entity';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    TypeOrmModule.forFeature([Referral, Reward, ReferralTier]),
    BullModule.registerQueue({
      name: 'referral-processing',
    }),
    BullModule.registerQueue({
      name: 'reward-distribution',
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    BullModule.registerQueue({
      name: 'wallet',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    WalletModule,
    NotificationsModule,
    CacheModule,
  ],
  controllers: [ReferralController, RewardController],
  providers: [
    ReferralService,
    RewardService,
    ReferralTrackingService,
    ReferralProcessingProcessor,
    RewardDistributionProcessor,
    ReferralScheduler,
  ],
  exports: [
    ReferralService,
    RewardService,
    ReferralTrackingService,
  ],
})
export class ReferralModule {}