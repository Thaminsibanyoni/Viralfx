import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { createHash, createHmac } from 'crypto';
import { PaymentProvider, PaymentRequest, PaymentResponse, WebhookEvent } from '../interfaces/payment-provider.interface';

@Injectable()
export class PaystackProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get('PAYSTACK_BASE_URL', 'https://api.paystack.co');
    this.secretKey = this.configService.get('PAYSTACK_SECRET_KEY');

    if (!this.secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is required');
    }
  }

  async createPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      const response: AxiosResponse = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email: paymentRequest.customerEmail,
          amount: paymentRequest.amount * 100, // Paystack uses kobo/cents
          currency: paymentRequest.currency || 'ZAR',
          reference: paymentRequest.reference,
          callback_url: paymentRequest.callbackUrl,
          metadata: {
            custom_fields: [
              {
                display_name: 'Invoice ID',
                variable_name: 'invoice_id',
                value: paymentRequest.invoiceId,
              },
              {
                display_name: 'Broker ID',
                variable_name: 'broker_id',
                value: paymentRequest.brokerId,
              },
            ],
            ...paymentRequest.metadata,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { data } = response.data;

      return {
        success: true,
        reference: data.reference,
        authorizationUrl: data.authorization_url,
        accessCode: data.access_code,
        provider: 'paystack',
        metadata: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'paystack',
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentResponse> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { data } = response.data;

      if (data.status === 'success') {
        return {
          success: true,
          reference: data.reference,
          amount: data.amount / 100, // Convert back from kobo/cents
          currency: data.currency,
          status: data.status,
          paidAt: data.paid_at,
          provider: 'paystack',
          metadata: response.data,
        };
      } else {
        return {
          success: false,
          reference: data.reference,
          status: data.status,
          message: data.gateway_response,
          provider: 'paystack',
          metadata: response.data,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'paystack',
      };
    }
  }

  async processWebhook(rawBody: string, signature: string): Promise<WebhookEvent> {
    // Verify webhook signature
    const expectedSignature = createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid webhook signature');
    }

    try {
      const event = JSON.parse(rawBody);

      return {
        provider: 'paystack',
        eventType: event.event,
        reference: event.data.reference,
        amount: event.data.amount / 100,
        currency: event.data.currency,
        status: event.data.status,
        paidAt: event.data.paid_at ? new Date(event.data.paid_at) : null,
        customerEmail: event.data.customer?.email,
        metadata: event,
      };
    } catch (error) {
      throw new Error('Invalid webhook payload');
    }
  }

  async refundPayment(reference: string, amount?: number): Promise<PaymentResponse> {
    try {
      const payload: any = { transaction: reference };
      if (amount) {
        payload.amount = amount * 100; // Paystack uses kobo/cents
      }

      const response: AxiosResponse = await axios.post(
        `${this.baseUrl}/refund`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { data } = response.data;

      return {
        success: true,
        reference: data.transaction,
        refundId: data.id,
        amount: data.amount / 100,
        status: data.status,
        provider: 'paystack',
        metadata: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'paystack',
      };
    }
  }

  getProviderName(): string {
    return 'paystack';
  }

  getSupportedCurrencies(): string[] {
    return ['ZAR', 'NGN', 'USD', 'GHS', 'KES'];
  }
}