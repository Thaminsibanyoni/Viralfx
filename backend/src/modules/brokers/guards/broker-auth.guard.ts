import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Broker } from '../entities/broker.entity';
import { BrokerStatus } from '../entities/broker.entity';
import { ApiMethod } from '../entities/broker-api-usage.entity';
import { AnalyticsService } from '../services/analytics.service';
import { crypto } from '../../../common/utils/crypto';

export interface BrokerRequest extends Request {
  broker?: Broker;
  brokerId?: string;
}

@Injectable()
export class BrokerAuthGuard implements CanActivate {
  private readonly logger = new Logger(BrokerAuthGuard.name);

  constructor(
    @InjectRepository(Broker)
    private readonly brokerRepository: Repository<Broker>,
    private readonly analyticsService: AnalyticsService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BrokerRequest>();
    const response = context.switchToHttp().getResponse();

    let broker: Broker | null = null;

    // Try JWT authentication first (for self-service endpoints)
    try {
      broker = await this.validateJwtToken(request);
    } catch (error) {
      // If JWT fails, try API key authentication
      const apiKey = this.extractApiKey(request);
      if (!apiKey) {
        throw new UnauthorizedException('API key or JWT token is required');
      }

      broker = await this.validateApiKey(apiKey);
      if (!broker) {
        throw new UnauthorizedException('Invalid API key');
      }
    }

    if (!broker) {
      throw new UnauthorizedException('Authentication failed');
    }

    // Check broker status
    if (!this.isBrokerActive(broker)) {
      throw new ForbiddenException('Broker account is not active');
    }

    // Check if IP is allowed (only for API key auth)
    if (!this.extractApiKey(request) && !this.isIpAllowed(request, broker)) {
      throw new ForbiddenException('IP address not allowed');
    }

    // Attach broker to request for later use
    request.broker = broker;
    request.brokerId = broker.id;

    // Track API usage (only for API key auth)
    if (this.extractApiKey(request)) {
      await this.trackApiUsage(request, broker);
      this.addRateLimitHeaders(response, broker);
    }

    return true;
  }

  private extractApiKey(request: Request): string | null {
    // Try multiple header names for flexibility
    const headers = [
      'x-api-key',
      'X-API-Key',
      'api-key',
      'API-Key',
      'authorization', // For Bearer tokens
    ];

    for (const header of headers) {
      const value = request.headers[header.toLowerCase()];
      if (value) {
        // Handle Bearer token format
        if (header.toLowerCase() === 'authorization' && typeof value === 'string') {
          if (value.startsWith('Bearer ')) {
            return value.substring(7);
          }
        }
        return Array.isArray(value) ? value[0] : value;
      }
    }

    return null;
  }

  private async validateApiKey(apiKey: string): Promise<Broker | null> {
    try {
      // Find broker by API key hash
      const brokers = await this.brokerRepository
        .createQueryBuilder('broker')
        .where('broker.apiConfig->>\'apiKey\' = :apiKey', { apiKey })
        .getMany();

      if (brokers.length === 0) {
        return null;
      }

      // Return the first matching broker (API keys should be unique)
      const broker = brokers[0];

      // Additional validation checks
      if (!this.isValidApiKeyFormat(apiKey)) {
        return null;
      }

      return broker;
    } catch (error) {
      this.logger.error('Error validating API key:', error.stack || error.message);
      return null;
    }
  }

  private async validateJwtToken(request: Request): Promise<Broker | null> {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('JWT token required');
      }

      const token = authHeader.substring(7);
      const payload = this.jwtService.verify(token);

      // Check if this is a broker token
      if (payload.type !== 'broker' || !payload.brokerId) {
        throw new UnauthorizedException('Invalid broker token');
      }

      // Find broker by ID
      const broker = await this.brokerRepository.findOne({
        where: { id: payload.brokerId }
      });

      if (!broker) {
        throw new UnauthorizedException('Broker not found');
      }

      return broker;
    } catch (error) {
      // Re-throw JWT errors, but return null for other cases
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Invalid or expired JWT token');
      }
      return null;
    }
  }

  private isValidApiKeyFormat(apiKey: string): boolean {
    // Basic API key validation
    // In a real implementation, this would verify against stored hash
    return apiKey.length >= 32 && /^[a-zA-Z0-9-_]+$/.test(apiKey);
  }

  private isBrokerActive(broker: Broker): boolean {
    return broker.isActive && broker.status === BrokerStatus.VERIFIED;
  }

  private isIpAllowed(request: Request, broker: Broker): boolean {
    // Check if IP restrictions are configured
    const allowedIps = broker.apiConfig?.allowedIps;
    if (!allowedIps || allowedIps.length === 0) {
      return true; // No IP restrictions
    }

    const clientIp = this.getClientIp(request);
    return allowedIps.includes(clientIp);
  }

  private getClientIp(request: Request): string {
    // Get client IP from various sources
    const forwardedFor = request.headers['x-forwarded-for'] as string;
    const realIp = request.headers['x-real-ip'] as string;
    const remoteAddress = request.socket.remoteAddress;

    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    if (realIp) {
      return realIp;
    }

    return remoteAddress || '127.0.0.1';
  }

  private async trackApiUsage(request: Request, broker: Broker): Promise<void> {
    try {
      const method = this.getHttpMethod(request.method);
      const endpoint = request.path;
      const startTime = Date.now();

      // Log the request for analytics
      // Response time will be calculated and updated in a response interceptor
      await this.analyticsService.trackApiRequest(
        broker.id,
        endpoint,
        method,
        0, // Initial response time (will be updated)
        true, // Assume success initially
      );

      // Store start time for response time calculation
      (request as any).__analyticsStartTime = startTime;
    } catch (error) {
      // Don't let analytics errors block the request
      this.logger.error('Failed to track API usage:', error.stack || error.message);
    }
  }

  private getHttpMethod(method: string): ApiMethod {
    switch (method.toUpperCase()) {
      case 'GET':
        return ApiMethod.GET;
      case 'POST':
        return ApiMethod.POST;
      case 'PUT':
        return ApiMethod.PUT;
      case 'DELETE':
        return ApiMethod.DELETE;
      case 'PATCH':
        return ApiMethod.PATCH;
      default:
        return ApiMethod.GET;
    }
  }

  private addRateLimitHeaders(response: any, broker: Broker): void {
    const rateLimit = broker.apiConfig?.rateLimit || 1000;
    const windowMs = 60 * 1000; // 1 minute window

    response.setHeader('X-RateLimit-Limit', rateLimit);
    response.setHeader('X-RateLimit-Window', windowMs);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimit - 1)); // Simplified
    response.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
  }
}

// Response interceptor to update analytics with actual response time
@Injectable()
export class BrokerResponseInterceptor {
  constructor(
    private readonly analyticsService: AnalyticsService,
  ) {}

  intercept(context: ExecutionContext, next: any) {
    const request = context.switchToHttp().getRequest<BrokerRequest>();
    const startTime = (request as any).__analyticsStartTime;

    if (startTime && request.broker) {
      return next.handle().pipe(
        // Update analytics with actual response time and success status
        // This would be implemented with proper RxJS operators
      );
    }

    return next.handle();
  }
}