import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { Logger } from '@nestjs/common';

// Import all entities
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { KYCDocument } from '../entities/kyc-document.entity';
import { Trend } from '../entities/trend.entity';
import { TrendPriceHistory } from '../entities/trend-price-history.entity';
import { MarketData } from '../entities/market-data.entity';
import { Order } from '../entities/order.entity';
import { OrderFill } from '../entities/order-fill.entity';
import { Wallet } from '../entities/wallet.entity';
import { Transaction } from '../entities/transaction.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationDeliveryAttempt } from '../entities/notification-delivery-attempt.entity';
import { BacktestingStrategy } from '../entities/backtesting-strategy.entity';
import { BacktestingResult } from '../entities/backtesting-result.entity';
import { PerformanceMetric } from '../entities/performance-metric.entity';
import { ModerationTask } from '../entities/moderation-task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { SystemSetting } from '../entities/system-setting.entity';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const isDevelopment = configService.get('NODE_ENV') === 'development';
  const isTest = configService.get('NODE_ENV') === 'test';
  const isProduction = configService.get('NODE_ENV') === 'production';

  return {
    type: 'postgres',
    host: configService.get('DB_HOST', 'localhost'),
    port: configService.get('DB_PORT', 5432),
    username: configService.get('DB_USERNAME', 'postgres'),
    password: configService.get('DB_PASSWORD'),
    database: configService.get('DB_NAME', 'viralfx'),
    schema: configService.get('DB_SCHEMA', 'public'),

    // Entity configuration
    entities: [
      User,
      UserProfile,
      KYCDocument,
      Trend,
      TrendPriceHistory,
      MarketData,
      Order,
      OrderFill,
      Wallet,
      Transaction,
      PaymentTransaction,
      Notification,
      NotificationDeliveryAttempt,
      BacktestingStrategy,
      BacktestingResult,
      PerformanceMetric,
      ModerationTask,
      AuditLog,
      SystemSetting,
    ],

    // Migration configuration
    migrations: [
      join(__dirname, '../migrations/*.{js,ts}'),
    ],

    // Subscriber configuration
    subscribers: [
      join(__dirname, '../subscribers/*.{js,ts}'),
    ],

    // Connection settings
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    logging: isDevelopment || isTest,
    logger: isDevelopment ? 'advanced-console' : 'simple',

    // Synchronization (NEVER use in production)
    synchronize: isTest, // Only for test environment

    // Migration settings
    migrationsRun: !isTest, // Auto-run migrations in non-test environments

    // Performance settings
    maxQueryExecutionTime: 1000, // Log queries taking longer than 1 second
    retryAttempts: 3,
    retryDelay: 3000,

    // Connection pool settings
    extra: {
      max: configService.get('DB_POOL_MAX', 20),
      min: configService.get('DB_POOL_MIN', 5),
      idle: configService.get('DB_POOL_IDLE', 10000),
      acquire: configService.get('DB_POOL_ACQUIRE', 60000),
      evict: configService.get('DB_POOL_EVICT', 1000),
    },

    // Timezone settings
    timezone: 'Z', // UTC

    // Cache settings
    cache: {
      type: 'ioredis',
      options: {
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD'),
        db: configService.get('REDIS_DB', 0),
        keyPrefix: 'typeorm_cache:',
        ttl: 60 * 60 * 24, // 24 hours
      },
    },

    // Entity metadata
    entityPrefix: '',

    // Naming strategy
    namingStrategy: {
      // Use snake_case for table names
      tableName(className: string, customName?: string): string {
        return customName || this.toSnakeCase(className);
      },

      // Use snake_case for column names
      columnName(propertyName: string, customName?: string, embeddedPrefixes: string[]): string {
        const prefix = embeddedPrefixes.join('_');
        const name = customName || this.toSnakeCase(propertyName);
        return prefix ? `${prefix}_${name}` : name;
      },

      // Use camelCase for relation names
      relationName(propertyName: string): string {
        return propertyName;
      },

      // Use snake_case for join column names
      joinColumnName(relationName: string, referencedColumnName: string): string {
        return this.toSnakeCase(relationName) + '_' + referencedColumnName;
      },

      // Use snake_case for join table names
      joinTableName(firstTableName: string, secondTableName: string, firstPropertyName: string): string {
        return this.toSnakeCase(firstTableName) + '_' + this.toSnakeCase(firstPropertyName);
      },

      // Helper method to convert camelCase to snake_case
      toSnakeCase(name: string): string {
        return name
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '')
          .replace(/_+/g, '_');
      },
    },

    // CLI settings
    cli: {
      entitiesDir: 'src/database/entities',
      migrationsDir: 'src/database/migrations',
      subscribersDir: 'src/database/subscribers',
    },

    // Replication settings (for read replicas in production)
    replication: isProduction ? {
      master: {
        host: configService.get('DB_MASTER_HOST'),
        port: configService.get('DB_MASTER_PORT', 5432),
        username: configService.get('DB_MASTER_USERNAME'),
        password: configService.get('DB_MASTER_PASSWORD'),
        database: configService.get('DB_MASTER_DATABASE'),
      },
      slaves: [
        {
          host: configService.get('DB_SLAVE_HOST'),
          port: configService.get('DB_SLAVE_PORT', 5432),
          username: configService.get('DB_SLAVE_USERNAME'),
          password: configService.get('DB_SLAVE_PASSWORD'),
          database: configService.get('DB_SLAVE_DATABASE'),
        },
      ],
    } : undefined,

    // Health check settings
    healthCheck: {
      timeout: 5000,
      interval: 10000,
      maxRetries: 3,
    },

    // Debug settings
    debug: isDevelopment,
  };
};

// Create a DataSource instance for migrations and CLI tools
export const createDataSource = (configService: ConfigService): DataSource => {
  return new DataSource({
    ...getDatabaseConfig(configService),
    // Additional settings for standalone DataSource
    keepConnectionAlive: true,
    migrationsTransactionMode: 'each',
  });
};

// Database health check function
const logger = new Logger('DatabaseConfig');

export const checkDatabaseHealth = async (dataSource: DataSource): Promise<boolean> => {
  try {
    await dataSource.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error.stack || error.message);
    return false;
  }
};

// Database connection retry function
export const connectWithRetry = async (dataSource: DataSource, maxRetries: number = 3): Promise<void> => {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await dataSource.initialize();
      logger.log('Database connection established successfully');
      return;
    } catch (error) {
      retries++;
      logger.error(`Database connection attempt ${retries} failed:`, error.message);

      if (retries >= maxRetries) {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Database configuration validation
export const validateDatabaseConfig = (configService: ConfigService): void => {
  const requiredFields = [
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
  ];

  const missingFields = requiredFields.filter(field => !configService.get(field));

  if (missingFields.length > 0) {
    throw new Error(`Missing required database configuration: ${missingFields.join(', ')}`);
  }

  // Validate port number
  const port = parseInt(configService.get('DB_PORT', '5432'));
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Invalid database port number');
  }

  // Validate connection pool settings
  const maxPool = parseInt(configService.get('DB_POOL_MAX', '20'));
  const minPool = parseInt(configService.get('DB_POOL_MIN', '5'));

  if (isNaN(maxPool) || maxPool < 1) {
    throw new Error('Invalid database pool max size');
  }

  if (isNaN(minPool) || minPool < 0) {
    throw new Error('Invalid database pool min size');
  }

  if (minPool > maxPool) {
    throw new Error('Database pool min size cannot be greater than max size');
  }
};

// Export the configuration factory
export const databaseConfigFactory = {
  provide: 'DATABASE_OPTIONS',
  useFactory: getDatabaseConfig,
  inject: [ConfigService],
};

// Export the DataSource factory
export const dataSourceFactory = {
  provide: DataSource,
  useFactory: createDataSource,
  inject: [ConfigService],
};