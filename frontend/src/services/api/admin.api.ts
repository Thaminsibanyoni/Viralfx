import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Types
interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Admin API client
class AdminApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3000/api/v1/admin',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('admin_access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('admin_refresh_token');
            if (refreshToken) {
              const response = await this.refreshToken(refreshToken);
              const newToken = response.data.accessToken;

              localStorage.setItem('admin_access_token', newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;

              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, logout user
            localStorage.removeItem('admin_access_token');
            localStorage.removeItem('admin_refresh_token');
            localStorage.removeItem('admin_token_expires');
            window.location.href = '/admin/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Authentication endpoints
  async adminLogin(credentials: {
    email: string;
    password: string;
    twoFactorCode?: string;
    deviceFingerprint?: string;
  }) {
    const response = await this.client.post('/auth/login', credentials);
    return response.data;
  }

  async adminLogout() {
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  async refreshToken(refreshToken: string) {
    const response = await this.client.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  async getAdminProfile() {
    const response = await this.client.get('/auth/profile');
    return response.data;
  }

  async getAdminPermissions() {
    const response = await this.client.get('/auth/permissions');
    return response.data;
  }

  // Dashboard endpoints
  async getDashboardOverview(timeframe: string = '24h') {
    const response = await this.client.get(`/dashboard/overview?timeframe=${timeframe}`);
    return response.data;
  }

  async getSystemHealth() {
    const response = await this.client.get('/dashboard/system/health');
    return response.data;
  }

  async getSystemAlerts() {
    const response = await this.client.get('/dashboard/alerts');
    return response.data;
  }

  async getPredictiveInsights() {
    const response = await this.client.get('/dashboard/overview/predictive');
    return response.data;
  }

  async getRecentActivity() {
    const response = await this.client.get('/dashboard/activity/recent');
    return response.data;
  }

  // User management endpoints
  async getUsers(filters: {
    page: number;
    limit: number;
    status?: string;
    kycStatus?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/users?${params}`);
    return response.data;
  }

  async getUserById(userId: string) {
    const response = await this.client.get(`/users/${userId}`);
    return response.data;
  }

  async suspendUser(userId: string, reason: string) {
    const response = await this.client.post(`/users/${userId}/suspend`, { reason });
    return response.data;
  }

  async unsuspendUser(userId: string) {
    const response = await this.client.post(`/users/${userId}/unsuspend`);
    return response.data;
  }

  async banUser(userId: string, reason: string) {
    const response = await this.client.post(`/users/${userId}/ban`, { reason });
    return response.data;
  }

  async unbanUser(userId: string) {
    const response = await this.client.post(`/users/${userId}/unban`);
    return response.data;
  }

  async getUserAudit(userId: string) {
    const response = await this.client.get(`/users/${userId}/audit`);
    return response.data;
  }

  async approveKYC(userId: string) {
    const response = await this.client.post(`/users/${userId}/kyc/approve`);
    return response.data;
  }

  async rejectKYC(userId: string, reason: string) {
    const response = await this.client.post(`/users/${userId}/kyc/reject`, { reason });
    return response.data;
  }

  // Broker management endpoints
  async getBrokers(filters: {
    page: number;
    limit: number;
    status?: string;
    tier?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/brokers?${params}`);
    return response.data;
  }

  async getBrokerById(brokerId: string) {
    const response = await this.client.get(`/brokers/${brokerId}`);
    return response.data;
  }

  async approveBroker(brokerId: string) {
    const response = await this.client.post(`/brokers/${brokerId}/approve`);
    return response.data;
  }

  async suspendBroker(brokerId: string, reason: string) {
    const response = await this.client.post(`/brokers/${brokerId}/suspend`, { reason });
    return response.data;
  }

  async verifyBroker(brokerId: string, verificationData: any) {
    const response = await this.client.post(`/brokers/${brokerId}/verify`, verificationData);
    return response.data;
  }

  // Finance management endpoints
  async getFinanceOverview(timeframe: string = '30d') {
    const response = await this.client.get(`/finance/overview?timeframe=${timeframe}`);
    return response.data;
  }

  async getTransactions(filters: {
    page: number;
    limit: number;
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/finance/transactions?${params}`);
    return response.data;
  }

  async getInvoices(filters: {
    page: number;
    limit: number;
    status?: string;
    brokerId?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/finance/invoices?${params}`);
    return response.data;
  }

  async createInvoice(invoiceData: any) {
    const response = await this.client.post('/finance/invoices', invoiceData);
    return response.data;
  }

  async createPayout(payoutData: any) {
    const response = await this.client.post('/finance/payouts', payoutData);
    return response.data;
  }

  // Trend management endpoints
  async getTrends(filters: {
    page: number;
    limit: number;
    status?: string;
    category?: string;
    region?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/trends?${params}`);
    return response.data;
  }

  async getTrendById(trendId: string) {
    const response = await this.client.get(`/trends/${trendId}`);
    return response.data;
  }

  async overrideTrend(trendId: string, overrideData: any) {
    const response = await this.client.post(`/trends/${trendId}/override`, overrideData);
    return response.data;
  }

  async approveTrend(trendId: string) {
    const response = await this.client.post(`/trends/${trendId}/approve`);
    return response.data;
  }

  // Risk management endpoints
  async getRiskAlerts(filters: {
    page: number;
    limit: number;
    severity?: string;
    status?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/risk/alerts?${params}`);
    return response.data;
  }

  async getHarmfulContent(filters: {
    page: number;
    limit: number;
    type?: string;
    status?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/risk/content?${params}`);
    return response.data;
  }

  async blockContent(contentId: string, reason: string) {
    const response = await this.client.post(`/risk/content/${contentId}/block`, { reason });
    return response.data;
  }

  async approveContent(contentId: string) {
    const response = await this.client.post(`/risk/content/${contentId}/approve`);
    return response.data;
  }

  // VTS management endpoints
  async getVTSSymbols(filters: {
    page: number;
    limit: number;
    category?: string;
    region?: string;
    status?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/vts/symbols?${params}`);
    return response.data;
  }

  async getVTSSymbolById(symbolId: string) {
    const response = await this.client.get(`/vts/symbols/${symbolId}`);
    return response.data;
  }

  async mergeSymbols(sourceId: string, targetId: string) {
    const response = await this.client.post(`/vts/symbols/${sourceId}/merge`, { targetId });
    return response.data;
  }

  async updateSymbolCategory(symbolId: string, category: string) {
    const response = await this.client.put(`/vts/symbols/${symbolId}/category`, { category });
    return response.data;
  }

  async freezeSymbol(symbolId: string, reason: string) {
    const response = await this.client.put(`/vts/symbols/${symbolId}/freeze`, { reason });
    return response.data;
  }

  async unfreezeSymbol(symbolId: string) {
    const response = await this.client.put(`/vts/symbols/${symbolId}/unfreeze`);
    return response.data;
  }

  // Oracle management endpoints
  async getOracleNodes(filters: {
    page: number;
    limit: number;
    status?: string;
    region?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/oracle/nodes?${params}`);
    return response.data;
  }

  async getOracleNodeById(nodeId: string) {
    const response = await this.client.get(`/oracle/nodes/${nodeId}`);
    return response.data;
  }

  async restartNode(nodeId: string) {
    const response = await this.client.post(`/oracle/nodes/${nodeId}/restart`);
    return response.data;
  }

  async disableNode(nodeId: string, reason: string) {
    const response = await this.client.post(`/oracle/nodes/${nodeId}/disable`, { reason });
    return response.data;
  }

  async enableNode(nodeId: string) {
    const response = await this.client.post(`/oracle/nodes/${nodeId}/enable`);
    return response.data;
  }

  async getConsensusHealth() {
    const response = await this.client.get('/oracle/consensus');
    return response.data;
  }

  // Platform settings endpoints
  async getPlatformSettings() {
    const response = await this.client.get('/platform/settings');
    return response.data;
  }

  async updateSetting(key: string, value: any) {
    const response = await this.client.put(`/platform/settings/${key}`, { value });
    return response.data;
  }

  async getFeatureFlags() {
    const response = await this.client.get('/platform/features');
    return response.data;
  }

  async toggleFeature(feature: string, enabled: boolean) {
    const response = await this.client.put(`/platform/features/${feature}`, { enabled });
    return response.data;
  }

  async setMaintenanceMode(enabled: boolean, message?: string) {
    const response = await this.client.post('/platform/maintenance', { enabled, message });
    return response.data;
  }

  // Notification management endpoints
  async getNotificationTemplates(filters: {
    page: number;
    limit: number;
    category?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/notifications/templates?${params}`);
    return response.data;
  }

  async createTemplate(templateData: any) {
    const response = await this.client.post('/notifications/templates', templateData);
    return response.data;
  }

  async updateTemplate(templateId: string, templateData: any) {
    const response = await this.client.put(`/notifications/templates/${templateId}`, templateData);
    return response.data;
  }

  async deleteTemplate(templateId: string) {
    const response = await this.client.delete(`/notifications/templates/${templateId}`);
    return response.data;
  }

  async broadcastNotification(notificationData: any) {
    const response = await this.client.post('/notifications/broadcast', notificationData);
    return response.data;
  }

  async sendToSegment(segment: any, notificationData: any) {
    const response = await this.client.post('/notifications/segment', { segment, notification: notificationData });
    return response.data;
  }

  async getNotificationHistory(filters: {
    page: number;
    limit: number;
    status?: string;
    channel?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/notifications/history?${params}`);
    return response.data;
  }

  // Audit endpoints
  async getAuditLogs(filters: {
    page: number;
    limit: number;
    action?: string;
    adminId?: string;
    targetType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/audit?${params}`);
    return response.data;
  }

  async getAuditStatistics() {
    const response = await this.client.get('/audit/statistics');
    return response.data;
  }

  // Admin management endpoints
  async getAdmins(filters: {
    page: number;
    limit: number;
    role?: string;
    status?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/admins?${params}`);
    return response.data;
  }

  async getAdminById(adminId: string) {
    const response = await this.client.get(`/admins/${adminId}`);
    return response.data;
  }

  async createAdmin(adminData: any) {
    const response = await this.client.post('/admins', adminData);
    return response.data;
  }

  async updateAdmin(adminId: string, adminData: any) {
    const response = await this.client.put(`/admins/${adminId}`, adminData);
    return response.data;
  }

  async getPermissions() {
    const response = await this.client.get('/permissions');
    return response.data;
  }

  async getRoles() {
    const response = await this.client.get('/permissions/roles');
    return response.data;
  }

  // System Resilience and Chaos Testing endpoints
  async getResilienceMetrics(timeframe: string = '24h') {
    const response = await this.client.get(`/resilience/metrics?timeframe=${timeframe}`);
    return response.data;
  }

  async getSystemResilienceHealth() {
    const response = await this.client.get('/resilience/health');
    return response.data;
  }

  async getChaosExperiments(filters: {
    page: number;
    limit: number;
    status?: string;
    category?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/resilience/chaos/experiments?${params}`);
    return response.data;
  }

  async getChaosExperimentById(experimentId: string) {
    const response = await this.client.get(`/resilience/chaos/experiments/${experimentId}`);
    return response.data;
  }

  async createChaosExperiment(experimentData: {
    name: string;
    description: string;
    category: string;
    target: {
      type: string;
      components: string[];
      region?: string;
    };
    configuration: {
      duration: number;
      intensity: number;
      parameters: Record<string, any>;
    };
    schedule?: {
      startTime?: Date;
      endTime?: Date;
      recurring?: {
        frequency: string;
        interval: number;
      };
    };
    safetyLimits?: {
      maxFailureRate: number;
      rollbackThreshold: number;
      criticalServicesExempt: boolean;
    };
  }) {
    const response = await this.client.post('/resilience/chaos/experiments', experimentData);
    return response.data;
  }

  async updateChaosExperiment(experimentId: string, experimentData: any) {
    const response = await this.client.put(`/resilience/chaos/experiments/${experimentId}`, experimentData);
    return response.data;
  }

  async deleteChaosExperiment(experimentId: string) {
    const response = await this.client.delete(`/resilience/chaos/experiments/${experimentId}`);
    return response.data;
  }

  async startChaosExperiment(experimentId: string, runConfiguration?: any) {
    const response = await this.client.post(`/resilience/chaos/experiments/${experimentId}/start`, runConfiguration);
    return response.data;
  }

  async stopChaosExperiment(experimentId: string, force?: boolean) {
    const response = await this.client.post(`/resilience/chaos/experiments/${experimentId}/stop`, { force });
    return response.data;
  }

  async pauseChaosExperiment(experimentId: string) {
    const response = await this.client.post(`/resilience/chaos/experiments/${experimentId}/pause`);
    return response.data;
  }

  async resumeChaosExperiment(experimentId: string) {
    const response = await this.client.post(`/resilience/chaos/experiments/${experimentId}/resume`);
    return response.data;
  }

  async getExperimentResults(experimentId: string, filters: {
    page?: number;
    limit?: number;
    timeframe?: string;
    metrics?: string[];
  } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, String(v)));
        } else {
          params.append(key, String(value));
        }
      }
    });

    const response = await this.client.get(`/resilience/chaos/experiments/${experimentId}/results?${params}`);
    return response.data;
  }

  async getChaosTemplates(filters: {
    category?: string;
    difficulty?: string;
    search?: string;
  } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/resilience/chaos/templates?${params}`);
    return response.data;
  }

  async getChaosTemplateById(templateId: string) {
    const response = await this.client.get(`/resilience/chaos/templates/${templateId}`);
    return response.data;
  }

  async createChaosTemplate(templateData: {
    name: string;
    description: string;
    category: string;
    difficulty: string;
    tags: string[];
    target: {
      type: string;
      recommendedComponents: string[];
    };
    configuration: {
      defaultDuration: number;
      defaultIntensity: number;
      adjustableParameters: Array<{
        name: string;
        type: string;
        defaultValue: any;
        min?: number;
        max?: number;
        description: string;
      }>;
    };
    safetyGuidelines: string[];
    expectedImpact: {
      description: string;
      affectedMetrics: string[];
      recoveryTime: string;
    };
  }) {
    const response = await this.client.post('/resilience/chaos/templates', templateData);
    return response.data;
  }

  async executeChaosTemplate(templateId: string, executionData: {
    name: string;
    target: {
      components: string[];
      region?: string;
    };
    configuration: Record<string, any>;
    safetyLimits?: Record<string, any>;
  }) {
    const response = await this.client.post(`/resilience/chaos/templates/${templateId}/execute`, executionData);
    return response.data;
  }

  async getResilienceRecommendations() {
    const response = await this.client.get('/resilience/recommendations');
    return response.data;
  }

  async getResilienceInsights(filters: {
    timeframe?: string;
    category?: string;
    severity?: string;
  } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/resilience/insights?${params}`);
    return response.data;
  }

  async getSystemComponents() {
    const response = await this.client.get('/resilience/components');
    return response.data;
  }

  async getComponentHealth(componentId: string) {
    const response = await this.client.get(`/resilience/components/${componentId}/health`);
    return response.data;
  }

  async getActiveChaosEvents() {
    const response = await this.client.get('/resilience/chaos/events/active');
    return response.data;
  }

  async acknowledgeChaosEvent(eventId: string) {
    const response = await this.client.post(`/resilience/chaos/events/${eventId}/acknowledge`);
    return response.data;
  }

  async getResilienceDashboard(timeframe: string = '24h') {
    const response = await this.client.get(`/resilience/dashboard?timeframe=${timeframe}`);
    return response.data;
  }

  async generateResilienceReport(filters: {
    startDate: string;
    endDate: string;
    includeExperiments?: boolean;
    includeMetrics?: boolean;
    format?: 'json' | 'pdf';
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const response = await this.client.get(`/resilience/reports/generate?${params}`);
    return response.data;
  }

  async getResilienceSettings() {
    const response = await this.client.get('/resilience/settings');
    return response.data;
  }

  async updateResilienceSetting(key: string, value: any) {
    const response = await this.client.put(`/resilience/settings/${key}`, { value });
    return response.data;
  }

  async validateChaosExperiment(experimentData: any) {
    const response = await this.client.post('/resilience/chaos/experiments/validate', experimentData);
    return response.data;
  }

  async getChaosExperimentPreview(experimentData: any) {
    const response = await this.client.post('/resilience/chaos/experiments/preview', experimentData);
    return response.data;
  }
}

// Create and export singleton instance
export const _adminApi = new AdminApiClient();

// Re-export with original name for compatibility
export const adminApi = _adminApi;
