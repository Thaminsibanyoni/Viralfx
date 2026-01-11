import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupportService } from "./services/support.service";
import { TicketService } from "./services/ticket.service";
import { SlaService } from "./services/sla.service";
import { KnowledgeBaseService } from "./services/knowledge-base.service";
import { SupportController } from "./controllers/support.controller";
import { TicketController } from "./controllers/ticket.controller";
import { KnowledgeBaseController } from "./controllers/knowledge-base.controller";
import { SupportProcessor } from "./processors/support.processor";
import { SupportScheduler } from "./schedulers/support.scheduler";

@Module({
  imports: [
    BullModule.registerQueue({ name: 'support-tickets' }),
    ConfigModule,
    NotificationsModule,
  ],
  controllers: [
    SupportController,
    TicketController,
    KnowledgeBaseController,
  ],
  providers: [
    SupportService,
    TicketService,
    SlaService,
    KnowledgeBaseService,
    // SupportProcessor,  // TEMP_DISABLED
    SupportScheduler,
  ],
  exports: [
    SupportService,
    TicketService,
    SlaService,
    KnowledgeBaseService
  ]
})
export class SupportModule {}
