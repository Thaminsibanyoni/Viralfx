export interface PaymentRequest {
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  amount: number;
  currency?: string;
  reference: string;
  invoiceId: string;
  brokerId: string;
  callbackUrl: string;
  cancelUrl?: string;
  webhookUrl: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  reference?: string;
  authorizationUrl?: string;
  transactionId?: string;
  accessCode?: string;
  amount?: number;
  currency?: string;
  status?: string;
  paidAt?: Date;
  bankReference?: string;
  refundId?: string;
  error?: string;
  message?: string;
  provider: string;
  metadata?: any;
}

export interface WebhookEvent {
  provider: string;
  eventType: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paidAt?: Date;
  customerEmail?: string;
  bankReference?: string;
  bankName?: string;
  transactionId?: string;
  metadata: any;
}

export interface PaymentProvider {
  createPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse>;
  verifyPayment(reference: string): Promise<PaymentResponse>;
  processWebhook(rawBody: string, signature: string): Promise<WebhookEvent>;
  refundPayment(reference: string, amount?: number): Promise<PaymentResponse>;
  getProviderName(): string;
  getSupportedCurrencies(): string[];
}
