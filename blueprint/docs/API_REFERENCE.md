# ViralFX API Reference

## Base URL
- **Development**: `http://localhost:3000/api/v1`
- **Production**: `https://api.viralfx.com/api/v1`

## Authentication

### JWT Authentication
Include Bearer token in Authorization header:
```
Authorization: Bearer <access_token>
```

### Broker API Key Authentication
For broker endpoints, you can also use API key authentication:
```
Authorization: ApiKey <broker_api_key>
X-Broker-ID: <broker_id>
```

## Response Format

All API responses follow this format:
```json
{
  "success": true,
  "data": {},
  "message": "Success",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Core Endpoints

### Authentication

#### POST /auth/register
Register new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### POST /auth/login
Authenticate and get tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST /auth/refresh
Refresh access token.

**Request:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

### Topics

#### GET /topics
List trending topics.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `category`: Filter by category

**Response:**
```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "id": "uuid",
        "name": "Bitcoin",
        "slug": "bitcoin",
        "category": "cryptocurrency",
        "viralIndex": 75.5
      }
    ]
  }
}
```

### Markets

#### GET /markets
List available trading markets.

**Response:**
```json
{
  "success": true,
  "data": {
    "markets": [
      {
        "id": "uuid",
        "question": "Will BTC go up?",
        "oddsYes": 1.85,
        "oddsNo": 2.05,
        "closeAt": "2024-01-02T00:00:00Z"
      }
    ]
  }
}
```

#### POST /markets/:id/bets
Place a bet on market.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "side": "YES",
  "stake": 100.00
}
```

### Wallet

#### GET /wallet/balance
Get user wallet balance.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "balanceUsd": 1000.00,
    "availableBalance": 950.00
  }
}
```

#### POST /wallet/deposit
Initiate deposit.

**Request:**
```json
{
  "amount": 100.00,
  "provider": "PAYFAST"
}
```

### Brokers

#### GET /brokers/me/profile
Get authenticated broker's profile information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "companyName": "Example Broker (Pty) Ltd",
    "fscaLicenseNumber": "FSP12345",
    "email": "contact@examplebroker.com",
    "status": "VERIFIED",
    "trustScore": 4.75,
    "commissionRate": 0.015,
    "clientCount": 150
  }
}
```

#### GET /brokers/me/analytics
Get broker analytics and performance data.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalClients": 150,
    "activeClients": 89,
    "totalVolume": 2500000.00,
    "monthlyCommission": 37500.00,
    "performanceMetrics": {
      "avgClientProfit": 12.5,
      "retentionRate": 0.78
    }
  }
}
```

#### GET /brokers/me/clients
Get broker's client list with pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Filter by client status

**Response:**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "id": "uuid",
        "email": "client@example.com",
        "status": "ACTIVE",
        "joinedAt": "2024-01-01T00:00:00.000Z",
        "totalVolume": 15000.00,
        "lastActive": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150
    }
  }
}
```

#### POST /brokers/link/:brokerId/oauth/:provider
Initiate OAuth linking for a broker.

**Parameters:**
- `brokerId`: Broker ID
- `provider`: OAuth provider (google, apple, facebook)

#### POST /brokers/commission/process
Process commission payments to brokers.

**Request:**
```json
{
  "period": "MONTHLY",
  "endDate": "2024-01-31",
  "autoConfirm": true
}
```

### Oracle

#### GET /oracle/virality
Get virality scores for trending topics.

**Query Parameters:**
- `limit`: Number of topics (default: 10)
- `platform`: Filter by platform
- `region': Filter by region

**Response:**
```json
{
  "success": true,
  "data": {
    "scores": [
      {
        "trendId": "uuid",
        "topic": "Example Trend",
        "viralityScore": 85.2,
        "platform": "TWITTER",
        "confidence": 0.92,
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### GET /oracle/virality/:trendId
Get detailed virality data for a specific trend.

#### GET /oracle/proof/:hash/verify
Verify the authenticity of oracle data.

#### GET /oracle/status
Get oracle network status.

### Market Aggregation

#### GET /market/:symbol
Get market data for a specific symbol.

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "VIRAL/SA_TREND_123",
    "price": 125.50,
    "volume": 1500000,
    "change24h": 15.2,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /markets/trending
Get list of trending markets.

#### GET /portfolio
Get user's portfolio data.

#### GET /orders
Get user's orders with pagination.

### Analytics

#### POST /analytics/backtest
Run a backtest on historical data.

**Request:**
```json
{
  "strategy": {
    "type": "MOMENTUM",
    "parameters": {
      "viralityThreshold": 75.0,
      "holdingPeriod": "7d"
    }
  },
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "initialCapital": 10000
}
```

#### POST /analytics/strategy
Create or update a trading strategy.

#### GET /analytics/dashboard
Get analytics dashboard data.

## WebSocket Events

Connect to: `ws://localhost:3000`

### Market Updates
Subscribe: `market:subscribe`
Receive: `market:update`

### Order Updates
Subscribe: `order:subscribe`
Receive: `order:update`

### Wallet Updates
Subscribe: `wallet:subscribe`
Receive: `wallet:update`

### Analytics Updates
Subscribe: `analytics:subscribe`
Receive: `analytics:update`

### Broker Updates
Subscribe: `broker:subscribe`
Receive: `broker:update`

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |

## Rate Limits
- General: 100 requests/minute
- Auth: 10 requests/minute
- Trading: 20 requests/minute

## SDK Examples

### JavaScript
```javascript
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.viralfx.com/api/v1',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const markets = await client.get('/markets');
```

### Python
```python
import requests

response = requests.get(
  'https://api.viralfx.com/api/v1/markets',
  headers={'Authorization': f'Bearer {token}'}
)
```