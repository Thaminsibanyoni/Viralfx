import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { PaymentModule } from '../payment/payment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

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
// import { UsageProcessor } from "./processors/usage.processor"; // Temporarily disabled - files not found
// import { BillingProcessor } from "./processors/billing.processor"; // Temporarily disabled - files not found
// import { WebhookProcessor } from "./processors/webhook.processor"; // Temporarily disabled - files not found

// Guards & Interceptors
import { ApiKeyGuard } from "./guards/api-key.guard";
import { ApiUsageInterceptor } from "./interceptors/api-usage.interceptor";

@Module({
  imports: [
   // RedisModule, // Temporarily disabled - Processor file not found
   // HttpModule, // Temporarily disabled - Processor file not found
   // PaymentModule, // Temporarily disabled - Processor file not found
   // NotificationsModule, // Temporarily disabled - Processor file not found
   // StorageModule, // Temporarily disabled - Processor file not found
    BullModule.registerQueue(
      { name: 'api-usage' },
      { name: 'api-billing' },
      { name: 'api-webhooks' }),
  ],
  controllers: [
   // ProductsController, // Temporarily disabled - Processor file not found
   // PlansController, // Temporarily disabled - Processor file not found
   // KeysController, // Temporarily disabled - Processor file not found
   // UsageController, // Temporarily disabled - Processor file not found
   // BillingController, // Temporarily disabled - Processor file not found
   // WebhooksController, // Temporarily disabled - Processor file not found
  ],
  providers: [
    // Services
   // ProductsService, // Temporarily disabled - Processor file not found
   // PlansService, // Temporarily disabled - Processor file not found
   // KeysService, // Temporarily disabled - Processor file not found
   // UsageService, // Temporarily disabled - Processor file not found
   // BillingService, // Temporarily disabled - Processor file not found
   // RateLimitService, // Temporarily disabled - Processor file not found
   // WebhookService, // Temporarily disabled - Processor file not found

    // Processors
   // UsageProcessor, // Temporarily disabled - Processor file not found
   // BillingProcessor, // Temporarily disabled - Processor file not found
   // WebhookProcessor, // Temporarily disabled - Processor file not found

    // Guards & Interceptors
   // ApiKeyGuard, // Temporarily disabled - Processor file not found
   // ApiUsageInterceptor, // Temporarily disabled - Processor file not found
  ],
  exports: [
    // Export services for use in other modules
   // ProductsService, // Temporarily disabled - Processor file not found
   // KeysService, // Temporarily disabled - Processor file not found
   // BillingService, // Temporarily disabled - Processor file not found
   // RateLimitService, // Temporarily disabled - Processor file not found
   // WebhookService, // Temporarily disabled - Processor file not found
   // ApiKeyGuard, // Temporarily disabled - Processor file not found
   // ApiUsageInterceptor, // Temporarily disabled - Processor file not found
  ]
})
export class ApiMarketplaceModule {}
