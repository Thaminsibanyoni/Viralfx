import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { PaymentRequest, PaymentResponse, PaymentMethod, WebhookData } from '../interfaces/payment.interface';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(private config: ConfigService) {}

  /**
   * Process payment through appropriate gateway
   */
  async processPayment(
    gateway: 'paystack' | 'payfast' | 'ozow',
    paymentRequest: PaymentRequest
  ): Promise<PaymentResponse> {
    switch (gateway) {
      case 'paystack':
        return this.processPaystackPayment(paymentRequest);
      case 'payfast':
        return this.processPayFastPayment(paymentRequest);
      case 'ozow':
        return this.processOzowPayment(paymentRequest);
      default:
        throw new BadRequestException('Unsupported payment gateway');
    }
  }

  /**
   * Process Paystack payment
   */
  private async processPaystackPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      const secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY');
      if (!secretKey) {
        throw new InternalServerErrorException('Paystack secret key not configured');
      }

      const payload = {
        email: paymentRequest.customer.email,
        amount: Math.round(paymentRequest.amount * 100), // Paystack expects amount in kobo
        currency: paymentRequest.currency,
        reference: paymentRequest.reference,
        callback_url: paymentRequest.callbackUrl,
        metadata: {
          userId: paymentRequest.userId,
          type: paymentRequest.type,
          custom_data: paymentRequest.customData
        },
        channels: paymentRequest.channels || ['card', 'bank', 'ussd', 'qr']
      };

      const response = await axios.post('https://api.paystack.co/transaction/initialize', payload, {
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status) {
        return {
          gateway: 'paystack',
          status: 'pending',
          reference: response.data.data.reference,
          checkoutUrl: response.data.data.authorization_url,
          paymentId: response.data.data.reference,
          message: 'Payment initiated successfully'
        };
      } else {
        throw new InternalServerErrorException('Failed to initialize Paystack payment');
      }
    } catch (error) {
      this.logger.error('Paystack payment failed:', error);
      throw new InternalServerErrorException('Paystack payment failed');
    }
  }

  /**
   * Process PayFast payment
   */
  private async processPayFastPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      const merchantId = this.config.get<string>('PAYFAST_MERCHANT_ID');
      const merchantKey = this.config.get<string>('PAYFAST_MERCHANT_KEY');
      const passphrase = this.config.get<string>('PAYFAST_PASSPHRASE');

      if (!merchantId || !merchantKey || !passphrase) {
        throw new InternalServerErrorException('PayFast credentials not configured');
      }

      const returnUrl = paymentRequest.callbackUrl;
      const notifyUrl = paymentRequest.webhookUrl;

      // Build payment data
      const paymentData = {
        merchant_id: merchantId,
        merchant_key: merchantKey,
        return_url: returnUrl,
        cancel_url: returnUrl,
        notify_url: notifyUrl,
        name_first: paymentRequest.customer.firstName,
        name_last: paymentRequest.customer.lastName,
        email_address: paymentRequest.customer.email,
        m_payment_id: paymentRequest.reference,
        amount: paymentRequest.amount.toFixed(2),
        item_name: paymentRequest.description || 'ViralFX Payment',
        custom_str1: paymentRequest.userId,
        custom_str2: paymentRequest.type,
        custom_str3: paymentRequest.customData ? JSON.stringify(paymentRequest.customData) : ''
      };

      // Generate signature
      const signature = this.generatePayFastSignature(paymentData, passphrase);

      paymentData['signature'] = signature;

      // Create payment URL
      const paymentUrl = `https://www.payfast.co.za/eng/process?${new URLSearchParams(paymentData).toString()}`;

      return {
        gateway: 'payfast',
        status: 'pending',
        reference: paymentRequest.reference,
        checkoutUrl: paymentUrl,
        paymentId: paymentRequest.reference,
        message: 'Payment initiated successfully'
      };
    } catch (error) {
      this.logger.error('PayFast payment failed:', error);
      throw new InternalServerErrorException('PayFast payment failed');
    }
  }

  /**
   * Process Ozow payment
   */
  private async processOzowPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      const siteCode = this.config.get<string>('OZOW_SITE_CODE');
      const privateKey = this.config.get<string>('OZOW_PRIVATE_KEY');
      const apiKey = this.config.get<string>('OZOW_API_KEY');

      if (!siteCode || !privateKey || !apiKey) {
        throw new InternalServerErrorException('Ozow credentials not configured');
      }

      const transactionReference = `VIRALFX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const payload = {
        SiteCode: siteCode,
        CountryCode: 'ZA',
        CurrencyCode: paymentRequest.currency,
        Amount: paymentRequest.amount.toFixed(2),
        TransactionReference: transactionReference,
        BankId: null, // User will select bank
        CancelUrl: paymentRequest.callbackUrl,
        ReturnUrl: paymentRequest.callbackUrl,
        NotifyUrl: paymentRequest.webhookUrl,
        TransactionDetail: paymentRequest.description || 'ViralFX Payment',
        CustomerEmailAddress: paymentRequest.customer.email,
        CustomerCellNumber: paymentRequest.customer.phoneNumber || '',
        CustomField1: paymentRequest.userId,
        CustomField2: paymentRequest.type,
        CustomField3: paymentRequest.customData ? JSON.stringify(paymentRequest.customData) : '',
        CaptureUserIPAddress: true,
        VerifyUser: true,
        SaveCard: false,
        IsDebit: false
      };

      const response = await axios.post('https://api.ozow.com/postpaymentrequest', payload, {
        headers: {
          'ApiKey': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.Success) {
        return {
          gateway: 'ozow',
          status: 'pending',
          reference: transactionReference,
          checkoutUrl: response.data.Url,
          paymentId: response.data.TransactionId,
          message: 'Payment initiated successfully'
        };
      } else {
        throw new InternalServerErrorException('Failed to initialize Ozow payment');
      }
    } catch (error) {
      this.logger.error('Ozow payment failed:', error);
      throw new InternalServerErrorException('Ozow payment failed');
    }
  }

  /**
   * Verify payment from webhook
   */
  async verifyPayment(gateway: 'paystack' | 'payfast' | 'ozow', webhookData: WebhookData): Promise<any> {
    switch (gateway) {
      case 'paystack':
        return this.verifyPaystackPayment(webhookData);
      case 'payfast':
        return this.verifyPayFastPayment(webhookData);
      case 'ozow':
        return this.verifyOzowPayment(webhookData);
      default:
        throw new BadRequestException('Unsupported payment gateway');
    }
  }

  /**
   * Verify Paystack webhook
   */
  private async verifyPaystackPayment(webhookData: WebhookData): Promise<any> {
    try {
      const secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY');

      // Verify webhook signature
      const hash = require('crypto')
        .createHmac('sha512', secretKey)
        .update(JSON.stringify(webhookData))
        .digest('hex');

      const receivedHash = webhookData.headers['x-paystack-signature'];

      if (hash !== receivedHash) {
        throw new BadRequestException('Invalid webhook signature');
      }

      if (webhookData.event === 'charge.success') {
        return {
          gateway: 'paystack',
          status: 'success',
          reference: webhookData.data.reference,
          amount: webhookData.data.amount / 100, // Convert from kobo
          currency: webhookData.data.currency,
          customerEmail: webhookData.data.customer.email,
          paymentMethod: webhookData.data.authorization.channel,
          paidAt: webhookData.data.paid_at,
          metadata: webhookData.data.metadata
        };
      } else if (webhookData.event === 'charge.failed') {
        return {
          gateway: 'paystack',
          status: 'failed',
          reference: webhookData.data.reference,
          amount: webhookData.data.amount / 100,
          currency: webhookData.data.currency,
          reason: webhookData.data.gateway_response.message,
          metadata: webhookData.data.metadata
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Paystack webhook verification failed:', error);
      throw error;
    }
  }

  /**
   * Verify PayFast webhook
   */
  private async verifyPayFastPayment(webhookData: WebhookData): Promise<any> {
    try {
      const passphrase = this.config.get<string>('PAYFAST_PASSPHRASE');

      // Verify webhook signature
      const receivedSignature = webhookData.body.signature;

      // Build string to verify
      const verifyString = [
        webhookData.body.m_payment_id,
        webhookData.body.pf_payment_id,
        webhookData.body.payment_status,
        webhookData.body.item_name,
        webhookData.body.item_description,
        webhookData.body.amount_gross,
        webhookData.body.merchant_id,
        passphrase
      ].join('');

      const expectedSignature = require('crypto')
        .createHash('md5')
        .update(verifyString)
        .digest('hex');

      if (receivedSignature !== expectedSignature) {
        throw new BadRequestException('Invalid webhook signature');
      }

      if (webhookData.body.payment_status === 'COMPLETE') {
        return {
          gateway: 'payfast',
          status: 'success',
          reference: webhookData.body.m_payment_id,
          paymentId: webhookData.body.pf_payment_id,
          amount: parseFloat(webhookData.body.amount_gross),
          currency: 'ZAR',
          customerEmail: webhookData.body.email_address,
          paymentMethod: 'payfast',
          paidAt: new Date(),
          customData: {
            userId: webhookData.body.custom_str1,
            type: webhookData.body.custom_str2,
            customData: webhookData.body.custom_str3
          }
        };
      }

      return null;
    } catch (error) {
      this.logger.error('PayFast webhook verification failed:', error);
      throw error;
    }
  }

  /**
   * Verify Ozow webhook
   */
  private async verifyOzowPayment(webhookData: WebhookData): Promise<any> {
    try {
      const privateKey = this.config.get<string>('OZOW_PRIVATE_KEY');

      // Verify webhook signature
      const receivedSignature = webhookData.body.signature;

      // Build string to verify
      const verifyString = [
        webhookData.body.TransactionReference,
        webhookData.body.Amount,
        webhookData.body.Currency,
        webhookData.body.TransactionDetail,
        webhookData.body.TransactionStatus,
        webhookData.body.ApplicationId,
        privateKey
      ].join('');

      const expectedSignature = require('crypto')
        .createHash('md5')
        .update(verifyString)
        .digest('hex');

      if (receivedSignature !== expectedSignature) {
        throw new BadRequestException('Invalid webhook signature');
      }

      if (webhookData.body.TransactionStatus === 'Complete') {
        return {
          gateway: 'ozow',
          status: 'success',
          reference: webhookData.body.TransactionReference,
          paymentId: webhookData.body.TransactionId,
          amount: parseFloat(webhookData.body.Amount),
          currency: webhookData.body.Currency,
          customerEmail: webhookData.body.CustomerEmailAddress,
          paymentMethod: 'ozow',
          paidAt: new Date(),
          customData: {
            userId: webhookData.body.CustomField1,
            type: webhookData.body.CustomField2,
            customData: webhookData.body.CustomField3
          }
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Ozow webhook verification failed:', error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  async processRefund(
    gateway: 'paystack' | 'payfast' | 'ozow',
    paymentId: string,
    amount: number,
    reason: string
  ): Promise<any> {
    switch (gateway) {
      case 'paystack':
        return this.processPaystackRefund(paymentId, amount, reason);
      case 'payfast':
        return this.processPayFastRefund(paymentId, amount, reason);
      case 'ozow':
        throw new BadRequestException('Ozow does not support automated refunds');
      default:
        throw new BadRequestException('Unsupported payment gateway');
    }
  }

  /**
   * Process Paystack refund
   */
  private async processPaystackRefund(transactionId: string, amount: number, reason: string): Promise<any> {
    try {
      const secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY');

      const payload = {
        transaction: transactionId,
        amount: Math.round(amount * 100), // Convert to kobo
        currency: 'ZAR',
        reason: reason || 'Refund requested by customer'
      };

      const response = await axios.post('https://api.paystack.co/refund', payload, {
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status) {
        return {
          gateway: 'paystack',
          status: 'success',
          refundId: response.data.data.id,
          amount: response.data.data.amount / 100,
          currency: response.data.data.currency,
          processedAt: response.data.data.createdAt
        };
      } else {
        throw new InternalServerErrorException('Paystack refund failed');
      }
    } catch (error) {
      this.logger.error('Paystack refund failed:', error);
      throw new InternalServerErrorException('Paystack refund failed');
    }
  }

  /**
   * Process PayFast refund
   */
  private async processPayFastRefund(transactionId: string, amount: number, reason: string): Promise<any> {
    try {
      const merchantId = this.config.get<string>('PAYFAST_MERCHANT_ID');
      const apiKey = this.config.get<string>('PAYFAST_API_KEY');

      const payload = {
        m_payment_id: transactionId,
        amount: amount.toFixed(2),
        reason: reason || 'Refund requested by customer'
      };

      const response = await axios.post('https://api.payfast.co.za/refund', payload, {
        headers: {
          'merchant-id': merchantId,
          'version': 'v1',
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'complete') {
        return {
          gateway: 'payfast',
          status: 'success',
          refundId: response.data.data.refund_id,
          amount: parseFloat(response.data.data.amount),
          currency: response.data.data.currency,
          processedAt: new Date()
        };
      } else {
        throw new InternalServerErrorException('PayFast refund failed');
      }
    } catch (error) {
      this.logger.error('PayFast refund failed:', error);
      throw new InternalServerErrorException('PayFast refund failed');
    }
  }

  /**
   * Get payment method details
   */
  getPaymentMethodDetails(gateway: 'paystack' | 'payfast' | 'ozow'): PaymentMethod {
    switch (gateway) {
      case 'paystack':
        return {
          name: 'Paystack',
          supportedCurrencies: ['NGN', 'GHS', 'KES', 'USD', 'EUR', 'GBP'],
          fees: {
            local: { type: 'percentage', value: 1.5, cap: 2000 }, // 1.5% + ₦2000
            international: { type: 'percentage', value: 3.9, cap: 0 } // 3.9%
          },
          supportedChannels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'transfer']
        };

      case 'payfast':
        return {
          name: 'PayFast',
          supportedCurrencies: ['ZAR'],
          fees: {
            local: { type: 'fixed_plus_percentage', value: 2.00, percentage: 3.95 } // R2.00 + 3.95%
          },
          supportedChannels: ['credit_card', 'eft', 'debit_order', 'cash', 'mpesa', 'zapper']
        };

      case 'ozow':
        return {
          name: 'Ozow',
          supportedCurrencies: ['ZAR'],
          fees: {
            local: { type: 'fixed_plus_percentage', value: 2.50, percentage: 2.0 } // R2.50 + 2.0%
          },
          supportedChannels: ['eft', 'instant_payment']
        };
    }
  }

  /**
   * Generate PayFast signature
   */
  private generatePayFastSignature(data: any, passphrase: string): string {
    const signatureString = Object.keys(data)
      .sort()
      .map(key => `${key}=${encodeURIComponent(data[key])}`)
      .join('&') + `&passphrase=${encodeURIComponent(passphrase)}`;

    return require('crypto')
      .createMd5()
      .update(signatureString)
      .digest('hex');
  }

  /**
   * Check if gateway is available
   */
  async isGatewayAvailable(gateway: 'paystack' | 'payfast' | 'ozow'): Promise<boolean> {
    try {
      const endpoints = {
        paystack: 'https://api.paystack.co/',
        payfast: 'https://www.payfast.co.za/eng/process',
        ozow: 'https://api.ozow.com/'
      };

      const response = await axios.get(endpoints[gateway], { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`Gateway ${gateway} is not available:`, error.message);
      return false;
    }
  }

  /**
   * Get gateway status for all configured gateways
   */
  async getGatewayStatuses(): Promise<Record<string, boolean>> {
    const gateways = ['paystack', 'payfast', 'ozow'] as const;
    const statuses = {};

    for (const gateway of gateways) {
      try {
        statuses[gateway] = await this.isGatewayAvailable(gateway);
      } catch (error) {
        statuses[gateway] = false;
      }
    }

    return statuses;
  }

  /**
   * Get supported payment methods for South Africa
   */
  getSupportedPaymentMethods(): PaymentMethod[] {
    return [
      this.getPaymentMethodDetails('paystack'),
      this.getPaymentMethodDetails('payfast'),
      this.getPaymentMethodDetails('ozow')
    ];
  }

  /**
   * Calculate transaction fees
   */
  calculateFees(gateway: string, amount: number): number {
    const paymentMethod = this.getPaymentMethodDetails(gateway as any);
    const fees = paymentMethod.fees;

    if (fees.local.type === 'percentage') {
      return (amount * fees.local.value) / 100;
    } else if (fees.local.type === 'fixed') {
      return fees.local.value;
    } else if (fees.local.type === 'fixed_plus_percentage') {
      return fees.local.value + (amount * fees.local.percentage) / 100;
    } else if (fees.local.type === 'percentage_with_cap') {
      const percentageAmount = (amount * fees.local.value) / 100;
      return Math.min(percentageAmount, fees.local.cap);
    }

    return 0;
  }

  /**
   * Get payment method recommendation based on amount and user preferences
   */
  getRecommendedPaymentMethod(amount: number, userPreferences?: {
    preferInstant: boolean;
    preferMobile: boolean;
  }): PaymentMethod {
    const paymentMethods = this.getSupportedPaymentMethods();

    // For small amounts (< R100), recommend instant payment methods
    if (amount < 100) {
      return paymentMethods.find(method =>
        method.name === 'Ozow' || method.supportedChannels.includes('mobile_money')
      );
    }

    // For larger amounts (> R5000), recommend card payments
    if (amount > 5000) {
      return paymentMethods.find(method =>
        method.supportedChannels.includes('card')
      );
    }

    // Default to Payfast for middle amounts
    return paymentMethods.find(method => method.name === 'Payfast');
  }
}