import axios, { AxiosInstance, AxiosResponse } from 'axios';

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

// Financial Reporting Types
export interface MRRData {
  total: number;
  byTier: Record<string, number>;
  components: {
    baseFee: number;
    transactionFees: number;
    additionalServices: number;
  };
}

export interface MRRGrowth {
  currentPeriod: number;
  previousPeriod: number;
  growthRate: number;
  monthlyData: Array<{
    month: string;
    mrr: number;
    growth: number;
  }>;
}

export interface MRRByTier {
  tiers: Record<string, number>;
  percentages: Record<string, number>;
  total: number;
}

export interface MRRChurn {
  churnedMRR: number;
  churnRate: number;
  churnedBrokers: number;
  details: Array<{
    brokerId: string;
    brokerName: string;
    mrrAmount: number;
    churnReason?: string;
  }>;
}

export interface NewMRR {
  newMRR: number;
  newBrokers: number;
  averageMRRPerBroker: number;
  details: Array<{
    brokerId: string;
    brokerName: string;
    mrrAmount: number;
    tier: string;
  }>;
}

export interface ExpansionMRR {
  expansionMRR: number;
  expansionBrokers: number;
  details: Array<{
    brokerId: string;
    brokerName: string;
    oldMRR: number;
    newMRR: number;
    expansionAmount: number;
    tier: string;
  }>;
}

export interface NRRData {
  total: number;
  byTier: Record<string, number>;
  components: {
    baseFee: number;
    transactionFees: number;
    additionalServices: number;
    upgrades: number;
    crossSells: number;
  };
}

export interface CohortAnalysis {
  cohorts: Array<{
    cohort: string;
    period: string;
    customers: number;
    revenue: number;
    retentionRate: number;
    churnRate: number;
  }>;
  summary: {
    averageRetentionRate: number;
    averageChurnRate: number;
    totalCohorts: number;
  };
}

export interface RevenueAnalytics {
  overview: {
    totalRevenue: number;
    mrr: number;
    arr: number;
    growthRate: number;
    churnRate: number;
  };
  trends: {
    monthlyRevenue: Array<{
      month: string;
      revenue: number;
      mrr: number;
      arr: number;
    }>;
    growth: Array<{
      period: string;
      revenueGrowth: number;
      mrrGrowth: number;
      arrGrowth: number;
    }>;
  };
  breakdown: {
    byTier: Record<string, number>;
    bySource: Record<string, number>;
    byRegion: Record<string, number>;
  };
}

export interface FinancialDashboard {
  overview: {
    totalRevenue: number;
    mrr: number;
    nrr: number;
    arr: number;
    growthRate: number;
    churnRate: number;
    ltv: number;
    cac: number;
    ltvCacRatio: number;
  };
  revenue: {
    current: number;
    previous: number;
    growth: number;
    forecast: number;
    byTier: Record<string, number>;
  };
  subscriptions: {
    active: number;
    new: number;
    churned: number;
    expansion: number;
    netGrowth: number;
  };
  metrics: {
    mrr: MRRData;
    nrr: NRRData;
    churn: MRRChurn;
    ltv: number;
    cac: number;
  };
}

export interface FinancialFilters {
  startDate?: string;
  endDate?: string;
  period?: string;
  tier?: string;
  brokerId?: string;
}

// Financial Reporting API Client
class FinancialReportingClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
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
        const token = localStorage.getItem('access_token');
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
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Dashboard
  async getDashboard(filters?: FinancialFilters): Promise<ApiResponse<FinancialDashboard>> {
    const response = await this.client.get('/financial-reporting/dashboard', { params: filters });
    return response.data;
  }

  // MRR (Monthly Recurring Revenue)
  async calculateMRR(date: string): Promise<ApiResponse<MRRData>> {
    const response = await this.client.get('/financial-reporting/mrr', { params: { date } });
    return response.data;
  }

  async getMRRGrowth(startDate: string, endDate: string): Promise<ApiResponse<MRRGrowth>> {
    const response = await this.client.get('/financial-reporting/mrr/growth', {
      params: { startDate, endDate }
    });
    return response.data;
  }

  async getMRRByTier(): Promise<ApiResponse<MRRByTier>> {
    const response = await this.client.get('/financial-reporting/mrr/by-tier');
    return response.data;
  }

  async getMRRChurn(month: string): Promise<ApiResponse<MRRChurn>> {
    const response = await this.client.get('/financial-reporting/mrr/churn', { params: { month } });
    return response.data;
  }

  async getNewMRR(month: string): Promise<ApiResponse<NewMRR>> {
    const response = await this.client.get('/financial-reporting/mrr/new', { params: { month } });
    return response.data;
  }

  async getExpansionMRR(month: string): Promise<ApiResponse<ExpansionMRR>> {
    const response = await this.client.get('/financial-reporting/mrr/expansion', { params: { month } });
    return response.data;
  }

  // NRR (Net Revenue Retention)
  async calculateNRR(date: string): Promise<ApiResponse<NRRData>> {
    const response = await this.client.get('/financial-reporting/nrr', { params: { date } });
    return response.data;
  }

  async getNRRGrowth(startDate: string, endDate: string): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/nrr/growth', {
      params: { startDate, endDate }
    });
    return response.data;
  }

  async getNRRByTier(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/nrr/by-tier');
    return response.data;
  }

  // Cohort Analysis
  async getCohortAnalysis(filters: {
    startDate?: string;
    endDate?: string;
    period?: string;
  } = {}): Promise<ApiResponse<CohortAnalysis>> {
    const response = await this.client.get('/financial-reporting/cohort-analysis', { params: filters });
    return response.data;
  }

  async getCohortMetrics(cohort: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/financial-reporting/cohort-analysis/${cohort}/metrics`);
    return response.data;
  }

  async getCohortComparison(cohorts: string[]): Promise<ApiResponse<any>> {
    const response = await this.client.post('/financial-reporting/cohort-analysis/compare', { cohorts });
    return response.data;
  }

  // Revenue Analytics
  async getRevenueAnalytics(filters?: FinancialFilters): Promise<ApiResponse<RevenueAnalytics>> {
    const response = await this.client.get('/financial-reporting/revenue-analytics', { params: filters });
    return response.data;
  }

  async getRevenueByPeriod(period: string): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/revenue-analytics/by-period', {
      params: { period }
    });
    return response.data;
  }

  async getRevenueByTier(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/revenue-analytics/by-tier');
    return response.data;
  }

  async getRevenueBySource(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/revenue-analytics/by-source');
    return response.data;
  }

  async getRevenueForecast(periodMonths: number = 12): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/revenue-analytics/forecast', {
      params: { periodMonths }
    });
    return response.data;
  }

  // Advanced Analytics
  async getCustomerLifetimeValue(filters?: FinancialFilters): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/lifetime-value', { params: filters });
    return response.data;
  }

  async getCustomerAcquisitionCost(filters?: FinancialFilters): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/acquisition-cost', { params: filters });
    return response.data;
  }

  async getPaybackPeriod(filters?: FinancialFilters): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/payback-period', { params: filters });
    return response.data;
  }

  async getUnitEconomics(filters?: FinancialFilters): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/unit-economics', { params: filters });
    return response.data;
  }

  // Reporting
  async generateFinancialReport(reportConfig: {
    type: 'monthly' | 'quarterly' | 'annual' | 'custom';
    startDate: string;
    endDate: string;
    includeSections: string[];
    format: 'json' | 'pdf' | 'excel';
  }): Promise<ApiResponse<any>> {
    const response = await this.client.post('/financial-reporting/reports/generate', reportConfig);
    return response.data;
  }

  async getFinancialReports(filters?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<ApiResponse<PaginatedResponse<any>>> {
    const response = await this.client.get('/financial-reporting/reports', { params: filters });
    return response.data;
  }

  async getFinancialReportById(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/financial-reporting/reports/${id}`);
    return response.data;
  }

  async exportFinancialReport(id: string, format: 'pdf' | 'excel' | 'csv'): Promise<ApiResponse<string>> {
    const response = await this.client.get(`/financial-reporting/reports/${id}/export`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }

  // Metrics & KPIs
  async getHealthMetrics(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/metrics/health');
    return response.data;
  }

  async getGrowthMetrics(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/metrics/growth', {
      params: { period }
    });
    return response.data;
  }

  async getEfficiencyMetrics(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/metrics/efficiency', {
      params: { period }
    });
    return response.data;
  }

  async getProfitabilityMetrics(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/metrics/profitability', {
      params: { period }
    });
    return response.data;
  }

  // Benchmarking
  async getIndustryBenchmarks(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/benchmarks/industry');
    return response.data;
  }

  async getCompetitorComparison(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/benchmarks/competitors');
    return response.data;
  }

  // Alerts & Notifications
  async getFinancialAlerts(filters?: {
    type?: string;
    severity?: string;
    status?: string;
  }): Promise<ApiResponse<any[]>> {
    const response = await this.client.get('/financial-reporting/alerts', { params: filters });
    return response.data;
  }

  async createFinancialAlert(alertData: {
    type: string;
    name: string;
    description: string;
    threshold: number;
    condition: string;
    recipients: string[];
  }): Promise<ApiResponse<any>> {
    const response = await this.client.post('/financial-reporting/alerts', alertData);
    return response.data;
  }

  async updateFinancialAlert(id: string, alertData: Partial<any>): Promise<ApiResponse<any>> {
    const response = await this.client.put(`/financial-reporting/alerts/${id}`, alertData);
    return response.data;
  }

  async deleteFinancialAlert(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/financial-reporting/alerts/${id}`);
    return response.data;
  }

  // Data Export
  async exportData(config: {
    type: 'mrr' | 'nrr' | 'revenue' | 'customers' | 'all';
    format: 'csv' | 'json' | 'excel';
    startDate: string;
    endDate: string;
    filters?: Record<string, any>;
  }): Promise<ApiResponse<string>> {
    const response = await this.client.post('/financial-reporting/export', config, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Settings & Configuration
  async getFinancialSettings(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/financial-reporting/settings');
    return response.data;
  }

  async updateFinancialSettings(settings: {
    currency: string;
    reportingPeriod: string;
    fiscalYearStart: string;
    timezone: string;
    metrics: Record<string, boolean>;
  }): Promise<ApiResponse<any>> {
    const response = await this.client.put('/financial-reporting/settings', settings);
    return response.data;
  }
}

// Export singleton instance
export const financialReportingApi = new FinancialReportingClient();
export default financialReportingApi;