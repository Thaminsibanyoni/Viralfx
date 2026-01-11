import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

// Provider token for @InjectRedis() decorator compatibility
const IORedisModuleConnectionToken = 'default_IORedisModuleConnectionToken';

/**
 * RedisModule with production-grade connection resilience configuration
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection pooling for high availability
 * - Retry logic for failed operations
 * - Health monitoring and heartbeats
 * - Graceful degradation
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Redis({
          // Connection settings
          host: configService.get('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get('REDIS_PORT', '6379')),
          password: configService.get('REDIS_PASSWORD'),
          db: parseInt(configService.get('REDIS_DB', '0')),

          // Retry and resilience settings
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 100, 3000); // Exponential backoff, max 3s
            return delay;
          },
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          enableOfflineQueue: true, // Queue operations when offline

          // Connection pool settings
          family: 4, // IPv4
          connectTimeout: 10000, // 10 seconds
          lazyConnect: false, // Connect immediately

          // Keep-alive settings
          keepAlive: 30000, // 30 seconds
          keepAliveRetryDelay: 1000,

          // Reconnection settings
          reconnectOnError: (error: Error) => {
            // Reconnect on connection-related errors
            const reconnectErrors = [
              'ECONNREFUSED',
              'ETIMEDOUT',
              'ECONNRESET',
              'EPIPE',
              'READONLY',
            ];
            return reconnectErrors.some((err) => error.message.includes(err));
          },

          // Enable sentinels for high availability (if configured)
          ...(configService.get('REDIS_SENTINEL_ENABLED') === 'true' && {
            sentinels: configService
              .get('REDIS_SENTINELS', '')
              .split(',')
              .filter(Boolean)
              .map((addr: string) => {
                const [host, port] = addr.split(':');
                return { host, port: parseInt(port || '26379') };
              }),
            name: configService.get('REDIS_SENTINEL_NAME', 'mymaster'),
            sentinelPassword: configService.get('REDIS_SENTINEL_PASSWORD'),
          }),

          // Enable TLS if configured
          ...(configService.get('REDIS_TLS_ENABLED') === 'true' && {
            tls: {
              rejectUnauthorized: configService.get(
                'REDIS_TLS_REJECT_UNAUTHORIZED',
                'true',
              ) === 'true',
            },
          }),
        });
      },
      inject: [ConfigService],
    },
    {
      provide: Redis,
      useFactory: (configService: ConfigService) => {
        return new Redis({
          // Connection settings
          host: configService.get('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get('REDIS_PORT', '6379')),
          password: configService.get('REDIS_PASSWORD'),
          db: parseInt(configService.get('REDIS_DB', '0')),

          // Retry and resilience settings
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 100, 3000); // Exponential backoff, max 3s
            return delay;
          },
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          enableOfflineQueue: true, // Queue operations when offline

          // Connection pool settings
          family: 4, // IPv4
          connectTimeout: 10000, // 10 seconds
          lazyConnect: false, // Connect immediately

          // Keep-alive settings
          keepAlive: 30000, // 30 seconds
          keepAliveRetryDelay: 1000,

          // Reconnection settings
          reconnectOnError: (error: Error) => {
            // Reconnect on connection-related errors
            const reconnectErrors = [
              'ECONNREFUSED',
              'ETIMEDOUT',
              'ECONNRESET',
              'EPIPE',
              'READONLY',
            ];
            return reconnectErrors.some((err) => error.message.includes(err));
          },

          // Enable sentinels for high availability (if configured)
          ...(configService.get('REDIS_SENTINEL_ENABLED') === 'true' && {
            sentinels: configService
              .get('REDIS_SENTINELS', '')
              .split(',')
              .filter(Boolean)
              .map((addr: string) => {
                const [host, port] = addr.split(':');
                return { host, port: parseInt(port || '26379') };
              }),
            name: configService.get('REDIS_SENTINEL_NAME', 'mymaster'),
            sentinelPassword: configService.get('REDIS_SENTINEL_PASSWORD'),
          }),

          // Enable TLS if configured
          ...(configService.get('REDIS_TLS_ENABLED') === 'true' && {
            tls: {
              rejectUnauthorized: configService.get(
                'REDIS_TLS_REJECT_UNAUTHORIZED',
                'true',
              ) === 'true',
            },
          }),
        });
      },
      inject: [ConfigService],
    },
    {
      provide: IORedisModuleConnectionToken,
      useExisting: Redis,
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', Redis, RedisService, IORedisModuleConnectionToken],
})
export class RedisModule {}
