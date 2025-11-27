import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationChannel } from '../interfaces/notification.interface';

interface NotificationData {
  userId?: string;
  type: string;
  channels: NotificationChannel[];
  data: Record<string, any>;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scheduledFor?: Date;
}

interface EmailNotificationData {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, any>;
  attachments?: any[];
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface PushNotificationData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
}

interface SMSNotificationData {
  to: string;
  message: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private config: ConfigService,
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('push') private pushQueue: Queue,
    @InjectQueue('sms') private smsQueue: Queue,
    @InjectQueue('in-app') private inAppQueue: Queue
  ) {}

  /**
   * Send notification through multiple channels
   */
  async sendNotification(notificationData: NotificationData): Promise<void> {
    try {
      this.logger.log(`Sending notification: ${notificationData.type}`);

      // Queue notification for each channel
      for (const channel of notificationData.channels) {
        await this.queueNotification(channel, {
          ...notificationData,
          channel
        });
      }
    } catch (error) {
      this.logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   *
   * Callers may either pass pre-rendered html/text in data.html and data.text,
   * or rely on template-name rendering via EmailProcessor.
   *
   * Priority controls queue processing delay:
   * - CRITICAL: Immediate processing (0ms delay)
   * - Other priorities: Standard processing (1000ms delay)
   */
  async sendEmail(data: EmailNotificationData): Promise<void> {
    try {
      await this.emailQueue.add('send-email', {
        to: Array.isArray(data.to) ? data.to : [data.to],
        subject: data.subject,
        template: data.template,
        data: data.data,
        attachments: data.attachments || []
      }, {
        attempts: 3,
        backoff: 'exponential',
        delay: data.priority === 'CRITICAL' ? 0 : 1000
      });

      this.logger.log(`Email queued for ${Array.isArray(data.to) ? data.to.join(', ') : data.to}`);
    } catch (error) {
      this.logger.error('Failed to queue email:', error);
      throw error;
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(data: PushNotificationData): Promise<void> {
    try {
      await this.pushQueue.add('send-push', {
        userId: data.userId,
        title: data.title,
        body: data.body,
        data: data.data,
        badge: data.badge,
        sound: data.sound
      }, {
        attempts: 3,
        backoff: 'exponential',
        delay: 0,
        priority: 1
      });

      this.logger.log(`Push notification queued for user ${data.userId}`);
    } catch (error) {
      this.logger.error('Failed to queue push notification:', error);
      throw error;
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(data: SMSNotificationData): Promise<void> {
    try {
      await this.smsQueue.add('send-sms', {
        to: data.to,
        message: data.message
      }, {
        attempts: 3,
        backoff: 'exponential',
        delay: 1000
      });

      this.logger.log(`SMS queued for ${data.to}`);
    } catch (error) {
      this.logger.error('Failed to queue SMS:', error);
      throw error;
    }
  }

  /**
   * Send in-app notification
   */
  async sendInAppNotification(userId: string, title: string, message: string, data?: Record<string, any>): Promise<void> {
    try {
      await this.inAppQueue.add('send-in-app', {
        userId,
        title,
        message,
        data
      }, {
        attempts: 3,
        backoff: 'exponential',
        delay: 0,
        priority: 1
      });

      this.logger.log(`In-app notification queued for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to queue in-app notification:', error);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userId: string, email: string, name: string): Promise<void> {
    if (!email) {
      this.logger.warn(`No email address provided for user ${userId}`);
      return;
    }

    try {
      // Import the template function
      const { userWelcomeTemplate } = await import('../templates/user-welcome.template');

      // Prepare template data
      const templateData = {
        name,
        email,
        loginUrl: `${this.config.get('FRONTEND_URL')}/login`,
        supportEmail: this.config.get('SUPPORT_EMAIL', 'support@viralfx.com'),
        hasBroker: false, // This would be determined by checking user's broker association
        brokerName: undefined,
      };

      // Generate email content using template
      const { html, text } = userWelcomeTemplate(templateData);

      await this.sendEmail({
        to: email,
        subject: 'Welcome to ViralFX!',
        template: 'user-welcome',
        data: {
          html,
          text,
          ...templateData,
        }
      });
    } catch (error) {
      this.logger.error(`Failed to send welcome email to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send order confirmation notification
   */
  async sendOrderConfirmation(userId: string, orderDetails: any): Promise<void> {
    const userEmail = await this.getUserEmail(userId);

    // Send email confirmation
    if (userEmail) {
      try {
        // Import the template function
        const { orderConfirmationTemplate } = await import('../templates/order-confirmation.template');

        // Prepare template data
        const templateData = {
          orderId: orderDetails.id,
          symbol: orderDetails.symbol,
          side: orderDetails.side,
          quantity: orderDetails.quantity,
          price: orderDetails.price,
          totalAmount: orderDetails.quantity * orderDetails.price,
          orderTime: new Date(orderDetails.createdAt).toLocaleString(),
          userName: await this.getUserName(userId), // Would need to implement this method
        };

        // Generate email content using template
        const { html, text } = orderConfirmationTemplate(templateData);

        await this.sendEmail({
          to: userEmail,
          subject: `Order Confirmation: ${orderDetails.symbol}`,
          template: 'order-confirmation',
          data: {
            html,
            text,
            ...templateData,
          }
        });
      } catch (error) {
        this.logger.error(`Failed to send order confirmation email to user ${userId}:`, error);
      }
    }

    // Send push notification
    await this.sendPushNotification({
      userId,
      title: 'Order Placed',
      body: `${orderDetails.side} ${orderDetails.quantity} ${orderDetails.symbol} at ${orderDetails.price}`,
      data: {
        orderId: orderDetails.id,
        symbol: orderDetails.symbol
      }
    });

    // Send in-app notification
    await this.sendInAppNotification(
      userId,
      'Order Placed',
      `${orderDetails.side} order for ${orderDetails.quantity} ${orderDetails.symbol} has been placed`,
      { orderId: orderDetails.id }
    );
  }

  /**
   * Send order filled notification
   */
  async sendOrderFilled(userId: string, orderDetails: any): Promise<void> {
    const userEmail = await this.getUserEmail(userId);

    // Send push notification
    await this.sendPushNotification({
      userId,
      title: 'Order Filled',
      body: `Your ${orderDetails.side} order for ${orderDetails.quantity} ${orderDetails.symbol} has been filled`,
      data: {
        orderId: orderDetails.id,
        symbol: orderDetails.symbol
      }
    });

    // Send in-app notification
    await this.sendInAppNotification(
      userId,
      'Order Filled',
      `Your order for ${orderDetails.quantity} ${orderDetails.symbol} has been filled at ${orderDetails.fillPrice}`,
      { orderId: orderDetails.id }
    );
  }

  /**
   * Send price alert notification
   */
  async sendPriceAlert(userId: string, alertData: {
    symbol: string;
    currentPrice: number;
    targetPrice: number;
    alertType: 'ABOVE' | 'BELOW';
  }): Promise<void> {
    const userEmail = await this.getUserEmail(userId);

    // Send email notification
    if (userEmail) {
      await this.sendEmail({
        to: userEmail,
        subject: `Price Alert: ${alertData.symbol}`,
        template: 'price-alert',
        data: {
          symbol: alertData.symbol,
          currentPrice: alertData.currentPrice,
          targetPrice: alertData.targetPrice,
          alertType: alertData.alertType
        }
      });
    }

    // Send push notification
    const direction = alertData.alertType === 'ABOVE' ? 'above' : 'below';
    await this.sendPushNotification({
      userId,
      title: 'Price Alert',
      body: `${alertData.symbol} is now ${direction} ${alertData.targetPrice} (current: ${alertData.currentPrice})`,
      data: alertData
    });
  }

  /**
   * Send trend alert notification
   */
  async sendTrendAlert(userId: string, trendData: any): Promise<void> {
    const userEmail = await this.getUserEmail(userId);

    // Send email notification
    if (userEmail) {
      await this.sendEmail({
        to: userEmail,
        subject: `New Trending Topic: ${trendData.name}`,
        template: 'trend-alert',
        data: {
          trendName: trendData.name,
          category: trendData.category,
          momentumScore: trendData.momentum_score,
          viralityRate: trendData.virality_rate
        }
      });
    }

    // Send push notification
    await this.sendPushNotification({
      userId,
      title: 'New Trend Alert',
      body: `${trendData.name} is trending with momentum score ${trendData.momentum_score}`,
      data: trendData
    });
  }

  /**
   * Send security alert notification
   */
  async sendSecurityAlert(userId: string, alertData: {
    type: string;
    description: string;
    ipAddress: string;
    timestamp: Date;
  }): Promise<void> {
    const userEmail = await this.getUserEmail(userId);

    // Send email notification immediately (high priority)
    if (userEmail) {
      await this.sendEmail({
        to: userEmail,
        subject: 'Security Alert - ViralFX',
        template: 'security-alert',
        data: {
          alertType: alertData.type,
          description: alertData.description,
          ipAddress: alertData.ipAddress,
          timestamp: alertData.timestamp
        }
      });
    }

    // Send push notification
    await this.sendPushNotification({
      userId,
      title: 'Security Alert',
      body: alertData.description,
      data: alertData,
      sound: 'alert'
    });

    // Send in-app notification
    await this.sendInAppNotification(
      userId,
      'Security Alert',
      alertData.description,
      alertData
    );
  }

  /**
   * Send broker approval notification
   */
  async sendBrokerApprovalNotification(userId: string, brokerData: any): Promise<void> {
    const userEmail = await this.getUserEmail(userId);

    // Send email notification
    if (userEmail) {
      await this.sendEmail({
        to: userEmail,
        subject: `Broker Account Approved: ${brokerData.name}`,
        template: 'broker-approved',
        data: {
          brokerName: brokerData.name,
          status: brokerData.status,
          nextSteps: 'You can now connect and start trading'
        }
      });
    }

    // Send push notification
    await this.sendPushNotification({
      userId,
      title: 'Broker Approved',
      body: `Your broker account with ${brokerData.name} has been approved`,
      data: brokerData
    });
  }

  /**
   * Send system maintenance notification
   */
  async sendSystemMaintenanceNotification(maintenanceData: {
    startTime: Date;
    endTime: Date;
    description: string;
    affectedServices: string[];
  }): Promise<void> {
    // Send to all active users (would need user service)
    const activeUsers = await this.getActiveUsers();

    for (const user of activeUsers) {
      // Send email notification
      if (user.email) {
        await this.sendEmail({
          to: user.email,
          subject: 'Scheduled Maintenance - ViralFX',
          template: 'system-maintenance',
          data: {
            startTime: maintenanceData.startTime,
            endTime: maintenanceData.endTime,
            description: maintenanceData.description,
            affectedServices: maintenanceData.affectedServices
          }
        });
      }

      // Send push notification
      await this.sendPushNotification({
        userId: user.id,
        title: 'Scheduled Maintenance',
        body: 'ViralFX will be undergoing scheduled maintenance',
        data: maintenanceData
      });

      // Send in-app notification
      await this.sendInAppNotification(
        user.id,
        'Scheduled Maintenance',
        maintenanceData.description,
        maintenanceData
      );
    }
  }

  /**
   * Queue notification for specific channel
   */
  private async queueNotification(channel: NotificationChannel, notificationData: any): Promise<void> {
    switch (channel) {
      case 'EMAIL':
        // Prepare and queue email notification
        await this.queueEmailNotification(notificationData);
        break;
      case 'PUSH':
        await this.pushQueue.add('send-push', notificationData);
        break;
      case 'SMS':
        await this.smsQueue.add('send-sms', notificationData);
        break;
      case 'IN_APP':
        await this.inAppQueue.add('send-in-app', notificationData);
        break;
      case 'WEBHOOK':
        await this.sendWebhookNotification(notificationData);
        break;
      default:
        this.logger.warn(`Unknown notification channel: ${channel}`);
    }
  }

  /**
   * Queue email notification for CRM and other system notifications
   */
  private async queueEmailNotification(notificationData: any): Promise<void> {
    try {
      const { userId, type, data, priority } = notificationData;

      // Get user email
      const userEmail = await this.getUserEmail(userId);
      if (!userEmail) {
        this.logger.warn(`No email found for user ${userId}, skipping email notification`);
        return;
      }

      // Determine email content based on notification type
      const emailContent = await this.generateEmailContent(type, data);

      if (!emailContent) {
        this.logger.warn(`No email template found for notification type: ${type}`);
        return;
      }

      // Queue the email
      await this.emailQueue.add('send-email', {
        to: userEmail,
        subject: emailContent.subject,
        template: emailContent.template,
        data: emailContent.data,
      }, {
        attempts: 3,
        backoff: 'exponential',
        delay: priority === 'CRITICAL' ? 0 : 1000,
        priority: priority === 'CRITICAL' ? 10 : 1,
      });

      this.logger.log(`Email notification queued for user ${userId}, type: ${type}`);
    } catch (error) {
      this.logger.error('Failed to queue email notification:', error);
    }
  }

  /**
   * Generate email content based on notification type
   */
  private async generateEmailContent(type: string, data: any): Promise<any> {
    switch (type) {
      case 'activity_scheduled':
        return {
          subject: `Activity Scheduled: ${data.activityTitle}`,
          template: 'activity-scheduled',
          data: {
            activityTitle: data.activityTitle,
            activityType: data.activityType,
            scheduledFor: data.scheduledFor,
            category: data.category,
          },
        };

      case 'lead_assigned':
        return {
          subject: `New Lead Assigned: ${data.leadName}`,
          template: 'lead-assigned',
          data: {
            leadName: data.leadName,
            leadCompany: data.leadCompany,
            leadSource: data.leadSource,
            leadId: data.leadId,
            category: data.category,
          },
        };

      case 'contract_created':
        return {
          subject: `New Contract Created`,
          template: 'contract-created',
          data: {
            contractType: data.contractType,
            contractValue: data.contractValue,
            category: data.category,
          },
        };

      case 'contract_signed':
        return {
          subject: `Contract Signed Successfully`,
          template: 'contract-signed',
          data: {
            contractId: data.contractId,
            contractType: data.contractType,
            category: data.category,
          },
        };

      case 'contract_signature_required':
        return {
          subject: `Action Required: Contract Signature Needed`,
          template: 'contract-signature-required',
          data: {
            contractId: data.contractId,
            contractNumber: data.contractNumber,
            signatureUrl: data.signatureUrl,
            category: data.category,
          },
        };

      case 'contract_terminated':
        return {
          subject: `Contract Terminated`,
          template: 'contract-terminated',
          data: {
            contractId: data.contractId,
            terminationReason: data.terminationReason,
            category: data.category,
          },
        };

      default:
        // Generic email template for unknown types
        return {
          subject: `Notification: ${type}`,
          template: 'generic-notification',
          data: {
            notificationType: type,
            notificationData: data,
          },
        };
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(notificationData: any): Promise<void> {
    // Implementation for sending webhook notifications
    this.logger.log(`Webhook notification would be sent: ${JSON.stringify(notificationData)}`);
  }

  /**
   * Get user email (would typically use user service)
   */
  private async getUserEmail(userId: string): Promise<string | null> {
    try {
      // In a real implementation, this would query the user service or PrismaService
      // For now, return a mock implementation that could be replaced
      // Example: const user = await this.prismaService.user.findUnique({ where: { id: userId } });
      // return user?.email || null;

      // Mock implementation for demonstration
      return `user-${userId}@example.com`;
    } catch (error) {
      this.logger.error(`Failed to get user email for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get user name (would typically use user service)
   */
  private async getUserName(userId: string): Promise<string> {
    try {
      // In a real implementation, this would query the user service
      // For now, return a mock implementation
      return `User ${userId}`;
    } catch (error) {
      this.logger.error(`Failed to get user name for ${userId}:`, error);
      return 'User';
    }
  }

  /**
   * Get active users for system notifications
   */
  private async getActiveUsers(): Promise<Array<{ id: string; email: string }>> {
    try {
      // In a real implementation, this would query the user service or PrismaService
      // Example: const users = await this.prismaService.user.findMany({ where: { isActive: true } });
      // return users.map(user => ({ id: user.id, email: user.email }));

      // Mock implementation for demonstration
      return [
        { id: 'user1', email: 'user1@example.com' },
        { id: 'user2', email: 'user2@example.com' },
      ];
    } catch (error) {
      this.logger.error('Failed to get active users:', error);
      return [];
    }
  }

  /**
   * Send marketing notifications (with user consent)
   */
  async sendMarketingNotification(userId: string, marketingData: {
    campaign: string;
    subject: string;
    content: string;
    template?: string;
  }): Promise<void> {
    // Check user consent for marketing communications
    const hasConsent = await this.checkMarketingConsent(userId);

    if (!hasConsent) {
      this.logger.warn(`User ${userId} has not consented to marketing communications`);
      return;
    }

    const userEmail = await this.getUserEmail(userId);

    if (userEmail) {
      await this.sendEmail({
        to: userEmail,
        subject: marketingData.subject,
        template: marketingData.template || 'marketing',
        data: {
          campaign: marketingData.campaign,
          content: marketingData.content
        }
      });
    }
  }

  /**
   * Check if user has consented to marketing communications
   */
  private async checkMarketingConsent(userId: string): Promise<boolean> {
    try {
      // This would typically check user preferences
      // For now, return false to be safe
      return false;
    } catch (error) {
      this.logger.error(`Failed to check marketing consent for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send broker verification result notification
   */
  async sendBrokerVerificationResult(brokerId: string, result: any): Promise<void> {
    try {
      const brokerEmail = await this.getBrokerEmail(brokerId);
      const brokerData = await this.getBrokerData(brokerId);

      if (brokerEmail) {
        const subject = result.success
          ? `Verification Successful: ${brokerData.companyName}`
          : `Verification Failed: ${brokerData.companyName}`;

        const template = result.success ? 'broker-verification-success' : 'broker-verification-failed';

        await this.sendEmail({
          to: brokerEmail,
          subject,
          template,
          data: {
            brokerName: brokerData.companyName,
            result: result.success ? 'Approved' : 'Rejected',
            message: result.message,
            nextSteps: result.nextSteps || [],
            rejectionReason: result.rejectionReason,
          }
        });
      }

      // Send in-app notification
      await this.sendInAppNotification(
        brokerId, // For broker notifications, use brokerId as userId
        result.success ? 'Verification Approved' : 'Verification Failed',
        result.message,
        result
      );
    } catch (error) {
      this.logger.error(`Failed to send broker verification result for ${brokerId}:`, error);
    }
  }

  /**
   * Send compliance alert notification
   */
  async sendComplianceAlert(brokerId: string, alert: any): Promise<void> {
    try {
      const brokerEmail = await this.getBrokerEmail(brokerId);
      const brokerData = await this.getBrokerData(brokerId);

      // Send email notification for high severity alerts
      if (brokerEmail && (alert.severity === 'HIGH' || alert.severity === 'CRITICAL')) {
        await this.sendEmail({
          to: brokerEmail,
          subject: `Compliance Alert - ${alert.type}: ${brokerData.companyName}`,
          template: 'compliance-alert',
          data: {
            brokerName: brokerData.companyName,
            alertType: alert.type,
            severity: alert.severity,
            message: alert.message,
            recommendations: alert.recommendations,
            requiresAction: alert.severity === 'CRITICAL',
          }
        });
      }

      // Send in-app notification
      await this.sendInAppNotification(
        brokerId,
        `Compliance Alert: ${alert.type}`,
        alert.message,
        alert
      );

      // Send SMS for critical alerts
      if (alert.severity === 'CRITICAL') {
        const brokerPhone = await this.getBrokerPhone(brokerId);
        if (brokerPhone) {
          await this.sendSMS({
            to: brokerPhone,
            message: `URGENT: Compliance alert for ${brokerData.companyName}. ${alert.message}. Please check your dashboard immediately.`
          });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send compliance alert for broker ${brokerId}:`, error);
    }
  }

  /**
   * Send bill notification
   */
  async sendBillNotification(brokerId: string, billData: any): Promise<void> {
    try {
      const brokerEmail = await this.getBrokerEmail(brokerId);
      const brokerData = await this.getBrokerData(brokerId);

      if (brokerEmail) {
        try {
          // Import the template function
          const { brokerBillTemplate } = await import('../templates/broker-bill.template');

          // Prepare template data
          const templateData = {
            brokerName: brokerData.companyName,
            period: billData.period,
            amount: billData.amount,
            dueDate: billData.dueDate,
            invoiceUrl: billData.invoiceUrl,
            currency: billData.currency || 'ZAR',
            clientCount: billData.clientCount || 0,
            totalVolume: billData.totalVolume || 0,
            commissionRate: billData.commissionRate || 0,
            issueDate: new Date().toLocaleDateString(),
          };

          // Generate email content using template
          const { html, text } = brokerBillTemplate(templateData);

          await this.sendEmail({
            to: brokerEmail,
            subject: `Invoice Generated - ${billData.period} (${brokerData.companyName})`,
            template: 'broker-bill',
            data: {
              html,
              text,
              ...templateData,
            }
          });
        } catch (error) {
          this.logger.error(`Failed to send bill email to broker ${brokerId}:`, error);
        }
      }

      // Send in-app notification
      await this.sendInAppNotification(
        brokerId,
        'New Invoice Available',
        `New invoice of ${billData.amount} is available for ${billData.period}`,
        billData
      );
    } catch (error) {
      this.logger.error(`Failed to send bill notification for broker ${brokerId}:`, error);
    }
  }

  /**
   * Send payment confirmation notification
   */
  async sendPaymentConfirmation(brokerId: string, paymentData: any): Promise<void> {
    try {
      const brokerEmail = await this.getBrokerEmail(brokerId);
      const brokerData = await this.getBrokerData(brokerId);

      if (brokerEmail) {
        try {
          // Import the template function
          const { brokerPayoutTemplate } = await import('../templates/broker-payout.template');

          // Prepare template data
          const templateData = {
            brokerName: brokerData.companyName,
            amount: paymentData.amount,
            billId: paymentData.billId,
            transactionId: paymentData.transactionId,
            paidDate: paymentData.paidDate,
            currency: paymentData.currency || 'ZAR',
            paymentMethod: paymentData.paymentMethod || 'Bank Transfer',
            processingFee: paymentData.processingFee || 0,
            netAmount: paymentData.netAmount || paymentData.amount,
            estimatedArrival: paymentData.estimatedArrival || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          };

          // Generate email content using template
          const { html, text } = brokerPayoutTemplate(templateData);

          await this.sendEmail({
            to: brokerEmail,
            subject: `Payment Confirmation - ${brokerData.companyName}`,
            template: 'broker-payout',
            data: {
              html,
              text,
              ...templateData,
            }
          });
        } catch (error) {
          this.logger.error(`Failed to send payment confirmation email to broker ${brokerId}:`, error);
        }
      }

      // Send in-app notification
      await this.sendInAppNotification(
        brokerId,
        'Payment Confirmed',
        `Payment of ${paymentData.amount} received successfully`,
        paymentData
      );
    } catch (error) {
      this.logger.error(`Failed to send payment confirmation for broker ${brokerId}:`, error);
    }
  }

  /**
   * Send integration test result notification
   */
  async sendIntegrationTestResult(brokerId: string, testResult: any): Promise<void> {
    try {
      const brokerData = await this.getBrokerData(brokerId);

      // Send in-app notification
      await this.sendInAppNotification(
        brokerId,
        testResult.success ? 'Integration Test Passed' : 'Integration Test Failed',
        testResult.success
          ? `${testResult.integrationType} integration test completed successfully`
          : `${testResult.integrationType} integration test failed`,
        testResult
      );

      // Send email for failed tests
      if (!testResult.success) {
        const brokerEmail = await this.getBrokerEmail(brokerId);
        if (brokerEmail) {
          await this.sendEmail({
            to: brokerEmail,
            subject: `Integration Test Failed - ${testResult.integrationType}`,
            template: 'integration-test-failed',
            data: {
              brokerName: brokerData.companyName,
              integrationType: testResult.integrationType,
              errors: testResult.errors,
              recommendations: testResult.recommendations || ['Check integration configuration', 'Review API documentation'],
            }
          });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send integration test result for broker ${brokerId}:`, error);
    }
  }

  // Helper methods for broker data retrieval
  private async getBrokerEmail(brokerId: string): Promise<string | null> {
    try {
      // In a real implementation, this would query the broker service
      const brokerData = await this.getBrokerData(brokerId);
      return brokerData?.contactEmail || null;
    } catch (error) {
      this.logger.error(`Failed to get broker email for ${brokerId}:`, error);
      return null;
    }
  }

  private async getBrokerPhone(brokerId: string): Promise<string | null> {
    try {
      const brokerData = await this.getBrokerData(brokerId);
      return brokerData?.contactPhone || null;
    } catch (error) {
      this.logger.error(`Failed to get broker phone for ${brokerId}:`, error);
      return null;
    }
  }

  private async getBrokerData(brokerId: string): Promise<any> {
    try {
      // In a real implementation, this would call the broker service or inject the BrokersService
      // For now, return a more comprehensive mock implementation
      return {
        id: brokerId,
        companyName: `Broker ${brokerId}`,
        contactEmail: `broker-${brokerId}@example.com`,
        contactPhone: `+2712345${brokerId.slice(-4)}`,
        status: 'VERIFIED',
        tier: 'PREMIUM',
      };
    } catch (error) {
      this.logger.error(`Failed to get broker data for ${brokerId}:`, error);
      return null;
    }
  }

  /**
   * Get recent notifications for a user
   */
  async getRecentNotifications(userId: string, limit: number = 20): Promise<any[]> {
    try {
      // In a real implementation, this would query PrismaService
      // For now, return mock data
      return [
        {
          id: 'notif-1',
          userId,
          type: 'SYSTEM',
          title: 'Welcome to ViralFX',
          message: 'Get started with your trading journey',
          isRead: false,
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        },
        {
          id: 'notif-2',
          userId,
          type: 'PRICE_ALERT',
          title: 'BTC Price Alert',
          message: 'Bitcoin has reached your target price',
          isRead: true,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
      ];
    } catch (error) {
      this.logger.error(`Failed to get recent notifications for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      // In a real implementation, this would query PrismaService
      // For now, return mock count
      return 3;
    } catch (error) {
      this.logger.error(`Failed to get unread count for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    try {
      this.logger.log(`Marking ${notificationIds.length} notifications as read for user ${userId}`);
      // In a real implementation, this would update PrismaService
    } catch (error) {
      this.logger.error(`Failed to mark notifications as read for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Delete notifications for a user
   */
  async deleteNotifications(userId: string, notificationIds: string[]): Promise<void> {
    try {
      this.logger.log(`Deleting ${notificationIds.length} notifications for user ${userId}`);
      // In a real implementation, this would delete from PrismaService
    } catch (error) {
      this.logger.error(`Failed to delete notifications for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string): Promise<any> {
    try {
      // In a real implementation, this would query PrismaService
      return {
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        inAppNotifications: true,
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get notification preferences for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update notification preferences for a user
   */
  async updateNotificationPreferences(userId: string, preferences: any): Promise<void> {
    try {
      this.logger.log(`Updating notification preferences for user ${userId}:`, preferences);
      // In a real implementation, this would update PrismaService
    } catch (error) {
      this.logger.error(`Failed to update notification preferences for user ${userId}:`, error);
      throw error;
    }
  }
}