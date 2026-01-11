// Market data type definitions for internal use

export interface PriceUpdate {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  viralityScore: number;
  velocity: number;
  sentiment: number;
  timestamp: Date;
}

export interface MarketStats {
  symbol: string;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  totalTrades: number;
  marketCap: number;
  lastUpdated: Date;
}

export interface TrendingMarket {
  symbol: string;
  name: string;
  category: string;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  viralityScore: number;
  trendScore: number;
  rank: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
  orders: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  timestamp: Date;
}

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  allocation: number;
  firstPurchaseAt: Date;
  lastTradeAt: Date;
}

export interface MarketSummary {
  totalMarketCap: number;
  totalVolume24h: number;
  activeTrends: number;
  topGainers: TrendingMarket[];
  topLosers: TrendingMarket[];
  topVolume: TrendingMarket[];
  timestamp: Date;
}

export interface ViralityData {
  viralIndex: number;
  velocity: number;
  sentiment: number;
  timestamp: Date;
}

export interface SymbolWithLatestData {
  id: string;
  symbol: string;
  topicId?: string;
  name: string;
  category: string;
  region: string;
  basePrice: number;
  currentPrice?: number;
  lastViralityScore?: number;
  lastVelocity?: number;
  lastSentiment?: number;
  status: string;
  isActive: boolean;
  totalVolume: number;
  totalTrades: number;
  high24h?: number;
  low24h?: number;
  priceChange24h?: number;
  priceChangePercent24h?: number;
  volume24h: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  latestPrice?: PriceHistoryPoint;
  viralData?: ViralityData;
  is_trending: boolean;
  market_cap: number;
}

export interface PriceHistoryPoint {
  timestamp: Date;
  price: number;
  volume?: number;
  volatility?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  viralityScore?: number;
}

export interface Trade {
  id: string;
  symbol: string;
  buyerOrderId: string;
  sellerOrderId: string;
  quantity: number;
  price: number;
  timestamp: Date;
  tradeId: string;
}

export interface OrderMatch {
  buyOrder: {
    id: string;
    userId: string;
    quantity: number;
    price?: number;
    averagePrice?: number;
  };
  sellOrder: {
    id: string;
    userId: string;
    quantity: number;
    price?: number;
    averagePrice?: number;
  };
  symbol: string;
  quantity: number;
  price: number;
  timestamp: Date;
}

export interface MarketAnalytics {
  totalTrades: number;
  totalVolume: number;
  averageTradeSize: number;
  uniqueActiveSymbols: number;
  topTrends: Array<{
    symbol: string;
    volume: number;
  }>;
  priceMovements: {
    up: number;
    down: number;
    unchanged: number;
    averageChange: number;
    biggestGainer?: {
      symbol: string;
      change: number;
    };
    biggestLoser?: {
      symbol: string;
      change: number;
    };
  };
  timestamp: Date;
}

export interface PerformanceData {
  date: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface PortfolioPerformance {
  timeframe: string;
  currentValue: number;
  initialValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  volatility: number;
  sharpeRatio: number;
  performanceChart: PerformanceData[];
  maxDrawdown: number;
}

export interface AllocationData {
  symbol?: string;
  category?: string;
  region?: string;
  value: number;
  allocation: number;
}

export interface PortfolioAllocation {
  bySymbol: AllocationData[];
  byCategory: AllocationData[];
  byRegion: AllocationData[];
  diversificationScore: number;
}

// WebSocket message types
export interface WebSocketMessage<T = any> {
  event: string;
  data: T;
  timestamp: string;
  roomId?: string;
  userId?: string;
}

export interface PriceUpdateMessage extends WebSocketMessage<PriceUpdate> {
  event: 'price-update';
}

export interface StatsUpdateMessage extends WebSocketMessage<{
  symbol: string;
  stats: MarketStats;
}> {
  event: 'stats-update';
}

export interface TrendingUpdateMessage extends WebSocketMessage<{
  trending: TrendingMarket[];
}> {
  event: 'trending-update';
}

export interface OrderUpdateMessage extends WebSocketMessage<{
  orderId: string;
  status: string;
  filledQuantity?: number;
}> {
  event: 'order-update';
}

export interface PortfolioUpdateMessage extends WebSocketMessage<{
  symbol: string;
  quantity: number;
  averagePrice: number;
  unrealizedPnL: number;
}> {
  event: 'portfolio-update';
}

// Queue job data types
export interface PriceCalculationJob {
  symbol: string;
  viralityScore?: number;
}

export interface SyncViralityJob {
  topicId: string;
}

export interface UpdateMarketStatsJob {
  symbol: string;
}

export interface ProcessOrderJob {
  orderId: string;
}

export interface MatchOrdersJob {
  symbol: string;
}

export interface UpdatePortfolioJob {
  userId: string;
  symbol: string;
  trade: {
    quantity: number;
    price: number;
    side: 'BUY' | 'SELL';
    tradeDate: Date;
  };
}

export interface SettleOrderJob {
  orderId: string;
}

// Error types
export interface MarketError extends Error {
  code: string;
  symbol?: string;
  userId?: string;
  timestamp: Date;
}

// Configuration types
export interface MarketConfig {
  velocityMultiplier: number;
  baseVolatility: number;
  priceCacheTTL: number;
  marketDataCacheTTL: number;
  trendingCacheTTL: number;
  maxConcurrentJobs: number;
  cleanupRetentionDays: number;
}
