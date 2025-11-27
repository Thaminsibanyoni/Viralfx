/**
 * ViralFX Universal Trend Symbol System (VTS) TypeScript Definitions
 * © 2025 ViralFX - Global Symbol Standard
 */

export enum RegionCode {
  GLOBAL = 'GLB',
  SOUTH_AFRICA = 'ZA',
  NIGERIA = 'NG',
  USA = 'US',
  UK = 'GB',
  AUSTRALIA = 'AU',
  CANADA = 'CA',
  GERMANY = 'DE',
  FRANCE = 'FR',
  JAPAN = 'JP',
  CHINA = 'CN',
  INDIA = 'IN',
  BRAZIL = 'BR',
  MEXICO = 'MX',
  SPAIN = 'ES',
  ITALY = 'IT',
  SOUTH_KOREA = 'KR',
  NETHERLANDS = 'NL',
  SINGAPORE = 'SG',
}

export enum CategoryCode {
  POLITICS = 'POL',
  ENTERTAINMENT = 'ENT',
  SPORTS = 'SPT',
  TECHNOLOGY = 'TEC',
  CULTURE = 'CUL',
  FINANCE = 'FIN',
  SAFETY = 'SAF',
  EDUCATION = 'EDU',
  MISC = 'MSC',
  HEALTH = 'HLT',
  SCIENCE = 'SCI',
  BUSINESS = 'BIZ',
  LIFESTYLE = 'LIF',
  TRAVEL = 'TRV',
  FOOD = 'FOD',
  ENVIRONMENT = 'ENV',
  CRIME = 'CRM',
}

export enum VerificationLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERIFIED = 'VERIFIED',
  SUSPICIOUS = 'SUSPICIOUS',
  REJECTED = 'REJECTED',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface VTSSymbol {
  symbol: string;
  region: RegionCode;
  category: CategoryCode;
  topicId: string;
  displayName: string;
  description: string;
  metadata: VTSMetadata;
}

export interface VTSMetadata {
  originalTopic: string;
  hashRoot: string;
  createdAt: Date;
  platforms: string[];
  verificationLevel: VerificationLevel;
  sentimentScore: number;
  viralityScore: number;
  riskLevel: RiskLevel;
  languages: string[];
  firstSeenPlatform: string;
  consensusScore: number;
  currentPrice?: number;
  change24h?: number;
  totalEngagement?: number;
}

export interface VTSTrendMetrics {
  symbol: string;
  timestamp: Date;
  price: number;
  volume: number;
  marketCap: number;
  viralityScore: number;
  sentimentScore: number;
  momentumScore: number;
  authorityScore: number;
  engagementMetrics: {
    likes: number;
    shares: number;
    comments: number;
    views: number;
  };
  regionalBreakdown: Record<RegionCode, number>;
  platformBreakdown: Record<string, number>;
}

export interface VTSAlert {
  id: string;
  symbol: string;
  alertType: VTSAlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  isRead: boolean;
  data?: any;
}

export enum VTSAlertType {
  MOMENTUM_SPIKE = 'MOMENTUM_SPIKE',
  SENTIMENT_SHIFT = 'SENTIMENT_SHIFT',
  VIRALITY_BREAKOUT = 'VIRALITY_BREAKOUT',
  MANIPULATION_DETECTED = 'MANIPULATION_DETECTED',
  VERIFICATION_CHANGED = 'VERIFICATION_CHANGED',
  CROSS_PLATFORM_EXPANSION = 'CROSS_PLATFORM_EXPANSION',
  REGIONAL_CONVERGENCE = 'REGIONAL_CONVERGENCE',
  PRICE_MOVEMENT = 'PRICE_MOVEMENT',
  VOLUME_ANOMALY = 'VOLUME_ANOMALY',
  RISK_LEVEL_CHANGE = 'RISK_LEVEL_CHANGE',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface VTSMarketData {
  symbol: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  volume24h: number;
  change24h: number;
  changePercent24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  vwap24h: number;
  liquidityScore: number;
  orderBookDepth: number;
  lastUpdated: Date;
}

export interface VTSSearchFilters {
  region?: RegionCode;
  category?: CategoryCode;
  verificationLevel?: VerificationLevel;
  riskLevel?: RiskLevel;
  minVirality?: number;
  minConsensus?: number;
  platforms?: string[];
  languages?: string[];
}

export interface VTSUserPreferences {
  watchlist: string[];
  alerts: VTSAlertSettings[];
  defaultFilters: VTSSearchFilters;
  displaySettings: {
    showMetadata: boolean;
    showPrice: boolean;
    showChange: boolean;
    theme: 'dark' | 'light';
  };
}

export interface VTSAlertSettings {
  symbol: string;
  alertTypes: VTSAlertType[];
  thresholds: {
    priceChange?: number;
    volumeSpike?: number;
    sentimentShift?: number;
    viralityBreakout?: number;
  };
  enabled: boolean;
}

export interface VTSCreateRequest {
  originalTopic: string;
  region: RegionCode;
  category: CategoryCode;
  content: {
    text: string;
    platforms: string[];
    languages: string[];
    userLocation?: string;
    mentions?: string[];
    hashtags?: string[];
  };
  metadata: {
    sentimentScore?: number;
    viralityScore?: number;
    consensusScore?: number;
    firstSeenPlatform: string;
  };
}

export interface VTSValidationResult {
  isValid: boolean;
  symbol?: string;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
}

export interface VTSClusterAnalysis {
  clusterId: string;
  symbols: string[];
  clusterType: 'SIMILAR_TOPIC' | 'RELATED_TOPIC' | 'REGIONAL_VARIATION' | 'PLATFORM_VARIATION';
  similarityScore: number;
  centroidTopic: string;
  dominantCategory: CategoryCode;
  dominantRegion: RegionCode;
  createdAt: Date;
}

// API Response Types
export interface VTSApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  requestId: string;
}

export interface VTSSymbolListResponse {
  symbols: VTSSymbol[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters?: VTSSearchFilters;
}

export interface VTSAnalyticsResponse {
  symbol: string;
  timeframe: string;
  metrics: VTSTrendMetrics[];
  summary: {
    avgPrice: number;
    maxPrice: number;
    minPrice: number;
    totalVolume: number;
    avgVirality: number;
    avgSentiment: number;
    priceChange: number;
    priceChangePercent: number;
  };
  insights: string[];
}

// WebSocket Message Types
export interface VTSWebSocketMessage {
  type: 'PRICE_UPDATE' | 'ALERT' | 'METRICS_UPDATE' | 'NEW_SYMBOL' | 'SYMBOL_REMOVED';
  symbol: string;
  data: any;
  timestamp: string;
}

export interface VTSPriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export interface VTSMetricsUpdate {
  symbol: string;
  viralityScore: number;
  sentimentScore: number;
  consensusScore: number;
  riskLevel: RiskLevel;
  verificationLevel: VerificationLevel;
  timestamp: string;
}