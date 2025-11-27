// Authentication-related type definitions for ViralFX

import type { User } from './user.types';

export interface LoginRequest {
  email: string;
  password: string;
  twoFactorCode?: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  idNumber: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  nationality: string;
  employmentStatus: string;
  annualIncome: string;
  sourceOfFunds: string;
  tradingExperience: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PROFESSIONAL';
  riskDisclosure: boolean;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptRisk: boolean;
  acceptFSCA: boolean;
  marketingConsent?: boolean;
  referralCode?: string;
  brokerData?: {
    brokerId: string;
    accountNumber?: string;
    apiKey?: string;
    apiSecret?: string;
  };
}

export interface LoginResponse {
  user: User;
  tokens: TokenPair;
  requiresTwoFactor: boolean;
  permissions: string[];
  securitySettings: SecuritySettings;
}

export interface RegisterResponse {
  user: User;
  tokens: TokenPair;
  verificationEmailSent: boolean;
  welcomeMessage: string;
  nextSteps: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope: string[];
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  instructions: string[];
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  loginAlerts: boolean;
  sessionTimeout: number;
  maxConcurrentSessions: number;
  requireStrongPassword: boolean;
  passwordHistory: number;
  accountLockoutThreshold: number;
  accountLockoutDuration: number;
  biometricAuth: boolean;
  deviceTrustEnabled: boolean;
  ipWhitelist: string[];
  trustedDevices: DeviceInfo[];
  securityQuestions: SecurityQuestion[];
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'DESKTOP' | 'MOBILE' | 'TABLET';
  os: string;
  browser: string;
  ip: string;
  location?: {
    country: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  lastActiveAt: string;
  isTrusted: boolean;
  createdAt: string;
  fingerprint: string;
}

export interface SecurityQuestion {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  createdAt: string;
}

export interface OAuthProvider {
  id: string;
  name: string;
  displayName: string;
  type: 'GOOGLE' | 'APPLE' | 'FACEBOOK' | 'MICROSOFT';
  scopes: string[];
  clientId: string;
  isActive: boolean;
}

export interface SocialAccount {
  id: string;
  provider: string;
  providerId: string;
  providerAccountData: {
    id: string;
    email?: string;
    name?: string;
    avatar?: string;
    username?: string;
  };
  user: User;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string;
}

export interface KYCDocument {
  id: string;
  type: 'IDENTITY_PROOF' | 'ADDRESS_PROOF' | 'INCOME_PROOF' | 'SELFIE' | 'BUSINESS_REGISTRATION';
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  uploadedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  metadata: {
    checksum: string;
    virusScanStatus: 'CLEAN' | 'INFECTED' | 'PENDING';
    extractedText?: string;
    confidence?: number;
  };
}

export interface KYCStatus {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  level: 'BASIC' | 'ENHANCED' | 'PROFESSIONAL';
  documents: KYCDocument[];
  verificationDate?: string;
  expiryDate?: string;
  restrictions: string[];
  notes?: string;
  lastUpdated: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  loginAt: string;
  lastActivityAt: string;
  expiresAt: string;
  ipAddress: string;
  location?: string;
  userAgent: string;
  isActive: boolean;
  isCurrentSession: boolean;
}

export interface LoginAttempt {
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  timestamp: string;
  attemptCount: number;
  lockedUntil?: string;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  prohibitCommonPasswords: boolean;
  prohibitPersonalInfo: boolean;
  passwordHistory: number;
  requireRecentChange: boolean;
}

export interface UserProfile {
  id: string;
  userId: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  location?: string;
  website?: string;
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
  };
  preferences: {
    language: string;
    timezone: string;
    currency: string;
    theme: 'light' | 'dark' | 'auto';
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
      marketing: boolean;
      security: boolean;
      trading: boolean;
      promotions: boolean;
    };
    privacy: {
      showOnlineStatus: boolean;
      showLastSeen: boolean;
      showProfilePicture: boolean;
      allowDirectMessages: boolean;
      allowMessageRequests: boolean;
    };
    trading: {
      defaultCurrency: string;
      riskLevel: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
      defaultLeverage: number;
      notifications: {
        tradeConfirmation: boolean;
        priceAlerts: boolean;
        marginCalls: boolean;
        accountActivity: boolean;
      };
    };
  };
  achievements: Achievement[];
  statistics: {
    totalTrades: number;
    successfulTrades: number;
    totalVolume: number;
    totalPnL: number;
    winRate: number;
    avgHoldingPeriod: number;
    mostTradedAsset: string;
    riskScore: number;
  };
  verification: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    addressVerified: boolean;
    incomeVerified: boolean;
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'TRADING' | 'SOCIAL' | 'SECURITY' | 'LEARNING';
  icon: string;
  badgeUrl?: string;
  progress: {
    current: number;
    target: number;
    percentage: number;
  };
  unlockedAt?: string;
  isUnlocked: boolean;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
}

export interface Referral {
  id: string;
  code: string;
  referrerId: string;
  refereeId?: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  rewardType: 'CASH' | 'CREDIT' | 'DISCOUNT' | 'FEATURES';
  rewardAmount: number;
  rewardCurrency?: string;
  expiresAt: string;
  createdAt: string;
  completedAt?: string;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  loginAt: string;
  expiresAt: string;
  isActive: boolean;
  lastActivity: string;
  ipAddress: string;
  userAgent: string;
  location: {
    country?: string;
    city?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
  };
  trust: {
    level: 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH';
    score: number;
    factors: string[];
  };
}

export interface AuthenticationEvent {
  type: 'LOGIN' | 'LOGOUT' | 'REGISTER' | 'PASSWORD_CHANGE' | '2FA_ENABLE' | '2FA_DISABLE' | 'ACCOUNT_LOCK' | 'ACCOUNT_UNLOCK' | 'KYC_SUBMIT' | 'KYC_APPROVE' | 'KYC_REJECT';
  userId: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  success: boolean;
  details?: any;
  riskScore: number;
  requiresAction: boolean;
  actionRequired?: string;
}

export interface RiskAssessment {
  userId: string;
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: Array<{
    name: string;
    impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    score: number;
    description: string;
  }>;
  recommendations: string[];
  lastAssessment: string;
  nextReview: string;
}

export interface ComplianceStatus {
  kycStatus: KYCStatus;
  amlStatus: 'COMPLIANT' | 'UNDER_REVIEW' | 'FLAGGED' | 'SUSPENDED';
  fscaStatus: 'COMPLIANT' | 'REGISTERED' | 'EXEMPT' | 'NOT_APPLICABLE';
  regulatoryApprovals: Array<{
    authority: string;
    license: string;
    status: string;
    expiryDate?: string;
  }>;
  dataProtectionCompliance: {
    popiaCompliant: boolean;
    gdprCompliant: boolean;
    lastAudit: string;
    nextAudit: string;
  };
  riskManagement: {
    assessmentCompleted: boolean;
    riskScore: number;
    lastUpdated: string;
    nextReview: string;
  };
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}