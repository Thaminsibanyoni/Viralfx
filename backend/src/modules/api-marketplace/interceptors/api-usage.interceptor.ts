import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const API_USAGE_TAG = 'apiUsage';

@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiUsageInterceptor.name);

  constructor(
    @InjectQueue('api-usage') private usageQueue: Queue,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Skip usage tracking for certain routes
    const skipUsageTracking = this.reflector.get<boolean>(
      'skipUsageTracking',
      context.getHandler(),
    );

    if (skipUsageTracking || !request[API_USAGE_TAG]) {
      return next.handle();
    }

    const startTime = Date.now();
    const { apiKeyId, productId } = request[API_USAGE_TAG];

    // Get request size
    let bytesIn = 0;
    if (request.headers['content-length']) {
      bytesIn = parseInt(request.headers['content-length'], 10);
    } else if (request.body) {
      bytesIn = Buffer.byteLength(JSON.stringify(request.body), 'utf8');
    }

    return next.handle().pipe(
      tap({
        next: async (responseData) => {
          try {
            const latency = Date.now() - startTime;
            const statusCode = response.statusCode;

            // Calculate response size
            let bytesOut = 0;
            if (responseData) {
              if (typeof responseData === 'string') {
                bytesOut = Buffer.byteLength(responseData, 'utf8');
              } else {
                bytesOut = Buffer.byteLength(JSON.stringify(responseData), 'utf8');
              }
            }

            // Queue usage logging (fire and forget)
            const usagePayload = {
              apiKeyId,
              productId,
              path: request.route?.path || request.path,
              method: request.method,
              statusCode,
              bytesIn,
              bytesOut,
              latencyMs: latency,
              userId: request.user?.id,
              brokerId: request.apiKey?.brokerId,
              ip: this.getClientIp(request),
              userAgent: request.headers['user-agent'],
              timestamp: new Date(),
            };

            await this.usageQueue.add(
              'log',
              usagePayload,
              {
                removeOnComplete: true,
                attempts: 1,
                delay: 0,
              },
            );

            // Log slow requests
            if (latency > 1000) {
              this.logger.warn(
                `Slow API request: ${request.method} ${request.path} - ${latency}ms`,
              );
            }

            // Log errors
            if (statusCode >= 400) {
              this.logger.error(
                `API error: ${request.method} ${request.path} - ${statusCode}`,
              );
            }
          } catch (error) {
            this.logger.error(
              'Failed to log API usage',
              error.stack,
            );
          }
        },
        error: async (error) => {
          try {
            const latency = Date.now() - startTime;
            const statusCode = error.response?.status || 500;

            // Log error usage
            const usagePayload = {
              apiKeyId,
              productId,
              path: request.route?.path || request.path,
              method: request.method,
              statusCode,
              bytesIn: request.headers['content-length'] || 0,
              bytesOut: 0,
              latencyMs: latency,
              userId: request.user?.id,
              brokerId: request.apiKey?.brokerId,
              ip: this.getClientIp(request),
              userAgent: request.headers['user-agent'],
              error: error.message,
              timestamp: new Date(),
            };

            await this.usageQueue.add(
              'log',
              usagePayload,
              {
                removeOnComplete: true,
                attempts: 1,
                delay: 0,
              },
            );

            this.logger.error(
              `API error: ${request.method} ${request.path} - ${error.message}`,
            );
          } catch (logError) {
            this.logger.error(
              'Failed to log API usage error',
              logError.stack,
            );
          }

          // Re-throw the original error
          throw error;
        },
      }),
    );
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