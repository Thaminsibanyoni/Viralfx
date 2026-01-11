import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  volumeThreshold?: number;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  stats: {
    failures: number;
  successes: number;
  rejects: number;
  fallbacks: number;
  firebreak?: number;
  percentiles: {
    p50?: number;
    p95?: number;
    p99?: number;
  };
  latencyMean?: number;
  latencyTimes: number[];
  };
}

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, any>();
  private readonly defaultOptions: Required<CircuitBreakerOptions>;

  constructor(private readonly config: ConfigService) {
    this.defaultOptions = {
      timeout: this.config.get<number>('CIRCUIT_BREAKER_TIMEOUT', 3000),
      errorThresholdPercentage: this.config.get<number>(
        'CIRCUIT_BREAKER_ERROR_THRESHOLD',
        50
      ),
      resetTimeout: this.config.get<number>(
        'CIRCUIT_BREAKER_RESET_TIMEOUT',
        30000
      ),
      rollingCountTimeout: this.config.get<number>(
        'CIRCUIT_BREAKER_ROLLING_TIMEOUT',
        10000
      ),
      rollingCountBuckets: this.config.get<number>(
        'CIRCUIT_BREAKER_ROLLING_BUCKETS',
        10
      ),
      volumeThreshold: this.config.get<number>(
        'CIRCUIT_BREAKER_VOLUME_THRESHOLD',
        5
      ),
    };
  }

  async onModuleDestroy() {
    // Shutdown all circuit breakers
    for (const [name, breaker] of this.breakers) {
      try {
        if (typeof breaker.shutdown === 'function') {
          await breaker.shutdown();
          this.logger.log(`Circuit breaker '${name}' shut down`);
        }
      } catch (error) {
        this.logger.error(
          `Error shutting down circuit breaker '${name}':`,
          error.message
        );
      }
    }
    this.breakers.clear();
  }

  /**
   * Create a circuit breaker for a specific service/operation
   */
  createCircuitBreaker(
    name: string,
    options: CircuitBreakerOptions = {}
  ): any {
    if (this.breakers.has(name)) {
      this.logger.warn(`Circuit breaker '${name}' already exists, returning existing instance`);
      return this.breakers.get(name);
    }

    const mergedOptions = { ...this.defaultOptions, ...options };

    // Create a simple circuit breaker implementation
    const breaker = {
      name,
      options: mergedOptions,
      state: {
        isOpen: false,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        lastStateChange: Date.now(),
      },
      stats: {
        failures: 0,
        successes: 0,
        rejects: 0,
        fallbacks: 0,
        latencyTimes: [],
      },

      async execute<T>(
        operation: () => Promise<T>,
        fallback?: () => T | Promise<T>
      ): Promise<T> {
        const startTime = Date.now();

        // Check if circuit is open
        if (this.isOpen(breaker)) {
          breaker.stats.rejects++;
          this.logger.warn(`Circuit breaker '${name}' is OPEN, rejecting request`);

          if (fallback) {
            breaker.stats.fallbacks++;
            return await fallback();
          }

          throw new Error(`Circuit breaker '${name}' is OPEN`);
        }

        try {
          const result = await operation();
          const latency = Date.now() - startTime;

          this.onSuccess(breaker, latency);
          return result;
        } catch (error) {
          const latency = Date.now() - startTime;
          this.onFailure(breaker, error, latency);

          if (fallback) {
            breaker.stats.fallbacks++;
            this.logger.warn(
              `Operation failed in '${name}', executing fallback`,
              error.message
            );
            return await fallback();
          }

          throw error;
        }
      },

      getState(): CircuitBreakerState {
        return {
          isOpen: breaker.state.isOpen,
          stats: {
            failures: breaker.stats.failures,
            successes: breaker.stats.successes,
            rejects: breaker.stats.rejects,
            fallbacks: breaker.stats.fallbacks,
            latencyTimes: [...breaker.stats.latencyTimes],
          },
        };
      },

      open() {
        breaker.state.isOpen = true;
        breaker.state.lastStateChange = Date.now();
        this.logger.warn(`Circuit breaker '${name}' opened manually`);
      },

      close() {
        breaker.state.isOpen = false;
        breaker.state.failureCount = 0;
        breaker.state.successCount = 0;
        breaker.state.lastStateChange = Date.now();
        this.logger.log(`Circuit breaker '${name}' closed manually`);
      },

      async shutdown() {
        // Cleanup logic if needed
      },
    };

    this.breakers.set(name, breaker);
    this.logger.log(`Circuit breaker '${name}' created`);

    return breaker;
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(
    name: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>,
    options?: CircuitBreakerOptions
  ): Promise<T> {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = this.createCircuitBreaker(name, options);
    }

    return breaker.execute(operation, fallback);
  }

  /**
   * Get the state of a circuit breaker
   */
  getState(name: string): CircuitBreakerState | null {
    const breaker = this.breakers.get(name);
    return breaker ? breaker.getState() : null;
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates(): Map<string, CircuitBreakerState> {
    const states = new Map<string, CircuitBreakerState>();
    for (const [name, breaker] of this.breakers) {
      states.set(name, breaker.getState());
    }
    return states;
  }

  /**
   * Manually open a circuit breaker
   */
  openCircuit(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.open();
      return true;
    }
    return false;
  }

  /**
   * Manually close a circuit breaker
   */
  closeCircuit(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.close();
      return true;
    }
    return false;
  }

  private isOpen(breaker: any): boolean {
    if (!breaker.state.isOpen) {
      return false;
    }

    // Check if we should attempt to close the circuit
    const timeSinceLastFailure =
      Date.now() - (breaker.state.lastFailureTime || 0);
    if (timeSinceLastFailure > breaker.options.resetTimeout) {
      this.logger.log(`Circuit breaker '${breaker.name}' attempting to close...`);
      breaker.state.isOpen = false;
      breaker.state.failureCount = 0;
      return false;
    }

    return true;
  }

  private onSuccess(breaker: any, latency: number) {
    breaker.state.successCount++;
    breaker.stats.successes++;
    breaker.stats.latencyTimes.push(latency);

    // Keep only last 100 latency measurements
    if (breaker.stats.latencyTimes.length > 100) {
      breaker.stats.latencyTimes.shift();
    }

    // If we were in a half-open state, close the circuit
    if (breaker.state.isOpen) {
      breaker.state.isOpen = false;
      this.logger.log(`Circuit breaker '${breaker.name}' closed after successful execution`);
    }
  }

  private onFailure(breaker: any, error: any, latency: number) {
    breaker.state.failureCount++;
    breaker.state.lastFailureTime = Date.now();
    breaker.stats.failures++;
    breaker.stats.latencyTimes.push(latency);

    // Keep only last 100 latency measurements
    if (breaker.stats.latencyTimes.length > 100) {
      breaker.stats.latencyTimes.shift();
    }

    // Check if we should open the circuit
    const totalRequests = breaker.state.failureCount + breaker.state.successCount;

    if (
      totalRequests >= breaker.options.volumeThreshold &&
      (breaker.state.failureCount / totalRequests) * 100 >=
        breaker.options.errorThresholdPercentage
    ) {
      if (!breaker.state.isOpen) {
        breaker.state.isOpen = true;
        breaker.state.lastStateChange = Date.now();
        this.logger.error(
          `Circuit breaker '${breaker.name}' opened due to high failure rate: ` +
            `${((breaker.state.failureCount / totalRequests) * 100).toFixed(2)}%`
        );
      }
    }

    this.logger.error(
      `Operation failed in circuit breaker '${breaker.name}':`,
      error.message
    );
  }
}
