import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';

// Entities
import { Ticket } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { TicketCategory } from './entities/ticket-category.entity';
import { SLA } from './entities/sla.entity';
import { TicketSLA } from './entities/ticket-sla.entity';
import { KnowledgeBaseArticle } from './entities/knowledge-base-article.entity';

// Services
import { SupportService } from './services/support.service';
import { TicketService } from './services/ticket.service';
import { SlaService } from './services/sla.service';
import { KnowledgeBaseService } from './services/knowledge-base.service';

// Controllers
import { SupportController } from './controllers/support.controller';
import { TicketController } from './controllers/ticket.controller';
import { KnowledgeBaseController } from './controllers/knowledge-base.controller';

// Processors & Schedulers
import { SupportProcessor } from './processors/support.processor';
import { SupportScheduler } from './schedulers/support.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketMessage,
      TicketCategory,
      SLA,
      TicketSLA,
      KnowledgeBaseArticle,
    ]),
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
    SupportProcessor,
    SupportScheduler,
  ],
  exports: [SupportService],
})
export class SupportModule {}