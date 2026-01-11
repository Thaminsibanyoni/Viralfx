/**
 * Reward Status Enum
 * Defines the different states of rewards
 */
export enum RewardStatus {
  PENDING = 'PENDING',
  AVAILABLE = 'AVAILABLE',
  CLAIMED = 'CLAIMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

/**
 * Reward Type Enum
 * Defines the different types of rewards
 */
export enum RewardType {
  BONUS_CREDIT = 'BONUS_CREDIT',
  CASHBACK = 'CASHBACK',
  DISCOUNT = 'DISCOUNT',
  FREE_TRADE = 'FREE_TRADE',
  MERCHANDISE = 'MERCHANDISE',
  VIP_ACCESS = 'VIP_ACCESS',
  POINTS = 'POINTS',
  CRYPTO = 'CRYPTO',
  GIFT_CARD = 'GIFT_CARD',
  CUSTOM = 'CUSTOM'
}

/**
 * Referral Status Enum
 * Defines the status of referrals
 */
export enum ReferralStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

/**
 * Referral Tier Enum
 * Defines the different tiers in referral programs
 */
export enum ReferralTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND'
}

/**
 * Reward Category Enum
 * Defines categories for rewards
 */
export enum RewardCategory {
  SIGNUP_BONUS = 'SIGNUP_BONUS',
  REFERRAL_BONUS = 'REFERRAL_BONUS',
  ACTIVITY_BONUS = 'ACTIVITY_BONUS',
  LOYALTY_REWARD = 'LOYALTY_REWARD',
  PROMOTIONAL = 'PROMOTIONAL',
  MILESTONE = 'MILESTONE'
}

/**
 * Payout Method Enum
 * Defines how rewards can be paid out
 */
export enum PayoutMethod {
  WALLET_CREDIT = 'WALLET_CREDIT',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CRYPTO = 'CRYPTO',
  GIFT_CARD = 'GIFT_CARD',
  CHECK = 'CHECK',
  PAYPAL = 'PAYPAL'
}

/**
 * Reward Frequency Enum
 * Defines how often rewards are distributed
 */
export enum RewardFrequency {
  ONE_TIME = 'ONE_TIME',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY'
}
