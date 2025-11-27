# CRM Support Ticket SLA Configuration

This document provides comprehensive information about the Service Level Agreement (SLA) configuration, auto-assignment rules, and escalation features for the ViralFX CRM support ticket system.

## Overview

The CRM support ticket system includes sophisticated SLA breach monitoring, automated ticket assignment, and multi-level escalation features. The system is designed to ensure timely customer support while providing agents and supervisors with the tools they need to manage workload effectively.

### Key Features

- **Automated SLA Monitoring**: Real-time tracking of ticket response times
- **Dynamic Auto-Assignment**: Intelligent agent selection based on expertise and workload
- **Multi-Level Escalation**: Automatic escalation when SLAs are breached
- **Configurable Thresholds**: Environment-based SLA configuration
- **Comprehensive Notifications**: Email alerts for agents and supervisors

## SLA Thresholds Configuration

SLA thresholds are configured through environment variables, allowing different settings for development, staging, and production environments.

### Environment Variables

All SLA configuration variables follow the pattern: `SLA_<PRIORITY>_<CATEGORY>_HOURS`

#### Priority Levels
- **CRITICAL**: Urgent issues requiring immediate attention
- **HIGH**: Important issues needing prompt resolution
- **MEDIUM**: Standard issues with normal priority
- **LOW**: Low-priority issues that can be resolved later

#### Category Types
- **TECHNICAL**: Technical support and system issues
- **BILLING**: Payment, billing, and financial inquiries
- **COMPLIANCE**: Regulatory and compliance-related matters
- **GENERAL**: General customer service inquiries

#### Default Configuration

```bash
# Critical Priority SLA (hours)
SLA_CRITICAL_TECHNICAL_HOURS=1    # 1 hour
SLA_CRITICAL_BILLING_HOURS=0.5   # 30 minutes
SLA_CRITICAL_COMPLIANCE_HOURS=2  # 2 hours
SLA_CRITICAL_GENERAL_HOURS=2     # 2 hours

# High Priority SLA (hours)
SLA_HIGH_TECHNICAL_HOURS=4       # 4 hours
SLA_HIGH_BILLING_HOURS=2         # 2 hours
SLA_HIGH_COMPLIANCE_HOURS=8      # 8 hours
SLA_HIGH_GENERAL_HOURS=6         # 6 hours

# Medium Priority SLA (hours)
SLA_MEDIUM_TECHNICAL_HOURS=12    # 12 hours
SLA_MEDIUM_BILLING_HOURS=8       # 8 hours
SLA_MEDIUM_COMPLIANCE_HOURS=24   # 24 hours
SLA_MEDIUM_GENERAL_HOURS=16      # 16 hours

# Low Priority SLA (hours)
SLA_LOW_TECHNICAL_HOURS=24       # 24 hours
SLA_LOW_BILLING_HOURS=16         # 16 hours
SLA_LOW_COMPLIANCE_HOURS=48      # 48 hours
SLA_LOW_GENERAL_HOURS=32         # 32 hours
```

### Warning Threshold

The system sends warning notifications when a ticket approaches its SLA deadline:

```bash
# SLA Warning Threshold (percentage of SLA time before warning)
SLA_WARNING_THRESHOLD_PERCENT=80  # Send warning at 80% of SLA time
```

## Auto-Assignment Rules

The system automatically assigns tickets to available agents based on multiple factors:

### Configuration

```bash
# Auto-Assignment Configuration
AUTO_ASSIGN_MAX_LOAD_DEFAULT=10  # Maximum concurrent tickets per agent
AUTO_ASSIGN_ENABLED=true         # Enable/disable auto-assignment
```

### Assignment Algorithm

1. **Category Matching**: Agents are selected based on their expertise in specific ticket categories
2. **Workload Balancing**: System considers current agent workload to prevent overload
3. **Performance Scoring**: Agents with better performance metrics are prioritized
4. **Availability**: Only active agents are considered for assignment

### Category-Specific Settings

Each ticket category can have specific auto-assignment settings:

- **Enable Auto-Assignment**: Per-category toggle for auto-assignment
- **Default Agent**: Optional fallback agent when no suitable agents are available
- **Max Concurrent Tickets**: Category-specific workload limits

## SLA Breach Notifications

The system sends different types of notifications based on SLA status and escalation level.

### Notification Types

#### 1. SLA Warning (Agent Only)
- **Trigger**: When ticket reaches warning threshold (default 80% of SLA time)
- **Recipient**: Assigned agent
- **Template**: System notification (not email)

#### 2. SLA Breach (Agent & Supervisors)
- **Trigger**: When ticket exceeds SLA deadline
- **Recipients**:
  - Assigned agent
  - Team leads
  - Support managers
- **Template**: `ticket-sla-breach`

#### 3. SLA Escalation (Management)
- **Trigger**: Critical breaches or extended overdue periods
- **Recipients**:
  - Support managers
  - Department heads
  - CTO (for critical escalations)
- **Template**: `ticket-sla-escalation`

### Email Templates

#### ticket-sla-breach Template
- **Purpose**: Notify agents of SLA breaches
- **Content**: Ticket details, overdue time, urgency level
- **Actions**: View ticket, resolve now links
- **Features**: Dynamic urgency styling based on overdue hours

#### ticket-sla-escalation Template
- **Purpose**: Notify supervisors of critical breaches requiring intervention
- **Content**: Full ticket context, escalation recommendations
- **Actions**: Review, reassign, contact agent links
- **Features**: Escalation-level color coding and recommendations

## Escalation Levels

The system uses a 5-level escalation hierarchy:

### Level 1: Team Lead
- **Trigger**: Initial breach for high-priority tickets
- **Actions**: Monitor progress, offer assistance
- **Notification**: Standard escalation template

### Level 2: Support Manager
- **Trigger**: Extended breaches (>6 hours) or repeat breaches
- **Actions**: Reassignment consideration, process review
- **Notification**: High-priority escalation

### Level 3: Head of Support
- **Trigger**: Critical breaches (>24 hours) or compliance issues
- **Actions**: Direct customer contact, service recovery
- **Notification**: Critical escalation with compensation recommendations

### Level 4: Compliance Manager
- **Trigger**: Compliance-related breaches or regulatory issues
- **Actions**: Risk assessment, legal review
- **Notification**: Compliance-focused escalation

### Level 5: CTO
- **Trigger**: System-wide issues or extreme customer impact
- **Actions**: Executive intervention, strategic review
- **Notification**: Highest-priority escalation

## Database Schema

### Core Entities

#### TicketCategory
```sql
-- Auto-assignment fields
enable_auto_assign BOOLEAN DEFAULT false
auto_assign_agent_id UUID NULL
max_concurrent_tickets INTEGER DEFAULT 10
```

#### User
```sql
-- Support roles (extended enum)
SUPPORT, SUPPORT_LEAD, SUPERVISOR, FINANCE, TEAM_LEAD,
SUPPORT_MANAGER, HEAD_OF_SUPPORT, COMPLIANCE_MANAGER, CTO

-- Support-specific fields
agent_categories JSON NULL
categories TEXT[] NULL
```

#### Ticket
```sql
-- SLA and escalation fields
title VARCHAR(255) NOT NULL
escalation_level INTEGER DEFAULT 0
resolution_notes TEXT NULL
satisfaction_rating INTEGER NULL
is_archived BOOLEAN DEFAULT false
archived_at TIMESTAMP NULL
created_by UUID NULL
```

### Relationships

- **User → Ticket**: One-to-many (assigned tickets)
- **User → TicketAssignment**: One-to-many (assignment history)
- **TicketCategory → User**: Many-to-one (default auto-assign agent)

## Monitoring & Metrics

### BullMQ Queue Configuration

**Queue Name**: `crm-ticket-sla`

**Job Types**:
- `check-breaches`: Periodic SLA breach monitoring
- `auto-escalate`: Automatic ticket escalation
- `start-sla-timer`: Initialize SLA tracking for new tickets

### Redis Keys for Tracking

```redis
# SLA timer tracking
sla-timer:{ticketId} → timestamp

# Warning throttling
sla-warning:{ticketId} → "sent" (2-hour expiry)
```

### Monitoring Metrics

- **SLA Compliance Rate**: Percentage of tickets resolved within SLA
- **Average Resolution Time**: Mean time to resolution by category/priority
- **Escalation Frequency**: Rate of escalations by agent/department
- **Agent Workload**: Concurrent tickets per agent
- **Breach Analysis**: Root cause analysis for SLA breaches

## Troubleshooting

### Common Issues

#### 1. Missing Environment Variables
**Problem**: SLA values default to 24 hours
**Solution**: Verify all `SLA_*_HOURS` variables are set
**Check**: Logs show "SLA environment variable not found" warnings

#### 2. Incorrect User Roles
**Problem**: Role-based queries fail
**Solution**: Ensure users have appropriate support roles in UserRole enum
**Check**: Database roles match enum values in user.entity.ts

#### 3. Missing Email Templates
**Problem**: SLA breach notifications fail
**Solution**: Verify templates exist in notifications/templates directory
**Check**: `ticket-sla-breach.template.ts` and `ticket-sla-escalation.template.ts`

#### 4. Import Path Errors
**Problem**: Module resolution failures
**Solution**: Verify User entity imports point to `../../../database/entities/user.entity`
**Check**: All CRM modules use correct import paths

### Testing SLA Scenarios

#### Manual Testing
1. Create test tickets with different priorities and categories
2. Modify `created_at` timestamps to simulate time passage
3. Run `check-breaches` job manually
4. Verify notifications are sent correctly

#### Automated Testing
```bash
# Test SLA processor
npm run test -- crm-ticket-sla.processor

# Test support service
npm run test -- support.service

# Test email templates
npm run test -- notifications
```

### Performance Optimization

#### Database Indexes
```sql
-- Essential indexes for performance
CREATE INDEX idx_tickets_status_priority ON tickets(status, priority_id);
CREATE INDEX idx_tickets_assigned_status ON tickets(assigned_to_id, status);
CREATE INDEX idx_tickets_sla_breach ON tickets(sla_due_date, sla_breach);
CREATE INDEX idx_users_role_active ON users(role, status);
```

#### Queue Configuration
```typescript
// Optimize for high-throughput processing
{
  concurrency: 5,           // Concurrent job processing
  removeOnComplete: 100,    // Job retention
  removeOnFail: 50,         // Failed job retention
  attempts: 3,             // Retry attempts
  backoff: 'exponential'    // Retry strategy
}
```

## Configuration Best Practices

### Environment Management
1. **Development**: Use relaxed SLA thresholds for testing
2. **Staging**: Mirror production settings with longer windows
3. **Production**: Use optimal SLA values for customer satisfaction

### Agent Management
1. **Role Assignment**: Ensure proper support role assignment
2. **Category Expertise**: Define agent categories clearly
3. **Workload Monitoring**: Regularly review agent workload distributions

### SLA Tuning
1. **Regular Review**: Adjust SLA thresholds based on performance data
2. **Customer Feedback**: Incorporate customer satisfaction metrics
3. **Industry Standards**: Align with industry benchmarks for support

## Integration Points

### External Systems
- **Email Service**: SMTP configuration for notification delivery
- **Monitoring**: Integration with application monitoring tools
- **Analytics**: SLA metrics feeding into business intelligence

### API Endpoints
- **Support Dashboard**: Real-time SLA monitoring interface
- **Agent Workload**: Current assignment and capacity tracking
- **Escalation Management**: Manual override and escalation controls

### Webhooks
- **SLA Events**: Real-time notifications for external systems
- **Agent Availability**: Integration with HR/attendance systems
- **Customer Feedback**: Post-resolution satisfaction collection

---

For technical assistance or questions about SLA configuration, contact the development team or reference the source code in:
- `backend/src/modules/crm/processors/crm-ticket-sla.processor.ts`
- `backend/src/modules/crm/services/support.service.ts`
- `backend/src/modules/notifications/templates/`