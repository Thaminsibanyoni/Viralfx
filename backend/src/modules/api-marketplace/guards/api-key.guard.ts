import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KeysService } from '../services/keys.service';
import { RateLimitService } from '../services/rate-limit.service';
import { API_USAGE_TAG } from '../interceptors/api-usage.interceptor';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private keysService: KeysService,
    private rateLimitService: RateLimitService,
    private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Skip API key validation for certain routes (e.g., health checks, public docs)
    const isPublicRoute = this.reflector.get<boolean>('public', context.getHandler());
    if (isPublicRoute) {
      return true;
    }

    // Extract API key from header or query parameter
    const apiKey = this.extractApiKey(request);
    if (!apiKey) {
      throw new ForbiddenException({
        error: 'API key required',
        message: 'Please provide an API key via x-api-key header or api_key query parameter',
        code: 'API_KEY_REQUIRED'
      });
    }

    // Validate API key
    const keyData = await this.keysService.validateKey(apiKey);
    if (!keyData) {
      throw new ForbiddenException({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or has been revoked',
        code: 'INVALID_API_KEY'
      });
    }

    // Check if key is active
    if (keyData.revoked) {
      throw new ForbiddenException({
        error: 'API key revoked',
        message: 'This API key has been revoked',
        code: 'API_KEY_REVOKED'
      });
    }

    // Check expiration
    if (keyData.expiresAt && keyData.expiresAt < new Date()) {
      throw new ForbiddenException({
        error: 'API key expired',
        message: 'This API key has expired',
        code: 'API_KEY_EXPIRED'
      });
    }

    // Validate IP whitelist if configured
    if (keyData.ipWhitelist && keyData.ipWhitelist.length > 0) {
      const clientIp = this.getClientIp(request);
      const isAllowed = await this.keysService.validateIpWhitelist(keyData, clientIp);

      if (!isAllowed) {
        throw new ForbiddenException({
          error: 'IP not allowed',
          message: `IP address ${clientIp} is not in the whitelist`,
          code: 'IP_NOT_ALLOWED'
        });
      }
    }

    // Check rate limits
    const rateLimitResult = await this.keysService.checkRateLimit(keyData.id);
    if (!rateLimitResult.allowed) {
      // Set rate limit headers
      response.set({
        'X-RateLimit-Limit': keyData.plan.rateLimit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetAt.getTime() / 1000).toString(),
        'Retry-After': rateLimitResult.retryAfter?.toString()
      });

      throw new ForbiddenException({
        error: 'Rate limit exceeded',
        message: `Rate limit of ${keyData.plan.rateLimit} requests per minute exceeded`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.retryAfter
      });
    }

    // Set rate limit headers for successful requests
    response.set({
      'X-RateLimit-Limit': keyData.plan.rateLimit.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetAt.getTime() / 1000).toString()
    });

    // Attach API key data to request for use in other guards/handlers
    request.apiKey = keyData;
    request.user = keyData.user || keyData.broker;
    request.customerType = keyData.userId ? 'USER' : 'BROKER';

    // Store API key info for usage tracking
    request[API_USAGE_TAG] = {
      apiKeyId: keyData.id,
      productId: keyData.plan.product.id
    };

    return true;
  }

  private extractApiKey(request: any): string | null {
    // Try header first
    const headerKey = request.headers['x-api-key'];
    if (headerKey) {
      return headerKey;
    }

    // Try query parameter
    const queryKey = request.query.api_key;
    if (queryKey) {
      return queryKey;
    }

    // Try bearer token (less common for API keys but supported)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Check if it looks like our API key format
      if (token.startsWith('vrfx_')) {
        return token;
      }
    }

    return null;
  }

  private getClientIp(request: any): string {
    // Check various headers for client IP
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }

    const xRealIp = request.headers['x-real-ip'];
    if (xRealIp) {
      return xRealIp;
    }

    const cfConnectingIp = request.headers['cf-connecting-ip']; // Cloudflare
    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    // Fallback to connection remote address
    return request.connection.remoteAddress || request.ip;
  }
}
