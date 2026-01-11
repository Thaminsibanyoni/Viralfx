import { Injectable, Logger } from '@nestjs/common';
import { WebhookEvent } from '../interfaces/payment-provider.interface';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerInvoice } from '../entities/broker-invoice.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerPayment } from '../entities/broker-payment.entity';
import { WalletService } from "../../wallet/services/index";
import { RedisService } from "../../redis/redis.service";

// Entity for idempotency tracking
interface ProcessedWebhook {
  id: string;
  processedAt: Date;
  provider: string;
  eventType: string;
  reference: string;
}

@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);
  private readonly processedWebhooks = new Map<string, ProcessedWebhook>();
  private readonly idempotencyExpiry = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
        private walletService: WalletService,
    private redisService: RedisService) {}

  async isProcessed(webhookId: string): Promise<boolean> {
    // Check memory cache first
    if (this.processedWebhooks.has(webhookId)) {
      return true;
    }

    // Check Redis cache
    try {
      const cached = await this.redisService.get(`webhook:${webhookId}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Cache in memory for faster access
        this.processedWebhooks.set(webhookId, data);
        return true;
      }
    } catch (error) {
      this.logger.warn(`Redis check failed for webhook ${webhookId}: ${error.message}`);
    }

    return false;
  }

  async markAsProcessed(webhookId: string): Promise<void> {
    const webhook: ProcessedWebhook = {
      id: webhookId,
      processedAt: new Date(),
      provider: webhookId.split('_')[0],
      eventType: webhookId.split('_')[1],
      reference: webhookId.split('_')[2]
    };

    // Store in memory
    this.processedWebhooks.set(webhookId, webhook);

    // Store in Redis with expiry
    try {
      await this.redisService.setex(
        `webhook:${webhookId}`,
        24 * 60 * 60, // 24 hours
        JSON.stringify(webhook));
    } catch (error) {
      this.logger.warn(`Failed to cache webhook ${webhookId} in Redis: ${error.message}`);
    }

    // Clean up old entries from memory
    this.cleanupOldEntries();
  }

  async processPaymentWebhook(event: WebhookEvent): Promise<void> {
    this.logger.log(`Processing payment webhook: ${event.provider} - ${event.eventType} - ${event.reference}`);

    try {
      // Find the related invoice
      const invoice = await this.prisma.brokerInvoice.findFirst({
        where: { invoiceNumber: event.reference },
        relations: ['brokerAccount', 'brokerAccount.broker']
      });

      if (!invoice) {
        this.logger.warn(`Invoice not found for reference: ${event.reference}`);
        return;
      }

      // Find or create payment record
      let payment = await this.prisma.brokerPayment.findFirst({
        where: {
          invoiceId: invoice.id,
          transactionId: event.transactionId || event.reference
        }
      });

      if (!payment) {
        payment = this.prisma.brokerPayment.create({
          brokerId: invoice.brokerId,
          invoiceId: invoice.id,
          transactionId: event.transactionId || event.reference,
          provider: event.provider,
          amount: event.amount,
          currency: event.currency,
          status: 'pending'
        });
      }

      // Update payment based on webhook event
      switch (event.status) {
        case 'completed':
        case 'success':
        case 'successful':
          await this.handleSuccessfulPayment(payment, event, invoice);
          break;
        case 'failed':
        case 'cancelled':
        case 'error':
          await this.handleFailedPayment(payment, event);
          break;
        case 'pending':
          await this.handlePendingPayment(payment, event);
          break;
        default:
          this.logger.warn(`Unknown payment status: ${event.status}`);
          await this.handleUnknownStatus(payment, event);
      }

      // Save payment record
      await this.prisma.brokerPayment.upsert(payment);

      this.logger.log(`Payment webhook processed successfully: ${event.provider} - ${event.reference}`);
    } catch (error) {
      this.logger.error(`Error processing payment webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleSuccessfulPayment(
    payment: BrokerPayment,
    event: WebhookEvent,
    invoice: BrokerInvoice): Promise<void> {
    this.logger.log(`Processing successful payment: ${payment.transactionId}`);

    payment.status = 'COMPLETED';
    payment.completedAt = event.paidAt || new Date();
    payment.providerReference = event.transactionId;
    payment.metadata = {
      ...payment.metadata,
      webhookEvent: event
    };

    // Update invoice status
    const totalPaid = await this.getTotalPaidForInvoice(invoice.id);
    const newTotalPaid = totalPaid + payment.amount;

    if (newTotalPaid >= invoice.totalAmount) {
      invoice.status = 'PAID';
      invoice.paidAt = new Date();
      invoice.amountPaid = newTotalPaid;
    } else {
      invoice.status = 'PARTIALLY_PAID';
      invoice.amountPaid = newTotalPaid;
    }

    await this.prisma.brokerInvoice.upsert(invoice);

    // Credit broker wallet
    try {
      await this.walletService.creditBroker(invoice.brokerId, payment.amount, {
        source: 'invoice_payment',
        invoiceId: invoice.id,
        paymentId: payment.id,
        provider: event.provider,
        reference: event.reference
      });

      this.logger.log(`Broker wallet credited: ${invoice.brokerId} - ${payment.amount}`);
    } catch (walletError) {
      this.logger.error(`Failed to credit broker wallet: ${walletError.message}`);
      // Don't throw here as the payment is still valid
    }

    // Send notification (implement notification service)
    await this.sendPaymentNotification(invoice, payment, 'success');
  }

  private async handleFailedPayment(
    payment: BrokerPayment,
    event: WebhookEvent): Promise<void> {
    this.logger.log(`Processing failed payment: ${payment.transactionId}`);

    payment.status = 'FAILED';
    payment.failedAt = new Date();
    payment.failureReason = event.metadata?.gateway_response || 'Payment failed';
    payment.metadata = {
      ...payment.metadata,
      webhookEvent: event,
      failureReason: payment.failureReason
    };

    // Send notification
    await this.sendPaymentNotification(null, payment, 'failed');
  }

  private async handlePendingPayment(
    payment: BrokerPayment,
    event: WebhookEvent): Promise<void> {
    this.logger.log(`Processing pending payment: ${payment.transactionId}`);

    payment.status = 'PENDING';
    payment.metadata = {
      ...payment.metadata,
      webhookEvent: event
    };
  }

  private async handleUnknownStatus(
    payment: BrokerPayment,
    event: WebhookEvent): Promise<void> {
    this.logger.log(`Processing payment with unknown status: ${payment.transactionId} - ${event.status}`);

    payment.status = 'UNKNOWN';
    payment.metadata = {
      ...payment.metadata,
      webhookEvent: event
    };
  }

  private async getTotalPaidForInvoice(invoiceId: string): Promise<number> {
    const result = await this.brokerPaymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.invoiceId = :invoiceId', { invoiceId })
      .andWhere('payment.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    return result?.total ? parseFloat(result.total) : 0;
  }

  private async sendPaymentNotification(
    invoice: BrokerInvoice | null,
    payment: BrokerPayment,
    status: 'success' | 'failed'): Promise<void> {
    // Implement notification service integration
    // This would send emails, SMS, push notifications etc.

    this.logger.log(`Payment notification sent: ${payment.transactionId} - ${status}`);

    // Example notification logic:
    const notificationData = {
      type: 'payment_update',
      status,
      paymentId: payment.id,
      transactionId: payment.transactionId,
      amount: payment.amount,
      provider: payment.provider,
      invoiceId: invoice?.id,
      brokerId: invoice?.brokerId || payment.brokerId
    };

    // Integrate with your notification service here
    // await this.notificationService.sendNotification(notificationData);
  }

  private cleanupOldEntries(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [id, webhook] of this.processedWebhooks.entries()) {
      if (now - webhook.processedAt.getTime() > this.idempotencyExpiry) {
        entriesToDelete.push(id);
      }
    }

    for (const id of entriesToDelete) {
      this.processedWebhooks.delete(id);
    }

    if (entriesToDelete.length > 0) {
      this.logger.debug(`Cleaned up ${entriesToDelete.length} old webhook entries from memory`);
    }
  }

  async getWebhookStatus(webhookId: string): Promise<ProcessedWebhook | null> {
    // Check memory first
    if (this.processedWebhooks.has(webhookId)) {
      return this.processedWebhooks.get(webhookId);
    }

    // Check Redis
    try {
      const cached = await this.redisService.get(`webhook:${webhookId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn(`Redis check failed for webhook ${webhookId}: ${error.message}`);
    }

    return null;
  }
}
