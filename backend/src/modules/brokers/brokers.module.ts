import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';

// Entities
import { Broker } from './entities/broker.entity';
import { BrokerVerification } from './entities/broker-verification.entity';
import { BrokerBill } from './entities/broker-bill.entity';
import { BrokerApiUsage } from './entities/broker-api-usage.entity';
import { BrokerComplianceCheck } from './entities/broker-compliance-check.entity';
import { BrokerIntegration } from './entities/broker-integration.entity';
import { BrokerReview } from './entities/broker-review.entity';
import { BrokerMarketingAnalytics } from './entities/broker-marketing-analytics.entity';
import { BrokerClient } from './entities/broker-client.entity';

// Controllers
import { BrokersController } from './controllers/brokers.controller';
import { BillingController } from './controllers/billing.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { OAuthController } from './controllers/oauth.controller';
import { BrokersLinkController } from './controllers/brokers-link.controller';
import { ClientAttributionController } from './controllers/client-attribution.controller';
import { ClientDashboardController } from './controllers/client-dashboard.controller';
import { RevenueSharingController } from './controllers/revenue-sharing.controller';
import { WhiteLabelController } from './controllers/white-label.controller';

// Services
import { BrokersService } from './services/brokers.service';
import { FSCAService } from './services/fsca.service';
import { ComplianceService } from './services/compliance.service';
import { BillingService } from './services/billing.service';
import { AnalyticsService } from './services/analytics.service';
import { OAuthService } from './services/oauth.service';
import { IntegrationService } from './services/integration.service';
import { ClientAttributionService } from './services/client-attribution.service';
import { ClientDashboardService } from './services/client-dashboard.service';
import { RevenueSharingService } from './services/revenue-sharing.service';
import { WhiteLabelService } from './services/white-label.service';
import { InvoiceGeneratorService } from './services/invoice-generator.service';

// Processors
import { BrokerVerificationProcessor } from './processors/broker-verification.processor';
import { BrokerComplianceProcessor } from './processors/broker-compliance.processor';
import { BrokerBillingProcessor } from './processors/broker-billing.processor';
import { PayoutProcessor } from './processors/payout.processor';

// Schedulers
import { ComplianceScheduler } from './schedulers/compliance.scheduler';
import { BillingScheduler } from './schedulers/billing.scheduler';
import { AnalyticsScheduler } from './schedulers/analytics.scheduler';

// Guards & Middleware
import { BrokerAuthGuard, BrokerResponseInterceptor } from './guards/broker-auth.guard';
import { BrokerRolesGuard } from './guards/broker-roles.guard';
import { BrokerRateLimitMiddleware } from './middleware/broker-rate-limit.middleware';
import { CommissionAttributionMiddleware } from './middleware/commission-attribution.middleware';

// Other Modules
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      Broker,
      BrokerVerification,
      BrokerBill,
      BrokerApiUsage,
      BrokerComplianceCheck,
      BrokerIntegration,
      BrokerReview,
      BrokerMarketingAnalytics,
      BrokerClient,
    ]),

    // Bull queues for async processing
    BullModule.registerQueue(
      { name: 'broker-verification' },
      { name: 'broker-compliance' },
      { name: 'broker-billing' },
      { name: 'broker-analytics' },
      { name: 'payout-processing' },
    ),

    // External modules
    PrismaModule,
    PaymentModule,
    NotificationsModule,
    WebSocketModule,
    AuthModule,
    StorageModule,

    // Configuration modules
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
  ],
  providers: [
    // Services
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
    InvoiceGeneratorService,

    // Processors
    BrokerVerificationProcessor,
    BrokerComplianceProcessor,
    BrokerBillingProcessor,
    PayoutProcessor,

    // Schedulers
    ComplianceScheduler,
    BillingScheduler,
    AnalyticsScheduler,

    // Guards
    BrokerAuthGuard,
    BrokerRolesGuard,

    // Response Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: BrokerResponseInterceptor,
    },
  ],
  exports: [
    // Services for use in other modules
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

    // Guards
    BrokerAuthGuard,
    BrokerRolesGuard,
  ],
})
export class BrokersModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply rate limiting middleware to broker API routes
    consumer
      .apply(BrokerRateLimitMiddleware)
      .forRoutes(
        { path: 'api/brokers/*', method: RequestMethod.ALL },
        { path: 'api/billing/*', method: RequestMethod.ALL },
        { path: 'api/analytics/*', method: RequestMethod.ALL },
        { path: 'api/oauth/*', method: RequestMethod.ALL },
      );

    // Apply commission attribution middleware to trading routes
    consumer
      .apply(CommissionAttributionMiddleware)
      .forRoutes(
        { path: 'api/trading/orders', method: RequestMethod.POST },
      );
  }
}