import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { createHash, createHmac } from 'crypto';
import { PaymentProvider, PaymentRequest, PaymentResponse, WebhookEvent } from '../interfaces/payment-provider.interface';

@Injectable()
export class EFTProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly isTestMode: boolean;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get('EFT_API_KEY');
    this.isTestMode = this.configService.get('EFT_TEST_MODE', 'true') === 'true';

    if (!this.apiKey) {
      throw new Error('EFT_API_KEY environment variable is required');
    }

    this.baseUrl = this.isTestMode
      ? 'https://eft-sandbox.api.paygate.co.za'
      : 'https://eft.api.paygate.co.za';
  }

  async createPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      const payload = {
        merchant_id: this.configService.get('PAYGATE_MERCHANT_ID'),
        merchant_key: this.configService.get('PAYGATE_MERCHANT_KEY'),
        return_url: paymentRequest.callbackUrl,
        cancel_url: paymentRequest.cancelUrl,
        notify_url: paymentRequest.webhookUrl,
        m_payment_id: paymentRequest.reference,
        amount: Math.round(paymentRequest.amount * 100), // Convert to cents
        item_name: `Invoice ${paymentRequest.invoiceId}`,
        item_description: `Payment for invoice ${paymentRequest.invoiceId}`,
        email_address: paymentRequest.customerEmail,
        name_first: paymentRequest.customerName?.split(' ')[0] || 'Customer',
        name_last: paymentRequest.customerName?.split(' ')[1] || 'Name',
        custom_int1: paymentRequest.invoiceId,
        custom_int2: paymentRequest.brokerId,
        custom_str1: 'VIRALFX_CRM_EFT',
        payment_method: 'EFT', // Specify EFT payment method
        supported_banks: [
          'ABSA', 'STANDARD_BANK', 'FNB', 'NEDBANK', 'CAPITEC',
          'DISCOVERY_BANK', 'TYMEBANK', 'AFRICAN_BANK', 'INVESTEC',
          'BIDVEST_BANK', 'GRINDROD_BANK', 'SASFIN_BANK', 'UBANK'
        ],
      };

      const signature = this.generateSignature(payload);

      const response: AxiosResponse = await axios.post(
        `${this.baseUrl}/initiate`,
        {
          ...payload,
          signature,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { data } = response.data;

      return {
        success: true,
        reference: paymentRequest.reference,
        authorizationUrl: data.redirect_url,
        transactionId: data.transaction_id,
        provider: 'eft',
        metadata: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'eft',
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentResponse> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseUrl}/status/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { data } = response.data;

      if (data.transaction_status === 'SUCCESSFUL') {
        return {
          success: true,
          reference: data.m_payment_id,
          amount: data.amount / 100,
          currency: data.currency || 'ZAR',
          status: 'completed',
          paidAt: new Date(data.settlement_date),
          bankReference: data.bank_reference,
          provider: 'eft',
          metadata: response.data,
        };
      } else {
        return {
          success: false,
          reference: data.m_payment_id,
          status: data.transaction_status?.toLowerCase(),
          message: data.status_description,
          provider: 'eft',
          metadata: response.data,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'eft',
      };
    }
  }

  async processWebhook(rawBody: string, signature: string): Promise<WebhookEvent> {
    try {
      // Verify webhook signature
      const expectedSignature = createHmac('sha256', this.apiKey)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }

      const event = JSON.parse(rawBody);

      return {
        provider: 'eft',
        eventType: `payment.${event.transaction_status?.toLowerCase()}`,
        reference: event.m_payment_id,
        amount: event.amount / 100,
        currency: event.currency || 'ZAR',
        status: event.transaction_status?.toLowerCase(),
        paidAt: event.settlement_date ? new Date(event.settlement_date) : null,
        customerEmail: event.email_address,
        bankReference: event.bank_reference,
        bankName: event.bank_name,
        metadata: event,
      };
    } catch (error) {
      throw new Error('Invalid webhook payload');
    }
  }

  async refundPayment(reference: string, amount?: number): Promise<PaymentResponse> {
    try {
      const payload: any = {
        m_payment_id: reference,
        refund_reason: 'Customer requested refund',
      };

      if (amount) {
        payload.refund_amount = Math.round(amount * 100);
      }

      const signature = this.generateSignature(payload);

      const response: AxiosResponse = await axios.post(
        `${this.baseUrl}/refund`,
        {
          ...payload,
          signature,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        reference,
        refundId: response.data.refund_id,
        amount: amount || response.data.original_amount / 100,
        status: 'processing',
        provider: 'eft',
        metadata: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'eft',
      };
    }
  }

  private generateSignature(data: any): string {
    const parameterString = Object.keys(data)
      .sort()
      .map(key => `${key}=${encodeURIComponent(data[key]?.toString() || '')}`)
      .join('&');

    return createHash('md5').update(parameterString).digest('hex');
  }

  getProviderName(): string {
    return 'eft';
  }

  getSupportedCurrencies(): string[] {
    return ['ZAR']; // EFT is primarily for South African Rand
  }

  getSupportedBanks(): string[] {
    return [
      'ABSA',
      'STANDARD_BANK',
      'FNB',
      'NEDBANK',
      'CAPITEC',
      'DISCOVERY_BANK',
      'TYMEBANK',
      'AFRICAN_BANK',
      'INVESTEC',
      'BIDVEST_BANK',
      'GRINDROD_BANK',
      'SASFIN_BANK',
      'UBANK'
    ];
  }
}