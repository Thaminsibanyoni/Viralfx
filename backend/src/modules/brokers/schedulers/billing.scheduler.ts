import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BillingService } from '../services/billing.service';
import { startOfMonth, endOfMonth, addMonths } from 'date-fns';

@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(
    private readonly billingService: BillingService,
    @InjectQueue('broker-billing') private billingQueue: Queue,
  ) {}

  @Cron('0 0 1 * *') // Monthly on 1st at midnight
  async handleGenerateMonthlyBills() {
    this.logger.log('Starting monthly bill generation on 1st of the month at midnight');

    try {
      // Calculate billing period (previous month)
      const now = new Date();
      const billingPeriod = addMonths(now, -1);
      const periodStart = startOfMonth(billingPeriod);
      const periodEnd = endOfMonth(billingPeriod);

      this.logger.log(`Generating bills for period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

      // Queue monthly bill generation
      const job = await this.billingQueue.add('generate-monthly-bills', {
        period: periodStart,
        options: {
          periodStart,
          periodEnd,
        },
      }, {
        attempts: 3,
        backoff: 'exponential',
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      this.logger.log(`Monthly bill generation job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        },
        message: 'Monthly bill generation initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue monthly bill generation:', error);
      throw error;
    }
  }

  @Cron('0 9 * * *') // Daily at 9 AM
  async handleSendBillReminders() {
    this.logger.log('Starting daily bill reminder process at 9 AM');

    try {
      // Queue bill reminder sending
      const job = await this.billingQueue.add('send-billing-reminders', {
        options: {
          reminderTypes: ['DUE_SOON', 'OVERDUE'],
          daysUntilDue: [7, 3, 1], // Reminders 7, 3, and 1 days before due
          overdueDays: [7, 14, 30], // Overdue reminders at 7, 14, and 30 days
        },
      }, {
        attempts: 2,
        backoff: 'fixed',
        delay: 0,
      });

      this.logger.log(`Bill reminders job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        message: 'Bill reminder process initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue bill reminders:', error);
      throw error;
    }
  }

  @Cron('0 10 * * *') // Daily at 10 AM
  async handleCheckOverdueBills() {
    this.logger.log('Starting daily overdue bills check at 10 AM');

    try {
      // Queue overdue bills check
      const job = await this.billingQueue.add('check-overdue-bills', {}, {
        attempts: 3,
        backoff: 'exponential',
      });

      this.logger.log(`Overdue bills check job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        message: 'Overdue bills check initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue overdue bills check:', error);
      throw error;
    }
  }

  @Cron('0 11 * * *') // Daily at 11 AM
  async handleSuspendOverdueBrokers() {
    this.logger.log('Starting daily overdue broker suspension check at 11 AM');

    try {
      // Queue broker suspension check (runs after overdue bills check)
      const job = await this.billingQueue.add('suspend-overdue-brokers', {
        options: {
          suspensionThreshold: 30, // Days overdue before suspension
          notificationPeriod: 7, // Days warning before suspension
        },
      }, {
        attempts: 2,
        backoff: 'fixed',
      });

      this.logger.log(`Overdue broker suspension job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        message: 'Overdue broker suspension check initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue overdue broker suspension:', error);
      throw error;
    }
  }

  @Cron('0 0 * * 0') // Weekly on Sunday at midnight
  async handleGenerateWeeklyBillingReport() {
    this.logger.log('Generating weekly billing report');

    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date();
      weekEnd.setHours(23, 59, 59, 999);

      // Queue weekly billing report generation
      const job = await this.billingQueue.add('generate-billing-report', {
        options: {
          reportType: 'WEEKLY',
          period: {
            start: weekStart,
            end: weekEnd,
          },
          format: 'PDF',
          includeCharts: true,
        },
      });

      this.logger.log(`Weekly billing report job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        period: {
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
        },
        message: 'Weekly billing report generation initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue weekly billing report:', error);
      throw error;
    }
  }

  @Cron('0 0 1 * *') // Monthly on 1st at 1 AM
  async handleGenerateMonthlyBillingReport() {
    this.logger.log('Generating monthly billing report');

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Queue monthly billing report generation
      const job = await this.billingQueue.add('generate-billing-report', {
        options: {
          reportType: 'MONTHLY',
          period: {
            start: monthStart,
            end: monthEnd,
          },
          format: 'PDF',
          includeCharts: true,
          includeTrends: true,
        },
      });

      this.logger.log(`Monthly billing report job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        period: {
          start: monthStart.toISOString(),
          end: monthEnd.toISOString(),
        },
        message: 'Monthly billing report generation initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue monthly billing report:', error);
      throw error;
    }
  }

  @Cron('0 2 * * 6') // Weekly on Saturday at 2 AM
  async handlePaymentReconciliation() {
    this.logger.log('Starting weekly payment reconciliation');

    try {
      const now = new Date();
      const reconciliationPeriod = new Date(now);
      reconciliationPeriod.setDate(now.getDate() - 7);

      // Queue payment reconciliation
      const job = await this.billingQueue.add('reconcile-payments', {
        period: reconciliationPeriod,
        options: {
          reconcileGateways: ['paystack', 'payfast', 'ozow'],
          autoReconcile: true,
          generateDiscrepancyReport: true,
        },
      }, {
        attempts: 3,
        backoff: 'exponential',
      });

      this.logger.log(`Payment reconciliation job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        period: reconciliationPeriod.toISOString(),
        message: 'Payment reconciliation initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue payment reconciliation:', error);
      throw error;
    }
  }

  @Cron('0 6 * * *') // Daily at 6 AM
  async handleBillingDataCleanup() {
    this.logger.log('Starting daily billing data cleanup');

    try {
      // Queue old data cleanup (remove records older than 2 years)
      const cleanupDate = new Date();
      cleanupDate.setFullYear(cleanupDate.getFullYear() - 2);

      const job = await this.billingQueue.add('cleanup-billing-data', {
        options: {
          cutoffDate: cleanupDate,
          cleanupTypes: ['audit_logs', 'temp_bills', 'failed_payments'],
          archiveOldData: true,
        },
      }, {
        attempts: 1,
        removeOnComplete: true,
      });

      this.logger.log(`Billing data cleanup job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        cutoffDate: cleanupDate.toISOString(),
        message: 'Billing data cleanup initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue billing data cleanup:', error);
      throw error;
    }
  }

  @Cron('0 */12 * * *') // Every 12 hours
  async handleBillingHealthCheck() {
    this.logger.log('Running billing system health check');

    try {
      // Queue health check for billing systems
      const job = await this.billingQueue.add('billing-health-check', {
        options: {
          checkGateways: true,
          checkDatabase: true,
          checkQueues: true,
          generateHealthReport: true,
        },
      }, {
        attempts: 1,
        timeout: 300000, // 5 minutes timeout
      });

      this.logger.log(`Billing health check job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        message: 'Billing system health check initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue billing health check:', error);
      throw error;
    }
  }

  // Manual trigger methods for testing and admin purposes
  async triggerManualBillGeneration(brokerIds: string[], period?: Date) {
    this.logger.log('Triggering manual bill generation for specific brokers');

    try {
      const billingPeriod = period || new Date();

      const jobs = [];
      for (const brokerId of brokerIds) {
        const job = await this.billingQueue.add('generate-monthly-bills', {
          period: billingPeriod,
          brokerIds: [brokerId], // Override to process only specific brokers
        });
        jobs.push({ brokerId, jobId: job.id });
      }

      this.logger.log(`Manual bill generation jobs queued for ${brokerIds.length} brokers`);

      return {
        success: true,
        period: billingPeriod.toISOString(),
        jobs,
      };
    } catch (error) {
      this.logger.error('Failed to trigger manual bill generation:', error);
      throw error;
    }
  }

  async triggerManualReminderSend(reminderType: string, brokerIds?: string[]) {
    this.logger.log(`Triggering manual ${reminderType} reminder sending`);

    try {
      const job = await this.billingQueue.add('send-billing-reminders', {
        options: {
          reminderTypes: [reminderType],
          brokerIds, // Optional specific brokers
          manualTrigger: true,
        },
      });

      this.logger.log(`Manual ${reminderType} reminder job queued with ID: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        reminderType,
      };
    } catch (error) {
      this.logger.error(`Failed to trigger manual ${reminderType} reminder:`, error);
      throw error;
    }
  }
}