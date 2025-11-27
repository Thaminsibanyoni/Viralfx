export interface AnalyticsQuery {
  symbol: string;
  startTime?: Date;
  endTime?: Date;
  interval?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  metrics?: string[];
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

export interface AnalyticsData {
  symbol: string;
  timeframe: {
    startTime: Date;
    endTime: Date;
    interval: string;
  };
  data: AnalyticsDataPoint[];
  metadata: {
    totalPoints: number;
    hasGaps: boolean;
    source: 'market_data' | 'viral_index_snapshot';
  };
}

export interface AnalyticsDataPoint {
  timestamp: Date;
  price?: number;
  volume?: number;
  viralityScore?: number;
  sentimentScore?: number;
  velocity?: number;
  engagementRate?: number;
  momentumScore?: number;
  volatility?: number;
  [key: string]: any;
}

export interface PerformanceMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  volatility: number;
  alpha?: number;
  beta?: number;
  calmarRatio?: number;
  sortinoRatio?: number;
}

export interface TrendAnalytics {
  symbol: string;
  viralityScore: {
    current: number;
    trend: 'rising' | 'falling' | 'stable';
    change24h: number;
    change7d: number;
  };
  velocity: {
    current: number;
    trend: 'accelerating' | 'decelerating' | 'stable';
    change24h: number;
  };
  sentiment: {
    current: number;
    trend: 'improving' | 'declining' | 'stable';
    distribution: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
  engagement: {
    current: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    totalEngagements: number;
    activeUsers: number;
  };
  momentum: {
    current: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: 'strong' | 'moderate' | 'weak';
  };
  predictions: {
    shortTerm: Prediction;
    longTerm: Prediction;
  };
  riskFactors: RiskFactor[];
  updatedAt: Date;
}

export interface Prediction {
  direction: 'up' | 'down' | 'sideways';
  confidence: number;
  targetPrice?: number;
  timeHorizon: string;
  factors: string[];
}

export interface RiskFactor {
  factor: string;
  probability: number;
  impact: 'low' | 'medium' | 'high';
  description: string;
}

export interface DashboardData {
  assetId: string;
  symbol: string;
  lastUpdated: Date;
  performance: PerformanceMetrics;
  engagement: {
    totalEngagements: number;
    activeUsers: number;
    growthRate: number;
    topPlatforms: PlatformData[];
  };
  market: {
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    marketCap?: number;
    marketData: AnalyticsDataPoint[];
  };
  predictions: {
    shortTerm: Prediction;
    longTerm: Prediction;
    accuracy: {
      shortTerm: number;
      longTerm: number;
    };
  };
  alerts: Alert[];
}

export interface PlatformData {
  platform: string;
  engagements: number;
  growthRate: number;
  sentiment: number;
}

export interface Alert {
  id: string;
  type: 'price' | 'volume' | 'sentiment' | 'virality';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface ReportConfig {
  type: 'backtest' | 'performance' | 'comparison' | 'trend_analysis';
  entityType: 'strategy' | 'user' | 'symbol';
  entityId: string;
  period: '1D' | '7D' | '30D' | '90D' | '1Y' | 'ALL_TIME';
  format: 'json' | 'csv' | 'pdf';
  options?: {
    includeCharts?: boolean;
    includeTrades?: boolean;
    benchmark?: string;
    customMetrics?: string[];
  };
}

export interface Report {
  id: string;
  config: ReportConfig;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  data?: any;
  charts?: ChartData[];
  metadata: {
    generatedAt: Date;
    generatedBy: string;
    executionTime: number;
    dataSize: number;
  };
  downloadUrl?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap';
  title: string;
  data: any[];
  config: {
    xAxis?: string;
    yAxis?: string;
    color?: string;
    [key: string]: any;
  };
}