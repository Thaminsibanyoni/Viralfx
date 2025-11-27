import { Test, TestingModule } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../prisma/prisma.module';

import { EmailProcessor } from '../email.processor';
import { PushProcessor } from '../push.processor';
import { SMSProcessor } from '../sms.processor';
import { InAppProcessor } from '../in-app.processor';

describe('Notification Queue Integration Tests', () => {
  let module: TestingModule;
  let emailQueue: Queue;
  let pushQueue: Queue;
  let smsQueue: Queue;
  let inAppQueue: Queue;

  // Mock services
  const mockPrismaService = {
    notificationDelivery: {
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    userDevice: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    redis: {
      get: jest.fn(),
      setex: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeAll(async () => {
    const testConfig = {
      NODE_ENV: 'test',
      REDIS_URL: 'redis://localhost:6379/2',
    };

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [() => testConfig] }),
        BullModule.forRoot({
          redis: {
            host: 'localhost',
            port: 6379,
            db: 2,
          },
        }),
        BullModule.registerQueue(
          { name: 'notifications:email' },
          { name: 'notifications:push' },
          { name: 'notifications:sms' },
          { name: 'notifications:in-app' },
        ),
        PrismaModule,
      ],
      providers: [
        EmailProcessor,
        PushProcessor,
        SMSProcessor,
        InAppProcessor,
        {
          provide: 'PrismaService',
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    emailQueue = module.get<Queue>(getQueueToken('notifications:email'));
    pushQueue = module.get<Queue>(getQueueToken('notifications:push'));
    smsQueue = module.get<Queue>(getQueueToken('notifications:sms'));
    inAppQueue = module.get<Queue>(getQueueToken('notifications:in-app'));
  });

  afterAll(async () => {
    await emailQueue.close();
    await pushQueue.close();
    await smsQueue.close();
    await inAppQueue.close();
    await module.close();
  });

  beforeEach(async () => {
    // Clear all queues
    await emailQueue.clean(0, 'completed');
    await emailQueue.clean(0, 'failed');
    await pushQueue.clean(0, 'completed');
    await pushQueue.clean(0, 'failed');
    await smsQueue.clean(0, 'completed');
    await smsQueue.clean(0, 'failed');
    await inAppQueue.clean(0, 'completed');
    await inAppQueue.clean(0, 'failed');

    jest.clearAllMocks();
  });

  describe('Email Queue Integration', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          SMTP_HOST: 'smtp.test.com',
          SMTP_PORT: 587,
          SMTP_USER: 'test@viralfx.com',
          SMTP_PASS: 'test-password',
          EMAIL_FROM: 'noreply@viralfx.com',
          EMAIL_PROVIDER: 'smtp',
        };
        return config[key];
      });

      // Mock email transporter
      const emailProcessor = module.get<EmailProcessor>(EmailProcessor);
      (emailProcessor as any).transporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: 'test-message-id',
          response: '250 OK',
        }),
      };
    });

    it('should add and process email job successfully', async () => {
      const jobData = {
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'user-welcome',
        data: { name: 'Test User' },
        priority: 'HIGH',
        userId: 'user-123',
      };

      mockPrismaService.notificationDelivery.create.mockResolvedValue({
        id: 'delivery-123',
        jobId: 1,
        userId: 'user-123',
        type: 'EMAIL',
        status: 'DELIVERED',
        provider: 'smtp',
        messageId: 'test-message-id',
        metadata: {},
        createdAt: new Date(),
      });

      // Add job to queue
      const job = await emailQueue.add('send-email', jobData, {
        attempts: 3,
        backoff: 'exponential',
      });

      expect(job.id).toBeDefined();
      expect(job.data).toEqual(jobData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check queue status
      const waiting = await emailQueue.getWaiting();
      const active = await emailQueue.getActive();
      const completed = await emailQueue.getCompleted();
      const failed = await emailQueue.getFailed();

      expect(waiting.length).toBe(0);
      expect(active.length).toBe(0);
      expect(completed.length).toBe(1);
      expect(failed.length).toBe(0);

      // Verify delivery was logged
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: job.id,
            userId: 'user-123',
            type: 'EMAIL',
            status: 'DELIVERED',
            provider: 'smtp',
          }),
        })
      );
    });

    it('should handle email job failure and retry', async () => {
      const jobData = {
        to: 'invalid-email',
        subject: 'Test Email',
        template: 'user-welcome',
        data: { name: 'Test User' },
      };

      // Mock email failure
      const emailProcessor = module.get<EmailProcessor>(EmailProcessor);
      (emailProcessor as any).transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('Invalid email address')),
      };

      mockPrismaService.notificationDelivery.create.mockResolvedValue({
        id: 'delivery-failed',
        jobId: 2,
        type: 'EMAIL',
        status: 'FAILED',
        error: 'Invalid email address',
        metadata: {},
        createdAt: new Date(),
      });

      // Add job to queue with limited attempts for testing
      const job = await emailQueue.add('send-email', jobData, {
        attempts: 2,
        backoff: 'fixed',
        delay: 100,
      });

      // Wait for processing and retries
      await new Promise(resolve => setTimeout(resolve, 500));

      const failed = await emailQueue.getFailed();
      expect(failed.length).toBe(1);

      // Verify failure was logged
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            error: 'Invalid email address',
          }),
        })
      );
    });

    it('should process bulk email jobs efficiently', async () => {
      const bulkData = {
        recipients: Array.from({ length: 50 }, (_, i) => ({
          email: `user${i}@example.com`,
          userId: `user-${i}`,
        })),
        subject: 'Bulk Test',
        template: 'user-welcome',
        defaultData: { name: 'User' },
      };

      const job = await emailQueue.add('send-bulk-email', bulkData, {
        attempts: 3,
        priority: 'high',
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      const completed = await emailQueue.getCompleted();
      expect(completed.length).toBe(1);
    });
  });

  describe('Push Queue Integration', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          FIREBASE_PROJECT_ID: 'test-project',
          FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
          FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n',
        };
        return config[key];
      });

      // Mock Firebase
      const pushProcessor = module.get<PushProcessor>(PushProcessor);
      (pushProcessor as any).fcm = {
        sendMulticast: jest.fn().mockResolvedValue({
          responses: [
            { success: true, messageId: 'fcm-msg-1' },
            { success: true, messageId: 'fcm-msg-2' },
          ],
          successCount: 2,
          failureCount: 0,
        }),
      };
    });

    it('should add and process push notification job', async () => {
      const jobData = {
        userId: 'user-123',
        title: 'Test Push',
        body: 'Test message',
        data: { orderId: 'order-123' },
        priority: 'HIGH',
      };

      mockPrismaService.userDevice.findMany.mockResolvedValue([
        { pushToken: 'token-1', isActive: true },
        { pushToken: 'token-2', isActive: true },
      ]);

      mockPrismaService.notificationDelivery.create.mockResolvedValue({
        id: 'push-delivery-123',
        jobId: 3,
        userId: 'user-123',
        type: 'PUSH',
        status: 'DELIVERED',
        provider: 'firebase',
        metadata: { deviceCount: 2, successCount: 2 },
        createdAt: new Date(),
      });

      const job = await pushQueue.add('send-push', jobData, {
        attempts: 3,
        priority: 1,
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const completed = await pushQueue.getCompleted();
      expect(completed.length).toBe(1);

      // Verify device tokens were retrieved
      expect(mockPrismaService.userDevice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-123',
            isActive: true,
            pushToken: { not: null },
          },
        })
      );
    });

    it('should handle push notification failures and cleanup', async () => {
      const jobData = {
        userId: 'user-123',
        title: 'Test Push',
        body: 'Test message',
      };

      mockPrismaService.userDevice.findMany.mockResolvedValue([
        { pushToken: 'valid-token', isActive: true },
        { pushToken: 'invalid-token', isActive: true },
      ]);

      // Mock FCM with one failure
      const pushProcessor = module.get<PushProcessor>(PushProcessor);
      (pushProcessor as any).fcm = {
        sendMulticast: jest.fn().mockResolvedValue({
          responses: [
            { success: true, messageId: 'fcm-success' },
            { success: false, error: { message: 'Unregistered device' } },
          ],
          successCount: 1,
          failureCount: 1,
        }),
      };

      mockPrismaService.userDevice.updateMany.mockResolvedValue({ count: 1 });

      const job = await pushQueue.add('send-push', jobData);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify invalid tokens were cleaned up
      expect(mockPrismaService.userDevice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pushToken: { in: ['invalid-token'] } },
          data: { isActive: false },
        })
      );
    });
  });

  describe('SMS Queue Integration', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          TWILIO_ACCOUNT_SID: 'test-twilio-sid',
          TWILIO_AUTH_TOKEN: 'test-twilio-token',
          TWILIO_PHONE_NUMBER: '+1234567890',
          TWILIO_ENABLED: 'true',
          BASE_URL: 'https://test.viralfx.com',
        };
        return config[key];
      });
    });

    it('should add and process SMS job', async () => {
      const jobData = {
        to: '+27123456789',
        message: 'Test SMS',
        priority: 'HIGH',
        userId: 'user-123',
      };

      // Mock successful Twilio response
      jest.mock('axios', () => ({
        post: jest.fn().mockResolvedValue({
          data: { sid: 'twilio-sid-123', status: 'queued' },
        }),
      }));

      mockPrismaService.notificationDelivery.create.mockResolvedValue({
        id: 'sms-delivery-123',
        jobId: 4,
        userId: 'user-123',
        type: 'SMS',
        status: 'DELIVERED',
        provider: 'twilio',
        messageId: 'twilio-sid-123',
        metadata: {},
        createdAt: new Date(),
      });

      const job = await smsQueue.add('send-sms', jobData, {
        attempts: 3,
        delay: 1000, // Rate limiting
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const completed = await smsQueue.getCompleted();
      expect(completed.length).toBe(1);

      // Verify delivery was logged
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'SMS',
            provider: 'twilio',
            messageId: 'twilio-sid-123',
          }),
        })
      );
    });

    it('should respect SMS rate limiting', async () => {
      const jobData = {
        to: '+27123456789',
        message: 'Test SMS',
      };

      // Add multiple jobs rapidly
      const jobs = await Promise.all([
        smsQueue.add('send-sms', jobData),
        smsQueue.add('send-sms', { ...jobData, to: '+27123456788' }),
        smsQueue.add('send-sms', { ...jobData, to: '+27123456787' }),
      ]);

      // Check that jobs are delayed for rate limiting
      const waiting = await smsQueue.getWaiting();
      expect(waiting.length).toBeGreaterThan(0);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      const completed = await smsQueue.getCompleted();
      expect(completed.length).toBe(3);
    });
  });

  describe('In-App Queue Integration', () => {
    beforeEach(() => {
      mockPrismaService.notification.create.mockResolvedValue({
        id: 'in-app-123',
        userId: 'user-123',
        title: 'Test In-App',
        message: 'Test message',
        isRead: false,
        createdAt: new Date(),
        expiresAt: new Date(),
      });

      mockPrismaService.redis.get.mockResolvedValue(null);
      mockPrismaService.redis.setex = jest.fn();
    });

    it('should add and process in-app notification job', async () => {
      const jobData = {
        userId: 'user-123',
        title: 'Test In-App',
        message: 'Test message',
        type: 'SYSTEM',
        category: 'INFO',
        priority: 'MEDIUM',
      };

      // Mock WebSocket Gateway
      const mockWebSocketGateway = {
        broadcastToUser: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(module, 'get').mockImplementation((token) => {
        if (token === 'WebSocketGateway') return mockWebSocketGateway;
        return undefined;
      });

      const job = await inAppQueue.add('send-in-app', jobData, {
        attempts: 3,
        priority: 1,
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const completed = await inAppQueue.getCompleted();
      expect(completed.length).toBe(1);

      // Verify notification was created
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            title: 'Test In-App',
            message: 'Test message',
            type: 'SYSTEM',
            category: 'INFO',
            isRead: false,
          }),
        })
      );
    });

    it('should handle broadcast in-app notifications', async () => {
      const jobData = {
        title: 'Broadcast Message',
        message: 'System announcement',
        type: 'SYSTEM',
        category: 'INFO',
        targetAudience: 'all',
      };

      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ]);

      const job = await inAppQueue.add('send-broadcast', jobData);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const completed = await inAppQueue.getCompleted();
      expect(completed.length).toBe(1);

      // Verify users were fetched for broadcast
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            notificationPreferences: {
              inAppNotifications: true,
            },
          }),
        })
      );
    });
  });

  describe('Multi-Queue Coordination', () => {
    it('should handle multi-channel notification workflow', async () => {
      const userId = 'user-123';
      const notificationData = {
        userId,
        title: 'Order Confirmation',
        message: 'Your order has been placed',
        data: { orderId: 'order-123' },
      };

      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'user@example.com',
        phone: '+27123456789',
      });

      mockPrismaService.userDevice.findMany.mockResolvedValue([
        { pushToken: 'device-token', isActive: true },
      ]);

      mockPrismaService.notificationDelivery.create.mockResolvedValue({});
      mockPrismaService.notification.create.mockResolvedValue({});

      // Mock external services
      const emailProcessor = module.get<EmailProcessor>(EmailProcessor);
      const pushProcessor = module.get<PushProcessor>(PushProcessor);
      const smsProcessor = module.get<SMSProcessor>(SMSProcessor);
      const inAppProcessor = module.get<InAppProcessor>(InAppProcessor);

      (emailProcessor as any).transporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'email-123' }),
      };

      (pushProcessor as any).fcm = {
        sendMulticast: jest.fn().mockResolvedValue({
          successCount: 1,
          responses: [{ success: true }],
        }),
      };

      (smsProcessor as any).validatePhoneNumber = jest.fn().mockReturnValue('+27123456789');
      (smsProcessor as any).sendViaTwilio = jest.fn().mockResolvedValue({ messageId: 'sms-123' });

      // Add jobs to all queues
      const jobs = await Promise.all([
        emailQueue.add('send-email', {
          to: 'user@example.com',
          subject: 'Order Confirmation',
          template: 'order-confirmation',
          data: notificationData,
        }),
        pushQueue.add('send-push', {
          userId,
          title: notificationData.title,
          body: notificationData.message,
          data: notificationData.data,
        }),
        smsQueue.add('send-sms', {
          to: '+27123456789',
          message: `Order ${notificationData.data.orderId} confirmed`,
        }),
        inAppQueue.add('send-in-app', {
          userId,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data,
          type: 'ORDER',
          category: 'SUCCESS',
        }),
      ]);

      // Wait for all jobs to process
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check all queues
      const emailCompleted = await emailQueue.getCompleted();
      const pushCompleted = await pushQueue.getCompleted();
      const smsCompleted = await smsQueue.getCompleted();
      const inAppCompleted = await inAppQueue.getCompleted();

      expect(emailCompleted.length).toBe(1);
      expect(pushCompleted.length).toBe(1);
      expect(smsCompleted.length).toBe(1);
      expect(inAppCompleted.length).toBe(1);

      // Verify all delivery logs were created
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledTimes(3); // Email, Push, SMS
      expect(mockPrismaService.notification.create).toHaveBeenCalledTimes(1); // In-app
    });

    it('should handle queue failures independently', async () => {
      // Setup: Email queue fails, others succeed
      const emailProcessor = module.get<EmailProcessor>(EmailProcessor);
      const pushProcessor = module.get<PushProcessor>(PushProcessor);
      const inAppProcessor = module.get<InAppProcessor>(InAppProcessor);

      (emailProcessor as any).transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('Email service down')),
      };

      (pushProcessor as any).fcm = {
        sendMulticast: jest.fn().mockResolvedValue({
          successCount: 1,
          responses: [{ success: true }],
        }),
      };

      mockPrismaService.userDevice.findMany.mockResolvedValue([
        { pushToken: 'device-token', isActive: true },
      ]);

      mockPrismaService.notificationDelivery.create.mockResolvedValue({});
      mockPrismaService.notification.create.mockResolvedValue({});

      // Add jobs to queues
      const jobs = await Promise.all([
        emailQueue.add('send-email', {
          to: 'user@example.com',
          subject: 'Test Email',
          message: 'Test message',
        }),
        pushQueue.add('send-push', {
          userId: 'user-123',
          title: 'Test Push',
          body: 'Test message',
        }),
        inAppQueue.add('send-in-app', {
          userId: 'user-123',
          title: 'Test In-App',
          message: 'Test message',
        }),
      ]);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check queue statuses
      const emailFailed = await emailQueue.getFailed();
      const pushCompleted = await pushQueue.getCompleted();
      const inAppCompleted = await inAppQueue.getCompleted();

      expect(emailFailed.length).toBe(1);
      expect(pushCompleted.length).toBe(1);
      expect(inAppCompleted.length).toBe(1);

      // Verify only email failed
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            error: 'Email service down',
          }),
        })
      );
    });
  });

  describe('Queue Monitoring and Health', () => {
    it('should provide accurate queue statistics', async () => {
      // Add some test jobs
      await emailQueue.add('send-email', { to: 'test1@example.com', message: 'Test 1' });
      await emailQueue.add('send-email', { to: 'test2@example.com', message: 'Test 2' });
      await emailQueue.add('send-email', { to: 'test3@example.com', message: 'Test 3' });

      // Get queue statistics
      const emailWaiting = await emailQueue.getWaiting();
      const emailCounts = await emailQueue.getJobCounts();

      expect(emailWaiting.length).toBe(3);
      expect(emailCounts.waiting).toBe(3);
      expect(emailCounts.active).toBe(0);
      expect(emailCounts.completed).toBe(0);
      expect(emailCounts.failed).toBe(0);

      // Process one job
      const emailProcessor = module.get<EmailProcessor>(EmailProcessor);
      (emailProcessor as any).transporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'processed-123' }),
      };

      mockPrismaService.notificationDelivery.create.mockResolvedValue({});

      await new Promise(resolve => setTimeout(resolve, 1000));

      const newCounts = await emailQueue.getJobCounts();
      expect(newCounts.waiting).toBe(2);
      expect(newCounts.completed).toBe(1);
    });

    it('should handle queue pauses and resumes', async () => {
      // Pause the queue
      await emailQueue.pause();

      // Add job
      await emailQueue.add('send-email', { to: 'test@example.com', message: 'Test while paused' });

      // Job should remain in waiting state
      await new Promise(resolve => setTimeout(resolve, 1000));
      const waiting = await emailQueue.getWaiting();
      expect(waiting.length).toBe(1);

      // Resume the queue
      await emailQueue.resume();

      // Mock successful processing
      const emailProcessor = module.get<EmailProcessor>(EmailProcessor);
      (emailProcessor as any).transporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'resumed-123' }),
      };

      mockPrismaService.notificationDelivery.create.mockResolvedValue({});

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const completed = await emailQueue.getCompleted();
      expect(completed.length).toBe(1);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-volume job processing', async () => {
      const jobCount = 100;

      // Mock fast processing
      const emailProcessor = module.get<EmailProcessor>(EmailProcessor);
      (emailProcessor as any).transporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'bulk-email-123' }),
      };

      mockPrismaService.notificationDelivery.create.mockResolvedValue({});

      // Add many jobs
      const jobs = Array.from({ length: jobCount }, (_, i) =>
        emailQueue.add('send-email', {
          to: `user${i}@example.com`,
          subject: `Test Email ${i}`,
          message: `Test message ${i}`,
        })
      );

      expect(jobs).toHaveLength(jobCount);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10000));

      const completed = await emailQueue.getCompleted();
      expect(completed.length).toBe(jobCount);

      // Verify all deliveries were logged
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledTimes(jobCount);
    });

    it('should maintain performance with mixed job types', async () => {
      // Setup mocks for all processors
      const emailProcessor = module.get<EmailProcessor>(EmailProcessor);
      const pushProcessor = module.get<PushProcessor>(PushProcessor);
      const inAppProcessor = module.get<InAppProcessor>(InAppProcessor);

      (emailProcessor as any).transporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'mixed-email-123' }),
      };

      (pushProcessor as any).fcm = {
        sendMulticast: jest.fn().mockResolvedValue({
          successCount: 1,
          responses: [{ success: true }],
        }),
      };

      mockPrismaService.userDevice.findMany.mockResolvedValue([
        { pushToken: 'device-token', isActive: true },
      ]);

      mockPrismaService.notificationDelivery.create.mockResolvedValue({});
      mockPrismaService.notification.create.mockResolvedValue({});

      // Add mixed job types
      const jobs = await Promise.all([
        ...Array.from({ length: 25 }, (_, i) =>
          emailQueue.add('send-email', {
            to: `email${i}@example.com`,
            subject: `Email ${i}`,
            message: `Email message ${i}`,
          })
        ),
        ...Array.from({ length: 25 }, (_, i) =>
          pushQueue.add('send-push', {
            userId: `user-${i}`,
            title: `Push ${i}`,
            body: `Push message ${i}`,
          })
        ),
        ...Array.from({ length: 25 }, (_, i) =>
          inAppQueue.add('send-in-app', {
            userId: `user-${i}`,
            title: `In-App ${i}`,
            message: `In-App message ${i}`,
          })
        ),
      ]);

      expect(jobs).toHaveLength(75);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check all queues processed successfully
      const emailCompleted = await emailQueue.getCompleted();
      const pushCompleted = await pushQueue.getCompleted();
      const inAppCompleted = await inAppQueue.getCompleted();

      expect(emailCompleted.length).toBe(25);
      expect(pushCompleted.length).toBe(25);
      expect(inAppCompleted.length).toBe(25);
    });
  });
});