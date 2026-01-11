import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from "./services/users.service";
import { UserProfileService } from "./services/user-profile.service";
import { KYCService } from "./services/kyc.service";
import { UsersController } from "./controllers/users.controller";
import { KYCController } from "./controllers/kyc.controller";
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueueAsync(
      {
        name: 'user-verification',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'user-kyc',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'user-profile-update',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      }
    ),
    forwardRef(() => AuthModule),
    forwardRef(() => FilesModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [UsersController, KYCController],
  providers: [
    UsersService,
    UserProfileService,
    KYCService,
  ],
  exports: [
    UsersService,
    UserProfileService,
    KYCService,
  ]
})
export class UsersModule {}
