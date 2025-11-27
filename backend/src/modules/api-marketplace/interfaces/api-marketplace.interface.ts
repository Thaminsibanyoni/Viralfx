// Prisma model interfaces (matching the schema)
export interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  description?: string;
  publicDocs?: string;
  category: string;
  defaultPlan: string;
  features?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiPlan {
  id: string;
  productId: string;
  name: string;
  code: string;
  monthlyFee: number;
  perCallFee?: number;
  rateLimit: number;
  burstLimit?: number;
  quota?: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  userId?: string;
  brokerId?: string;
  planId: string;
  key: string;
  secretHash: string;
  label?: string;
  ipWhitelist: string[];
  revoked: boolean;
  usageCount: number;
  quotaResetAt?: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  isSandbox: boolean;
}

export interface ApiUsage {
  id: string;
  apiKeyId: string;
  productId: string;
  path: string;
  method: string;
  statusCode: number;
  bytesIn: number;
  bytesOut: number;
  latencyMs: number;
  createdAt: Date;
}

export interface ApiInvoice {
  id: string;
  customerId?: string;
  customerType: 'USER' | 'BROKER';
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: string;
  createdAt: Date;
  paidAt?: Date;
  invoicePdfUrl?: string;
  metadata?: Record<string, any>;
}

export interface ApiWebhook {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: Date;
}

export interface RateLimitCounter {
  id: string;
  key: string;
  count: number;
  windowEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Additional interfaces for business logic
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export interface UsageStats {
  totalRequests: number;
  totalBandwidth: number;
  averageLatency: number;
  errorRate: number;
  topEndpoints: Array<{ path: string; count: number }>;
  requestsByHour: Array<{ hour: string; count: number }>;
  statusCodeDistribution: Record<string, number>;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  status: 'success' | 'failed';
  attemptCount: number;
  lastAttemptAt: Date;
  errorMessage?: string;
  responseCode?: number;
}

export interface ApiUsageLog {
  apiKeyId: string;
  productId: string;
  path: string;
  method: string;
  statusCode: number;
  bytesIn: number;
  bytesOut: number;
  latencyMs: number;
  userId?: string;
  brokerId?: string;
  ip?: string;
  userAgent?: string;
}

export interface ProductWithPlans extends ApiProduct {
  plans: ApiPlan[];
  _count: {
    apiKeys: number;
    apiUsage: number;
  };
}

export interface ApiKeyWithDetails extends ApiKey {
  plan: ApiPlan;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  broker?: {
    id: string;
    companyName: string;
    contactEmail: string;
  };
  _count: {
    apiUsage: number;
  };
}

export interface InvoiceWithDetails extends ApiInvoice {
  lineItems: InvoiceLineItem[];
  customer?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
  };
}

// Currency configuration - ZAR as default
export const API_CURRENCY_CONFIG = {
  DEFAULT_CURRENCY: 'ZAR',
  SUPPORTED_CURRENCIES: ['ZAR', 'USD', 'EUR', 'GBP'],
  VAT_RATE: 0.15, // 15% VAT for South Africa
} as const;

// Pricing tiers in ZAR
export const API_PRICING_TIERS = {
  STARTER: {
    name: 'Starter',
    monthlyFee: 890, // ZAR 890 (~$49)
    quota: 10000,
    rateLimit: 100,
  },
  PRO: {
    name: 'Pro',
    monthlyFee: 8990, // ZAR 8,990 (~$499)
    quota: 1000000,
    rateLimit: 5000,
  },
  INSTITUTIONAL: {
    name: 'Institutional',
    monthlyFee: 89990, // ZAR 89,990 (~$4,999)
    quota: 10000000,
    rateLimit: 30000,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    monthlyFee: null, // Custom pricing
    quota: null,
    rateLimit: null,
  },
} as const;

// Product categories
export const API_PRODUCT_CATEGORIES = [
  'SMI',
  'VTS',
  'VIRAL_SCORE',
  'SENTIMENT',
  'DECEPTION',
  'SOCIAL_MEDIA',
  'FINANCIAL',
  'ANALYTICS',
] as const;

// Supported webhook events
export const WEBHOOK_EVENTS = [
  'usage.threshold',
  'invoice.paid',
  'invoice.failed',
  'key.created',
  'key.revoked',
  'quota.exceeded',
  'quota.reset',
] as const;