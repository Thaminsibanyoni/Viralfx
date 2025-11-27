import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { RateLimitResult } from '../interfaces/api-marketplace.interface';

@Injectable()
export class RateLimitService {
  private readonly DEFAULT_WINDOW_MS = 60000; // 1 minute
  private readonly BURST_WINDOW_MS = 10000; // 10 seconds

  constructor(private redis: RedisService) {}

  async checkLimit(
    apiKeyId: string,
    limits: {
      rateLimit: number;
      burstLimit?: number;
    },
    windowMs: number = this.DEFAULT_WINDOW_MS,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use Redis sorted set for sliding window
    const key = `ratelimit:sliding:${apiKeyId}`;
    const pipeline = this.redis.pipeline();

    // Remove old entries
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // Count requests in window
    pipeline.zcard(key);

    // Set expiration
    pipeline.expire(key, Math.ceil(windowMs / 1000) + 10);

    const results = await pipeline.exec();
    const count = results?.[2]?.[1] as number || 0;

    const allowed = count <= limits.rateLimit;
    const remaining = Math.max(0, limits.rateLimit - count);
    const resetAt = new Date(now + windowMs);

    // Check burst limit if configured
    if (limits.burstLimit && allowed) {
      const burstResult = await this.checkBurstLimit(apiKeyId, limits.burstLimit);
      if (!burstResult.allowed) {
        return burstResult;
      }
    }

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil(windowMs / 1000),
    };
  }

  async checkBurstLimit(
    apiKeyId: string,
    burstLimit: number,
    windowMs: number = this.BURST_WINDOW_MS,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    const key = `ratelimit:burst:${apiKeyId}`;
    const pipeline = this.redis.pipeline();

    // Remove old entries
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // Count requests in burst window
    pipeline.zcard(key);

    // Set expiration
    pipeline.expire(key, Math.ceil(windowMs / 1000) + 5);

    const results = await pipeline.exec();
    const count = results?.[2]?.[1] as number || 0;

    const allowed = count <= burstLimit;
    const remaining = Math.max(0, burstLimit - count);
    const resetAt = new Date(now + windowMs);

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil(windowMs / 1000),
    };
  }

  async incrementCounter(apiKeyId: string): Promise<void> {
    const now = Date.now();
    const key = `ratelimit:sliding:${apiKeyId}`;

    // Add to both sliding window and simple counter
    await Promise.all([
      this.redis.zadd(key, now, `${now}-${Math.random()}`),
      this.redis.incr(`ratelimit:counter:${apiKeyId}`),
    ]);

    // Set expiration for counter (24 hours)
    this.redis.expire(`ratelimit:counter:${apiKeyId}`, 86400);
    // Set expiration for sliding window set (2 hours to be safe)
    this.redis.expire(key, 7200);
  }

  async getRemainingQuota(
    apiKeyId: string,
    plan: {
      quota?: number;
      rateLimit: number;
      burstLimit?: number;
    },
  ): Promise<number> {
    if (!plan.quota) {
      return Infinity; // Unlimited quota
    }

    // Get current usage from simple counter
    const usage = await this.redis.get(`ratelimit:counter:${apiKeyId}`);
    const currentUsage = parseInt(usage || '0', 10);

    return Math.max(0, plan.quota - currentUsage);
  }

  async resetMonthlyQuota(apiKeyId: string): Promise<void> {
    // Clear all rate limit counters for the API key
    const patterns = [
      `ratelimit:*:${apiKeyId}`,
      `ratelimit:sliding:${apiKeyId}`,
      `ratelimit:burst:${apiKeyId}`,
      `ratelimit:counter:${apiKeyId}`,
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  async getGlobalRateLimit(): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    const GLOBAL_LIMIT = 10000; // 10K requests per minute globally
    const key = 'ratelimit:global';
    const now = Date.now();
    const windowStart = now - this.DEFAULT_WINDOW_MS;

    const pipeline = this.redis.pipeline();

    // Remove old entries
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // Count requests
    pipeline.zcard(key);

    // Set expiration
    pipeline.expire(key, Math.ceil(this.DEFAULT_WINDOW_MS / 1000) + 10);

    const results = await pipeline.exec();
    const count = results?.[2]?.[1] as number || 0;

    const allowed = count <= GLOBAL_LIMIT;
    const remaining = Math.max(0, GLOBAL_LIMIT - count);
    const resetAt = new Date(now + this.DEFAULT_WINDOW_MS);

    return {
      allowed,
      remaining,
      resetAt,
    };
  }

  async checkEndpointRateLimit(
    apiKeyId: string,
    endpoint: string,
    limit: number,
    windowMs: number = this.DEFAULT_WINDOW_MS,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const key = `ratelimit:endpoint:${apiKeyId}:${endpoint}`;

    const pipeline = this.redis.pipeline();

    // Remove old entries
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // Count requests
    pipeline.zcard(key);

    // Set expiration
    pipeline.expire(key, Math.ceil(windowMs / 1000) + 10);

    const results = await pipeline.exec();
    const count = results?.[2]?.[1] as number || 0;

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetAt = new Date(now + windowMs);

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil(windowMs / 1000),
    };
  }

  async getRateLimitStats(apiKeyId: string): Promise<{
    currentMinute: number;
    currentHour: number;
    currentDay: number;
    endpoints: Record<string, number>;
  }> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    const key = `ratelimit:sliding:${apiKeyId}`;

    const [minute, hour, day] = await Promise.all([
      this.redis.zcount(key, oneMinuteAgo, now),
      this.redis.zcount(key, oneHourAgo, now),
      this.redis.zcount(key, oneDayAgo, now),
    ]);

    // Get endpoint breakdown
    const endpointKeys = await this.redis.keys(`ratelimit:endpoint:${apiKeyId}:*`);
    const endpoints: Record<string, number> = {};

    for (const endpointKey of endpointKeys) {
      const endpoint = endpointKey.split(':').slice(3).join(':');
      const count = await this.redis.zcount(endpointKey, oneMinuteAgo, now);
      if (count > 0) {
        endpoints[endpoint] = count;
      }
    }

    return {
      currentMinute: minute,
      currentHour: hour,
      currentDay: day,
      endpoints,
    };
  }
}