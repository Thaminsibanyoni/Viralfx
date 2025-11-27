import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Create axios instance with auth headers
const createApiClient = () => {
  const token = localStorage.getItem('accessToken');
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
};

export interface WalletBalance {
  available: number;
  locked: number;
  total: number;
  currency: string;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'FEE' | 'BONUS';
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  balanceBefore: number;
  balanceAfter: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'crypto';
  provider: string;
  identifier: string;
  brand?: string;
  expiryDate?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalRequest {
  amount: number;
  currency: string;
  destination: string;
  method: string;
  twoFactorCode?: string;
}

export interface DepositRequest {
  amount: number;
  currency: string;
  paymentMethod: string;
  returnUrl?: string;
}

export const _walletApi = {
  // Get wallet balance
  getBalance: async (userId?: string) => {
    const client = createApiClient();
    const url = userId ? `/wallet/balance/${userId}` : '/wallet/balance';
    const response = await client.get(url);
    return response.data;
  },

  // Get transaction history
  getTransactions: async (filters?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const client = createApiClient();
    const params = new URLSearchParams();

    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await client.get(`/wallet/transactions?${params.toString()}`);
    return response.data;
  },

  // Get payment methods
  getPaymentMethods: async () => {
    const client = createApiClient();
    const response = await client.get('/wallet/payment-methods');
    return response.data;
  },

  // Add payment method
  addPaymentMethod: async (methodData: {
    type: string;
    provider: string;
    data: Record<string, any>;
    isDefault?: boolean;
  }) => {
    const client = createApiClient();
    const response = await client.post('/wallet/payment-methods', methodData);
    return response.data;
  },

  // Remove payment method
  removePaymentMethod: async (methodId: string) => {
    const client = createApiClient();
    const response = await client.delete(`/wallet/payment-methods/${methodId}`);
    return response.data;
  },

  // Set default payment method
  setDefaultPaymentMethod: async (methodId: string) => {
    const client = createApiClient();
    const response = await client.patch(`/wallet/payment-methods/${methodId}/default`);
    return response.data;
  },

  // Initiate deposit
  deposit: async (data: DepositRequest) => {
    const client = createApiClient();
    const response = await client.post('/wallet/deposit', data);
    return response.data;
  },

  // Initiate withdrawal
  withdraw: async (data: WithdrawalRequest) => {
    const client = createApiClient();
    const response = await client.post('/wallet/withdraw', data);
    return response.data;
  },

  // Get withdrawal fees
  getWithdrawalFees: async (amount: number, method: string, currency: string) => {
    const client = createApiClient();
    const response = await client.get(`/wallet/withdrawal-fees?amount=${amount}&method=${method}&currency=${currency}`);
    return response.data;
  },

  // Get wallet settings
  getSettings: async () => {
    const client = createApiClient();
    const response = await client.get('/wallet/settings');
    return response.data;
  },

  // Update wallet settings
  updateSettings: async (settings: {
    defaultCurrency?: string;
    withdrawalLimit?: {
      daily?: number;
      monthly?: number;
    };
    autoWithdrawal?: {
      enabled?: boolean;
      threshold?: number;
      method?: string;
    };
  }) => {
    const client = createApiClient();
    const response = await client.put('/wallet/settings', settings);
    return response.data;
  },

  // Get payment gateway status
  getGatewayStatus: async () => {
    const client = createApiClient();
    const response = await client.get('/wallet/gateways/status');
    return response.data;
  },

  // Get wallet addresses for crypto
  getCryptoAddresses: async () => {
    const client = createApiClient();
    const response = await client.get('/wallet/crypto-addresses');
    return response.data;
  },

  // Generate new crypto address
  generateCryptoAddress: async (currency: string) => {
    const client = createApiClient();
    const response = await client.post(`/wallet/crypto-addresses/${currency}`);
    return response.data;
  },

  // Verify withdrawal with 2FA
  verifyWithdrawal: async (withdrawalId: string, twoFactorCode: string) => {
    const client = createApiClient();
    const response = await client.post(`/wallet/withdrawals/${withdrawalId}/verify`, {
      twoFactorCode,
    });
    return response.data;
  },

  // Cancel withdrawal
  cancelWithdrawal: async (withdrawalId: string) => {
    const client = createApiClient();
    const response = await client.patch(`/wallet/withdrawals/${withdrawalId}/cancel`);
    return response.data;
  },

  // Get recent transactions
  getRecentTransactions: async (filters?: {
    limit?: number;
    type?: string;
  }) => {
    const client = createApiClient();
    const params = new URLSearchParams();

    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.type) params.append('type', filters.type);

    const response = await client.get(`/wallet/transactions?${params.toString()}`);
    return response.data.transactions || response.data;
  },
};

// Re-export with original name for compatibility
export const walletApi = _walletApi;
