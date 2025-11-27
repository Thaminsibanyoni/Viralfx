import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletModule } from '../wallet/wallet.module';
import { RedisModule } from '../redis/redis.module';
import { FilesModule } from '../files/files.module';
import { Broker } from '../brokers/entities/broker.entity';
import { User } from '../../database/entities/user.entity';
import { ApiUsageRecord } from '../api-marketplace/entities/api-usage-record.entity';

// Legacy CRM Entities
import { Lead } from './entities/lead.entity';
import { Opportunity } from './entities/opportunity.entity';
import { Contract } from './entities/contract.entity';
import { Activity } from './entities/activity.entity';
import { RelationshipManager } from './entities/relationship-manager.entity';

// Broker CRM Entities
import { BrokerAccount } from './entities/broker-account.entity';
import { BrokerInvoice } from './entities/broker-invoice.entity';
import { BrokerInvoiceItem } from './entities/broker-invoice-item.entity';
import { BrokerPayment } from './entities/broker-payment.entity';
import { BrokerSubscription } from './entities/broker-subscription.entity';
import { BrokerNote } from './entities/broker-note.entity';
import { BrokerDocument } from './entities/broker-document.entity';

// Client CRM Entities
import { ClientRecord } from './entities/client-record.entity';
import { ClientInteraction } from './entities/client-interaction.entity';

// Sales Pipeline Entities
import { PipelineStage } from './entities/pipeline-stage.entity';
import { BrokerDeal } from './entities/broker-deal.entity';
import { DealActivity } from './entities/deal-activity.entity';

// Support Desk Entities
import { Ticket } from './entities/ticket.entity';
import { TicketCategory } from './entities/ticket-category.entity';
import { TicketPriority } from './entities/ticket-priority.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { TicketAssignment } from './entities/ticket-assignment.entity';

// Billing Entities
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoicePayment } from './entities/invoice-payment.entity';

// Staff Management Entities
import { StaffRole } from './entities/staff-role.entity';
import { StaffMember } from './entities/staff-member.entity';

// Legacy Services
import { CrmService } from './services/crm.service';
import { LeadService } from './services/lead.service';
import { OpportunityService } from './services/opportunity.service';
import { ContractService } from './services/contract.service';
import { ActivityService } from './services/activity.service';

// New CRM Services
import { BrokerCrmService } from './services/broker-crm.service';
import { SupportService } from './services/support.service';
import { BillingService } from './services/billing.service';
import { PipelineService } from './services/pipeline.service';
import { PaymentWebhookService } from './services/payment-webhook.service';
import { ClientsService } from './services/clients.service';

// Payment Providers
import { PaystackProvider } from './providers/paystack.provider';
import { PayFastProvider } from './providers/payfast.provider';
import { EFTProvider } from './providers/eft.provider';
import { OzowProvider } from './providers/ozow.provider';

// Legacy Controllers
import { CrmController } from './controllers/crm.controller';
import { LeadController } from './controllers/lead.controller';
import { OpportunityController } from './controllers/opportunity.controller';
import { ContractController } from './controllers/contract.controller';

// New CRM Controllers
import { BrokerCrmController } from './controllers/broker-crm.controller';
import { SupportController } from './controllers/support.controller';
import { BillingController } from './controllers/billing.controller';
import { PipelineController } from './controllers/pipeline.controller';
import { PaymentWebhookController } from './controllers/payment-webhook.controller';
import { ClientsController } from './controllers/clients.controller';

// Processors and Schedulers
import { CrmProcessor } from './processors/crm.processor';
import { CrmScheduler } from './schedulers/crm.scheduler';
import { CrmBillingProcessor } from './processors/crm-billing.processor';
import { CrmSupportProcessor } from './processors/crm-support.processor';
import { CrmDocsProcessor } from './processors/crm-docs.processor';
import { CrmPaymentsProcessor } from './processors/crm-payments.processor';
import { CrmTicketSlaProcessor } from './processors/crm-ticket-sla.processor';
import { CrmNotificationsProcessor } from './processors/crm-notifications.processor';
import { CrmOnboardingProcessor } from './processors/crm-onboarding.processor';

// Guards and Decorators
import { PermissionGuard } from './guards/permission.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Legacy
      Lead,
      Opportunity,
      Contract,
      Activity,
      RelationshipManager,

      // Core Entities
      Broker,
      User,
      ApiUsageRecord,

      // Broker CRM
      BrokerAccount,
      BrokerInvoice,
      BrokerInvoiceItem,
      BrokerPayment,
      BrokerSubscription,
      BrokerNote,
      BrokerDocument,

      // Client CRM
      ClientRecord,
      ClientInteraction,

      // Sales Pipeline
      PipelineStage,
      BrokerDeal,
      DealActivity,

      // Support Desk
      Ticket,
      TicketCategory,
      TicketPriority,
      TicketMessage,
      TicketAssignment,

      // Billing
      Invoice,
      InvoiceItem,
      InvoicePayment,

      // Staff Management
      StaffRole,
      StaffMember,
    ]),
    BullModule.registerQueue([
      {
        name: 'crm-tasks',
      },
      {
        name: 'crm-billing',
      },
      {
        name: 'crm-payments',
      },
      {
        name: 'crm-ticket-sla',
      },
      {
        name: 'crm-docs',
      },
      {
        name: 'crm-notifications',
      },
      {
        name: 'crm-onboarding',
      },
    ]),
    ConfigModule,
    HttpModule,
    AuthModule,
    NotificationsModule,
    WalletModule,
    RedisModule,
    FilesModule,
  ],
  controllers: [
    // Legacy Controllers
    CrmController,
    LeadController,
    OpportunityController,
    ContractController,

    // New CRM Controllers
    BrokerCrmController,
    SupportController,
    BillingController,
    PipelineController,
    PaymentWebhookController,
    ClientsController,
  ],
  providers: [
    // Legacy Services
    CrmService,
    LeadService,
    OpportunityService,
    ContractService,
    ActivityService,

    // New CRM Services
    BrokerCrmService,
    SupportService,
    BillingService,
    PipelineService,
    PaymentWebhookService,
    ClientsService,

    // Payment Providers
    PaystackProvider,
    PayFastProvider,
    EFTProvider,
    OzowProvider,

    // Processors and Schedulers
    CrmProcessor,
    CrmScheduler,
    CrmBillingProcessor,
    CrmSupportProcessor,
    CrmDocsProcessor,
    CrmPaymentsProcessor,
    CrmTicketSlaProcessor,
    CrmNotificationsProcessor,
    CrmOnboardingProcessor,

    // Guards
    PermissionGuard,
  ],
  exports: [
    CrmService,
    BrokerCrmService,
    SupportService,
    BillingService,
    PipelineService,
    ClientsService,
  ],
})
export class CrmModule {}