# ViralFX Backend - Production Operations Guide

## Table of Contents

1. [Overview](#overview)
2. [Health Check Endpoints](#health-check-endpoints)
3. [Graceful Shutdown Procedures](#graceful-shutdown-procedures)
4. [Connection Pool Configuration](#connection-pool-configuration)
5. [Monitoring and Metrics](#monitoring-and-metrics)
6. [Emergency Procedures](#emergency-procedures)
7. [Retry and Resilience Patterns](#retry-and-resilience-patterns)
8. [Deployment Checklist](#deployment-checklist)
9. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview

The ViralFX backend is designed with institutional-grade reliability features including:

- **Automatic retry logic** with exponential backoff for transient failures
- **Connection pooling** for database and Redis connections
- **Graceful shutdown** handling for Kubernetes deployments
- **Health monitoring** with readiness/liveness probes
- **Circuit breaker pattern** to prevent cascading failures
- **Comprehensive logging** with correlation IDs

---

## Health Check Endpoints

### Basic Health Check

**Endpoint:** `GET /health`

**Purpose:** Quick health check for load balancers

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-06T12:00:00.000Z",
  "uptime": 3600.5,
  "environment": "production"
}
```

**Use Cases:**
- Load balancer health checks
- Container orchestration probes
- Simple up/down monitoring

---

### Detailed Health Check

**Endpoint:** `GET /health/detailed`

**Purpose:** Comprehensive health status of all system components

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-06T12:00:00.000Z",
  "uptime": 3600.5,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "pass",
      "message": "Database is healthy",
      "details": {
        "isConnected": true,
        "stats": {
          "totalConnections": 10,
          "activeConnections": 3,
          "idleConnections": 7,
          "failedConnections": 0,
          "lastHealthCheck": "2026-01-06T12:00:00.000Z"
        },
        "poolConfig": {
          "min": 2,
          "max": 10,
          "timeout": 30000
        }
      },
      "responseTime": 15
    },
    "redis": {
      "status": "pass",
      "message": "Redis is healthy",
      "details": {
        "isConnected": true,
        "stats": {
          "isConnected": true,
          "lastHealthCheck": "2026-01-06T12:00:00.000Z",
          "failedAttempts": 0,
          "totalRequests": 15000,
          "successfulRequests": 14998,
          "failedRequests": 2
        },
        "config": {
          "host": "redis.production.internal",
          "port": 6379,
          "db": 0
        }
      },
      "responseTime": 5
    },
    "memory": {
      "status": "pass",
      "message": "Memory usage is normal",
      "details": {
        "heapUsed": "256MB",
        "heapTotal": "512MB",
        "rss": "350MB",
        "external": "45MB",
        "usagePercent": "50.00%"
      },
      "responseTime": 1
    },
    "queues": {
      "status": "pass",
      "message": "All queues are healthy",
      "details": [
        {
          "name": "default",
          "status": "ok",
          "metrics": {
            "waiting": 150,
            "active": 5,
            "completed": 12500,
            "failed": 12
          }
        },
        {
          "name": "notifications",
          "status": "ok",
          "metrics": {
            "waiting": 45,
            "active": 2,
            "completed": 8900,
            "failed": 3
          }
        },
        {
          "name": "analytics",
          "status": "ok",
          "metrics": {
            "waiting": 320,
            "active": 8,
            "completed": 45000,
            "failed": 25
          }
        }
      ],
      "responseTime": 45
    }
  },
  "metrics": {
    "responseTime": 67,
    "memoryUsage": {
      "rss": 367001600,
      "heapTotal": 536870912,
      "heapUsed": 268435456,
      "external": 47185920
    },
    "cpuUsage": 12.5
  }
}
```

**Status Values:**
- `healthy`: All systems operational
- `degraded`: Some warnings but service is functional
- `unhealthy`: Critical failures detected

---

### Readiness Probe

**Endpoint:** `GET /health/ready`

**Purpose:** Kubernetes readiness probe - indicates if service can accept traffic

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "redis": true
  }
}
```

**Kubernetes Configuration:**
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

---

### Liveness Probe

**Endpoint:** `GET /health/live`

**Purpose:** Kubernetes liveness probe - indicates if container needs restart

**Response:**
```json
{
  "alive": true,
  "uptime": 3600.5,
  "timestamp": "2026-01-06T12:00:00.000Z"
}
```

**Kubernetes Configuration:**
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 15
  timeoutSeconds: 5
  failureThreshold: 3
```

---

## Graceful Shutdown Procedures

### Automatic Graceful Shutdown

The application automatically handles graceful shutdown on:

1. **SIGTERM** - Kubernetes pod termination
2. **SIGINT** - Manual termination (Ctrl+C)
3. **Uncaught exceptions** - Emergency shutdown

### Shutdown Sequence

1. **Stop accepting new connections** (immediate)
2. **Drain queues** (max 30 seconds)
3. **Save application state** (max 5 seconds)
4. **Close connections** (max 15 seconds)
5. **Force shutdown** (if graceful shutdown times out after 60 seconds)

### Manual Graceful Shutdown

To manually trigger a graceful shutdown:

```bash
# Send SIGTERM to the process
kill -TERM <pid>

# Or use the health endpoint (if implemented)
curl -X POST http://localhost:3000/health/shutdown
```

### Kubernetes Configuration

```yaml
# Graceful shutdown timeout
terminationGracePeriodSeconds: 60

# PreStop hook (optional)
lifecycle:
  preStop:
    httpGet:
      path: /health/ready
      port: 3000
```

---

## Connection Pool Configuration

### Database Connection Pool (Prisma)

**Environment Variables:**

```bash
# Connection pool settings
DB_POOL_MIN=2              # Minimum connections (default: 2)
DB_POOL_MAX=10             # Maximum connections (default: 10)
DB_POOL_TIMEOUT=30000      # Pool timeout in ms (default: 30000)

# Connection timeout
DB_CONNECTION_TIMEOUT=30000 # Connection timeout in ms (default: 30000)

# Statement timeout
DB_STATEMENT_TIMEOUT=60000 # Max query execution time in ms (default: 60000)

# Health check
DB_HEALTH_CHECK_INTERVAL=30000  # Health check interval in ms (default: 30000)

# Retry settings
DB_MAX_RECONNECT_ATTEMPTS=5     # Max reconnection attempts (default: 5)
DB_RECONNECT_DELAY=5000         # Delay between retries in ms (default: 5000)
```

**Pool Sizing Guidelines:**

| Application Size | Requests/Second | poolMin | poolMax |
|-----------------|-----------------|---------|---------|
| Small           | 1-10            | 2       | 10      |
| Medium          | 10-100          | 5       | 20      |
| Large           | 100+            | 10      | 50      |

**Monitoring:**

```bash
# Check connection pool stats
curl http://localhost:3000/health/detailed | jq '.checks.database.details.stats'
```

---

### Redis Connection Configuration

**Environment Variables:**

```bash
# Basic connection
REDIS_HOST=redis.production.internal
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0

# Resilience settings
REDIS_SENTINEL_ENABLED=false        # Enable Redis Sentinel (default: false)
REDIS_SENTINELS=sentinel1:26379,sentinel2:26379
REDIS_SENTINEL_NAME=mymaster
REDIS_SENTINEL_PASSWORD=your-sentinel-password

# TLS settings
REDIS_TLS_ENABLED=false             # Enable TLS (default: false)
REDIS_TLS_REJECT_UNAUTHORIZED=true  # Verify TLS certificate

# Connection settings (configured in code)
# - maxRetriesPerRequest: 3
# - retryStrategy: Exponential backoff (max 3s)
# - enableReadyCheck: true
# - enableOfflineQueue: true
# - connectTimeout: 10s
# - keepAlive: 30s
```

**Redis Sentinel Configuration:**

For high availability, enable Redis Sentinel:

```bash
REDIS_SENTINEL_ENABLED=true
REDIS_SENTINELS=10.0.0.1:26379,10.0.0.2:26379,10.0.0.3:26379
REDIS_SENTINEL_NAME=viralfx-master
REDIS_SENTINEL_PASSWORD=your-sentinel-password
```

---

## Monitoring and Metrics

### Key Metrics to Monitor

1. **Database Metrics**
   - Connection pool usage
   - Query execution time
   - Slow query count
   - Connection failures

2. **Redis Metrics**
   - Connection status
   - Request/response times
   - Memory usage
   - Failed operations

3. **Application Metrics**
   - Request rate
   - Response times
   - Error rate
   - Memory usage
   - CPU usage

4. **Queue Metrics**
   - Waiting jobs
   - Active jobs
   - Completed jobs
   - Failed jobs

### Prometheus Metrics Export

Add to your monitoring stack:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'viralfx-backend'
    metrics_path: '/metrics'
    scrape_interval: 15s
    static_configs:
      - targets: ['backend:3000']
```

### Logging

**Log Levels:**
- `error`: Critical errors requiring immediate attention
- `warn`: Warning messages that don't stop operation
- `log`: Informational messages
- `debug`: Detailed debugging information (development only)
- `verbose`: Very detailed tracing (development only)

**Log Formats:**

```json
{
  "timestamp": "2026-01-06T12:00:00.000Z",
  "level": "info",
  "context": "PrismaService",
  "message": "Database health check passed",
  "correlationId": "abc-123-def",
  "userId": "user-123"
}
```

---

## Emergency Procedures

### Database Connection Failure

**Symptoms:**
- Health check shows `"database": { "status": "fail" }`
- Application logs show "Database connection lost"
- Increased response times

**Immediate Actions:**

1. **Check database status:**
   ```bash
   # Check if database is accessible
   psql $DATABASE_URL -c "SELECT 1"

   # Check connection count
   psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"
   ```

2. **Review application logs:**
   ```bash
   kubectl logs -f deployment/viralfx-backend | grep -i "database"
   ```

3. **Verify connection pool:**
   ```bash
   curl http://localhost:3000/health/detailed | jq '.checks.database'
   ```

4. **If connection pool exhausted:**
   - Increase `DB_POOL_MAX`
   - Check for connection leaks
   - Restart application pod

---

### Redis Connection Failure

**Symptoms:**
- Health check shows `"redis": { "status": "fail" }`
- Caching not working
- Queue operations failing

**Immediate Actions:**

1. **Check Redis status:**
   ```bash
   redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping
   ```

2. **Check Redis logs:**
   ```bash
   kubectl logs -f deployment/redis | tail -100
   ```

3. **Test connection:**
   ```bash
   redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD info server
   ```

4. **If Redis is down:**
   - Application will continue with degraded performance
   - Automatic reconnection will occur when Redis is back
   - Monitor logs for reconnection success

---

### Memory Issues

**Symptoms:**
- Health check shows `"memory": { "status": "warn" }` or `"fail"`
- OOMKilled pods
- Slow response times

**Immediate Actions:**

1. **Check memory usage:**
   ```bash
   curl http://localhost:3000/health/detailed | jq '.checks.memory'
   ```

2. **Identify memory leaks:**
   ```bash
   # Take heap snapshot
   kill -USR2 <pid>
   ```

3. **Scale resources:**
   ```yaml
   resources:
     requests:
       memory: "512Mi"
     limits:
       memory: "1Gi"
   ```

4. **Restart pod if memory is critical:**
   ```bash
   kubectl delete pod -l app=viralfx-backend
   ```

---

## Retry and Resilience Patterns

### Automatic Retry Decorator

Use the `@Retry` decorator for automatic retries:

```typescript
import { Retry } from './common/decorators/retry.decorator';

export class ExternalApiService {
  @Retry(3, 1000)  // 3 attempts, 1s base delay
  async fetchUserData(userId: string) {
    // Will automatically retry on failure
    return await this.httpClient.get(`/users/${userId}`);
  }
}
```

**Retry Behavior:**
- Attempt 1: Immediate
- Attempt 2: After 1 second (1s * 2^0)
- Attempt 3: After 2 seconds (1s * 2^1)

### Circuit Breaker Pattern

Use the circuit breaker to prevent cascading failures:

```typescript
import { CircuitBreaker, CircuitBreakerDecorator } from './common/decorators/retry.decorator';

// Option 1: Use decorator
@CircuitBreakerDecorator(5, 60000)  // Open after 5 failures, 60s timeout
async criticalOperation() {
  // Operation will stop being called after 5 consecutive failures
  // Circuit will half-open after 60 seconds
}

// Option 2: Use circuit breaker directly
const circuitBreaker = new CircuitBreaker(5, 60000);
await circuitBreaker.execute(
  () => this.externalService.getData(),
  'ExternalService.getData'
);

// Check circuit breaker state
const state = circuitBreaker.getState();
console.log(state);  // { state: 'CLOSED', failureCount: 0 }
```

### Database Operations with Retry

```typescript
// Automatic retry for connection errors
const result = await prismaService.executeWithRetry(
  async () => {
    return await prisma.user.findMany({ where: { active: true } });
  },
  3  // Max 3 attempts
);
```

### Redis Operations with Graceful Degradation

```typescript
// Return fallback value if Redis is down
const cachedData = await redisService.getWithGracefulDegradation(
  () => redisService.get('user:123'),
  null  // Fallback value
);
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Review environment variables
- [ ] Verify connection pool settings
- [ ] Check database migration readiness
- [ ] Verify Redis configuration
- [ ] Test health endpoints locally
- [ ] Review logging configuration
- [ ] Set up monitoring alerts

### Deployment

- [ ] Deploy to canary environment
- [ ] Monitor health endpoints for 5 minutes
- [ ] Check logs for errors
- [ ] Verify database connections
- [ ] Verify Redis connections
- [ ] Test critical API endpoints
- [ ] Monitor response times

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check queue processing
- [ ] Verify memory usage is stable
- [ ] Review slow query logs
- [ ] Check connection pool metrics
- [ ] Set up rollback plan if needed

---

## Troubleshooting Guide

### High Response Times

**Possible Causes:**
1. Slow database queries
2. Connection pool exhaustion
3. Network latency
4. CPU throttling

**Diagnostic Steps:**

```bash
# 1. Check database query performance
curl http://localhost:3000/health/detailed | jq '.checks.database.details.responseTime'

# 2. Check connection pool usage
curl http://localhost:3000/health/detailed | jq '.checks.database.details.stats'

# 3. Check application metrics
curl http://localhost:3000/health/detailed | jq '.metrics'

# 4. Review slow queries
kubectl logs deployment/viralfx-backend | grep "Slow query"
```

**Solutions:**
- Optimize slow queries
- Increase connection pool size
- Add database indexes
- Scale horizontally

---

### Queue Backlog

**Possible Causes:**
1. Queue processor is down
2. Jobs are failing continuously
3. Insufficient queue workers

**Diagnostic Steps:**

```bash
# 1. Check queue status
curl http://localhost:3000/health/detailed | jq '.checks.queues'

# 2. Check for failed jobs
curl http://localhost:3000/health/detailed | jq '.checks.queues.details[].metrics.failed'

# 3. Review queue processor logs
kubectl logs deployment/viralfx-backend -c queue-worker
```

**Solutions:**
- Restart queue workers
- Scale queue workers horizontally
- Fix failing job logic
- Increase job retry attempts

---

### Connection Pool Exhaustion

**Symptoms:**
- "Connection timeout" errors
- Health check shows pool at max capacity
- New requests fail

**Diagnostic Steps:**

```bash
# Check pool stats
curl http://localhost:3000/health/detailed | jq '.checks.database.details.stats'
```

**Solutions:**
1. Increase `DB_POOL_MAX`
2. Check for connection leaks in code
3. Add connection timeout
4. Implement proper connection cleanup

---

## Appendix

### Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_POOL_MIN` | 2 | Minimum database connections |
| `DB_POOL_MAX` | 10 | Maximum database connections |
| `DB_CONNECTION_TIMEOUT` | 30000 | Connection timeout (ms) |
| `DB_STATEMENT_TIMEOUT` | 60000 | Query timeout (ms) |
| `REDIS_HOST` | localhost | Redis host |
| `REDIS_PORT` | 6379 | Redis port |
| `REDIS_PASSWORD` | - | Redis password |
| `SHUTDOWN_DRAIN_TIMEOUT` | 30000 | Queue drain timeout (ms) |
| `SHUTDOWN_CONNECTION_TIMEOUT` | 15000 | Connection close timeout (ms) |
| `SHUTDOWN_FORCE_TIMEOUT` | 60000 | Force shutdown timeout (ms) |

### Health Status Codes

| Status | Description | HTTP Code |
|--------|-------------|-----------|
| `healthy` | All systems operational | 200 |
| `degraded` | Warnings but functional | 200 |
| `unhealthy` | Critical failures | 503 |
| `pass` | Component healthy | 200 |
| `warn` | Component has warnings | 200 |
| `fail` | Component failed | 503 |

### Support Contacts

- **Technical Lead**: tech-lead@viralfx.com
- **DevOps Team**: devops@viralfx.com
- **On-Call Engineer**: oncall@viralfx.com

### Related Documentation

- [API Documentation](./api/docs)
- [Development Guide](./README.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Architecture Overview](./ARCHITECTURE.md)

---

**Last Updated:** 2026-01-06
**Version:** 1.0.0
**Maintained By:** ViralFX Engineering Team
