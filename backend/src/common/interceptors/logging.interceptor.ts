import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const now = Date.now();

    this.logger.log(
      `Incoming Request: ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`);

    return next
      .handle()
      .pipe(
        tap({
          next: (data) => {
            const response = context.switchToHttp().getResponse();
            const { statusCode } = response;
            const delay = Date.now() - now;

            this.logger.log(
              `Outgoing Response: ${method} ${url} - Status: ${statusCode} - Delay: ${delay}ms`);
          },
          error: (error) => {
            const delay = Date.now() - now;

            this.logger.error(
              `Request Error: ${method} ${url} - Error: ${error.message} - Delay: ${delay}ms`,
              error.stack);
          }
        }));
  }
}
