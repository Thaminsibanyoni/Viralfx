import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from "../../redis/redis.service";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: Request) => string; // Custom key generator
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private config: RateLimitConfig;
  private requests = new Map<string, { count: number; resetTime: number }>();

  constructor(private redisService?: RedisService) {
    this.config = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per window
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };
  }

  use(req: Request, res: Response, next: NextFunction) {
    const key = this.config.keyGenerator ? this.config.keyGenerator(req) : this.generateKey(req);
    const now = Date.now();

    // Use Redis for distributed rate limiting if available
    if (this.redisService) {
      this.handleRedisRateLimit(key, now, req, res, next);
    } else {
      this.handleMemoryRateLimit(key, now, req, res, next);
    }
  }

  private generateKey(req: Request): string {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    return `rate-limit:${ip}:${userAgent}`;
  }

  private async handleRedisRateLimit(key: string, now: number, req: Request, res: Response, next: NextFunction) {
    try {
      const current = await this.redisService.get(key);
      const data = current ? JSON.parse(current) : { count: 0, resetTime: now + this.config.windowMs };

      if (now > data.resetTime) {
        data.count = 1;
        data.resetTime = now + this.config.windowMs;
      } else {
        data.count++;
      }

      await this.redisService.setex(key, Math.ceil(this.config.windowMs / 1000), JSON.stringify(data));

      if (data.count > this.config.maxRequests) {
        throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // Fallback to memory rate limiting
      this.handleMemoryRateLimit(key, now, req, res, next);
    }
  }

  private handleMemoryRateLimit(key: string, now: number, req: Request, res: Response, next: NextFunction) {
    const clientData = this.requests.get(key);

    if (!clientData || now > clientData.resetTime) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return next();
    }

    clientData.count++;

    if (clientData.count > this.config.maxRequests) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    next();
  }
}