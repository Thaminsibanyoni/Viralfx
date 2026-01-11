import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const correlationId = (req as any)['correlationId'] || (req.headers['x-correlation-id'] as string);
    const logger = this.logger;

    const requestInfo = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      correlationId,
      timestamp: new Date().toISOString()
    };

    logger.log(`Incoming Request: ${JSON.stringify(requestInfo)}`);

    const originalSend = res.send;
    res.send = function (body) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const responseInfo = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        correlationId,
        timestamp: new Date().toISOString()
      };

      logger.log(`Response: ${JSON.stringify(responseInfo)}`);

      return originalSend.call(res, body);
    };

    next();
  }
}
