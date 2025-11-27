import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../database/prisma.service';
import { RedisModule } from '../../redis/redis.service';
import { MetricsModule } from '../../analytics/analytics.module';
import { WebSocketModule } from '../websocket/websocket.module';

// Controllers
import { NotificationController } from './controllers/notification.controller';
import { ChaosTestingController } from './controllers/chaos-testing.controller';
import { ProviderHealthController } from './controllers/provider-health.controller';

// Services
import { NotificationService } from './services/notification.service';
import { SendTimeOptimizerService } from './services/send-time-optimizer.service';
import { ProviderHealthService } from './services/provider-health.service';
import { ProviderRoutingService } from './services/provider-routing.service';
import { ChaosTestingService } from './services/chaos-testing.service';

// Schedulers
import { SendTimeOptimizerScheduler } from './schedulers/send-time-optimizer.scheduler';
import { ProviderHealthScheduler } from './schedulers/provider-health.scheduler';

// Processors
import { EmailProcessor } from './processors/email.processor';
import { PushProcessor } from './processors/push.processor';
import { SMSProcessor } from './processors/sms.processor';
import { InAppProcessor } from './processors/in-app.processor';

@Module({
  imports: [
    // Bull queues for notification processing
    BullModule.registerQueue(
      {
        name: 'email',
        defaultJobOptions: {
          attempts: 3,
          backoff: 'exponential',
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
      {
        name: 'push',
        defaultJobOptions: {
          attempts: 3,
          backoff: 'exponential',
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
      {
        name: 'sms',
        defaultJobOptions: {
          attempts: 3,
          backoff: 'exponential',
          removeOnComplete: 100,
          removeOnFail: 50,
          delay: 1000, // Rate limiting
        },
      },
      {
        name: 'in-app',
        defaultJobOptions: {
          attempts: 3,
          backoff: 'exponential',
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
    ),

    // Configuration and database
    PrismaModule,
    ConfigModule,
    ScheduleModule.forRoot(),
    MetricsModule,
    WebSocketModule,
  ],
  controllers: [
    NotificationController,
    ChaosTestingController,
    ProviderHealthController,
  ],
  providers: [
    // Services
    NotificationService,
    SendTimeOptimizerService,
    ProviderHealthService,
    ProviderRoutingService,
    ChaosTestingService,

    // Schedulers
    SendTimeOptimizerScheduler,
    ProviderHealthScheduler,

    // Queue processors
    EmailProcessor,
    PushProcessor,
    SMSProcessor,
    InAppProcessor,
  ],
  exports: [
    // Export services for use in other modules
    NotificationService,
    SendTimeOptimizerService,
    ProviderHealthService,
    ProviderRoutingService,
    ChaosTestingService,
  ],
})
export class NotificationsModule {}