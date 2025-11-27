// Enums
export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  USER_OPS = 'USER_OPS',
  BROKER_OPS = 'BROKER_OPS',
  TREND_OPS = 'TREND_OPS',
  RISK_OPS = 'RISK_OPS',
  FINANCE_OPS = 'FINANCE_OPS',
  SUPPORT_OPS = 'SUPPORT_OPS',
  TECH_OPS = 'TECH_OPS',
  CONTENT_OPS = 'CONTENT_OPS',
  DEPARTMENT_HEAD = 'DEPARTMENT_HEAD',
}

export enum AdminStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  LOCKED = 'LOCKED',
}

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  USER_SUSPEND = 'USER_SUSPEND',
  USER_UNSUSPEND = 'USER_UNSUSPEND',
  USER_BAN = 'USER_BAN',
  USER_UNBAN = 'USER_UNBAN',
  BROKER_APPROVE = 'BROKER_APPROVE',
  BROKER_SUSPEND = 'BROKER_SUSPEND',
  TREND_APPROVE = 'TREND_APPROVE',
  TREND_OVERRIDE = 'TREND_OVERRIDE',
  TREND_PAUSE = 'TREND_PAUSE',
  TREND_RESUME = 'TREND_RESUME',
  SYSTEM_ACTION = 'SYSTEM_ACTION',
  PLATFORM_SETTING_CHANGE = 'PLATFORM_SETTING_CHANGE',
  NOTIFICATION_SEND = 'NOTIFICATION_SEND',
  ADMIN_CREATED = 'ADMIN_CREATED',
  ADMIN_UPDATED = 'ADMIN_UPDATED',
  ADMIN_DELETED = 'ADMIN_DELETED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum PermissionCategory {
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  BROKER_MANAGEMENT = 'BROKER_MANAGEMENT',
  TREND_MANAGEMENT = 'TREND_MANAGEMENT',
  RISK_MANAGEMENT = 'RISK_MANAGEMENT',
  FINANCE_MANAGEMENT = 'FINANCE_MANAGEMENT',
  PLATFORM_MANAGEMENT = 'PLATFORM_MANAGEMENT',
  NOTIFICATION_MANAGEMENT = 'NOTIFICATION_MANAGEMENT',
  SYSTEM_MANAGEMENT = 'SYSTEM_MANAGEMENT',
  AUDIT_MANAGEMENT = 'AUDIT_MANAGEMENT',
  ADMIN_MANAGEMENT = 'ADMIN_MANAGEMENT',
}

// Base interfaces
export interface AdminPermission {
  id: string;
  name: string;
  description: string;
  category: PermissionCategory;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: AuditAction;
  severity: AuditSeverity;
  targetType: string;
  targetId: string;
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  description: string;
  createdAt: Date;
  admin?: AdminUser;
}

export interface AdminSession {
  id: string;
  adminId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  isActive: boolean;
  deviceFingerprint?: string;
  ipAddress: string;
  userAgent?: string;
  createdAt: Date;
  lastUsedAt: Date;
}

// Main interfaces
export interface AdminUser {
  id: string;
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  department?: string;
  status: AdminStatus;
  permissions: string[];
  isSuperAdmin: boolean;
  twoFactorEnabled: boolean;
  ipWhitelist?: string[];
  jurisdictionClearance: string[];
  lastLoginAt?: Date;
  emailVerifiedAt: Date;
  avatar?: string;
  phone?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Dashboard types
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
    systemHealth: number;
  };
  departments: {
    userOps: {
      pendingTasks: number;
      criticalIssues: number;
    };
    brokerOps: {
      pendingApplications: number;
      complianceIssues: number;
    };
    trendOps: {
      activeTrends: number;
      pendingReviews: number;
    };
    riskOps: {
      highRiskAlerts: number;
      contentReviews: number;
    };
    financeOps: {
      pendingPayouts: number;
      revenueMetrics: any;
    };
    techOps: {
      systemHealth: number;
      activeNodes: number;
    };
  };
}

export interface SystemAlert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  category: string;
}

// User management types
export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING_VERIFICATION';
  kycStatus: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  balanceUsd: number;
  balanceZar: number;
  country?: string;
  phone?: string;
  avatar?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  riskScore: number;
  ipAddress?: string;
}

export interface UserFilters {
  page: number;
  limit: number;
  status?: string;
  kycStatus?: string;
  search?: string;
  country?: string;
  riskScoreMin?: number;
  riskScoreMax?: number;
  registrationDateFrom?: Date;
  registrationDateTo?: Date;
}

// Broker management types
export interface Broker {
  id: string;
  name: string;
  email: string;
  status: 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED';
  tier: 'STARTER' | 'VERIFIED' | 'PREMIUM' | 'ENTERPRISE';
  fscaLicense?: string;
  fscaVerified: boolean;
  registrationNumber?: string;
  tradingVolume: number;
  complianceScore: number;
  commissionRate: number;
  totalClients: number;
  activeClients: number;
  website?: string;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrokerFilters {
  page: number;
  limit: number;
  status?: string;
  tier?: string;
  search?: string;
  fscaVerified?: boolean;
  minClients?: number;
  maxClients?: number;
}

// Finance management types
export interface Transaction {
  id: string;
  userId?: string;
  brokerId?: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'BET_STAKE' | 'BET_PAYOUT';
  amountUsd?: number;
  amountZar?: number;
  currency: 'USD' | 'ZAR';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  paymentMethod?: string;
  reference?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  brokerId: string;
  period: string;
  commission: number;
  fees: number;
  total: number;
  currency: 'USD' | 'ZAR';
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: Date;
  paidAt?: Date;
  createdAt: Date;
  broker?: Broker;
}

export interface Payout {
  id: string;
  brokerId: string;
  amount: number;
  currency: 'USD' | 'ZAR';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  bankDetails?: Record<string, any>;
  reference?: string;
  createdAt: Date;
  processedAt?: Date;
}

// Trend management types
export interface Trend {
  id: string;
  symbol: string;
  title: string;
  alias?: string;
  category: string;
  region: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  viralityScore: number;
  sentimentScore: number;
  volume: number;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface VTSSymbol {
  id: string;
  symbol: string;
  title: string;
  alias: string;
  category: string;
  region: string;
  status: 'ACTIVE' | 'FROZEN' | 'ARCHIVED';
  viralityScore: number;
  version: number;
  usage: {
    bets: number;
    watchlists: number;
    marketOrders: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Risk management types
export interface RiskAlert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  userId?: string;
  contentId?: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  metadata?: Record<string, any>;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface HarmfulContent {
  id: string;
  content: string;
  type: 'FAKE_NEWS' | 'VIOLENCE' | 'HATE_SPEECH' | 'MISINFORMATION' | 'SPAM';
  platform: string;
  reporter?: string;
  status: 'FLAGGED' | 'PENDING_REVIEW' | 'APPROVED' | 'BLOCKED' | 'FALSE_POSITIVE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Oracle management types
export interface OracleNode {
  id: string;
  nodeId: string;
  endpoint: string;
  region: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'SUSPENDED' | 'DECOMMISSIONED';
  reputation: number;
  uptimePercentage: number;
  lastSeen: Date;
  publicKey: string;
  version: string;
  performance: {
    recentRequests: number;
    averageResponseTime: number;
    consensusScore: number;
  };
  totalRequests: number;
  totalResponses: number;
  responseRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OracleRequest {
  id: string;
  topicId: string;
  dataType: string;
  parameters: Record<string, any>;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  consensusLevel: number;
  finalResult?: any;
  requestedAt: Date;
  completedAt?: Date;
  processingTime?: number;
  totalResponses: number;
  validResponses: number;
  averageResponseTime: number;
  topic?: {
    id: string;
    symbol: string;
    title: string;
  };
}

// Platform settings types
export interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  updatedBy: string;
  updatedAt: Date;
}

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
}

export interface BrandingSettings {
  logoLight: string;
  logoDark: string;
  primaryColor: string;
  accentColor: string;
  notificationTemplates: Record<string, any>;
}

// Notification management types
export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  channels: string[];
  subject: string;
  content: string;
  variables: string[];
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationHistory {
  id: string;
  type: 'BROADCAST' | 'SEGMENT' | 'USER' | 'TEST' | 'SCHEDULED';
  title: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  channels: string[];
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  recipientCount: number;
  sentCount: number;
  scheduledFor?: Date;
  sentAt?: Date;
  createdAt: Date;
  creator: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface DeliveryLog {
  id: string;
  notificationId: string;
  userId: string;
  channel: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'OPENED' | 'CLICKED';
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  error?: string;
  responseTime?: number;
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

// API Request/Response types
export interface AdminLoginRequest {
  email: string;
  password: string;
  twoFactorCode?: string;
  deviceFingerprint?: string;
}

export interface AdminLoginResponse {
  admin: AdminUser;
  permissions: string[];
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface CreateAdminRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  department?: string;
  permissionIds?: string[];
}

export interface UpdateAdminRequest {
  firstName?: string;
  lastName?: string;
  role?: AdminRole;
  status?: AdminStatus;
  department?: string;
  permissionIds?: string[];
}

export interface GetUsersRequest {
  page: number;
  limit: number;
  status?: string;
  kycStatus?: string;
  search?: string;
}

export interface GetUsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Utility types
export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ApiResponse<T = any> = {
  data: T;
  message?: string;
  success: boolean;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
  read: boolean;
  metadata?: Record<string, any>;
};

export type WebSocketMessage = {
  type: string;
  payload: any;
  timestamp: string;
};

export type PermissionCheck = (permission: string) => boolean;
export type RoleCheck = (role: AdminRole) => boolean;

// Chart data types
export type ChartDataPoint = {
  timestamp: string;
  value: number;
  label?: string;
};

export type MetricsData = {
  total: number;
  growth: number;
  trend: 'up' | 'down' | 'stable';
  timeframe: string;
};

// Form types
export interface UserFormData {
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
}

export interface BrokerFormData {
  name: string;
  email: string;
  registrationNumber: string;
  fscaLicense?: string;
  tier: string;
  website?: string;
  phone?: string;
  address?: string;
}

export interface NotificationFormData {
  title: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  channels: string[];
  templateId?: string;
  variables?: Record<string, any>;
}

// Filter and search types
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SearchFilters {
  query?: string;
  status?: string[];
  category?: string[];
  dateRange?: DateRange;
}

// Export all types for easy importing
export * from './user.types';
export * from './broker';
export * from './notification.types';