import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { BacktestingStrategy } from './backtesting-strategy.entity';
import { Trend } from './trend.entity';

export enum BacktestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
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

@Entity('backtesting_results')
@Index(['strategyId'])
@Index(['symbol'])
@Index(['startTime'])
@Index(['endTime'])
@Index(['status'])
@Index(['totalReturn'])
@Index(['sharpeRatio'])
export class BacktestingResult extends BaseEntity {
  @Column({ type: 'uuid' })
  strategyId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'timestamp with time zone' })
  startTime: Date;

  @Column({ type: 'timestamp with time zone' })
  endTime: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 10000 })
  initialCapital: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  finalCapital: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  totalReturn: number;

  @Column({ type: 'decimal', precision: 8, scale: 4 })
  sharpeRatio: number;

  @Column({ type: 'decimal', precision: 8, scale: 4 })
  maxDrawdown: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  winRate: number;

  @Column({ type: 'integer', default: 0 })
  totalTrades: number;

  @Column({ type: 'integer', default: 0 })
  winningTrades: number;

  @Column({ type: 'integer', default: 0 })
  losingTrades: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  avgWin: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  avgLoss: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  profitFactor: number;

  @Column({
    type: 'jsonb',
    array: false,
    default: () => "'[]'::jsonb",
  })
  trades: BacktestTrade[];

  @Column({
    type: 'jsonb',
    array: false,
    default: () => "'[]'::jsonb",
  })
  equity: EquityPoint[];

  @Column({ type: 'jsonb', nullable: true })
  parameters: Record<string, any>;

  @Column({
    type: 'enum',
    enum: BacktestStatus,
    default: BacktestStatus.PENDING,
  })
  status: BacktestStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'integer', default: 0 })
  executionTime: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => BacktestingStrategy, strategy => strategy.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'strategyId' })
  strategy: BacktestingStrategy;

  @ManyToOne(() => Trend, trend => trend.id, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'trendId' })
  trend: Trend;

  @Column({ type: 'uuid', nullable: true })
  trendId: string;
}