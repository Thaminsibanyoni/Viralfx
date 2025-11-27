// Main Interfaces for SuperAdmin System

export interface AdminTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface JwtPayload {
  sub: string; // admin ID
  email: string;
  type: 'admin';
  iat: number;
  exp?: number;
}

export interface DashboardMetrics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalBrokers: number;
    activeBrokers: number;
    marketVolume: number;
    oracleHealth: number;
    nodeUptime: number;
    paymentRevenue: number;
    systemAlerts: number;
    abuseDetections: number;
    riskScore: number;
    predictedVolume?: number;
    riskProbability?: number;
    capacityUtilization?: number;
    complianceScore?: number;
    anomalyCount?: number;
    performanceScore?: number;
  };
  departments: {
    userOps: {
      pendingTasks: number;
      criticalIssues: number;
      newRegistrations?: number;
      kycCompletions?: number;
      activeTraders?: number;
    };
    brokerOps: {
      pendingApplications: number;
      complianceIssues: number;
      activeBrokers?: number;
      totalVolume?: number;
      fscaComplianceRate?: number;
    };
    trendOps: {
      activeTrends: number;
      pendingReviews: number;
      viralAlerts?: number;
      contentAccuracy?: number;
      regionalSpikes?: number;
    };
    riskOps: {
      highRiskAlerts: number;
      contentReviews: number;
      blockedContent?: number;
      falsePositives?: number;
      securityThreats?: number;
    };
    financeOps: {
      pendingPayouts: number;
      revenueMetrics: {
        daily?: number;
        weekly?: number;
        monthly?: number;
        growth?: number;
      };
      transactionVolume?: number;
      successRate?: number;
    };
    techOps: {
      systemHealth: number;
      activeNodes: number;
      apiLatency?: number;
      errorRate?: number;
      memoryUsage?: number;
      cpuUsage?: number;
    };
  };
}

export interface PredictiveInsight {
  id: string;
  category: 'OPERATIONAL' | 'SECURITY' | 'COMPLIANCE' | 'FINANCIAL' | 'MARKET';
  title: string;
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  probability: number; // 0-100
  timeframe: string; // e.g., '24h', '7d'
  confidence: number; // 0-100
  mitigationSteps: string[];
  autoMitigation: boolean;
  relatedAssets: string[];
  createdAt: Date;
  status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
}

export interface RiskAssessment {
  overallScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  insights: PredictiveInsight[];
  trends: {
    direction: 'IMPROVING' | 'STABLE' | 'DECLINING';
    change: number;
    period: string;
  };
  recommendations: string[];
  categoryScores: {
    compliance: number;
    security: number;
    operational: number;
    financial: number;
    regulatory: number;
  };
}

export interface SystemAlert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  department?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  isResolved: boolean;
  metadata: Record<string, any>;
  requiresAction: boolean;
  actionTaken?: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING';
  kycStatus: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  balanceUsd: number;
  createdAt: Date;
  lastLoginAt?: Date;
  riskScore: number;
  behaviorPattern?: {
    loginFrequency: number;
    accessPatterns: string[];
    riskTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    anomalyScore: number;
    predictedActions: string[];
  };
  predictiveFlags?: Array<{
    type: string;
    severity: string;
    probability: number;
    timeHorizon: number;
    mitigation: string[];
    autoActionable: boolean;
  }>;
  ipAddress?: string;
  deviceFingerprint?: string;
  country?: string;
  registrationSource?: string;
  referralCode?: string;
  referralEarnings?: number;
  tradingVolume?: number;
  orderCount?: number;
  lastTradeAt?: Date;
  supportTickets?: number;
  complaints?: number;
}

export interface Broker {
  id: string;
  name: string;
  email: string;
  logo?: string;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  fscaLicense?: string;
  fscaExpiry?: Date;
  complianceScore: number;
  createdAt: Date;
  tradingVolume: number;
  activeTraders: number;
  totalRevenue: number;
  monthlyRevenue?: number;
  commissionRate?: number;
  supportRating?: number;
  apiAccess?: boolean;
  marketingMaterials?: string[];
  documents?: {
    fscaLicense?: string;
    proofOfAddress?: string;
    companyRegistration?: string;
    directorsID?: string[];
  };
  complianceFlags?: string[];
  lastAuditAt?: Date;
  nextAuditDue?: Date;
  suspensionHistory?: Array<{
    reason: string;
    suspendedAt: Date;
    suspendedBy: string;
    resolvedAt?: Date;
    resolvedBy?: string;
  }>;
  contactInfo?: {
    phone?: string;
    address?: string;
    website?: string;
  };
  integrationStatus?: {
    api?: string;
    trading?: string;
    compliance?: string;
  };
}

export interface Trend {
  id: string;
  title: string;
  description?: string;
  category: string;
  tags: string[];
  region: string;
  status: 'ACTIVE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
  viralityScore: number;
  volume: number;
  velocity: number;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  createdAt: Date;
  updatedAt?: Date;
  expiresAt?: Date;
  sourceCount: number;
  engagementMetrics?: {
    likes: number;
    shares: number;
    comments: number;
    mentions: number;
  };
  demographicBreakdown?: {
    ageGroups: Record<string, number>;
    gender: Record<string, number>;
    regions: Record<string, number>;
  };
  contentFlags?: Array<{
    type: string;
    severity: string;
    detectedAt: Date;
    resolvedAt?: Date;
  }>;
  relatedTrends?: string[];
  predictions?: {
    viralPotential: number;
    peakTime?: Date;
    duration?: number;
    geographicSpread?: string[];
  };
}

export interface AuditLogEntry {
  id: string;
  adminId?: string;
  admin?: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  action: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  targetType: string;
  targetId: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requiresReview: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  isAutomatedAction: boolean;
  description?: string;
  createdAt: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface QueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  startDate?: Date;
  endDate?: Date;
  status?: string | string[];
  category?: string | string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

// WebSocket Events
export interface WebSocketEvents {
  // Dashboard events
  dashboard_update: { data: Partial<DashboardMetrics>; timestamp: Date };
  department_update: { department: string; data: any; timestamp: Date };

  // Alert events
  alert: SystemAlert;
  critical_alert: SystemAlert;

  // Department-specific events
  user_activity: { activity: any; timestamp: Date };
  broker_activity: { activity: any; timestamp: Date };
  trend_update: { trend: Partial<Trend>; timestamp: Date };
  risk_alert: { alert: any; timestamp: Date };
  system_status: { status: any; timestamp: Date };
  finance_update: { update: any; timestamp: Date };

  // Connection events
  connected: { clientId: string; adminId: string; timestamp: Date };
  disconnected: { clientId: string; timestamp: Date };
  connected_admins: { count: number; timestamp: Date };

  // Error events
  error: { message: string; code?: string; timestamp: Date };
}

// Permission checks
export interface PermissionCheck {
  resource: string;
  action: string;
  conditions?: Record<string, any>[];
}

export interface RolePermission {
  role: string;
  permissions: string[];
  description?: string;
}

// Department configuration
export interface DepartmentConfig {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  parentDepartment?: string;
  childDepartments?: string[];
  metrics: {
    keyPerformanceIndicators: string[];
    alertThresholds: Record<string, number>;
  };
  settings: {
    autoApproval: boolean;
    escalationRules: string[];
    notificationPreferences: Record<string, boolean>;
  };
}