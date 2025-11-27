export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  country: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  kycStatus: KycStatus;
  kycVerifiedAt?: string;
  isTwoFactorEnabled: boolean;
  avatarUrl?: string;
  referralCode?: string;
  referredBy?: string;
  lastLoginAt?: string;
  preferences: UserPreferences;
  riskScore: number;
  complianceScore: number;
  brokerId?: string;
  broker?: Broker;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  TRADER = 'TRADER',
  PREMIUM = 'PREMIUM',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum KycStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'af' | 'zu' | 'xh';
  currency: 'ZAR' | 'USD' | 'EUR' | 'BTC' | 'ETH';
  timezone: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
  notifications: NotificationPreferences;
  trading: TradingPreferences;
  privacy: PrivacyPreferences;
}

export interface NotificationPreferences {
  email: {
    orderConfirmations: boolean;
    priceAlerts: boolean;
    trendAlerts: boolean;
    marketingEmails: boolean;
    securityAlerts: boolean;
    weeklySummary: boolean;
    brokerUpdates: boolean;
    systemUpdates: boolean;
  };
  push: {
    orderConfirmations: boolean;
    priceAlerts: boolean;
    trendAlerts: boolean;
    securityAlerts: boolean;
    brokerUpdates: boolean;
  };
  sms: {
    securityAlerts: boolean;
    criticalAlerts: boolean;
  };
  inApp: {
    realTimeUpdates: boolean;
    soundEffects: boolean;
    desktopNotifications: boolean;
  };
  frequency: 'instant' | 'hourly' | 'daily';
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string;   // HH:mm format
    timezone: string;
  };
}

export interface TradingPreferences {
  defaultOrderType: 'MARKET' | 'LIMIT';
  confirmTrades: boolean;
  priceAlertSound: boolean;
  chartType: 'candlestick' | 'line' | 'area';
  defaultTimeframe: string;
  showProfitLoss: boolean;
  advancedMode: boolean;
}

export interface PrivacyPreferences {
  dataSharing: boolean;
  analyticsTracking: boolean;
  marketingConsent: boolean;
  brokerCommunication: boolean;
  publicProfile: boolean;
  showTradingActivity: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  country: string;
  referralCode?: string;
  brokerId?: string;
  agreeToTerms: boolean;
  agreeToPrivacy: boolean;
  ageConfirmation: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  country?: string;
  bio?: string;
  avatar?: File;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface TwoFactorSetupData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface Session {
  id: string;
  device: string;
  browser: string;
  os: string;
  ipAddress: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
  lastAccessAt: string;
}

export interface LoginHistory {
  id: string;
  ipAddress: string;
  location?: string;
  device: string;
  browser: string;
  success: boolean;
  createdAt: string;
  failureReason?: string;
}

export interface WalletSettings {
  defaultCurrency: string;
  withdrawalLimit: {
    daily: number;
    monthly: number;
  };
  autoWithdrawal: {
    enabled: boolean;
    threshold: number;
    method: string;
  };
  paymentMethods: PaymentMethod[];
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'crypto';
  provider: string;
  identifier: string; // Last 4 digits for cards, account number for banks, address for crypto
  brand?: string; // Visa, Mastercard, etc.
  expiryDate?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Re-use Broker type from broker.ts
import type { Broker } from './broker';

export interface UserStats {
  totalTrades: number;
  totalVolume: number;
  totalProfitLoss: number;
  winRate: number;
  averageTradeSize: number;
  riskScore: number;
  accountBalance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  deposits: number;
  withdrawals: number;
  netDeposits: number;
}

export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
  pendingEarnings: number;
  conversionRate: number;
  averageReferralValue: number;
  referrals: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
    createdAt: string;
    firstTradeAt?: string;
    totalTrades: number;
    totalVolume: number;
    commissionEarned: number;
  }>;
}

export interface ActivityLog {
  id: string;
  type: 'login' | 'trade' | 'deposit' | 'withdrawal' | 'kyc' | 'security' | 'settings';
  description: string;
  metadata?: Record<string, any>;
  ipAddress: string;
  location?: string;
  device: string;
  createdAt: string;
}