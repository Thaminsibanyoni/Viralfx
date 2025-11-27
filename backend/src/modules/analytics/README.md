# Analytics Module

The Analytics Module provides comprehensive backtesting, performance analytics, and real-time metrics capabilities for the ViralFX platform. It enables users to test trading strategies, analyze performance metrics, and receive real-time analytics data.

## Architecture Overview

The module follows a clean architecture pattern with clear separation of concerns:

### Components

- **Services**: Core business logic for analytics operations
- **Controllers**: REST API endpoints for client interactions
- **Processors**: Async queue processing for resource-intensive tasks
- **Schedulers**: Periodic tasks for data aggregation and cleanup
- **Entities**: TypeORM database entities for data persistence
- **Interfaces**: TypeScript contracts for type safety
- **DTOs**: Data transfer objects for request validation

### Data Flow

```
ViralIndexSnapshot (Prisma) → MarketDataAggregation → MarketData (TypeORM) → AnalyticsService → Client
Strategy Configuration → BacktestingService → Bull Queue → BacktestProcessor → Results → PerformanceTracking
```

## Features

### 1. Strategy Management
- Create, update, delete custom trading strategies
- Built-in system strategies (Trend Momentum, Sentiment Reversal)
- Strategy validation and cloning
- Public/private strategy sharing

### 2. Backtesting Engine
- Historical data backtesting with customizable parameters
- Multiple strategy comparison
- Parameter optimization
- Real-time backtest progress updates via WebSocket

### 3. Performance Analytics
- Real-time metrics calculation (Sharpe ratio, drawdown, win rate, etc.)
- Performance leaderboards
- Historical performance tracking
- Risk-adjusted returns analysis

### 4. Real-time Analytics
- Live virality and sentiment metrics
- WebSocket subscriptions for real-time updates
- Trend analytics and predictions
- Risk factor monitoring

### 5. Reporting System
- Comprehensive backtest reports with charts
- Performance comparison reports
- Export capabilities (JSON, CSV)
- Async report generation

## API Endpoints

### Backtesting
- `POST /analytics/backtest` - Queue a new backtest
- `GET /analytics/backtest/:id` - Get backtest result
- `GET /analytics/backtest` - List backtest history
- `POST /analytics/backtest/compare` - Compare strategies
- `POST /analytics/backtest/optimize` - Optimize strategy parameters

### Strategies
- `POST /analytics/strategies` - Create strategy
- `GET /analytics/strategies/:id` - Get strategy details
- `PUT /analytics/strategies/:id` - Update strategy
- `DELETE /analytics/strategies/:id` - Delete strategy
- `POST /analytics/strategies/:id/clone` - Clone strategy
- `GET /analytics/strategies/system` - Get system strategies

### Analytics Data
- `GET /analytics/trends/:symbol` - Get trend analytics
- `GET /analytics/dashboard/:assetId` - Get dashboard data
- `GET /analytics/performance/:entityType/:entityId` - Get performance metrics
- `GET /analytics/leaderboard` - Get performance leaderboard
- `GET /analytics/metrics` - Query time-series metrics
- `GET /analytics/realtime/:symbol` - Get real-time metrics

### Reports
- `POST /analytics/reports` - Generate report
- `GET /analytics/reports/:id` - Get report
- `GET /analytics/reports` - List report history
- `GET /analytics/reports/:id/export` - Export report

## WebSocket Events

### Subscriptions
- `subscribe:analytics` - Subscribe to analytics updates for a symbol
- `unsubscribe:analytics` - Unsubscribe from analytics updates
- `subscribe:backtest-updates` - Subscribe to backtest completion notifications

### Events
- `analytics:update` - Real-time analytics data update
- `backtest:completed` - Backtest completion notification
- `report:ready` - Report generation completion
- `performance:update` - Performance metrics update

## Usage Examples

### Running a Backtest

```typescript
const backtestConfig = {
  strategyId: 'trend_momentum',
  symbol: 'AAPL',
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-12-31'),
  initialCapital: 10000,
  parameters: {
    minViralityScore: 80,
    sentimentThreshold: 0.6
  }
};

// Queue backtest
const response = await fetch('/api/v1/analytics/backtest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(backtestConfig)
});

const { jobId, backtestId } = await response.json();
```

### Creating a Custom Strategy

```typescript
const strategy = {
  name: 'My Viral Momentum Strategy',
  description: 'Custom strategy based on viral momentum',
  category: 'TREND_MOMENTUM',
  parameters: [
    {
      name: 'viralityThreshold',
      type: 'number',
      defaultValue: 75,
      min: 0,
      max: 100
    }
  ],
  rules: [
    {
      type: 'BUY',
      condition: 'AND',
      criteria: [
        { field: 'virality_score', operator: '>', value: '{{viralityThreshold}}' }
      ]
    }
  ]
};

const response = await fetch('/api/v1/analytics/strategies', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(strategy)
});
```

### WebSocket Analytics Subscription

```typescript
import io from 'socket.io-client';

const socket = io('ws://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});

// Subscribe to analytics for a symbol
socket.emit('subscribe:analytics', {
  symbol: 'AAPL',
  timeframe: '1h'
});

// Listen for updates
socket.on('analytics:update', (data) => {
  console.log('Analytics update:', data);
});

// Listen for backtest completion
socket.emit('subscribe:backtest-updates');
socket.on('backtest:completed', (data) => {
  console.log('Backtest completed:', data);
});
```

## Configuration

Environment variables for the analytics module:

```bash
# Analytics Configuration
ANALYTICS_BACKTEST_CONCURRENCY=2          # Max concurrent backtest jobs
ANALYTICS_REPORT_CONCURRENCY=1             # Max concurrent report jobs
ANALYTICS_CACHE_TTL=300                    # Cache TTL in seconds
ANALYTICS_HISTORICAL_DATA_RETENTION_DAYS=90 # Data retention period
ANALYTICS_MAX_BACKTEST_DURATION_HOURS=24    # Max backtest duration
ANALYTICS_RISK_FREE_RATE=0.02               # Risk-free rate for Sharpe ratio
ANALYTICS_ENABLE_TIMESCALEDB=false          # TimescaleDB integration flag
```

## Caching Strategy

The analytics module uses Redis for caching to improve performance:

- **Strategy Cache**: `strategy:{id}` - 1 hour TTL
- **Analytics Data Cache**: `analytics:{symbol}:{interval}:{start}:{end}` - 5 minutes TTL
- **Performance Metrics Cache**: `perf:{type}:{id}:{period}` - 5 minutes TTL
- **Market Data Cache**: `marketdata:{symbol}:{interval}:{start}:{end}` - 5 minutes TTL
- **Leaderboard Cache**: `leaderboard:{type}:{metric}:{period}:{limit}` - 10 minutes TTL

## Queue Processing

The module uses Bull queues for async processing:

### Queues
- `analytics-backtest` - Backtest execution and optimization
- `analytics-report` - Report generation
- `analytics-calculation` - Data aggregation and performance calculations

### Job Types
- `run` - Execute single backtest
- `compare` - Compare multiple strategies
- `optimize` - Optimize strategy parameters
- `generate-backtest-report` - Generate backtest report
- `aggregate-market-data` - Aggregate viral data into market data
- `calculate-performance` - Calculate performance metrics

## Data Storage

### TypeORM Entities
- **BacktestingStrategy** - Strategy definitions and parameters
- **BacktestingResult** - Backtest execution results
- **MarketData** - Time-series OHLCV market data
- **PerformanceMetric** - Performance tracking data

### Prisma Integration
- Uses existing **ViralIndexSnapshot** model for historical data
- Bridges Prisma viral data with TypeORM analytics data
- Fallback mechanism when MarketData is not available

## Performance Considerations

### Database Optimization
- Composite indexes on time-series queries
- Proper indexing on frequently queried fields
- Partitioning considerations for large datasets

### Caching
- Multi-level caching strategy
- Cache invalidation on data updates
- TTL optimization based on data volatility

### Queue Management
- Priority-based job processing
- Concurrency limits to prevent system overload
- Exponential backoff retry logic

### Resource Management
- Configurable concurrency settings
- Memory-efficient data processing
- Batch processing for large datasets

## Monitoring and Observability

### Metrics Tracking
- Job execution times
- Cache hit rates
- Queue depths and processing rates
- Database query performance

### Logging
- Structured logging with correlation IDs
- Different log levels for various operations
- Error tracking and alerting

### Health Checks
- Database connectivity checks
- Redis connectivity checks
- Queue health monitoring

## Security Considerations

### Access Control
- JWT-based authentication for API endpoints
- User-based data isolation
- Admin-only endpoints for system operations

### Data Validation
- Input validation using class-validator
- SQL injection prevention
- Parameter sanitization

### Rate Limiting
- Endpoint-specific rate limits
- Queue-based throttling for resource-intensive operations
- DDoS protection considerations

## Future Enhancements

### TimescaleDB Integration
```typescript
// Enable TimescaleDB for improved time-series performance
ANALYTICS_ENABLE_TIMESCALEDB=true
```

### Advanced Analytics
- Machine learning-based predictions
- Advanced statistical analysis
- Portfolio optimization algorithms

### Scalability Improvements
- Distributed processing capabilities
- Microservice architecture options
- Cloud-native deployment strategies

## Troubleshooting

### Common Issues

1. **Backtest Jobs Not Processing**
   - Check queue configuration
   - Verify Redis connectivity
   - Review worker logs

2. **Performance Metrics Not Updating**
   - Check scheduler configuration
   - Verify database connectivity
   - Review cron expressions

3. **Real-time Updates Not Working**
   - Verify WebSocket connection
   - Check Redis pub/sub configuration
   - Review client subscription logic

### Debug Commands

```bash
# Check queue status
redis-cli llen bull:analytics-backtest:waiting

# Check cache keys
redis-cli keys "analytics:*"

# Check database connections
psql -h localhost -U postgres -d viralfx -c "\dt"
```

## Development Guidelines

### Code Organization
- Follow existing module patterns
- Maintain consistent naming conventions
- Use dependency injection properly

### Testing
- Unit tests for all service methods
- Integration tests for API endpoints
- End-to-end tests for critical workflows

### Documentation
- Keep API documentation current
- Update examples when adding features
- Document configuration options

## Dependencies

### Core Dependencies
- `@nestjs/common` - Core NestJS framework
- `@nestjs/typeorm` - TypeORM integration
- `@nestjs/bull` - Queue management
- `@nestjs/schedule` - Task scheduling
- `typeorm` - ORM for database operations
- `bull` - Queue processing
- `ioredis` - Redis client

### Optional Dependencies
- `timescaledb` - Time-series database (future enhancement)
- `pdf-kit` - PDF generation for reports
- `chart.js` - Chart generation utilities

## License

This module is part of the ViralFX platform and follows the same licensing terms.