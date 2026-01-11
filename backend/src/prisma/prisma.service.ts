import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  failedConnections: number;
  lastHealthCheck?: Date;
  lastError?: string;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly configService: ConfigService;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private connectionStats: ConnectionPoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    failedConnections: 0,
  };
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 5000; // 5 seconds

  constructor(configService: ConfigService) {
    const connectionUrl = configService.get<string>('DATABASE_URL');
    const poolMin = configService.get<number>('database.poolMin', 2);
    const poolMax = configService.get<number>('database.poolMax', 10);
    const connectionTimeout = configService.get<number>(
      'database.connectionTimeout',
      30000,
    );

    super({
      datasources: {
        db: {
          url: connectionUrl,
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    this.configService = configService;

    // Set up Prisma event listeners for monitoring
    this.setupEventListeners();
  }

  /**
   * Initialize database connection with retry logic
   */
  async onModuleInit() {
    await this.connectWithRetry();
    this.startHealthCheckMonitoring();
  }

  /**
   * Connect to database with retry logic
   */
  private async connectWithRetry(): Promise<void> {
    let attempt = 0;
    let lastError: any;

    while (attempt < this.MAX_RECONNECT_ATTEMPTS && !this.isShuttingDown) {
      try {
        this.logger.log(
          `Attempting to connect to database (attempt ${attempt + 1}/${this.MAX_RECONNECT_ATTEMPTS})...`,
        );

        await this.$connect();

        this.connectionStats.lastHealthCheck = new Date();
        this.logger.log(
          `Successfully connected to Prisma database | Pool: ${this.configService.get('database.poolMin', 2)}-${this.configService.get('database.poolMax', 10)} connections`,
        );

        // Run a warmup query
        await this.runHeartbeat();

        return;
      } catch (error) {
        lastError = error;
        attempt++;
        this.connectionStats.failedConnections++;

        if (attempt < this.MAX_RECONNECT_ATTEMPTS) {
          const delay = this.RECONNECT_DELAY * attempt; // Exponential backoff
          this.logger.warn(
            `Database connection failed (attempt ${attempt}). Retrying in ${delay}ms...`,
          );
          await this.sleep(delay);
        }
      }
    }

    throw new InternalServerErrorException(
      `Failed to connect to database after ${this.MAX_RECONNECT_ATTEMPTS} attempts: ${lastError.message}`,
    );
  }

  /**
   * Disconnect gracefully from database
   */
  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.stopHealthCheckMonitoring();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      await this.$disconnect();
      this.logger.log('Successfully disconnected from Prisma database');
    } catch (error) {
      this.logger.error('Error during database disconnect:', error);
    }
  }

  /**
   * Setup Prisma event listeners for monitoring
   */
  private setupEventListeners(): void {
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';

    // Query logging for performance monitoring
    this.$on('query' as any, (event: any) => {
      if (isDevelopment) {
        this.logger.debug(`Query: ${event.query}`);
        this.logger.debug(`Params: ${event.params}`);
        this.logger.debug(`Duration: ${event.duration}ms`);
      }

      // Log slow queries (threshold: 1000ms)
      if (event.duration > 1000) {
        this.logger.warn(
          `Slow query detected (${event.duration}ms): ${event.query}`,
        );
      }
    });

    // Error logging
    this.$on('error' as any, (event: any) => {
      this.logger.error(`Prisma error: ${event.message}`, event.target);
      this.connectionStats.lastError = event.message;
    });

    // Info logging
    this.$on('info' as any, (event: any) => {
      this.logger.log(`Prisma info: ${event.message}`);
    });

    // Warning logging
    this.$on('warn' as any, (event: any) => {
      this.logger.warn(`Prisma warning: ${event.message}`);
    });
  }

  /**
   * Start periodic health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.performHealthCheck();
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheckMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check and auto-reconnect if needed
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const isHealthy = await this.healthCheckInternal();

      if (!isHealthy && !this.isShuttingDown) {
        this.logger.warn('Database health check failed, attempting reconnection...');
        await this.handleConnectionLoss();
      }
    } catch (error) {
      this.logger.error('Health check monitoring error:', error);
    }
  }

  /**
   * Handle connection loss with graceful reconnection
   */
  private async handleConnectionLoss(): Promise<void> {
    try {
      await this.$disconnect();
      await this.connectWithRetry();
    } catch (error) {
      this.logger.error('Failed to reconnect to database:', error);

      // Schedule reconnection attempt
      if (!this.isShuttingDown) {
        this.reconnectTimeout = setTimeout(async () => {
          await this.handleConnectionLoss();
        }, this.RECONNECT_DELAY);
      }
    }
  }

  /**
   * Run heartbeat query to verify connection
   */
  async runHeartbeat(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database heartbeat failed:', error);
      return false;
    }
  }

  /**
   * Internal health check implementation
   */
  private async healthCheckInternal(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.connectionStats.lastHealthCheck = new Date();
      this.connectionStats.lastError = undefined;
      return true;
    } catch (error) {
      this.connectionStats.lastError = error.message;
      return false;
    }
  }

  /**
   * Public health check endpoint
   */
  async healthCheck(): Promise<boolean> {
    return this.healthCheckInternal();
  }

  /**
   * Get detailed connection statistics
   */
  getConnectionStats(): ConnectionPoolStats {
    return { ...this.connectionStats };
  }

  /**
   * Get database metrics for monitoring
   */
  async getMetrics(): Promise<{
    isConnected: boolean;
    stats: ConnectionPoolStats;
    poolConfig: {
      min: number;
      max: number;
      timeout: number;
    };
  }> {
    return {
      isConnected: await this.healthCheck(),
      stats: this.getConnectionStats(),
      poolConfig: {
        min: this.configService.get('database.poolMin', 2),
        max: this.configService.get('database.poolMax', 10),
        timeout: this.configService.get('database.connectionTimeout', 30000),
      },
    };
  }

  /**
   * Execute a database operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if error is connection-related
        const isConnectionError =
          error.code === 'P1001' || // Connection timeout
          error.code === 'P1003' || // Connection error
          error.code === 'P1008' || // Connection timeout
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT';

        if (!isConnectionError || attempt === maxAttempts) {
          throw error;
        }

        const delay = 1000 * attempt; // Linear backoff
        this.logger.warn(
          `Database operation failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clean shutdown for graceful termination
   */
  async gracefulShutdown(): Promise<void> {
    this.logger.log('Initiating graceful database shutdown...');

    // Stop accepting new operations
    this.isShuttingDown = true;
    this.stopHealthCheckMonitoring();

    // Wait for active connections to complete (max 30 seconds)
    const shutdownTimeout = 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < shutdownTimeout) {
      // In a real scenario, you'd check active connection count
      // For now, just wait a brief moment
      await this.sleep(1000);
      break;
    }

    // Disconnect
    await this.$disconnect();
    this.logger.log('Database shutdown complete');
  }
}
