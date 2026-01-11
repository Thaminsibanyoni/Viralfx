import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from "../../../prisma/prisma.service";
import { BillingService } from '../services/billing.service';
import { NotificationService } from "../../notifications/services/notification.service";
import { WebhookService } from '../services/webhook.service';

@Processor('api-billing')
export class BillingProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingProcessor.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private billingService: BillingService,
    private notificationService: NotificationService,
    private webhookService: WebhookService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'generate-invoice':
        return this.handleInvoiceGeneration(job);
      case 'process-payment':
        return this.handlePaymentProcessing(job);
      case 'retry-failed-payments':
        return this.handleFailedPaymentsRetry(job);
      case 'send-payment-reminders':
        return this.handlePaymentReminders(job);
      case 'monthly-billing-cycle':
        return this.handleMonthlyBillingCycle(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async handleInvoiceGeneration(job: Job): Promise<void> {
    const { customerId, customerType, period } = job.data;

    try {
      this.logger.log(
        `Generating invoice for ${customerType} ${customerId} for period ${period.start} to ${period.end}`);

      // Generate the invoice (includes email sending via BillingService.sendInvoiceEmail)
      const invoice = await this.billingService.generateInvoice(
        customerId,
        customerType,
        period);

      const invoiceDueDays = parseInt(this.config.get<string>('API_INVOICE_DUE_DAYS', '7'));

      // Trigger webhook for invoice creation
      await this.webhookService.triggerWebhook(
        'invoice.created',
        {
          invoiceId: invoice.id,
          customerId,
          customerType,
          amount: invoice.amountDue,
          currency: invoice.currency,
          billingPeriod: {
            start: invoice.billingPeriodStart,
            end: invoice.billingPeriodEnd
          },
          dueDate: new Date(invoice.billingPeriodEnd.getTime() + invoiceDueDays * 24 * 60 * 60 * 1000) // Configurable days after period end
        },
        customerId);

      this.logger.log(
        `Invoice generated successfully: ${invoice.id} for ${customerType} ${customerId}`);
    } catch (error) {
      this.logger.error(
        `Failed to generate invoice for ${customerType} ${customerId}`,
        error.stack);
      throw error;
    }
  }

  private async handlePaymentProcessing(job: Job): Promise<void> {
    const { invoiceId, gateway, retryCount = 0 } = job.data;

    try {
      this.logger.log(
        `Processing payment for invoice ${invoiceId} using ${gateway} (attempt ${retryCount + 1})`);

      const result = await this.billingService.processPayment(invoiceId, gateway);

      this.logger.log(
        `Payment initiated for invoice ${invoiceId}: ${result.reference}`);
    } catch (error) {
      this.logger.error(
        `Failed to process payment for invoice ${invoiceId}`,
        error.stack);

      // Schedule retry if configured
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 60 * 60 * 1000; // Exponential backoff: 1h, 2h, 4h
        await job.queue.add(
          'process-payment',
          {
            invoiceId,
            gateway,
            retryCount: retryCount + 1
          },
          {
            delay,
            attempts: 1
          });
      }

      throw error;
    }
  }

  private async handleFailedPaymentsRetry(job: Job): Promise<void> {
    try {
      // Get all failed invoices that are eligible for retry
      const failedInvoices = await this.prisma.apiInvoice.findMany({
        where: {
          status: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        include: {
          // We don't have direct relations, so we'll need to fetch separately if needed
        }
      });

      let retriedCount = 0;

      for (const invoice of failedInvoices) {
        try {
          // Check if we haven't retried recently
          const lastRetry = invoice.metadata?.lastRetryAt;
          if (lastRetry) {
            const timeSinceLastRetry = Date.now() - new Date(lastRetry).getTime();
            if (timeSinceLastRetry < 24 * 60 * 60 * 1000) { // 24 hours
              continue; // Skip, retried recently
            }
          }

          await this.billingService.retryFailedPayment(invoice.id);

          // Update retry timestamp
          await this.prisma.apiInvoice.update({
            where: { id: invoice.id },
            data: {
              metadata: {
                ...invoice.metadata,
                lastRetryAt: new Date()
              }
            }
          });

          retriedCount++;
        } catch (error) {
          this.logger.warn(
            `Failed to retry payment for invoice ${invoice.id}`,
            error.message);
        }
      }

      this.logger.log(`Retried ${retriedCount} failed payments`);
    } catch (error) {
      this.logger.error(
        'Failed to process failed payments retry job',
        error.stack);
      throw error;
    }
  }

  private async handlePaymentReminders(job: Job): Promise<void> {
    try {
      // Read reminder days from environment or use default
      const reminderDaysStr = this.config.get<string>('API_INVOICE_REMINDER_DAYS', '3,7,14');
      const daysOverdue = reminderDaysStr.split(',').map(d => parseInt(d.trim()));
      const invoiceDueDays = parseInt(this.config.get<string>('API_INVOICE_DUE_DAYS', '7'));

      for (const days of daysOverdue) {
        // Calculate due date cutoff - we want invoices that are overdue by X days
        const dueDateCutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Get all pending invoices and calculate overdue status in application logic
        const pendingInvoices = await this.prisma.apiInvoice.findMany({
          where: {
            status: 'PENDING'
          }
        });

        // Filter invoices that are overdue by X days based on calculated due date
        const overdueInvoices = pendingInvoices.filter(invoice => {
          const calculatedDueDate = new Date(
            invoice.billingPeriodEnd.getTime() + invoiceDueDays * 24 * 60 * 60 * 1000
          );
          return calculatedDueDate < dueDateCutoff;
        });

        for (const invoice of overdueInvoices) {
          try {
            // Get customer details
            const customer = await this.getCustomerDetails(invoice.customerId!, invoice.customerType as 'USER' | 'BROKER');

            // Calculate actual days overdue based on due date
            const calculatedDueDate = new Date(
              invoice.billingPeriodEnd.getTime() + invoiceDueDays * 24 * 60 * 60 * 1000
            );
            const actualDaysOverdue = Math.floor(
              (Date.now() - calculatedDueDate.getTime()) / (24 * 60 * 60 * 1000)
            );

            if (customer?.email) {
              try {
                await this.notificationService.sendEmail({
                  to: customer.email,
                  subject: `Payment Reminder: Invoice ${invoice.id} (${actualDaysOverdue} days overdue)`,
                  template: 'payment-reminder',
                  data: {
                    customerName: customer.firstName || customer.companyName || 'Valued Customer',
                    invoiceId: invoice.id,
                    amount: invoice.amountDue,
                    currency: invoice.currency,
                    daysOverdue: actualDaysOverdue,
                    dueDate: new Date(invoice.billingPeriodEnd.getTime() + invoiceDueDays * 24 * 60 * 60 * 1000).toLocaleDateString(),
                    pdfUrl: invoice.invoicePdfUrl,
                    paymentUrl: this.buildPaymentUrl(invoice.id)
                  }
                });
                this.logger.log(`Payment reminder sent for invoice ${invoice.id} (${actualDaysOverdue} days overdue)`);
              } catch (error) {
                this.logger.warn(`Failed to send payment reminder for invoice ${invoice.id}`, error.message);
              }
            }

            // Trigger webhook for payment reminder
            await this.webhookService.triggerWebhook(
              'invoice.reminder',
              {
                invoiceId: invoice.id,
                customerId: invoice.customerId,
                customerType: invoice.customerType,
                amount: invoice.amountDue,
                currency: invoice.currency,
                daysOverdue: actualDaysOverdue,
                dueDate: new Date(
                  invoice.billingPeriodEnd.getTime() + invoiceDueDays * 24 * 60 * 60 * 1000)
              },
              invoice.customerId || undefined);

            this.logger.log(
              `Sent payment reminder for invoice ${invoice.id} (${actualDaysOverdue} days overdue)`);
          } catch (error) {
            this.logger.warn(
              `Failed to send reminder for invoice ${invoice.id}`,
              error.message);
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to process payment reminders',
        error.stack);
      throw error;
    }
  }

  private async handleMonthlyBillingCycle(job: Job): Promise<void> {
    const { targetMonth } = job.data;
    const targetDate = targetMonth ? new Date(targetMonth) : new Date();

    try {
      // Calculate billing period
      const periodStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const periodEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      periodEnd.setHours(23, 59, 59, 999);

      this.logger.log(
        `Starting monthly billing cycle: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

      // Get all users with API keys
      const usersWithKeys = await this.prisma.apiKey.findMany({
        where: {
          userId: { not: null },
          revoked: false,
          createdAt: {
            lt: periodEnd
          }
        },
        select: {
          userId: true
        },
        distinct: ['userId']
      });

      // Get all brokers with API keys
      const brokersWithKeys = await this.prisma.apiKey.findMany({
        where: {
          brokerId: { not: null },
          revoked: false,
          createdAt: {
            lt: periodEnd
          }
        },
        select: {
          brokerId: true
        },
        distinct: ['brokerId']
      });

      // Queue invoice generation for all customers
      const queue = job.queue;

      for (const { userId } of usersWithKeys) {
        await queue.add(
          'generate-invoice',
          {
            customerId: userId,
            customerType: 'USER',
            period: {
              start: periodStart,
              end: periodEnd
            }
          },
          {
            delay: Math.random() * 60000, // Random delay to avoid overwhelming
            attempts: 3,
            backoff: 'exponential'
          });
      }

      for (const { brokerId } of brokersWithKeys) {
        await queue.add(
          'generate-invoice',
          {
            customerId: brokerId,
            customerType: 'BROKER',
            period: {
              start: periodStart,
              end: periodEnd
            }
          },
          {
            delay: Math.random() * 60000, // Random delay to avoid overwhelming
            attempts: 3,
            backoff: 'exponential'
          });
      }

      // Reset monthly quotas for all API keys
      await this.resetMonthlyQuotas();

      this.logger.log(
        `Monthly billing cycle initiated for ${usersWithKeys.length} users and ${brokersWithKeys.length} brokers`);
    } catch (error) {
      this.logger.error(
        'Failed to process monthly billing cycle',
        error.stack);
      throw error;
    }
  }

  /**
   * Get customer details helper method
   */
  private async getCustomerDetails(
    customerId: string,
    customerType: 'USER' | 'BROKER'): Promise<{ id: string; email: string; firstName?: string; lastName?: string; companyName?: string } | null> {
    if (customerType === 'USER') {
      const user = await this.prisma.user.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      });
      return user;
    } else {
      const broker = await this.prisma.broker.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          contactEmail: true,
          companyName: true
        }
      });
      if (broker) {
        return {
          id: broker.id,
          email: broker.contactEmail,
          companyName: broker.companyName
        };
      }
    }
    return null;
  }

  private async resetMonthlyQuotas(): Promise<void> {
    try {
      // Reset quota for all API keys
      const result = await this.prisma.apiKey.updateMany({
        where: {
          quotaResetAt: {
            lt: new Date()
          }
        },
        data: {
          usageCount: 0,
          quotaResetAt: new Date()
        }
      });

      this.logger.log(`Reset quotas for ${result.count} API keys`);

      // Trigger webhook for quota reset
      await this.webhookService.triggerWebhook(
        'quota.reset',
        {
          resetCount: result.count,
          resetDate: new Date()
        });
    } catch (error) {
      this.logger.error('Failed to reset monthly quotas', error.stack);
    }
  }

  /**
   * Build payment URL for invoice with frontend URL validation
   */
  private buildPaymentUrl(invoiceId: string): string {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');

    if (!frontendUrl) {
      this.logger.warn('FRONTEND_URL not configured, payment URL will be omitted');
      return '';
    }

    // Remove trailing slash and construct payment URL
    const baseUrl = frontendUrl.replace(/\/$/, '');
    const paymentUrl = `${baseUrl}/billing/invoices/${invoiceId}`;

    this.logger.log(`Constructed payment URL for invoice ${invoiceId}: ${paymentUrl}`);
    return paymentUrl;
  }
}
