import { Logger } from '@nestjs/common';

/**
 * Retry decorator with exponential backoff for handling transient failures
 *
 * @param maxAttempts - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds between retries (default: 1000)
 * @param maxDelay - Maximum delay in milliseconds (default: 30000)
 * @param backoffMultiplier - Exponential backoff multiplier (default: 2)
 * @param retryableErrors - Array of error codes/names that should trigger retry (default: all)
 *
 * @example
 * ```typescript
 * @Retry(3, 1000)
 * async fetchData() {
 *   // Will retry up to 3 times with exponential backoff
 *   return await this.externalService.getData();
 * }
 * ```
 *
 * @example
 * ```typescript
 * @Retry(5, 2000, 60000, 2, ['ETIMEDOUT', 'ECONNRESET'])
 * async criticalOperation() {
 *   // Will retry specific network errors up to 5 times
 *   return await this.processCriticalData();
 * }
 * ```
 */
export function Retry(
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
  backoffMultiplier: number = 2,
  retryableErrors: string[] = [],
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const logger = new Logger(`${target.constructor.name}.${propertyKey}`);

    descriptor.value = async function (...args: any[]) {
      let lastError: any;
      let attempt = 0;

      for (attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await originalMethod.apply(this, args);

          // Log successful retry if not first attempt
          if (attempt > 1) {
            logger.log(
              `Operation succeeded on attempt ${attempt}/${maxAttempts}`,
            );
          }

          return result;
        } catch (error) {
          lastError = error;

          // Check if error is retryable
          const isRetryable =
            retryableErrors.length === 0 ||
            retryableErrors.includes(error.code) ||
            retryableErrors.includes(error.name) ||
            retryableErrors.includes(error.message);

          if (!isRetryable) {
            logger.error(
              `Non-retryable error encountered: ${error.message}`,
              error.stack,
            );
            throw error;
          }

          // Don't retry on last attempt
          if (attempt === maxAttempts) {
            logger.error(
              `Operation failed after ${maxAttempts} attempts: ${error.message}`,
              error.stack,
            );
            throw error;
          }

          // Calculate delay with exponential backoff
          const delay = Math.min(
            baseDelay * Math.pow(backoffMultiplier, attempt - 1),
            maxDelay,
          );

          logger.warn(
            `Attempt ${attempt}/${maxAttempts} failed: ${error.message}. ` +
              `Retrying in ${delay}ms...`,
          );

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      // This should never be reached, but TypeScript needs it
      throw lastError;
    };

    return descriptor;
  };
}

/**
 * Async retry decorator for functions that return promises
 * Provides similar functionality to Retry decorator but for standalone functions
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryableErrors?: string[];
    context?: string;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    retryableErrors = [],
    context = 'retryAsync',
  } = options;

  const logger = new Logger(context);
  let lastError: any;
  let attempt = 0;

  for (attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();

      if (attempt > 1) {
        logger.log(`Operation succeeded on attempt ${attempt}/${maxAttempts}`);
      }

      return result;
    } catch (error) {
      lastError = error;

      const isRetryable =
        retryableErrors.length === 0 ||
        retryableErrors.includes(error.code) ||
        retryableErrors.includes(error.name) ||
        retryableErrors.includes(error.message);

      if (!isRetryable) {
        logger.error(
          `Non-retryable error encountered: ${error.message}`,
          error.stack,
        );
        throw error;
      }

      if (attempt === maxAttempts) {
        logger.error(
          `Operation failed after ${maxAttempts} attempts: ${error.message}`,
          error.stack,
        );
        throw error;
      }

      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay,
      );

      logger.warn(
        `Attempt ${attempt}/${maxAttempts} failed: ${error.message}. ` +
          `Retrying in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Circuit breaker pattern to prevent cascading failures
 * Opens circuit after consecutive failures, closes after success
 *
 * @param threshold - Number of consecutive failures before opening circuit
 * @param timeout - Time in milliseconds before attempting to close circuit
 * @param resetTimeout - Time in milliseconds before fully resetting the circuit
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly logger = new Logger(CircuitBreaker.name);

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly resetTimeout: number = 300000, // 5 minutes
  ) {}

  async execute<T>(
    fn: () => Promise<T>,
    context: string = 'CircuitBreaker',
  ): Promise<T> {
    // Check if circuit should be reset
    if (
      this.state === 'OPEN' &&
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime.getTime() > this.resetTimeout
    ) {
      this.logger.log(`Circuit breaker reset for ${context}`);
      this.reset();
    }

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime.getTime() > this.timeout
      ) {
        this.state = 'HALF_OPEN';
        this.logger.warn(
          `Circuit breaker entering HALF_OPEN state for ${context}`,
        );
      } else {
        throw new Error(
          `Circuit breaker is OPEN for ${context}. Too many recent failures.`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(context);
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(context: string) {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.logger.error(
        `Circuit breaker OPEN for ${context} after ${this.failureCount} failures`,
      );
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.logger.error(
        `Circuit breaker OPEN for ${context} - failed in HALF_OPEN state`,
      );
    }
  }

  private reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = undefined;
  }

  getState(): { state: string; failureCount: number; lastFailureTime?: Date } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Decorator for circuit breaker pattern
 */
export function CircuitBreakerDecorator(
  threshold: number = 5,
  timeout: number = 60000,
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const circuitBreaker = new CircuitBreaker(threshold, timeout);
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return circuitBreaker.execute(
        () => originalMethod.apply(this, args),
        `${target.constructor.name}.${propertyKey}`,
      );
    };

    // Expose circuit breaker state
    Object.defineProperty(target, `${propertyKey}CircuitBreaker`, {
      get: () => circuitBreaker.getState(),
      configurable: true,
    });

    return descriptor;
  };
}
