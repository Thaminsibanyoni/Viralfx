export interface VPMXComponents {
  globalSentimentScore: number;
  viralMomentumIndex: number;
  trendVelocity: number;
  mentionVolumeNormalized: number;
  engagementQualityScore: number;
  trendStability: number;
  deceptionRiskInverse: number;
  regionalWeighting: number;
}

export interface VPMXResult {
  vtsSymbol: string;
  timestamp: Date;
  value: number; // 0-1000
  components: VPMXComponents;
  metadata: {
    breakoutProbability: number;
    smiCorrelation: number;
    volatilityIndex: number;
    confidenceScore: number;
  };
}

export interface VPMXHistoryEntry {
  id: string;
  timestamp: Date;
  value: number;
  components: VPMXComponents;
  metadata: Record<string, any>;
  vtsSymbol: string;
  region?: string;
}

export interface RegionalVPMXData {
  region: string;
  value: number;
  components: VPMXComponents;
  contribution: number; // Contribution to global VPMX
}

export interface VPMXWeighting {
  globalSentimentWeight: number;
  viralMomentumWeight: number;
  trendVelocityWeight: number;
  mentionVolumeWeight: number;
  engagementQualityWeight: number;
  trendStabilityWeight: number;
  deceptionRiskWeight: number;
  regionalWeightingWeight: number;
}

export interface BrokerSafetyMetrics {
  brokerId: string;
  maxExposure: number;
  currentExposure: number;
  exposurePercentage: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  allowedMarkets: string[];
  blockedMarkets: string[];
}

export interface UserFairnessMetrics {
  userId: string;
  winRate: number;
  avgBetSize: number;
  totalWinnings: number;
  totalLosses: number;
  fairnessScore: number; // 0-100
  isWhale: boolean;
  limits: {
    maxBetSize: number;
    maxDailyBets: number;
    coolingPeriodPeriod: number;
  };
}

export interface VPMXMarketData {
  marketId: string;
  vtsSymbol: string;
  question: string;
  outcomeType: 'BINARY' | 'MULTI' | 'RANGE';
  currentVPMX: number;
  liquidityPool: number;
  volume24h: number;
  yesPrice: number;
  noPrice: number;
  expiresAt: Date;
  resolutionCriteria: string;
}