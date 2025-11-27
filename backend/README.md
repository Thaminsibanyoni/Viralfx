# ViralFX Backend API Server

**NestJS TypeScript Backend** - Complete RESTful API with real-time WebSocket support for the ViralFX trading platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- TypeScript 5+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional but recommended)

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Database setup:**
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database (including SuperAdmin)
npm run seed:superadmin
```

4. **Start development server:**
```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── modules/           # Feature modules
│   │   ├── admin/        # SuperAdmin management system
│   │   ├── api-marketplace/ # API marketplace with billing
│   │   ├── auth/         # Authentication & authorization
│   │   ├── users/        # User management
│   │   ├── brokers/      # Broker management
│   │   ├── trading/      # Trading engine
│   │   ├── oracle/       # Social sentiment oracle
│   │   ├── vts/          # Viral Trading Symbols
│   │   ├── notifications/ # Notification system
│   │   ├── storage/      # S3 file storage service
│   │   └── analytics/    # Analytics & monitoring
│   ├── common/           # Shared utilities
│   ├── config/           # Configuration
│   └── main.ts           # Application entry point
├── scripts/              # Utility scripts
├── prisma/              # Database schema & migrations
├── test/                # Test files
└── .env.example         # Environment variables template
```

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development
API_PREFIX=api/v1

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/viralfx"

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# SuperAdmin
SUPER_ADMIN_EMAIL=admin@viralfx.com
SUPER_ADMIN_PASSWORD=your-secure-password
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Admin

# SuperAdmin Initialization

## 🛡️ SuperAdmin System

The ViralFX backend includes a comprehensive SuperAdmin management system for platform administration, monitoring, and governance.

### 🚀 SuperAdmin Setup

1. **Configure SuperAdmin credentials:**
```bash
# Edit your .env file
SUPER_ADMIN_EMAIL=admin@viralfx.com
SUPER_ADMIN_PASSWORD=ChangeThisSecurePassword123!
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Admin
```

2. **Seed SuperAdmin account:**
```bash
# Run the SuperAdmin seeding script
npm run seed:superadmin
```

3. **Access SuperAdmin dashboard:**
- Navigate to: `http://localhost:5173/admin/login`
- Login with your configured SuperAdmin credentials
- Access the full SuperAdmin portal at: `http://localhost:5173/superadmin`

### 🔑 SuperAdmin Features

#### **Dashboard & Analytics**
- Real-time platform metrics and health monitoring
- User activity and trading volume analytics
- System performance and resource utilization
- Risk assessment and compliance tracking

#### **User Management**
- View, search, and filter all platform users
- KYC status management and verification
- User suspension, banning, and reinstatement
- Risk scoring and behavioral monitoring

#### **Broker Operations**
- Broker application review and approval
- Compliance monitoring and FSCA verification
- Commission tracking and payment management
- Performance analytics and tier management

#### **Trend Management**
- Real-time trend monitoring and moderation
- VTS (Viral Trading Symbol) registry management
- Content classification and risk assessment
- Platform-wide trend analytics

#### **Risk & Security**
- Automated risk alert system
- Harmful content detection and moderation
- Security incident tracking and response
- Audit trail and compliance reporting

#### **Platform Configuration**
- Feature flags and platform settings
- Branding customization and theming
- Maintenance mode and system controls
- API rate limiting and security policies

#### **Financial Management**
- Transaction monitoring and settlement
- Revenue analytics and reporting
- Payment gateway configuration
- Broker commission and payout management

### 📊 Available Reports

- **User Analytics**: Registration trends, activity patterns, KYC completion rates
- **Trading Analytics**: Volume trends, popular symbols, risk metrics
- **Financial Reports**: Revenue breakdown, transaction fees, broker commissions
- **Security Reports**: Incident tracking, risk alerts, compliance status
- **System Health**: Performance metrics, uptime, resource utilization

### 🔐 Security Features

- **Multi-factor Authentication**: Required for all SuperAdmin accounts
- **Role-based Access Control**: Granular permissions for different admin roles
- **IP Whitelisting**: Restrict access to authorized IP addresses
- **Audit Logging**: Complete audit trail of all administrative actions
- **Session Management**: Secure session handling with automatic timeout

### 🛠️ API Endpoints

All SuperAdmin endpoints are prefixed with `/api/v1/admin` and require SuperAdmin authentication:

- **Authentication**: `/login`, `/logout`, `/refresh`, `/profile`
- **Dashboard**: `/dashboard/metrics`, `/dashboard/system-health`
- **Users**: `/users`, `/users/:id`, `/users/:id/suspend`, `/users/:id/approve-kyc`
- **Brokers**: `/brokers`, `/brokers/:id`, `/brokers/:id/approve`, `/brokers/:id/suspend`
- **Trends**: `/trends`, `/trends/:id/approve`, `/trends/:id/override`, `/vts-symbols`
- **Risk**: `/risk/alerts`, `/risk/content`, `/risk/alerts/:id/resolve`
- **Finance**: `/finance/transactions`, `/finance/invoices`, `/finance/payouts`
- **Platform**: `/platform/settings`, `/platform/features`, `/platform/branding`
- **Audit**: `/audit/logs`, `/audit/statistics`

For complete API documentation, see: `http://localhost:3000/api/docs`

### 📈 Monitoring & Alerts

The SuperAdmin system includes real-time monitoring capabilities:

- **System Health**: Server uptime, database connectivity, Redis status
- **Performance Metrics**: Response times, error rates, resource utilization
- **Business Metrics**: Active users, trading volume, revenue tracking
- **Security Alerts**: Suspicious activity, failed logins, compliance issues
- **Custom Alerts**: Configurable thresholds for various metrics

### 🔄 Maintenance & Operations

- **Database Backups**: Automated daily backups with 30-day retention
- **Log Management**: Centralized logging with rotation and archival
- **Performance Monitoring**: Real-time metrics with alerting
- **Security Scanning**: Regular vulnerability assessments and updates

# External Services
ORACLE_ENABLED=true
VTS_ENABLED=true
EMAIL_SERVICE=sendgrid
SMS_SERVICE=twilio

# Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_TIME=30

# Monitoring
ENABLE_METRICS=true
LOG_LEVEL=info
```

## 🛡️ Security Features

### Authentication & Authorization
- **JWT-based authentication** with refresh tokens
- **Two-Factor Authentication (2FA)** support
- **Role-based access control (RBAC)** with granular permissions
- **IP whitelisting** and device fingerprinting
- **Account lockout** after failed attempts

### SuperAdmin System
- **Hierarchical role management** with 9 distinct roles
- **Comprehensive audit logging** for all administrative actions
- **Permission-based access control** with 20+ granular permissions
- **Session management** with concurrent session limits
- **Multi-factor authentication** enforcement for privileged access

### Data Protection
- **Encryption at rest** and in transit
- **Input validation** and sanitization
- **SQL injection prevention** with TypeORM
- **Rate limiting** and DDoS protection
- **CORS configuration** for cross-origin requests

## 🚦 API Endpoints

### Authentication
```
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
GET    /auth/profile
POST   /auth/register
POST   /auth/forgot-password
POST   /auth/reset-password
```

### SuperAdmin Management
```
GET    /admin/dashboard/overview
GET    /admin/users
POST   /admin/users/:id/suspend
POST   /admin/users/:id/ban
GET    /admin/brokers
POST   /admin/brokers/:id/approve
GET    /admin/finance/overview
GET    /admin/finance/transactions
GET    /admin/trends
POST   /admin/trends/:id/approve
GET    /admin/risk/alerts
GET    /admin/oracle/nodes
GET    /admin/platform/settings
GET    /admin/notifications/templates
GET    /admin/audit
```

### User Management
```
GET    /users/profile
PUT    /users/profile
POST   /users/upload-avatar
GET    /users/wallet
POST   /users/deposit
POST   /users/withdraw
```

### Trading
```
GET    /trading/markets
POST   /trading/orders
GET    /trading/orders
GET    /trading/portfolio
GET    /trading/history
```

### WebSocket Events
```
// Real-time market data
market.update
order.book.update
trade.execute

// User notifications
notification.new
wallet.balance.update
order.status.update

// Oracle updates
oracle.price.update
oracle.consensus.update
```

## 👥 Admin Roles & Permissions

### Role Hierarchy
1. **SUPER_ADMIN** - Complete system access
2. **DEPARTMENT_HEAD** - Department-wide access
3. **USER_OPS** - User management
4. **BROKER_OPS** - Broker management
5. **TREND_OPS** - Trend management
6. **RISK_OPS** - Risk management
7. **FINANCE_OPS** - Financial operations
8. **SUPPORT_OPS** - Customer support
9. **TECH_OPS** - Technical operations
10. **CONTENT_OPS** - Content moderation

### Permission Categories
- **USER_MANAGEMENT** - View, create, suspend, ban users
- **BROKER_MANAGEMENT** - Approve, suspend, verify brokers
- **TREND_MANAGEMENT** - Approve, override, pause trends
- **RISK_MANAGEMENT** - Monitor, manage risk alerts
- **FINANCE_MANAGEMENT** - Handle transactions, payouts
- **PLATFORM_MANAGEMENT** - Configure platform settings
- **NOTIFICATION_MANAGEMENT** - Send notifications
- **SYSTEM_MANAGEMENT** - System configuration
- **AUDIT_MANAGEMENT** - View audit logs
- **ADMIN_MANAGEMENT** - Manage admin users

## 📊 Monitoring & Analytics

### Health Checks
- **API Health**: `/health` - Basic API status
- **Database Health**: `/health/db` - Database connectivity
- **Redis Health**: `/health/redis` - Cache status
- **Oracle Health**: `/health/oracle` - Oracle system status

### Metrics Collection
- **Request/response times**
- **Error rates and types**
- **Database query performance**
- **Memory and CPU usage**
- **Active WebSocket connections**
- **Authentication events**
- **Trading volume and frequency**

### Logging
- **Structured logging** with Winston
- **Different log levels** (debug, info, warn, error)
- **Audit trail logging** for all admin actions
- **Performance metrics** logging
- **Error tracking** and alerting

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Test coverage
npm run test:cov
```

### Integration Tests
```bash
# Run e2e tests
npm run test:e2e

# Run API tests
npm run test:api
```

### Database Testing
```bash
# Test with in-memory database
npm run test:db

# Seed test data
npm run test:seed
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t viralfx-backend .

# Run with Docker Compose
docker-compose up -d
```

### Production Deployment
```bash
# Build for production
npm run build

# Start production server
npm run start:prod
```

### Environment Setup
- **Development**: Use `.env.development`
- **Staging**: Use `.env.staging`
- **Production**: Use `.env.production`

## 🔧 Development Tools

### Database Management
```bash
# Database GUI
npx prisma studio

# Generate migration
npx prisma migrate dev --name migration_name

# Reset database
npx prisma migrate reset

# Seed data
npm run prisma:seed
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

## 📈 Performance

### Optimization Features
- **Database query optimization** with proper indexing
- **Redis caching** for frequently accessed data
- **Connection pooling** for database connections
- **Request compression** with gzip
- **Static asset caching** with appropriate headers
- **WebSocket connection optimization** with heartbeats

### Scalability
- **Horizontal scaling** support
- **Load balancing ready**
- **Microservices architecture**
- **Database sharding support**
- **Redis clustering support**

## 🔄 SuperAdmin System

### Complete Administrative Interface
- **Overview Dashboard** - System metrics and insights
- **User Management** - Complete user lifecycle management
- **Broker Management** - FSCA compliance and verification
- **Financial Operations** - Transaction and payout management
- **Trend Management** - VTS symbol and trend oversight
- **Risk Management** - Content moderation and risk alerts
- **Oracle Management** - Node health and consensus monitoring
- **Platform Settings** - System configuration and features
- **Notification Center** - Template and campaign management
- **Audit Logging** - Comprehensive activity tracking
- **Admin Management** - Role and permission management

### Security Features
- **Multi-factor authentication** requirement
- **IP whitelisting** for admin access
- **Device fingerprinting** and session tracking
- **Comprehensive audit logging** of all actions
- **Permission-based access control** with granular permissions
- **Session timeout** and concurrent session limits
- **Password policies** and account lockout

## 📝 API Documentation

### Swagger Documentation
- **Interactive API docs** at `/api/docs`
- **OpenAPI 3.0 specification**
- **Request/response examples**
- **Authentication examples**
- **Error response documentation**

### Postman Collection
- **Complete API collection** available
- **Environment configurations**
- **Authentication setup**
- **Example requests** for all endpoints

## 🤝 Contributing

1. Follow the coding standards
2. Write tests for new features
3. Update documentation
4. Create pull requests
5. Follow semantic versioning

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- 📧 Email: backend-support@viralfx.com
- 📖 Documentation: `/docs` folder
- 🐛 Issues: Create GitHub issue

## 🛠️ API Marketplace Billing

The ViralFX backend includes a comprehensive API marketplace billing system with automated invoice generation, PDF invoicing, email notifications, and payment reminders.

### 📋 Features

- **Automated Monthly Billing** - Automatically generate invoices for API usage
- **PDF Invoice Generation** - Professional invoices generated using `pdf-lib` with company branding
- **Multi-Stage Payment Reminders** - Automated reminders at 3, 7, and 14 days overdue
- **S3 Storage Integration** - Invoices stored securely in S3 with signed URL access
- **Multi-Provider Email System** - Email notifications via SMTP, SendGrid, Mailgun, or SES
- **Customer Management** - Support for both individual users and broker organizations
- **VAT Calculation** - Automatic VAT calculation (15% for South Africa)
- **Payment Gateway Integration** - Support for PayStack, PayFast, and Ozow

### ⚙️ Configuration

#### Environment Variables
```env
# API Marketplace Billing Configuration
API_INVOICE_REMINDER_DAYS=3,7,14  # Days after due date to send reminders
API_INVOICE_DUE_DAYS=7  # Days after billing period end for payment
API_LATE_PAYMENT_FEE_PERCENT=5  # Late payment fee percentage
API_SUSPENSION_GRACE_DAYS=21  # Days before API access suspension

# Currency and Tax
API_BILLING_CURRENCY=ZAR
API_BILLING_VAT_RATE=0.15

# Storage
S3_BUCKET=viralfx-storage
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

#### Email Templates
- **`api-invoice`** - Sent when new invoice is generated
- **`payment-reminder`** - Sent at configured intervals for overdue invoices

### 📊 PDF Generation

Invoices are automatically generated as professional PDF documents with:

- **Company branding** and logo
- **Invoice details** (ID, date, due date, billing period)
- **Customer information**
- **Line items table** with quantity, unit price, and amounts
- **VAT calculation** and totals
- **Payment instructions** and contact information

PDFs are uploaded to S3 at `invoices/api/{invoiceId}.pdf` with metadata for tracking.

### 🔄 Automated Billing Cycle

1. **Monthly Billing Job** (`handleMonthlyBillingCycle`):
   - Runs on the first day of each month
   - Identifies all users/brokers with active API keys
   - Queues invoice generation for each customer

2. **Invoice Generation** (`handleInvoiceGeneration`):
   - Calculates usage and subscription fees
   - Generates professional PDF invoice
   - Uploads PDF to S3 storage
   - Sends invoice email notification
   - Triggers webhook notifications

3. **Payment Reminders** (`handlePaymentReminders`):
   - Runs daily to check for overdue invoices
   - Sends reminders at 3, 7, and 14 days overdue
   - Uses urgency-based styling (friendly → important → urgent)
   - Includes payment links and download URLs

### 📧 Email Notifications

#### Invoice Email (`api-invoice`)
- Professional HTML template with company branding
- Invoice summary box with key details
- Complete line item breakdown
- Payment due date warning
- Direct link to download PDF

#### Payment Reminder (`payment-reminder`)
- Dynamic urgency styling based on days overdue
- Service impact warnings for severely overdue accounts
- Pay Now and View Invoice buttons
- Support contact information

### 💾 Storage Integration

The billing system integrates with the StorageService for:

- **PDF Upload**: Invoices uploaded to S3 with proper metadata
- **Signed URLs**: Secure, time-limited access to invoice PDFs
- **File Management**: Automatic cleanup and organization

### 🎯 Usage Examples

#### Generate Invoice Manually
```typescript
const invoice = await billingService.generateInvoice(
  customerId,
  'USER', // or 'BROKER'
  {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31')
  }
);
```

#### Send Payment Reminder
```typescript
await notificationService.sendEmail({
  to: customer.email,
  subject: `Payment Reminder: Invoice ${invoice.id}`,
  template: 'payment-reminder',
  data: {
    customerName: customer.firstName,
    invoiceId: invoice.id,
    amount: invoice.amountDue,
    daysOverdue: 7,
    pdfUrl: invoice.invoicePdfUrl,
    paymentUrl: `${FRONTEND_URL}/billing/invoices/${invoice.id}`
  }
});
```

### 📈 Monitoring & Analytics

The billing system includes comprehensive monitoring:

- **Invoice Generation Metrics** - Success rates, processing times
- **Email Delivery Tracking** - Send rates, bounce handling
- **Payment Processing Analytics** - Conversion rates, gateway performance
- **Customer Payment Patterns** - Late payment trends, reminder effectiveness

### 🔧 Integration Points

#### Storage Service
```typescript
await storageService.uploadFile(
  pdfBuffer,
  `invoices/api/${invoiceId}.pdf`,
  {
    contentType: 'application/pdf',
    metadata: { invoiceId, customerId, customerType }
  }
);
```

#### Notification Service
```typescript
await notificationService.sendEmail({
  to: customer.email,
  subject: 'Your API Invoice from ViralFX',
  template: 'api-invoice',
  data: invoiceData
});
```

#### Webhook Service
```typescript
await webhookService.triggerWebhook('invoice.created', {
  invoiceId: invoice.id,
  customerId: customerId,
  amount: invoice.amountDue,
  currency: invoice.currency
});
```

### 🛡️ Error Handling

The billing system includes robust error handling:

- **PDF Generation Fallback** - Placeholder URL if PDF generation fails
- **Email Retry Logic** - Multiple provider fallback for email delivery
- **Invoice Duplicates** - Prevention of duplicate invoice generation
- **Graceful Degradation** - Service continues even if non-critical features fail

---

**Built with ❤️ by the ViralFX Backend Team**