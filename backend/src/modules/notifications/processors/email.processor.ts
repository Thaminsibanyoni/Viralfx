import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebSocketGateway as WSGateway } from '../../websocket/gateways/websocket.gateway';
import { SendTimeOptimizerService } from '../services/send-time-optimizer.service';
import { ProviderHealthService } from '../services/provider-health.service';
import { ProviderRoutingService, RoutingContext } from '../services/provider-routing.service';
import { ChaosTestingService } from '../services/chaos-testing.service';
import * as nodemailer from 'nodemailer';
import * as SendGrid from '@sendgrid/mail';
import * as Mailgun from 'mailgun-js';
import * as AWS from 'aws-sdk';

export interface EmailNotificationJob {
  userId: string;
  notificationId: string;
  email: string;
  subject: string;
  template: string;
  data: any;
  metadata?: any;
}

@Injectable()
@Processor('notifications:email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;
  private sendGridClient: SendGrid.MailService | null = null;
  private mailgunClient: Mailgun.Mailgun | null = null;
  private sesClient: AWS.SES | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly webSocketGateway: WSGateway,
    private readonly sendTimeOptimizer: SendTimeOptimizerService,
    private readonly providerHealthService: ProviderHealthService,
    private readonly providerRoutingService: ProviderRoutingService,
    private readonly chaosTestingService: ChaosTestingService,
  ) {
    this.initializeProviders();
  }

  private initializeProviders() {
    this.initializeTransporter();
    this.initializeSendGrid();
    this.initializeMailgun();
    this.initializeSES();
  }

  private initializeTransporter() {
    const emailConfig = {
      host: this.configService.get('SMTP_HOST') || 'localhost',
      port: parseInt(this.configService.get('SMTP_PORT', '587')),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    };

    this.transporter = nodemailer.createTransporter(emailConfig);

    // Verify configuration
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('Email transporter configuration error:', error);
      } else {
        this.logger.log('Email transporter is ready');
      }
    });
  }

  private initializeSendGrid() {
    const apiKey = this.configService.get('SENDGRID_API_KEY');
    if (apiKey) {
      SendGrid.setApiKey(apiKey);
      this.sendGridClient = SendGrid;
      this.logger.log('SendGrid client initialized');
    } else {
      this.logger.warn('SendGrid configuration not found');
    }
  }

  private initializeMailgun() {
    const apiKey = this.configService.get('MAILGUN_API_KEY');
    const domain = this.configService.get('MAILGUN_DOMAIN');
    if (apiKey && domain) {
      this.mailgunClient = Mailgun({ apiKey, domain });
      this.logger.log('Mailgun client initialized');
    } else {
      this.logger.warn('Mailgun configuration not found');
    }
  }

  private initializeSES() {
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    const region = this.configService.get('AWS_REGION') || 'us-east-1';

    if (accessKeyId && secretAccessKey) {
      AWS.config.update({
        accessKeyId,
        secretAccessKey,
        region,
      });
      this.sesClient = new AWS.SES();
      this.logger.log('AWS SES client initialized');
    } else {
      this.logger.warn('AWS SES configuration not found');
    }
  }

  @OnQueueActive()
  onActive(job: Job<EmailNotificationJob>) {
    this.logger.log(`Processing email notification job ${job.id} for user ${job.data.userId}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<EmailNotificationJob>) {
    this.logger.log(`Completed email notification job ${job.id} for user ${job.data.userId}`);
  }

  @OnQueueFailed()
  onFailed(job: Job<EmailNotificationJob>, error: Error) {
    this.logger.error(`Failed email notification job ${job.id} for user ${job.data.userId}:`, error);
  }

  @Process('send-email')
  async handleSendEmail(job: Job<EmailNotificationJob>) {
    const { userId, notificationId, email, subject, template, data } = job.data;

    this.logger.log(`Processing email notification ${notificationId} for user ${userId}`);

    try {
      // Get notification details
      const notification = await this.prismaService.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`);
      }

      // Get user preferences to check if email notifications are enabled
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
        include: { notificationPreferences: true },
      });

      if (!user?.notificationPreferences?.emailNotifications) {
        this.logger.log(`User ${userId} has email notifications disabled`);
        return { skipped: true, reason: 'Email notifications disabled' };
      }

      // Use Send Time Optimizer to determine optimal send time
      const timeOptimization = await this.sendTimeOptimizer.shouldSendNow({
        userId,
        category: notification.category,
        type: notification.type,
        priority: notification.priority as 'low' | 'medium' | 'high' | 'critical',
        channel: 'email',
        timezone: user.notificationPreferences?.timezone,
        metadata: data,
      });

      if (!timeOptimization.shouldSendNow) {
        this.logger.log(`Email ${notificationId} delayed by ${timeOptimization.delayMs}ms: ${timeOptimization.reason}`);

        // Update notification with scheduled time
        if (timeOptimization.optimalSendTime) {
          await this.prismaService.notification.update({
            where: { id: notificationId },
            data: { scheduledFor: timeOptimization.optimalSendTime },
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
          delayMs: timeOptimization.delayMs,
        };
      }

      this.logger.log(`Sending email notification ${notificationId} to ${email}`);

      // Send email with multi-provider failover
      const emailResult = await this.sendEmailWithMultiProvider({
        to: email,
        subject,
        template,
        data: {
          ...data,
          userName: user.firstName || user.email,
          notificationTitle: notification.title,
          notificationMessage: notification.message,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
          createdAt: notification.createdAt,
        },
        priority: notification.priority as 'low' | 'medium' | 'high' | 'critical',
        notificationId,
      });

      // Log the email delivery
      await this.logEmailDelivery(notificationId, email, 'SUCCESS', emailResult);

      // Update notification delivery status
      await this.updateNotificationDeliveryStatus(notificationId, 'EMAIL_SENT');

      // Send real-time notification to user's websocket
      this.webSocketGateway.broadcastToUser(userId, 'notification:email_sent', {
        notificationId,
        email,
        subject,
        sentAt: new Date(),
      });

      this.logger.log(`Email notification ${notificationId} sent successfully to ${email}`);

      // Record successful send for engagement tracking
      await this.sendTimeOptimizer.recordNotificationSent(userId, {
        userId,
        category: notification.category,
        type: notification.type,
        priority: notification.priority as 'low' | 'medium' | 'high' | 'critical',
        channel: 'email',
        timezone: user.notificationPreferences?.timezone,
        metadata: data,
      });

      return {
        success: true,
        notificationId,
        email,
        sentAt: new Date(),
        messageId: emailResult.messageId,
        optimizationStats: {
          qualityScore: timeOptimization.qualityScore,
          frequencyCapRespected: timeOptimization.frequencyCapRespected,
          quietHoursRespected: timeOptimization.quietHoursRespected,
        },
      };
    } catch (error) {
      // Handle special case for optimal time delay
      if (error.message === 'OPTIMAL_TIME_DELAY') {
        throw error; // Let Bull handle the retry with delay
      }

      this.logger.error(`Failed to send email notification ${notificationId}:`, error);

      // Log the failed delivery
      await this.logEmailDelivery(notificationId, email, 'FAILED', { error: error.message });

      // Update notification delivery status
      await this.updateNotificationDeliveryStatus(notificationId, 'EMAIL_FAILED');

      // Check if we should retry based on error type
      if (this.shouldRetry(error)) {
        throw error; // Let Bull handle the retry
      } else {
        // Don't retry for permanent errors (e.g., invalid email)
        return {
          success: false,
          notificationId,
          email,
          error: error.message,
          retryable: false,
        };
      }
    }
  }

  @Process('send-bulk-email')
  async handleSendBulkEmail(job: Job<{
    notificationIds: string[];
    template: string;
    subject: string;
  }>) {
    const { notificationIds, template, subject } = job.data;

    this.logger.log(`Sending bulk email for ${notificationIds.length} notifications`);

    try {
      const results = [];

      for (const notificationId of notificationIds) {
        try {
          // Get notification and user details
          const notification = await this.prismaService.notification.findUnique({
            where: { id: notificationId },
            include: { user: { include: { notificationPreferences: true } } },
          });

          if (!notification || !notification.user) {
            results.push({ notificationId, success: false, error: 'Notification or user not found' });
            continue;
          }

          const { user } = notification;

          // Check user preferences
          if (!user.notificationPreferences?.emailNotifications) {
            results.push({ notificationId, success: false, skipped: true, reason: 'Email disabled' });
            continue;
          }

          // Send email
          const emailResult = await this.sendEmailWithMultiProvider({
            to: user.email,
            subject,
            template,
            data: {
              userName: user.firstName || user.email,
              notificationTitle: notification.title,
              notificationMessage: notification.message,
              actionUrl: notification.actionUrl,
              actionText: notification.actionText,
            },
            priority: notification.priority as 'low' | 'medium' | 'high' | 'critical',
            notificationId,
          });

          results.push({ notificationId, success: true, messageId: emailResult.messageId });

          // Update delivery status
          await this.updateNotificationDeliveryStatus(notificationId, 'EMAIL_SENT');

        } catch (error) {
          results.push({ notificationId, success: false, error: error.message });
          await this.updateNotificationDeliveryStatus(notificationId, 'EMAIL_FAILED');
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const skipped = results.filter(r => r.skipped).length;

      this.logger.log(`Bulk email completed: ${successful} sent, ${failed} failed, ${skipped} skipped`);

      return {
        success: true,
        total: notificationIds.length,
        successful,
        failed,
        skipped,
        results,
      };
    } catch (error) {
      this.logger.error('Bulk email sending failed:', error);
      throw error;
    }
  }

  private async sendEmailWithMultiProvider(emailData: {
    to: string;
    subject: string;
    template: string;
    data: any;
    priority: 'low' | 'medium' | 'high' | 'critical';
    notificationId: string;
  }): Promise<{ messageId: string; provider: string; attempts: number; cost: number }> {
    // Generate email content from template
    let htmlContent: string;
    let textContent: string;

    if (emailData.data.html && emailData.data.text) {
      // Pre-rendered template content
      htmlContent = emailData.data.html;
      textContent = emailData.data.text;
    } else {
      // Dynamic template rendering
      const templateContent = await this.renderTemplate(emailData.template, emailData.data);
      htmlContent = templateContent.html;
      textContent = templateContent.text;
    }

    // Create routing context
    const routingContext: RoutingContext = {
      type: 'email',
      priority: emailData.priority,
      messageSize: htmlContent.length + textContent.length,
      requiresHighThroughput: false, // Single email
      requiresLowLatency: emailData.priority === 'critical' || emailData.priority === 'high',
      costOptimization: emailData.priority === 'low',
      geographicRouting: false, // Email is global
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

          const result = await this.sendWithProvider(providerId, {
            to: emailData.to,
            subject: emailData.subject,
            html: htmlContent,
            text: textContent,
            template: emailData.template,
          });

          // Record successful delivery attempt
          await this.providerHealthService.recordProviderAttempt(
            providerId,
            true,
            Date.now() - Date.now(), // This should be actual response time
          );

          // Update provider load
          await this.providerRoutingService.updateProviderLoad(providerId, 1);

          this.logger.log(`Email sent successfully via ${providerId} after ${attempts} attempts`);

          return {
            messageId: result.messageId,
            provider: providerId,
            attempts,
            cost: result.cost || 0,
          };

        } catch (error) {
          lastError = error;
          this.logger.warn(`Attempt ${attempts} failed for provider ${providerId}:`, error.message);

          // Record failed attempt
          await this.providerHealthService.recordProviderAttempt(
            providerId,
            false,
            Date.now() - Date.now(),
            error.message,
          );

          // Continue to next provider if available
          if (attempts < maxAttempts) {
            continue;
          }
        }
      }

      // All providers failed
      throw lastError || new Error('All email providers failed');

    } finally {
      // Store email template usage analytics
      await this.trackTemplateUsage(emailData.template, emailData.to);
    }
  }

  private async sendWithProvider(
    providerId: string,
    emailData: {
      to: string;
      subject: string;
      html: string;
      text: string;
      template: string;
    }
  ): Promise<{ messageId: string; cost?: number }> {
    const startTime = Date.now();

    switch (providerId) {
      case 'smtp':
        return await this.sendWithSMTP(emailData);
      case 'sendgrid':
        return await this.sendWithSendGrid(emailData);
      case 'mailgun':
        return await this.sendWithMailgun(emailData);
      case 'ses':
        return await this.sendWithSES(emailData);
      default:
        throw new Error(`Unsupported email provider: ${providerId}`);
    }
  }

  private async sendWithSMTP(emailData: {
    to: string;
    subject: string;
    html: string;
    text: string;
    template: string;
  }): Promise<{ messageId: string; cost?: number }> {
    const mailOptions = {
      from: this.configService.get('EMAIL_FROM') || 'noreply@viralfx.com',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      headers: {
        'X-ViralFX-Template': emailData.template,
        'X-ViralFX-Provider': 'smtp',
      },
    };

    const result = await this.transporter.sendMail(mailOptions);
    return {
      messageId: result.messageId,
      cost: 0.001, // Internal SMTP cost
    };
  }

  private async sendWithSendGrid(emailData: {
    to: string;
    subject: string;
    html: string;
    text: string;
    template: string;
  }): Promise<{ messageId: string; cost?: number }> {
    if (!this.sendGridClient) {
      throw new Error('SendGrid client not initialized');
    }

    const msg = {
      to: emailData.to,
      from: this.configService.get('EMAIL_FROM') || 'noreply@viralfx.com',
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      headers: {
        'X-ViralFX-Template': emailData.template,
        'X-ViralFX-Provider': 'sendgrid',
      },
    };

    const [response] = await this.sendGridClient.send(msg);
    return {
      messageId: response.headers['x-message-id'],
      cost: 0.01, // SendGrid cost
    };
  }

  private async sendWithMailgun(emailData: {
    to: string;
    subject: string;
    html: string;
    text: string;
    template: string;
  }): Promise<{ messageId: string; cost?: number }> {
    if (!this.mailgunClient) {
      throw new Error('Mailgun client not initialized');
    }

    const mailData = {
      from: this.configService.get('EMAIL_FROM') || 'noreply@viralfx.com',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      'h:X-ViralFX-Template': emailData.template,
      'h:X-ViralFX-Provider': 'mailgun',
    };

    const response = await this.mailgunClient.messages().send(mailData);
    return {
      messageId: response.id,
      cost: 0.008, // Mailgun cost
    };
  }

  private async sendWithSES(emailData: {
    to: string;
    subject: string;
    html: string;
    text: string;
    template: string;
  }): Promise<{ messageId: string; cost?: number }> {
    if (!this.sesClient) {
      throw new Error('SES client not initialized');
    }

    const params = {
      Source: this.configService.get('EMAIL_FROM') || 'noreply@viralfx.com',
      Destination: {
        ToAddresses: [emailData.to],
      },
      Message: {
        Subject: {
          Data: emailData.subject,
        },
        Body: {
          Html: {
            Data: emailData.html,
          },
          Text: {
            Data: emailData.text,
          },
        },
      },
      Headers: [
        {
          Name: 'X-ViralFX-Template',
          Value: emailData.template,
        },
        {
          Name: 'X-ViralFX-Provider',
          Value: 'ses',
        },
      ],
    };

    const result = await this.sesClient.sendEmail(params).promise();
    return {
      messageId: result.MessageId,
      cost: 0.0001, // SES cost
    };
  }

  private async renderTemplate(templateName: string, data: Record<string, any>) {
    try {
      switch (templateName) {
        case 'user-welcome':
          const { userWelcomeTemplate } = await import('../templates/user-welcome.template');
          return userWelcomeTemplate(data);

        case 'order-confirmation':
          const { orderConfirmationTemplate } = await import('../templates/order-confirmation.template');
          return orderConfirmationTemplate(data);

        case 'price-alert':
          const { priceAlertTemplate } = await import('../templates/price-alert.template');
          return priceAlertTemplate(data);

        case 'security-alert':
          const { securityAlertTemplate } = await import('../templates/security-alert.template');
          return securityAlertTemplate(data);

        case 'broker-approved':
          const { brokerApprovedTemplate } = await import('../templates/broker-approved.template');
          return brokerApprovedTemplate(data);

        case 'system-maintenance':
          const { systemMaintenanceTemplate } = await import('../templates/system-maintenance.template');
          return systemMaintenanceTemplate(data);

        case 'api-invoice':
          const { apiInvoiceTemplate } = await import('../templates/api-invoice.template');
          return apiInvoiceTemplate(data);

        case 'payment-reminder':
          const { paymentReminderTemplate } = await import('../templates/payment-reminder.template');
          return paymentReminderTemplate(data);

        default:
          // Fallback template
          return {
            html: `<div>${data.message || 'No content'}</div>`,
            text: data.message || 'No content',
          };
      }
    } catch (error) {
      this.logger.error(`Failed to render template ${templateName}:`, error);
      return {
        html: `<div>${data.message || 'Email content could not be rendered'}</div>`,
        text: data.message || 'Email content could not be rendered',
      };
    }
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
      // Same day range (e.g., 22:00 to 08:00)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight range (e.g., 22:00 to 08:00 next day)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'rate limit',
      'temporary failure',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  private async logEmailDelivery(
    notificationId: string,
    email: string,
    status: 'SUCCESS' | 'FAILED',
    details?: any
  ): Promise<void> {
    await this.prismaService.notificationDeliveryLog.create({
      data: {
        notificationId,
        channel: 'email',
        recipient: email,
        status,
        sentAt: status === 'SUCCESS' ? new Date() : undefined,
        errorDetails: status === 'FAILED' ? JSON.stringify(details) : null,
        metadata: details ? JSON.stringify(details) : null,
      },
    });
  }

  private async updateNotificationDeliveryStatus(
    notificationId: string,
    status: 'EMAIL_SENT' | 'EMAIL_FAILED' | 'EMAIL_PENDING'
  ): Promise<void> {
    await this.prismaService.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: status,
        deliveredAt: status === 'EMAIL_SENT' ? new Date() : undefined,
      },
    });
  }

  private async trackTemplateUsage(template: string, email: string): Promise<void> {
    // Track email template usage for analytics
    await this.prismaService.emailAnalytics.upsert({
      where: {
        template_date: {
          template,
          date: new Date().toISOString().split('T')[0], // Today's date
        },
      },
      update: {
        sent: { increment: 1 },
        lastUsedAt: new Date(),
      },
      create: {
        template,
        date: new Date().toISOString().split('T')[0],
        sent: 1,
        delivered: 0,
        opened: 0,
        clicked: 0,
        lastUsedAt: new Date(),
      },
    });
  }
}