export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  completedReferrals: number;
  pendingRewards: number;
  totalEarned: number;
  conversionRate: number;
  currentTier: TierName;
  nextTier?: TierName;
  tierProgress: {
    current: number;
    required: number;
    percentage: number;
  };
}

export interface Referral {
  id: string;
  referrerId: string;
  refereeId?: string;
  status: ReferralStatus;
  referralCode: string;
  referralDate?: Date;
  completionDate?: Date;
  expiryDate?: Date;
  totalRewardEarned: number;
  metadata: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    ipAddress?: string;
    userAgent?: string;
    referrerUrl?: string;
    conversionEvents?: Array<{
      event: string;
      timestamp: Date;
      data?: any;
    }>;
  };
  referrer?: {
    id: string;
    username: string;
    email: string;
  };
  referee?: {
    id: string;
    username: string;
    email: string;
  };
  rewards?: Reward[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Reward {
  id: string;
  userId: string;
  referralId?: string;
  rewardType: RewardType;
  rewardAmount: number;
  currency: string;
  status: RewardStatus;
  description: string;
  expiresAt?: Date;
  paidAt?: Date;
  metadata: {
    tierMultiplier?: number;
    bonusAmount?: number;
    transactionId?: string;
    walletAddress?: string;
    claimCode?: string;
    features?: string[];
    discountCode?: string;
    discountPercentage?: number;
  };
  user?: {
    id: string;
    username: string;
    email: string;
  };
  referral?: Referral;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralTier {
  id: string;
  name: TierName;
  minReferrals: number;
  maxReferrals?: number;
  rewardMultiplier: number;
  bonusReward: number;
  features: string[];
  isActive: boolean;
  displayOrder: number;
  description?: string;
  tierConfig: {
    baseRewardAmount: number;
    rewardCurrency: string;
    expiryDays?: number;
    maxRewardsPerPeriod?: number;
    rewardPeriodDays?: number;
    bonusConditions?: Array<{
      condition: string;
      bonusAmount: number;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralAnalytics {
  clicks: number;
  signups: number;
  conversions: number;
  conversionRate: number;
  dailyStats: Array<{
    date: string;
    clicks: number;
    signups: number;
    conversions: number;
  }>;
  topChannels: Array<{
    channel: string;
    clicks: number;
    conversions: number;
    conversionRate: number;
  }>;
  geographics: Array<{
    country: string;
    clicks: number;
    signups: number;
    conversions: number;
  }>;
}

export interface ReferralTracking {
  id: string;
  referralCode: string;
  eventType: 'click' | 'signup' | 'conversion';
  timestamp: Date;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    userId?: string;
    conversionData?: any;
  };
}

export interface ReferralPayout {
  id: string;
  userId: string;
  referralId?: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  method: PayoutMethod;
  destinationAddress?: string;
  transactionHash?: string;
  processingFee?: number;
  processedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralCampaign {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
  config: {
    bonusMultiplier?: number;
    customRewardAmount?: number;
    specialFeatures?: string[];
    targetAudience?: string[];
  };
  participants: number;
  totalRewards: number;
  createdAt: Date;
  updatedAt: Date;
}

// Enums
export enum ReferralStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

export enum RewardType {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  DISCOUNT = 'DISCOUNT',
  FEATURES = 'FEATURES',
}

export enum RewardStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum TierName {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum PayoutMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CRYPTO = 'CRYPTO',
  WALLET_CREDIT = 'WALLET_CREDIT',
  VOUCHER = 'VOUCHER',
}

// API Request/Response Types
export interface CreateReferralRequest {
  referralCode: string;
  metadata?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    customData?: any;
  };
}

export interface ValidateReferralRequest {
  referralCode: string;
}

export interface ValidateReferralResponse {
  valid: boolean;
  referrer?: {
    id: string;
    username: string;
  };
  tier?: TierName;
  message?: string;
}

export interface ClaimRewardRequest {
  rewardId: string;
  payoutMethod?: PayoutMethod;
  destinationAddress?: string;
}

export interface GenerateReferralLinkRequest {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  customParams?: Record<string, string>;
}

export interface TrackClickRequest {
  referralCode: string;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
    timestamp?: string;
  };
}

export interface ReferralLeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  totalReferrals: number;
  completedReferrals: number;
  totalEarned: number;
  currentTier: TierName;
  rank: number;
}

export interface ReferralTerms {
  id: string;
  title: string;
  content: string;
  summary: string;
  lastUpdated: Date;
  version: string;
  isActive: boolean;
}

// Component Props Types
export interface ReferralCardProps {
  referralCode: string;
  referralLink: string;
  stats?: {
    totalReferrals: number;
    activeReferrals: number;
    completedReferrals: number;
  };
  onCopy?: (type: 'code' | 'link') => void;
  onShare?: (platform: string) => void;
  showQrCode?: boolean;
  compact?: boolean;
}

export interface RewardsListProps {
  rewards: Reward[];
  loading?: boolean;
  onClaim?: (rewardId: string) => void;
  onView?: (rewardId: string) => void;
  showFilters?: boolean;
  paginated?: boolean;
  pageSize?: number;
}

export interface ReferralTierProgressProps {
  currentTier: TierName;
  nextTier?: TierName;
  progress: {
    current: number;
    required: number;
    percentage: number;
  };
  tiers: ReferralTier[];
  showDetails?: boolean;
}

export interface ReferralShareModalProps {
  visible: boolean;
  onClose: () => void;
  referralCode: string;
  referralLink: string;
  customMessage?: string;
}

// Error Types
export class ReferralError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ReferralError';
  }
}

// Utility Types
export type ReferralEventPayload = {
  referralId: string;
  eventType: string;
  timestamp: Date;
  userId?: string;
  metadata?: any;
};

export type ReferralCalculationParams = {
  referrerTier: TierName;
  referralType: ReferralStatus;
  baseAmount: number;
  multiplier?: number;
  bonusConditions?: string[];
};

export type RewardCalculationResult = {
  baseAmount: number;
  tierMultiplier: number;
  bonusAmount: number;
  totalAmount: number;
  currency: string;
  expiresAt?: Date;
};