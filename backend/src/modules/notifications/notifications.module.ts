import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from "../../redis/redis.module";
import { MetricsModule } from '../analytics/analytics.module';
import { WebSocketModule } from '../websocket/websocket.module';

// Controllers
import { NotificationController } from "./controllers/notification.controller";
import { ChaosTestingController } from "./controllers/chaos-testing.controller";
import { ProviderHealthController } from "./controllers/provider-health.controller";

// Services
import { NotificationService } from "./services/notification.service";
import { SendTimeOptimizerService } from "./services/send-time-optimizer.service";
import { ProviderHealthService } from "./services/provider-health.service";
import { ProviderRoutingService } from "./services/provider-routing.service";
import { ChaosTestingService } from "./services/chaos-testing.service";

// Schedulers
import { SendTimeOptimizerScheduler } from "./schedulers/send-time-optimizer.scheduler";
import { ProviderHealthScheduler } from "./schedulers/provider-health.scheduler";

// Processors
// import { EmailProcessor } from "./processors/email.processor"; // Temporarily disabled - files not found
// import { PushProcessor } from "./processors/push.processor"; // Temporarily disabled - files not found
// import { SMSProcessor } from "./processors/sms.processor"; // Temporarily disabled - files not found
// import { InAppProcessor } from "./processors/in-app.processor"; // Temporarily disabled - files not found

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
          removeOnFail: 50
        }
      },
      {
        name: 'push',
        defaultJobOptions: {
          attempts: 3,
          backoff: 'exponential',
          removeOnComplete: 100,
          removeOnFail: 50
        }
      },
      {
        name: 'sms',
        defaultJobOptions: {
          attempts: 3,
          backoff: 'exponential',
          removeOnComplete: 100,
          removeOnFail: 50,
          delay: 1000 // Rate limiting
        }
      },
      {
        name: 'in-app',
        defaultJobOptions: {
          attempts: 3,
          backoff: 'exponential',
          removeOnComplete: 100,
          removeOnFail: 50
        }
      }),

    // Configuration and database
    ConfigModule,
    ScheduleModule.forRoot(),
    forwardRef(() => WebSocketModule),
  ],
  controllers: [
    NotificationController,
  ],
  providers: [
    // Services
    NotificationService,
    ProviderHealthService,
    ProviderRoutingService,

    // Schedulers
    ProviderHealthScheduler,

    // Queue processors
   // EmailProcessor, // Temporarily disabled - Processor file not found
   // PushProcessor, // Temporarily disabled - Processor file not found
   // SMSProcessor, // Temporarily disabled - Processor file not found
   // InAppProcessor, // Temporarily disabled - Processor file not found
  ],
  exports: [
    // Export services for use in other modules
    NotificationService,
    ProviderHealthService,
    ProviderRoutingService,
  ]
})
export class NotificationsModule {}
