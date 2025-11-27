// Backtesting DTOs
export { BacktestConfigDto } from './backtest-config.dto';

// Strategy DTOs
export {
  CreateStrategyDto,
  StrategyParameterDto,
  StrategyRuleDto,
  StrategyRuleCriterionDto,
} from './create-strategy.dto';

// Analytics DTOs
export { AnalyticsQueryDto } from './analytics-query.dto';

// Additional DTOs that would be created:
export class UpdateStrategyDto {
  name?: string;
  description?: string;
  category?: string;
  parameters?: any[];
  rules?: any[];
  isPublic?: boolean;
}

export class BacktestQueryDto {
  strategyId?: string;
  symbol?: string;
  userId?: string;
  startTime?: Date;
  endTime?: Date;
  page?: number;
  limit?: number;
}

export class CompareStrategiesDto {
  strategyIds: string[];
  symbol: string;
  startTime: Date;
  endTime: Date;
  initialCapital?: number;
}

export class OptimizeStrategyDto {
  strategyId: string;
  symbol: string;
  startTime: Date;
  endTime: Date;
  parameterRanges: Record<string, { min: number; max: number; step: number }>;
  optimizationMetric?: 'totalReturn' | 'sharpeRatio' | 'profitFactor' | 'winRate';
  maxIterations?: number;
}

export class PerformanceQueryDto {
  entityType: string;
  entityId: string;
  period: string;
}

export class LeaderboardQueryDto {
  metricType?: string;
  period?: string;
  limit?: number;
  entityType?: 'STRATEGY' | 'USER';
}

export class CreateReportDto {
  type: 'backtest' | 'performance' | 'comparison' | 'trend_analysis';
  entityType: 'strategy' | 'user' | 'symbol';
  entityId: string;
  period: string;
  format?: 'json' | 'csv' | 'pdf';
  options?: {
    includeCharts?: boolean;
    includeTrades?: boolean;
    benchmark?: string;
    customMetrics?: string[];
  };
}