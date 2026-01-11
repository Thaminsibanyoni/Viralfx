import { Logger as NestLogger } from '@nestjs/common';

export class Logger extends NestLogger {
  constructor(context?: string) {
    super(context);
  }

  error(message: any, trace?: string, context?: string) {
    super.error(message, trace, context || this.context);
  }

  warn(message: any, context?: string) {
    super.warn(message, context || this.context);
  }

  log(message: any, context?: string) {
    super.log(message, context || this.context);
  }

  debug(message: any, context?: string) {
    super.debug(message, context || this.context);
  }

  verbose(message: any, context?: string) {
    super.verbose(message, context || this.context);
  }
}

export const logger = new Logger();
