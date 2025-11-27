import apiClient from './client';

// TypeScript interfaces matching backend models
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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  planId: string;
  label?: string;
  ipWhitelist: string[];
  revoked: boolean;
  usageCount: number;
  quotaResetAt?: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
  isSandbox: boolean;
  plan?: ApiPlan;
  _count?: {
    apiUsage: number;
  };
}

export interface ApiUsage {
  totalRequests: number;
  totalBandwidth: number;
  averageLatency: number;
  errorRate: number;
  topEndpoints: Array<{ path: string; count: number }>;
  requestsByHour: Array<{ hour: string; count: number }>;
  statusCodeDistribution: Record<string, number>;
}

export interface ApiInvoice {
  id: string;
  customerId?: string;
  customerType: 'USER' | 'BROKER';
  billingPeriodStart: string;
  billingPeriodEnd: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt?: string;
  invoicePdfUrl?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    currency: string;
  }>;
}

export interface ApiWebhook {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
}

// Products API
export const productsApi = {
  // Get all products with optional filters
  getProducts: async (params?: {
    category?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get('/api/v1/api-marketplace/products', { params });
    return response.data;
  },

  // Get product by slug
  getProduct: async (slug: string) => {
    const response = await apiClient.get(`/api/v1/api-marketplace/products/${slug}`);
    return response.data;
  },

  // Get product plans
  getProductPlans: async (productId: string) => {
    const response = await apiClient.get(`/api/v1/api-marketplace/products/${productId}/plans`);
    return response.data;
  },

  // Create product (Admin only)
  createProduct: async (data: {
    name: string;
    slug: string;
    description?: string;
    publicDocs?: string;
    category: string;
    defaultPlan: string;
    features?: string[];
    isActive?: boolean;
  }) => {
    const response = await apiClient.post('/api/v1/api-marketplace/products', data);
    return response.data;
  },

  // Update product (Admin only)
  updateProduct: async (id: string, data: Partial<ApiProduct>) => {
    const response = await apiClient.patch(`/api/v1/api-marketplace/products/${id}`, data);
    return response.data;
  },

  // Delete product (Admin only)
  deleteProduct: async (id: string) => {
    await apiClient.delete(`/api/v1/api-marketplace/products/${id}`);
  },
};

// Plans API
export const plansApi = {
  // Get all plans
  getPlans: async (productId?: string) => {
    const params = productId ? { productId } : {};
    const response = await apiClient.get('/api/v1/api-marketplace/plans', { params });
    return response.data;
  },

  // Get plan by code
  getPlan: async (code: string) => {
    const response = await apiClient.get(`/api/v1/api-marketplace/plans/${code}`);
    return response.data;
  },

  // Create plan (Admin only)
  createPlan: async (productId: string, data: {
    name: string;
    code: string;
    monthlyFee: number;
    perCallFee?: number;
    rateLimit: number;
    burstLimit?: number;
    quota?: number;
    description?: string;
  }) => {
    const response = await apiClient.post(`/api/v1/api-marketplace/products/${productId}/plans`, data);
    return response.data;
  },

  // Update plan (Admin only)
  updatePlan: async (id: string, data: Partial<ApiPlan>) => {
    const response = await apiClient.patch(`/api/v1/api-marketplace/plans/${id}`, data);
    return response.data;
  },

  // Delete plan (Admin only)
  deletePlan: async (id: string) => {
    await apiClient.delete(`/api/v1/api-marketplace/plans/${id}`);
  },
};

// API Keys API
export const keysApi = {
  // Get all keys for the authenticated user
  getKeys: async () => {
    const response = await apiClient.get('/api/v1/api-marketplace/keys');
    return response.data;
  },

  // Get key by ID
  getKey: async (id: string) => {
    const response = await apiClient.get(`/api/v1/api-marketplace/keys/${id}`);
    return response.data;
  },

  // Create new API key
  createKey: async (data: {
    planId: string;
    label?: string;
    ipWhitelist?: string[];
    isSandbox?: boolean;
    metadata?: Record<string, any>;
  }) => {
    const response = await apiClient.post('/api/v1/api-marketplace/keys', data);
    return response.data;
  },

  // Update key
  updateKey: async (id: string, data: {
    label?: string;
    ipWhitelist?: string[];
    metadata?: Record<string, any>;
  }) => {
    const response = await apiClient.patch(`/api/v1/api-marketplace/keys/${id}`, data);
    return response.data;
  },

  // Revoke key
  revokeKey: async (id: string) => {
    const response = await apiClient.post(`/api/v1/api-marketplace/keys/${id}/revoke`);
    return response.data;
  },

  // Rotate key
  rotateKey: async (id: string) => {
    const response = await apiClient.post(`/api/v1/api-marketplace/keys/${id}/rotate`);
    return response.data;
  },

  // Get key usage statistics
  getKeyUsage: async (id: string, params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'hour' | 'day' | 'month';
  }) => {
    const response = await apiClient.get(`/api/v1/api-marketplace/keys/${id}/usage`, { params });
    return response.data;
  },
};

// Usage Analytics API
export const usageApi = {
  // Get usage statistics
  getUsage: async (params?: {
    apiKeyId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
    groupBy?: 'hour' | 'day' | 'month';
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get('/api/v1/api-marketplace/usage', { params });
    return response.data;
  },

  // Export usage report
  exportUsage: async (params: {
    format: 'csv' | 'json';
    apiKeyId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await apiClient.get('/api/v1/api-marketplace/usage/export', {
      params,
      responseType: params.format === 'csv' ? 'blob' : 'json',
    });
    return response.data;
  },

  // Admin usage query
  getAdminUsage: async (params?: {
    customerId?: string;
    customerType?: 'USER' | 'BROKER';
    productId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get('/api/v1/admin/api-marketplace/usage', { params });
    return response.data;
  },

  // Get top users
  getTopUsers: async (params?: {
    period?: string;
    limit?: number;
  }) => {
    const response = await apiClient.get('/api/v1/admin/api-marketplace/usage/top-users', { params });
    return response.data;
  },
};

// Billing API
export const billingApi = {
  // Get user's invoices
  getInvoices: async (params?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get('/api/v1/api-marketplace/billing/invoices', { params });
    return response.data;
  },

  // Get invoice details
  getInvoice: async (id: string) => {
    const response = await apiClient.get(`/api/v1/api-marketplace/billing/invoices/${id}`);
    return response.data;
  },

  // Initiate payment for invoice
  payInvoice: async (id: string, gateway: 'paystack' | 'payfast' | 'ozow') => {
    const response = await apiClient.post(`/api/v1/api-marketplace/billing/invoices/${id}/pay`, { gateway });
    return response.data;
  },

  // Download invoice PDF
  downloadInvoicePdf: async (id: string) => {
    const response = await apiClient.get(`/api/v1/api-marketplace/billing/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Generate invoice (Admin only)
  generateInvoice: async (data: {
    customerId: string;
    customerType: 'USER' | 'BROKER';
    period: {
      start: string;
      end: string;
    };
  }) => {
    const response = await apiClient.post('/api/v1/admin/api-marketplace/billing/invoices/generate', data);
    return response.data;
  },
};

// Webhooks API
export const webhooksApi = {
  // Get user's webhooks
  getWebhooks: async () => {
    const response = await apiClient.get('/api/v1/api-marketplace/webhooks');
    return response.data;
  },

  // Get webhook by ID
  getWebhook: async (id: string) => {
    const response = await apiClient.get(`/api/v1/api-marketplace/webhooks/${id}`);
    return response.data;
  },

  // Create webhook
  createWebhook: async (data: {
    url: string;
    events: string[];
    secret?: string;
    isActive?: boolean;
  }) => {
    const response = await apiClient.post('/api/v1/api-marketplace/webhooks', data);
    return response.data;
  },

  // Update webhook
  updateWebhook: async (id: string, data: Partial<ApiWebhook>) => {
    const response = await apiClient.patch(`/api/v1/api-marketplace/webhooks/${id}`, data);
    return response.data;
  },

  // Delete webhook
  deleteWebhook: async (id: string) => {
    await apiClient.delete(`/api/v1/api-marketplace/webhooks/${id}`);
  },

  // Test webhook
  testWebhook: async (id: string, data?: {
    event?: string;
    data?: Record<string, any>;
  }) => {
    const response = await apiClient.post(`/api/v1/api-marketplace/webhooks/${id}/test`, data);
    return response.data;
  },

  // Get webhook logs
  getWebhookLogs: async (id: string, params?: {
    event?: string;
    status?: 'success' | 'failed';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get(`/api/v1/api-marketplace/webhooks/${id}/logs`, { params });
    return response.data;
  },
};

// Admin API
export const adminApi = {
  // Get all API keys (Admin only)
  getAllKeys: async (params?: {
    customerId?: string;
    customerType?: 'USER' | 'BROKER';
    planId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get('/api/v1/admin/api-marketplace/keys', { params });
    return response.data;
  },

  // Get platform statistics (Admin only)
  getPlatformStats: async () => {
    const response = await apiClient.get('/api/v1/admin/api-marketplace/stats');
    return response.data;
  },

  // Get all invoices (Admin only)
  getAllInvoices: async (params?: {
    customerId?: string;
    customerType?: 'USER' | 'BROKER';
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get('/api/v1/admin/api-marketplace/invoices', { params });
    return response.data;
  },
};

export default {
  products: productsApi,
  plans: plansApi,
  keys: keysApi,
  usage: usageApi,
  billing: billingApi,
  webhooks: webhooksApi,
  admin: adminApi,
};