# API Marketplace Blueprint

## Overview

The ViralFX API Marketplace is a comprehensive platform that enables developers to access social momentum data, sentiment analysis, and market intelligence through RESTful APIs. This platform monetizes ViralFX's proprietary data and analytics capabilities while providing developers with powerful tools to build innovative applications.

## Architecture

### Backend Architecture (NestJS)

```
┌─────────────────────────────────────────────────────────────┐
│                ViralFX API Marketplace Backend             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │ Products Service│ │   Plans Service │ │   Keys Service   │ │
│  │                 │ │                 │ │                 │ │
│  │ - CRUD Ops       │ │ - Pricing Mgmt   │ │ - Key Gen/Valid │ │
│  │ - Caching       │ │ - Revenue Calc  │ │ - Rate Limiting  │ │
│  │ - Features Mgmt │ │ - Usage Stats   │ │ - Usage Tracking│ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
│                                                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │  Usage Service  │ │ Billing Service │ │RateLimit Service│ │
│  │                 │ │                 │ │                 │ │
│  │ - Log Events    │ │ - Invoice Gen   │ │ - Sliding Window│ │
│  │ - Analytics     │ │ - Payment Proc  │ │ - Burst Control │ │
│  │ - Exports       │ │ - VAT Calc      │ │ - Global Limits │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
│                                                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │Webhook Service  │ │ Usage Processor│ │Billing Processor│ │
│  │                 │ │                 │ │                 │ │
│  │ - Event Trigger  │ │ - Queue Processing│ │ - Invoice Gen    │ │
│  │ - Signature Ver  │ │ - Aggregations   │ │ - Payment Retries│ │
│  │ - Retry Logic    │ │ - Redis Counters │ │ - Monthly Cycle  │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
│                                                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │  ApiKey Guard    │ │Usage Interceptor│ │   Controllers   │ │
│  │                 │ │                 │ │                 │ │
│  │ - Auth Header    │ │ - Auto Logging   │ │ - REST Endpoints │ │
│  │ - IP Whitelist   │ │ - Metrics Capture│ │ - Validation    │ │
│  │ - Rate Check    │ │ - Queue Enqueue  │ │ - Error Handling │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Architecture (React)

```
┌─────────────────────────────────────────────────────────────┐
│              ViralFX Developer Portal Frontend             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │ Overview Page   │ │   Keys Page     │ │  Billing Page   │ │
│  │                 │ │                 │ │                 │ │
│  │ - Product Catalog│ │ - Key Mgmt      │ │ - Invoice List  │ │
│  │ - Quick Start    │ │ - Usage Stats   │ │ - Payment Proc  │ │
│  │ - Code Examples  │ │ - Quota Monitor │ │ - Download PDF  │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
│                                                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │   Docs Page     │ │  Explorer Page  │ │ Webhooks Page   │ │
│  │                 │ │                 │ │                 │ │
│  │ - Swagger UI     │ │ - API Testing    │ │ - Webhook Mgmt  │ │
│  │ - Interactive   │ │ - Request Builder│ │ - Event Config  │ │
│  │ - Code Gen       │ │ - Response Display│ │ - Delivery Logs  │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
│                                                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │ API Client       │ │  State Mgmt      │ │   UI Components  │ │
│  │                 │ │                 │ │                 │ │
│  │ - HTTP Client    │ │ - React Query    │ │ - Ant Design    │ │
│  │ - Type Safety    │ │ - Zustand Stores  │ │ - Custom Hooks   │ │
│  │ - Error Handling │ │ - Caching        │ │ - Responsive    │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Models

#### ApiProduct
```typescript
interface ApiProduct {
  id: string;              // UUID
  slug: string;            // Unique identifier (URL-friendly)
  name: string;            // Display name
  description?: string;     // Product description
  publicDocs?: string;     // Documentation URL or markdown
  category: string;        // Product category (SMI, VTS, etc.)
  defaultPlan: string;      // Default plan code
  features?: string[];     // Feature list
  isActive: boolean;        // Active status
  createdAt: Date;         // Creation timestamp
  updatedAt: Date;         // Last update

  // Relations
  plans: ApiPlan[];         // Available plans
  apiUsage: ApiUsage[];     // Usage records
}
```

#### ApiPlan
```typescript
interface ApiPlan {
  id: string;              // UUID
  productId: string;        // Parent product ID
  name: string;            // Plan display name
  code: string;            // Unique plan code
  monthlyFee: number;       // Monthly fee in ZAR
  perCallFee?: number;      // Per-call fee in ZAR
  rateLimit: number;        // Requests per minute
  burstLimit?: number;      // Burst allowance
  quota?: number;          // Monthly call quota
  description?: string;     // Plan description
  createdAt: Date;
  updatedAt: Date;

  // Relations
  product: ApiProduct;      // Parent product
  apiKeys: ApiKey[];        // Associated keys
}
```

#### ApiKey
```typescript
interface ApiKey {
  id: string;              // UUID
  userId?: string;          // Owner user ID
  brokerId?: string;        // Owner broker ID
  planId: string;           // Plan ID
  key: string;              // Hashed API key
  secretHash: string;       // Hashed secret
  label?: string;           // Friendly label
  ipWhitelist: string[];    // Allowed IPs (CIDR)
  revoked: boolean;         // Revocation status
  usageCount: number;       // Usage counter
  quotaResetAt?: Date;      // Quota reset date
  createdAt: Date;         // Creation date
  lastUsedAt?: Date;        // Last usage
  expiresAt?: Date;         // Expiration date
  metadata?: object;       // Additional metadata
  isSandbox: boolean;       // Sandbox mode

  // Relations
  plan: ApiPlan;           // Associated plan
  apiUsage: ApiUsage[];     // Usage records
}
```

#### ApiUsage
```typescript
interface ApiUsage {
  id: string;              // UUID
  apiKeyId: string;        // API key ID
  productId: string;       // Product ID
  path: string;            // Request path
  method: string;          // HTTP method
  statusCode: number;      // Response status
  bytesIn: number;         // Request bytes
  bytesOut: number;        // Response bytes
  latencyMs: number;       // Latency in ms
  createdAt: Date;         // Timestamp
}
```

#### ApiInvoice
```typescript
interface ApiInvoice {
  id: string;                  // UUID
  customerId?: string;        // Customer ID
  customerType: string;        // USER | BROKER
  billingPeriodStart: Date;    // Period start
  billingPeriodEnd: Date;      // Period end
  amountDue: number;           // Amount due
  amountPaid: number;          // Amount paid
  currency: string;            // Currency code
  status: string;              // Status
  createdAt: Date;             // Creation date
  paidAt?: Date;               // Payment date
  invoicePdfUrl?: string;      // PDF URL
  metadata?: object;           // Additional data
}
```

#### ApiWebhook
```typescript
interface ApiWebhook {
  id: string;              // UUID
  userId: string;           // Owner ID
  url: string;             // Webhook URL
  events: string[];         // Subscribed events
  secret: string;           // Webhook secret
  isActive: boolean;        // Active status
  createdAt: Date;         // Creation date
}
```

### Indexes for Performance

```sql
-- Product indexes
CREATE INDEX idx_api_products_slug ON "ApiProduct"(slug);
CREATE INDEX idx_api_products_category ON "ApiProduct"(category);
CREATE INDEX idx_api_products_active ON "ApiProduct"(isActive);

-- Plan indexes
CREATE INDEX idx_api_plans_product_id ON "ApiPlan"(productId);
CREATE INDEX idx_api_plans_code ON "ApiPlan"(code);

-- Key indexes
CREATE INDEX idx_api_keys_user_id ON "ApiKey"(userId);
CREATE INDEX idx_api_keys_broker_id ON "ApiKey"(brokerId);
CREATE INDEX idx_api_keys_plan_id ON "ApiKey"(planId);
CREATE INDEX idx_api_keys_revoked ON "ApiKey"(revoked);

-- Usage indexes
CREATE INDEX idx_api_usage_key_id_created ON "ApiUsage"(apiKeyId, createdAt);
CREATE INDEX idx_api_usage_product_id_created ON "ApiUsage"(productId, createdAt);

-- Invoice indexes
CREATE INDEX idx_api_invoices_customer_created ON "ApiInvoice"(customerId, createdAt);
CREATE INDEX idx_api_invoices_status ON "ApiInvoice"(status);
```

## API Endpoints

### Authentication
All API endpoints require authentication via API key:

```bash
# Header authentication
x-api-key: vrfx_ABCDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ

# Query parameter authentication
?api_key=vrfx_ABCDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ
```

### Products Management

#### List Products
```
GET /api/v1/api-marketplace/products
```

**Query Parameters:**
- `category` (string, optional): Filter by category
- `active` (boolean, optional): Filter by active status
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50)

**Response:**
```json
{
  "products": [
    {
      "id": "uuid",
      "slug": "smi-api",
      "name": "Social Mood Index API",
      "description": "Real-time social sentiment scores",
      "category": "SMI",
      "defaultPlan": "starter",
      "features": ["Real-time scores", "Historical data"],
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "plans": [...]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 4,
    "pages": 1
  }
}
```

#### Get Product
```
GET /api/v1/api-marketplace/products/:slug
```

**Response:**
```json
{
  "id": "uuid",
  "slug": "smi-api",
  "name": "Social Mood Index API",
  "description": "Real-time social sentiment scores for financial markets",
  "publicDocs": "/docs/smi-api",
  "category": "SMI",
  "defaultPlan": "starter",
  "features": [
    "Real-time sentiment scores",
    "Historical data access",
    "WebSocket streaming",
    "Advanced analytics"
  ],
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "plans": [
    {
      "id": "uuid",
      "productId": "uuid",
      "name": "Starter",
      "code": "smi-starter",
      "monthlyFee": 890.00,
      "perCallFee": null,
      "rateLimit": 100,
      "burstLimit": 150,
      "quota": 10000,
      "description": "Perfect for developers getting started"
    }
  ]
}
```

### Plans Management

#### List Plans
```
GET /api/v1/api-marketplace/plans
GET /api/v1/api-marketplace/products/:productId/plans
```

**Response:**
```json
[
  {
    "id": "uuid",
    "productId": "uuid",
    "name": "Starter",
    "code": "smi-starter",
    "monthlyFee": 890.00,
    "perCallFee": null,
    "rateLimit": 100,
    "burstLimit": 150,
    "quota": 10000,
    "description": "Perfect for developers getting started"
  }
]
```

### API Keys Management

#### Create API Key
```
POST /api/v1/api-marketplace/keys
```

**Request Body:**
```json
{
  "planId": "uuid",
  "label": "Production API Key",
  "ipWhitelist": ["192.168.1.1/32", "10.0.0.0/8"],
  "isSandbox": false,
  "metadata": {
    "department": "Engineering",
    "project": "Mobile App"
  }
}
```

**Response:**
```json
{
  "key": "vrfx_ABCDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",  // Shown only once
  "apiKey": {
    "id": "uuid",
    "planId": "uuid",
    "label": "Production API Key",
    "ipWhitelist": [...],
    "isSandbox": false,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### List API Keys
```
GET /api/v1/api-marketplace/keys
```

**Response:**
```json
[
  {
    "id": "uuid",
    "planId": "uuid",
    "label": "Production API Key",
    "ipWhitelist": ["192.168.1.1/32"],
    "revoked": false,
    "usageCount": 5678,
    "quotaResetAt": "2024-02-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastUsedAt": "2024-01-15T10:30:00Z",
    "expiresAt": "2025-01-01T00:00:00Z",
    "isSandbox": false,
    "plan": {
      "name": "Starter",
      "rateLimit": 100,
      "quota": 10000
    },
    "_count": {
      "apiUsage": 5678
    }
  }
]
```

#### Revoke API Key
```
POST /api/v1/api-marketplace/keys/:id/revoke
```

#### Rotate API Key
```
POST /api/v1/api-marketplace/keys/:id/rotate
```

### Usage Analytics

#### Get Usage Statistics
```
GET /api/v1/api-marketplace/usage
```

**Query Parameters:**
- `apiKeyId` (string, optional): Filter by API key
- `productId` (string, optional): Filter by product
- `startDate` (date, optional): Start date (YYYY-MM-DD)
- `endDate` (date, optional): End date (YYYY-MM-DD)
- `groupBy` (enum): hour | day | month

**Response:**
```json
{
  "totalRequests": 12345,
  "totalBandwidth": 5242880,
  "averageLatency": 45.5,
  "errorRate": 2.3,
  "topEndpoints": [
    {
      "path": "/smi/v1/score",
      "count": 8765
    }
  ],
  "requestsByHour": [
    {
      "hour": "2024-01-15T10:00:00Z",
      "count": 234
    }
  ],
  "statusCodeDistribution": {
    "200": 12056,
    "404": 234,
    "500": 55
  }
}
```

### Billing

#### Get Invoices
```
GET /api/v1/api-marketplace/billing/invoices
```

**Response:**
```json
{
  "invoices": [
    {
      "id": "uuid",
      "customerId": "uuid",
      "customerType": "USER",
      "billingPeriodStart": "2024-01-01T00:00:00Z",
      "billingPeriodEnd": "2024-01-31T23:59:59Z",
      "amountDue": 890.00,
      "amountPaid": 890.00,
      "currency": "ZAR",
      "status": "PAID",
      "createdAt": "2024-01-01T00:00:00Z",
      "paidAt": "2024-01-05T14:30:00Z",
      "invoicePdfUrl": "https://s3.viralfx.com/invoices/uuid.pdf"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "pages": 1
  }
}
```

#### Pay Invoice
```
POST /api/v1/api-marketplace/billing/invoices/:id/pay
```

**Request Body:**
```json
{
  "gateway": "paystack"  // paystack | payfast | ozow
}
```

**Response:**
```json
{
  "paymentUrl": "https://paystack.co/pay/uuid",
  "reference": "PAY_xyz"
}
```

### Webhooks

#### Create Webhook
```
POST /api/v1/api-marketplace/webhooks
```

**Request Body:**
```json
{
  "url": "https://example.com/webhooks/viralfx",
  "events": ["usage.threshold", "invoice.paid"],
  "secret": "whsec_abc123",
  "isActive": true
}
```

#### Supported Events
- `usage.threshold` - When usage reaches 90% of quota
- `invoice.paid` - When invoice is paid
- `invoice.failed` - When payment fails
- `key.created` - When API key is created
- `key.revoked` - When API key is revoked
- `quota.exceeded` - When quota is exceeded
- `quota.reset` - When monthly quota is reset

### Rate Limiting

The API uses a sliding window rate limiting algorithm:

#### Headers Included in Responses
```
X-RateLimit-Limit: 100      // Plan's rate limit
X-RateLimit-Remaining: 95   // Remaining requests
X-RateLimit-Reset: 1704066800 // Unix timestamp
Retry-After: 60              // Seconds to wait (when limited)
```

#### Error Response (429 Too Many Requests)
```json
{
  "error": "Rate limit exceeded",
  "message": "Rate limit of 100 requests per minute exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

## Pricing Model

### Available Products

#### Social Mood Index (SMI) API
Real-time social sentiment scores for financial markets.

**Pricing Tiers:**
- **Starter**: R890/month
  - 10,000 calls/month
  - 100 requests/minute
  - 150 burst requests
- **Pro**: R8,990/month
  - 1,000,000 calls/month
  - 5,000 requests/minute
  - 7,500 burst requests
- **Institutional**: R89,990/month
  - 10,000,000 calls/month
  - 30,000 requests/minute
  - 45,000 burst requests
- **Enterprise**: Custom pricing
  - Unlimited calls
  - Custom rate limits

#### VTS Symbol Feed API
Universal trend symbol data with momentum tracking.

**Pricing Tiers:**
- **Basic**: R3,990/month
  - Unlimited calls
  - 1,000 requests/minute
- **Enterprise**: Custom pricing
  - R0.50 per call
  - 100,000 requests/minute

#### ViralScore API
Predictive virality metrics and trend forecasting.

**Pricing Tiers:**
- **Starter**: R1,790/month
  - 20,000 calls/month
  - 200 requests/minute
  - 300 burst requests
- **Pro**: R17,990/month
  - 2,000,000 calls/month
  - 10,000 requests/minute
  - 15,000 burst requests

#### Sentiment + Deception API
Advanced sentiment analysis with deception detection.

**Pricing Tiers:**
- **Pro**: R17,990/month
  - 1,000,000 calls/month
  - 5,000 requests/minute
  - 7,500 burst requests
- **Enterprise**: Custom pricing
  - R2.00 per call
  - 50,000 requests/minute

### Billing and Currency

- **Base Currency**: South African Rand (ZAR)
- **VAT Rate**: 15% (applied to South African customers)
- **Billing Cycle**: Monthly (1st of each month)
- **Payment Methods**:
  - Paystack (Card, Bank Transfer, USSD)
  - PayFast (EFT, Card, Instant EFT)
  - Ozow (Instant EFT)

### Overage Fees

For plans with per-call pricing:
- Charged only for calls beyond included quota
- Billed at the end of monthly cycle
- Added to next month's invoice

## Rate Limiting Implementation

### Sliding Window Algorithm

The API uses Redis-based sliding window rate limiting for precise control:

```typescript
// Redis key format: ratelimit:sliding:{apiKeyId}
// Value: Sorted set of timestamps

// Check rate limit
const pipeline = redis.pipeline();
const now = Date.now();
const windowStart = now - 60000; // 1 minute window

// Remove old timestamps
pipeline.zremrangebyscore(key, 0, windowStart);

// Add current request
pipeline.zadd(key, now, `${now}-${Math.random()}`);

// Count requests in window
pipeline.zcard(key);

// Set expiration
pipeline.expire(key, 120); // 2 minutes
```

### Rate Limit Tiers

| Plan | Requests/Minute | Burst | Quota/Month |
|------|----------------|-------|-------------|
| Starter | 100 | 150 | 10,000 |
| Pro | 5,000 | 7,500 | 1,000,000 |
| Institutional | 30,000 | 45,000 | 10,000,000 |
| Enterprise | Custom | Custom | Unlimited |

## Billing Flow

### Monthly Billing Process

1. **Usage Aggregation** (1st of month, 00:00 UTC)
   - Calculate usage for each API key
   - Determine overage charges
   - Generate usage reports

2. **Invoice Generation**
   - Create invoice records in database
   - Calculate base subscription fees
   - Add overage fees
   - Apply 15% VAT
   - Generate PDF invoice

3. **Notification**
   - Send email with invoice PDF
   - Trigger webhook notifications
   - Update customer dashboard

4. **Payment Processing**
   - Send payment reminders (day 3, 7, 14)
   - Process payments via gateways
   - Handle payment failures
   - Retry failed payments

5. **Webhook Events**
   - `invoice.created` - Invoice generated
   - `invoice.paid` - Payment successful
   - `invoice.failed` - Payment failed

### Invoice Line Items

Each invoice includes detailed line items:

```json
{
  "lineItems": [
    {
      "description": "Starter Plan - Social Mood Index API",
      "quantity": 1,
      "unitPrice": 890.00,
      "amount": 890.00,
      "currency": "ZAR"
    },
    {
      "description": "Overage fees - SMI API (5,000 calls)",
      "quantity": 5000,
      "unitPrice": 0.50,
      "amount": 2500.00,
      "currency": "ZAR"
    }
  ]
}
```

## Webhook System

### Event Types

#### Usage Events
- `usage.threshold` - When API key reaches 90% of quota
- `quota.exceeded` - When API key exceeds quota
- `quota.reset` - When monthly quota is reset

#### Billing Events
- `invoice.created` - When invoice is generated
- `invoice.paid` - When invoice payment is successful
- `invoice.failed` - When invoice payment fails

#### Key Events
- `key.created` - When API key is created
- `key.revoked` - When API key is revoked

### Webhook Payload Example

```json
{
  "webhookId": "uuid",
  "event": "usage.threshold",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "apiKeyId": "uuid",
    "usage": 9000,
    "quota": 10000,
    "percentage": 90,
    "threshold": 90
  }
}
```

### Signature Verification

Webhooks include HMAC-SHA256 signatures:

```typescript
// Signature header
X-Webhook-Signature: sha256=abc123def456...

// Verification
const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const expectedSignature = hmac.digest('hex');

const isValid = crypto.timingSafeEqual(
  Buffer.from(signature, 'hex'),
  Buffer.from(expectedSignature, 'hex')
);
```

### Retry Logic

- **Maximum Attempts**: 3
- **Backoff Strategy**: Exponential
- **Retry Delays**: 5s, 30s, 2min
- **Circuit Breaker**: Disable after 10 consecutive failures

## Integration Guide

### Step 1: Get Started

1. **Sign Up**: Create a ViralFX account
2. **Navigate**: Go to Developer Portal (/developers)
3. **Create Key**: Generate API key with desired plan
4. **Test**: Make your first API call

### Step 2: Authentication

Include your API key in requests:

```bash
# Header method
curl -H "x-api-key: your-api-key" \
  https://api.viralfx.com/smi/v1/score

# Query parameter method
curl "https://api.viralfx.com/smi/v1/score?api_key=your-api-key"
```

### Step 3: Make Requests

#### JavaScript/Node.js
```javascript
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.viralfx.com',
  headers: {
    'x-api-key': 'your-api-key'
  }
});

const response = await client.get('/smi/v1/score?symbol=V:GLB:POL:TRMPTAX');
console.log(response.data);
```

#### Python
```python
import requests

headers = {'x-api-key': 'your-api-key'}
response = requests.get(
  'https://api.viralfx.com/smi/v1/score?symbol=V:GLB:POL:TRMPTAX',
  headers=headers
)
print(response.json())
```

#### cURL
```bash
curl -X GET "https://api.viralfx.com/smi/v1/score?symbol=V:GLB:POL:TRMPTAX" \
     -H "x-api-key: your-api-key"
```

### Step 4: Handle Rate Limits

Monitor rate limit headers:

```javascript
const response = await client.get('/smi/v1/score');

const remaining = response.headers['x-ratelimit-remaining'];
const reset = response.headers['x-ratelimit-reset'];

if (remaining === '0') {
  // Wait until reset time
  const waitTime = reset - Math.floor(Date.now() / 1000);
  await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
}
```

### Step 5: Error Handling

```javascript
try {
  const response = await client.get('/smi/v1/score');
  // Handle success
} catch (error) {
  if (error.response?.status === 429) {
    // Rate limit exceeded
    const retryAfter = error.response.data.retryAfter;
    console.log(`Rate limited. Retry after ${retryAfter} seconds.`);
  } else if (error.response?.status === 401) {
    // Invalid API key
    console.log('Invalid API key. Check your credentials.');
  } else {
    // Other error
    console.error('API error:', error.message);
  }
}
```

## Monitoring and Observability

### Metrics Collection

#### System Metrics
- Total API requests per second (RPS)
- Average response time
- Error rate by endpoint
- Rate limit hits
- Concurrent connections

#### Business Metrics
- Active API keys by plan
- Revenue by product
- Usage growth rate
- Customer acquisition

### Dashboard Analytics

#### Real-time Dashboard
- Live request counter
- Active developer count
- System health indicators
- Revenue tracker

#### Admin Dashboard
- Customer management
- Usage analytics
- Revenue reports
- System configuration

### Alerting Rules

#### System Alerts
- Error rate > 5%
- Response time > 1s
- Rate limit hits > 1%
- Database connection failures

#### Business Alerts
- High-value customer usage anomalies
- Revenue drop > 20%
- New customer signup spikes
- Failed payment rate > 10%

## Security Features

### API Key Security

#### Generation
- Cryptographically secure random bytes (32 characters)
- bcrypt salted hashing for storage
- SHA-256 for integrity verification

#### Validation
- Header and query parameter support
- IP whitelisting with CIDR notation
- Expiration date enforcement
- Revocation capability

#### Protection
- Rate limiting per key
- Request size limits
- Suspicious activity detection

### Data Protection

#### Encryption
- TLS 1.3 for all HTTP traffic
- Database encryption at rest
- API keys stored as hashes

#### Privacy
- GDPR compliance ready
- Data retention policies
- Customer data isolation

### Audit Trail

#### Logging
- Immutable audit logs
- All admin actions tracked
- API usage records maintained
- Webhook delivery logs

#### Compliance
- South African data privacy laws
- Financial industry regulations
- Export control compliance

## SDKs and Tools

### Official SDKs

#### JavaScript/TypeScript
```bash
npm install viralfx-sdk
```

```typescript
import ViralFX from 'viralfx-sdk';

const client = new ViralFX({
  apiKey: 'your-api-key',
  baseURL: 'https://api.viralfx.com'
});

const score = await client.smi.getScore('V:GLB:POL:TRMPTAX');
```

#### Python
```bash
pip install viralfx-sdk
```

```python
from viralfx import ViralFXClient

client = ViralFXClient(api_key='your-api-key')
score = client.smi.get_score('V:GLB:POL:TRMPTAX')
```

### Development Tools

#### API Explorer
- Interactive web interface
- Request builder
- Response viewer
- Code generation

#### CLI Tools
```bash
# Install CLI
npm install -g @viralfx/cli

# Test API
viralfx api test --key your-key --endpoint /smi/v1/score

# Generate code
viralfx code generate --language python --endpoint /smi/v1/score
```

## Performance Optimization

### Response Times

#### Average Latency by Endpoint
- SMI Score: 45ms
- VTS Feed: 35ms
- ViralScore: 60ms
- Sentiment+Deception: 120ms

#### Caching Strategy
- Redis for rate limiting (TTL: 2 minutes)
- Product catalog (TTL: 5 minutes)
- Usage aggregations (TTL: 30 minutes)

### Scalability

#### Capacity Planning
- 10,000 concurrent users
- 1M requests/minute peak
- 99.9% uptime SLA
- Horizontal scaling ready

#### Load Balancing
- Multiple API gateway instances
- Database read replicas
- Redis clustering for session storage

## Testing Strategy

### API Testing

#### Unit Tests
- Service layer business logic
- Rate limiting algorithms
- Validation rules
- Error handling

#### Integration Tests
- End-to-end API flows
- Database transactions
- Webhook delivery
- Payment processing

#### Load Testing
- Rate limit validation
- Concurrent user simulation
- Performance benchmarks
- Failure scenarios

### Monitoring Tests

#### Health Checks
- Database connectivity
- Redis connectivity
- External service dependencies
- API gateway availability

#### Synthetic Monitoring
- Continuous endpoint testing
- Performance regression detection
- Geographic availability testing

## Deployment

### Environment Configuration

#### Required Environment Variables
```bash
# API Marketplace
API_MARKETPLACE_ENABLED=true
API_MARKETPLACE_BASE_URL=https://api.viralfx.com

# Security
API_KEY_LENGTH=32
API_SECRET_LENGTH=64

# Rate Limiting
API_RATE_LIMIT_DEFAULT=100
API_BURST_LIMIT_DEFAULT=150

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/viralfx

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Billing
API_BILLING_CURRENCY=ZAR
API_BILLING_VAT_RATE=0.15
```

### Production Deployment

#### Docker Configuration
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-marketplace
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-marketplace
  template:
    metadata:
      labels:
        app: api-marketplace
    spec:
      containers:
      - name: api-marketplace
        image: viralfx/api-marketplace:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Scaling Strategies

#### Horizontal Scaling
- Auto-scaling based on CPU usage
- Database connection pooling
- Redis cluster configuration

#### Vertical Scaling
- Instance sizing guidelines
- Performance tuning recommendations
- Resource optimization

## Future Enhancements

### Q3 2024 Roadmap

#### GraphQL Support
- GraphQL API endpoint
- Real-time subscriptions
- Query optimization

#### WebSocket APIs
- Real-time data streaming
- Live updates
- Event-driven architecture

#### Advanced Analytics
- Machine learning insights
- Predictive usage analysis
- Customer behavior patterns

### Q4 2024 Roadmap

#### Enterprise Features
- Organization accounts
- Team management
- Role-based access control
- Custom contracts

#### API Enhancements
- GraphQL Federation
- Batch operations
- Advanced filtering
- Custom response formats

### 2025 Roadmap

#### Global Expansion
- Multi-region deployments
- Localized pricing
- Regional compliance
- International payment methods

#### Advanced Features
- Edge computing
- CDN integration
- Custom domains
- White-label solutions

## Support and Resources

### Documentation
- [API Reference Guide](https://docs.viralfx.com/api)
- [Integration Tutorials](https://docs.viralfx.com/tutorials)
- [Best Practices](https://docs.viralfx.com/best-practices)

### Support Channels
- Email: api-support@viralfx.com
- Discord: [ViralFX Developers](https://discord.gg/viralfx)
- Status Page: [status.viralfx.com](https://status.viralfx.com)

### Community
- GitHub Discussions: [github.com/viralfx/api-marketplace](https://github.com/viralfx/api-marketplace)
- Stack Overflow: [viralfx-api](https://stackoverflow.com/questions/tagged/viralfx-api)
- Developer Blog: [blog.viralfx.com](https://blog.viralfx.com)

## Conclusion

The ViralFX API Marketplace provides a comprehensive platform for developers to access social momentum data and analytics. With enterprise-grade security, flexible pricing, and comprehensive developer tools, it enables the creation of innovative applications powered by real-time market intelligence.

The platform is designed for scalability, reliability, and ease of use, with a focus on the South African market while maintaining global accessibility. The modular architecture allows for rapid feature development and customization to meet specific customer needs.

By following this blueprint and leveraging the provided tools and documentation, developers can quickly integrate ViralFX APIs into their applications and start building innovative solutions on the ViralFX platform.