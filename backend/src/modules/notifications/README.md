# ViralFX Notification System

A comprehensive, multi-channel notification system with queue processing, real-time delivery, and advanced analytics.

## Overview

The ViralFX notification system provides scalable, reliable delivery of notifications through multiple channels:
- **Email**: SMTP/SendGrid with template rendering
- **Push**: Firebase Cloud Messaging (FCM) for mobile devices
- **SMS**: Twilio/Africa's Talking with global carrier support
- **In-App**: Real-time notifications via WebSocket

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │  Notification   │
│   WebSocket     │◄──►│   REST API      │◄──►│   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Bull Queues    │◄──►│  Processors     │
                       │  (Redis)        │    │  (Workers)      │
                       └─────────────────┘    └─────────────────┘
                                │                         │
                       ┌─────────────────┐    ┌─────────────────┐
                       │  External       │    │   Database      │
                       │  Services       │    │  (PostgreSQL)   │
                       └─────────────────┘    └─────────────────┘
```

## Features

### Core Functionality
- **Multi-Channel Delivery**: Email, Push, SMS, In-App notifications
- **Queue Processing**: Bull queues with Redis backend
- **Template System**: Dynamic email templates with personalization
- **Real-time Updates**: WebSocket integration for instant delivery
- **Rate Limiting**: Per-user and per-provider rate controls
- **Retry Logic**: Exponential backoff with dead-letter queues

### Advanced Features
- **Provider Failover**: Automatic switching between email/SMS providers
- **Analytics**: Comprehensive delivery tracking and user engagement metrics
- **A/B Testing**: Template performance testing
- **Quiet Hours**: Respect user notification preferences
- **Bulk Processing**: Efficient handling of large notification batches
- **Internationalization**: Multi-language support with timezone handling

### Monitoring & Reliability
- **Health Checks**: Real-time queue and provider health monitoring
- **Performance Metrics**: Processing times and throughput tracking
- **Error Tracking**: Comprehensive error logging and alerting
- **Circuit Breakers**: Automatic provider failure detection
- **Memory Management**: Optimized processing with garbage collection

## Quick Start

### 1. Configuration

Create environment variables:

```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@viralfx.com
SENDGRID_API_KEY=your-sendgrid-key

# SMS Configuration
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
AFRICASTALKING_USERNAME=your-africastalking-user
AFRICASTALKING_API_KEY=your-africastalking-key

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----\n"

# Database & Redis
DATABASE_URL=postgresql://user:password@localhost:5432/viralfx
REDIS_URL=redis://localhost:6379
```

### 2. Database Migration

Run the database migration to create notification tracking tables:

```bash
npm run prisma:migrate
npm run prisma:generate
```

### 3. Start Services

```bash
# Start the main application
npm run start:dev

# Start notification workers (if running separately)
npm run worker:notifications
```

### 4. Test the System

```bash
# Run basic processor tests
npm run test:notifications

# Run load testing
npm run test:load
```

## Usage

### Sending Notifications

#### Basic Notification
```typescript
import { NotificationService } from './notifications/services/notification.service';

// Send multi-channel notification
await notificationService.sendNotification({
  userId: 'user-123',
  type: 'ORDER_CONFIRMATION',
  channels: ['EMAIL', 'PUSH', 'SMS', 'IN_APP'],
  data: {
    orderId: 'order-123',
    amount: 100,
    currency: 'USD'
  },
  priority: 'HIGH'
});
```

#### Email-Only
```typescript
await notificationService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to ViralFX!',
  template: 'user-welcome',
  data: {
    name: 'John Doe',
    loginUrl: 'https://app.viralfx.com/login'
  }
});
```

#### Push Notification
```typescript
await notificationService.sendPushNotification({
  userId: 'user-123',
  title: 'Order Placed',
  body: 'Your order has been successfully placed',
  data: { orderId: 'order-123' },
  actionButtons: [
    { title: 'View Order', action: 'view_order' }
  ]
});
```

#### SMS Notification
```typescript
await notificationService.sendSMS({
  to: '+1234567890',
  message: 'Your verification code is 123456',
  priority: 'HIGH'
});
```

### Advanced Usage

#### Bulk Notifications
```typescript
const bulkData = {
  recipients: [
    { email: 'user1@example.com', userId: 'user-1' },
    { email: 'user2@example.com', userId: 'user-2' }
  ],
  subject: 'System Announcement',
  template: 'system-announcement',
  defaultData: { maintenanceTime: '23:00' }
};

await notificationService.sendBulkEmail(bulkData);
```

#### Scheduled Notifications
```typescript
await notificationService.sendNotification({
  userId: 'user-123',
  type: 'REMINDER',
  channels: ['EMAIL', 'PUSH'],
  scheduledFor: new Date('2024-12-01T10:00:00Z'),
  data: { reminder: 'Your subscription expires in 7 days' }
});
```

## Templates

### Creating Email Templates

```typescript
// templates/custom-welcome.template.ts
export interface CustomWelcomeData {
  name: string;
  email: string;
  plan: 'FREE' | 'PREMIUM';
  features: string[];
}

export function customWelcomeTemplate(data: CustomWelcomeData): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          .header { background: #4B0082; color: white; padding: 20px; }
          .feature { margin: 10px 0; padding: 10px; background: #f5f5f5; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to ViralFX, ${data.name}!</h1>
        </div>
        <h2>Your ${data.plan} Plan Features:</h2>
        ${data.features.map(feature => `<div class="feature">✓ ${feature}</div>`).join('')}
      </body>
    </html>
  `;

  const text = `Welcome to ViralFX, ${data.name}!\n\nYour ${data.plan} Plan Features:\n${data.features.map(f => `✓ ${f}`).join('\n')}`;

  return { html, text };
}
```

## Monitoring

### Queue Health Check

```typescript
// Check queue status
const emailCounts = await emailQueue.getJobCounts();
console.log('Email Queue:', emailCounts);
// Output: { waiting: 5, active: 2, completed: 150, failed: 3 }
```

### Performance Metrics

```typescript
// Get processor performance
const processors = await notificationService.getProcessorMetrics();
console.log('Performance:', processors);
// Output: { email: { rate: 10.5, successRate: 98.2 }, push: { rate: 15.2, successRate: 99.1 } }
```

### Webhook Integration

Set up webhooks for delivery receipts:

```typescript
// POST /webhooks/email/delivery
{
  "event": "delivered",
  "messageId": "msg-123",
  "status": "delivered",
  "timestamp": "2024-01-01T12:00:00Z",
  "provider": "sendgrid"
}
```

## Testing

### Unit Tests
```bash
# Run processor tests
npm test -- notifications/processors

# Run specific processor test
npm test -- notification-processors.spec.ts
```

### Integration Tests
```bash
# Run queue integration tests
npm run test:integration

# Test all notification modules
npm run test:notifications
```

### Load Testing
```bash
# Run basic load test
npm run test:load

# Custom load test with parameters
npm run test:load -- --email 200 --push 150 --sms 100 --inapp 250
```

### Manual Testing

Use the test scripts:

```bash
# Run comprehensive processor tests
./src/modules/notifications/scripts/test-processors.ts

# Run load testing
./src/modules/notifications/scripts/load-test.ts
```

## Performance Optimization

### Queue Configuration
```typescript
// High-throughput configuration
BullModule.registerQueue({
  name: 'notifications:email',
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  },
  settings: {
    stalledInterval: 30 * 1000,
    maxStalledCount: 1,
  }
});
```

### Worker Scaling
```typescript
// Horizontal scaling
const workers = [];
for (let i = 0; i < process.env.WORKER_COUNT || 4; i++) {
  workers.push(fork('./worker-notifications'));
}
```

### Memory Management
```typescript
// Processors with cleanup
@Processor('notifications:email')
export class EmailProcessor {
  private cache = new Map();

  @OnQueueCompleted()
  onCompleted() {
    // Cleanup completed jobs
    if (this.cache.size > 1000) {
      this.cache.clear();
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Jobs Not Processing**
   - Check Redis connection: `redis-cli ping`
   - Verify queue workers are running
   - Check queue configuration

2. **Email Failures**
   - Verify SMTP credentials
   - Check SPF/DNS records
   - Review email template syntax

3. **Push Notification Failures**
   - Validate FCM configuration
   - Check device token validity
   - Review payload size limits

4. **SMS Failures**
   - Verify Twilio/Africa's Talking credentials
   - Check phone number format
   - Review carrier restrictions

### Debug Mode

```bash
# Enable debug logging
DEBUG=notifications* npm run start:dev

# Monitor Redis
redis-cli monitor

# Check queue status
redis-cli> llen bull:notifications:email:waiting
```

### Health Monitoring

```typescript
// Health check endpoint
@Get('health')
async getHealth() {
  const queues = await this.getQueueStatus();
  const processors = await this.getProcessorMetrics();

  return {
    status: 'healthy',
    queues,
    processors,
    timestamp: new Date().toISOString()
  };
}
```

## API Reference

### NotificationService

#### Methods
- `sendNotification(data: NotificationData): Promise<void>`
- `sendEmail(data: EmailData): Promise<void>`
- `sendPushNotification(data: PushData): Promise<void>`
- `sendSMS(data: SMSData): Promise<void>`
- `sendInAppNotification(userId: string, title: string, message: string): Promise<void>`

### Controllers

#### GET /notifications
Get user notifications with pagination and filtering.

#### POST /notifications
Send a new notification (admin only).

#### PATCH /notifications/:id/read
Mark notification as read.

#### DELETE /notifications/:id
Delete notification.

### WebSocket Events

#### notification:new
New notification received.

#### notifications:unread-count
Unread notification count updated.

#### notifications:marked_read
Notifications marked as read.

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-notification-type`
3. Run tests: `npm test`
4. Submit pull request

## License

MIT License - see LICENSE file for details.