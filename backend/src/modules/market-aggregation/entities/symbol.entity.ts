import { Entity, PrimaryGeneratedColumn, Column, Index, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Price } from './price.entity';
import { Order } from './order.entity';
import { Market } from './market.entity';
import { Portfolio } from './portfolio.entity';

export enum SymbolStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELISTED = 'DELISTED'
}

@Entity('symbols')
export class Symbol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  symbol: string;

  @Column({ nullable: true })
  @Index()
  topicId: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column()
  region: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 100.00 })
  basePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  @Index()
  currentPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  lastViralityScore: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  lastVelocity: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  lastSentiment: number;

  @Column({
    type: 'enum',
    enum: SymbolStatus,
    default: SymbolStatus.ACTIVE
  })
  @Index()
  status: SymbolStatus;

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalVolume: number;

  @Column({ default: 0 })
  totalTrades: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  high24h: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  low24h: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceChange24h: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  priceChangePercent24h: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  @Index()
  volume24h: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    keywords?: string[];
    hashtags?: string[];
    platforms?: string[];
    [key: string]: any;
  };

  @Column({ nullable: true })
  listedAt: Date;

  @Column({ nullable: true })
  delistedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => Price, price => price.symbolEntity)
  prices: Price[];

  @OneToMany(() => Order, order => order.symbolEntity)
  orders: Order[];

  @OneToMany(() => Portfolio, portfolio => portfolio.symbolEntity)
  portfolios: Portfolio[];

  @ManyToOne(() => Market, market => market.symbols)
  @JoinColumn({ name: 'marketId' })
  market: Market;

  // Getters
  get is_trending(): boolean {
    return (
      this.volume24h > 1000000 &&
      this.priceChangePercent24h !== null &&
      Math.abs(this.priceChangePercent24h) > 5
    );
  }

  get market_cap(): number {
    return this.currentPrice ? this.currentPrice * this.totalVolume : 0;
  }
}