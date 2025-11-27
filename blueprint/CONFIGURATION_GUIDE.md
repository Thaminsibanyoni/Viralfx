# Configuration Guide - Complete Environment Variable Reference

> **Document Version**: 1.0
> **Last Updated**: November 14, 2025
> **Status**: Complete Reference

## 🎯 **Overview**

This comprehensive configuration guide provides complete reference documentation for all environment variables across the ViralFX platform including backend services, frontend applications, and ML services. It serves as the central configuration management resource for development, staging, and production deployments.

---

## **📋 Configuration Hierarchy**

### **Environment-Specific Configuration**
```
ViralFX/
├── backend/
│   ├── .env.example              # Backend template
│   ├── .env.development          # Development overrides
│   ├── .env.staging              # Staging configuration
│   └── .env.production           # Production secrets
├── frontend/
│   ├── .env.example              # Frontend template
│   ├── .env.development          # Development config
│   ├── .env.staging              # Staging config
│   └── .env.production           # Production config
├── ml-services/
│   ├── trend-intel/.env.example  # ML services template
│   ├── sentiment-analysis/.env.example
│   └── deception-detection/.env.example
└── docker-compose.yml            # Container orchestration
```

### **Configuration Priority**
1. **Environment Variables** - System environment (highest priority)
2. **.env Files** - Local environment files
3. **Default Values** - Built-in application defaults
4. **Configuration Files** - JSON/YAML configuration files

---

## **🔧 Backend Configuration Reference**

### **Core Application Settings**

```bash
# Application Identity
APP_NAME=ViralFX
APP_VERSION=1.0.0
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,https://app.viralfx.com
CORS_CREDENTIALS=true
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Requested-With

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false
```

### **Database Configuration**

```bash
# PostgreSQL Database
DATABASE_URL=postgresql://viralfx_user:password@localhost:5432/viralfx_db
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=viralfx_db
DATABASE_USER=viralfx_user
DATABASE_PASSWORD=your_secure_password
DATABASE_SSL=true
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_TIMEOUT=30000

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
REDIS_CLUSTER=false
REDIS_MAX_RETRIES_PER_REQUEST=3
REDIS_RETRY_DELAY_ON_FAILURE=100
```

### **Authentication & Security**

```bash
# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_minimum_32_characters
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_token_secret_key
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=ViralFX
JWT_AUDIENCE=ViralFX Users

# Two-Factor Authentication
TWO_FACTOR_SECRET=your_2fa_secret_key
TWO_FACTOR_ISSUER=ViralFX
TWO_FACTOR_WINDOW=1

# Session Management
SESSION_SECRET=your_session_secret_key
SESSION_MAX_AGE=86400000
SESSION_SECURE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=strict
```

### **Cloud Storage & File Management**

```bash
# AWS S3 Configuration
AWS_S3_ACCESS_KEY_ID=your_aws_access_key
AWS_S3_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_REGION=us-east-1
AWS_S3_BUCKET=viralfx-uploads
AWS_S3_CDN_URL=https://cdn.viralfx.com

# File Upload Settings
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf
UPLOAD_PATH=uploads
```

### **Email & SMS Services**

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@viralfx.com
SMTP_PASS=your_email_password
SMTP_FROM_NAME=ViralFX
SMTP_FROM_EMAIL=noreply@viralfx.com

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_MESSAGING_SERVICE_SID=your_messaging_service_sid
```

### **Payment Gateway Configuration**

```bash
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_live_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_live_your_paystack_public_key
PAYSTACK_WEBHOOK_SECRET=whsec_your_webhook_secret
PAYSTACK_CALLBACK_URL=https://api.viralfx.com/paystack/callback

# PayFast Configuration
PAYFAST_MERCHANT_ID=10000100
PAYFAST_MERCHANT_KEY=your_payfast_merchant_key
PAYFAST_PASSPHRASE=your_payfast_passphrase
PAYFAST_ITN_URL=https://api.viralfx.com/payfast/itn
PAYFAST_RETURN_URL=https://app.viralfx.com/payment/return
PAYFAST_CANCEL_URL=https://app.viralfx.com/payment/cancel

# Ozow Configuration
OZOW_SITE_ID=viralfx_site_id
OZOW_PRIVATE_KEY=your_ozow_private_key
OZOW_API_KEY=your_ozow_api_key
OZOW_API_URL=https://api.ozow.com/PostPaymentRequest
OZOW_NOTIFY_URL=https://api.viralfx.com/ozow/notify
OZOW_CANCEL_URL=https://app.viralfx.com/payment/cancel
OZOW_SUCCESS_URL=https://app.viralfx.com/payment/success
```

### **Social Media API Configuration**

```bash
# Twitter API v2
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

# TikTok API
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
TIKTOK_ACCESS_TOKEN=your_tiktok_access_token

# Instagram Basic Display API
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token

# YouTube Data API v3
YOUTUBE_API_KEY=your_youtube_api_key

# Facebook Graph API
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token
```

### **ML Services URLs**

```bash
# ML Service Endpoints
SENTIMENT_SERVICE_URL=http://localhost:8000
DECEPTION_SERVICE_URL=http://localhost:8001
TREND_INTELLIGENCE_URL=http://localhost:8002
CLASSIFICATION_SERVICE_URL=http://localhost:8003

# ML Service Configuration
ML_TIMEOUT=30000
ML_RETRY_ATTEMPTS=3
ML_BATCH_SIZE=100
```

### **Oracle & VTS Configuration**

```bash
# Oracle Network
ORACLE_NODE_ID=viralfx_oracle_node_1
ORACLE_NETWORK_ID=viralfx_mainnet
ORACLE_CONSENSUS_THRESHOLD=0.67
ORACLE_VALIDATION_TIMEOUT=30000

# VTS Symbol System
VTS_REGION=ZA
VTS_SYMBOL_PREFIX=VIRAL
VTS_SYMBOL_SEPARATOR=/
VTS_GENERATOR_VERSION=1.0
```

### **Security & Monitoring**

```bash
# Security Headers
HELMET_ENABLED=true
HELMET_CSP_DIRECTIVE=default-src 'self'
HELMET_HSTS_MAX_AGE=31536000

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_ENABLED=true
LOG_FILE_PATH=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# Monitoring & Metrics
METRICS_ENABLED=true
METRICS_PORT=9090
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PORT=3001
```

### **FSCA & Compliance**

```bash
# FSCA Configuration
FSCA_LICENSE_NUMBER=2023123456
FSCA_LICENSE_TYPE=Over-the-Counter Derivatives Provider
FSCA_VERIFICATION_URL=https://www.fsca.co.za
FSCA_API_KEY=your_fsca_api_key

# KYC/AML Configuration
KYC_PROVIDER=jumio
KYC_API_KEY=your_kyc_api_key
KYC_API_SECRET=your_kyc_api_secret
AML_SCREENING_ENABLED=true
AML_THRESHOLD=10000
```

---

## **🎨 Frontend Configuration Reference**

### **Application Settings**

```bash
# Application Identity
VITE_APP_NAME=ViralFX
VITE_APP_VERSION=1.0.0
VITE_APP_DESCRIPTION=Trade Social Momentum with AI-Powered Intelligence

# API Configuration
VITE_API_URL=http://localhost:3000
VITE_API_VERSION=v1
VITE_API_TIMEOUT=10000

# WebSocket Configuration
VITE_WS_URL=ws://localhost:3000
VITE_WS_RECONNECT_INTERVAL=5000
VITE_WS_MAX_RECONNECT_ATTEMPTS=10
```

### **Feature Flags**

```bash
# Feature Toggles
VITE_FEATURE_SOCIAL_LOGIN=true
VITE_FEATURE_DARK_MODE=true
VITE_FEATURE_ANALYTICS=true
VITE_FEATURE_NOTIFICATIONS=true
VITE_FEATURE_MULTI_LANGUAGE=true
VITE_FEATURE_BROKER_INTEGRATION=true

# Experimental Features
VITE_FEATURE_AI_PREDICTIONS=false
VITE_FEATURE_ADVANCED_CHARTS=false
VITE_FEATURE_MOBILE_TRADING=false
```

### **Analytics & Monitoring**

```bash
# Google Analytics
VITE_GA_TRACKING_ID=GA_MEASUREMENT_ID
VITE_GA_ENABLED=true

# Sentry Error Tracking
VITE_SENTRY_DSN=your_sentry_dsn
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1

# Hotjar User Analytics
VITE_HOTJAR_ID=your_hotjar_id
VITE_HOTJAR_VERSION=6
```

### **Third-Party Services**

```bash
# Mapbox (for location features)
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token

# Intercom Customer Support
VITE_INTERCOM_APP_ID=your_intercom_app_id

# Stripe Payments
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_key

# Cloudinary Media
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_name
VITE_CLOUDINARY_UPLOAD_PRESET=viralfx_uploads
```

### **Default User Settings**

```bash
# Default Configuration
VITE_DEFAULT_CURRENCY=ZAR
VITE_DEFAULT_LANGUAGE=en
VITE_DEFAULT_THEME=dark
VITE_DEFAULT_TIMEZONE=Africa/Johannesburg
VITE_DEFAULT_CHART_TYPE=candlestick
VITE_DEFAULT_PAGE_SIZE=20
```

---

## **🤖 ML Services Configuration Reference**

### **Trend Intelligence Service**

```bash
# Application Settings
APP_NAME=ViralFX Trend Intelligence
PORT=8000
NODE_ENV=production

# Database Configuration
DATABASE_URL=postgresql://tintel_user:password@localhost:5432/tintel_db
REDIS_URL=redis://localhost:6379/1

# ML Model Configuration
MODEL_PATH=./models/trend-classification-v2.pkl
MODEL_VERSION=2.0
MODEL_THRESHOLD=0.75
BATCH_SIZE=50

# Social Media APIs
TIKTOK_API_KEY=your_tiktok_api_key
TWITTER_API_KEY=your_twitter_api_key
INSTAGRAM_API_KEY=your_instagram_api_key

# Processing Settings
MAX_WORKERS=4
PROCESSING_TIMEOUT=300
QUEUE_SIZE=1000
```

### **Sentiment Analysis Service**

```bash
# Application Settings
APP_NAME=ViralFX Sentiment Analysis
PORT=8001

# Model Configuration
MODEL_PATH=./models/sentiment-analysis-v3.pt
MODEL_CONFIDENCE_THRESHOLD=0.6
SUPPORTED_LANGUAGES=en,af,zu,xh,es,fr,de,pt,it,nl,zh,ja,ar,hi,ru

# API Configuration
API_RATE_LIMIT=100
API_TIMEOUT=30
MAX_TEXT_LENGTH=5000

# Caching
REDIS_CACHE_TTL=3600
CACHE_SIZE_LIMIT=10000
```

### **Deception Detection Service**

```bash
# Application Settings
APP_NAME=ViralFX Deception Detection
PORT=8002

# Model Configuration
MODEL_PATH=./models/deception-detection-v1.onnx
DECEPTION_THRESHOLD=0.8
FALSE_POSITIVE_RATE=0.05

# Training Configuration
TRAINING_DATA_PATH=./data/training_set.csv
VALIDATION_SPLIT=0.2
EPOCHS=100
LEARNING_RATE=0.001
```

---

## **🏗️ Production Configuration**

### **Production Environment Variables**

```bash
# Production-specific settings
NODE_ENV=production
DEBUG=false
LOG_LEVEL=warn

# Security settings
CORS_ORIGIN=https://app.viralfx.com
SESSION_SECURE=true
HELMET_ENABLED=true

# Performance settings
CLUSTER_MODE=true
CLUSTER_WORKERS=0
COMPRESSION_ENABLED=true
STATIC_CACHE_MAX_AGE=31536000

# Database production settings
DATABASE_SSL=true
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
DATABASE_CONNECTION_TIMEOUT=60000
```

### **Docker Production Environment**

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  backend:
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - AWS_S3_ACCESS_KEY_ID=${AWS_S3_ACCESS_KEY_ID}
      - AWS_S3_SECRET_ACCESS_KEY=${AWS_S3_SECRET_ACCESS_KEY}
      - PAYSTACK_SECRET_KEY=${PAYSTACK_SECRET_KEY}
      - PAYFAST_MERCHANT_KEY=${PAYFAST_MERCHANT_KEY}
      - OZOW_PRIVATE_KEY=${OZOW_PRIVATE_KEY}

  frontend:
    environment:
      - VITE_API_URL=https://api.viralfx.com
      - VITE_WS_URL=wss://api.viralfx.com
      - VITE_STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}

  ml-services:
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - TIKTOK_API_KEY=${TIKTOK_API_KEY}
      - TWITTER_API_KEY=${TWITTER_API_KEY}
```

---

## **📊 Environment Variable Tables**

### **Required Variables Quick Reference**

| Service | Variable | Description | Default |
|---------|----------|-------------|---------|
| Backend | `DATABASE_URL` | PostgreSQL connection string | - |
| Backend | `REDIS_URL` | Redis connection string | - |
| Backend | `JWT_SECRET` | JWT signing secret | - |
| Frontend | `VITE_API_URL` | Backend API URL | `http://localhost:3000` |
| ML Services | `DATABASE_URL` | PostgreSQL connection | - |
| ML Services | `REDIS_URL` | Redis connection | - |

### **Optional Variables Reference**

| Service | Variable | Description | Default | Required |
|---------|----------|-------------|---------|----------|
| Backend | `AWS_S3_ACCESS_KEY_ID` | AWS S3 access key | - | No |
| Backend | `PAYSTACK_SECRET_KEY` | Paystack secret key | - | No |
| Backend | `TWITTER_API_KEY` | Twitter API key | - | No |
| Frontend | `VITE_GA_TRACKING_ID` | Google Analytics ID | - | No |
| Frontend | `VITE_SENTRY_DSN` | Sentry DSN | - | No |

---

## **🔒 Security Best Practices**

### **Secret Management**

```bash
# Use environment-specific secret files
.env.local      # Local development secrets (never commit)
.env.development  # Development environment secrets
.env.staging    # Staging environment secrets
.env.production # Production environment secrets
```

### **Password Requirements**
- Minimum 32 characters for JWT secrets
- Use cryptographically secure random generators
- Rotate secrets regularly (recommended: 90 days)
- Store secrets in secure vaults (AWS Secrets Manager, HashiCorp Vault)

### **API Key Management**
- Use separate keys for development/staging/production
- Implement key rotation strategies
- Monitor API key usage and anomalies
- Restrict API key permissions to minimum required scope

---

## **🔧 Configuration Validation**

### **Startup Validation Script**

```javascript
// backend/src/common/config-validator.ts
export function validateConfig() {
  const required = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate specific formats
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
  }
}
```

### **Development Environment Check**

```bash
#!/bin/bash
# scripts/check-env.sh

echo "🔍 Checking environment configuration..."

# Check required files
if [ ! -f .env ]; then
  echo "❌ .env file not found. Copy .env.example to .env"
  exit 1
fi

# Check required variables
source .env
required_vars=("DATABASE_URL" "REDIS_URL" "JWT_SECRET")

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Required variable $var is not set"
    exit 1
  fi
done

echo "✅ Environment configuration is valid"
```

---

## **🚀 Deployment Configuration**

### **Kubernetes Secrets**

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: viralfx-secrets
type: Opaque
data:
  database-url: <base64-encoded-database-url>
  jwt-secret: <base64-encoded-jwt-secret>
  aws-s3-access-key: <base64-encoded-aws-key>
```

### **Environment-Specific Deployment**

```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

---

## **📞 Support & Troubleshooting**

### **Common Configuration Issues**

**Problem:** Database connection failed
**Solution:** Verify DATABASE_URL format and credentials
**Command:** `psql $DATABASE_URL -c "SELECT 1;"`

**Problem:** JWT token invalid
**Solution:** Ensure JWT_SECRET is same across all services
**Check:** Compare secrets between backend instances

**Problem:** ML services unreachable
**Solution:** Verify network connectivity and service URLs
**Test:** `curl $SENTIMENT_SERVICE_URL/health`

### **Debug Mode**

```bash
# Enable debug logging
DEBUG=viralfx:* npm start

# Show configuration (excluding secrets)
npm run config:show

# Validate all environment variables
npm run config:validate
```

---

## **📝 Configuration Templates**

### **Development Environment Template**

```bash
# .env.development
NODE_ENV=development
DEBUG=viralfx:*
LOG_LEVEL=debug

# Database (using Docker)
DATABASE_URL=postgresql://postgres:password@localhost:5432/viralfx_dev
REDIS_URL=redis://localhost:6379

# JWT (development secret)
JWT_SECRET=dev_jwt_secret_key_for_development_only

# APIs (development/test keys)
PAYSTACK_SECRET_KEY=sk_test_dev_key
TWITTER_API_KEY=dev_twitter_key
```

### **Production Environment Template**

```bash
# .env.production.template
NODE_ENV=production
LOG_LEVEL=warn
DEBUG=false

# Security
HELMET_ENABLED=true
CORS_ORIGIN=https://app.viralfx.com
SESSION_SECURE=true

# Performance
CLUSTER_MODE=true
COMPRESSION_ENABLED=true

# Monitoring
SENTRY_DSN=your_production_sentry_dsn
METRICS_ENABLED=true
```

---

This comprehensive configuration guide serves as the definitive reference for all ViralFX platform environment variables and configuration management. Regular updates should be made as new services are added or existing configurations are modified.