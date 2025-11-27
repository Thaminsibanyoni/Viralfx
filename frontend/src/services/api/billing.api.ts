import { apiClient } from './client';

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  type: 'deposit' | 'withdrawal' | 'transfer' | 'fee';
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionFilters {
  userId?: string;
  status?: Transaction['status'];
  type?: Transaction['type'];
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface TransactionResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}

const billingApi = {
  getTransaction: async (transactionId: string): Promise<Transaction> => {
    const response = await apiClient.get(`/billing/transactions/${transactionId}`);
    return response.data;
  },

  getTransactions: async (filters?: TransactionFilters): Promise<TransactionResponse> => {
    const response = await apiClient.get('/billing/transactions', { params: filters });
    return response.data;
  },

  createTransaction: async (transactionData: Partial<Transaction>): Promise<Transaction> => {
    const response = await apiClient.post('/billing/transactions', transactionData);
    return response.data;
  },

  updateTransactionStatus: async (
    transactionId: string,
    status: Transaction['status']
  ): Promise<Transaction> => {
    const response = await apiClient.patch(`/billing/transactions/${transactionId}`, { status });
    return response.data;
  },

  getUserTransactions: async (
    userId: string,
    filters?: Omit<TransactionFilters, 'userId'>
  ): Promise<TransactionResponse> => {
    const response = await apiClient.get(`/billing/users/${userId}/transactions`, { params: filters });
    return response.data;
  },
};

export default billingApi;