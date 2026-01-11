import { Module, Global } from '@nestjs/common';
import { ShutdownService } from './shutdown.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../modules/redis/redis.module';

/**
 * ShutdownModule - Manages graceful shutdown of the application
 *
 * This module handles:
 * - Graceful shutdown on SIGTERM (Kubernetes pod termination)
 * - Graceful shutdown on SIGINT (Ctrl+C)
 * - Emergency shutdown on uncaught exceptions
 * - Queue draining before shutdown
 * - Connection cleanup
 * - State preservation
 */
@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [ShutdownService],
  exports: [ShutdownService],
})
export class ShutdownModule {}
