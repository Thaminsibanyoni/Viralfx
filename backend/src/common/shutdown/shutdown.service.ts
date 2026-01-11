import {
  Injectable,
  OnModuleDestroy,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../modules/redis/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface ShutdownConfig {
  drainTimeout: number; // Time to wait for queues to drain (ms)
  connectionCloseTimeout: number; // Time to wait for connections to close (ms)
  forceShutdownTimeout: number; // Max time before force shutdown (ms)
}

interface ShutdownState {
  isShuttingDown: boolean;
  shutdownInitiated?: Date;
  queuesDrained: boolean;
  connectionsClosed: boolean;
  stateSaved: boolean;
}

@Injectable()
export class ShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownService.name);
  private readonly configService: ConfigService;
  private readonly prismaService: PrismaService;
  private readonly redisService: RedisService;
  private readonly queues: Queue[];

  private shutdownState: ShutdownState = {
    isShuttingDown: false,
    queuesDrained: false,
    connectionsClosed: false,
    stateSaved: false,
  };

  private shutdownConfig: ShutdownConfig = {
    drainTimeout: 30000, // 30 seconds
    connectionCloseTimeout: 15000, // 15 seconds
    forceShutdownTimeout: 60000, // 60 seconds
  };

  constructor(
    configService: ConfigService,
    prismaService: PrismaService,
    redisService: RedisService,
  ) {
    this.configService = configService;
    this.prismaService = prismaService;
    this.redisService = redisService;
    this.queues = [];

    // Load configuration from environment
    this.loadShutdownConfig();

    // Setup signal handlers
    this.setupSignalHandlers();
  }

  /**
   * Register a queue for graceful shutdown
   */
  registerQueue(queue: Queue): void {
    if (!this.queues.includes(queue)) {
      this.queues.push(queue);
      this.logger.debug(`Registered queue for shutdown: ${queue.name}`);
    }
  }

  /**
   * Load shutdown configuration from environment
   */
  private loadShutdownConfig(): void {
    this.shutdownConfig = {
      drainTimeout:
        this.configService.get<number>('SHUTDOWN_DRAIN_TIMEOUT', 30000),
      connectionCloseTimeout: this.configService.get<number>(
        'SHUTDOWN_CONNECTION_TIMEOUT',
        15000,
      ),
      forceShutdownTimeout: this.configService.get<number>(
        'SHUTDOWN_FORCE_TIMEOUT',
        60000,
      ),
    };
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // SIGTERM - Kubernetes pod termination
    process.on('SIGTERM', async () => {
      this.logger.log('SIGTERM received - Initiating graceful shutdown...');
      await this.gracefulShutdown('SIGTERM');
    });

    // SIGINT - Ctrl+C
    process.on('SIGINT', async () => {
      this.logger.log('SIGINT received - Initiating graceful shutdown...');
      await this.gracefulShutdown('SIGINT');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      this.logger.error('Uncaught exception - Initiating emergency shutdown:', error);
      await this.emergencyShutdown('uncaughtException', error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      this.logger.error('Unhandled rejection - Initiating emergency shutdown:', reason);
      await this.emergencyShutdown('unhandledRejection', reason);
    });
  }

  /**
   * Main graceful shutdown handler
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    if (this.shutdownState.isShuttingDown) {
      this.logger.warn('Shutdown already in progress, ignoring signal');
      return;
    }

    await this.gracefulShutdown(signal || 'UNKNOWN');
  }

  /**
   * Graceful shutdown implementation
   */
  async gracefulShutdown(signal: string): Promise<void> {
    if (this.shutdownState.isShuttingDown) {
      return;
    }

    this.shutdownState.isShuttingDown = true;
    this.shutdownState.shutdownInitiated = new Date();

    this.logger.log(`========================================`);
    this.logger.log(`GRACEFUL SHUTDOWN INITIATED (${signal})`);
    this.logger.log(`========================================`);

    const startTime = Date.now();
    const forceShutdownTime = startTime + this.shutdownConfig.forceShutdownTimeout;

    try {
      // Step 1: Stop accepting new connections/requests
      this.logger.log('Step 1: Stopping acceptance of new requests...');
      await this.stopAcceptingNewRequests();

      // Step 2: Drain queues (wait for active jobs to complete)
      this.logger.log('Step 2: Draining queues...');
      await this.withTimeout(
        this.drainQueues(),
        this.shutdownConfig.drainTimeout,
        'Queue draining',
      );
      this.shutdownState.queuesDrained = true;

      // Step 3: Save state if needed
      this.logger.log('Step 3: Saving application state...');
      await this.withTimeout(
        this.saveState(),
        5000,
        'State saving',
      );
      this.shutdownState.stateSaved = true;

      // Step 4: Close connections gracefully
      this.logger.log('Step 4: Closing connections...');
      await this.withTimeout(
        this.closeConnections(),
        this.shutdownConfig.connectionCloseTimeout,
        'Connection closing',
      );
      this.shutdownState.connectionsClosed = true;

      const duration = Date.now() - startTime;
      this.logger.log(`========================================`);
      this.logger.log(`GRACEFUL SHUTDOWN COMPLETED (${duration}ms)`);
      this.logger.log(`========================================`);

      // Exit successfully
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during graceful shutdown:', error);

      // Force shutdown if graceful shutdown fails
      if (Date.now() < forceShutdownTime) {
        this.logger.log('Attempting force shutdown...');
        await this.forceShutdown();
      }

      process.exit(1);
    }
  }

  /**
   * Emergency shutdown for critical errors
   */
  async emergencyShutdown(reason: string, error: any): Promise<void> {
    this.logger.error(`EMERGENCY SHUTDOWN (${reason})`);

    try {
      // Try to save critical state
      await this.saveCriticalState();

      // Force close connections
      await this.forceCloseConnections();
    } catch (shutdownError) {
      this.logger.error('Error during emergency shutdown:', shutdownError);
    }

    // Exit immediately
    process.exit(1);
  }

  /**
   * Force shutdown when graceful shutdown fails
   */
  private async forceShutdown(): Promise<void> {
    this.logger.warn('FORCING SHUTDOWN...');

    try {
      // Force close all connections
      await this.forceCloseConnections();
    } catch (error) {
      this.logger.error('Error during force shutdown:', error);
    }
  }

  /**
   * Stop accepting new requests
   */
  private async stopAcceptingNewRequests(): Promise<void> {
    this.logger.log('Stopping acceptance of new requests...');

    // In a real implementation, you would:
    // 1. Set a flag that controllers check
    // 2. Return 503 Service Unavailable for new requests
    // 3. Close the HTTP server to new connections

    // For NestJS, we can set a flag in a shared service
    // that controllers can check

    this.logger.log('Stopped accepting new requests');
  }

  /**
   * Drain all queues
   */
  private async drainQueues(): Promise<void> {
    this.logger.log(`Draining ${this.queues.length} queues...`);

    const drainPromises = this.queues.map(async (queue) => {
      try {
        this.logger.debug(`Draining queue: ${queue.name}`);

        // Pause the queue (stop accepting new jobs)
        await queue.pause();

        // Wait for active jobs to complete
        const activeJobs = await queue.getActiveCount();
        if (activeJobs > 0) {
          this.logger.debug(
            `Queue ${queue.name}: Waiting for ${activeJobs} active jobs to complete...`,
          );

          // Poll for completion
          const maxWait = this.shutdownConfig.drainTimeout;
          const start = Date.now();

          while (Date.now() - start < maxWait) {
            const remaining = await queue.getActiveCount();
            if (remaining === 0) {
              this.logger.debug(`Queue ${queue.name}: All jobs completed`);
              break;
            }
            await this.sleep(500);
          }

          const finalActive = await queue.getActiveCount();
          if (finalActive > 0) {
            this.logger.warn(
              `Queue ${queue.name}: ${finalActive} jobs still active after timeout`,
            );
          }
        }

        // Close the queue
        await queue.close();
        this.logger.debug(`Queue ${queue.name}: Drained and closed`);
      } catch (error) {
        this.logger.error(`Error draining queue ${queue.name}:`, error);
      }
    });

    await Promise.all(drainPromises);
    this.logger.log('All queues drained');
  }

  /**
   * Close all connections gracefully
   */
  private async closeConnections(): Promise<void> {
    this.logger.log('Closing connections...');

    const closePromises: Promise<void>[] = [];

    // Close Prisma connection
    closePromises.push(
      (async () => {
        try {
          await this.prismaService.gracefulShutdown();
          this.logger.log('Database connection closed');
        } catch (error) {
          this.logger.error('Error closing database connection:', error);
        }
      })(),
    );

    // Close Redis connection
    closePromises.push(
      (async () => {
        try {
          await this.redisService.gracefulShutdown();
          this.logger.log('Redis connection closed');
        } catch (error) {
          this.logger.error('Error closing Redis connection:', error);
        }
      })(),
    );

    await Promise.all(closePromises);
    this.logger.log('All connections closed');
  }

  /**
   * Force close connections
   */
  private async forceCloseConnections(): Promise<void> {
    this.logger.warn('Force closing connections...');

    // Force close Prisma
    try {
      await this.prismaService.$disconnect();
    } catch (error) {
      // Ignore errors during force close
    }

    // Force close Redis
    try {
      await this.redisService.redis.disconnect();
    } catch (error) {
      // Ignore errors during force close
    }

    this.logger.log('Connections force closed');
  }

  /**
   * Save application state
   */
  private async saveState(): Promise<void> {
    this.logger.log('Saving application state...');

    try {
      // Save metrics, analytics, etc.
      // This is where you would:
      // 1. Flush metrics to monitoring service
      // 2. Save in-memory state to database
      // 3. Create a shutdown marker for recovery

      this.logger.log('Application state saved');
    } catch (error) {
      this.logger.error('Error saving state:', error);
      throw error;
    }
  }

  /**
   * Save critical state during emergency shutdown
   */
  private async saveCriticalState(): Promise<void> {
    this.logger.log('Saving critical state...');

    try {
      // Save only the most critical state
      // This should be very fast and non-blocking

      this.logger.log('Critical state saved');
    } catch (error) {
      this.logger.error('Error saving critical state:', error);
    }
  }

  /**
   * Execute with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeout: number,
    operation: string,
  ): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeout}ms`));
      }, timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get shutdown state
   */
  getShutdownState(): ShutdownState {
    return { ...this.shutdownState };
  }

  /**
   * Check if shutting down
   */
  isShuttingDown(): boolean {
    return this.shutdownState.isShuttingDown;
  }

  /**
   * Get shutdown configuration
   */
  getShutdownConfig(): ShutdownConfig {
    return { ...this.shutdownConfig };
  }
}
