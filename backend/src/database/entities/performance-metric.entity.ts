import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { BacktestingStrategy } from './backtesting-strategy.entity';

export enum EntityType {
  STRATEGY = 'STRATEGY',
  USER = 'USER',
  SYMBOL = 'SYMBOL',
}

export enum MetricType {
  TOTAL_RETURN = 'TOTAL_RETURN',
  SHARPE_RATIO = 'SHARPE_RATIO',
  MAX_DRAWDOWN = 'MAX_DRAWDOWN',
  WIN_RATE = 'WIN_RATE',
  PROFIT_FACTOR = 'PROFIT_FACTOR',
  VOLATILITY = 'VOLATILITY',
  ALPHA = 'ALPHA',
  BETA = 'BETA',
  TOTAL_TRADES = 'TOTAL_TRADES',
  AVG_WIN = 'AVG_WIN',
  AVG_LOSS = 'AVG_LOSS',
  CALMAR_RATIO = 'CALMAR_RATIO',
  SORTINO_RATIO = 'SORTINO_RATIO',
}

export enum Period {
  ONE_DAY = '1D',
  SEVEN_DAYS = '7D',
  THIRTY_DAYS = '30D',
  NINETY_DAYS = '90D',
  ONE_YEAR = '1Y',
  ALL_TIME = 'ALL_TIME',
}

@Entity('performance_metrics')
@Index(['entityType', 'entityId', 'metricType', 'period'])
@Index(['entityType', 'metricType', 'timestamp'])
@Index(['entityId', 'timestamp'])
export class PerformanceMetric extends BaseEntity {
  @Column({
    type: 'enum',
    enum: EntityType,
  })
  entityType: EntityType;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({
    type: 'enum',
    enum: MetricType,
  })
  metricType: MetricType;

  @Column({ type: 'decimal', precision: 15, scale: 6 })
  metricValue: number;

  @Column({
    type: 'enum',
    enum: Period,
  })
  period: Period;

  @Column({ type: 'timestamp with time zone' })
  startTime: Date;

  @Column({ type: 'timestamp with time zone' })
  endTime: Date;

  @Column({ type: 'integer', default: 0 })
  sampleSize: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    benchmark?: string;
    riskAdjustedReturn?: number;
    confidenceInterval?: [number, number];
    additionalContext?: Record<string, any>;
  };

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @ManyToOne(() => BacktestingStrategy, strategy => strategy.id, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entityId' })
  strategy?: BacktestingStrategy;

  // Validation method
  validateMetric() {
    if (this.endTime <= this.startTime) {
      throw new Error('End time must be after start time');
    }

    if (this.sampleSize < 0) {
      throw new Error('Sample size cannot be negative');
    }

    // Validate metric ranges based on type
    switch (this.metricType) {
      case MetricType.WIN_RATE:
        if (this.metricValue < 0 || this.metricValue > 100) {
          throw new Error('Win rate must be between 0 and 100');
        }
        break;
      case MetricType.SHARPE_RATIO:
        // Sharpe ratio can be negative but extreme values suggest errors
        if (Math.abs(this.metricValue) > 100) {
          throw new Error('Sharpe ratio appears unrealistic');
        }
        break;
      case MetricType.MAX_DRAWDOWN:
        if (this.metricValue < 0 || this.metricValue > 100) {
          throw new Error('Max drawdown must be between 0 and 100');
        }
        break;
    }
  }
}