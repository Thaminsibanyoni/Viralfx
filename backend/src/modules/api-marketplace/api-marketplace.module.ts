import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { PaymentModule } from '../payment/payment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';

// Services
import { ProductsService } from "./services/products.service";
import { PlansService } from "./services/plans.service";
import { KeysService } from "./services/keys.service";
import { UsageService } from "./services/usage.service";
import { BillingService } from "./services/billing.service";
import { RateLimitService } from "./services/rate-limit.service";
import { WebhookService } from "./services/webhook.service";

// Controllers
import { ProductsController } from "./controllers/products.controller";
import { PlansController } from "./controllers/plans.controller";
import { KeysController } from "./controllers/keys.controller";
import { UsageController } from "./controllers/usage.controller";
import { BillingController } from "./controllers/billing.controller";
import { WebhooksController } from "./controllers/webhooks.controller";

// Processors
import { UsageProcessor } from "./processors/usage.processor";
import { BillingProcessor } from "./processors/billing.processor";
import { WebhookProcessor } from "./processors/webhook.processor";

// Guards & Interceptors
import { ApiKeyGuard } from "./guards/api-key.guard";
import { ApiUsageInterceptor } from "./interceptors/api-usage.interceptor";

@Module({
  imports: [
    RedisModule,
    HttpModule,
    AuthModule,
    PaymentModule,
    NotificationsModule,
    StorageModule,
    BullModule.registerQueue(
      { name: 'api-usage' },
      { name: 'api-billing' },
      { name: 'api-webhooks' }),
  ],
  controllers: [
    ProductsController,
    PlansController,
    KeysController,
    UsageController,
    BillingController,
    WebhooksController,
  ],
  providers: [
    // Services
    ProductsService,
    PlansService,
    KeysService,
    UsageService,
    BillingService,
    RateLimitService,
    WebhookService,

    // Processors
    UsageProcessor,
    BillingProcessor,
    WebhookProcessor,

    // Guards & Interceptors
    ApiKeyGuard,
    ApiUsageInterceptor,
  ],
  exports: [
    // Export services for use in other modules
    ProductsService,
    KeysService,
    BillingService,
    RateLimitService,
    WebhookService,
    ApiKeyGuard,
    ApiUsageInterceptor,
  ]
})
export class ApiMarketplaceModule {}
