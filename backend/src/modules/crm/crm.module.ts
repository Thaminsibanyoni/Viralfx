import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletModule } from '../wallet/wallet.module';
import { RedisModule } from '../redis/redis.module';
import { FilesModule } from '../files/files.module';
import { BrokersModule } from '../brokers/brokers.module';
import { AuditModule } from '../audit/audit.module';

// Services
import { CrmService } from "./services/crm.service";
import { LeadService } from "./services/lead.service";
import { OpportunityService } from "./services/opportunity.service";
import { ContractService } from "./services/contract.service";
import { ActivityService } from "./services/activity.service";
import { BrokerCrmService } from "./services/broker-crm.service";
import { SupportService } from "./services/support.service";
import { BillingService } from "./services/billing.service";
import { PipelineService } from "./services/pipeline.service";
import { PaymentWebhookService } from "./services/payment-webhook.service";
import { ClientsService } from "./services/clients.service";

// Payment Providers
import { PaystackProvider } from "./providers/paystack.provider";
import { PayFastProvider } from "./providers/payfast.provider";
import { EFTProvider } from "./providers/eft.provider";
import { OzowProvider } from "./providers/ozow.provider";

// Controllers
import { CrmController } from "./controllers/crm.controller";
import { LeadController } from "./controllers/lead.controller";
import { OpportunityController } from "./controllers/opportunity.controller";
import { ContractController } from "./controllers/contract.controller";
import { BrokerCrmController } from "./controllers/broker-crm.controller";
import { SupportController } from "./controllers/support.controller";
import { BillingController } from "./controllers/billing.controller";
import { PipelineController } from "./controllers/pipeline.controller";
import { PaymentWebhookController } from "./controllers/payment-webhook.controller";
import { ClientsController } from "./controllers/clients.controller";

// Processors and Schedulers
import { CrmProcessor } from "./processors/crm.processor";
import { CrmScheduler } from "./schedulers/crm.scheduler";
import { CrmBillingProcessor } from "./processors/crm-billing.processor";
import { CrmSupportProcessor } from "./processors/crm-support.processor";
import { CrmDocsProcessor } from "./processors/crm-docs.processor";
import { CrmPaymentsProcessor } from "./processors/crm-payments.processor";
import { CrmTicketSlaProcessor } from "./processors/crm-ticket-sla.processor";
import { CrmNotificationsProcessor } from "./processors/crm-notifications.processor";
import { CrmOnboardingProcessor } from "./processors/crm-onboarding.processor";

// Guards and Decorators
import { PermissionGuard } from "./guards/permission.guard";

@Module({
  imports: [
    BullModule.registerQueueAsync(
      {
        name: 'crm-tasks',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'crm-billing',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'crm-payments',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'crm-ticket-sla',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'crm-docs',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'crm-notifications',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'crm-onboarding',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      }
    ),
    ConfigModule,
    HttpModule,
    AuthModule,
    forwardRef(() => AdminModule),
    NotificationsModule,
    WalletModule,
    RedisModule,
    FilesModule,
    BrokersModule,
    AuditModule,
  ],
  controllers: [
    CrmController,
    LeadController,
    OpportunityController,
    ContractController,
    BrokerCrmController,
    SupportController,
    BillingController,
    PipelineController,
    PaymentWebhookController,
    ClientsController,
  ],
  providers: [
    CrmService,
    LeadService,
    OpportunityService,
    ContractService,
    ActivityService,
    BrokerCrmService,
    SupportService,
    BillingService,
    PipelineService,
    PaymentWebhookService,
    ClientsService,
    PaystackProvider,
    PayFastProvider,
    EFTProvider,
    OzowProvider,
    // CrmProcessor,  // TEMP_DISABLED
    CrmScheduler,
    // CrmBillingProcessor,  // TEMP_DISABLED
    // CrmSupportProcessor,  // TEMP_DISABLED
    // CrmDocsProcessor,  // TEMP_DISABLED
    // CrmPaymentsProcessor,  // TEMP_DISABLED
    // CrmTicketSlaProcessor,  // TEMP_DISABLED
    // CrmNotificationsProcessor,  // TEMP_DISABLED
    // CrmOnboardingProcessor,  // TEMP_DISABLED
    PermissionGuard,
  ],
  exports: [
    CrmService,
    BrokerCrmService,
    SupportService,
    BillingService,
    PipelineService,
    ClientsService,
  ]
})
export class CrmModule {}
