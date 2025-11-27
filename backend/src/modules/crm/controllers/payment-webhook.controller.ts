import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentWebhookService } from '../services/payment-webhook.service';
import { PaystackProvider } from '../providers/paystack.provider';
import { PayFastProvider } from '../providers/payfast.provider';
import { EFTProvider } from '../providers/eft.provider';
import { OzowProvider } from '../providers/ozow.provider';

@Controller('api/v1/crm/payments/webhook')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly webhookService: PaymentWebhookService,
    private readonly paystackProvider: PaystackProvider,
    private readonly payfastProvider: PayFastProvider,
    private readonly eftProvider: EFTProvider,
    private readonly ozowProvider: OzowProvider,
    private readonly configService: ConfigService,
  ) {}

  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  async handlePaystackWebhook(
    @Body() body: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    try {
      this.logger.log(`Paystack webhook received: ${JSON.stringify({ event: body.event, reference: body.data?.reference })}`);

      // Check for idempotency to prevent duplicate processing
      const webhookId = `paystack_${body.event}_${body.data?.reference}_${new Date(body.created_at).getTime()}`;
      if (await this.webhookService.isProcessed(webhookId)) {
        this.logger.log(`Webhook already processed: ${webhookId}`);
        return { status: 'ok', message: 'Webhook already processed' };
      }

      // Verify and process webhook
      const event = await this.paystackProvider.processWebhook(
        JSON.stringify(body),
        signature,
      );

      await this.webhookService.processPaymentWebhook(event);

      // Mark as processed
      await this.webhookService.markAsProcessed(webhookId);

      this.logger.log(`Paystack webhook processed successfully: ${webhookId}`);
      return { status: 'ok', message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`Error processing Paystack webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('payfast')
  @HttpCode(HttpStatus.OK)
  async handlePayFastWebhook(
    @Body() body: any,
    @Headers('x-payfast-signature') signature: string,
  ) {
    try {
      this.logger.log(`PayFast webhook received: ${JSON.stringify({ payment_status: body.payment_status, m_payment_id: body.m_payment_id })}`);

      // Check for idempotency
      const webhookId = `payfast_${body.payment_status}_${body.m_payment_id}_${body.pf_payment_id}`;
      if (await this.webhookService.isProcessed(webhookId)) {
        this.logger.log(`Webhook already processed: ${webhookId}`);
        return { status: 'ok', message: 'Webhook already processed' };
      }

      // Process PayFast form data (URL encoded)
      const rawBody = new URLSearchParams(body).toString();
      const event = await this.payfastProvider.processWebhook(rawBody, signature);

      await this.webhookService.processPaymentWebhook(event);

      // Mark as processed
      await this.webhookService.markAsProcessed(webhookId);

      this.logger.log(`PayFast webhook processed successfully: ${webhookId}`);
      return { status: 'ok', message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`Error processing PayFast webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('eft')
  @HttpCode(HttpStatus.OK)
  async handleEFTWebhook(
    @Body() body: any,
    @Headers('x-eft-signature') signature: string,
  ) {
    try {
      this.logger.log(`EFT webhook received: ${JSON.stringify({ transaction_status: body.transaction_status, m_payment_id: body.m_payment_id })}`);

      // Check for idempotency
      const webhookId = `eft_${body.transaction_status}_${body.m_payment_id}_${body.transaction_id}`;
      if (await this.webhookService.isProcessed(webhookId)) {
        this.logger.log(`Webhook already processed: ${webhookId}`);
        return { status: 'ok', message: 'Webhook already processed' };
      }

      const event = await this.eftProvider.processWebhook(
        JSON.stringify(body),
        signature,
      );

      await this.webhookService.processPaymentWebhook(event);

      // Mark as processed
      await this.webhookService.markAsProcessed(webhookId);

      this.logger.log(`EFT webhook processed successfully: ${webhookId}`);
      return { status: 'ok', message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`Error processing EFT webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('ozow')
  @HttpCode(HttpStatus.OK)
  async handleOzowWebhook(
    @Body() body: any,
    @Headers('x-ozow-signature') signature: string,
  ) {
    try {
      this.logger.log(`Ozow webhook received: ${JSON.stringify({ Status: body.Status, TransactionReference: body.TransactionReference })}`);

      // Check for idempotency
      const webhookId = `ozow_${body.Status}_${body.TransactionReference}_${body.TransactionId}`;
      if (await this.webhookService.isProcessed(webhookId)) {
        this.logger.log(`Webhook already processed: ${webhookId}`);
        return { status: 'ok', message: 'Webhook already processed' };
      }

      // Process Ozow form data (URL encoded)
      const rawBody = new URLSearchParams(body).toString();
      const event = await this.ozowProvider.processWebhook(rawBody, signature);

      await this.webhookService.processPaymentWebhook(event);

      // Mark as processed
      await this.webhookService.markAsProcessed(webhookId);

      this.logger.log(`Ozow webhook processed successfully: ${webhookId}`);
      return { status: 'ok', message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`Error processing Ozow webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('generic')
  @HttpCode(HttpStatus.OK)
  async handleGenericWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    try {
      const provider = headers['x-payment-provider'] || body.provider;

      if (!provider) {
        throw new Error('Payment provider not specified');
      }

      this.logger.log(`Generic webhook received for provider: ${provider}`);

      // Route to appropriate provider based on provider name
      let event;
      switch (provider.toLowerCase()) {
        case 'paystack':
          event = await this.paystackProvider.processWebhook(
            JSON.stringify(body),
            headers['x-paystack-signature'],
          );
          break;
        case 'payfast':
          const rawBody = new URLSearchParams(body).toString();
          event = await this.payfastProvider.processWebhook(
            rawBody,
            headers['x-payfast-signature'],
          );
          break;
        case 'eft':
          event = await this.eftProvider.processWebhook(
            JSON.stringify(body),
            headers['x-eft-signature'],
          );
          break;
        case 'ozow':
          const ozowRawBody = new URLSearchParams(body).toString();
          event = await this.ozowProvider.processWebhook(
            ozowRawBody,
            headers['x-ozow-signature'],
          );
          break;
        default:
          throw new Error(`Unsupported payment provider: ${provider}`);
      }

      // Check for idempotency
      const webhookId = `${provider}_${event.eventType}_${event.reference}`;
      if (await this.webhookService.isProcessed(webhookId)) {
        this.logger.log(`Webhook already processed: ${webhookId}`);
        return { status: 'ok', message: 'Webhook already processed' };
      }

      await this.webhookService.processPaymentWebhook(event);
      await this.webhookService.markAsProcessed(webhookId);

      this.logger.log(`Generic webhook processed successfully for provider: ${provider}`);
      return { status: 'ok', message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`Error processing generic webhook: ${error.message}`, error.stack);
      throw error;
    }
  }
}