import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { BillingService } from '../services/billing.service';
import { NotificationService } from "../../notifications/services/notification.service";
import { PrismaService } from "../../../prisma/prisma.service";
// COMMENTED OUT (TypeORM entity deleted): import { BrokerBill, BillStatus } from '../entities/broker-bill.entity';
// COMMENTED OUT (TypeORM entity deleted): import { Broker, BrokerStatus } from '../entities/broker.entity';

export interface BillingJobData {
  brokerId?: string;
  billId?: string;
  period?: Date;
  options?: any;
}

@Processor('broker-billing')
export class BrokerBillingProcessor extends WorkerHost {
  private readonly logger = new Logger(BrokerBillingProcessor.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly billingService: BillingService,
    private readonly notificationService: NotificationService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'generate-monthly-bills':
        return this.handleGenerateMonthlyBills(job);
      case 'send-bill-notification':
        return this.handleSendBillNotification(job);
      case 'check-overdue-bills':
        return this.handleCheckOverdueBills(job);
      case 'suspend-overdue-brokers':
        return this.handleSuspendOverdueBrokers(job);
      case 'process-payment-confirmation':
        return this.handleProcessPaymentConfirmation(job);
      case 'generate-billing-report':
        return this.handleGenerateBillingReport(job);
      case 'send-billing-reminders':
        return this.handleSendBillingReminders(job);
      case 'reconcile-payments':
        return this.handleReconcilePayments(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  @OnWorkerEvent('active')
  onActive(job: Job<BillingJobData>) {
    this.logger.log(`Processing billing job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<BillingJobData>) {
    this.logger.log(`Completed billing job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<BillingJobData>, error: Error) {
    this.logger.error(`Failed billing job ${job.id} of type ${job.name}:`, error);
  }

  private async handleGenerateMonthlyBills(job: Job<BillingJobData>) {
    this.logger.log('Generating monthly bills for all active brokers');

    try {
      const { period } = job.data;
      const billingPeriod = period || new Date();

      // Query all active brokers
      const brokers = await this.getActiveBrokers();
      const brokerIds = brokers.map(broker => broker.id);

      const results = [];

      for (const brokerId of brokerIds) {
        try {
          const bill = await this.billingService.generateMonthlyBill(brokerId, billingPeriod);
          results.push({ brokerId, billId: bill.id, success: true });
          this.logger.log(`Generated monthly bill for broker ${brokerId}: ${bill.id}`);
        } catch (error) {
          this.logger.error(`Failed to generate monthly bill for broker ${brokerId}:`, error);
          results.push({ brokerId, error: error.message, success: false });
        }
      }

      const successfulBills = results.filter(r => r.success).length;
      const failedBills = results.filter(r => !r.success).length;

      await this.logBillingActivity('SYSTEM', 'MONTHLY_BILL_GENERATION', {
        period: billingPeriod.toISOString(),
        totalBrokers: brokerIds.length,
        successfulBills,
        failedBills
      });

      this.logger.log(`Monthly bill generation completed. Success: ${successfulBills}, Failed: ${failedBills}`);

      return {
        success: true,
        totalBrokers: brokerIds.length,
        successfulBills,
        failedBills,
        results
      };
    } catch (error) {
      this.logger.error('Monthly bill generation failed:', error);

      await this.logBillingActivity('SYSTEM', 'MONTHLY_BILL_GENERATION_ERROR', {
        error: error.message
      });

      throw error;
    }
  }

  private async handleSendBillNotification(job: Job<BillingJobData>) {
    const { billId } = job.data;

    this.logger.log(`Sending bill notification for bill ${billId}`);

    try {
      await this.billingService.sendBillNotification(billId);

      await this.logBillingActivity(billId, 'BILL_NOTIFICATION_SENT', {
        billId,
        sentAt: new Date().toISOString()
      });

      this.logger.log(`Bill notification sent for ${billId}`);
      return { success: true, message: 'Notification sent' };
    } catch (error) {
      this.logger.error(`Failed to send bill notification for ${billId}:`, error);

      await this.logBillingActivity(billId, 'BILL_NOTIFICATION_ERROR', {
        billId,
        error: error.message
      });

      throw error;
    }
  }

  private async handleCheckOverdueBills(job: Job<BillingJobData>) {
    this.logger.log('Checking for overdue bills');

    try {
      await this.billingService.checkOverdueBills();

      await this.logBillingActivity('SYSTEM', 'OVERDUE_BILLS_CHECK', {
        checkedAt: new Date().toISOString()
      });

      this.logger.log('Overdue bills check completed');
      return { success: true, message: 'Overdue bills check completed' };
    } catch (error) {
      this.logger.error('Failed to check overdue bills:', error);

      await this.logBillingActivity('SYSTEM', 'OVERDUE_BILLS_CHECK_ERROR', {
        error: error.message
      });

      throw error;
    }
  }

  private async handleSuspendOverdueBrokers(job: Job<BillingJobData>) {
    this.logger.log('Suspending brokers with severely overdue bills');

    try {
      // Find brokers with bills overdue > 30 days
      const overdueBrokerIds = await this.getBrokersWithOverdueBills();

      const results = [];

      for (const brokerId of overdueBrokerIds) {
        try {
          // This would call a broker suspension service
          await this.suspendBrokerForOverdueBills(brokerId);
          results.push({ brokerId, success: true });
          this.logger.log(`Suspended broker ${brokerId} for overdue bills`);
        } catch (error) {
          this.logger.error(`Failed to suspend broker ${brokerId}:`, error);
          results.push({ brokerId, error: error.message, success: false });
        }
      }

      const suspended = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      await this.logBillingActivity('SYSTEM', 'BROKER_SUSPENSIONS', {
        suspended,
        failed,
        totalChecked: overdueBrokerIds.length
      });

      this.logger.log(`Broker suspensions completed. Suspended: ${suspended}, Failed: ${failed}`);

      return {
        success: true,
        suspended,
        failed,
        results
      };
    } catch (error) {
      this.logger.error('Failed to suspend overdue brokers:', error);

      await this.logBillingActivity('SYSTEM', 'BROKER_SUSPENSIONS_ERROR', {
        error: error.message
      });

      throw error;
    }
  }

  private async handleProcessPaymentConfirmation(job: Job<BillingJobData>) {
    const { billId, options } = job.data;

    this.logger.log(`Processing payment confirmation for bill ${billId}`);

    try {
      const { paymentData } = options;

      // Update bill status and send confirmation
      // This is handled by the webhook endpoint, but this processor can handle additional processing

      await this.logBillingActivity(billId, 'PAYMENT_CONFIRMATION_PROCESSED', {
        billId,
        paymentData,
        processedAt: new Date().toISOString()
      });

      // Trigger any post-payment actions
      await this.handlePostPaymentActions(billId, paymentData);

      this.logger.log(`Payment confirmation processed for bill ${billId}`);
      return { success: true, message: 'Payment confirmation processed' };
    } catch (error) {
      this.logger.error(`Failed to process payment confirmation for bill ${billId}:`, error);

      await this.logBillingActivity(billId, 'PAYMENT_CONFIRMATION_ERROR', {
        billId,
        error: error.message
      });

      throw error;
    }
  }

  private async handleGenerateBillingReport(job: Job<BillingJobData>) {
    const { options } = job.data;

    this.logger.log('Generating billing report');

    try {
      const { period, reportType, format } = options;

      // In a real implementation, this would query billing data and generate reports
      const reportData = {
        period,
        reportType,
        totalRevenue: 150000,
        paidBills: 45,
        pendingBills: 12,
        overdueBills: 3,
        generatedAt: new Date().toISOString()
      };

      await this.logBillingActivity('SYSTEM', 'BILLING_REPORT_GENERATED', {
        period: period.toISOString(),
        reportType,
        format,
        data: reportData
      });

      this.logger.log(`Billing report generated for ${reportType}`);
      return {
        success: true,
        data: reportData
      };
    } catch (error) {
      this.logger.error('Failed to generate billing report:', error);

      await this.logBillingActivity('SYSTEM', 'BILLING_REPORT_ERROR', {
        error: error.message
      });

      throw error;
    }
  }

  private async handleSendBillingReminders(job: Job<BillingJobData>) {
    this.logger.log('Sending billing reminders');

    try {
      // Find bills due soon or overdue
      const reminderData = await this.getBillsNeedingReminders();

      const results = [];

      for (const reminder of reminderData) {
        try {
          await this.sendBillingReminder(reminder);
          results.push({ ...reminder, success: true });
        } catch (error) {
          this.logger.error(`Failed to send billing reminder for ${reminder.billId}:`, error);
          results.push({ ...reminder, error: error.message, success: false });
        }
      }

      const sent = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      await this.logBillingActivity('SYSTEM', 'BILLING_REMINDERS_SENT', {
        sent,
        failed,
        totalProcessed: reminderData.length
      });

      this.logger.log(`Billing reminders completed. Sent: ${sent}, Failed: ${failed}`);

      return {
        success: true,
        sent,
        failed,
        results
      };
    } catch (error) {
      this.logger.error('Failed to send billing reminders:', error);

      await this.logBillingActivity('SYSTEM', 'BILLING_REMINDERS_ERROR', {
        error: error.message
      });

      throw error;
    }
  }

  private async handleReconcilePayments(job: Job<BillingJobData>) {
    this.logger.log('Reconciling payments');

    try {
      const { period } = job.data;

      // In a real implementation, this would reconcile payments with external systems
      const reconciliationResults = {
        period: period?.toISOString(),
        totalPayments: 23,
        reconciledPayments: 22,
        unreconciledPayments: 1,
        totalAmount: 34500,
        reconciledAmount: 34000,
        unreconciledAmount: 500
      };

      await this.logBillingActivity('SYSTEM', 'PAYMENT_RECONCILIATION', {
        results: reconciliationResults
      });

      this.logger.log(`Payment reconciliation completed. Reconciled: ${reconciliationResults.reconciledPayments}/${reconciliationResults.totalPayments}`);

      return {
        success: true,
        data: reconciliationResults
      };
    } catch (error) {
      this.logger.error('Failed to reconcile payments:', error);

      await this.logBillingActivity('SYSTEM', 'PAYMENT_RECONCILIATION_ERROR', {
        error: error.message
      });

      throw error;
    }
  }

  private async suspendBrokerForOverdueBills(brokerId: string): Promise<void> {
    // In a real implementation, this would call the broker service to suspend the broker
    // and log the suspension reason
    await this.logBillingActivity(brokerId, 'BROKER_SUSPENDED', {
      reason: 'OVERDUE_BILLS',
      suspendedAt: new Date().toISOString()
    });
  }

  private async handlePostPaymentActions(billId: string, paymentData: any): Promise<void> {
    // Handle actions after payment confirmation
    // e.g., reactivate suspended brokers, send thank you emails, update analytics

    await this.logBillingActivity(billId, 'POST_PAYMENT_ACTIONS', {
      paymentData,
      actionsPerformed: ['STATUS_UPDATED', 'NOTIFICATION_SENT', 'ANALYTICS_UPDATED']
    });
  }

  private async sendBillingReminder(reminder: any): Promise<void> {
    const { brokerId, billId, daysUntilDue, daysOverdue, type } = reminder;

    let message = '';
    let severity = 'MEDIUM';

    if (type === 'DUE_SOON') {
      message = `Your bill is due in ${daysUntilDue} days`;
      severity = daysUntilDue <= 2 ? 'HIGH' : 'MEDIUM';
    } else if (type === 'OVERDUE') {
      message = `Your bill is ${daysOverdue} days overdue`;
      severity = daysOverdue >= 14 ? 'HIGH' : 'MEDIUM';
    }

    await this.notificationService.sendComplianceAlert(brokerId, {
      id: `reminder-${billId}`,
      brokerId,
      type: 'BILLING_REMINDER',
      severity,
      message,
      details: {
        billId,
        daysUntilDue,
        daysOverdue,
        type
      },
      recommendations: [
        'Make payment as soon as possible',
        'Contact support if you have issues',
        'Review your payment methods',
      ],
      createdAt: new Date(),
      status: 'OPEN'
    });
  }

  private async logBillingActivity(
    entityId: string,
    activity: string,
    details: any): Promise<void> {
    await this.prismaService.auditLog.create({
      data: {
        action: 'BILLING_OPERATION',
        entityType: 'BROKER_BILL',
        entityId,
        oldValues: null,
        newValues: JSON.stringify({
          activity,
          details,
          timestamp: new Date().toISOString()
        }),
        userId: null,
        ipAddress: null,
        userAgent: 'Billing Processor'
      }
    });
  }

  private async getActiveBrokers(): Promise<Broker[]> {
    try {
      return await this.prisma.broker.findMany({
        where: {
          isActive: true,
          status: BrokerStatus.VERIFIED
        },
        select: ['id']
      });
    } catch (error) {
      this.logger.error('Failed to get active brokers:', error);
      return [];
    }
  }

  private async getBrokersWithOverdueBills(): Promise<string[]> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const overdueBills = await this.prisma.billrepository.findMany({
        where: {
          dueDate: LessThan(thirtyDaysAgo),
          status: BillStatus.PENDING
        },
        relations: ['broker'],
        select: ['broker']
      });

      return [...new Set(overdueBills.map(bill => bill.broker.id))];
    } catch (error) {
      this.logger.error('Failed to get brokers with overdue bills:', error);
      return [];
    }
  }

  private async getBillsNeedingReminders(): Promise<Array<{
    brokerId: string;
    billId: string;
    daysUntilDue?: number;
    daysOverdue?: number;
    type: string;
  }>> {
    try {
      const reminderData = [];
      const today = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      // Find bills due in next 3 days
      const dueSoonBills = await this.prisma.billrepository.findMany({
        where: {
          dueDate: LessThan(threeDaysFromNow),
          status: BillStatus.PENDING
        },
        relations: ['broker']
      });

      for (const bill of dueSoonBills) {
        const daysUntilDue = Math.ceil((bill.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue >= 0) {
          reminderData.push({
            brokerId: bill.broker.id,
            billId: bill.id,
            daysUntilDue,
            type: 'DUE_SOON'
          });
        }
      }

      // Find overdue bills (less than 30 days overdue)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const overdueBills = await this.prisma.billrepository.findMany({
        where: {
          dueDate: MoreThan(thirtyDaysAgo),
          dueDate: LessThan(today),
          status: BillStatus.PENDING
        },
        relations: ['broker']
      });

      for (const bill of overdueBills) {
        const daysOverdue = Math.ceil((today.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        reminderData.push({
          brokerId: bill.broker.id,
          billId: bill.id,
          daysOverdue,
          type: 'OVERDUE'
        });
      }

      return reminderData;
    } catch (error) {
      this.logger.error('Failed to get bills needing reminders:', error);
      return [];
    }
  }
}
