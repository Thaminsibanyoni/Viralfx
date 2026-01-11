import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Broker, BrokerTier } from '@prisma/client';

export interface BrokerRateLimitRequest extends Request {
  broker?: Broker;
}

@Injectable()
export class BrokerRateLimitMiddleware implements NestMiddleware {
  private redis: Redis;
  private readonly rateLimits: Record<BrokerTier, { requests: number; window: number }>;
  private readonly logger = new Logger(BrokerRateLimitMiddleware.name);

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD')
    });

    // Define rate limits by broker tier
    this.rateLimits = {
      [BrokerTier.STARTER]: {
        requests: 100, // 100 requests per minute
        window: 60 * 1000 // 1 minute
      },
      [BrokerTier.VERIFIED]: {
        requests: 500, // 500 requests per minute
        window: 60 * 1000 // 1 minute
      },
      [BrokerTier.PREMIUM]: {
        requests: 2000, // 2000 requests per minute
        window: 60 * 1000 // 1 minute
      },
      [BrokerTier.ENTERPRISE]: {
        requests: -1, // Unlimited
        window: 60 * 1000 // 1 minute
      }
    };
  }

  async use(req: BrokerRateLimitRequest, res: Response, next: NextFunction) {
    try {
      // Skip rate limiting for non-broker requests
      if (!req.broker) {
        // Log warning for debugging
        this.logger.warn('Rate limiting skipped: req.broker not found. Ensure BrokerAuthGuard is applied before this middleware.');
        return next();
      }

      const broker = req.broker;
      const rateLimitConfig = this.rateLimits[broker.tier] || this.rateLimits[BrokerTier.STARTER];

      // Skip rate limiting for enterprise tier (unlimited)
      if (rateLimitConfig.requests === -1) {
        this.addRateLimitHeaders(res, -1, -1);
        return next();
      }

      const clientIp = this.getClientIp(req);
      const key = this.getRateLimitKey(broker.id, clientIp);

      // Get current count
      const currentCount = await this.redis.incr(key);

      // Set expiry on first request in window
      if (currentCount === 1) {
        await this.redis.expire(key, Math.ceil(rateLimitConfig.window / 1000));
      }

      // Calculate remaining requests
      const remaining = Math.max(0, rateLimitConfig.requests - currentCount);
      const resetTime = await this.redis.pttl(key);

      // Add rate limit headers
      this.addRateLimitHeaders(res, rateLimitConfig.requests, remaining, resetTime);

      // Check if rate limit exceeded
      if (currentCount > rateLimitConfig.requests) {
        // Log rate limit violation
        await this.logRateLimitViolation(broker, clientIp, req.path, req.method);

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded',
            error: 'Too Many Requests',
            details: {
              limit: rateLimitConfig.requests,
              windowMs: rateLimitConfig.window,
              retryAfter: Math.ceil(resetTime / 1000)
            }
          },
          HttpStatus.TOO_MANY_REQUESTS);
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Log Redis error but don't block request
      this.logger.error('Rate limiting error:', error.stack || error.message);
      next();
    }
  }

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const remoteAddress = req.socket.remoteAddress;

    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    if (realIp) {
      return realIp;
    }

    return remoteAddress || '127.0.0.1';
  }

  private getRateLimitKey(brokerId: string, clientIp: string): string {
    return `rate_limit:broker:${brokerId}:${clientIp}`;
  }

  private addRateLimitHeaders(
    res: Response,
    limit: number,
    remaining: number,
    resetTime?: number): void {
    if (limit === -1) {
      res.setHeader('X-RateLimit-Limit', 'unlimited');
      res.setHeader('X-RateLimit-Remaining', 'unlimited');
    } else {
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
    }

    if (resetTime && resetTime > 0) {
      const resetTimestamp = Date.now() + resetTime;
      res.setHeader('X-RateLimit-Reset', new Date(resetTimestamp).toISOString());
      res.setHeader('Retry-After', Math.ceil(resetTime / 1000));
    }
  }

  private async logRateLimitViolation(
    broker: Broker,
    clientIp: string,
    path: string,
    method: string): Promise<void> {
    try {
      const violationLog = {
        brokerId: broker.id,
        brokerName: broker.companyName,
        clientIp,
        path,
        method,
        tier: broker.tier,
        timestamp: new Date().toISOString()
      };

      // Log to Redis for monitoring
      await this.redis.lpush('rate_limit_violations', JSON.stringify(violationLog));
      await this.redis.expire('rate_limit_violations', 24 * 60 * 60); // Keep for 24 hours

      // Trim the list to prevent unlimited growth
      await this.redis.ltrim('rate_limit_violations', 0, 999);

      this.logger.warn('Rate limit violation:', violationLog);
    } catch (error) {
      this.logger.error('Failed to log rate limit violation:', error.stack || error.message);
    }
  }

  // Method to get current rate limit stats for a broker
  async getRateLimitStats(brokerId: string, clientIp: string): Promise<any> {
    try {
      const key = this.getRateLimitKey(brokerId, clientIp);
      const currentCount = await this.redis.get(key);
      const resetTime = await this.redis.pttl(key);

      const broker = await this.getBrokerById(brokerId); // This would need to be injected or passed
      const rateLimitConfig = this.rateLimits[broker?.tier] || this.rateLimits[BrokerTier.STARTER];

      return {
        currentCount: parseInt(currentCount || '0'),
        limit: rateLimitConfig.requests,
        windowMs: rateLimitConfig.window,
        remaining: Math.max(0, rateLimitConfig.requests - parseInt(currentCount || '0')),
        resetTime: resetTime > 0 ? Date.now() + resetTime : null,
        isUnlimited: rateLimitConfig.requests === -1
      };
    } catch (error) {
      throw new Error('Failed to get rate limit stats');
    }
  }

  // Method to reset rate limit for a broker (admin function)
  async resetRateLimit(brokerId: string, clientIp?: string): Promise<void> {
    try {
      if (clientIp) {
        // Reset for specific IP
        const key = this.getRateLimitKey(brokerId, clientIp);
        await this.redis.del(key);
      } else {
        // Reset all IPs for broker
        const pattern = `rate_limit:broker:${brokerId}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (error) {
      throw new Error('Failed to reset rate limit');
    }
  }

  // Method to get violation stats
  async getViolationStats(hours: number = 24): Promise<any> {
    try {
      const violations = await this.redis.lrange('rate_limit_violations', 0, -1);
      const now = Date.now();
      const cutoffTime = now - (hours * 60 * 60 * 1000);

      const recentViolations = violations
        .map(v => JSON.parse(v))
        .filter(v => new Date(v.timestamp).getTime() > cutoffTime);

      const violationsByBroker = recentViolations.reduce((acc, v) => {
        acc[v.brokerId] = (acc[v.brokerId] || 0) + 1;
        return acc;
      }, {});

      const violationsByIp = recentViolations.reduce((acc, v) => {
        acc[v.clientIp] = (acc[v.clientIp] || 0) + 1;
        return acc;
      }, {});

      const violationsByTier = recentViolations.reduce((acc, v) => {
        acc[v.tier] = (acc[v.tier] || 0) + 1;
        return acc;
      }, {});

      return {
        totalViolations: recentViolations.length,
        period: `${hours} hours`,
        violationsByBroker,
        violationsByIp,
        violationsByTier,
        topViolators: Object.entries(violationsByBroker)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([brokerId, count]) => ({ brokerId, count }))
      };
    } catch (error) {
      throw new Error('Failed to get violation stats');
    }
  }

  // Helper method (would be properly injected in real implementation)
  private async getBrokerById(brokerId: string): Promise<Broker | null> {
    // This would use the broker service
    return null;
  }
}
