import axios from 'axios';
import { Broker, BrokerClient, BrokerStats, BrokerAnalytics, BrokerFilterOptions } from '../../types/broker';

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

export const _brokerApi = {
  // Get available brokers for directory
  getBrokers: async (filters?: BrokerFilterOptions) => {
    const client = createApiClient();
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.tier?.length) params.append('tier', filters.tier.join(','));
    if (filters?.status?.length) params.append('status', filters.status.join(','));
    if (filters?.minRating) params.append('minRating', filters.minRating.toString());
    if (filters?.minClients) params.append('minClients', filters.minClients.toString());
    if (filters?.country) params.append('country', filters.country);
    if (filters?.verified) params.append('verified', filters.verified.toString());

    const response = await client.get(`/brokers?${params.toString()}`);
    return response.data;
  },

  // Get single broker details
  getBroker: async (id: string) => {
    const client = createApiClient();
    const response = await client.get(`/brokers/${id}`);
    return response.data;
  },

  // Get broker statistics
  getBrokerStats: async (id: string) => {
    const client = createApiClient();
    const response = await client.get(`/brokers/${id}/stats`);
    return response.data;
  },

  // Link broker via OAuth
  linkBrokerOAuth: async (brokerId: string, provider: string) => {
    const client = createApiClient();
    const response = await client.post(`/brokers/link/${brokerId}/oauth/${provider}`);
    return response.data;
  },

  // Handle OAuth callback
  handleOAuthCallback: async (code: string, state: string) => {
    const client = createApiClient();
    const response = await client.get(`/brokers/link/callback?code=${code}&state=${state}`);
    return response.data;
  },

  // Unlink from current broker
  unlinkBroker: async () => {
    const client = createApiClient();
    const response = await client.delete('/brokers/link');
    return response.data;
  },

  // Get broker clients (for broker dashboard)
  getBrokerClients: async (brokerId: string, filters?: {
    page?: number;
    limit?: number;
    status?: string;
    attributionType?: string;
    search?: string;
  }) => {
    const client = createApiClient();
    const params = new URLSearchParams();

    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.attributionType) params.append('attributionType', filters.attributionType);
    if (filters?.search) params.append('search', filters.search);

    const response = await client.get(`/brokers/${brokerId}/clients?${params.toString()}`);
    return response.data;
  },

  // Get broker analytics (for broker dashboard)
  getBrokerAnalytics: async (brokerId: string, dateRange?: {
    start: Date;
    end: Date;
  }) => {
    const client = createApiClient();
    const params = new URLSearchParams();

    if (dateRange) {
      params.append('startDate', dateRange.start.toISOString());
      params.append('endDate', dateRange.end.toISOString());
    }

    const response = await client.get(`/brokers/${brokerId}/analytics?${params.toString()}`);
    return response.data;
  },

  // Get broker bills (for broker dashboard)
  getBrokerBills: async (brokerId: string, filters?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    const client = createApiClient();
    const params = new URLSearchParams();

    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);

    const response = await client.get(`/brokers/${brokerId}/bills?${params.toString()}`);
    return response.data;
  },

  // Update broker profile (broker self-service)
  updateBrokerProfile: async (brokerId: string, data: Partial<Broker>) => {
    const client = createApiClient();
    const response = await client.put(`/brokers/${brokerId}/profile`, data);
    return response.data;
  },

  // Get broker integrations (broker self-service)
  getBrokerIntegrations: async (brokerId: string) => {
    const client = createApiClient();
    const response = await client.get(`/brokers/${brokerId}/integrations`);
    return response.data;
  },

  // Generate broker referral code
  generateReferralCode: async (brokerId: string) => {
    const client = createApiClient();
    const response = await client.post(`/brokers/${brokerId}/referral-codes`);
    return response.data;
  },

  // Get broker referral codes
  getReferralCodes: async (brokerId: string) => {
    const client = createApiClient();
    const response = await client.get(`/brokers/${brokerId}/referral-codes`);
    return response.data;
  },

  // Get broker commission summary
  getCommissionSummary: async (brokerId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
  }) => {
    const client = createApiClient();
    const params = new URLSearchParams();

    if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
    if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());

    const response = await client.get(`/brokers/${brokerId}/commissions?${params.toString()}`);
    return response.data;
  },
};

// Re-export with original name for compatibility
export const brokerApi = _brokerApi;