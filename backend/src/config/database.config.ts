import { registerAs } from '@nestjs/config';

/**
 * Database configuration with production-grade connection pooling
 *
 * Connection Pool Settings:
 * - poolMin: Minimum number of connections in the pool
 * - poolMax: Maximum number of connections in the pool
 * - connectionTimeout: Maximum time to wait for a connection (ms)
 * - poolTimeout: Maximum time to wait for an available connection (ms)
 *
 * Recommendation for production:
 * - Small app (1-10 requests/sec): poolMin=2, poolMax=10
 * - Medium app (10-100 requests/sec): poolMin=5, poolMax=20
 * - Large app (100+ requests/sec): poolMin=10, poolMax=50
 */
export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,

  // Connection pool settings
  poolMin: parseInt(process.env.DB_POOL_MIN, 10) || 2,
  poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 10,
  poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT, 10) || 30000, // 30 seconds

  // Connection timeout
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 30000, // 30 seconds

  // Statement timeout (max query execution time)
  statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT, 10) || 60000, // 60 seconds

  // Health check settings
  healthCheckInterval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL, 10) || 30000, // 30 seconds

  // Retry settings
  maxReconnectAttempts: parseInt(process.env.DB_MAX_RECONNECT_ATTEMPTS, 10) || 5,
  reconnectDelay: parseInt(process.env.DB_RECONNECT_DELAY, 10) || 5000, // 5 seconds

  // Logging
  logQueries: process.env.DB_LOG_QUERIES === 'true',
  logLevel: process.env.DB_LOG_LEVEL || 'info', // 'info', 'warn', 'error'
}));
