import { Module, MiddlewareConsumer, RequestMethod, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';

// Controllers
import { BrokersController } from "./controllers/brokers.controller";
import { BillingController } from "./controllers/billing.controller";
import { AnalyticsController } from "./controllers/analytics.controller";
import { OAuthController } from "./controllers/oauth.controller";
import { BrokersLinkController } from "./controllers/brokers-link.controller";
import { ClientAttributionController } from "./controllers/client-attribution.controller";
import { ClientDashboardController } from "./controllers/client-dashboard.controller";
import { RevenueSharingController } from "./controllers/revenue-sharing.controller";
import { WhiteLabelController } from "./controllers/white-label.controller";
import { BrokerAuthController } from "./controllers/broker-auth.controller";

// Services
import { BrokersService } from "./services/brokers.service";
import { FSCAService } from "./services/fsca.service";
import { ComplianceService } from "./services/compliance.service";
import { BillingService } from "./services/billing.service";
import { AnalyticsService } from "./services/analytics.service";
import { OAuthService } from "./services/oauth.service";
import { IntegrationService } from "./services/integration.service";
import { ClientAttributionService } from "./services/client-attribution.service";
import { ClientDashboardService } from "./services/client-dashboard.service";
import { RevenueSharingService } from "./services/revenue-sharing.service";
import { WhiteLabelService } from "./services/white-label.service";
import { BrokerAuthService } from "./services/broker-auth.service";

// Processors
import { BrokerVerificationProcessor } from "./processors/broker-verification.processor";
import { BrokerComplianceProcessor } from "./processors/broker-compliance.processor";
import { BrokerBillingProcessor } from "./processors/broker-billing.processor";
import { PayoutProcessor } from "./processors/payout.processor";

// Schedulers
import { ComplianceScheduler } from "./schedulers/compliance.scheduler";
import { BillingScheduler } from "./schedulers/billing.scheduler";

// Guards & Middleware
import { BrokerAuthGuard, BrokerResponseInterceptor } from "./guards/broker-auth.guard";
import { BrokerRolesGuard } from "./guards/broker-roles.guard";
import { BrokerRateLimitMiddleware } from "./middleware/broker-rate-limit.middleware";
import { CommissionAttributionMiddleware } from "./middleware/commission-attribution.middleware";

// Other Modules
import { PaymentModule } from '../payment/payment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { BillingModule } from '../billing/billing.module';

// Billing Services
import { InvoiceGeneratorService } from '../billing/services/invoice-generator.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'broker-verification' },
      { name: 'broker-compliance' },
      { name: 'broker-billing' },
      { name: 'broker-analytics' },
      { name: 'payout-processing' }),

    forwardRef(() => PaymentModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => WebSocketModule),
    forwardRef(() => AuthModule),
    forwardRef(() => StorageModule),
    BillingModule,

    HttpModule,
    PassportModule,
    ConfigModule,
    ScheduleModule.forRoot(),
    CacheModule.register(),
  ],
  controllers: [
    BrokersController,
    BillingController,
    AnalyticsController,
    OAuthController,
    BrokersLinkController,
    ClientAttributionController,
    ClientDashboardController,
    RevenueSharingController,
    WhiteLabelController,
    BrokerAuthController,
  ],
  providers: [
    BrokersService,
    FSCAService,
    ComplianceService,
    BillingService,
    AnalyticsService,
    OAuthService,
    IntegrationService,
    ClientAttributionService,
    ClientDashboardService,
    RevenueSharingService,
    WhiteLabelService,
    BrokerAuthService,
    InvoiceGeneratorService,
    BrokerVerificationProcessor,
    BrokerComplianceProcessor,
    BrokerBillingProcessor,
    PayoutProcessor,
    ComplianceScheduler,
    BillingScheduler,
    BrokerAuthGuard,
    BrokerRolesGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: BrokerResponseInterceptor
    },
  ],
  exports: [
    BrokersService,
    ComplianceService,
    FSCAService,
    AnalyticsService,
    BillingService,
    OAuthService,
    IntegrationService,
    ClientAttributionService,
    ClientDashboardService,
    RevenueSharingService,
    WhiteLabelService,
    BrokerAuthService,
    BrokerAuthGuard,
    BrokerRolesGuard,
  ]
})
export class BrokersModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BrokerRateLimitMiddleware)
      .forRoutes(
        { path: 'api/brokers/*', method: RequestMethod.ALL },
        { path: 'api/billing/*', method: RequestMethod.ALL },
        { path: 'api/analytics/*', method: RequestMethod.ALL },
        { path: 'api/oauth/*', method: RequestMethod.ALL });

    consumer
      .apply(CommissionAttributionMiddleware)
      .forRoutes(
        { path: 'api/trading/orders', method: RequestMethod.POST });
  }
}
