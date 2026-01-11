import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';

import { MonitoringService } from "./services/monitoring.service";
import { MetricsService } from "./services/metrics.service";
import { AlertingService } from "./services/alerting.service";
import { PerformanceService } from "./services/performance.service";
import { HealthService } from "./services/health.service";
import { MonitoringController } from "./controllers/monitoring.controller";
import { MetricsController } from "./controllers/metrics.controller";
import { HealthController } from "./controllers/health.controller";

import { NotificationModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
        RedisModule,
    NotificationModule,
    AuthModule
  ],
  controllers: [
    MonitoringController,
    MetricsController,
    HealthController
  ],
  providers: [
    MonitoringService,
    MetricsService,
    AlertingService,
    PerformanceService,
    HealthService
  ],
  exports: [
    MonitoringService,
    MetricsService,
    AlertingService,
    PerformanceService,
    HealthService
  ]
})
export class MonitoringModule {}
