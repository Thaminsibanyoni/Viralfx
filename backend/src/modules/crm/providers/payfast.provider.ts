import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { createHash, createHmac } from 'crypto';
import { PaymentProvider, PaymentRequest, PaymentResponse, WebhookEvent } from '../interfaces/payment-provider.interface';
import { WalletService } from '../../wallet/wallet.service';

@Injectable()
export class PayFastProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly merchantId: string;
  private readonly merchantKey: string;
  private readonly passphrase: string;
  private readonly isTestMode: boolean;

  constructor(
    private configService: ConfigService,
    private walletService: WalletService,
  ) {
    this.merchantId = this.configService.get('PAYFAST_MERCHANT_ID');
    this.merchantKey = this.configService.get('PAYFAST_MERCHANT_KEY');
    this.passphrase = this.configService.get('PAYFAST_PASSPHRASE');
    this.isTestMode = this.configService.get('PAYFAST_TEST_MODE', 'true') === 'true';

    if (!this.merchantId || !this.merchantKey) {
      throw new Error('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY environment variables are required');
    }

    this.baseUrl = this.isTestMode
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';
  }

  async createPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Generate payment signature
      const signatureData = {
        merchant_id: this.merchantId,
        merchant_key: this.merchantKey,
        return_url: paymentRequest.callbackUrl,
        cancel_url: paymentRequest.cancelUrl,
        notify_url: paymentRequest.webhookUrl,
        name_first: paymentRequest.customerName?.split(' ')[0] || 'Customer',
        name_last: paymentRequest.customerName?.split(' ')[1] || 'Name',
        email_address: paymentRequest.customerEmail,
        m_payment_id: paymentRequest.reference,
        amount: paymentRequest.amount.toFixed(2),
        item_name: `Invoice ${paymentRequest.invoiceId}`,
        item_description: `Payment for invoice ${paymentRequest.invoiceId}`,
        custom_int1: paymentRequest.invoiceId,
        custom_int2: paymentRequest.brokerId,
        custom_str1: 'VIRALFX_CRM',
      };

      if (this.passphrase) {
        signatureData['passphrase'] = this.passphrase;
      }

      const signature = this.generateSignature(signatureData);

      const paymentUrl = `${this.baseUrl}?${new URLSearchParams({
        ...signatureData,
        signature,
      }).toString()}`;

      return {
        success: true,
        reference: paymentRequest.reference,
        authorizationUrl: paymentUrl,
        provider: 'payfast',
        metadata: { signature, paymentUrl },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: 'payfast',
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentResponse> {
    try {
      // PayFast verification requires a server-to-server call
      const verificationData = {
        m_payment_id: reference,
        merchant_id: this.merchantId,
        merchant_key: this.merchantKey,
      };

      if (this.passphrase) {
        verificationData['passphrase'] = this.passphrase;
      }

      const signature = this.generateSignature(verificationData);
      verificationData['signature'] = signature;

      const response: AxiosResponse = await axios.post(
        `${this.isTestMode ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za'}/eng/query/verify`,
        new URLSearchParams(verificationData).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // PayFast returns "VALID" or "INVALID"
      if (response.data === 'VALID') {
        return {
          success: true,
          reference,
          status: 'completed',
          provider: 'payfast',
          metadata: { verification: 'valid' },
        };
      } else {
        return {
          success: false,
          reference,
          status: 'invalid',
          provider: 'payfast',
          metadata: { verification: 'invalid', response: response.data },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'payfast',
      };
    }
  }

  async processWebhook(rawBody: string, signature: string): Promise<WebhookEvent> {
    try {
      // Parse URL-encoded form data from PayFast
      const parsedData = new URLSearchParams(rawBody);
      const eventData: any = {};

      for (const [key, value] of parsedData.entries()) {
        eventData[key] = value;
      }

      // Verify webhook signature
      const expectedSignature = createHash('md5')
        .update(`${rawBody}${this.passphrase}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }

      // Check if payment status is complete
      if (eventData.payment_status === 'COMPLETE') {
        return {
          provider: 'payfast',
          eventType: 'payment.successful',
          reference: eventData.m_payment_id,
          amount: parseFloat(eventData.amount_gross),
          currency: 'ZAR', // PayFast is primarily ZAR-based
          status: 'completed',
          paidAt: new Date(),
          customerEmail: eventData.email_address,
          metadata: eventData,
        };
      } else if (eventData.payment_status === 'FAILED') {
        return {
          provider: 'payfast',
          eventType: 'payment.failed',
          reference: eventData.m_payment_id,
          amount: parseFloat(eventData.amount_gross),
          currency: 'ZAR',
          status: 'failed',
          paidAt: new Date(),
          customerEmail: eventData.email_address,
          metadata: eventData,
        };
      } else {
        return {
          provider: 'payfast',
          eventType: `payment.${eventData.payment_status?.toLowerCase()}`,
          reference: eventData.m_payment_id,
          amount: parseFloat(eventData.amount_gross),
          currency: 'ZAR',
          status: eventData.payment_status?.toLowerCase(),
          paidAt: new Date(),
          customerEmail: eventData.email_address,
          metadata: eventData,
        };
      }
    } catch (error) {
      throw new Error(`Invalid webhook payload: ${error.message}`);
    }
  }

  async refundPayment(reference: string, amount?: number): Promise<PaymentResponse> {
    // PayFast refunds are typically done through their merchant dashboard
    // For API-based refunds, this would require additional setup
    throw new Error('PayFast refunds must be processed through the merchant dashboard');
  }

  private generateSignature(data: any): string {
    // Create parameter string with escaped values
    const parameterString = Object.keys(data)
      .sort()
      .map(key => `${key}=${encodeURIComponent(data[key].toString()).replace(/%20/g, '+')}`)
      .join('&');

    return createHash('md5').update(parameterString).digest('hex');
  }

  getProviderName(): string {
    return 'payfast';
  }

  getSupportedCurrencies(): string[] {
    return ['ZAR']; // PayFast primarily supports South African Rand
  }

  async creditBrokerWallet(brokerId: string, amount: number, metadata: any): Promise<void> {
    // Credit broker wallet after successful payment
    await this.walletService.creditBroker(brokerId, amount, {
      source: 'payment',
      provider: 'payfast',
      ...metadata,
    });
  }
}