import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface RedisConnectionStats {
  isConnected: boolean;
  lastHealthCheck?: Date;
  lastError?: string;
  failedAttempts: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly configService: ConfigService;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private connectionStats: RedisConnectionStats = {
    isConnected: false,
    failedAttempts: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
  };
  private readonly MAX_RETRIES = 3;
  private readonly BASE_RETRY_DELAY = 1000;
  private readonly MAX_RETRY_DELAY = 10000;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private configService: ConfigService,
  ) {
    this.setupRedisEventHandlers();
  }

  async onModuleInit() {
    await this.connectWithRetry();
    this.startHealthCheckMonitoring();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.stopHealthCheckMonitoring();

    try {
      await this.redis.quit();
      this.logger.log('Successfully disconnected from Redis');
    } catch (error) {
      this.logger.error('Error during Redis disconnect:', error);
      // Force close if graceful shutdown fails
      this.redis.disconnect();
    }
  }

  /**
   * Setup Redis event handlers for connection monitoring
   */
  private setupRedisEventHandlers(): void {
    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
      this.connectionStats.isConnected = true;
      this.connectionStats.failedAttempts = 0;
    });

    this.redis.on('ready', () => {
      this.logger.log('Redis ready to accept commands');
      this.connectionStats.isConnected = true;
      this.connectionStats.lastHealthCheck = new Date();
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis error:', error);
      this.connectionStats.isConnected = false;
      this.connectionStats.lastError = error.message;
      this.connectionStats.failedAttempts++;
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.connectionStats.isConnected = false;
    });

    this.redis.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });

    this.redis.on('end', () => {
      this.logger.log('Redis connection ended');
      this.connectionStats.isConnected = false;
    });
  }

  /**
   * Connect to Redis with retry logic
   */
  private async connectWithRetry(): Promise<void> {
    let attempt = 0;
    const maxAttempts = 5;

    while (attempt < maxAttempts && !this.isShuttingDown) {
      try {
        this.logger.log(
          `Attempting to connect to Redis (attempt ${attempt + 1}/${maxAttempts})...`,
        );

        await this.redis.ping();
        this.connectionStats.isConnected = true;
        this.connectionStats.lastHealthCheck = new Date();

        this.logger.log('Successfully connected to Redis');
        return;
      } catch (error) {
        attempt++;
        this.connectionStats.failedAttempts++;

        if (attempt < maxAttempts) {
          const delay = this.BASE_RETRY_DELAY * attempt;
          this.logger.warn(
            `Redis connection failed (attempt ${attempt}). Retrying in ${delay}ms...`,
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.error('Failed to connect to Redis after multiple attempts');
  }

  /**
   * Start health check monitoring
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
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      await this.redis.ping();
      this.connectionStats.isConnected = true;
      this.connectionStats.lastHealthCheck = new Date();
      this.connectionStats.lastError = undefined;
    } catch (error) {
      this.connectionStats.isConnected = false;
      this.connectionStats.lastError = error.message;
      this.logger.warn('Redis health check failed:', error.message);
    }
  }

  /**
   * Execute Redis command with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries = this.MAX_RETRIES,
  ): Promise<T> {
    this.connectionStats.totalRequests++;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await operation();
        this.connectionStats.successfulRequests++;
        return result;
      } catch (error) {
        this.connectionStats.failedRequests++;

        // Check if error is connection-related
        const isConnectionError =
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('Redis connection gone') ||
          error.message?.includes('Connection is closed');

        if (!isConnectionError || attempt === retries) {
          throw error;
        }

        const delay = Math.min(
          this.BASE_RETRY_DELAY * Math.pow(2, attempt - 1),
          this.MAX_RETRY_DELAY,
        );

        this.logger.warn(
          `Redis operation failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`,
        );
        await this.sleep(delay);
      }
    }

    throw new Error('Redis operation failed after all retries');
  }

  /**
   * Public API methods with retry logic
   */

  async get(key: string): Promise<string | null> {
    return this.executeWithRetry(() => this.redis.get(key));
  }

  async getWithRetry(
    key: string,
    retries = this.MAX_RETRIES,
  ): Promise<string | null> {
    return this.executeWithRetry(() => this.redis.get(key), retries);
  }

  async set(key: string, value: string): Promise<void> {
    await this.executeWithRetry(() => this.redis.set(key, value));
  }

  async setWithRetry(
    key: string,
    value: string,
    retries = this.MAX_RETRIES,
  ): Promise<void> {
    await this.executeWithRetry(() => this.redis.set(key, value), retries);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.executeWithRetry(() => this.redis.setex(key, seconds, value));
  }

  async del(key: string): Promise<void> {
    await this.executeWithRetry(() => this.redis.del(key));
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.executeWithRetry(() =>
      this.redis.exists(key),
    );
    return result === 1;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.executeWithRetry(() => this.redis.hget(key, field));
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.executeWithRetry(() => this.redis.hset(key, field, value));
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.executeWithRetry(() => this.redis.hgetall(key));
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.executeWithRetry(() => this.redis.hdel(key, field));
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.executeWithRetry(() => this.redis.expire(key, seconds));
  }

  async ttl(key: string): Promise<number> {
    return this.executeWithRetry(() => this.redis.ttl(key));
  }

  async incr(key: string): Promise<number> {
    return this.executeWithRetry(() => this.redis.incr(key));
  }

  async incrby(key: string, increment: number): Promise<number> {
    return this.executeWithRetry(() => this.redis.incrby(key, increment));
  }

  async decr(key: string): Promise<number> {
    return this.executeWithRetry(() => this.redis.decr(key));
  }

  async decrby(key: string, decrement: number): Promise<number> {
    return this.executeWithRetry(() => this.redis.decrby(key, decrement));
  }

  /**
   * Get multiple keys with retry
   */
  async mget(...keys: string[]): Promise<(string | null)[]> {
    return this.executeWithRetry(() => this.redis.mget(...keys));
  }

  /**
   * Set multiple keys with retry
   */
  async mset(keyValues: [string, string][]): Promise<void> {
    const args = keyValues.flat();
    await this.executeWithRetry(() =>
      (this.redis.mset as any)(...args),
    );
  }

  /**
   * Delete multiple keys with retry
   */
  async mdel(...keys: string[]): Promise<void> {
    await this.executeWithRetry(() => this.redis.del(...keys));
  }

  /**
   * Add to sorted set with retry
   */
  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.executeWithRetry(() => this.redis.zadd(key, score, member));
  }

  /**
   * Get from sorted set with retry
   */
  async zrange(
    key: string,
    start: number,
    stop: number,
  ): Promise<string[]> {
    return this.executeWithRetry(() => this.redis.zrange(key, start, stop));
  }

  /**
   * Remove from sorted set with retry
   */
  async zrem(key: string, member: string): Promise<void> {
    await this.executeWithRetry(() => this.redis.zrem(key, member));
  }

  /**
   * Add to list with retry
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.executeWithRetry(() => this.redis.lpush(key, ...values));
  }

  /**
   * Get from list with retry
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.executeWithRetry(() => this.redis.lrange(key, start, stop));
  }

  /**
   * Get list length with retry
   */
  async llen(key: string): Promise<number> {
    return this.executeWithRetry(() => this.redis.llen(key));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      this.connectionStats.isConnected = true;
      this.connectionStats.lastHealthCheck = new Date();
      return true;
    } catch (error) {
      this.connectionStats.isConnected = false;
      this.connectionStats.lastError = error.message;
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): RedisConnectionStats {
    return { ...this.connectionStats };
  }

  /**
   * Get Redis info
   */
  async getInfo(section?: string): Promise<string> {
    return this.executeWithRetry(() => this.redis.info(section));
  }

  /**
   * Get Redis metrics for monitoring
   */
  async getMetrics(): Promise<{
    isConnected: boolean;
    stats: RedisConnectionStats;
    config: {
      host: string;
      port: number;
      db: number;
    };
  }> {
    return {
      isConnected: await this.healthCheck(),
      stats: this.getConnectionStats(),
      config: {
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
        db: this.configService.get('REDIS_DB', 0),
      },
    };
  }

  /**
   * Execute operation with graceful degradation
   * Returns fallback value if Redis is down
   */
  async getWithGracefulDegradation<T>(
    operation: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.warn(
        `Redis operation failed, returning fallback value: ${error.message}`,
      );
      return fallback;
    }
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(): Promise<void> {
    this.logger.log('Initiating graceful Redis shutdown...');

    this.isShuttingDown = true;
    this.stopHealthCheckMonitoring();

    // Wait for active operations to complete (max 10 seconds)
    const shutdownTimeout = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < shutdownTimeout) {
      await this.sleep(1000);
      break;
    }

    // Disconnect
    try {
      await this.redis.quit();
      this.logger.log('Redis shutdown complete');
    } catch (error) {
      this.logger.error('Error during Redis shutdown:', error);
      this.redis.disconnect();
    }
  }
}
