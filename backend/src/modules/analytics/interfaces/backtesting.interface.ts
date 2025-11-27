export interface BacktestConfig {
  strategyId: string;
  symbol: string;
  startTime: Date;
  endTime: Date;
  initialCapital: number;
  parameters?: Record<string, any>;
  options?: {
    slippage?: number;
    commission?: number;
    maxPositionSize?: number;
  };
}

export interface BacktestResult {
  id: string;
  strategyId: string;
  userId?: string;
  symbol: string;
  startTime: Date;
  endTime: Date;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin?: number;
  avgLoss?: number;
  profitFactor?: number;
  trades: BacktestTrade[];
  equity: EquityPoint[];
  parameters?: Record<string, any>;
  status: BacktestStatus;
  errorMessage?: string;
  executionTime: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BacktestStrategy {
  id: string;
  name: string;
  description?: string;
  category: StrategyCategory;
  parameters: StrategyParameter[];
  rules: StrategyRule[];
  isActive: boolean;
  isPublic: boolean;
  userId?: string;
  version: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface StrategyParameter {
  name: string;
  type: 'number' | 'string' | 'boolean';
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface StrategyRule {
  type: 'BUY' | 'SELL' | 'EXIT';
  condition: 'AND' | 'OR';
  criteria: RuleCriterion[];
}

export interface RuleCriterion {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains';
  value: string | number;
}

export interface BacktestTrade {
  entryTime: Date;
  exitTime: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  profit: number;
  returns: number;
  holdPeriod: number;
  reason?: string;
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
  returns: number;
  drawdown?: number;
}

export enum StrategyCategory {
  TREND_MOMENTUM = 'TREND_MOMENTUM',
  SENTIMENT_REVERSAL = 'SENTIMENT_REVERSAL',
  VOLATILITY_BREAKOUT = 'VOLATILITY_BREAKOUT',
  CUSTOM = 'CUSTOM',
}

export enum BacktestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface CompareStrategiesConfig {
  strategyIds: string[];
  symbol: string;
  startTime: Date;
  endTime: Date;
  initialCapital: number;
}

export interface OptimizeStrategyConfig {
  strategyId: string;
  symbol: string;
  startTime: Date;
  endTime: Date;
  initialCapital: number;
  parameterRanges: Record<string, { min: number; max: number; step: number }>;
  optimizationMetric: 'totalReturn' | 'sharpeRatio' | 'profitFactor' | 'winRate';
  maxIterations?: number;
}

export interface OptimizationResult {
  strategyId: string;
  bestParameters: Record<string, any>;
  bestResult: BacktestResult;
  allResults: BacktestResult[];
  totalIterations: number;
}