// Simple test to verify support module structure
import { TicketController } from './src/modules/support/controllers/ticket.controller';
import { SupportController } from './src/modules/support/controllers/support.controller';
import { KnowledgeBaseController } from './src/modules/support/controllers/knowledge-base.controller';
import { SupportProcessor } from './src/modules/support/processors/support.processor';
import { SupportScheduler } from './src/modules/support/schedulers/support.scheduler';
import { SupportModule } from './src/modules/support/support.module';

console.log('Support module compilation test');
console.log('✓ TicketController imported');
console.log('✓ SupportController imported');
console.log('✓ KnowledgeBaseController imported');
console.log('✓ SupportProcessor imported');
console.log('✓ SupportScheduler imported');
console.log('✓ SupportModule imported');