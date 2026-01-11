import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

@Injectable()
export class ThrottleGuard implements CanActivate {
  private rateLimits = new Map<string, RateLimitInfo>();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.getClientKey(request);
    const rateLimit = this.getRateLimit(context);

    if (!rateLimit) {
      return true;
    }

    const currentTime = Date.now();
    const limitInfo = this.rateLimits.get(key);

    if (!limitInfo || currentTime > limitInfo.resetTime) {
      // Reset the rate limit
      this.rateLimits.set(key, {
        count: 1,
        resetTime: currentTime + rateLimit.windowMs,
      });
      return true;
    }

    if (limitInfo.count >= rateLimit.max) {
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS);
    }

    // Increment the count
    limitInfo.count++;
    return true;
  }

  private getClientKey(request: Request): string {
    return request.ip || 'unknown';
  }

  private getRateLimit(context: ExecutionContext): { max: number; windowMs: number } | null {
    const rateLimit = this.reflector.get<{ max: number; windowMs: number }>(
      'throttle',
      context.getHandler());

    return rateLimit || null;
  }
}