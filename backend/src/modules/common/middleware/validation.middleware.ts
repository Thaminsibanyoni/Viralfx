import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ValidationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Basic request validation
    this.validateRequest(req);

    // Security headers
    this.addSecurityHeaders(res);
    next();
  }

  private validateRequest(req: Request): void {
    // Check for required headers
    const userAgent = req.headers['user-agent'];
    if (!userAgent) {
      throw new HttpException('User-Agent header is required', HttpStatus.BAD_REQUEST);
    }

    // Validate content-type for POST/PUT/PATCH requests
    const method = req.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const contentType = req.headers['content-type'];
      if (contentType && !this.isValidContentType(contentType)) {
        throw new HttpException('Invalid Content-Type header', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
      }
    }

    // Validate request size (prevent large payloads)
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxContentLength = 10 * 1024 * 1024; // 10MB
    if (contentLength > maxContentLength) {
      throw new HttpException('Request entity too large', HttpStatus.PAYLOAD_TOO_LARGE);
    }
  }

  private isValidContentType(contentType: string): boolean {
    const validTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain'
    ];

    // Handle charset parameters
    const baseContentType = contentType.split(';')[0].trim();
    return validTypes.includes(baseContentType);
  }

  private addSecurityHeaders(res: Response): void {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  }
}