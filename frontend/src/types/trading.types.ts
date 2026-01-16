// Trading Types

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected';
export type PositionSide = 'long' | 'short';

export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: number;
  stopPrice?: number;
  quantity: number;
  filledQuantity: number;
  timestamp: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  leverage: number;
  marginUsed: number;
  timestamp: number;
}

export interface ViralTrend {
  id: string;
  symbol: string;
  name: string;
  viralScore: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  socialMentions: number;
  priceImpact: number;
  timestamp: number;
}

// VTS - Viral Trading Symbol Format: V:[Country]:[Sector]:[Ticker]
// Example: V:ZA:ENT:ZINHLEXD (South Africa: Entertainment: Zinhle XD)
export interface VTSSymbol {
  fullSymbol: string; // Complete V:CC:SEC:TICKER format
  country: string; // Country code (e.g., ZA for South Africa)
  sector: string; // Sector code (e.g., ENT for Entertainment)
  ticker: string; // Company ticker (e.g., ZINHLEXD)
  displayName: string; // Human-readable name
}

// VPMX - Viral Popularity Market Index Data
export interface VPMXData {
  score: number; // 0-100 overall virality score
  rank: number; // Current ranking among all tracked entities
  change24h: number; // Change in rank over 24 hours
  momentum: 'accelerating' | 'stable' | 'decelerating';
  peakScore: number; // Highest score in last 24h
  peakTime: number; // Timestamp of peak score
  averageScore: number; // Average score over last 24h
  prediction: {
    next24h: number; // Predicted score in 24h
    confidence: number; // Prediction confidence 0-1
    trend: 'up' | 'down' | 'sideways';
  };
}

// Enhanced Viral Trend Market with VTS and VPMX
export interface ViralTrendMarket extends ViralTrend {
  vtsSymbol: VTSSymbol;
  vpmx: VPMXData;
  marketCap?: number;
  tradingVolume?: number;
  relatedTopics: string[]; // Related topics/themes
  influencers: string[]; // Key influencers mentioning this
  platforms: {
    platform: string;
    mentions: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    growthRate: number;
  }[];
  categories: string[]; // Content categories (music, fashion, tech, etc.)
}

// Trend Reversal Detection
export interface TrendReversal {
  id: string;
  symbol: string;
  reversalType: 'bullish_to_bearish' | 'bearish_to_bullish';
  confidence: number; // 0-100
  detectedAt: number;
  indicators: {
    rsiDivergence: boolean;
    volumeSpike: boolean;
    vpmxDecline: boolean;
    socialSentimentShift: boolean;
  };
  targetPrice: number;
  stopLoss: number;
}

// Chart Indicator Types
export interface ChartIndicator {
  id: string;
  type: 'rsi' | 'macd' | 'bollinger' | 'volume' | 'vpmx' | 'support_resistance' | 'fibonacci';
  enabled: boolean;
  params: Record<string, number | boolean>;
  color?: string;
}

// Market Depth (Order Book)
export interface MarketDepth {
  symbol: string;
  bids: { price: number; quantity: number; total: number }[];
  asks: { price: number; quantity: number; total: number }[];
  lastUpdate: number;
}

// Trading View Layout State
export interface TradingViewLayout {
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
  chartType: 'candlestick' | 'line' | 'area' | 'bar';
  indicators: ChartIndicator[];
  showVolume: boolean;
  showVPMX: boolean;
  showOrderBook: boolean;
  panelLayout: 'single' | 'dual' | 'triple';
  locked: boolean;
}

// Fibonacci Retracement Levels
export interface FibonacciLevels {
  symbol: string;
  highPrice: number;
  lowPrice: number;
  levels: {
    level: number; // 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1
    price: number;
    type: 'support' | 'resistance' | 'pivot';
  }[];
  calculatedAt: number;
}

// Drawing Tools
export interface DrawingTool {
  id: string;
  type: 'line' | 'horizontal' | 'vertical' | 'rectangle' | 'fibonacci';
  startPoint: { time: number; price: number };
  endPoint: { time: number; price: number };
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  width: number;
}

export interface SupportResistanceLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number; // 0-100
  touches: number;
  lastTested: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
}
