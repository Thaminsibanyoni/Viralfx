# ViralFX Deployment Guide

This guide covers deploying the ViralFX platform in production environments.

## Quick Start - Development Environment

1. **Start all services:**
```bash
docker-compose up -d
```

2. **Run database migrations:**
```bash
docker-compose exec backend npm run prisma:migrate
```

3. **Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Docs: http://localhost:3000/api/docs

## Production Deployment

### Prerequisites
- Docker 20.10+
- Kubernetes 1.24+ (for K8s deployment)
- SSL certificates
- Domain names
- Load balancer

### Option 1: Docker Compose (Single Server)

1. **Configure environment:**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with production values
```

2. **Deploy:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Kubernetes

1. **Deploy to Kubernetes:**
```bash
kubectl apply -f infrastructure/
```

2. **Configure Ingress:**
```bash
# Setup SSL with cert-manager or manual certificates
```

## Environment Variables

### Required Production Variables

**Backend (.env):**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/viralfx
REDIS_URL=redis://host:6379
JWT_SECRET=your_secret_key
AWS_S3_ACCESS_KEY=your_access_key
AWS_S3_SECRET_KEY=your_secret_key
```

**Frontend (.env):**
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

## Monitoring Setup

### Health Checks
- Backend: `/health` endpoint
- Database: PostgreSQL health check
- Redis: `redis-cli ping`

### Monitoring Stack
- Prometheus metrics at `/metrics`
- Grafana dashboards for visualization
- Loki for log aggregation

## Security Configuration

### SSL/TLS
- Use HTTPS in production
- Configure valid SSL certificates
- Redirect HTTP to HTTPS

### Security Headers
```nginx
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000";
```

## Backup Strategy

### Database Backups
```bash
# Daily backup
pg_dump $DATABASE_URL | gzip > backup.sql.gz

# Upload to cloud storage
aws s3 cp backup.sql.gz s3://backups/
```

### Application Backups
- Backup Docker images
- Version control all configuration
- Document deployment procedures

## Scaling

### Horizontal Scaling
- Use Kubernetes Horizontal Pod Autoscaler
- Configure load balancer
- Implement database read replicas

### Vertical Scaling
- Increase container resources
- Optimize database performance
- Use CDN for static assets

## Troubleshooting

### Common Issues
1. **Database connection errors** - Check credentials and network
2. **High memory usage** - Monitor and scale containers
3. **Slow API responses** - Check database queries and add indexes

### Log Analysis
```bash
# View logs
docker-compose logs -f backend
kubectl logs -f deployment/viralfx-backend
```

## Support

For deployment support:
- Documentation: Check blueprint/docs/
- Issues: Create GitHub issue
- Emergency: support@viralfx.com