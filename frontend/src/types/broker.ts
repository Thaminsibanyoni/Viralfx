export enum BrokerTier {
  STARTER = 'STARTER',
  VERIFIED = 'VERIFIED',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
}

export enum BrokerStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum BrokerType {
  FINANCIAL_INSTITUTION = 'FINANCIAL_INSTITUTION',
  INDEPENDENT_BROKER = 'INDEPENDENT_BROKER',
  TRADING_FIRM = 'TRADING_FIRM',
  CRYPTOCURRENCY_EXCHANGE = 'CRYPTOCURRENCY_EXCHANGE',
}

export enum AttributionType {
  REFERRAL_LINK = 'REFERRAL_LINK',
  REFERRAL_CODE = 'REFERRAL_CODE',
  DIRECT_SIGNUP = 'DIRECT_SIGNUP',
  API_INTEGRATION = 'API_INTEGRATION',
  WHITE_LABEL = 'WHITE_LABEL',
  OAUTH = 'OAUTH',
}

export interface Broker {
  id: string;
  companyName: string;
  registrationNumber: string;
  fscaLicenseNumber?: string;
  fscaLicenseExpiry?: string;
  tier: BrokerTier;
  type: BrokerType;
  status: BrokerStatus;
  contactEmail: string;
  contactPhone?: string;
  physicalAddress: string;
  postalAddress?: string;
  website?: string;

  // Business Profile
  businessProfile?: {
    description: string;
    services: string[];
    markets: string[];
    assetsUnderManagement?: number;
    yearsInBusiness: number;
    numberOfClients?: number;
  };

  // Compliance Info
  complianceInfo?: {
    registeredWithFSCA: boolean;
    compliantWithPOPIA: boolean;
    hasAMLKycProcedures: boolean;
    insuranceCoverage: boolean;
    lastComplianceAudit?: string;
    auditReport?: string;
  };

  // Payment Info
  paymentInfo?: {
    supportedMethods: string[];
    currencies: string[];
    minimumDeposit: number;
    maximumDeposit: number;
    processingTime: string;
    fees: {
      deposit: number;
      withdrawal: number;
      trading: number;
    };
  };

  // Metrics
  totalTraders: number;
  totalVolume: number;
  averageRating: number;
  numberOfReviews: number;

  // Branding
  logoUrl?: string;
  bannerUrl?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };

  // Status
  acceptNewClients: boolean;
  isPubliclyListed: boolean;
  isActive: boolean;
  trustScore: number;
  verificationStatus: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface BrokerStats {
  totalClients: number;
  activeClients: number;
  totalTrades: number;
  totalVolume: number;
  totalCommission: number;
  totalBrokerCommission: number;
  averageCommissionPerClient: number;
  churnRate: number;
  monthlyGrowth: number;
  retentionRate: number;
}

export interface BrokerClient {
  id: string;
  brokerId: string;
  clientId: string;
  attributionType: AttributionType;
  attributionDate: string;
  attributionMetadata?: Record<string, any>;
  status: string;
  isActive: boolean;
  totalCommission: number;
  totalBrokerCommission: number;
  totalPlatformCommission: number;
  lastCommissionAt?: string;
  totalOrders: number;
  totalVolume: number;
  lastOrderAt?: string;
  createdAt: string;
  updatedAt: string;

  // Client details (joined from user)
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    status: string;
    kycStatus: string;
    createdAt: string;
    lastLoginAt?: string;
  };
}

export interface BrokerBill {
  id: string;
  brokerId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  totalCommission: number;
  baseFee: number;
  volumeDiscount: number;
  performanceBonus: number;
  tierMultiplier: number;
  vatAmount: number;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt?: string;
  paymentMethod?: string;
  transactionId?: string;
  clientCount: number;
  transactionCount: number;
  volumeBreakdown?: Record<string, any>;
  commissionBreakdown?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface BrokerAnalytics {
  revenueData: {
    monthly: Array<{
      month: string;
      revenue: number;
      commission: number;
      clients: number;
      volume: number;
    }>;
    daily: Array<{
      date: string;
      revenue: number;
      trades: number;
    }>;
  };

  clientMetrics: {
    acquisition: Array<{
      month: string;
      newClients: number;
      churnedClients: number;
    }>;
    retention: Array<{
      month: string;
      retentionRate: number;
    }>;
    demographics: {
      countries: Record<string, number>;
      ageGroups: Record<string, number>;
    };
  };

  performanceMetrics: {
    averageTradeSize: number;
    tradesPerClient: number;
    revenuePerClient: number;
    clientLifetimeValue: number;
  };
}

export interface BrokerFilterOptions {
  search?: string;
  tier?: BrokerTier[];
  status?: BrokerStatus[];
  minRating?: number;
  minClients?: number;
  country?: string;
  services?: string[];
  verified?: boolean;
}

export interface CommissionBreakdown {
  totalCommission: number;
  platformCommission: number;
  brokerCommission: number;
  volumeDiscount: number;
  performanceBonus: number;
  tierMultiplier: number;
}

export interface OAuthProvider {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  scopes: string[];
}

export const _OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  google: {
    id: 'google',
    name: 'google',
    displayName: 'Google',
    icon: 'google',
    color: '#4285f4',
    scopes: ['openid', 'email', 'profile'],
  },
  apple: {
    id: 'apple',
    name: 'apple',
    displayName: 'Apple',
    icon: 'apple',
    color: '#000000',
    scopes: ['name', 'email'],
  },
};

// Re-export with original name for compatibility
export const OAUTH_PROVIDERS = _OAUTH_PROVIDERS;
