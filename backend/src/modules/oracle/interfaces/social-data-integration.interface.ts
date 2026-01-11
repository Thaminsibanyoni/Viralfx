export enum TrendCategory {
  VERIFIED_TRADEABLE = 'VERIFIED_TRADEABLE',      // 🟩 Green - Real verified trends
  SUSPICIOUS_NON_TRADEABLE = 'SUSPICIOUS_NON_TRADEABLE', // 🟨 Yellow - Gossip/unverified
  HARMFUL_BLOCKED = 'HARMFUL_BLOCKED'              // 🟥 Red - Harmful content
}

export enum PlatformType {
  TWITTER = 'twitter',
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  FACEBOOK = 'facebook',
  REDDIT = 'reddit'
}

export enum SourceType {
  OFFICIAL_NEWS = 'official_news',           // CNN, BBC, Reuters, etc.
  CELEBRITY_OFFICIAL = 'celebrity_official', // Verified celebrity accounts
  BRAND_OFFICIAL = 'brand_official',         // Verified brand accounts
  MEDIA_OUTLET = 'media_outlet',             // Entertainment media
  INFLUENCER = 'influencer',                 // Large influencer accounts
  USER_GENERATED = 'user_generated',         // Regular users
  UNKNOWN = 'unknown'
}

export interface SocialMediaPost {
  id: string;
  platform: PlatformType;
  platformPostId: string;
  authorId: string;
  authorHandle: string;
  authorVerified: boolean;
  authorFollowers: number;
  content: string;
  contentType: 'text' | 'image' | 'video' | 'link';
  hashtags: string[];
  mentions: string[];
  engagementCount: number;
  likesCount: number;
  sharesCount: number;
  commentsCount: number;
  viewsCount?: number;
  publishedAt: Date;
  collectedAt: Date;
  location?: string;
  language: string;
  isDeleted: boolean;
  mediaUrls?: string[];
}

export interface TrendClassification {
  trendId: string;
  category: TrendCategory;
  confidence: number; // 0-1
  reasoning: string;
  sources: SourceAnalysis[];
  crossPlatformCorrelation: CorrelationScore[];
  deceptionScore: number; // 0-1 (higher = more deceptive)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  marketImpact: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  officialVerification?: OfficialVerification;
}

export interface SourceAnalysis {
  platform: PlatformType;
  sourceType: SourceType;
  credibilityScore: number; // 0-1
  authorityLevel: number; // 0-1 (how authoritative the source is)
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'SUSPICIOUS';
  factCheckRating?: 'TRUE' | 'FALSE' | 'MISLEADING' | 'UNVERIFIED';
  politicalBias?: 'LEFT' | 'RIGHT' | 'CENTER' | 'UNKNOWN';
}

export interface CorrelationScore {
  platform1: PlatformType;
  platform2: PlatformType;
  correlationStrength: number; // 0-1
  timeOverlap: number; // seconds
  contentSimilarity: number; // 0-1
  sharedKeywords: string[];
}

export interface OfficialVerification {
  type: 'NEWS_ARTICLE' | 'PRESS_RELEASE' | 'OFFICIAL_STATEMENT' | 'CELEBRITY_CONFIRMATION';
  source: string;
  url: string;
  publishedAt: Date;
  authority: string;
  verificationLevel: number; // 0-1
}

export interface MarketIndexEligibility {
  eligible: boolean;
  category: TrendCategory;
  minimumVolume: number;
  marketCapThreshold: number;
  liquidityRequirement: number;
  riskAdjustedScore: number;
  tradingAllowed: boolean;
  warningLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DeceptionDetectionResult {
  isDeceptive: boolean;
  confidence: number;
  deceptionType: 'FAKE_NEWS' | 'MISINFORMATION' | 'GOSSIP' | 'SATIRE' | 'MANIPULATION';
  evidence: DeceptionEvidence[];
  riskScore: number;
  recommendedAction: 'ALLOW' | 'FLAG' | 'BLOCK';
}

export interface DeceptionEvidence {
  type: string;
  description: string;
  confidence: number;
  sourceUrl?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ViralityRiskModel {
  baseVirality: number;
  riskAdjustment: number;
  finalScore: number;
  riskFactors: RiskFactor[];
  marketVolatility: number;
  confidenceInterval: [number, number];
}

export interface RiskFactor {
  factor: string;
  impact: number; // -1 to 1
  confidence: number; // 0-1
  description: string;
}
