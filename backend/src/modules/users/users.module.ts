import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UsersService } from './services/users.service';
import { UserProfileService } from './services/user-profile.service';
import { KYCService } from './services/kyc.service';
import { UsersController } from './controllers/users.controller';
import { KYCController } from './controllers/kyc.controller';
import { UserVerificationProcessor } from './processors/user-verification.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'user-verification',
    }),
    BullModule.registerQueue({
      name: 'user-kyc',
    }),
    BullModule.registerQueue({
      name: 'user-profile-update',
    }),
    PrismaModule,
    NotificationsModule,
    FilesModule,
    AuthModule,
    CacheModule,
    ThrottlerModule,
    RedisModule,
  ],
  controllers: [UsersController, KYCController],
  providers: [
    UsersService,
    UserProfileService,
    KYCService,
    UserVerificationProcessor,
  ],
  exports: [
    UsersService,
    UserProfileService,
    KYCService,
  ],
})
export class UsersModule {}