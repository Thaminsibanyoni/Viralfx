import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from "../../../prisma/prisma.service";
import { SendTimeOptimizerService } from '../services/send-time-optimizer.service';
import { ProviderHealthService } from '../services/provider-health.service';
import { ProviderRoutingService, RoutingContext } from '../services/provider-routing.service';
import { ChaosTestingService } from '../services/chaos-testing.service';
import { Twilio } from 'twilio';

export interface SMSNotificationJob {
  userId: string;
  notificationId: string;
  phoneNumber: string;
  message: string;
  countryCode?: string;
  priority: 'normal' | 'high';
}

@Injectable()
@Processor('notifications:sms')
export class SMSProcessor extends WorkerHost {
  private readonly logger = new Logger(SMSProcessor.name);
  private readonly twilioClient: Twilio | null = null;
  private providerClients = new Map<string, any>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly sendTimeOptimizer: SendTimeOptimizerService,
    private readonly providerHealthService: ProviderHealthService,
    private readonly providerRoutingService: ProviderRoutingService,
    private readonly chaosTestingService: ChaosTestingService) {
    super();
this.initializeProviders();
  }

  private initializeProviders() {
    this.initializeTwilio();
    this.initializeAfricasTalking();
    this.initializeTermii();
    this.initializeClickatell();
  }

  private initializeTwilio() {
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      try {
        this.twilioClient = new Twilio(accountSid, authToken);
        this.providerClients.set('twilio', this.twilioClient);
        this.logger.log('Twilio client initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Twilio client:', error);
      }
    } else {
      this.logger.warn('Twilio configuration not found. SMS will be mocked.');
    }
  }

  private initializeAfricasTalking() {
    const apiKey = this.configService.get('AFRICASTALKING_API_KEY');
    const username = this.configService.get('AFRICASTALKING_USERNAME');

    if (apiKey && username) {
      // Initialize Africa's Talking client
      const africasTalking = {
        apiKey,
        username,
        send: async (options: any) => {
          // Mock implementation - replace with actual Africa's Talking SDK
          return {
            SMSMessageData: {
              Message: {
                messageId: `at_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                status: 'Success'
              }
            }
          };
        }
      };
      this.providerClients.set('africastalking', africasTalking);
      this.logger.log('Africa\'s Talking client initialized');
    } else {
      this.logger.warn('Africa\'s Talking configuration not found');
    }
  }

  private initializeTermii() {
    const apiKey = this.configService.get('TERMII_API_KEY');

    if (apiKey) {
      // Initialize Termii client
      const termii = {
        apiKey,
        send: async (options: any) => {
          // Mock implementation - replace with actual Termii SDK
          return {
            message_id: `termii_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: 'sent'
          };
        }
      };
      this.providerClients.set('termii', termii);
      this.logger.log('Termii client initialized');
    } else {
      this.logger.warn('Termii configuration not found');
    }
  }

  private initializeClickatell() {
    const apiKey = this.configService.get('CLICKATELL_API_KEY');

    if (apiKey) {
      // Initialize Clickatell client
      const clickatell = {
        apiKey,
        send: async (options: any) => {
          // Mock implementation - replace with actual Clickatell SDK
          return {
            messages: [{
              apiMessageId: `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              accepted: true
            }]
          };
        }
      };
      this.providerClients.set('clickatell', clickatell);
      this.logger.log('Clickatell client initialized');
    } else {
      this.logger.warn('Clickatell configuration not found');
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<SMSNotificationJob>) {
    this.logger.log(`Processing SMS notification job ${job.id} for user ${job.data.userId}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<SMSNotificationJob>) {
    this.logger.log(`Completed SMS notification job ${job.id} for user ${job.data.userId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SMSNotificationJob>, error: Error) {
    this.logger.error(`Failed SMS notification job ${job.id} for user ${job.data.userId}:`, error);
  }

  private async handleSendSMS(job: Job<SMSNotificationJob>) {
    const { userId, notificationId, phoneNumber, message, countryCode = 'ZA', priority } = job.data;

    this.logger.log(`Processing SMS notification ${notificationId} for user ${userId}`);

    try {
      // Get notification details
      const notification = await this.prismaService.notification.findUnique({
        where: { id: notificationId },
        include: { user: { include: { notificationPreferences: true } } }
      });

      if (!notification || !notification.user) {
        throw new Error(`Notification ${notificationId} or user not found`);
      }

      const { user } = notification;

      // Check user preferences
      if (!user.notificationPreferences?.smsNotifications) {
        this.logger.log(`User ${userId} has SMS notifications disabled`);
        return { skipped: true, reason: 'SMS notifications disabled' };
      }

      // Check if phone number is verified (important for compliance)
      if (!user.phoneVerified) {
        this.logger.log(`User ${userId} phone number not verified`);
        return { skipped: true, reason: 'Phone number not verified' };
      }

      // Use Send Time Optimizer to determine optimal send time
      const timeOptimization = await this.sendTimeOptimizer.shouldSendNow({
        userId,
        category: notification.category,
        type: notification.type,
        priority: priority as 'low' | 'medium' | 'high' | 'critical',
        channel: 'sms',
        timezone: user.notificationPreferences?.timezone,
        metadata: { phoneNumber, countryCode }
      });

      if (!timeOptimization.shouldSendNow) {
        this.logger.log(`SMS ${notificationId} delayed by ${timeOptimization.delayMs}ms: ${timeOptimization.reason}`);

        // Update notification with scheduled time
        if (timeOptimization.optimalSendTime) {
          await this.prismaService.notification.update({
            where: { id: notificationId },
            data: { scheduledFor: timeOptimization.optimalSendTime }
          });
        }

        // Add delay to Bull job
        if (timeOptimization.delayMs && timeOptimization.delayMs > 0) {
          job.opts.delay = timeOptimization.delayMs;
          throw new Error('OPTIMAL_TIME_DELAY'); // Signal Bull to retry with delay
        }

        return {
          skipped: true,
          reason: timeOptimization.reason,
          optimalSendTime: timeOptimization.optimalSendTime,
          delayMs: timeOptimization.delayMs
        };
      }

      this.logger.log(`Sending SMS notification ${notificationId} to ${phoneNumber}`);

      // Check daily SMS limit to prevent spam
      const todaySMSCount = await this.getTodaySMSCount(userId);
      const maxDailySMS = user.notificationPreferences.maxDailySMS || 10;

      if (todaySMSCount >= maxDailySMS && priority !== 'high') {
        this.logger.log(`User ${userId} exceeded daily SMS limit`);
        return { skipped: true, reason: 'Daily SMS limit exceeded' };
      }

      // Validate phone number format
      const formattedPhone = this.formatPhoneNumber(phoneNumber, countryCode);
      if (!this.isValidPhoneNumber(formattedPhone)) {
        throw new Error(`Invalid phone number format: ${phoneNumber}`);
      }

      // Check for duplicate SMS (prevent sending same message within 5 minutes)
      const isDuplicate = await this.checkDuplicateSMS(userId, message);
      if (isDuplicate && priority !== 'high') {
        this.logger.log(`Duplicate SMS detected for user ${userId}`);
        return { skipped: true, reason: 'Duplicate message' };
      }

      // Send SMS with multi-provider failover and regional routing
      const smsResult = await this.sendSMSWithMultiProvider({
        to: formattedPhone,
        message: this.truncateMessage(message, 160), // SMS character limit
        from: 'ViralFX', // Your app name or sender ID
        priority,
        notificationId,
        recipientCountry: countryCode,
        notificationPriority: notification.priority as 'low' | 'medium' | 'high' | 'critical'
      });

      // Log the SMS delivery
      await this.logSMSDelivery(notificationId, formattedPhone, 'SUCCESS', smsResult);

      // Update notification delivery status
      await this.updateNotificationDeliveryStatus(notificationId, 'SMS_SENT');

      // Update daily SMS count
      await this.updateDailySMSCount(userId);

      // Send real-time notification via WebSocket
      this.webSocketGateway.broadcastToUser(userId, 'notification:sms_sent', {
        notificationId,
        phoneNumber: this.maskPhoneNumber(formattedPhone),
        sentAt: new Date(),
        messageId: smsResult.messageId
      });

      this.logger.log(`SMS notification ${notificationId} sent successfully to ${formattedPhone}`);

      // Record successful send for engagement tracking
      await this.sendTimeOptimizer.recordNotificationSent(userId, {
        userId,
        category: notification.category,
        type: notification.type,
        priority: priority as 'low' | 'medium' | 'high' | 'critical',
        channel: 'sms',
        timezone: user.notificationPreferences?.timezone,
        metadata: { phoneNumber, countryCode }
      });

      return {
        success: true,
        notificationId,
        phoneNumber: this.maskPhoneNumber(formattedPhone),
        sentAt: new Date(),
        messageId: smsResult.messageId,
        cost: smsResult.cost || 0,
        provider: smsResult.provider,
        optimizationStats: {
          qualityScore: timeOptimization.qualityScore,
          frequencyCapRespected: timeOptimization.frequencyCapRespected,
          quietHoursRespected: timeOptimization.quietHoursRespected
        }
      };
    } catch (error) {
      // Handle special case for optimal time delay
      if (error.message === 'OPTIMAL_TIME_DELAY') {
        throw error; // Let Bull handle the retry with delay
      }

      this.logger.error(`Failed to send SMS notification ${notificationId}:`, error);

      // Log the failed delivery
      await this.logSMSDelivery(notificationId, phoneNumber, 'FAILED', { error: error.message });

      // Update notification delivery status
      await this.updateNotificationDeliveryStatus(notificationId, 'SMS_FAILED');

      // Check if we should retry based on error type
      if (this.shouldRetry(error)) {
        throw error; // Let Bull handle the retry
      } else {
        // Don't retry for permanent errors (e.g., invalid phone number)
        return {
          success: false,
          notificationId,
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          error: error.message,
          retryable: false
        };
      }
    }
  }

  private async handleSendVerificationSMS(job: Job<{
    userId: string;
    phoneNumber: string;
    verificationCode: string;
    type: 'phone_verification' | 'two_factor';
  }>) {
    const { userId, phoneNumber, verificationCode, type } = job.data;

    this.logger.log(`Sending ${type} SMS to ${phoneNumber}`);

    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      let message = '';
      if (type === 'phone_verification') {
        message = `Your ViralFX verification code is: ${verificationCode}. This code expires in 10 minutes.`;
      } else {
        message = `Your ViralFX two-factor authentication code is: ${verificationCode}. This code expires in 5 minutes.`;
      }

      const result = await this.sendSMSWithMultiProvider({
        to: formattedPhone,
        message,
        from: 'ViralFX',
        priority: 'high',
        verificationType: type,
        notificationId: '',
        recipientCountry: 'US', // Default to US for verification
        notificationPriority: 'critical'
      });

      // Store verification code with expiration
      await this.prismaService.verificationCode.create({
        data: {
          userId,
          code: verificationCode,
          type,
          phoneNumber: formattedPhone,
          expiresAt: type === 'phone_verification'
            ? new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
            : new Date(Date.now() + 5 * 60 * 1000),  // 5 minutes
          messageId: result.messageId
        }
      });

      return {
        success: true,
        phoneNumber: this.maskPhoneNumber(formattedPhone),
        messageId: result.messageId,
        expiresAt: type === 'phone_verification'
          ? new Date(Date.now() + 10 * 60 * 1000)
          : new Date(Date.now() + 5 * 60 * 1000)
      };
    } catch (error) {
      this.logger.error(`Failed to send verification SMS:`, error);
      throw error;
    }
  }

  private async handleCleanupSMSLogs(job: Job<{
    olderThanDays?: number;
  }>) {
    const { olderThanDays = 90 } = job.data;

    this.logger.log(`Cleaning up SMS logs older than ${olderThanDays} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prismaService.notificationDeliveryLog.deleteMany({
        where: {
          channel: 'sms',
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      this.logger.log(`Cleaned up ${result.count} old SMS logs`);

      return {
        success: true,
        deleted: result.count,
        cutoffDate
      };
    } catch (error) {
      this.logger.error('Failed to cleanup SMS logs:', error);
      throw error;
    }
  }

  private async sendSMSWithMultiProvider(smsData: {
    to: string;
    message: string;
    from: string;
    priority: 'normal' | 'high';
    notificationId?: string;
    recipientCountry?: string;
    notificationPriority: 'low' | 'medium' | 'high' | 'critical';
    verificationType?: string;
  }): Promise<{
    messageId: string;
    provider: string;
    attempts: number;
    cost: number;
  }> {
    // Create routing context with geographic routing enabled
    const routingContext: RoutingContext = {
      type: 'sms',
      priority: smsData.notificationPriority,
      recipientCountry: smsData.recipientCountry,
      requiresHighThroughput: false, // Single SMS
      requiresLowLatency: smsData.notificationPriority === 'critical' || smsData.notificationPriority === 'high',
      costOptimization: smsData.notificationPriority === 'low',
      geographicRouting: true // Enable regional routing for SMS
    };

    let lastError: Error | null = null;
    let attempts = 0;
    const maxAttempts = 3;

    try {
      // Get optimal provider routing decision
      const routingDecision = await this.providerRoutingService.selectOptimalProvider(routingContext);
      const providersToTry = [
        routingDecision.primaryProvider,
        ...routingDecision.fallbackProviders,
      ];

      // Try providers in order of preference
      for (const providerId of providersToTry.slice(0, maxAttempts)) {
        attempts++;

        try {
          // Check for chaos testing failure injection
          const shouldFail = await this.chaosTestingService.shouldInjectFailure(providerId);
          if (shouldFail) {
            const failureType = await this.chaosTestingService.getInjectedFailureType(providerId);
            throw new Error(`Chaos testing failure injected: ${failureType}`);
          }

          // Check for chaos testing latency injection
          const injectedLatency = await this.chaosTestingService.getInjectedLatency(providerId);
          if (injectedLatency > 0) {
            this.logger.log(`Injected ${injectedLatency}ms latency for provider ${providerId}`);
            await new Promise(resolve => setTimeout(resolve, injectedLatency));
          }

          const result = await this.sendWithSMSProvider(providerId, {
            to: smsData.to,
            message: smsData.message,
            from: smsData.from,
            priority: smsData.priority,
            recipientCountry: smsData.recipientCountry
          });

          // Record successful delivery attempt
          await this.providerHealthService.recordProviderAttempt(
            providerId,
            true,
            Date.now() - Date.now(), // This should be actual response time
          );

          // Update provider load
          await this.providerRoutingService.updateProviderLoad(providerId, 1);

          this.logger.log(`SMS sent successfully via ${providerId} after ${attempts} attempts`);

          // Track SMS usage analytics
          await this.trackSMSUsage(smsData.priority, smsData.verificationType, providerId);

          return {
            messageId: result.messageId,
            provider: providerId,
            attempts,
            cost: result.cost || 0
          };

        } catch (error) {
          lastError = error;
          this.logger.warn(`Attempt ${attempts} failed for provider ${providerId}:`, error.message);

          // Record failed attempt
          await this.providerHealthService.recordProviderAttempt(
            providerId,
            false,
            Date.now() - Date.now(),
            error.message);

          // Continue to next provider if available
          if (attempts < maxAttempts) {
            continue;
          }
        }
      }

      // All providers failed
      throw lastError || new Error('All SMS providers failed');

    } catch (error) {
      this.logger.error(`SMS sending failed after ${attempts} attempts:`, error);
      throw error;
    }
  }

  private async sendWithSMSProvider(
    providerId: string,
    smsData: {
      to: string;
      message: string;
      from: string;
      priority: 'normal' | 'high';
      recipientCountry?: string;
    }
  ): Promise<{ messageId: string; cost?: number }> {
    switch (providerId) {
      case 'twilio':
        return await this.sendWithTwilio(smsData);
      case 'africastalking':
        return await this.sendWithAfricasTalking(smsData);
      case 'termii':
        return await this.sendWithTermii(smsData);
      case 'clickatell':
        return await this.sendWithClickatell(smsData);
      default:
        return await this.mockSendSMS(smsData);
    }
  }

  private async sendWithTwilio(smsData: {
    to: string;
    message: string;
    from: string;
    priority: 'normal' | 'high';
    notificationId?: string;
    verificationType?: string;
  }): Promise<{
    messageId: string;
    provider: string;
    cost?: number;
  }> {
    try {
      const twilioNumber = this.configService.get('TWILIO_PHONE_NUMBER');
      if (!twilioNumber) {
        throw new Error('Twilio phone number not configured');
      }

      const message = await this.twilioClient.messages.create({
        body: smsData.message,
        from: twilioNumber,
        to: smsData.to,
        // Add priority handling for urgent messages
        priority: smsData.priority === 'high' ? 'high' : undefined,
        // Set rate limit for compliance (1 message per second for marketing)
        rateLimit: smsData.verificationType ? undefined : 1,
        // Schedule for non-urgent messages during quiet hours
        scheduleTime: smsData.priority === 'normal' ? this.calculateOptimalSendTime() : undefined
      });

      // Store SMS usage analytics
      await this.trackSMSUsage(smsData.priority, smsData.verificationType);

      return {
        messageId: message.sid,
        provider: 'twilio',
        cost: message.price ? parseFloat(message.price) : undefined
      };
    } catch (error) {
      this.logger.error('Twilio SMS sending failed:', error);
      throw error;
    }
  }

  private async sendWithAfricasTalking(smsData: {
    to: string;
    message: string;
    from: string;
    priority: 'normal' | 'high';
    recipientCountry?: string;
  }): Promise<{ messageId: string; cost?: number }> {
    const client = this.providerClients.get('africastalking');
    if (!client) {
      throw new Error('Africa\'s Talking client not initialized');
    }

    try {
      const response = await client.send({
        to: smsData.to,
        message: smsData.message,
        from: smsData.from
      });

      return {
        messageId: response.SMSMessageData.Message.messageId,
        cost: 0.004 // Africa's Talking cost
      };
    } catch (error) {
      this.logger.error('Africa\'s Talking SMS sending failed:', error);
      throw error;
    }
  }

  private async sendWithTermii(smsData: {
    to: string;
    message: string;
    from: string;
    priority: 'normal' | 'high';
    recipientCountry?: string;
  }): Promise<{ messageId: string; cost?: number }> {
    const client = this.providerClients.get('termii');
    if (!client) {
      throw new Error('Termii client not initialized');
    }

    try {
      const response = await client.send({
        to: smsData.to,
        message: smsData.message,
        from: smsData.from,
        type: 'plain',
        channel: 'generic'
      });

      return {
        messageId: response.message_id,
        cost: 0.0035 // Termii cost
      };
    } catch (error) {
      this.logger.error('Termii SMS sending failed:', error);
      throw error;
    }
  }

  private async sendWithClickatell(smsData: {
    to: string;
    message: string;
    from: string;
    priority: 'normal' | 'high';
    recipientCountry?: string;
  }): Promise<{ messageId: string; cost?: number }> {
    const client = this.providerClients.get('clickatell');
    if (!client) {
      throw new Error('Clickatell client not initialized');
    }

    try {
      const response = await client.send({
        messages: [{
          channel: 'sms',
          to: [smsData.to],
          from: smsData.from,
          content: smsData.message
        }]
      });

      return {
        messageId: response.messages[0].apiMessageId,
        cost: 0.006 // Clickatell cost
      };
    } catch (error) {
      this.logger.error('Clickatell SMS sending failed:', error);
      throw error;
    }
  }

  private async mockSendSMS(smsData: {
    to: string;
    message: string;
    from: string;
    priority: 'normal' | 'high';
    recipientCountry?: string;
  }): Promise<{
    messageId: string;
    provider: string;
    cost?: number;
  }> {
    this.logger.log(`[MOCK] Sending SMS to ${smsData.to}: "${smsData.message.substring(0, 50)}..."`);

    // Simulate API call delay with rate limiting
    const delay = smsData.priority === 'high' ? 500 : 1000; // Faster for high priority
    await new Promise(resolve => setTimeout(resolve, delay));

    // Mock success response
    const mockMessageId = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mockCost = Math.random() * 0.5 + 0.1; // R0.10 - R0.60

    return {
      messageId: mockMessageId,
      provider: 'mock-sms-service',
      cost: mockCost
    };
  }

  private calculateOptimalSendTime(): Date | undefined {
    const now = new Date();
    const currentHour = now.getHours();

    // Define optimal sending hours (9 AM - 6 PM)
    if (currentHour >= 9 && currentHour <= 18) {
      return undefined; // Send now
    }

    // Schedule for next day at 9 AM
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(9, 0, 0, 0);

    return nextDay;
  }

  private formatPhoneNumber(phoneNumber: string, countryCode: string = 'ZA'): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Remove leading zeros and add country code if missing
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Add country code if not present
    if (!cleaned.startsWith('27')) {
      cleaned = `27${cleaned}`;
    }

    // Validate length (South African numbers should be 11 digits with country code)
    if (cleaned.length !== 11) {
      throw new Error(`Invalid phone number length: ${phoneNumber}`);
    }

    return `+${cleaned}`;
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic validation for international format
    return /^\+\d{10,15}$/.test(phoneNumber);
  }

  private maskPhoneNumber(phoneNumber: string): string {
    // Mask all but last 4 digits for privacy
    return phoneNumber.replace(/(\d{2})\d+(\d{2})$/, '$1******$2');
  }

  private truncateMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength - 3) + '...';
  }

  private async getTodaySMSCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.prismaService.notificationDeliveryLog.count({
      where: {
        channel: 'sms',
        createdAt: {
          gte: today,
          lt: tomorrow
        },
        // Note: In a real implementation, you'd need to link this to user notifications
        // This might require joining with notifications table or storing userId in the log
      }
    });
  }

  private async checkDuplicateSMS(userId: string, message: string): Promise<boolean> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Check for similar message sent in last 5 minutes
    const count = await this.prismaService.notificationDeliveryLog.count({
      where: {
        channel: 'sms',
        status: 'SUCCESS',
        createdAt: {
          gte: fiveMinutesAgo
        },
        metadata: {
          path: [],
          string_contains: message.substring(0, 50) // Check first 50 chars
        }
      }
    });

    return count > 0;
  }

  private async updateDailySMSCount(userId: string): Promise<void> {
    // This would ideally use a separate SMS analytics table
    // For now, we'll track it in the delivery logs
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prismaService.sMSAnalytics.upsert({
      where: {
        userId_date: {
          userId,
          date: today.toISOString().split('T')[0]
        }
      },
      update: {
        sent: { increment: 1 },
        lastSentAt: new Date()
      },
      create: {
        userId,
        date: today.toISOString().split('T')[0],
        sent: 1,
        delivered: 0,
        failed: 0,
        cost: 0,
        lastSentAt: new Date()
      }
    });
  }

  private async trackSMSUsage(priority: string, verificationType?: string, provider: string = 'mock-sms-service'): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await this.prismaService.sMSProviderAnalytics.upsert({
      where: {
        provider_date_type: {
          provider,
          date: today,
          type: verificationType || 'notification'
        }
      },
      update: {
        sent: { increment: 1 },
        cost: { increment: this.getSMSCost(provider, priority) },
        lastUsedAt: new Date()
      },
      create: {
        provider,
        date: today,
        type: verificationType || 'notification',
        sent: 1,
        delivered: 0,
        failed: 0,
        cost: this.getSMSCost(provider, priority),
        lastUsedAt: new Date()
      }
    });
  }

  private getSMSCost(provider: string, priority: string): number {
    const baseCosts = {
      twilio: 0.0079,
      africastalking: 0.004,
      termii: 0.0035,
      clickatell: 0.006,
      'mock-sms-service': 0.25
    };

    const baseCost = baseCosts[provider] || 0.25;
    return priority === 'high' ? baseCost * 1.5 : baseCost; // 50% premium for high priority
  }

  private isInQuietHours(preferences: any): boolean {
    if (!preferences?.quietHours?.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'rate limit',
      'temporary failure',
      'service unavailable',
      'timeout',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  private async logSMSDelivery(
    notificationId: string,
    phoneNumber: string,
    status: 'SUCCESS' | 'FAILED',
    details?: any
  ): Promise<void> {
    await this.prismaService.notificationDeliveryLog.create({
      data: {
        notificationId,
        channel: 'sms',
        recipient: phoneNumber,
        status,
        sentAt: status === 'SUCCESS' ? new Date() : undefined,
        errorDetails: status === 'FAILED' ? JSON.stringify(details) : null,
        metadata: details ? JSON.stringify(details) : null
      }
    });
  }

  private async updateNotificationDeliveryStatus(
    notificationId: string,
    status: 'SMS_SENT' | 'SMS_FAILED' | 'SMS_PENDING'
  ): Promise<void> {
    await this.prismaService.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: status,
        deliveredAt: status === 'SMS_SENT' ? new Date() : undefined
      }
    });
  }
}
