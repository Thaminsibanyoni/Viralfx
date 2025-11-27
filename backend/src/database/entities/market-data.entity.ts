import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Trend } from './trend.entity';

export enum DataInterval {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1d',
}

@Entity('market_data')
@Index(['symbol', 'timestamp'])
@Index(['trendId', 'timestamp'])
@Index(['symbol', 'interval', 'timestamp'])
export class MarketData extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'uuid', nullable: true })
  trendId: string;

  @Column({ type: 'timestamp with time zone' })
  timestamp: Date;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  openPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  highPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  lowPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  closePrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  volume: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  viralityScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  sentimentScore: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  velocity: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  engagementRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  momentumScore: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  volatility: number;

  @Column({
    type: 'enum',
    enum: DataInterval,
    default: DataInterval.ONE_HOUR,
  })
  interval: DataInterval;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Trend, trend => trend.id, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'trendId' })
  trend: Trend;

  // Validation method to ensure data integrity
  validatePriceData() {
    if (this.highPrice < this.lowPrice) {
      throw new Error('High price cannot be less than low price');
    }
    if (this.highPrice < this.openPrice || this.highPrice < this.closePrice) {
      throw new Error('High price must be >= open and close prices');
    }
    if (this.lowPrice > this.openPrice || this.lowPrice > this.closePrice) {
      throw new Error('Low price must be <= open and close prices');
    }
    if (this.volume < 0) {
      throw new Error('Volume cannot be negative');
    }
  }
}