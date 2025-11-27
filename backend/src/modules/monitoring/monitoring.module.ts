import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';

import { MonitoringService } from './services/monitoring.service';
import { MetricsService } from './services/metrics.service';
import { AlertingService } from './services/alerting.service';
import { PerformanceService } from './services/performance.service';
import { HealthService } from './services/health.service';
import { MonitoringController } from './controllers/monitoring.controller';
import { MetricsController } from './controllers/metrics.controller';
import { HealthController } from './controllers/health.controller';

import { SystemMetric } from './entities/metric.entity';
import { Alert } from './entities/alert.entity';
import { PerformanceReport } from './entities/performance-report.entity';
import { SystemHealth } from './entities/health.entity';

import { NotificationModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      SystemMetric,
      Alert,
      PerformanceReport,
      SystemHealth
    ]),
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