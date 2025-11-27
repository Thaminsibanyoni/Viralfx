import { apiClient } from './client';
import { ReferralStats, Referral, Reward } from '../../types/referral.types';

interface ReferralCodeResponse {
  code: string;
  url: string;
}

interface ValidateReferralResponse {
  valid: boolean;
  referrer?: {
    id: string;
    username: string;
  };
}

interface ReferralLeaderboardResponse {
  userId: string;
  username: string;
  totalReferrals: number;
  completedReferrals: number;
  totalEarned: number;
}

const referralApi = {
  // Get user's referral statistics
  getReferralStats: (): Promise<ReferralStats> =>
    apiClient.get('/referral/me'),

  // Get user's referral code
  getReferralCode: (): Promise<ReferralCodeResponse> =>
    apiClient.get('/referral/code'),

  // Validate a referral code
  validateReferralCode: (code: string): Promise<ValidateReferralResponse> =>
    apiClient.post('/referral/validate', { referralCode: code }),

  // Get user's referral history
  getReferralHistory: (page = 1, limit = 20): Promise<{ referrals: Referral[]; total: number }> =>
    apiClient.get(`/referral/history?page=${page}&limit=${limit}`),

  // Get referral leaderboard
  getLeaderboard: (limit = 10): Promise<ReferralLeaderboardResponse[]> =>
    apiClient.get(`/referral/leaderboard?limit=${limit}`),

  // Get user's rewards
  getRewards: (status?: string, type?: string): Promise<Reward[]> =>
    apiClient.get(`/rewards/me${status ? `?status=${status}` : ''}${type ? `&type=${type}` : ''}`),

  // Get specific reward details
  getReward: (id: string): Promise<Reward> =>
    apiClient.get(`/rewards/${id}`),

  // Claim a pending reward
  claimReward: (id: string): Promise<{ success: boolean; message: string }> =>
    apiClient.post(`/rewards/${id}/claim`),

  // Get pending rewards
  getPendingRewards: (): Promise<Reward[]> =>
    apiClient.get('/rewards/pending'),

  // Get reward history
  getRewardHistory: (page = 1, limit = 20): Promise<{ rewards: Reward[]; total: number }> =>
    apiClient.get(`/rewards/history?page=${page}&limit=${limit}`),

  // Generate referral link with custom parameters
  generateReferralLink: (params?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }): Promise<{ url: string; code: string }> =>
    apiClient.post('/referral/generate-link', params),

  // Track referral click
  trackReferralClick: (code: string, metadata?: {
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
  }): Promise<{ tracked: boolean }> =>
    apiClient.post(`/referral/track-click/${code}`, metadata),

  // Get referral analytics
  getReferralAnalytics: (period = '30d'): Promise<{
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
  }> =>
    apiClient.get(`/referral/analytics?period=${period}`),

  // Get tier information
  getTierInfo: (): Promise<{
    currentTier: string;
    nextTier?: string;
    tiers: Array<{
      name: string;
      minReferrals: number;
      maxReferrals?: number;
      rewardMultiplier: number;
      bonusReward: number;
      features: string[];
    }>;
    progress: {
      current: number;
      required: number;
      percentage: number;
    };
  }> =>
    apiClient.get('/referral/tiers'),

  // Get referral program terms and conditions
  getTermsAndConditions: (): Promise<{
    title: string;
    content: string;
    lastUpdated: string;
    version: string;
  }> =>
    apiClient.get('/referral/terms'),

  // Export referral data
  exportReferralData: (format = 'csv'): Promise<Blob> =>
    apiClient.get(`/referral/export?format=${format}`, {
      responseType: 'blob',
    }),

  // Get social sharing options
  getSocialSharingOptions: (): Promise<{
    platforms: Array<{
      name: string;
      icon: string;
      url: string;
      enabled: boolean;
    }>;
    defaultMessage: string;
  }> =>
    apiClient.get('/referral/sharing-options'),
};

export { referralApi };