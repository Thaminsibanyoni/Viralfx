# CRM Implementation Blueprint

**✅ IMPLEMENTATION COMPLETE - This blueprint documents the fully implemented CRM module. All components, services, database models, and integrations are operational as of November 20, 2025. See backend/src/modules/crm/ for source code and backend/prisma/schema.prisma (lines 1243-1900) for database schema.**

---

## Section 1: High-Level Goals

### Core Objectives

The CRM system serves as the central nervous system for broker management, client relationships, and financial operations. The core objectives include:

- **Broker Onboarding with KYC & FSCA Compliance**: Complete digital onboarding workflow with document verification, regulatory compliance checks, and automated risk assessment
- **Billing & Invoicing**: Comprehensive billing system supporting recurring subscriptions, usage-based billing, manual invoice creation, and automated payment processing
- **CRM Contacts & Client Records**: Unified client management with interaction tracking, communication history, and relationship mapping
- **Sales Pipeline & Deals**: Visual pipeline management with deal tracking, opportunity scoring, and revenue forecasting
- **Support Ticketing with SLAs**: Complete helpdesk system with ticket assignment, SLA monitoring, escalation workflows, and performance analytics
- **Admin Notes/Tasks/Internal Audit**: Internal collaboration tools with audit trails, task management, and compliance reporting
- **Integrations**: Seamless integration with Payments, Wallets, Notifications, Audit, Files (S3/MinIO), and WalletService

### Scalability Targets

- **Brokers**: Support for thousands of broker accounts with multi-tier subscription management
- **Clients**: Capacity for 100,000+ client records with efficient query performance
- **Transactions**: High-volume invoice and payment processing with automated reconciliation
- **Documents**: Scalable file storage with virus scanning and compliance verification
- **API Performance**: Sub-200ms response times for critical CRM operations

---

## Section 2: Database (Prisma) — Core Models

### Complete Prisma Schema

The CRM module implements 23 core database models with comprehensive relationships and indexing. The schema is located in `backend/prisma/schema.prisma` starting at line 1243.

### Core Enums

```prisma
enum BrokerTier {
  STARTER
  VERIFIED
  PARTNER
  ENTERPRISE
}

enum BrokerFscaStatus {
  PENDING
  VERIFIED
  REJECTED
  SUSPENDED
}

enum BrokerStatus {
  ACTIVE
  SUSPENDED
  PENDING
  TERMINATED
}

enum DocumentType {
  ID_DOCUMENT
  PROOF_OF_ADDRESS
  FSCA_LICENSE
  BANK_STATEMENT
  TAX_CERTIFICATE
  COMPANY_REGISTRATION
  SHAREHOLDER_DECLARATION
  COMPLIANCE_REPORT
}

enum DocumentStatus {
  PENDING
  VERIFIED
  REJECTED
  EXPIRED
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

enum SubscriptionInterval {
  MONTHLY
  QUARTERLY
  YEARLY
}

enum ClientSegment {
  RETAIL
  INSTITUTIONAL
  CORPORATE
  HIGH_NET_WORTH
}

enum InteractionType {
  PHONE_CALL
  EMAIL
  MEETING
  NOTE
  TASK
}

enum PipelineStage {
  LEAD
  QUALIFIED
  PROPOSAL
  NEGOTIATION
  CLOSED_WON
  CLOSED_LOST
}

enum DealStatus {
  ACTIVE
  WON
  LOST
  ON_HOLD
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum TicketCategory {
  TECHNICAL
  BILLING
  COMPLIANCE
  GENERAL
  FEATURE_REQUEST
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  PENDING_CUSTOMER
  RESOLVED
  CLOSED
}
```

### Key Model Relationships

The database schema implements comprehensive relationships between all CRM entities:

- **BrokerAccount** → BrokerInvoice (1:N)
- **BrokerAccount** → BrokerPayment (1:N)
- **BrokerAccount** → BrokerSubscription (1:N)
- **BrokerAccount** → BrokerNote (1:N)
- **BrokerAccount** → BrokerDocument (1:N)
- **BrokerInvoice** → BrokerInvoiceItem (1:N)
- **BrokerInvoice** → BrokerPayment (1:N)
- **Ticket** → TicketMessage (1:N)
- **Ticket** → TicketAssignment (1:N)
- **PipelineStage** → BrokerDeal (1:N)
- **BrokerDeal** → DealActivity (1:N)
- **ClientRecord** → ClientInteraction (1:N)

### Migration Instructions

```bash
# Generate initial CRM migration
npx prisma migrate dev --name crm_init

# Generate Prisma client
npx prisma generate

# Apply migration to database
npx prisma migrate deploy

# Seed initial data (optional)
node prisma/seed-crm.js
```

---

## Section 3: Backend — NestJS Module Structure & File Stubs

### Directory Structure

```
backend/src/modules/crm/
├── controllers/           # API route handlers
│   ├── crm.controller.ts
│   ├── broker-crm.controller.ts
│   ├── billing.controller.ts
│   ├── support.controller.ts
│   ├── pipeline.controller.ts
│   ├── lead.controller.ts
│   ├── opportunity.controller.ts
│   └── contract.controller.ts
├── dto/                  # Data Transfer Objects
│   ├── create-broker-account.dto.ts
│   ├── update-broker-account.dto.ts
│   ├── create-ticket.dto.ts
│   ├── update-ticket.dto.ts
│   ├── generate-invoice.dto.ts
│   ├── record-payment.dto.ts
│   └── [additional DTOs...]
├── entities/             # Database entities
│   ├── broker-account.entity.ts
│   ├── broker-invoice.entity.ts
│   ├── broker-payment.entity.ts
│   ├── broker-subscription.entity.ts
│   ├── broker-note.entity.ts
│   ├── broker-document.entity.ts
│   ├── client-record.entity.ts
│   ├── client-interaction.entity.ts
│   ├── ticket.entity.ts
│   ├── ticket-message.entity.ts
│   ├── pipeline-stage.entity.ts
│   ├── broker-deal.entity.ts
│   └── [additional entities...]
├── processors/           # Background job processors
│   ├── crm.processor.ts
│   ├── crm-billing.processor.ts
│   └── crm-support.processor.ts
├── schedulers/           # Scheduled tasks
│   └── crm.scheduler.ts
├── services/             # Business logic services
│   ├── crm.service.ts
│   ├── broker-crm.service.ts
│   ├── billing.service.ts
│   ├── support.service.ts
│   ├── pipeline.service.ts
│   ├── activity.service.ts
│   ├── lead.service.ts
│   ├── opportunity.service.ts
│   └── contract.service.ts
└── crm.module.ts         # Module configuration
```

### Controllers (7)

1. **crm.controller.ts** - General CRM operations, client records
2. **broker-crm.controller.ts** - Broker management, onboarding, compliance
3. **billing.controller.ts** - Invoice generation, payment processing
4. **support.controller.ts** - Ticket management, SLA monitoring
5. **pipeline.controller.ts** - Sales pipeline, deal management
6. **lead.controller.ts** - Lead management, conversion workflows
7. **opportunity.controller.ts** - Opportunity tracking, forecasting
8. **contract.controller.ts** - Contract lifecycle management

### Services (9)

- **crm.service.ts** - Facade service for CRM operations
- **broker-crm.service.ts** - Broker CRUD, KYC documents, FSCA verification, status transitions, audit logs
- **billing.service.ts** - Invoice scheduling, line items, taxes, discounts, API usage reconciliation
- **support.service.ts** - Tickets, assignments, escalation, SLA timers, email notifications
- **pipeline.service.ts** - Sales pipeline CRUD, probability updates, forecasting
- **activity.service.ts** - Activity logging and tracking
- **lead.service.ts** - Lead management and conversion
- **opportunity.service.ts** - Opportunity tracking and management
- **contract.service.ts** - Contract lifecycle and document management

### Processors (3)

- **crm.processor.ts** - General CRM background tasks
- **crm-billing.processor.ts** - Invoice generation via BullMQ cron, payment reconciliation, ledger entries via WalletService
- **crm-support.processor.ts** - SLA checks, ticket escalation workflows

### Schedulers (1)

- **crm.scheduler.ts** - Scheduled CRM tasks and maintenance operations

---

## Section 4: API Endpoints (Full List)

### Base URL: `/api/v1/crm`

### Broker Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/brokers` | List brokers with filters (status, tier, fscaStatus) | Admin |
| GET | `/brokers/:id` | Get broker details + documents + invoices | Admin/Broker |
| POST | `/brokers` | Create new broker account | Admin |
| PUT | `/brokers/:id` | Update broker information | Admin/Broker |
| POST | `/brokers/:id/upload-doc` | Upload KYC documents (multipart) | Admin/Broker |
| POST | `/brokers/:id/approve` | Approve broker application | Admin |
| POST | `/brokers/:id/suspend` | Suspend broker account | Admin |
| GET | `/brokers/:id/invoices` | Get broker invoice history | Admin/Broker |
| GET | `/brokers/:id/notes` | Get broker internal notes | Admin |
| POST | `/brokers/:id/notes` | Add broker internal note | Admin |

### Billing & Invoices

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/invoices` | List invoices with filters | Admin |
| GET | `/invoices/:id` | Get invoice details with PDF link | Admin/Broker |
| POST | `/invoices` | Generate new invoice | Admin |
| PUT | `/invoices/:id` | Update invoice details | Admin |
| POST | `/invoices/:id/send` | Send invoice via email | Admin |
| POST | `/invoices/:id/pay` | Trigger payment processing | Admin/Broker |
| POST | `/payments/webhook` | Payment provider webhook (idempotent) | Public |
| GET | `/payments` | List payments with filters | Admin |
| POST | `/payments/:id/refund` | Process refund | Admin |
| GET | `/subscriptions` | List broker subscriptions | Admin |
| POST | `/subscriptions` | Create new subscription | Admin |
| PUT | `/subscriptions/:id` | Update subscription | Admin |
| POST | `/subscriptions/:id/renew` | Renew subscription | Admin |
| DELETE | `/subscriptions/:id` | Cancel subscription | Admin |

### Support Ticketing

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/tickets` | Create new support ticket | Authenticated |
| GET | `/tickets` | List tickets with filters | Admin/Staff |
| GET | `/tickets/:id` | Get ticket details + messages | Admin/Staff/Owner |
| POST | `/tickets/:id/message` | Add message to ticket | Admin/Staff/Owner |
| POST | `/tickets/:id/assign` | Assign ticket to staff member | Admin/Staff |
| POST | `/tickets/:id/escalate` | Escalate ticket priority | Admin |
| POST | `/tickets/:id/close` | Close ticket | Admin/Staff/Owner |
| GET | `/tickets/categories` | List ticket categories | Public |
| GET | `/tickets/priorities` | List ticket priorities | Public |
| GET | `/tickets/metrics` | Ticket performance metrics | Admin |

### Sales Pipeline

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/deals` | List deals with pipeline filters | Admin/Sales |
| POST | `/deals` | Create new deal opportunity | Admin/Sales |
| GET | `/deals/:id` | Get deal details with activities | Admin/Sales |
| PUT | `/deals/:id` | Update deal information | Admin/Sales |
| POST | `/deals/:id/won` | Mark deal as won | Admin/Sales |
| POST | `/deals/:id/lost` | Mark deal as lost | Admin/Sales |
| GET | `/pipeline/stages` | List pipeline stages | Admin/Sales |
| POST | `/pipeline/stages` | Create new pipeline stage | Admin |
| GET | `/pipeline/forecast` | Revenue forecasting data | Admin/Sales |

### Client Records

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/clients` | List clients with search filters | Admin |
| POST | `/clients` | Create new client record | Admin |
| GET | `/clients/:id` | Get client details with interactions | Admin |
| PUT | `/clients/:id` | Update client information | Admin |
| POST | `/clients/:id/interaction` | Log client interaction | Admin |
| GET | `/clients/:id/interactions` | Get client interaction history | Admin |
| DELETE | `/clients/:id` | Soft delete client record | Admin |

### Admin & Utilities

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/analytics/revenue` | Revenue analytics and metrics | Admin |
| GET | `/analytics/pipeline` | Pipeline performance metrics | Admin |
| GET | `/analytics/support` | Support team performance | Admin |
| POST | `/cron/run-invoice-job` | Manually trigger invoice generation | Admin |
| GET | `/health` | CRM module health status | Admin |
| GET | `/settings/billing` | Get billing configuration | Admin |
| PUT | `/settings/billing` | Update billing configuration | Admin |

**Authentication Notes:**
- All write endpoints require JWT authentication + RBAC validation
- Webhook endpoints use HMAC signature validation
- Broker users can only access their own data
- Admin endpoints require appropriate admin roles

---

## Section 5: Business Logic & Workflows

### A. Broker Onboarding Workflow

**7-Step Digital Onboarding Process:**

1. **Registration** → Broker submits basic information via application form
2. **Document Upload** → KYC documents uploaded to S3 with client-side SHA256 hashing
3. **Virus Scanning** → Background worker scans all uploaded files
4. **FSCA Validation** → Automated verification against regulatory database (when available)
5. **Admin Review** → Manual review of application and documents
6. **Risk Assessment** → Automated risk scoring based on business type and location
7. **Approval** → Final approval triggers account activation and initial invoice

**Implementation Details:**
- Documents stored in MinIO/S3 with pre-signed URLs
- Virus scanning via ClamAV integration
- FSCA validation through regulatory API (when available)
- Risk assessment algorithm configurable via PlatformSettings
- Automated email notifications at each step
- Full audit trail logging in AuditLog table

### B. Invoice Generation + Recurring Billing

**Daily Billing Cycle (02:00 UTC):**

1. **Cron Trigger** → BullMQ repeatable job triggers billing processor
2. **Subscription Query** → Find all active subscriptions due for billing
3. **Usage Calculation** → Aggregate API usage from APIUsageRecord table
4. **Invoice Creation** → Generate BrokerInvoice with line items:
   - Base subscription fee
   - API usage charges (calculated per-tier pricing)
   - Overage charges (usage beyond limits)
   - One-off fees (setup, support, etc.)
   - VAT calculation (based on broker location)
5. **PDF Generation** → Create invoice PDF using HTML template
6. **Email Dispatch** → Send invoice with payment link
7. **Payment Scheduling** → Schedule automatic payment attempt
8. **Webhook Setup** → Configure payment provider webhook

**Key Features:**
- Idempotent processing with Redis distributed locks
- Configurable billing cycles (monthly, quarterly, yearly)
- Multi-currency support with real-time conversion
- Tax calculation based on jurisdiction
- Automated dunning process for overdue invoices
- Integration with WalletService for ledger credits

### C. Support Ticket Lifecycle

**Complete Ticket Management Flow:**

1. **Ticket Creation** → Customer creates ticket via portal, email, or API
2. **Auto-Classification** → NLP-based category and priority assignment
3. **SLA Timer Start** → Response timer based on priority level
4. **Assignment** → Manual or round-robin assignment to support staff
5. **Communication** → Message exchange with file attachments
6. **SLA Monitoring** → Background worker checks for SLA breaches
7. **Escalation** → Automatic escalation on SLA breach or inactivity
8. **Resolution** → Ticket marked as resolved with customer confirmation
9. **Closure** → Final closure with satisfaction survey

**SLA Configuration:**
- Critical: 1 hour response, 4 hour resolution
- High: 4 hour response, 24 hour resolution
- Medium: 24 hour response, 72 hour resolution
- Low: 48 hour response, 1 week resolution

### D. Sales Pipeline Management

**Lead to Client Conversion:**

1. **Lead Capture** → Automatic lead creation from website forms, referrals, imports
2. **Lead Scoring** → Algorithmic scoring based on demographics and behavior
3. **Qualification** → Manual review and qualification by sales team
4. **Opportunity Creation** → Qualified leads converted to opportunities
5. **Pipeline Stage Progression** → Visual Kanban board with drag-and-drop
6. **Deal Management** → Probability scoring, revenue forecasting
7. **Win Conversion** → Successful deal creates broker account
8. **Onboarding Kickoff** → Automated onboarding task creation
9. **BrokerNote Assignment** → Internal notes and task assignments

**Pipeline Stages:**
- Lead → Qualified → Proposal → Negotiation → Won/Lost
- Each stage configurable with custom fields
- Automated stage progression based on criteria
- Revenue forecasting with probability weighting

### E. Refund & Dispute Flow

**Financial Dispute Resolution:**

1. **Dispute Initiation** → Customer or broker creates RefundRequest
2. **Evidence Collection** → Required documentation upload
3. **FinanceOps Review** → Internal review by finance team
4. **Decision Making** → Approve, partial approve, or reject
5. **Refund Processing** → Create BrokerPayment with REFUNDED status
6. **Ledger Adjustment** → WalletService ledger corrections
7. **Notification** → Automated notifications to all parties
8. **Audit Trail** → Complete audit log for compliance

---

## Section 6: RBAC & Permissions

### CRM Permission Matrix

| Permission | Description | SuperAdmin | FinanceOps | BrokerOps | SalesOps | SupportOps | AuditOps |
|------------|-------------|------------|------------|-----------|----------|------------|----------|
| `crm.brokers.create` | Create new broker accounts | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| `crm.brokers.read` | View broker information | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `crm.brokers.update` | Update broker details | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| `crm.brokers.approve` | Approve broker applications | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| `crm.brokers.suspend` | Suspend broker accounts | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| `crm.invoices.read` | View invoices and billing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `crm.invoices.manage` | Create/edit invoices | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `crm.payments.manage` | Process payments and refunds | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `crm.tickets.read` | View support tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `crm.tickets.manage` | Manage tickets (assign/close) | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| `crm.deals.read` | View sales pipeline | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| `crm.deals.manage` | Create/edit deals | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| `crm.reports.read` | View analytics and reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `crm.settings.manage` | Manage CRM settings | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### Role Definitions

- **SuperAdmin**: Full access to all CRM functions and settings
- **FinanceOps**: Billing, invoicing, payment processing, financial reports
- **BrokerOps**: Broker approval, suspension, compliance management
- **SalesOps**: Deal management, pipeline, revenue forecasting
- **SupportOps**: Ticket management, customer support operations
- **AuditOps**: Read-only access to audit logs and compliance reports

### Permission Implementation

Permissions are enforced at multiple levels:

1. **Controller Level**: Guard decorators check permissions before route execution
2. **Service Level**: Business logic validates permissions for data access
3. **Database Level**: Row-level security for sensitive data
4. **API Level**: Rate limiting and request validation

```typescript
// Example permission guard
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('crm.brokers.approve')
@Post('/brokers/:id/approve')
async approveBroker(@Param('id') id: string) {
  // Implementation
}
```

---

## Section 7: Frontend — Folder Tree + Key Components

### Frontend Directory Structure

```
frontend/src/
├── pages/admin/crm/          # CRM page components
│   ├── BrokersPage.tsx       # Broker listing and management
│   ├── BrokerDetailPage.tsx  # Individual broker view
│   ├── BillingPage.tsx       # Invoice and billing management
│   ├── InvoiceView.tsx       # Invoice detail and PDF viewer
│   ├── TicketsPage.tsx       # Support ticket management
│   ├── TicketDetail.tsx      # Individual ticket view
│   ├── DealsPage.tsx         # Sales pipeline and deals
│   ├── ClientsPage.tsx       # Client management
│   └── CRMSettings.tsx       # CRM configuration
├── components/crm/           # Reusable CRM components
│   ├── BrokerCard.tsx        # Broker display card
│   ├── BrokerForm.tsx        # Broker creation/edit form
│   ├── DocumentUpload.tsx    # File upload with progress
│   ├── InvoiceTable.tsx      # Invoice listing table
│   ├── InvoicePdfViewer.tsx  # PDF invoice viewer
│   ├── TicketList.tsx        # Ticket listing component
│   ├── TicketComposer.tsx    # Ticket creation/composition
│   ├── PipelineKanban.tsx    # Visual pipeline board
│   ├── ClientForm.tsx        # Client creation/edit form
│   └── ActivityTimeline.tsx  # Activity history component
├── services/
│   └── crm.service.ts        # CRM API service layer
└── stores/
    └── crm.store.ts          # CRM state management
```

### Key Component Features

**Broker Management Components:**
- Advanced search and filtering with real-time results
- Document upload with drag-and-drop and progress tracking
- Status workflow visualization (pending → approved → active)
- Compliance checklist and document verification status
- Bulk operations for broker management

**Billing Components:**
- Interactive invoice table with sorting and filtering
- PDF invoice viewer with download and print options
- Payment status tracking with visual indicators
- Recurring billing configuration interface
- Revenue analytics dashboard

**Support Ticket Components:**
- Real-time ticket list with priority indicators
- Rich text message composer with file attachments
- SLA timer visualization with breach warnings
- Agent assignment interface with workload balancing
- Ticket satisfaction surveys and feedback

**Sales Pipeline Components:**
- Drag-and-drop Kanban board for deal management
- Revenue forecasting charts and probability scoring
- Deal detail view with activity timeline
- Team performance metrics and leaderboards
- Automated deal scoring and recommendations

### Technology Stack

- **UI Framework**: React with TypeScript
- **Styling**: Tailwind CSS + HeadlessUI components
- **State Management**: Redux Toolkit with RTK Query
- **Charts**: Recharts for analytics visualizations
- **File Handling**: react-dropzone for uploads
- **PDF Generation**: React-PDF for invoice viewing
- **Real-time**: WebSocket integration for live updates

### UX Requirements

- **Responsive Design**: Mobile-first approach with breakpoints
- **Accessibility**: WCAG 2.1 AA compliance with ARIA labels
- **Performance**: Virtual scrolling for large datasets
- **Dark Mode**: System preference detection with toggle
- **Internationalization**: Multi-language support ready
- **Offline Support**: Service worker for critical functions

---

## Section 8: Queues & Background Jobs (BullMQ)

### Queue Configuration

The CRM system uses Redis-based BullMQ for reliable background job processing:

```typescript
// Queue definitions in crm.module.ts
BullModule.registerQueue([
  { name: 'crm-tasks' },        // General CRM operations
  { name: 'crm-billing' },      // Invoice generation and payments
  { name: 'crm-support' },      // SLA monitoring and escalation
  { name: 'crm-reminders' },    // Automated notifications
  { name: 'crm-documents' },    // Document processing and scanning
]);
```

### Job Types and Processing

#### 1. crm-billing Queue

**Invoice Generation Job:**
- **Trigger**: Daily cron at 02:00 UTC
- **Processor**: `CrmBillingProcessor.generateInvoices()`
- **Idempotency**: Redis locks prevent duplicate invoice generation
- **Retry Logic**: 3 retries with exponential backoff
- **Logging**: Complete audit trail in AuditLog table

**Payment Reconciliation Job:**
- **Trigger**: Payment provider webhook
- **Processor**: `CrmBillingProcessor.reconcilePayment()`
- **Idempotency**: Webhook idempotency keys
- **Integration**: WalletService ledger updates
- **Notifications**: Email/SMS confirmations

#### 2. crm-support Queue

**SLA Monitoring Job:**
- **Trigger**: Every 5 minutes
- **Processor**: `CrmSupportProcessor.checkSLA()`
- **Actions**: Escalation, notifications, priority updates
- **Metrics**: SLA compliance tracking
- **Reporting**: Daily SLA performance reports

**Ticket Assignment Job:**
- **Trigger**: New ticket creation
- **Processor**: `CrmSupportProcessor.assignTicket()`
- **Logic**: Round-robin with workload balancing
- **Escalation**: Auto-escalate if no assignment within timeout

#### 3. crm-documents Queue

**Document Processing Job:**
- **Trigger**: File upload completion
- **Processor**: `CrmDocumentProcessor.processDocument()`
- **Actions**: Virus scanning, content validation, OCR
- **Security**: Sandbox execution environment
- **Storage**: S3/MinIO with lifecycle policies

#### 4. crm-reminders Queue

**Automated Notification Job:**
- **Trigger**: Scheduled reminders
- **Processor**: `CrmReminderProcessor.sendReminders()`
- **Types**: Payment due, document expiry, follow-ups
- **Channels**: Email, SMS, in-app notifications
- **Templates**: Personalized content generation

### Worker Configuration

```typescript
// Production worker configuration
{
  concurrency: 5,              // Max concurrent jobs per worker
  removeOnComplete: 100,       // Keep completed jobs
  removeOnFail: 50,            // Keep failed jobs for debugging
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
}
```

### Monitoring and Alerting

- **Queue Length Monitoring**: Alert on queue buildup
- **Job Failure Rate**: Alert on >5% failure rate
- **Processing Time**: Monitor job duration trends
- **Worker Health**: Check worker availability and performance
- **Dead Letter Queue**: Manual review of failed jobs

---

## Section 9: Integrations & External Services

### File Storage Integration

**MinIO/S3 Configuration:**
- **Endpoint**: Configurable MinIO/S3 endpoint
- **Buckets**: Separate buckets for documents, invoices, attachments
- **Security**: Pre-signed URLs with expiration
- **Encryption**: Server-side encryption for sensitive files
- **Lifecycle**: Automatic archival and deletion policies

**Document Processing Pipeline:**
```typescript
// Document upload workflow
1. Client generates SHA256 hash
2. Upload to pre-signed S3 URL
3. Trigger virus scan job (ClamAV)
4. Content validation and OCR (Tesseract)
5. Extract metadata and keywords
6. Store in database with references
7. Update broker compliance status
```

### Email/SMS Integration

**SendGrid Email Service:**
- **Templates**: Dynamic Handlebars templates
- **Categories**: Transactional, marketing, compliance
- **Analytics**: Open/click tracking, bounces
- **Delivery**: Batch sending with rate limiting
- **Personalization**: Dynamic content based on user data

**Twilio SMS Integration:**
- **Numbers**: Dedicated phone numbers per region
- **Templates**: Pre-approved message templates
- **Compliance**: TCPA and GDPR compliant
- **Scheduling**: Message timing optimization
- **Delivery**: Delivery receipts and status tracking

### Payment Provider Integration

**Paystack Integration:**
- **Regions**: Nigeria, Ghana, South Africa
- **Features**: Card payments, bank transfers, USSD
- **Webhooks**: Real-time payment notifications
- **Security**: HMAC signature validation
- **Refunds**: Automated refund processing

**PayFast Integration:**
- **Regions**: South Africa primary
- **Features**: Credit card, EFT, Zapper, Bitcoin
- **Settlement**: Automated daily settlement
- **Reconciliation**: Transaction matching
- **Reporting**: Daily reconciliation reports

**Payment Processing Flow:**
```typescript
1. Generate payment link with unique reference
2. Customer redirected to provider payment page
3. Provider processes payment securely
4. Webhook notification sent to our endpoint
5. Verify signature and process payment
6. Update invoice status and send confirmation
7. Credit broker wallet via WalletService
```

### WalletService Integration

**Ledger Management:**
- **Credit Operations**: `walletService.creditBroker(brokerId, amount, metadata)`
- **Debit Operations**: `walletService.debitBroker(brokerId, amount, metadata)`
- **Balance Queries**: Real-time balance checking
- **Transaction History**: Complete audit trail
- **Currency Support**: Multi-currency ledger entries

**Reconciliation Process:**
```typescript
// Payment reconciliation with WalletService
1. Receive payment webhook with transaction details
2. Verify payment authenticity with provider
3. Create BrokerPayment record
4. Update BrokerInvoice status to PAID
5. Credit broker wallet with net amount (fees deducted)
6. Generate internal ledger entry
7. Send confirmation notifications
```

### FSCA Validation Integration

**Regulatory Compliance:**
- **API Integration**: FSCA verification API (when available)
- **Manual Review**: Fallback to manual verification queue
- **Document Validation**: Automated document verification
- **Risk Scoring**: Algorithmic risk assessment
- **Audit Trail**: Complete compliance documentation

**Validation Workflow:**
```typescript
1. Submit broker details to FSCA API
2. Receive verification response (if available)
3. Validate FSCA license number and status
4. Cross-reference with business registration
5. Perform enhanced due diligence for high-risk categories
6. Generate compliance report
7. Store validation results for audit purposes
```

### Accounting/ERP Integration

**Financial Data Export:**
- **Formats**: CSV, JSON, XLSX exports
- **Scheduling**: Monthly/weekly automated exports
- **Mapping**: Configurable field mapping
- **Validation**: Data integrity checks
- **Delivery**: SFTP, email, API endpoints

**Export Data Includes:**
- Invoices and payments
- Broker transactions
- Tax calculations and VAT
- Revenue recognition
- Expense tracking

---

## Section 10: Security & Compliance

### Authentication & Authorization

**Multi-Layer Security:**
1. **JWT Authentication**: Secure token-based authentication
2. **Role-Based Access Control**: Granular permission system
3. **API Rate Limiting**: Prevent abuse and brute force attacks
4. **IP Whitelisting**: Admin endpoint protection
5. **Session Management**: Secure session handling with expiration

**JWT Token Structure:**
```typescript
interface JWTPayload {
  sub: string;        // User ID
  email: string;      // User email
  role: Role;         // User role (ADMIN, BROKER, etc.)
  permissions: string[]; // User permissions
  brokerId?: string;  // Associated broker ID (if applicable)
  iat: number;        // Issued at
  exp: number;        // Expires at
}
```

### Data Protection

**Encryption Standards:**
- **At Rest**: AES-256 encryption for sensitive data
- **In Transit**: TLS 1.3 for all communications
- **Key Management**: Hardware Security Module (HSM) for keys
- **Field-Level Encryption**: Sensitive fields encrypted individually

**Sensitive Data Handling:**
```typescript
// Encrypted fields in database
{
  apiSecretHash: string,     // Hashed API secrets
  bankAccountNumber: string, // Encrypted bank details
  taxNumber: string,         // Encrypted tax information
  contactPhone: string,      // Encrypted phone numbers
}
```

### File Upload Security

**Multi-Stage Validation:**
1. **Client-Side Validation**: File type, size, and format checks
2. **Server-Side Validation**: MIME type verification and magic number checking
3. **Virus Scanning**: ClamAV integration for malware detection
4. **Content Analysis**: OCR and content validation
5. **Storage Security**: Isolated storage with access controls

**Upload Security Measures:**
- **File Type Restrictions**: Whitelist of allowed file types
- **Size Limitations**: Maximum file size per type
- **Name Sanitization**: Remove special characters and paths
- **Metadata Stripping**: Remove EXIF and metadata from images
- **Access Control**: Pre-signed URLs with expiration

### PCI Compliance

**Payment Card Security:**
- **Tokenization**: Never store raw card numbers
- **Provider Integration**: Use PCI DSS compliant payment providers
- **Data Minimization**: Store only necessary payment data
- **Secure Storage**: Encrypted storage of payment tokens
- **Access Logging**: All payment access logged and audited

### Audit Trail

**Comprehensive Logging:**
```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress: string;
  userAgent: string;
  timestamp: DateTime;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'SECURITY' | 'BUSINESS' | 'COMPLIANCE' | 'SYSTEM';
}
```

**Logging Requirements:**
- **All State Changes**: Every data modification logged
- **Access Logging**: All data access events recorded
- **Authentication Events**: Login, logout, failed attempts
- **Admin Actions**: All administrative operations logged
- **System Events**: Background jobs and automated processes

### Data Privacy & Compliance

**GDPR/POPIA Compliance:**
- **Data Minimization**: Collect only necessary data
- **Consent Management**: Explicit consent for data processing
- **Right to Erasure**: Automated data deletion workflows
- **Data Portability**: Export user data on request
- **Breach Notification**: Automated breach detection and notification

**Data Retention Policies:**
- **Configurable Retention**: PlatformSettings controlled retention periods
- **Automated Deletion**: Scheduled data archival and deletion
- **Legal Hold**: Preserve data for legal requirements
- **Archive Strategy**: Long-term archival for compliance

### Rate Limiting & DDoS Protection

**Multi-Level Rate Limiting:**
1. **Global Rate Limits**: Overall API usage limits
2. **Endpoint-Specific Limits**: Different limits per endpoint type
3. **User-Based Limits**: Per-user rate limiting
4. **IP-Based Limits**: Geographic and IP-based restrictions
5. **Burst Protection**: Handle traffic spikes gracefully

**Rate Limit Configuration:**
```typescript
// Example rate limiting rules
{
  'crm.brokers.create': { requests: 5, window: '1m' },
  'crm.invoices.generate': { requests: 10, window: '1m' },
  'crm.tickets.create': { requests: 20, window: '1m' },
  'crm.documents.upload': { requests: 50, window: '1m' },
}
```

---

## Section 11: Observability & Monitoring

### Key Performance Metrics

**Business Metrics:**
- **Invoice Metrics**: `invoices.created`, `invoices.paid`, `invoices.overdue`
- **Payment Processing**: `payment.success.rate`, `payment.failure.rate`
- **Broker Management**: `broker.onboarded`, `broker.suspended`, `broker.active`
- **Support Performance**: `tickets.created`, `tickets.resolution.time`, `tickets.sla.compliance`
- **Sales Pipeline**: `deals.created`, `deals.won.rate`, `pipeline.value`

**Technical Metrics:**
- **API Performance**: `api.latency.crm.*` with p95/p99 percentiles
- **Database Performance**: `db.query.time.crm`, `db.connections.crm`
- **Queue Metrics**: `queue.length.crm-*`, `queue.processing.time`
- **Background Jobs**: `job.success.rate`, `job.failure.rate`, `job.retry.count`
- **System Resources**: `memory.usage.crm`, `cpu.usage.crm`

### Monitoring Dashboard

**CRM Health Dashboard:**
```typescript
// Real-time dashboard metrics
{
  overview: {
    totalBrokers: 1247,
    activeBrokers: 892,
    monthlyRevenue: 234567.89,
    outstandingInvoices: 45,
    openTickets: 23,
    slaCompliance: 94.5,
  },

  performance: {
    apiResponseTime: '67ms',
    invoiceProcessingTime: '2.3s',
    ticketResolutionTime: '4.2h',
    documentScanTime: '1.1s',
  },

  alerts: [
    { type: 'WARNING', message: 'SLA breach for ticket #1234' },
    { type: 'ERROR', message: 'Payment webhook failure for PayStack' },
    { type: 'INFO', message: 'Daily invoice generation completed' },
  ]
}
```

**Financial Operations Dashboard:**
- **Revenue Tracking**: MRR, ARR, churn rate, expansion revenue
- **Invoice Aging**: 0-30, 31-60, 61-90, 90+ day breakdowns
- **Payment Success Rate**: Provider breakdown and trends
- **Revenue Recognition**: Recognized vs billed revenue
- **Cost Analysis**: Payment processing fees, operational costs

**Sales Operations Dashboard:**
- **Pipeline Value**: Total pipeline value by stage and probability
- **Conversion Rates**: Lead to opportunity, opportunity to close
- **Sales Performance**: Individual and team performance metrics
- **Deal Velocity**: Average time from lead to close
- **Forecast Accuracy**: Actual vs projected revenue

**Support Operations Dashboard:**
- **Ticket Volume**: Incoming tickets by category and priority
- **Resolution Metrics**: Average resolution time by category
- **SLA Compliance**: Percentage of tickets meeting SLA
- **Agent Performance**: Individual agent metrics and rankings
- **Customer Satisfaction**: CSAT scores and trends

### Alerting Configuration

**Critical Alerts:**
- **Payment Failures**: Immediate alert on payment webhook failures
- **Security Incidents**: Instant alerts on security breaches
- **SLA Breaches**: Real-time alerts on SLA violations
- **System Outages**: Immediate alerts on service downtime
- **Data Corruption**: Alerts on data integrity issues

**Warning Alerts:**
- **Queue Buildup**: Alert on queue length exceeding threshold
- **Performance Degradation**: Alerts on response time degradation
- **Unusual Activity**: Alerts on anomalous usage patterns
- **Resource Usage**: Alerts on high memory or CPU usage

**Informational Alerts:**
- **Daily Reports**: Daily summary reports and metrics
- **Batch Completions**: Notifications for completed batch jobs
- **System Maintenance**: Scheduled maintenance notifications

### Logging Strategy

**Structured Logging:**
```typescript
// Structured log entry example
{
  timestamp: '2025-01-20T10:30:45.123Z',
  level: 'INFO',
  service: 'crm-billing',
  module: 'invoice-generation',
  operation: 'generate-invoice',
  correlationId: 'abc-123-xyz-789',
  userId: 'user-123',
  brokerId: 'broker-456',
  invoiceId: 'invoice-789',
  duration: 2345, // milliseconds
  status: 'SUCCESS',
  metadata: {
    invoiceAmount: 1500.00,
    billingCycle: 'MONTHLY',
    paymentMethod: 'AUTOMATIC',
  }
}
```

**Log Aggregation:**
- **Centralized Logging**: ELK Stack or CloudWatch integration
- **Log Retention**: 90 days default, extended for audit logs
- **Log Analysis**: Automated analysis for anomaly detection
- **Search Capabilities**: Full-text search across logs
- **Real-time Streaming**: Real-time log processing and alerting

### Health Checks

**Application Health Endpoints:**
```typescript
// Health check response structure
{
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY',
  timestamp: '2025-01-20T10:30:45.123Z',
  version: '1.2.3',
  uptime: 86400, // seconds

  checks: {
    database: {
      status: 'HEALTHY',
      latency: 15, // milliseconds
    },

    redis: {
      status: 'HEALTHY',
      memory: '45%',
      connections: 23,
    },

    externalServices: {
      paystack: 'HEALTHY',
      sendgrid: 'HEALTHY',
      s3: 'HEALTHY',
    },

    queues: {
      'crm-billing': {
        status: 'HEALTHY',
        waiting: 5,
        active: 2,
        failed: 0,
      },
    },
  }
}
```

---

## Section 12: Testing Requirements

### Unit Testing

**Backend Service Tests (94% Coverage Target):**

```typescript
// Example test structure
describe('BrokerCrmService', () => {
  describe('createBroker', () => {
    it('should create broker with valid data', async () => {
      // Test implementation
    });

    it('should validate required fields', async () => {
      // Test implementation
    });

    it('should check for duplicate registration', async () => {
      // Test implementation
    });
  });

  describe('approveBroker', () => {
    it('should approve broker with valid documents', async () => {
      // Test implementation
    });

    it('should reject broker with missing documents', async () => {
      // Test implementation
    });
  });
});
```

**Service Coverage Requirements:**
- **BrokerCrmService**: 96% coverage
- **BillingService**: 94% coverage
- **SupportService**: 95% coverage
- **PipelineService**: 93% coverage
- **ActivityService**: 90% coverage

**Frontend Component Tests (91% Coverage Target):**
- **Dashboard Components**: 89% coverage
- **Form Validation**: 95% coverage
- **Data Transformation**: 88% coverage
- **User Interactions**: 92% coverage
- **API Integration**: 90% coverage

### Integration Testing

**API Endpoint Integration Tests:**
```typescript
// Integration test example
describe('CRM API Integration', () => {
  describe('POST /api/v1/crm/brokers', () => {
    it('should create broker and send welcome email', async () => {
      const response = await request(app)
        .post('/api/v1/crm/brokers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validBrokerData)
        .expect(201);

      expect(response.body.status).toBe('PENDING');
      expect(emailService.sendWelcomeEmail).toHaveBeenCalled();
    });
  });
});
```

**Workflow Integration Tests:**
- **Invoice Generation**: Complete billing cycle with mocked usage data
- **Payment Processing**: Webhook handling with sample provider payloads
- **Ticket SLA**: Escalation job testing with time manipulation
- **Document Upload**: File processing pipeline with virus scanning
- **Broker Onboarding**: Complete 7-step onboarding workflow

### End-to-End Testing

**Critical User Journey Tests:**

```typescript
// E2E test using Playwright or Cypress
describe('Broker Onboarding E2E', () => {
  it('should complete full broker onboarding flow', async () => {
    // 1. Admin creates broker account
    await page.goto('/admin/crm/brokers/create');
    await page.fill('[data-testid="company-name"]', 'Test Broker Ltd');
    await page.click('[data-testid="submit"]');

    // 2. Broker uploads KYC documents
    await page.goto('/broker/onboarding');
    await page.setInputFiles('[data-testid="id-upload"]', 'test-id.pdf');
    await page.click('[data-testid="upload-documents"]');

    // 3. Admin reviews and approves
    await page.goto('/admin/crm/brokers/pending');
    await page.click('[data-testid="review-broker"]');
    await page.click('[data-testid="approve-broker"]');

    // 4. Verify invoice generation
    await page.goto(`/admin/crm/brokers/${brokerId}/invoices`);
    await expect(page.locator('[data-testid="invoice-row"]')).toHaveCount(1);
  });
});
```

**E2E Test Scenarios:**
- **Complete Broker Lifecycle**: Registration → Approval → Invoicing → Payment
- **Support Ticket Flow**: Creation → Assignment → Resolution → Closure
- **Sales Pipeline**: Lead → Opportunity → Won → Broker Creation
- **Document Processing**: Upload → Scan → Validation → Approval
- **Payment Reconciliation**: Invoice → Payment → Ledger Credit → Notification

### Performance Testing

**Load Testing Scenarios:**
- **Concurrent Users**: 2,500+ simultaneous users
- **API Response Times**: <300ms for 95% of requests
- **Database Performance**: <100ms query times
- **File Upload**: Handle 100+ concurrent uploads
- **Batch Processing**: Process 10,000+ invoices in <1 hour

**Stress Testing:**
- **Peak Load Simulation**: 5x normal traffic
- **Database Connection Limits**: Test connection pool exhaustion
- **Memory Usage**: Monitor for memory leaks
- **Queue Processing**: Test with 100,000+ queued jobs
- **File Storage**: Test with 1TB+ of documents

### Security Testing

**Security Test Requirements:**
- **Penetration Testing**: Annual third-party penetration testing
- **Vulnerability Scanning**: Weekly automated vulnerability scans
- **Authentication Testing**: Test for common auth bypasses
- **Authorization Testing**: Verify RBAC enforcement
- **Input Validation**: Test for injection attacks (SQL, NoSQL, XSS)
- **File Upload Security**: Test malicious file upload attempts

**Security Test Tools:**
- **OWASP ZAP**: Automated security scanning
- **Burp Suite**: Manual security testing
- **Nessus**: Vulnerability scanning
- **SQLMap**: SQL injection testing
- **Metasploit**: Penetration testing framework

---

## Section 13: Deployment + Migration Notes

### Database Migration Strategy

**Migration Planning:**
```bash
# Create new migration
npx prisma migrate dev --name crm_module_init

# Review generated migration files
ls -la prisma/migrations/

# Test migration on staging
npx prisma migrate deploy --preview-feature

# Backup production database before migration
pg_dump viralfx_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Deploy to production
npx prisma migrate deploy
```

**Migration Best Practices:**
- **Backwards Compatibility**: Ensure new migrations don't break existing code
- **Rollback Strategy**: Always have rollback migration ready
- **Downtime Planning**: Schedule migrations during low-traffic periods
- **Data Validation**: Validate data integrity after migration
- **Performance Testing**: Test migration performance on production-size dataset

### Application Deployment

**Container Configuration:**
```dockerfile
# Dockerfile for CRM module
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**Kubernetes Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: crm-service
  template:
    metadata:
      labels:
        app: crm-service
    spec:
      containers:
      - name: crm-service
        image: viralfx/crm-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
```

### Cron Job Configuration

**Invoice Generation CronJob:**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: invoice-generation
spec:
  schedule: "0 2 * * *"  # Daily at 02:00 UTC
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: invoice-generator
            image: viralfx/crm-service:latest
            command: ["npm", "run", "jobs:generate-invoices"]
            env:
            - name: NODE_ENV
              value: "production"
          restartPolicy: OnFailure
```

**Alternative: BullMQ Repeatable Jobs:**
```typescript
// Configure repeatable jobs in CRM module
@Processor('crm-billing')
export class CrmBillingProcessor {
  constructor(@InjectQueue('crm-billing') private billingQueue: Queue) {
    // Schedule daily invoice generation
    this.billingQueue.add('generate-invoices', {}, {
      repeat: { pattern: '0 2 * * *' }, // Daily at 02:00 UTC
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
```

### Distributed Lock Implementation

**Redis Lock for Invoice Generation:**
```typescript
@Injectable()
export class CrmBillingProcessor {
  async generateInvoices() {
    const lockKey = 'crm:billing:invoice-generation';
    const lockTTL = 3600; // 1 hour

    // Acquire distributed lock
    const lock = await this.redisService.set(lockKey, 'locked', 'PX', lockTTL * 1000, 'NX');

    if (!lock) {
      this.logger.log('Invoice generation already running, skipping');
      return;
    }

    try {
      // Perform invoice generation
      await this.performInvoiceGeneration();
    } finally {
      // Release lock
      await this.redisService.del(lockKey);
    }
  }
}
```

### Backup and Recovery

**Database Backup Strategy:**
```bash
#!/bin/bash
# Daily backup script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="viralfx_backup_${DATE}.sql"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp ${BACKUP_FILE}.gz s3://viralfx-backups/database/

# Clean local files older than 7 days
find /tmp -name "viralfx_backup_*.sql.gz" -mtime +7 -delete

# Point-in-time recovery
# pg_restore --verbose --clean --no-acl --no-owner -d viralfx_prod backup_file.sql
```

**Recovery Testing:**
- **Monthly Recovery Tests**: Test restore procedure on staging
- **RTO/RPO**: Recovery Time Objective < 4 hours, Recovery Point Objective < 1 hour
- **Backup Verification**: Verify backup integrity regularly
- **Documentation**: Maintain updated recovery procedures

### Environment Configuration

**Production Environment Variables:**
```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/viralfx"
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL="redis://host:6379"
REDIS_PASSWORD="secure_password"

# CRM Configuration
CRM_INVOICE_CRON="0 2 * * *"
CRM_SLAPAYMENT_PROVIDERS="paystack,payfast"
CRM_DOCUMENT_STORAGE="s3"
CRM_VIRUS_SCAN_ENABLED=true

# External Services
SENDGRID_API_KEY="sg_live_..."
TWILIO_ACCOUNT_SID="AC..."
PAYSTACK_SECRET_KEY="sk_live_..."
S3_BUCKET="viralfx-documents"
S3_REGION="us-east-1"

# Security
JWT_SECRET="secure_jwt_secret"
JWT_EXPIRES_IN="24h"
API_RATE_LIMIT="1000/15m"
```

---

## Section 14: Sample Prisma Migration / Seed Pseudo-Commands

### Migration Commands

```bash
# Create initial CRM migration
npx prisma migrate dev --name crm_init

# This creates migration files like:
# prisma/migrations/20250120000000_crm_init/migration.sql

# Generate Prisma Client
npx prisma generate

# Apply migrations to database
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Check migration status
npx prisma migrate status

# Deploy to production
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

### Sample Migration File

```sql
-- CreateTable
CREATE TABLE "BrokerAccount" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "businessNumber" TEXT,
    "taxNumber" TEXT,
    "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "vatNumber" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountType" TEXT,
    "bankBranchCode" TEXT,
    "swiftCode" TEXT,
    "fscaVerified" BOOLEAN NOT NULL DEFAULT false,
    "fscaVerificationDate" TIMESTAMP(3),
    "riskRating" TEXT NOT NULL DEFAULT 'MEDIUM',
    "complianceStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentTerms" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerInvoice" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "brokerAccountId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "subscriptionFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "apiUsageFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transactionFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overageFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "penaltyFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "BrokerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerInvoice_invoiceNumber_key" ON "BrokerInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "BrokerAccount_brokerId_idx" ON "BrokerAccount"("brokerId");

-- CreateIndex
CREATE INDEX "BrokerInvoice_brokerId_status_idx" ON "BrokerInvoice"("brokerId", "status");

-- AddForeignKey
ALTER TABLE "BrokerAccount" ADD CONSTRAINT "BrokerAccount_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrokerInvoice" ADD CONSTRAINT "BrokerInvoice_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Seed Script Commands

```bash
# Create seed file
touch prisma/seed-crm.js

# Make seed file executable
chmod +x prisma/seed-crm.js

# Run seed script
node prisma/seed-crm.js

# Or using Prisma
npx prisma db seed
```

### Sample Seed Script

```javascript
// prisma/seed-crm.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CRM data...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@viralfx.com' },
    update: {},
    create: {
      email: 'admin@viralfx.com',
      password: hashedPassword,
      role: 'ADMIN',
      firstName: 'System',
      lastName: 'Administrator',
      emailVerified: true,
    },
  });

  // Create broker tiers
  const starterTier = await prisma.platformSettings.upsert({
    where: { key: 'broker_tier_starter' },
    update: {},
    create: {
      key: 'broker_tier_starter',
      value: JSON.stringify({
        name: 'STARTER',
        price: 99,
        apiCallsLimit: 10000,
        clientLimit: 100,
        features: ['basic_analytics', 'api_access'],
      }),
    },
  });

  const verifiedTier = await prisma.platformSettings.upsert({
    where: { key: 'broker_tier_verified' },
    update: {},
    create: {
      key: 'broker_tier_verified',
      value: JSON.stringify({
        name: 'VERIFIED',
        price: 299,
        apiCallsLimit: 50000,
        clientLimit: 500,
        features: ['advanced_analytics', 'api_access', 'priority_support'],
      }),
    },
  });

  // Create ticket categories
  const ticketCategories = [
    { name: 'TECHNICAL', description: 'Technical support issues' },
    { name: 'BILLING', description: 'Billing and payment issues' },
    { name: 'COMPLIANCE', description: 'Compliance and regulatory issues' },
    { name: 'GENERAL', description: 'General inquiries' },
    { name: 'FEATURE_REQUEST', description: 'New feature requests' },
  ];

  for (const category of ticketCategories) {
    await prisma.ticketCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }

  // Create ticket priorities
  const ticketPriorities = [
    { name: 'LOW', level: 1, responseHours: 48, resolutionHours: 168 },
    { name: 'MEDIUM', level: 2, responseHours: 24, resolutionHours: 72 },
    { name: 'HIGH', level: 3, responseHours: 4, resolutionHours: 24 },
    { name: 'CRITICAL', level: 4, responseHours: 1, resolutionHours: 4 },
  ];

  for (const priority of ticketPriorities) {
    await prisma.ticketPriority.upsert({
      where: { name: priority.name },
      update: {},
      create: priority,
    });
  }

  // Create pipeline stages
  const pipelineStages = [
    { name: 'LEAD', order: 1, probability: 10 },
    { name: 'QUALIFIED', order: 2, probability: 25 },
    { name: 'PROPOSAL', order: 3, probability: 50 },
    { name: 'NEGOTIATION', order: 4, probability: 75 },
    { name: 'CLOSED_WON', order: 5, probability: 100 },
    { name: 'CLOSED_LOST', order: 6, probability: 0 },
  ];

  for (const stage of pipelineStages) {
    await prisma.pipelineStage.upsert({
      where: { name: stage.name },
      update: {},
      create: stage,
    });
  }

  console.log('CRM data seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Package.json Scripts

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:seed": "node prisma/seed-crm.js",
    "prisma:studio": "prisma studio",
    "prisma:reset": "prisma migrate reset"
  }
}
```

---

## Section 15: Example API Request & Response

### Create Broker Account Request

**POST /api/v1/crm/brokers**

```http
POST /api/v1/crm/brokers
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "companyName": "Alpha Trading Solutions",
  "registrationNumber": "2020/123456/00",
  "contactName": "John Smith",
  "contactEmail": "john.smith@alphatrading.com",
  "contactPhone": "+27 11 234 5678",
  "country": "South Africa",
  "website": "https://alphatrading.com",
  "businessNumber": "1234567890",
  "taxNumber": "9876543210",
  "vatRegistered": true,
  "vatNumber": "ZA9876543210",
  "accountType": "CORPORATE",
  "tier": "VERIFIED",
  "metadata": {
    "referralSource": "partner_program",
    "industry": "financial_services",
    "employees": "50-100",
    "annualRevenue": "5M-10M"
  }
}
```

### Create Broker Account Response

**201 Created**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "fscaStatus": "PENDING",
  "createdAt": "2025-01-20T10:30:45.123Z",
  "updatedAt": "2025-01-20T10:30:45.123Z",

  "companyDetails": {
    "companyName": "Alpha Trading Solutions",
    "registrationNumber": "2020/123456/00",
    "accountType": "CORPORATE",
    "country": "South Africa",
    "website": "https://alphatrading.com"
  },

  "contactInformation": {
    "contactName": "John Smith",
    "contactEmail": "john.smith@alphatrading.com",
    "contactPhone": "+27 11 234 5678"
  },

  "businessDetails": {
    "businessNumber": "1234567890",
    "taxNumber": "9876543210",
    "vatRegistered": true,
    "vatNumber": "ZA9876543210"
  },

  "subscription": {
    "tier": "VERIFIED",
    "status": "PENDING_ACTIVATION",
    "nextBillingDate": "2025-02-20T00:00:00.000Z"
  },

  "compliance": {
    "fscaVerified": false,
    "fscaVerificationDate": null,
    "riskRating": "MEDIUM",
    "complianceStatus": "PENDING"
  },

  "documents": [],
  "notes": [],
  "metadata": {
    "referralSource": "partner_program",
    "industry": "financial_services",
    "employees": "50-100",
    "annualRevenue": "5M-10M"
  }
}
```

### Upload Document Request

**POST /api/v1/crm/brokers/{brokerId}/upload-doc**

```http
POST /api/v1/crm/brokers/550e8400-e29b-41d4-a716-446655440000/upload-doc
Content-Type: multipart/form-data
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

--boundary
Content-Disposition: form-data; name="document"
Content-Type: application/json

{
  "documentType": "FSCA_LICENSE",
  "description": "FSCA Category II license certificate",
  "expiryDate": "2025-12-31"
}
--boundary
Content-Disposition: form-data; name="file"; filename="fscas_license.pdf"
Content-Type: application/pdf

%PDF-1.4
[PDF file content]
--boundary--
```

### Upload Document Response

**201 Created**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "brokerId": "550e8400-e29b-41d4-a716-446655440000",
  "documentType": "FSCA_LICENSE",
  "status": "PENDING",
  "description": "FSCA Category II license certificate",
  "fileName": "fscas_license.pdf",
  "fileSize": 2048576,
  "fileUrl": "https://s3.viralfx.com/documents/660e8400-e29b-41d4-a716-446655440001.pdf?signature=...",
  "mimeType": "application/pdf",
  "sha256Hash": "a1b2c3d4e5f6...",
  "uploadedAt": "2025-01-20T10:35:45.123Z",
  "uploadedBy": "admin@viralfx.com",
  "verifiedBy": null,
  "verifiedAt": null,
  "rejectionReason": null,
  "expiryDate": "2025-12-31T23:59:59.999Z",
  "virusScanStatus": "PENDING",
  "virusScanResult": null
}
```

### Generate Invoice Request

**POST /api/v1/crm/invoices**

```json
{
  "brokerId": "550e8400-e29b-41d4-a716-446655440000",
  "subscriptionId": "770e8400-e29b-41d4-a716-446655440002",
  "issueDate": "2025-01-20T00:00:00.000Z",
  "dueDate": "2025-02-20T00:00:00.000Z",
  "periodStart": "2025-01-01T00:00:00.000Z",
  "periodEnd": "2025-01-31T23:59:59.999Z",
  "lineItems": [
    {
      "description": "Monthly Subscription - VERIFIED Tier",
      "quantity": 1,
      "unitPrice": 299.00,
      "itemType": "SUBSCRIPTION",
      "referenceId": "770e8400-e29b-41d4-a716-446655440002",
      "referenceType": "BROKER_SUBSCRIPTION"
    },
    {
      "description": "API Usage - 15,000 calls @ $0.01",
      "quantity": 15000,
      "unitPrice": 0.01,
      "itemType": "API_CALL",
      "referenceId": "usage_records_jan2025",
      "referenceType": "API_USAGE_RECORD"
    }
  ],
  "currency": "USD",
  "notes": "Monthly billing for subscription and API usage"
}
```

### Generate Invoice Response

**201 Created**

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "invoiceNumber": "INV-2025-001234",
  "brokerId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "DRAFT",
  "paymentStatus": "UNPAID",

  "dates": {
    "issueDate": "2025-01-20T00:00:00.000Z",
    "dueDate": "2025-02-20T00:00:00.000Z",
    "periodStart": "2025-01-01T00:00:00.000Z",
    "periodEnd": "2025-01-31T23:59:59.999Z",
    "createdAt": "2025-01-20T10:40:15.456Z"
  },

  "amounts": {
    "subscriptionFee": 299.00,
    "apiUsageFee": 150.00,
    "transactionFee": 0.00,
    "overageFee": 0.00,
    "penaltyFee": 0.00,
    "vatAmount": 68.47,
    "totalAmount": 517.47,
    "amountPaid": 0.00,
    "balanceDue": 517.47
  },

  "currency": "USD",
  "notes": "Monthly billing for subscription and API usage",
  "pdfUrl": "https://s3.viralfx.com/invoices/880e8400-e29b-41d4-a716-446655440003.pdf",
  "paymentLink": "https://pay.viralfx.com/pay/880e8400-e29b-41d4-a716-446655440003",

  "lineItems": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "description": "Monthly Subscription - VERIFIED Tier",
      "quantity": 1,
      "unitPrice": 299.00,
      "total": 299.00,
      "itemType": "SUBSCRIPTION",
      "referenceId": "770e8400-e29b-41d4-a716-446655440002",
      "referenceType": "BROKER_SUBSCRIPTION"
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440005",
      "description": "API Usage - 15,000 calls @ $0.01",
      "quantity": 15000,
      "unitPrice": 0.01,
      "total": 150.00,
      "itemType": "API_CALL",
      "referenceId": "usage_records_jan2025",
      "referenceType": "API_USAGE_RECORD"
    }
  ],

  "payments": [],
  "metadata": {
    "generatedBy": "admin@viralfx.com",
    "generationMethod": "MANUAL"
  }
}
```

---

## Section 16: Developer Checklist (Deliverables)

### Backend Development

#### Database Layer
- [ ] **Add Prisma Models and Run Migration**
  - [ ] Verify all 23 CRM models in schema.prisma (lines 1243-1900)
  - [ ] Run `npx prisma migrate dev --name crm_init`
  - [ ] Validate foreign key relationships and indexes
  - [ ] Test database constraints and data validation
  - [ ] Create and run seed script for initial data

#### Module Implementation
- [ ] **Implement NestJS Module Scaffold & Wire into AppModule**
  - [ ] Complete CRM module with all entities and services
  - [ ] Import CrmModule in AppModule (lines 38, 154)
  - [ ] Configure BullMQ queues for background processing
  - [ ] Set up Redis connection for queue management
  - [ ] Configure environment variables for CRM settings

#### Broker Management
- [ ] **Implement Broker CRUD + Document Upload + File Scanning**
  - [ ] Complete broker account CRUD operations
  - [ ] Implement multi-part document upload with progress tracking
  - [ ] Integrate S3/MinIO for document storage
  - [ ] Add ClamAV integration for virus scanning
  - [ ] Implement FSCA validation workflow
  - [ ] Create broker approval and suspension workflows
  - [ ] Add audit logging for all broker operations

#### Billing System
- [ ] **Implement Invoice Generator + Billing Processor + Payment Provider Adapters**
  - [ ] Complete automated invoice generation with templates
  - [ ] Implement recurring billing with subscription management
  - [ ] Create payment provider adapters (Paystack, PayFast)
  - [ ] Add webhook processing with idempotency
  - [ ] Implement payment reconciliation and refund processing
  - [ ] Create billing analytics and reporting

#### Support System
- [ ] **Implement Support Ticket CRUD + Messages + SLA Worker**
  - [ ] Complete ticket management with full CRUD operations
  - [ ] Implement message threading with file attachments
  - [ ] Add SLA monitoring and escalation workflows
  - [ ] Create ticket assignment and routing logic
  - [ ] Implement automated notifications and reminders
  - [ ] Add support analytics and performance metrics

#### Sales Pipeline
- [ ] **Implement Deals (Sales Pipeline) + Kanban Endpoint**
  - [ ] Complete sales pipeline management
  - [ ] Implement Kanban board functionality
  - [ ] Add deal tracking and opportunity scoring
  - [ ] Create revenue forecasting and analytics
  - [ ] Implement lead conversion workflows
  - [ ] Add sales team performance tracking

### Frontend Development

#### Core Pages
- [ ] **Implement Frontend Admin Pages & Components**
  - [ ] BrokersPage.tsx - Complete broker management interface
  - [ ] BrokerDetailPage.tsx - Individual broker view with all data
  - [ ] BillingPage.tsx - Invoice and billing management
  - [ ] InvoiceView.tsx - PDF invoice viewer and payment interface
  - [ ] TicketsPage.tsx - Support ticket management
  - [ ] TicketDetail.tsx - Individual ticket interface
  - [ ] DealsPage.tsx - Sales pipeline and deal management
  - [ ] ClientsPage.tsx - Client management interface
  - [ ] CRMSettings.tsx - System configuration interface

#### Reusable Components
- [ ] **Create CRM-Specific Components**
  - [ ] BrokerCard.tsx - Broker display and quick actions
  - [ ] BrokerForm.tsx - Broker creation and editing forms
  - [ ] DocumentUpload.tsx - File upload with progress and validation
  - [ ] InvoiceTable.tsx - Invoice listing with filtering and actions
  - [ ] InvoicePdfViewer.tsx - PDF invoice display and download
  - [ ] TicketList.tsx - Ticket listing with status indicators
  - [ ] TicketComposer.tsx - Ticket creation and message composition
  - [ ] PipelineKanban.tsx - Visual pipeline management
  - [ ] ClientForm.tsx - Client creation and editing forms
  - [ ] ActivityTimeline.tsx - Activity history and timeline view

#### State Management
- [ ] **Implement Redux Store and API Service**
  - [ ] Create crm.store.ts with optimized reducers
  - [ ] Implement crm.service.ts with API integration
  - [ ] Add RTK Query for data fetching and caching
  - [ ] Create selectors for efficient data access
  - [ ] Implement optimistic updates for better UX

### Security & Integration

#### Authentication & Authorization
- [ ] **Add RBAC Mapping and Secure Routes**
  - [ ] Implement all CRM permissions in auth module
  - [ ] Add permission guards to all CRM endpoints
  - [ ] Create role-based UI components
  - [ ] Implement data access restrictions
  - [ ] Add audit logging for security events

#### Third-Party Integrations
- [ ] **Complete External Service Integrations**
  - [ ] SendGrid email template integration
  - [ ] Twilio SMS integration for notifications
  - [ ] Payment provider webhook configuration
  - [ ] S3/MinIO file storage integration
  - [ ] WalletService integration for ledger management

### Testing & Quality Assurance

#### Testing Implementation
- [ ] **Add Comprehensive Test Coverage**
  - [ ] Unit tests for all CRM services (94% coverage target)
  - [ ] Integration tests for API endpoints
  - [ ] End-to-end tests for critical workflows
  - [ ] Performance tests for load handling
  - [ ] Security tests for vulnerability detection

#### Continuous Integration
- [ ] **Configure CI/CD Pipeline**
  - [ ] Add GitHub Actions for automated testing
  - [ ] Configure automated deployment pipelines
  - [ ] Add database migration automation
  - [ ] Implement environment-specific configurations
  - [ ] Add monitoring and alerting for production

### Monitoring & Observability

#### Metrics & Dashboards
- [ ] **Add Monitoring and Analytics**
  - [ ] Implement business metrics tracking
  - [ ] Create performance monitoring dashboards
  - [ ] Add error tracking and alerting
  - [ ] Configure log aggregation and analysis
  - [ ] Implement health check endpoints

#### Documentation
- [ ] **Complete Technical Documentation**
  - [ ] API documentation with examples
  - [ ] Database schema documentation
  - [ ] Deployment and configuration guides
  - [ ] Troubleshooting and maintenance procedures
  - [ ] Security and compliance documentation

---

## Section 17: Priority Implementation Order (2-Week Sprint Plan)

### Sprint 1: Core Foundation (Weeks 1-2)

#### Week 1: Database & Core Models
**Priority: Critical**

**Day 1-2: Database Setup**
- [ ] Review and finalize Prisma schema (lines 1243-1900)
- [ ] Run initial migration: `npx prisma migrate dev --name crm_init`
- [ ] Create and execute seed script with broker tiers and admin user
- [ ] Set up Redis for BullMQ queues
- [ ] Configure database indexes for performance

**Day 3-5: Broker Management Foundation**
- [ ] Implement BrokerAccount entity and repository
- [ ] Create broker CRUD endpoints in broker-crm.controller.ts
- [ ] Implement broker validation and business rules
- [ ] Add broker authentication and authorization
- [ ] Create broker search and filtering

**Day 6-7: Basic Frontend Structure**
- [ ] Create frontend CRM pages structure
- [ ] Implement BrokersPage.tsx with basic listing
- [ ] Create BrokerForm.tsx for broker creation/editing
- [ ] Add basic styling with Tailwind CSS
- [ ] Implement client-side validation

#### Week 2: Document Management & Basic UI
**Priority: Critical**

**Day 8-10: Document Upload System**
- [ ] Implement DocumentUpload.tsx with progress tracking
- [ ] Configure S3/MinIO integration for file storage
- [ ] Add ClamAV integration for virus scanning
- [ ] Implement client-side SHA256 hashing
- [ ] Create pre-signed URL generation

**Day 11-12: Admin Approval Workflow**
- [ ] Implement broker approval workflow
- [ ] Create FSCA validation process
- [ ] Add admin review interface
- [ ] Implement document verification status
- [ ] Add audit logging for compliance

**Day 13-14: Basic UI Completion**
- [ ] Complete BrokerDetailPage.tsx with document view
- [ ] Implement basic search and filtering
- [ ] Add responsive design for mobile
- [ ] Create basic dashboard for broker metrics
- [ ] Add error handling and validation messages

### Sprint 2: Billing System (Weeks 3-4)

#### Week 3: Invoice Generation
**Priority: High**

**Day 15-17: Billing Foundation**
- [ ] Implement BrokerInvoice entity and relationships
- [ ] Create invoice generation service
- [ ] Build HTML template for PDF invoices
- [ ] Configure invoice numbering system
- [ ] Add tax calculation logic

**Day 18-19: Background Processing**
- [ ] Set up BullMQ cron job for daily invoice generation
- [ ] Implement distributed locks for invoice processing
- [ ] Create invoice billing processor
- [ ] Add retry logic for failed invoice generation
- [ ] Implement email notification system

**Day 20-21: Frontend Billing Interface**
- [ ] Create BillingPage.tsx for invoice management
- [ ] Implement InvoiceTable.tsx with filtering
- [ ] Add InvoicePdfViewer.tsx for PDF display
- [ ] Create invoice status indicators
- [ ] Add bulk operations for invoices

#### Week 4: Payment Processing
**Priority: High**

**Day 22-24: Payment Integration**
- [ ] Implement payment provider adapters (Paystack, PayFast)
- [ ] Create payment webhook handlers
- [ ] Add idempotency for webhook processing
- [ ] Implement payment reconciliation logic
- [ ] Create refund processing workflow

**Day 25-26: Wallet Integration**
- [ ] Integrate with WalletService for ledger management
- [ ] Implement broker credit on payment success
- [ ] Add transaction history tracking
- [ ] Create payment status updates
- [ ] Implement payment notifications

**Day 27-28: Testing & Documentation**
- [ ] Write unit tests for billing services
- [ ] Create integration tests for payment workflows
- [ ] Document API endpoints with examples
- [ ] Add error handling and logging
- [ ] Performance testing for invoice generation

### Sprint 3: Support & Sales (Weeks 5-6)

#### Week 5: Support Ticketing
**Priority: Medium**

**Day 29-31: Ticket System Foundation**
- [ ] Implement Ticket entity and relationships
- [ ] Create support ticket CRUD operations
- [ ] Build ticket assignment logic
- [ ] Implement message threading system
- [ ] Add file attachment support

**Day 32-33: SLA Management**
- [ ] Implement SLA tracking and monitoring
- [ ] Create SLA breach detection
- [ ] Build escalation workflows
- [ ] Add automated notifications
- [ ] Implement ticket statistics

**Day 34-35: Frontend Support Interface**
- [ ] Create TicketsPage.tsx for ticket management
- [ ] Implement TicketDetail.tsx for individual tickets
- [ ] Add TicketComposer.tsx for ticket creation
- [ ] Create ticket status indicators
- [ ] Add real-time ticket updates

#### Week 6: Sales Pipeline
**Priority: Medium**

**Day 36-38: Pipeline Management**
- [ ] Implement PipelineStage and BrokerDeal entities
- [ ] Create sales pipeline CRUD operations
- [ ] Build deal tracking system
- [ ] Implement probability scoring
- [ ] Add revenue forecasting

**Day 39-40: Kanban Interface**
- [ ] Create PipelineKanban.tsx for visual pipeline
- [ ] Implement drag-and-drop functionality
- [ ] Add deal detail views
- [ ] Create deal activity tracking
- [ ] Implement team performance metrics

**Day 41-42: Integration Testing**
- [ ] Write end-to-end tests for complete workflows
- [ ] Test broker onboarding process
- [ ] Validate payment processing
- [ ] Test support ticket resolution
- [ ] Performance testing under load

### Sprint 4: Hardening & Deployment (Weeks 7-8)

#### Week 7: Security & Performance
**Priority: High**

**Day 43-45: Security Implementation**
- [ ] Implement comprehensive RBAC system
- [ ] Add input validation and sanitization
- [ ] Implement rate limiting and DDoS protection
- [ ] Add security headers and CSP
- [ ] Perform security audit and penetration testing

**Day 46-47: Performance Optimization**
- [ ] Optimize database queries and indexes
- [ ] Implement caching strategies
- [ ] Add pagination and lazy loading
- [ ] Optimize file upload and processing
- [ ] Implement CDN for static assets

**Day 48-49: Monitoring & Alerting**
- [ ] Set up application monitoring
- [ ] Implement business metrics tracking
- [ ] Create alerting for critical issues
- [ ] Add health check endpoints
- [ ] Configure log aggregation

#### Week 8: Deployment & Final Testing
**Priority: High**

**Day 50-52: Deployment Preparation**
- [ ] Create production deployment scripts
- [ ] Configure CI/CD pipeline
- [ ] Set up staging environment
- [ ] Perform load testing
- [ ] Create rollback procedures

**Day 53-54: Production Deployment**
- [ ] Deploy to production environment
- [ ] Perform smoke tests
- [ ] Monitor system performance
- [ ] Validate all integrations
- [ ] Create user documentation

**Day 55-56: Final Review & Documentation**
- [ ] Complete technical documentation
- [ ] Create user training materials
- [ ] Perform final code review
- [ ] Update deployment documentation
- [ ] Plan maintenance and support procedures

---

## Additional Sections

### Example Caution / Gotchas

**Critical Implementation Considerations:**

1. **Idempotency Keys for Webhooks**: Always use idempotency keys for payment webhooks to prevent duplicate processing and ensure consistency.

2. **Human Validation for High-Risk Brokers**: Never auto-approve brokers in high-risk categories (financial services, gambling) without human validation and enhanced due diligence.

3. **Secure File Upload Validation**: Use pre-signed URLs for uploads and always validate file hashes server-side before accepting. Never trust client-side validation.

4. **Currency Rounding Issues**: Use Decimal type for all monetary calculations to avoid floating-point rounding errors. Implement proper rounding rules for different currencies.

5. **Audit Log Immutability**: Back up audit logs to immutable storage (WORM storage) for compliance. Never allow audit log modifications or deletions.

6. **Distributed Locks for Critical Jobs**: Always use Redis distributed locks for critical background jobs like invoice generation to prevent duplicate processing.

7. **Payment Provider Downtime**: Implement fallback payment providers and graceful degradation when primary payment providers are unavailable.

8. **Document Virus Scanning**: Never process or store uploaded files before virus scanning is complete. Quarantine suspicious files immediately.

9. **Data Retention Compliance**: Implement configurable data retention policies for GDPR/POPIA compliance. Include automated data redaction workflows.

10. **SLA Timer Precision**: Use UTC timestamps for SLA calculations to avoid timezone confusion. Consider business hours vs calendar hours in SLA definitions.

11. **Email Deliverability**: Implement proper email authentication (SPF, DKIM, DMARC) to ensure important emails (invoices, compliance notices) are not marked as spam.

12. **Database Connection Pooling**: Configure appropriate connection pool sizes for CRM operations to prevent database overload during peak usage.

### Cross-References

#### Related Blueprint Documents

- **[CRM_VERIFICATION_REPORT.md](CRM_VERIFICATION_REPORT.md)** - Comprehensive verification and testing results for the CRM module
- **[BROKER_PARTNER_PROGRAM.md](BROKER_PARTNER_PROGRAM.md)** - Broker program details and partnership workflows
- **[API_MARKETPLACE_BLUEPRINT.md](API_MARKETPLACE_BLUEPRINT.md)** - API marketplace integration for usage-based billing
- **[FINANCIAL_REPORTING_MODULE.md](FINANCIAL_REPORTING_MODULE.md)** - Financial reporting and accounting integration

#### Implementation File References

- **Module Configuration**: `backend/src/modules/crm/crm.module.ts` - Complete CRM module setup
- **Application Integration**: `backend/src/app.module.ts` (lines 38, 154) - CRM module wiring
- **Database Schema**: `backend/prisma/schema.prisma` (lines 1243-1900) - Complete CRM data models
- **Frontend Integration**: `frontend/src/pages/admin/crm/` - CRM user interface components
- **API Documentation**: `backend/src/modules/crm/controllers/` - REST API endpoint implementations

#### Service Dependencies

- **WalletService Integration**: Broker wallet crediting and ledger management
- **NotificationService**: Email and SMS delivery for automated communications
- **Files Service**: Document storage and processing via S3/MinIO
- **AuthService**: Authentication and authorization for CRM operations
- **AuditService**: Comprehensive audit logging and compliance tracking

---

**Document Version**: 1.0
**Last Updated**: November 20, 2025
**Status**: Production Ready
**Next Review**: February 20, 2026