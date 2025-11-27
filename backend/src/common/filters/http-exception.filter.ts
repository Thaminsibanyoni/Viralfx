import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();

    let exceptionResponse: any;
    try {
      exceptionResponse = exception.getResponse();
    } catch {
      exceptionResponse = { message: exception.message };
    }

    // Handle different exception response formats
    let message = exception.message;
    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse?.message) {
      message = Array.isArray(exceptionResponse.message)
        ? exceptionResponse.message.join(', ')
        : exceptionResponse.message;
    }

    // Build error response in the desired format
    const errorResponse = {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
    };

    // Log error for debugging
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception.stack,
    );

    response
      .status(status)
      .json(errorResponse);
  }
}