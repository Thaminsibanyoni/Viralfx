import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Symbol } from './symbol.entity';

export enum PriceInterval {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1d'
}

@Entity('prices')
export class Price {
  @PrimaryGeneratedColumn('bigint')
  id: string;

  @Column()
  @Index()
  symbol: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  open: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  high: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  low: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  close: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  volume: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  viralityScore: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  velocity: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  sentiment: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  orderBookImbalance: number;

  @Column({ type: 'timestamp with time zone' })
  @Index()
  timestamp: Date;

  @Column({
    type: 'enum',
    enum: PriceInterval,
    default: PriceInterval.ONE_MINUTE
  })
  @Index()
  interval: PriceInterval;

  // Relationships
  @ManyToOne(() => Symbol, symbol => symbol.prices, { eager: false })
  @JoinColumn({ name: 'symbol', referencedColumnName: 'symbol' })
  symbolEntity: Symbol;

  // Composite index for time-series queries
  // Note: These would typically be added via migration
  // CREATE INDEX idx_prices_symbol_timestamp ON prices(symbol, timestamp DESC);
  // CREATE INDEX idx_prices_symbol_interval_timestamp ON prices(symbol, interval, timestamp DESC);
}