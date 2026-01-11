import {Processor, WorkerHost} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerInvoice } from '../entities/broker-invoice.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerAccount } from '../entities/broker-account.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerPayment } from '../entities/broker-payment.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerSubscription } from '../entities/broker-subscription.entity';
import { BillingService } from '../services/billing.service';
import { NotificationService } from "../../notifications/notifications.service";

interface RecurringInvoiceJob {
  brokerId: string;
  subscriptionId: string;
  dueDate: Date;
}

interface PaymentRetryJob {
  invoiceId: string;
  paymentId: string;
  retryCount: number;
  maxRetries: number;
}

interface OverdueCheckJob {
  invoiceIds: string[];
}

interface PaymentReminderJob {
  invoiceId: string;
  reminderType: 'due-soon' | 'overdue' | 'critical';
}

@Processor('crm-billing')
export class CrmBillingProcessor extends WorkerHost {
  private readonly logger = new Logger(CrmBillingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly notificationsService: NotificationService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'generate-recurring-invoice':
        return this.handleRecurringInvoiceGeneration(job);
      case 'retry-payment':
        return this.handlePaymentRetry(job);
      case 'check-overdue-invoices':
        return this.handleOverdueCheck(job);
      case 'generate-monthly-statements':
        return this.handleMonthlyStatementGeneration(job);
      case 'process-payment-webhooks':
        return this.handlePaymentWebhooks(job);
      case 'cleanup-old-invoices':
        return this.handleOldInvoiceCleanup(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async handleRecurringInvoiceGeneration(job: Job<RecurringInvoiceJob>) {
    try {
      this.logger.log(`Processing recurring invoice generation for broker ${job.data.brokerId}`);

      const { brokerId, subscriptionId, dueDate } = job.data;

      // Get broker and subscription details
      const broker = await this.prisma.brokeraccountrepository.findFirst({
        where: { id: brokerId },
        relations: ['user']
      });

      const subscription = await this.prisma.subscriptionrepository.findFirst({
        where: { id: subscriptionId }
      });

      if (!broker || !subscription) {
        this.logger.warn(`Broker or subscription not found for recurring invoice generation`);
        return { success: false, error: 'Broker or subscription not found' };
      }

      // Check if invoice for this period already exists
      const existingInvoice = await this.prisma.invoicerepository.findFirst({
        where: {
          brokerId,
          subscriptionId,
          dueDate: new Date(dueDate),
          status: ['DRAFT', 'SENT']
        }
      });

      if (existingInvoice) {
        this.logger.log(`Invoice already exists for broker ${brokerId} for period ${dueDate}`);
        return { success: true, message: 'Invoice already exists', invoiceId: existingInvoice.id };
      }

      // Generate recurring invoice
      const invoice = await this.billingService.generateBrokerMonthlyInvoice(brokerId, subscriptionId);

      this.logger.log(`Generated recurring invoice ${invoice.id} for broker ${brokerId}`);

      // Send notification
      await this.notificationsService.sendNotification({
        userId: broker.userId,
        title: 'New Invoice Generated',
        message: `Your monthly invoice ${invoice.invoiceNumber} for ${subscription.planName} has been generated.`,
        type: 'INFO',
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.totalAmount
        }
      });

      return { success: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };

    } catch (error) {
      this.logger.error(`Error processing recurring invoice generation: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  private async handlePaymentRetry(job: Job<PaymentRetryJob>) {
    try {
      this.logger.log(`Processing payment retry for invoice ${job.data.invoiceId}, payment ${job.data.paymentId}`);

      const { invoiceId, paymentId, retryCount, maxRetries } = job.data;

      if (retryCount >= maxRetries) {
        this.logger.warn(`Max retries reached for payment ${paymentId}`);

        // Mark payment as failed permanently
        await this.prisma.paymentrepository.update(paymentId, {
          status: 'FAILED',
          failureReason: 'Maximum retry attempts reached',
          retriedAt: new Date()
        });

        // Send notification about payment failure
        const payment = await this.prisma.paymentrepository.findFirst({
          where: { id: paymentId },
          relations: ['invoice', 'invoice.broker', 'invoice.broker.user']
        });

        if (payment?.invoice?.broker?.user) {
          await this.notificationsService.sendNotification({
            userId: payment.invoice.broker.user.id,
            title: 'Payment Failed',
            message: `Payment for invoice ${payment.invoice.invoiceNumber} has failed after multiple attempts. Please update your payment method.`,
            type: 'ERROR',
            metadata: {
              invoiceId: payment.invoiceId,
              paymentId: payment.id,
              amount: payment.amount
            }
          });
        }

        return { success: false, error: 'Maximum retries reached' };
      }

      // Get payment details
      const payment = await this.prisma.paymentrepository.findFirst({
        where: { id: paymentId },
        relations: ['invoice', 'invoice.broker']
      });

      if (!payment || payment.status === 'COMPLETED') {
        this.logger.log(`Payment ${paymentId} already completed or not found`);
        return { success: true, message: 'Payment already completed' };
      }

      // Retry payment using the billing service
      const retryResult = await this.billingService.retryPayment(paymentId);

      // Update retry count
      await this.prisma.paymentrepository.update(paymentId, {
        retryCount: retryCount + 1,
        retriedAt: new Date(),
        status: retryResult.success ? 'COMPLETED' : 'PENDING',
        failureReason: retryResult.error
      });

      if (retryResult.success) {
        this.logger.log(`Payment retry successful for payment ${paymentId}`);

        // Update invoice status
        const totalPaid = await this.billingService.getTotalPaidAmount(invoiceId);
        if (totalPaid >= payment.invoice.totalAmount) {
          await this.prisma.invoicerepository.update(invoiceId, {
            status: 'PAID',
            paidAt: new Date()
          });
        }

        // Send success notification
        if (payment.invoice?.broker?.user) {
          await this.notificationsService.sendNotification({
            userId: payment.invoice.broker.user.id,
            title: 'Payment Successful',
            message: `Payment of R${payment.amount.toLocaleString()} for invoice ${payment.invoice.invoiceNumber} has been processed successfully.`,
            type: 'SUCCESS',
            metadata: {
              invoiceId: payment.invoiceId,
              paymentId: payment.id,
              amount: payment.amount
            }
          });
        }

        return { success: true, paymentId: payment.id };
      } else {
        // Schedule next retry with exponential backoff
        const delay = Math.min(2 ** retryCount * 60000, 24 * 60 * 60 * 1000); // Max 24 hours
        const nextRetryDate = new Date(Date.now() + delay);

        await this.billingService.schedulePaymentRetry(
          invoiceId,
          paymentId,
          retryCount + 1,
          maxRetries,
          nextRetryDate);

        this.logger.log(`Payment retry failed, next retry scheduled for ${nextRetryDate}`);
        return { success: false, nextRetryDate };
      }

    } catch (error) {
      this.logger.error(`Error processing payment retry: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  private async handleOverdueCheck(job: Job<OverdueCheckJob>) {
    try {
      this.logger.log(`Processing overdue invoice check for ${job.data.invoiceIds.length} invoices`);

      const { invoiceIds } = job.data;

      // Get overdue invoices
      const overdueInvoices = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.broker', 'broker')
        .leftJoinAndSelect('broker.user', 'user')
        .where('invoice.id IN (:...invoiceIds)', { invoiceIds })
        .andWhere('invoice.dueDate < :now', { now: new Date() })
        .andWhere('invoice.status NOT IN (:...paidStatus)', { paidStatus: ['PAID', 'CANCELLED'] })
        .getMany();

      const results = [];

      for (const invoice of overdueInvoices) {
        const daysOverdue = Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));

        // Determine reminder type based on days overdue
        let reminderType: 'due-soon' | 'overdue' | 'critical';
        if (daysOverdue <= 1) {
          reminderType = 'due-soon';
        } else if (daysOverdue <= 7) {
          reminderType = 'overdue';
        } else {
          reminderType = 'critical';
        }

        // Schedule reminder if not already sent recently
        const lastReminderSent = invoice.lastReminderSent;
        const canSendReminder = !lastReminderSent ||
          (Date.now() - new Date(lastReminderSent).getTime()) > (24 * 60 * 60 * 1000); // 24 hours

        if (canSendReminder) {
          // Send payment reminder notification
          await this.notificationsService.sendNotification({
            userId: invoice.broker.user.id,
            title: `Payment Reminder - ${invoice.invoiceNumber}`,
            message: `Your invoice ${invoice.invoiceNumber} is ${daysOverdue} days overdue. Amount due: R${invoice.totalAmount.toLocaleString()}.`,
            type: reminderType === 'critical' ? 'ERROR' : 'WARNING',
            metadata: {
              invoiceId: invoice.id,
              daysOverdue,
              amount: invoice.totalAmount
            }
          });

          // Update last reminder sent
          await this.prisma.invoicerepository.update(invoice.id, {
            lastReminderSent: new Date()
          });

          results.push({
            invoiceId: invoice.id,
            daysOverdue,
            reminderSent: true,
            reminderType
          });
        } else {
          results.push({
            invoiceId: invoice.id,
            daysOverdue,
            reminderSent: false,
            reason: 'Reminder sent within last 24 hours'
          });
        }

        // Check if invoice needs to be marked as critically overdue
        if (daysOverdue >= 30 && invoice.status !== 'OVERDUE_CRITICAL') {
          await this.prisma.invoicerepository.update(invoice.id, {
            status: 'OVERDUE_CRITICAL'
          });

          // Send critical overdue notification to admin users
          await this.notificationsService.sendAdminNotification({
            title: 'Critical Overdue Invoice',
            message: `Invoice ${invoice.invoiceNumber} for ${invoice.broker.companyName} is ${daysOverdue} days overdue.`,
            type: 'ERROR',
            priority: 'HIGH',
            metadata: {
              invoiceId: invoice.id,
              brokerId: invoice.brokerId,
              daysOverdue,
              amount: invoice.totalAmount
            }
          });
        }
      }

      this.logger.log(`Completed overdue check for ${results.length} invoices`);
      return { success: true, processed: results.length, results };

    } catch (error) {
      this.logger.error(`Error processing overdue check: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  private async handleMonthlyStatementGeneration(job: Job) {
    try {
      this.logger.log('Processing monthly statement generation');

      const currentDate = new Date();
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const endOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);

      // Get all active brokers
      const activeBrokers = await this.prisma.brokeraccountrepository.findMany({
        where: { status: 'APPROVED' },
        relations: ['user']
      });

      const statements = [];

      for (const broker of activeBrokers) {
        try {
          // Generate monthly statement
          const statement = await this.billingService.generateMonthlyStatement(
            broker.id,
            lastMonth,
            endOfLastMonth);

          // Send notification about statement
          await this.notificationsService.sendNotification({
            userId: broker.user.id,
            title: 'Monthly Statement Available',
            message: `Your monthly statement for ${lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} is now available.`,
            type: 'INFO',
            metadata: {
              statementId: statement.id,
              period: lastMonth.toISOString()
            }
          });

          statements.push({
            brokerId: broker.id,
            statementId: statement.id,
            success: true
          });

        } catch (error) {
          this.logger.error(`Error generating statement for broker ${broker.id}: ${error.message}`);
          statements.push({
            brokerId: broker.id,
            success: false,
            error: error.message
          });
        }
      }

      this.logger.log(`Generated ${statements.filter(s => s.success).length} monthly statements`);
      return { success: true, total: statements.length, successful: statements.filter(s => s.success).length, statements };

    } catch (error) {
      this.logger.error(`Error processing monthly statement generation: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  private async handlePaymentWebhooks(job: Job) {
    try {
      this.logger.log('Processing payment webhooks batch');

      const { webhookData } = job.data;

      // Process webhook data through payment webhook service
      const results = await this.billingService.processPaymentWebhook(webhookData);

      this.logger.log(`Processed ${results.processed} payment webhooks`);
      return { success: true, ...results };

    } catch (error) {
      this.logger.error(`Error processing payment webhooks: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  private async handleOldInvoiceCleanup(job: Job) {
    try {
      this.logger.log('Processing old invoice cleanup');

      const { olderThanDays = 365 } = job.data;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Find old paid/cancelled invoices
      const oldInvoices = await this.prisma.invoicerepository.findMany({
        where: {
          createdAt: { $lt: cutoffDate },
          status: ['PAID', 'CANCELLED']
        }
      });

      // Archive or delete old invoices
      for (const invoice of oldInvoices) {
        await this.billingService.archiveInvoice(invoice.id);
      }

      this.logger.log(`Cleaned up ${oldInvoices.length} old invoices`);
      return { success: true, archived: oldInvoices.length };

    } catch (error) {
      this.logger.error(`Error processing old invoice cleanup: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }
}
