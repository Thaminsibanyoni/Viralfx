import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('markets')
@Index(['symbol', 'status'])
@Index(['is_active'])
export class Market {
  @ApiProperty({ description: 'Unique market identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Trading symbol' })
  @Column({ unique: true })
  symbol: string;

  @ApiProperty({ description: 'Market name' })
  @Column()
  name: string;

  @ApiProperty({ description: 'Market description' })
  @Column('text')
  description: string;

  @ApiProperty({ description: 'Market category' })
  @Column()
  category: string;

  @ApiProperty({ description: 'Market subcategory' })
  @Column({ nullable: true })
  subcategory: string;

  @ApiProperty({ description: 'Region code' })
  @Column({ length: 2 })
  region: string;

  @ApiProperty({ description: 'Original platform' })
  @Column()
  origin_platform: string;

  @ApiProperty({ description: 'Active platforms' })
  @Column('simple-array', { nullable: true })
  active_platforms: string[];

  @ApiProperty({ description: 'Current market status' })
  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'SUSPENDED', 'CLOSED', 'DELISTED'],
    default: 'ACTIVE'
  })
  status: string;

  @ApiProperty({ description: 'Is market currently active' })
  @Column({ default: true })
  is_active: boolean;

  @ApiProperty({ description: 'Minimum trade size' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 10.00 })
  min_trade_size: number;

  @ApiProperty({ description: 'Maximum trade size' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 100000.00 })
  max_trade_size: number;

  @ApiProperty({ description: 'Tick size for price movements' })
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0.01 })
  tick_size: number;

  @ApiProperty({ description: 'Lot size for trades' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 1.00 })
  lot_size: number;

  @ApiProperty({ description: 'Trading hours start time' })
  @Column({ type: 'time', nullable: true })
  trading_hours_start: string;

  @ApiProperty({ description: 'Trading hours end time' })
  @Column({ type: 'time', nullable: true })
  trading_hours_end: string;

  @ApiProperty({ description: 'Timezone for trading hours' })
  @Column({ default: 'Africa/Johannesburg' })
  timezone: string;

  @ApiProperty({ description: 'Market created timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ApiProperty({ description: 'Market updated timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ApiProperty({ description: 'Market listing timestamp' })
  @Column({ name: 'listed_at', type: 'timestamp' })
  listed_at: Date;

  @ApiProperty({ description: 'Market delisting timestamp' })
  @Column({ name: 'delisted_at', type: 'timestamp', nullable: true })
  delisted_at: Date;

  @ApiProperty({ description: 'Market metadata' })
  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Risk level' })
  @Column({
    type: 'enum',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'],
    default: 'MEDIUM'
  })
  risk_level: string;

  @ApiProperty({ description: 'Liquidity score' })
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.00 })
  liquidity_score: number;

  @ApiProperty({ description: 'Volatility score' })
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.00 })
  volatility_score: number;

  @ApiProperty({ description: 'Popularity score' })
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.00 })
  popularity_score: number;

  @ApiProperty({ description: 'Is this a featured market' })
  @Column({ default: false })
  is_featured: boolean;

  @ApiProperty({ description: 'Market tags' })
  @Column('simple-array', { nullable: true })
  tags: string[];

  @ApiProperty({ description: 'Market requirements for traders' })
  @Column('jsonb', { nullable: true })
  trader_requirements: {
    min_kyc_level?: number;
    min_account_balance?: number;
    required_verifications?: string[];
    restricted_regions?: string[];
  };

  @ApiProperty({ description: 'Market fees' })
  @Column('jsonb', { nullable: true })
  fees: {
    maker_fee: number;
    taker_fee: number;
    settlement_fee: number;
    currency: string;
  };

  // Relations
  @OneToMany('Price', 'market')
  prices: any[];

  @OneToMany('Order', 'market')
  orders: any[];

  @OneToMany('MarketData', 'market')
  market_data: any[];
}