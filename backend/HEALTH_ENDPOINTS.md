# Health Endpoints Quick Reference

## Base URL
```
http://localhost:3000
```

## Endpoints

### 1. Overall Health
```bash
GET /health
```
Returns complete health status with all checks.

**Example Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "checks": {
    "database": {
      "status": "healthy",
      "connection": "connected",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "connection": "connected",
      "responseTime": 2
    },
    "memory": {
      "status": "healthy",
      "percentage": 45.2
    }
  }
}
```

### 2. Database Health
```bash
GET /health/database
```
Check PostgreSQL database connectivity.

**Example Response:**
```json
{
  "status": "healthy",
  "connection": "connected",
  "responseTime": 5
}
```

### 3. Redis Health
```bash
GET /health/redis
```
Check Redis cache connectivity.

**Example Response:**
```json
{
  "status": "healthy",
  "connection": "connected",
  "responseTime": 2
}
```

### 4. Memory Health
```bash
GET /health/memory
```
Check application memory usage.

**Example Response:**
```json
{
  "status": "healthy",
  "used": 134217728,
  "total": 268435456,
  "percentage": 50.0,
  "heapUsed": 67108864,
  "heapTotal": 268435456
}
```

**Thresholds:**
- Healthy: < 75%
- Degraded: 75-90%
- Unhealthy: > 90%

### 5. Module Health
```bash
GET /health/modules
```
Check status of all loaded modules.

**Example Response:**
```json
{
  "auth": {
    "status": "healthy",
    "message": "Module is operational"
  },
  "wallet": {
    "status": "healthy",
    "message": "Module is operational"
  }
}
```

### 6. Liveness Probe
```bash
GET /health/live
```
Kubernetes liveness probe - checks if process is alive.

**Example Response:**
```json
{
  "status": "alive"
}
```

**Use Case:** Kubernetes should restart pod if this fails.

### 7. Readiness Probe
```bash
GET /health/ready
```
Kubernetes readiness probe - checks if service can handle traffic.

**Example Response:**
```json
{
  "status": "ready",
  "checks": {
    "database": {
      "status": "healthy",
      "connection": "connected",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "connection": "connected",
      "responseTime": 2
    }
  }
}
```

**Use Case:** Kubernetes should stop sending traffic to pod if this fails.

## Kubernetes Configuration

### Liveness Probe
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe
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

### Startup Probe
```yaml
startupProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 0
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 30
```

## Testing with cURL

### Check overall health
```bash
curl http://localhost:3000/health | jq
```

### Check database
```bash
curl http://localhost:3000/health/database | jq
```

### Check Redis
```bash
curl http://localhost:3000/health/redis | jq
```

### Check memory
```bash
curl http://localhost:3000/health/memory | jq
```

### Check liveness
```bash
curl http://localhost:3000/health/live | jq
```

### Check readiness
```bash
curl http://localhost:3000/health/ready | jq
```

## Monitoring with Prometheus

### Example Prometheus Rules

```yaml
groups:
- name: viralfx_health
  rules:
  - record: viralfx:health_database_response_time
    expr: |
      health_database_response_time{job="viralfx-backend"}

  - record: viralfx:health_redis_response_time
    expr: |
      health_redis_response_time{job="viralfx-backend"}

  - record: viralfx:health_memory_percentage
    expr: |
      health_memory_percentage{job="viralfx-backend"}
```

### Example Alerts

```yaml
groups:
- name: viralfx_alerts
  rules:
  - alert: DatabaseUnhealthy
    expr: |
      health_database_status{job="viralfx-backend"} != 1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Database is unhealthy"
      description: "Database health check has been failing for 5 minutes"

  - alert: RedisUnhealthy
    expr: |
      health_redis_status{job="viralfx-backend"} != 1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Redis is unhealthy"
      description: "Redis health check has been failing for 5 minutes"

  - alert: HighMemoryUsage
    expr: |
      health_memory_percentage{job="viralfx-backend"} > 85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is above 85% for 5 minutes"

  - alert: SlowDatabaseResponse
    expr: |
      health_database_response_time{job="viralfx-backend"} > 1000
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Slow database response"
      description: "Database response time is above 1 second"
```

## Grafana Dashboard Queries

### Overall Health Status
```
last_health_status = health_status{job="viralfx-backend"}
```

### Database Response Time
```
avg(health_database_response_time{job="viralfx-backend"}) by (instance)
```

### Memory Usage Over Time
```
avg(health_memory_percentage{job="viralfx-backend"}) by (instance)
```

### Redis Response Time
```
avg(health_redis_response_time{job="viralfx-backend"}) by (instance)
```

## Troubleshooting

### All endpoints return 404
- **Cause:** HealthController not registered in AppModule
- **Fix:** Verify HealthController is in the controllers array

### Database health check fails
- **Cause:** Database connection issue
- **Check:**
  1. Verify DATABASE_URL is set correctly
  2. Check database is running
  3. Verify network connectivity

### Redis health check fails
- **Cause:** Redis connection issue
- **Check:**
  1. Verify REDIS_HOST and REDIS_PORT are set
  2. Check Redis is running
  3. Verify network connectivity

### Memory check shows unhealthy
- **Cause:** Memory leak or insufficient resources
- **Check:**
  1. Review memory usage trends
  2. Check for memory leaks
  3. Consider increasing container memory limits

### Readiness probe fails but liveness passes
- **Cause:** Service can't handle traffic (DB/Redis down)
- **Action:** Kubernetes will stop sending traffic to this pod
- **Fix:** Resolve underlying connectivity issues

## Best Practices

1. **Set appropriate timeouts** - Don't let health checks hang
2. **Use appropriate intervals** - Don't overwhelm the service
3. **Set failure thresholds** - Allow for transient failures
4. **Log health check failures** - For debugging
5. **Monitor health check metrics** - In your monitoring system
6. **Test health endpoints** - During deployment
7. **Document health check behavior** - For operations team

## Security Considerations

### In Production:
1. **Consider authentication** for sensitive health information
2. **Rate limit health endpoints** to prevent abuse
3. **Don't expose detailed errors** publicly
4. **Use separate port** for health checks if needed
5. **Network policies** to restrict access

### Example: Protect Health Endpoints
```typescript
@Controller('health')
@UseGuards(AuthGuard) // Add authentication
export class HealthController {
  // ...
}
```

## Performance Impact

Health checks are designed to be lightweight:
- Database check: Simple `SELECT 1` query
- Redis check: Simple `PING` command
- Memory check: Process memory usage (no I/O)
- All checks run in parallel
- Typical response time: < 50ms total

Recommended monitoring frequency:
- Liveness: Every 10 seconds
- Readiness: Every 5 seconds
- External monitoring: Every 30-60 seconds
