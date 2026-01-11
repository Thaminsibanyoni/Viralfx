export interface FSCAVerificationResponse {
  isValid: boolean;
  licenseStatus: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED' | 'PENDING_MANUAL_REVIEW';
  verificationDate: Date;
  expiryDate?: Date;
  restrictions?: string[];
  approvedInstruments?: string[];
  riskRating?: 'LOW' | 'MEDIUM' | 'HIGH';
  licenseType?: 'I' | 'II' | 'III';
  entityName?: string;
  registrationNumber?: string;
}

export interface ComplianceMonitoring {
  realtimeChecks: boolean;
  periodicReviews: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    enabled: boolean;
  };
  alertThresholds: {
    riskScore: number;
    apiErrors: number;
    volumeDrop: number;
    complianceScore: number;
  };
  requiredChecks: Array<'FSCA_LICENSE' | 'SANCTIONS_LIST' | 'ADVERSE_MEDIA' | 'FINANCIAL_HEALTH' | 'SECURITY_ASSESSMENT'>;
}

export interface IntegrationTestResult {
  success: boolean;
  errors?: string[];
  latency?: number;
  timestamp: Date;
  details?: {
    endpoint?: string;
    method?: string;
    responseCode?: number;
    responseTime?: number;
    testData?: Record<string, any>;
    validation?: {
      schemaValid: boolean;
      responseFormat: 'JSON' | 'XML' | 'OTHER';
      requiredFields: string[];
    };
  };
  metrics?: {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    dataFreshness: number;
  };
}

export interface BrokerDashboardMetrics {
  totalVolume: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  activeClients: {
    total: number;
    newThisMonth: number;
    churnRate: number;
    averageAccountSize: number;
  };
  apiUsage: {
    requestsToday: number;
    requestsThisMonth: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{
      endpoint: string;
      count: number;
    }>;
  };
  complianceScore: {
    overall: number;
    fscaStatus: string;
    lastCheck: Date;
    recommendations: string[];
    alerts: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      message: string;
      createdAt: Date;
    }>;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
    status: string;
  }>;
  financialMetrics: {
    revenueThisMonth: number;
    feesThisMonth: number;
    averageCommission: number;
    profitMargin: number;
  };
  performanceMetrics: {
    uptime: number;
    systemHealth: number;
    orderExecutionTime: number;
    settlementTime: number;
  };
}

export interface BrokerAnalytics {
  id: string;
  brokerId: string;
  period: {
    start: Date;
    end: Date;
  };
  volumeMetrics: {
    totalVolume: number;
    tradeCount: number;
    averageTradeSize: number;
    volumeByMarket: Record<string, number>;
    volumeByInstrument: Record<string, number>;
  };
  clientMetrics: {
    newClients: number;
    activeClients: number;
    clientRetentionRate: number;
    clientAcquisitionCost: number;
    averageClientLifetime: number;
  };
  revenueMetrics: {
    grossRevenue: number;
    netRevenue: number;
    commissionRevenue: number;
    feeRevenue: number;
    otherRevenue: number;
    revenueBySource: Record<string, number>;
  };
  operationalMetrics: {
    apiRequests: number;
    apiErrors: number;
    averageResponseTime: number;
    systemUptime: number;
    supportTickets: number;
    ticketResolutionTime: number;
  };
  complianceMetrics: {
    complianceScore: number;
    violations: number;
    auditFailures: number;
    rectificationTime: number;
  };
}

export interface BrokerFilterOptions {
  status?: string[];
  tier?: string[];
  verified?: boolean;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'volume' | 'complianceScore';
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface BrokerStats {
  totalBrokers: number;
  activeBrokers: number;
  verifiedBrokers: number;
  totalVolume: number;
  totalRevenue: number;
  averageComplianceScore: number;
  brokersByTier: Record<string, number>;
  brokersByStatus: Record<string, number>;
  newBrokersThisMonth: number;
  growthRate: number;
}

export interface ApiUsageMetrics {
  brokerId: string;
  date: Date;
  endpoint: string;
  method: string;
  requestCount: number;
  averageResponseTime: number;
  errorCount: number;
  errorRate: number;
  peakHour?: number;
  topErrorCodes?: Array<{
    code: number;
    count: number;
  }>;
}

export interface MarketingMetrics {
  brokerId: string;
  date: Date;
  profileViews: number;
  contactClicks: number;
  websiteClicks: number;
  referralsSent: number;
  referralsConverted: number;
  referralRevenue: number;
  conversionRate: number;
  averageRating: number;
  reviewCount: number;
  searchRanking?: number;
  socialMediaMentions?: number;
}

export interface ComplianceAlert {
  id: string;
  brokerId: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: Record<string, any>;
  recommendations: string[];
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED';
}

export interface OAuthConfig {
  provider: 'GOOGLE' | 'APPLE' | 'CUSTOM';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
  codeVerifier?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

export interface IntegrationConfig {
  type: 'REST_API' | 'WEBSOCKET' | 'WEBHOOK' | 'SDK';
  name: string;
  description?: string;
  baseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  version?: string;
  timeout?: number;
  retryAttempts?: number;
  headers?: Record<string, string>;
  webhookUrl?: string;
  events?: string[];
  scopes?: string[];
  customSettings?: Record<string, any>;
}
