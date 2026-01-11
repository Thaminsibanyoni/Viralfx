# Production Resilience Guide

## Overview

The ViralFX backend has been enhanced with comprehensive resilience patterns to ensure production-ready operation. This document outlines the health check endpoints, circuit breaker implementation, and monitoring capabilities.

## Health Check Endpoints

### Global Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy" | "unhealthy" | "degraded",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "checks": {
    "database": { "status": "healthy", "connection": "connected", "responseTime": 5 },
    "redis": { "status": "healthy", "connection": "connected", "responseTime": 2 },
    "memory": { "status": "healthy", "percentage": 45.2 }
  }
}
```

**Status Definitions:**
- `healthy`: All systems operational
- `unhealthy`: One or more critical systems down
- `degraded`: Systems operational but degraded performance

### Database Health

**Endpoint:** `GET /health/database`

**Response:**
```json
{
  "status": "healthy" | "unhealthy",
  "connection": "connected" | "disconnected",
  "responseTime": 5,
  "error": "Error message if unhealthy"
}
```

**Use Case:** Check database connectivity before critical operations

### Redis Health

**Endpoint:** `GET /health/redis`

**Response:**
```json
{
  "status": "healthy" | "unhealthy",
  "connection": "connected" | "disconnected",
  "responseTime": 2,
  "error": "Error message if unhealthy"
}
```

**Use Case:** Verify cache layer availability

### Memory Health

**Endpoint:** `GET /health/memory`

**Response:**
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "used": 134217728,
  "total": 268435456,
  "percentage": 50.0,
  "heapUsed": 67108864,
  "heapTotal": 268435456
}
```

**Thresholds:**
- `healthy`: < 75% memory usage
- `degraded`: 75-90% memory usage
- `unhealthy`: > 90% memory usage

### Module Health

**Endpoint:** `GET /health/modules`

**Response:**
```json
{
  "auth": { "status": "healthy", "message": "Module is operational" },
  "wallet": { "status": "healthy", "message": "Module is operational" }
}
```

### Liveness Probe

**Endpoint:** `GET /health/live`

**Response:**
```json
{
  "status": "alive"
}
```

**Use Case:** Kubernetes liveness probe - checks if process is running

### Readiness Probe

**Endpoint:** `GET /health/ready`

**Response:**
```json
{
  "status": "ready" | "not_ready",
  "checks": {
    "database": { "status": "healthy", "connection": "connected", "responseTime": 5 },
    "redis": { "status": "healthy", "connection": "connected", "responseTime": 2 }
  }
}
```

**Use Case:** Kubernetes readiness probe - checks if service can handle traffic

## Circuit Breaker Pattern

### Overview

The circuit breaker pattern prevents cascading failures by stopping requests to failing services. When a service fails repeatedly, the circuit "opens" and requests are blocked or routed to fallback logic.

### Configuration

Environment variables in `.env`:

```bash
# Circuit Breaker Settings
CIRCUIT_BREAKER_TIMEOUT=3000              # Operation timeout (ms)
CIRCUIT_BREAKER_ERROR_THRESHOLD=50        # Error threshold percentage
CIRCUIT_BREAKER_RESET_TIMEOUT=30000       # Time before attempting reset (ms)
CIRCUIT_BREAKER_ROLLING_TIMEOUT=10000     # Rolling window timeout (ms)
CIRCUIT_BREAKER_ROLLING_BUCKETS=10        # Number of rolling buckets
CIRCUIT_BREAKER_VOLUME_THRESHOLD=5        # Minimum requests before opening
```

### Usage Example

```typescript
import { CircuitBreakerService } from './common/resilience/circuit-breaker.service';

@Injectable()
export class MyService {
  constructor(private readonly circuitBreaker: CircuitBreakerService) {}

  async fetchData() {
    return this.circuitBreaker.execute(
      'external-api', // Circuit breaker name
      async () => {
        // Primary operation
        return await axios.get('https://api.example.com/data');
      },
      async () => {
        // Fallback operation
        return await this.getCachedData();
      }
    );
  }
}
```

### Circuit Breaker States

1. **Closed**: Normal operation, requests pass through
2. **Open**: Circuit has tripped, requests are blocked/rejected
3. **Half-Open**: Testing if service has recovered

### Monitoring Circuit Breakers

**Get specific breaker state:**
```typescript
const state = circuitBreaker.getState('external-api');
console.log(state);
// { isOpen: false, stats: { failures: 0, successes: 100, ... } }
```

**Get all breaker states:**
```typescript
const allStates = circuitBreaker.getAllStates();
console.log(allStates);
```

**Manual control:**
```typescript
// Open circuit manually
circuitBreaker.openCircuit('external-api');

// Close circuit manually
circuitBreaker.closeCircuit('external-api');
```

## Module Independence

### Isolation Strategy

Each module is designed to operate independently:

1. **No Circular Dependencies**: Modules use `forwardRef()` to break circular imports
2. **Error Handling**: Each module has its own error handling
3. **Graceful Degradation**: Modules can degrade without crashing the app

### Module Health Checks

Each module should implement a health check method:

```typescript
@Injectable()
export class MyService {
  async getHealthStatus() {
    try {
      // Perform module-specific health check
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', database: 'connected' };
    } catch (error) {
      return { status: 'unhealthy', database: 'disconnected', error: error.message };
    }
  }
}
```

## Monitoring and Alerting

### Recommended Metrics

1. **Response Times**: Track API response times
2. **Error Rates**: Monitor error percentages
3. **Circuit Breaker States**: Alert when circuits open
4. **Memory Usage**: Monitor for memory leaks
5. **Database Connection Pool**: Track connection usage
6. **Redis Operations**: Monitor cache hit/miss ratios

### Alerting Thresholds

```yaml
alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    duration: 5m

  - name: CircuitBreakerOpen
    condition: circuit_state == 'open'
    duration: 1m

  - name: HighMemoryUsage
    condition: memory_usage > 85%
    duration: 5m

  - name: DatabaseSlow
    condition: db_response_time > 1000ms
    duration: 2m
```

## Kubernetes Configuration

### Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: viralfx-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        image: viralfx-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          value: "redis-service"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

## Best Practices

### 1. Graceful Shutdown

The application handles shutdown signals:

```typescript
async onModuleDestroy() {
  // Close circuit breakers
  await this.circuitBreaker.shutdown();

  // Disconnect from Redis
  await this.redisService.gracefulShutdown();

  // Close database connections
  await this.prisma.$disconnect();
}
```

### 2. Retry Logic

Implement exponential backoff for retries:

```typescript
async retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
    }
  }
}
```

### 3. Timeout Management

Always use timeouts for external operations:

```typescript
async fetchWithTimeout<T>(
  operation: () => Promise<T>,
  timeout = 5000
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    ),
  ]);
}
```

### 4. Logging

Use structured logging for debugging:

```typescript
this.logger.log({
  message: 'Processing request',
  requestId: id,
  userId: user.id,
  timestamp: new Date().toISOString(),
});
```

## Troubleshooting

### Common Issues

#### 1. Circuit Breaker Won't Close

**Symptom:** Circuit remains open despite service recovery

**Solution:**
- Check `CIRCUIT_BREAKER_RESET_TIMEOUT` setting
- Verify actual service health
- Manually close circuit if needed: `circuitBreaker.closeCircuit(name)`

#### 2. Health Checks Failing

**Symptom:** Health endpoints return unhealthy status

**Solution:**
- Check database connectivity
- Verify Redis is running
- Review application logs for errors
- Check environment variables

#### 3. High Memory Usage

**Symptom:** Memory usage exceeds 90%

**Solution:**
- Restart application pods
- Check for memory leaks
- Review cache configurations
- Scale horizontally

## Performance Optimization

### Database Connection Pooling

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  pool_timeout = 30
  connection_limit = 10
}
```

### Redis Connection Pooling

```typescript
// Already configured in RedisModule
new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true
});
```

### HTTP Keep-Alive

```typescript
// main.ts
server.setTimeout(30000);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
```

## Security Considerations

1. **Health Endpoints**: Consider protecting sensitive health endpoints in production
2. **Circuit Breaker**: Don't expose circuit breaker states publicly
3. **Memory**: Don't expose detailed memory metrics publicly
4. **Rate Limiting**: Health endpoints have their own rate limit

## Future Enhancements

1. **Distributed Tracing**: Add OpenTelemetry integration
2. **Metrics Export**: Prometheus metrics endpoint
3. **Advanced Circuit Breakers**: Integration with resilience4j
4. **Auto-scaling**: Kubernetes HPA based on custom metrics
5. **Chaos Engineering**: Fault injection testing

## Support

For issues or questions:
- Check application logs: `docker logs <container>`
- Review circuit breaker states: `GET /debug/circuits`
- Health status: `GET /health`
- Database status: `GET /health/database`
- Redis status: `GET /health/redis`
