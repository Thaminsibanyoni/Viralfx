import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { ip, method, originalUrl, headers } = req;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();

    // Log the request
    this.logger.log(`${method} ${originalUrl} - ${ip} - ${userAgent}`);

    // Listen for response to log completion
    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length');
      const responseTime = Date.now() - startTime;

      // Determine log level based on status code
      const message = `${method} ${originalUrl} ${statusCode} ${contentLength || 0} - ${responseTime}ms - ${ip} - ${userAgent}`;

      if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}