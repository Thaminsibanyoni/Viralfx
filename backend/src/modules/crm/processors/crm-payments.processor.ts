import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { WalletService } from '../../wallet/wallet.service';
import { BrokerPayment } from '../entities/broker-payment.entity';
import { BrokerInvoice } from '../entities/broker-invoice.entity';
import { AuditService } from '../../audit/audit.service';
import { HttpService } from '@nestjs/axios';
import { createHmac } from 'crypto';

@Processor('crm-payments')
export class CrmPaymentsProcessor {
  private readonly logger = new Logger(CrmPaymentsProcessor.name);

  constructor(
    @InjectRepository(BrokerPayment)
    private brokerPaymentRepository: Repository<BrokerPayment>,
    @InjectRepository(BrokerInvoice)
    private brokerInvoiceRepository: Repository<BrokerInvoice>,
    private redisService: RedisService,
    private walletService: WalletService,
    private auditService: AuditService,
    private httpService: HttpService,
    private dataSource: DataSource,
  ) {}

  @Process('process-webhook')
  async handlePaymentWebhook(job: Job<{ payload: any; signature?: string }>) {
    const { payload, signature } = job.data;

    // Implement idempotency with Redis lock using transaction ID
    const txId = payload.transaction_id || payload.id;
    const lockKey = `webhook-lock:${txId}`;
    const lockAcquired = await this.redisService.setnx(lockKey, '1', 3600); // 1 hour lock

    if (!lockAcquired) {
      this.logger.warn(`Webhook for transaction ${txId} already processed`);
      return { status: 'skipped', reason: 'already_processed' };
    }

    try {
      this.logger.log(`Processing payment webhook for transaction ${txId}`);

      // Validate webhook signature if provided (Paystack, PayFast, etc.)
      if (signature && payload.event) {
        const isValid = await this.validateWebhookSignature(payload, signature);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Find existing payment record
      let payment = await this.brokerPaymentRepository.findOne({
        where: { transactionId: txId },
        relations: ['invoice'],
      });

      if (!payment) {
        // Create new payment record
        payment = await this.createPaymentFromWebhook(payload);
      } else {
        // Update existing payment
        payment = await this.updatePaymentFromWebhook(payment, payload);
      }

      // Process payment status changes
      await this.processPaymentStatusChange(payment, payload);

      // Log audit trail
      await this.auditService.logEvent({
        adminId: 'system',
        entity: 'BrokerPayment',
        action: 'WEBHOOK_PROCESSED',
        entityId: payment.id,
        changeDiff: JSON.stringify(payload),
        timestamp: new Date(),
        hmac: this.generateAuditHmac(payload),
      });

      this.logger.log(`Payment webhook processed successfully for transaction ${txId}`);
      return { status: 'processed', paymentId: payment.id };

    } catch (error) {
      this.logger.error(`Failed to process webhook for transaction ${txId}:`, error);

      // Log audit failure
      await this.auditService.logEvent({
        adminId: 'system',
        entity: 'BrokerPayment',
        action: 'WEBHOOK_FAILED',
        entityId: txId,
        changeDiff: JSON.stringify({ error: error.message, payload }),
        timestamp: new Date(),
        hmac: this.generateAuditHmac({ error: error.message }),
      });

      throw error;
    }
  }

  @Process('reconcile-payments')
  async handlePaymentReconciliation(job: Job<{ date?: string }>) {
    const reconciliationDate = job.data.date ? new Date(job.data.date) : new Date();

    this.logger.log(`Starting payment reconciliation for ${reconciliationDate.toISOString()}`);

    // Find payments that need reconciliation
    const pendingPayments = await this.brokerPaymentRepository.find({
      where: {
        status: 'PENDING',
        createdAt: reconciliationDate,
      },
      relations: ['invoice'],
    });

    let reconciled = 0;
    let failed = 0;

    for (const payment of pendingPayments) {
      try {
        // Query payment gateway for status
        const gatewayStatus = await this.queryPaymentGateway(payment);

        if (gatewayStatus !== payment.status) {
          // Update payment status
          payment.status = gatewayStatus;
          payment.gatewayResponse = JSON.stringify(gatewayStatus);
          await this.brokerPaymentRepository.save(payment);

          // Process status change
          await this.processPaymentStatusChange(payment, { status: gatewayStatus });
        }

        reconciled++;
      } catch (error) {
        this.logger.error(`Failed to reconcile payment ${payment.id}:`, error);
        failed++;
      }
    }

    this.logger.log(`Payment reconciliation completed. Reconciled: ${reconciled}, Failed: ${failed}`);
    return { reconciled, failed, total: pendingPayments.length };
  }

  private async createPaymentFromWebhook(payload: any): Promise<BrokerPayment> {
    const payment = this.brokerPaymentRepository.create({
      transactionId: payload.transaction_id || payload.id,
      invoiceId: payload.metadata?.invoice_id,
      amount: payload.amount / 100, // Convert from cents if applicable
      currency: payload.currency || 'ZAR',
      paymentMethod: this.mapPaymentMethod(payload.channel || payload.payment_type),
      status: this.mapPaymentStatus(payload.event || payload.status),
      gatewayResponse: JSON.stringify(payload),
      paidAt: payload.paid_at ? new Date(payload.paid_at * 1000) : null,
      metadata: {
        webhook_source: payload.event?.split('.')[0] || 'unknown',
        gateway_reference: payload.reference,
      },
    });

    return await this.brokerPaymentRepository.save(payment);
  }

  private async updatePaymentFromWebhook(payment: BrokerPayment, payload: any): Promise<BrokerPayment> {
    payment.status = this.mapPaymentStatus(payload.event || payload.status);
    payment.gatewayResponse = JSON.stringify(payload);

    if (payload.paid_at) {
      payment.paidAt = new Date(payload.paid_at * 1000);
    }

    return await this.brokerPaymentRepository.save(payment);
  }

  private async processPaymentStatusChange(payment: BrokerPayment, payload: any): Promise<void> {
    if (payment.status === 'SUCCESSFUL' && payment.invoice) {
      // Update invoice status
      payment.invoice.status = 'PAID';
      payment.invoice.paidAt = new Date();
      await this.brokerInvoiceRepository.save(payment.invoice);

      // Credit broker wallet
      if (payment.invoice.brokerId) {
        await this.walletService.ledgerEntry(
          payment.invoice.brokerId,
          payment.amount,
          'PAYMENT_RECEIVED',
          `Payment for invoice ${payment.invoice.invoiceNumber}`,
          {
            paymentId: payment.id,
            invoiceId: payment.invoice.id,
          }
        );
      }

      // Trigger post-payment processes
      await this.triggerPostPaymentProcesses(payment.invoice);
    }
  }

  private async triggerPostPaymentProcesses(invoice: BrokerInvoice): Promise<void> {
    // Generate commission payments if applicable
    if (invoice.commissionAmount > 0) {
      // This would integrate with commission tracking system
      this.logger.log(`Commission payment triggered for invoice ${invoice.id}: ${invoice.commissionAmount}`);
    }

    // Update broker subscription status if this is a subscription payment
    if (invoice.type === 'SUBSCRIPTION') {
      // This would extend subscription period
      this.logger.log(`Subscription extension triggered for invoice ${invoice.id}`);
    }
  }

  private async validateWebhookSignature(payload: any, signature: string): Promise<boolean> {
    try {
      // This would implement signature validation based on payment provider
      // Example for Paystack:
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
      if (!secret) return true; // Skip validation if no secret configured

      const expectedSignature = createHmac('sha512', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      this.logger.error('Webhook signature validation failed:', error);
      return false;
    }
  }

  private async queryPaymentGateway(payment: BrokerPayment): Promise<string> {
    try {
      // This would implement actual gateway status queries
      // For now, return mock status
      return 'SUCCESSFUL';
    } catch (error) {
      this.logger.error(`Failed to query gateway for payment ${payment.id}:`, error);
      return 'FAILED';
    }
  }

  private mapPaymentMethod(method: string): string {
    const methodMap = {
      'card': 'CREDIT_CARD',
      'bank_transfer': 'BANK_TRANSFER',
      'eft': 'EFT',
      'ozow': 'OZOW',
      'payfast': 'PAYFAST',
      'paystack': 'PAYSTACK',
    };

    return methodMap[method] || 'OTHER';
  }

  private mapPaymentStatus(event: string): string {
    if (event === 'charge.success' || event === 'payment.successful') {
      return 'SUCCESSFUL';
    } else if (event === 'charge.failed' || event === 'payment.failed') {
      return 'FAILED';
    } else if (event === 'charge.pending' || event === 'payment.pending') {
      return 'PENDING';
    }

    return 'PENDING';
  }

  private generateAuditHmac(data: any): string {
    const secret = process.env.AUDIT_SECRET || 'default-secret';
    return createHmac('sha256', secret)
      .update(JSON.stringify(data))
      .digest('hex');
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing payment job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed payment job ${job.id} of type ${job.name}. Result:`, result);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed payment job ${job.id} of type ${job.name}:`, error);
  }
}