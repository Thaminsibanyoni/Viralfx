import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Injectable()
export class RateLimitingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitingMiddleware.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientIp = this.getClientIp(req);
      const userId = this.getUserId(req);

      // Apply rate limiting based on endpoint type
      const endpoint = req.url;
      const limits = this.getRateLimits(endpoint);

      if (limits) {
        // Check IP-based rate limiting
        const ipKey = `rate-limit:ip:${clientIp}:${endpoint}`;
        const ipCount = await this.checkRateLimit(ipKey, limits.ip);

        if (ipCount > limits.ip) {
          this.logger.warn(`IP rate limit exceeded: ${clientIp} for ${endpoint}`);
          res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded from IP address',
            retryAfter: Math.ceil(limits.ipTtl / 1000),
          });
          return;
        }

        // Check user-based rate limiting if user is authenticated
        if (userId) {
          const userKey = `rate-limit:user:${userId}:${endpoint}`;
          const userCount = await this.checkRateLimit(userKey, limits.user);

          if (userCount > limits.user) {
            this.logger.warn(`User rate limit exceeded: ${userId} for ${endpoint}`);
            res.status(429).json({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded for user',
              retryAfter: Math.ceil(limits.userTtl / 1000),
            });
            return;
          }
        }
      }

      // Add rate limiting headers
      res.setHeader('X-RateLimit-Limit', limits?.user || 100);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, (limits?.user || 100) - (await this.getCurrentCount(userId, endpoint))));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + (limits?.userTtl || 60000)).toISOString());

      next();

    } catch (error) {
      this.logger.error('Rate limiting middleware error:', error);
      next(); // Allow request to proceed if rate limiting fails
    }
  }

  private async checkRateLimit(key: string, limit: number): Promise<number> {
    const current = await this.redis.incr(key);

    if (current === 1) {
      // Set expiration on first request
      await this.redis.expire(key, 60); // 1 minute
    }

    return current;
  }

  private async getCurrentCount(userId: string | undefined, endpoint: string): Promise<number> {
    if (!userId) return 0;

    const key = `rate-limit:user:${userId}:${endpoint}`;
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  private getClientIp(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  private getUserId(req: Request): string | undefined {
    // Try to get user ID from JWT token or other auth mechanisms
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // This would need proper JWT decoding in a real implementation
        // For now, just return undefined
        return undefined;
      } catch (error) {
        return undefined;
      }
    }
    return undefined;
  }

  private getRateLimits(endpoint: string): {
    ip: number;
    user: number;
    ipTtl: number;
    userTtl: number;
  } | null {
    // Define rate limits for different endpoint types
    const rateLimits = {
      // WebSocket connection limits
      '/ws': {
        ip: 10, // 10 connections per minute per IP
        user: 5, // 5 connections per minute per user
        ipTtl: 60000,
        userTtl: 60000,
      },
      // Order placement limits
      '/api/orders': {
        ip: 100, // 100 requests per minute per IP
        user: 50, // 50 requests per minute per user
        ipTtl: 60000,
        userTtl: 60000,
      },
      // Market data limits
      '/api/market': {
        ip: 1000, // 1000 requests per minute per IP
        user: 500, // 500 requests per minute per user
        ipTtl: 60000,
        userTtl: 60000,
      },
      // General API limits
      '/api/': {
        ip: 200, // 200 requests per minute per IP
        user: 100, // 100 requests per minute per user
        ipTtl: 60000,
        userTtl: 60000,
      },
    };

    for (const [path, limits] of Object.entries(rateLimits)) {
      if (endpoint.startsWith(path)) {
        return limits;
      }
    }

    // Default limits
    return {
      ip: 100,
      user: 50,
      ipTtl: 60000,
      userTtl: 60000,
    };
  }
}

// WebSocket-specific rate limiting
export class WsRateLimitingMiddleware {
  private readonly logger = new Logger(WsRateLimitingMiddleware.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async checkConnectionLimit(clientId: string, userId?: string): Promise<boolean> {
    try {
      // Check total connections per IP
      const ipKey = `ws:connections:total:${clientId}`;
      const totalConnections = await this.redis.incr(ipKey);

      if (totalConnections === 1) {
        await this.redis.expire(ipKey, 60); // 1 minute
      }

      if (totalConnections > 10) { // Max 10 connections per minute per client
        this.logger.warn(`Connection limit exceeded for client: ${clientId}`);
        return false;
      }

      // Check authenticated user connections
      if (userId) {
        const userKey = `ws:connections:user:${userId}`;
        const userConnections = await this.redis.incr(userKey);

        if (userConnections === 1) {
          await this.redis.expire(userKey, 60);
        }

        if (userConnections > 5) { // Max 5 connections per user
          this.logger.warn(`User connection limit exceeded: ${userId}`);
          return false;
        }
      }

      return true;

    } catch (error) {
      this.logger.error('WebSocket rate limiting error:', error);
      return true; // Allow connection if rate limiting fails
    }
  }

  async checkMessageRate(clientId: string, userId?: string): Promise<boolean> {
    try {
      const now = Date.now();
      const windowStart = now - 60000; // 1 minute window

      // Check message rate for client
      const clientKey = `ws:messages:client:${clientId}`;
      const clientMessages = await this.redis.zremrangebyscore(clientKey, '-inf', windowStart);
      const clientCount = await this.redis.zcard(clientKey);

      if (clientCount > 100) { // Max 100 messages per minute per client
        this.logger.warn(`Message rate limit exceeded for client: ${clientId}`);
        return false;
      }

      // Check message rate for authenticated user
      if (userId) {
        const userKey = `ws:messages:user:${userId}`;
        const userMessages = await this.redis.zremrangebyscore(userKey, '-inf', windowStart);
        const userCount = await this.redis.zcard(userKey);

        if (userCount > 60) { // Max 60 messages per minute per user
          this.logger.warn(`User message rate limit exceeded: ${userId}`);
          return false;
        }

        // Add current message to user rate limit
        await this.redis.zadd(userKey, now, `${now}-${Math.random()}`);
        await this.redis.expire(userKey, 60);
      }

      // Add current message to client rate limit
      await this.redis.zadd(clientKey, now, `${now}-${Math.random()}`);
      await this.redis.expire(clientKey, 60);

      return true;

    } catch (error) {
      this.logger.error('WebSocket message rate limiting error:', error);
      return true; // Allow message if rate limiting fails
    }
  }

  async checkSubscriptionLimit(clientId: string, subscriptionType: string, userId?: string): Promise<boolean> {
    try {
      const key = userId
        ? `ws:subscriptions:user:${userId}:${subscriptionType}`
        : `ws:subscriptions:client:${clientId}:${subscriptionType}`;

      const count = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.expire(key, 60); // 1 minute
      }

      const limits = {
        trends: 50, // Max 50 trend subscriptions
        orders: 1,  // Max 1 order subscription (user's own orders)
        wallets: 1, // Max 1 wallet subscription (user's own wallets)
        notifications: 1, // Max 1 notification subscription
        marketData: 100, // Max 100 market data subscriptions
      };

      const limit = limits[subscriptionType] || 10;

      if (count > limit) {
        this.logger.warn(`Subscription limit exceeded: ${subscriptionType} for ${userId || clientId}`);
        return false;
      }

      return true;

    } catch (error) {
      this.logger.error('WebSocket subscription rate limiting error:', error);
      return true; // Allow subscription if rate limiting fails
    }
  }
}