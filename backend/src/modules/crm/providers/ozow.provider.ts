import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { createHash, createHmac } from 'crypto';
import { PaymentProvider, PaymentRequest, PaymentResponse, WebhookEvent } from '../interfaces/payment-provider.interface';

@Injectable()
export class OzowProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly siteCode: string;
  private readonly privateKey: string;
  private readonly apiKey: string;
  private readonly isTestMode: boolean;

  constructor(private configService: ConfigService) {
    this.siteCode = this.configService.get('OZOW_SITE_CODE');
    this.privateKey = this.configService.get('OZOW_PRIVATE_KEY');
    this.apiKey = this.configService.get('OZOW_API_KEY');
    this.isTestMode = this.configService.get('OZOW_TEST_MODE', 'true') === 'true';
    if (!this.siteCode || !this.privateKey || !this.apiKey) {
      throw new Error('OZOW_SITE_CODE, OZOW_PRIVATE_KEY, and OZOW_API_KEY environment variables are required');
    }
    this.baseUrl = this.isTestMode
      ? 'https://secure.ozow.com/postpaymentrequest'
      : 'https://secure.ozow.com/postpaymentrequest';
  }

  async createPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      const payload: any = {
        SiteCode: this.siteCode,
        CountryCode: 'ZA',
        CurrencyCode: paymentRequest.currency || 'ZAR',
        Amount: paymentRequest.amount.toFixed(2),
        TransactionReference: paymentRequest.reference,
        BankReference: `VF${paymentRequest.invoiceId}`,
        CancelUrl: paymentRequest.cancelUrl,
        SuccessUrl: paymentRequest.callbackUrl,
        ErrorUrl: paymentRequest.callbackUrl,
        NotifyUrl: paymentRequest.webhookUrl,
        CustomerName: paymentRequest.customerName || 'Customer',
        CustomerEmail: paymentRequest.customerEmail,
        CustomerMobile: paymentRequest.customerPhone || '',
        Optional1: paymentRequest.invoiceId,
        Optional2: paymentRequest.brokerId,
        Optional3: 'VIRALFX_CRM',
        Optional4: paymentRequest.metadata?.subscriptionId || '',
        Optional5: paymentRequest.metadata?.paymentType || 'invoice',
        TransactionType: 'Payment',
        IsDebit: false,
        CancelUrlIsBack: true,
        SuccessUrlIsBack: true,
        VerifyHash: false // We'll generate our own hash
      };

      // Generate secure hash
      const inputString = this.generateInputString(payload);
      const checkSum = this.generateCheckSum(inputString);
      payload.CheckSum = checkSum;

      // Create payment request
      const response: AxiosResponse = await axios.post(
        this.baseUrl,
        new URLSearchParams(payload).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // Ozow returns HTML redirect or JSON response depending on API version
      if (typeof response.data === 'string' && response.data.includes('form')) {
        // Extract redirect URL from HTML form
        const redirectUrlMatch = response.data.match(/action="([^"]+)"/);
        const redirectUrl = redirectUrlMatch ? redirectUrlMatch[1] : this.baseUrl;
        return {
          success: true,
          reference: paymentRequest.reference,
          authorizationUrl: redirectUrl,
          provider: 'ozow',
          metadata: { checkSum, inputString }
        };
      } else {
        return {
          success: true,
          reference: paymentRequest.reference,
          authorizationUrl: response.data.RedirectUrl || this.baseUrl,
          transactionId: response.data.TransactionId,
          provider: 'ozow',
          metadata: response.data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'ozow'
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentResponse> {
    try {
      // Ozow payment verification is typically done through webhooks
      // This method would query Ozow's API for transaction status
      const payload: any = {
        SiteCode: this.siteCode,
        TransactionReference: reference
      };
      const inputString = this.generateInputString(payload);
      const checkSum = this.generateCheckSum(inputString);
      payload.CheckSum = checkSum;
      const response: AxiosResponse = await axios.post(
        `${this.isTestMode ? 'https://api.ozow.com/PostPaymentRequest' : 'https://api.ozow.com/PostPaymentRequest'}`,
        new URLSearchParams(payload).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      const data = response.data;
      if (data.Status && data.Status.toLowerCase() === 'completed') {
        return {
          success: true,
          reference,
          amount: parseFloat(data.Amount),
          currency: data.CurrencyCode || 'ZAR',
          status: 'completed',
          paidAt: new Date(data.CompletedDate || data.TransactionDate),
          bankReference: data.BankReference,
          provider: 'ozow',
          metadata: data
        };
      } else {
        return {
          success: false,
          reference,
          status: data.Status?.toLowerCase() || 'pending',
          message: data.StatusDescription,
          provider: 'ozow',
          metadata: data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'ozow'
      };
    }
  }

  async processWebhook(rawBody: string, signature: string): Promise<WebhookEvent> {
    try {
      // Parse URL-encoded form data from Ozow
      const parsedData = new URLSearchParams(rawBody);
      const eventData: any = {};
      parsedData.forEach((value, key) => {
        eventData[key] = value;
      });

      // Verify webhook signature using the CheckSum
      const receivedCheckSum = eventData.CheckSum;
      delete eventData.CheckSum;
      const inputString = this.generateInputString(eventData);
      const expectedCheckSum = this.generateCheckSum(inputString);
      if (receivedCheckSum !== expectedCheckSum) {
        throw new Error('Invalid webhook signature');
      }
      const status = eventData.Status?.toLowerCase();
      return {
        provider: 'ozow',
        eventType: `payment.${status}`,
        reference: eventData.TransactionReference,
        amount: parseFloat(eventData.Amount),
        currency: eventData.CurrencyCode || 'ZAR',
        status,
        paidAt: status === 'completed' ? new Date(eventData.CompletedDate || eventData.TransactionDate) : null,
        customerEmail: eventData.CustomerEmail,
        bankReference: eventData.BankReference,
        transactionId: eventData.TransactionId,
        metadata: eventData
      };
    } catch (error) {
      throw new Error(`Invalid webhook payload: ${error.message}`);
    }
  }

  async refundPayment(reference: string, amount?: number): Promise<PaymentResponse> {
    try {
      const payload: any = {
        SiteCode: this.siteCode,
        TransactionReference: reference,
        RefundAmount: amount ? amount.toFixed(2) : undefined,
        RefundReason: 'Customer requested refund'
      };
      const inputString = this.generateInputString(payload);
      const checkSum = this.generateCheckSum(inputString);
      payload.CheckSum = checkSum;
      const response: AxiosResponse = await axios.post(
        `${this.isTestMode ? 'https://api.ozow.com/RefundRequest' : 'https://api.ozow.com/RefundRequest'}`,
        new URLSearchParams(payload).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      return {
        success: true,
        reference,
        refundId: response.data.RefundId || reference,
        amount: amount || parseFloat(response.data.OriginalAmount),
        status: 'processing',
        provider: 'ozow',
        metadata: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'ozow'
      };
    }
  }

  private generateInputString(data: any): string {
    // Ozow specific input string generation
    return Object.keys(data)
      .sort()
      .map(key => `${key}=${data[key]?.toString() || ''}`)
      .join('');
  }

  private generateCheckSum(inputString: string): string {
    return createHash('md5')
      .update(`${inputString}${this.privateKey}`)
      .digest('hex');
  }

  getProviderName(): string {
    return 'ozow';
  }

  getSupportedCurrencies(): string[] {
    return ['ZAR']; // Ozow is primarily for South African Rand
  }

  getSupportedBanks(): string[] {
    return [
      'ABSABANK',
      'FNB',
      'NEDBANK',
      'STANDBANK',
      'CAPITEC',
      'DISCOVERYBANK',
      'TYMEBANK',
      'AFRICANBANK',
      'INVESTEC',
      'BIDVESTBANK',
      'GRINDRODBANK',
      'SASFINBANK',
      'UBANK',
      'BOKBANK',
      'ALBARAKABANK'
    ];
  }

  // Ozow-specific features
  async generatePaymentLink(paymentRequest: PaymentRequest): Promise<string> {
    const response = await this.createPayment(paymentRequest);
    return response.authorizationUrl;
  }

  async getPaymentStatus(transactionReference: string): Promise<any> {
    const payload: any = {
      SiteCode: this.siteCode,
      TransactionReference: transactionReference
    };
    const inputString = this.generateInputString(payload);
    const checkSum = this.generateCheckSum(inputString);
    payload.CheckSum = checkSum;
    const response: AxiosResponse = await axios.post(
      `${this.isTestMode ? 'https://api.ozow.com/GetTransactionStatus' : 'https://api.ozow.com/GetTransactionStatus'}`,
      new URLSearchParams(payload).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data;
  }
}