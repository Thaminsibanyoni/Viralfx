// Topic-related type definitions for ViralFX

export enum TopicCategory {
  MUSIC = 'MUSIC',
  SPORTS = 'SPORTS',
  TECH = 'TECH',
  FASHION = 'FASHION',
  FOOD = 'FOOD',
  ENTERTAINMENT = 'ENTERTAINMENT',
  POLITICS = 'POLITICS',
  LIFESTYLE = 'LIFESTYLE',
  NEWS = 'NEWS',
  OTHER = 'OTHER',
}

export enum Sentiment {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  NEUTRAL = 'NEUTRAL',
  MIXED = 'MIXED',
}

export enum Region {
  SOUTH_AFRICA = 'SOUTH_AFRICA',
  GLOBAL = 'GLOBAL',
  AFRICA = 'AFRICA',
  EUROPE = 'EUROPE',
  AMERICAS = 'AMERICAS',
  ASIA = 'ASIA',
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  category: TopicCategory;
  viralityScore: number;
  sentiment: Sentiment;
  platforms: string[];
  region: Region;
  engagementMetrics: {
    likes: number;
    shares: number;
    comments: number;
    views: number;
    saves: number;
  };
  velocity: number; // Rate of virality change per hour
  peakVirality: number;
  totalMentions: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  isActive: boolean;
  isTrending: boolean;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  tags: string[];
  keywords: string[];
  relatedTopics: string[];
  socialPosts: SocialPost[];
  sentimentHistory: Array<{
    timestamp: number;
    sentiment: Sentiment;
    score: number;
  }>;
  viralityHistory: Array<{
    timestamp: number;
    score: number;
    change: number;
  }>;
  metadata: {
    language: string;
    languageConfidence: number;
    source: string[];
    firstMention: string;
    lastMention: string;
    demographicProfile: {
      ageDistribution: Record<string, number>;
      genderDistribution: Record<string, number>;
      locationDistribution: Record<string, number>;
    };
  };
}

export interface TopicFilters {
  search?: string;
  category?: TopicCategory;
  platform?: string;
  region?: Region;
  sentiment?: Sentiment;
  timeRange?: '1H' | '6H' | '24H' | '7D' | '30D' | '90D';
  minVirality?: number;
  maxVirality?: number;
  isActive?: boolean;
  isTrending?: boolean;
  sortBy?: 'virality' | 'engagement' | 'growth' | 'mentions';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface TopicSentiment {
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
  percentages: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  overall: Sentiment;
  confidence: number;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  timeline: Array<{
    timestamp: number;
    sentiment: Sentiment;
    score: number;
    volume: number;
  }>;
  wordCloud: Array<{
    word: string;
    frequency: number;
    sentiment: number;
    context?: string[];
  }>;
  sources: Record<string, {
    mentions: number;
    sentiment: Record<Sentiment, number>;
    reliability: number;
  }>;
}

export interface SocialPost {
  id: string;
  topicId: string;
  platform: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    verified: boolean;
    followerCount: number;
    description?: string;
    location?: string;
    website?: string;
  };
  url: string;
  publishedAt: string;
  engagement: {
    likes: number;
    shares: number;
    comments: number;
    views?: number;
    saves?: number;
  };
  media: Array<{
    type: 'IMAGE' | 'VIDEO' | 'GIF' | 'LINK';
    url: string;
    thumbnail?: string;
    duration?: number;
    dimensions?: {
      width: number;
      height: number;
    };
  }>;
  hashtags: string[];
  mentions: string[];
  language: string;
  sentiment: Sentiment;
  sentimentScore: number;
  viralityImpact: number;
  isRetweet?: boolean;
  isQuote?: boolean;
  replyTo?: string;
  location?: {
    name: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  metadata: {
    source: string;
    processedAt: string;
    confidence: number;
    relevanceScore: number;
  };
}

export interface RelatedTopic {
  id: string;
  title: string;
  description: string;
  category: TopicCategory;
  viralityScore: number;
  similarity: number;
  relationType: 'SEMANTIC' | 'TEMPORAL' | 'TOPICAL' | 'INFLUENCER';
  strength: number;
  confidence: number;
  sharedKeywords: string[];
  sharedPlatforms: string[];
}

export interface TopicStats {
  totalMentions: number;
  engagementRate: number;
  reach: number;
  velocity: number;
  peakVirality: number;
  averageVirality: number;
  totalEngagement: number;
  sentimentBreakdown: Record<Sentiment, number>;
  platformBreakdown: Record<string, number>;
  demographicProfile: {
    ageDistribution: Record<string, number>;
    genderDistribution: Record<string, number>;
    locationDistribution: Record<string, number>;
    interests: string[];
  };
  lifecycle: {
    stage: 'EMERGING' | 'GROWING' | 'PEAK' | 'DECLINING' | 'STABLE';
    duration: number;
    nextStage?: string;
    riskFactors: string[];
  };
}

export interface TopicAnalytics {
  growthRate: number;
  peakVirality: number;
  sustainabilityScore: number;
  marketImpact: number;
  riskScore: number;
  trendDirection: 'RISING' | 'FALLING' | 'STABLE';
  momentum: number;
  seasonality: {
    score: number;
    pattern: string;
    reliability: number;
  };
  viralityVelocity: number;
  sentimentMomentum: number;
  crossPlatformConsistency: number;
  influencerEngagement: number;
  longevity: number;
  recency: number;
  diversityScore: number;
}

export interface TopicReport {
  id: string;
  topicId: string;
  reporterId: string;
  reason: 'SPAM' | 'INAPPROPRIATE' | 'MISINFORMATION' | 'HARASSMENT' | 'VIOLENCE' | 'OTHER';
  description?: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  resolution?: string;
}

export interface TopicPrediction {
  predictedVirality: number;
  confidence: number;
  timeframe: string;
  factors: Array<{
    name: string;
    impact: number;
    description: string;
    reliability: number;
  }>;
  risks: Array<{
    type: string;
    probability: number;
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
  }>;
  opportunities: Array<{
    type: string;
    potential: 'LOW' | 'MEDIUM' | 'HIGH';
    timeline: string;
    description: string;
  }>;
  scenarios: Array<{
    scenario: string;
    probability: number;
    timeframe: string;
    outcome: string;
  }>;
}

export interface TopicInsights {
  summary: string;
  keyPoints: string[];
  risks: string[];
  opportunities: string[];
  marketImpact: string;
  sustainability: string;
  recommendations: Array<{
    action: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    timeframe: string;
    expectedOutcome: string;
  }>;
}

export interface TopicTrend {
  id: string;
  topic: Topic;
  trend: 'RISING' | 'FALLING' | 'STABLE';
  change: number;
  confidence: number;
  timeframe: string;
  drivers: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
  patterns: Array<{
    pattern: string;
    significance: number;
    frequency: string;
  }>;
}

export interface TopicSeasonality {
  seasonal: Array<{
    period: string;
    virality: number;
    confidence: number;
  }>;
  patterns: string[];
  peaks: Array<{
    date: string;
    virality: number;
    drivers: string[];
  }>;
  troughs: Array<{
    date: string;
    virality: number;
    drivers: string[];
  }>;
  cyclical: boolean;
  periodicity?: string;
}

export interface TopicContentAnalysis {
  wordCloud: Array<{
    word: string;
    frequency: number;
    sentiment: number;
    context: string[];
    hashtags: string[];
  }>;
  themes: Array<{
    theme: string;
    confidence: number;
    keywords: string[];
    sentiment: number;
  }>;
  keywords: Array<{
    word: string;
    frequency: number;
    importance: number;
    sentiment: number;
    categories: string[];
  }>;
  entities: Array<{
    text: string;
    type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'PRODUCT' | 'EVENT' | 'OTHER';
    confidence: number;
    mentions: number;
    sentiment: number;
  }>;
  summary: string;
  keyEvents: Array<{
    timestamp: number;
    event: string;
    impact: number;
    description: string;
  }>;
}

export interface TopicLifecycle {
  stage: 'EMERGING' | 'GROWING' | 'PEAK' | 'DECLINING' | 'STABLE' | 'RESURGENT';
  duration: number;
  peakVirality: number;
  currentPhase: string;
  nextPhase: string;
  riskFactors: string[];
  triggers: Array<{
    type: string;
    description: string;
    likelihood: number;
    timeframe: string;
  }>;
  milestones: Array<{
    timestamp: number;
    milestone: string;
    significance: number;
  }>;
  sustainability: number;
  evolutionRate: number;
}

export interface TopicMetrics {
  totalTopics: number;
  activeTopics: number;
  trendingTopics: number;
  averageVirality: number;
  totalMentions: number;
  categoryDistribution: Record<TopicCategory, number>;
  regionDistribution: Record<Region, number>;
  sentimentDistribution: Record<Sentiment, number>;
  platformDistribution: Record<string, number>;
  lifecycleDistribution: Record<string, number>;
  growthRate: number;
  engagementRate: number;
  averageDuration: number;
  seasonalityIndex: number;
  diversityIndex: number;
}

export interface TopicSubscription {
  id: string;
  topicId: string;
  userId: string;
  notificationTypes: string[];
  thresholds: {
    virality: number;
    sentiment: number;
    mentions: number;
  };
  createdAt: string;
  lastNotification?: string;
  isActive: boolean;
}

export interface TopicAlert {
  id: string;
  topicId: string;
  userId: string;
  type: 'VIRALITY' | 'SENTIMENT' | 'ENGAGEMENT' | 'LIFECYCLE';
  threshold: number;
  condition: 'ABOVE' | 'BELOW' | 'CHANGES_BY';
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
  notification: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

export interface TopicRecommendation {
  topic: Topic;
  relevanceScore: number;
  reasons: string[];
  personalization: {
    interests: string[];
    pastBehavior: string[];
    demographics: string[];
  };
  confidence: number;
  explanation: string;
}

export interface TopicResearch {
  background: string;
  context: string;
  implications: string[];
  sources: Array<{
    title: string;
    url: string;
    type: string;
    reliability: number;
    date: string;
  }>;
  methodology: string;
  dataQuality: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    bias: string[];
  };
  limitations: string[];
  conclusions: string[];
}

export interface TopicMarketImpact {
  affectedMarkets: Array<{
    market: string;
    correlation: number;
    impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    confidence: number;
    timeframe: string;
  }>;
  tradingOpportunities: string[];
  riskAssessment: string;
  investmentRecommendations: Array<{
    action: 'BUY' | 'SELL' | 'HOLD' | 'AVOID';
    confidence: number;
    timeframe: string;
    rationale: string;
  }>;
  economicIndicators: Array<{
    indicator: string;
    impact: string;
    direction: 'POSITIVE' | 'NEGATIVE';
  }>;
}