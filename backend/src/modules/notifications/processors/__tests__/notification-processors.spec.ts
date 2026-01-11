import { Test, TestingModule } from '@nestjs/testing';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { WebSocketModule } from "../../../websocket/websocket.module";

// Processors
import { EmailProcessor } from '../email.processor';
import { PushProcessor } from '../push.processor';
import { SMSProcessor } from '../sms.processor';
import { InAppProcessor } from '../in-app.processor';

// Services
import { NotificationService } from "../../services/notification.service";
import { WebSocketGateway } from "../../../websocket/gateways/websocket.gateway";

describe('Notification Processors Integration Tests', () => {
  let module: TestingModule;
  let emailProcessor: EmailProcessor;
  let pushProcessor: PushProcessor;
  let smsProcessor: SMSProcessor;
  let inAppProcessor: InAppProcessor;
  let notificationService: NotificationService;
  let mockWebSocketGateway: jest.Mocked<WebSocketGateway>;

  // Mock dependencies
  const mockPrismaService = {
    notificationDelivery: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userDevice: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    redis: {
      get: jest.fn(),
      setex: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const testConfig = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/viralfx_test',
      REDIS_URL: 'redis://localhost:6379/1',

      // Email Configuration
      SMTP_HOST: 'smtp.test.com',
      SMTP_PORT: 587,
      SMTP_USER: 'test@viralfx.com',
      SMTP_PASS: 'test-password',
      EMAIL_FROM: 'test@viralfx.com',
      SENDGRID_API_KEY: 'test-sendgrid-key',

      // SMS Configuration
      TWILIO_ACCOUNT_SID: 'test-twilio-sid',
      TWILIO_AUTH_TOKEN: 'test-twilio-token',
      TWILIO_PHONE_NUMBER: '+1234567890',
      AFRICASTALKING_USERNAME: 'test-africastalking',
      AFRICASTALKING_API_KEY: 'test-africastalking-key',

      // Firebase Configuration
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n',

      BASE_URL: 'https://test.viralfx.com',
      FRONTEND_URL: 'https://test.viralfx.com',
    };

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [() => testConfig] }),
        BullModule.forRoot({
          redis: {
            host: 'localhost',
            port: 6379,
            db: 1,
          },
        }),
        BullModule.registerQueue(
          { name: 'notifications:email' },
          { name: 'notifications:push' },
          { name: 'notifications:sms' },
          { name: 'notifications:in-app' }),
      ],
      providers: [
        EmailProcessor,
        PushProcessor,
        SMSProcessor,
        InAppProcessor,
        NotificationService,
        {
          provide: WebSocketGateway,
          useValue: {
            broadcastToUser: jest.fn().mockResolvedValue(undefined),
          },
        },
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

    emailProcessor = module.get<EmailProcessor>(EmailProcessor);
    pushProcessor = module.get<PushProcessor>(PushProcessor);
    smsProcessor = module.get<SMSProcessor>(SMSProcessor);
    inAppProcessor = module.get<InAppProcessor>(InAppProcessor);
    notificationService = module.get<NotificationService>(NotificationService);
    mockWebSocketGateway = module.get<WebSocketGateway>(WebSocketGateway) as jest.Mocked<WebSocketGateway>;

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('EmailProcessor', () => {
    const mockEmailJobData = {
      to: 'test@example.com',
      subject: 'Test Email',
      template: 'user-welcome',
      data: {
        name: 'Test User',
        email: 'test@example.com',
        loginUrl: 'https://test.viralfx.com/login',
        supportEmail: 'support@viralfx.com',
      },
      priority: 'HIGH',
      userId: 'user-123',
    };

    it('should process email job successfully', async () => {
      // Mock dependencies
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

      mockPrismaService.notificationDelivery.create.mockResolvedValue({
        id: 'delivery-123',
        jobId: 1,
        userId: 'user-123',
        type: 'EMAIL',
        status: 'DELIVERED',
        provider: 'smtp',
        messageId: 'msg-123',
        metadata: {},
        createdAt: new Date(),
      });

      // Mock nodemailer
      const mockSendMail = jest.fn().mockResolvedValue({
        messageId: 'msg-123',
        response: '250 OK',
      });

      (emailProcessor as any).transporter = {
        sendMail: mockSendMail,
      };

      // Create mock job
      const mockJob = {
        id: 1,
        data: mockEmailJobData,
        opts: { attempts: 3 },
      };

      // Process the job
      await (emailProcessor as any).handleSendEmail(mockJob);

      // Verify email was sent
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@viralfx.com',
          to: 'test@example.com',
          subject: '[IMPORTANT] Test Email',
          html: expect.stringContaining('Test User'),
          text: expect.stringContaining('Test User'),
        })
      );

      // Verify delivery was logged
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: 1,
            userId: 'user-123',
            type: 'EMAIL',
            status: 'DELIVERED',
            provider: 'smtp',
            messageId: 'msg-123',
          }),
        })
      );
    });

    it('should handle email job failure with retry logic', async () => {
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

      // Mock nodemailer failure
      const mockSendMail = jest.fn().mockRejectedValue(new Error('SMTP connection failed'));

      (emailProcessor as any).transporter = {
        sendMail: mockSendMail,
      };

      mockPrismaService.notificationDelivery.create.mockResolvedValue({
        id: 'delivery-failed',
        jobId: 2,
        userId: 'user-123',
        type: 'EMAIL',
        status: 'FAILED',
        error: 'SMTP connection failed',
        metadata: {},
        createdAt: new Date(),
      });

      const mockJob = {
        id: 2,
        data: mockEmailJobData,
        opts: { attempts: 3 },
      };

      // Process should throw error for retry
      await expect((emailProcessor as any).handleSendEmail(mockJob)).rejects.toThrow('SMTP connection failed');

      // Verify failure was logged
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: 2,
            userId: 'user-123',
            type: 'EMAIL',
            status: 'FAILED',
            error: 'SMTP connection failed',
          }),
        })
      );
    });

    it('should process bulk email job', async () => {
      const mockBulkJobData = {
        recipients: [
          { email: 'user1@example.com', userId: 'user-1' },
          { email: 'user2@example.com', userId: 'user-2' },
        ],
        subject: 'Bulk Test Email',
        template: 'user-welcome',
        defaultData: { name: 'User' },
        priority: 'MEDIUM',
      };

      const mockSendMail = jest.fn().mockResolvedValue({
        messageId: 'bulk-msg-123',
        response: '250 OK',
      });

      (emailProcessor as any).transporter = {
        sendMail: mockSendMail,
      };

      const mockJob = {
        id: 3,
        data: mockBulkJobData,
        opts: { attempts: 3 },
      };

      await (emailProcessor as any).handleSendBulkEmail(mockJob);

      // Verify both emails were sent
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user1@example.com',
          subject: 'Bulk Test Email',
        })
      );
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user2@example.com',
          subject: 'Bulk Test Email',
        })
      );
    });
  });

  describe('PushProcessor', () => {
    const mockPushJobData = {
      userId: 'user-123',
      title: 'Test Push Notification',
      body: 'This is a test push notification',
      data: { orderId: 'order-123' },
      badge: 1,
      sound: 'default',
      priority: 'HIGH',
      imageUrl: 'https://example.com/image.png',
      actionButtons: [
        { title: 'View', action: 'view_order' },
        { title: 'Dismiss', action: 'dismiss' },
      ],
    };

    beforeEach(() => {
      // Mock Firebase Admin SDK
      jest.mock('firebase-admin', () => ({
        initializeApp: jest.fn(),
        messaging: jest.fn(() => ({
          send: jest.fn().mockResolvedValue('message-id-123'),
          sendMulticast: jest.fn().mockResolvedValue({
            responses: [
              { success: true, messageId: 'msg-1' },
              { success: false, error: { message: 'Unregistered device' } },
            ],
            successCount: 1,
            failureCount: 1,
          }),
        })),
      }));
    });

    it('should process push notification job successfully', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          FIREBASE_PROJECT_ID: 'test-project',
          FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
          FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n',
        };
        return config[key];
      });

      mockPrismaService.userDevice.findMany.mockResolvedValue([
        {
          pushToken: 'device-token-1',
          isActive: true,
        },
        {
          pushToken: 'device-token-2',
          isActive: true,
        },
      ]);

      mockPrismaService.userDevice.updateMany.mockResolvedValue({ count: 1 });

      mockPrismaService.notificationDelivery.create.mockResolvedValue({
        id: 'push-delivery-123',
        jobId: 4,
        userId: 'user-123',
        type: 'PUSH',
        status: 'DELIVERED',
        provider: 'firebase',
        messageId: 'message-id-123',
        metadata: { deviceCount: 2, successCount: 1 },
        createdAt: new Date(),
      });

      const mockJob = {
        id: 4,
        data: mockPushJobData,
        opts: { attempts: 3 },
      };

      await (pushProcessor as any).handleSendPush(mockJob);

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

      // Verify delivery was logged
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: 4,
            userId: 'user-123',
            type: 'PUSH',
            status: 'DELIVERED',
            provider: 'firebase',
            metadata: expect.objectContaining({
              deviceCount: 2,
              successCount: 1,
            }),
          }),
        })
      );

      // Verify invalid tokens were cleaned up
      expect(mockPrismaService.userDevice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pushToken: { in: ['device-token-2'] } },
          data: { isActive: false },
        })
      );
    });

    it('should handle broadcast push notification', async () => {
      const mockBroadcastJobData = {
        title: 'System Announcement',
        body: 'Scheduled maintenance tonight',
        data: { type: 'maintenance' },
        targetAudience: 'active',
      };

      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ]);

      mockPrismaService.userDevice.findMany.mockResolvedValue([
        { pushToken: 'token-1' },
        { pushToken: 'token-2' },
        { pushToken: 'token-3' },
      ]);

      const mockJob = {
        id: 5,
        data: mockBroadcastJobData,
        opts: { attempts: 3 },
      };

      await (pushProcessor as any).handleSendBroadcast(mockJob);

      // Verify target users were fetched
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            lastLoginAt: expect.any(Object), // Last 30 days filter
          }),
        })
      );

      // Verify device tokens were retrieved for users
      expect(mockPrismaService.userDevice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: { in: ['user-1', 'user-2', 'user-3'] },
            isActive: true,
            pushToken: { not: null },
          },
        })
      );
    });
  });

  describe('SMSProcessor', () => {
    const mockSMSJobData = {
      to: '+27123456789',
      message: 'This is a test SMS',
      priority: 'HIGH',
      userId: 'user-123',
      senderId: 'ViralFX',
      deliveryReport: true,
    };

    it('should process SMS job with Twilio successfully', async () => {
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

      // Mock axios for Twilio API
      const mockAxiosPost = jest.fn().mockResolvedValue({
        data: {
          sid: 'twilio-sid-123',
          status: 'queued',
        },
      });
      jest.mock('axios', () => ({
        post: mockAxiosPost,
      }));

      mockPrismaService.notificationDelivery.create.mockResolvedValue({
        id: 'sms-delivery-123',
        jobId: 6,
        userId: 'user-123',
        type: 'SMS',
        status: 'DELIVERED',
        provider: 'twilio',
        messageId: 'twilio-sid-123',
        metadata: { cost: 0.05 },
        createdAt: new Date(),
      });

      const mockJob = {
        id: 6,
        data: mockSMSJobData,
        opts: { attempts: 3 },
      };

      await (smsProcessor as any).handleSendSMS(mockJob);

      // Verify Twilio API was called
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('api.twilio.com'),
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
          }),
        })
      );

      // Verify delivery was logged
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: 6,
            userId: 'user-123',
            type: 'SMS',
            status: 'DELIVERED',
            provider: 'twilio',
            messageId: 'twilio-sid-123',
          }),
        })
      );
    });

    it('should process OTP SMS job', async () => {
      const mockOTPJobData = {
        to: '+27123456789',
        otp: '123456',
        purpose: 'LOGIN',
        userId: 'user-123',
        expiryMinutes: 5,
      };

      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          TWILIO_ENABLED: 'true',
          BASE_URL: 'https://test.viralfx.com',
        };
        return config[key];
      });

      const mockAxiosPost = jest.fn().mockResolvedValue({
        data: { sid: 'otp-sid-123' },
      });
      jest.mock('axios', () => ({
        post: mockAxiosPost,
      }));

      mockPrismaService.otpVerification.upsert = jest.fn().mockResolvedValue({});

      const mockJob = {
        id: 7,
        data: mockOTPJobData,
        opts: { attempts: 3 },
      };

      await (smsProcessor as any).handleSendOTP(mockJob);

      // Verify OTP message format
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(URLSearchParams),
        expect.any(Object)
      );

      // Verify OTP hash was stored
      expect(mockPrismaService.otpVerification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId_phone_purpose: expect.objectContaining({
              userId: 'user-123',
              phone: '+27123456789',
              purpose: 'LOGIN',
            }),
          }),
          create: expect.objectContaining({
            otpHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        })
      );
    });

    it('should validate phone numbers correctly', () => {
      const testCases = [
        { input: '+27123456789', expected: '+27123456789' },
        { input: '0123456789', expected: '+270123456789' },
        { input: '12345678', expected: '+12345678' },
        { input: '123', expected: null }, // Too short
        { input: '1234567890123456', expected: null }, // Too long
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (smsProcessor as any).validatePhoneNumber(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('InAppProcessor', () => {
    const mockInAppJobData = {
      userId: 'user-123',
      title: 'New Order',
      message: 'Your order has been placed successfully',
      data: { orderId: 'order-123' },
      type: 'ORDER',
      category: 'SUCCESS',
      priority: 'HIGH',
      actionUrl: '/orders/order-123',
      actionButtons: [
        { label: 'View Order', action: 'view', url: '/orders/order-123' },
        { label: 'Dismiss', action: 'dismiss' },
      ],
      metadata: { source: 'mobile_app' },
    };

    it('should process in-app notification job successfully', async () => {
      mockPrismaService.notification.create.mockResolvedValue({
        id: 'in-app-123',
        userId: 'user-123',
        title: 'New Order',
        message: 'Your order has been placed successfully',
        type: 'ORDER',
        category: 'SUCCESS',
        priority: 'HIGH',
        isRead: false,
        createdAt: new Date(),
        expiresAt: new Date(),
      });

      mockPrismaService.redis.get.mockResolvedValue(null);
      mockPrismaService.redis.setex = jest.fn();

      mockWebSocketGateway.broadcastToUser.mockResolvedValue(undefined);

      const mockJob = {
        id: 8,
        data: mockInAppJobData,
        opts: { attempts: 3 },
      };

      await (inAppProcessor as any).handleSendInApp(mockJob);

      // Verify notification was created in database
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            title: 'New Order',
            message: 'Your order has been placed successfully',
            type: 'ORDER',
            category: 'SUCCESS',
            priority: 'HIGH',
            actionUrl: '/orders/order-123',
            actionButtons: [
              { label: 'View Order', action: 'view', url: '/orders/order-123' },
              { label: 'Dismiss', action: 'dismiss' },
            ],
            isRead: false,
            data: { orderId: 'order-123' },
            metadata: { source: 'mobile_app' },
          }),
        })
      );

      // Verify WebSocket notification was sent
      expect(mockWebSocketGateway.broadcastToUser).toHaveBeenCalledWith(
        'user-123',
        'notification:new',
        expect.objectContaining({
          id: 'in-app-123',
          title: 'New Order',
          message: 'Your order has been placed successfully',
          type: 'ORDER',
          category: 'SUCCESS',
          priority: 'HIGH',
        })
      );

      // Verify unread count cache was updated
      expect(mockPrismaService.redis.setex).toHaveBeenCalledWith(
        'user:user-123:unread_count',
        300,
        expect.any(Number)
      );
    });

    it('should handle broadcast in-app notification', async () => {
      const mockBroadcastJobData = {
        title: 'System Update',
        message: 'New features are now available',
        data: { version: '2.0.0' },
        type: 'SYSTEM',
        category: 'INFO',
        targetAudience: 'verified',
        excludeUsers: ['admin-1'],
      };

      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ]);

      mockPrismaService.notification.create.mockResolvedValue({
        id: 'broadcast-123',
        userId: 'user-1',
        title: 'System Update',
        message: 'New features are now available',
        type: 'SYSTEM',
        category: 'INFO',
        isRead: false,
        createdAt: new Date(),
      });

      mockWebSocketGateway.broadcastToUser.mockResolvedValue(undefined);

      const mockJob = {
        id: 9,
        data: mockBroadcastJobData,
        opts: { attempts: 3 },
      };

      await (inAppProcessor as any).handleSendBroadcast(mockJob);

      // Verify target users were fetched
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            isVerified: true,
            id: { notIn: ['admin-1'] },
          }),
        })
      );

      // Verify notifications were created for all users
      expect(mockPrismaService.notification.create).toHaveBeenCalledTimes(3);
    });

    it('should respect quiet hours for non-critical notifications', async () => {
      // Mock user with quiet hours enabled
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPreferences: {
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00',
          },
        },
      });

      mockPrismaService.notification.create.mockResolvedValue({
        id: 'quiet-hours-123',
        userId: 'user-123',
        scheduledFor: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours later
      });

      const mockJob = {
        id: 10,
        data: { ...mockInAppJobData, priority: 'MEDIUM' }, // Not critical
        opts: { attempts: 3 },
      };

      // Mock current time to be during quiet hours (e.g., 23:00)
      jest.spyOn(Date, 'now').mockImplementation(() => new Date('2024-01-01T23:00:00Z').getTime());

      await (inAppProcessor as any).handleSendInApp(mockJob);

      // Verify notification was scheduled for later
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scheduledFor: expect.any(Date),
          }),
        })
      );

      // Restore Date.now
      jest.spyOn(Date, 'now').mockRestore();
    });

    it('should mark notifications as read', async () => {
      const mockMarkReadJobData = {
        notificationIds: ['notif-1', 'notif-2'],
        userId: 'user-123',
        markAll: false,
      };

      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.redis.get.mockResolvedValue('5');
      mockPrismaService.redis.setex = jest.fn();

      mockWebSocketGateway.broadcastToUser.mockResolvedValue(undefined);

      const mockJob = {
        id: 11,
        data: mockMarkReadJobData,
        opts: { attempts: 3 },
      };

      await (inAppProcessor as any).handleMarkRead(mockJob);

      // Verify notifications were marked as read
      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['notif-1', 'notif-2'] },
            userId: 'user-123',
          },
          data: {
            isRead: true,
            readAt: expect.any(Date),
          },
        })
      );

      // Verify WebSocket update was sent
      expect(mockWebSocketGateway.broadcastToUser).toHaveBeenCalledWith(
        'user-123',
        'notifications_marked_read',
        expect.objectContaining({
          notificationIds: ['notif-1', 'notif-2'],
          markAll: false,
        })
      );
    });
  });

  describe('Queue Processing Integration', () => {
    it('should handle concurrent queue processing', async () => {
      // Create multiple jobs for different processors
      const jobs = [
        { processor: 'email', data: mockEmailJobData },
        { processor: 'push', data: mockPushJobData },
        { processor: 'sms', data: mockSMSJobData },
        { processor: 'in-app', data: mockInAppJobData },
      ];

      // Mock all dependencies to resolve quickly
      mockPrismaService.notificationDelivery.create.mockResolvedValue({});
      mockPrismaService.userDevice.findMany.mockResolvedValue([{ pushToken: 'token-1' }]);
      mockPrismaService.notification.create.mockResolvedValue({});
      mockWebSocketGateway.broadcastToUser.mockResolvedValue(undefined);

      (emailProcessor as any).transporter = { sendMail: jest.fn().mockResolvedValue({ messageId: 'email-123' }) };
      (pushProcessor as any).fcm = { sendMulticast: jest.fn().mockResolvedValue({ successCount: 1 }) };
      (smsProcessor as any).validatePhoneNumber = jest.fn().mockReturnValue('+1234567890');
      (smsProcessor as any).sendViaTwilio = jest.fn().mockResolvedValue({ messageId: 'sms-123' });

      // Process all jobs concurrently
      const promises = jobs.map(async (job, index) => {
        const mockJob = { id: index + 1, data: job.data, opts: { attempts: 3 } };

        switch (job.processor) {
          case 'email':
            return (emailProcessor as any).handleSendEmail(mockJob);
          case 'push':
            return (pushProcessor as any).handleSendPush(mockJob);
          case 'sms':
            return (smsProcessor as any).handleSendSMS(mockJob);
          case 'in-app':
            return (inAppProcessor as any).handleSendInApp(mockJob);
        }
      });

      // Wait for all jobs to complete
      const results = await Promise.allSettled(promises);

      // Verify all jobs completed successfully
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalled();
      });

      // Verify 4 deliveries were logged (one for each job)
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledTimes(4);
    });

    it('should handle queue processing failures gracefully', async () => {
      // Mock processor failures
      (emailProcessor as any).transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP failure')),
      };
      (pushProcessor as any).fcm = {
        sendMulticast: jest.fn().mockRejectedValue(new Error('FCM failure')),
      };

      mockPrismaService.notificationDelivery.create.mockResolvedValue({});

      const failingJobs = [
        { processor: 'email', data: mockEmailJobData },
        { processor: 'push', data: mockPushJobData },
      ];

      const promises = failingJobs.map(async (job, index) => {
        const mockJob = { id: index + 100, data: job.data, opts: { attempts: 3 } };

        switch (job.processor) {
          case 'email':
            return (emailProcessor as any).handleSendEmail(mockJob);
          case 'push':
            return (pushProcessor as any).handleSendPush(mockJob);
        }
      });

      // Wait for all jobs to complete (some should fail)
      const results = await Promise.allSettled(promises);

      // Verify failures were handled and logged
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');

      // Verify failure logs were created
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            error: expect.stringContaining('SMTP failure'),
          }),
        })
      );
    });
  });

  describe('Performance and Scaling Tests', () => {
    it('should handle bulk operations efficiently', async () => {
      const bulkSize = 100;
      const bulkRecipients = Array.from({ length: bulkSize }, (_, i) => ({
        email: `user${i}@example.com`,
        userId: `user-${i}`,
      }));

      const mockBulkJobData = {
        recipients: bulkRecipients,
        subject: 'Bulk Performance Test',
        template: 'user-welcome',
        defaultData: { name: 'User' },
      };

      const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'bulk-msg' });
      (emailProcessor as any).transporter = { sendMail: mockSendMail };

      const startTime = Date.now();
      await (emailProcessor as any).handleSendBulkEmail({
        id: 1000,
        data: mockBulkJobData,
        opts: { attempts: 3 },
      });
      const endTime = Date.now();

      // Verify performance (should complete within reasonable time)
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // 5 seconds max for 100 emails

      // Verify all emails were sent
      expect(mockSendMail).toHaveBeenCalledTimes(bulkSize);
    });

    it('should maintain memory efficiency with large payloads', async () => {
      const largePayload = {
        userId: 'user-123',
        title: 'Large Payload Test',
        message: 'x'.repeat(10000), // 10KB message
        data: {
          largeArray: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` })),
        },
      };

      const initialMemory = process.memoryUsage().heapUsed;

      mockPrismaService.notification.create.mockResolvedValue({});
      mockWebSocketGateway.broadcastToUser.mockResolvedValue(undefined);

      await (inAppProcessor as any).handleSendInApp({
        id: 2000,
        data: largePayload,
        opts: { attempts: 3 },
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

// Test data constants
const mockEmailJobData = {
  to: 'test@example.com',
  subject: 'Test Email',
  template: 'user-welcome',
  data: {
    name: 'Test User',
    email: 'test@example.com',
    loginUrl: 'https://test.viralfx.com/login',
    supportEmail: 'support@viralfx.com',
  },
  priority: 'HIGH',
  userId: 'user-123',
};

const mockPushJobData = {
  userId: 'user-123',
  title: 'Test Push Notification',
  body: 'This is a test push notification',
  data: { orderId: 'order-123' },
  badge: 1,
  sound: 'default',
  priority: 'HIGH',
};

const mockSMSJobData = {
  to: '+27123456789',
  message: 'This is a test SMS',
  priority: 'HIGH',
  userId: 'user-123',
};

const mockInAppJobData = {
  userId: 'user-123',
  title: 'Test In-App Notification',
  message: 'This is a test in-app notification',
  data: { type: 'test' },
  type: 'SYSTEM',
  category: 'INFO',
  priority: 'MEDIUM',
};