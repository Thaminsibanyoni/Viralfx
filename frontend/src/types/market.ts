// Market-related type definitions for ViralFX

export enum MarketCategory {
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

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  EXTREME = 'EXTREME',
}

export enum Platform {
  TWITTER = 'TWITTER',
  TIKTOK = 'TIKTOK',
  INSTAGRAM = 'INSTAGRAM',
  YOUTUBE = 'YOUTUBE',
  FACEBOOK = 'FACEBOOK',
  REDDIT = 'REDDIT',
  LINKEDIN = 'LINKEDIN',
}

export enum Sentiment {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  NEUTRAL = 'NEUTRAL',
  MIXED = 'MIXED',
}

export interface Market {
  id: string;
  symbol: string;
  name: string;
  description: string;
  category: MarketCategory;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  viralityScore: number;
  riskScore: RiskLevel;
  sentiment: Sentiment;
  platforms: Platform[];
  isActive: boolean;
  isTrending: boolean;
  createdAt: string;
  updatedAt: string;
  marketCap?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  allTimeHigh?: number;
  allTimeLow?: number;
  rank?: number;
  icon?: string;
  website?: string;
  whitepaper?: string;
  technical?: {
    support: number;
    resistance: number;
    rsi: number;
    macd: {
      value: number;
      signal: 'BUY' | 'SELL' | 'NEUTRAL';
    };
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
    };
    movingAverages: Record<string, {
      value: number;
      signal: 'BUY' | 'SELL' | 'NEUTRAL';
    }>;
  };
  social?: {
    twitter: string;
    reddit: string;
    telegram: string;
    discord: string;
    github: string;
  };
}

export interface MarketFilters {
  search?: string;
  category?: MarketCategory;
  priceRange?: [number, number];
  viralityRange?: [number, number];
  riskLevel?: RiskLevel;
  platform?: Platform;
  sortBy?: 'volume' | 'price' | 'change' | 'virality' | 'risk';
  sortOrder?: 'asc' | 'desc';
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
  orders: number;
  cumulative: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  spreadPercentage: number;
  totalVolume: number;
  lastUpdate: string;
}

export interface Trade {
  id: string;
  marketId: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  timestamp: string;
  tradeId: string;
  buyer?: {
    id: string;
    username: string;
  };
  seller?: {
    id: string;
    username: string;
  };
}

export interface MarketStats {
  high24h: number;
  low24h: number;
  open24h: number;
  close24h: number;
  volume24h: number;
  trades24h: number;
  marketCap: number;
  circulatingSupply: number;
  totalSupply: number;
  dominance: number;
}

export interface MarketSentiment {
  positive: number;
  negative: number;
  neutral: number;
  overall: Sentiment;
  confidence: number;
  lastUpdate: string;
  wordCloud: Array<{
    word: string;
    frequency: number;
    sentiment: number;
  }>;
}

export interface PriceAlert {
  id: string;
  marketId: string;
  userId: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
}

export interface OrderRequest {
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'DAY';
  leverage?: number;
  margin?: number;
}

export interface OrderResponse {
  id: string;
  marketId: string;
  type: string;
  side: string;
  quantity: number;
  price?: number;
  filledQuantity: number;
  remainingQuantity: number;
  averagePrice?: number;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'PENDING' | 'CANCELLED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  filledAt?: string;
  cancelledAt?: string;
  fees: {
    amount: number;
    currency: string;
  };
  pnl?: number;
  leverage?: number;
  margin?: number;
}

export interface Position {
  id: string;
  marketId: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  pnlPercent: number;
  margin: number;
  leverage: number;
  liquidationPrice?: number;
  isOpen: boolean;
  openedAt: string;
  closedAt?: string;
  fees: number;
}

export interface CandlestickData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicator {
  name: string;
  value: number;
  signal: 'BUY' | 'SELL' | 'NEUTRAL' | 'HOLD';
  description?: string;
}

export interface MarketAnalysis {
  technical: {
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    strength: number;
    support: number[];
    resistance: number[];
    indicators: TechnicalIndicator[];
    patterns: Array<{
      name: string;
      type: 'REVERSAL' | 'CONTINUATION';
      reliability: number;
      timeframe: string;
    }>;
  };
  fundamental: {
    score: number;
    factors: Array<{
      name: string;
      impact: 'POSITIVE' | 'NEGATIVE';
      weight: number;
      description: string;
    }>;
  };
  sentiment: {
    overall: Sentiment;
    confidence: number;
    sources: Record<string, number>;
    trends: Array<{
      direction: 'IMPROVING' | 'DECLINING' | 'STABLE';
      timeframe: string;
    }>;
  };
  social: {
    mentions: number;
    sentiment_distribution: Record<Sentiment, number>;
    influencer_activity: number;
    viral_score: number;
    platforms: Record<Platform, {
      mentions: number;
      sentiment: number;
      reach: number;
    }>;
  };
  recommendations: Array<{
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    timeframe: string;
    reasoning: string;
    risk_level: RiskLevel;
  }>;
}

export interface MarketAlert {
  id: string;
  type: 'PRICE' | 'VOLUME' | 'SENTIMENT' | 'VIRALITY' | 'NEWS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  marketId: string;
  createdAt: string;
  isActive: boolean;
  expiresAt?: string;
  triggerConditions: {
    field: string;
    operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'CHANGES_BY';
    value: number;
  }[];
  actions: Array<{
    type: 'NOTIFY' | 'TRADE' | 'ALERT';
    parameters: any;
  }>;
}

export interface MarketMetrics {
  totalMarkets: number;
  activeMarkets: number;
  totalVolume24h: number;
  totalTrades24h: number;
  averageTradeSize: number;
  topGainer: Market;
  topLoser: Market;
  highestVolume: Market;
  mostViral: Market;
  riskDistribution: Record<RiskLevel, number>;
  categoryDistribution: Record<MarketCategory, number>;
  platformDistribution: Record<Platform, number>;
  sentimentDistribution: Record<Sentiment, number>;
}

export interface MarketCalendar {
  events: Array<{
    id: string;
    title: string;
    description: string;
    date: string;
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
    type: 'EARNINGS' | 'PRODUCT_LAUNCH' | 'REGULATION' | 'PARTNERSHIP' | 'OTHER';
    markets: string[];
  }>;
  holidays: Array<{
    date: string;
    name: string;
    markets: string[];
    type: 'FULL_DAY' | 'PARTIAL_DAY';
  }>;
}

export interface MarketComparison {
  markets: Market[];
  correlation: number;
  similarity: number;
  differences: Array<{
    field: string;
    market1: any;
    market2: any;
    significance: number;
  }>;
  opportunities: Array<{
    type: 'ARBITRAGE' | 'DIVERSIFICATION' | 'HEDGING';
    description: string;
    confidence: number;
  }>;
}

export interface MarketNews {
  id: string;
  title: string;
  content: string;
  source: string;
  author?: string;
  url: string;
  publishedAt: string;
  relevance: number;
  sentiment: Sentiment;
  relatedMarkets: string[];
  categories: string[];
  tags: string[];
}

export interface PlatformData {
  name: Platform;
  apiEndpoint: string;
  rateLimit: number;
  supportedFeatures: string[];
  authentication: {
    type: 'API_KEY' | 'OAUTH' | 'BASIC';
    required: boolean;
    instructions: string;
  };
  dataPoints: {
    mentions: boolean;
    sentiment: boolean;
    engagement: boolean;
    demographics: boolean;
    trends: boolean;
  };
  realtime: boolean;
  historical: boolean;
  cost: {
    requests: number;
    timeframe: string;
  };
}