// User entity import removed - using Prisma directly;
// KYCDocument entity removed;
// UserProfile entity removed;

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  preferences?: UserPreferences;
  isActive: boolean;
  isVerified: boolean;
  isDeleted: boolean;
  kycStatus?: KYCStatus;
  referralCode?: string;
  referredBy?: string;
  suspensionReason?: string;
  suspendedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  role?: UserRole;
  permissions?: string[];
}

export interface UserPreferences {
  language: string;
  timezone: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
  twoFactorEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  privacy: {
    profileVisibility: 'public' | 'private' | 'friends';
    showEmail: boolean;
    showRealName: boolean;
  };
  trading: {
    defaultCurrency: string;
    riskLevel: 'conservative' | 'moderate' | 'aggressive';
    autoInvest: boolean;
    priceAlerts: boolean;
  };
}

export interface UserProfile {
  userId: string;
  bio?: string;
  location?: string;
  website?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    youtube?: string;
  };
  interests: string[];
  skills: string[];
  experience?: {
    company: string;
    position: string;
    startDate: Date;
    endDate?: Date;
    description?: string;
  }[];
  education?: {
    institution: string;
    degree: string;
    field: string;
    startDate: Date;
    endDate?: Date;
  }[];
  verified: boolean;
  verificationDate?: Date;
  profileViews: number;
  followersCount: number;
  followingCount: number;
}

export interface UserKYC {
  userId: string;
  status: KYCStatus;
  documents: KYCDocument[];
  verifiedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  verificationLevel: 'basic' | 'enhanced' | 'pro';
  nextReviewDate?: Date;
  riskScore: number;
  complianceFlags: string[];
}

export interface KYCDocument {
  id: string;
  type: 'passport' | 'driver_license' | 'national_id' | 'proof_of_address' | 'selfie' | 'other';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  url: string;
  hash: string;
  extractedData?: Record<string, any>;
  uploadedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  expiresAt?: Date;
  notes?: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  location?: {
    country: string;
    city: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  sessionId?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  refreshToken?: string;
  isActive: boolean;
  deviceInfo: {
    type: 'mobile' | 'desktop' | 'tablet';
    os: string;
    browser?: string;
    appVersion?: string;
  };
  ipAddress: string;
  location?: {
    country: string;
    city: string;
  };
  lastAccessAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface UserSecurity {
  userId: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  backupCodes?: string[];
  trustedDevices: TrustedDevice[];
  securityQuestions: SecurityQuestion[];
  loginAttempts: number;
  lockedUntil?: Date;
  lastPasswordChange: Date;
  passwordStrength: number;
  breachAlerts: BreachAlert[];
}

export interface TrustedDevice {
  id: string;
  name: string;
  fingerprint: string;
  userAgent: string;
  ipAddress: string;
  trustedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface SecurityQuestion {
  question: string;
  answerHash: string;
  createdAt: Date;
}

export interface BreachAlert {
  id: string;
  source: string;
  detectedAt: Date;
  resolvedAt?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendations: string[];
}

export interface UserAnalytics {
  userId: string;
  timeframe: {
    start: Date;
    end: Date;
  };
  engagement: {
    loginFrequency: number;
    averageSessionDuration: number;
    pageViews: number;
    interactions: number;
    lastActivity: Date;
  };
  performance: {
    totalInvested: number;
    currentValue: number;
    totalReturns: number;
    winRate: number;
    riskScore: number;
  };
  behavior: {
    preferredMarkets: string[];
    tradingFrequency: number;
    averagePositionSize: number;
    mostActiveHours: number[];
  };
}

export interface UserFilter {
  status?: ('active' | 'inactive' | 'suspended' | 'deleted')[];
  role?: string[];
  kycStatus?: KYCStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  country?: string[];
  hasReferralCode?: boolean;
  minLoginDate?: Date;
  maxLoginDate?: Date;
  isVerified?: boolean;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'username' | 'email';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export type UserRole = 'user' | 'admin' | 'moderator' | 'broker' | 'analyst' | 'support';
export type KYCStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'expired';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'deleted';

export interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  newUsersThisMonth: number;
  usersByCountry: Record<string, number>;
  usersByRole: Record<UserRole, number>;
  usersByKYCStatus: Record<KYCStatus, number>;
  averageSessionDuration: number;
  retentionRate: number;
  churnRate: number;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'marketing';
  channel: 'email' | 'push' | 'in_app' | 'sms';
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledFor?: Date;
  sentAt?: Date;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}