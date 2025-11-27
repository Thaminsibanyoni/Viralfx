import {
  Entity,
  Column,
  OneToMany,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsString, IsEnum, IsOptional, IsArray, IsNumber, Min, Max, IsDateString, IsBoolean } from 'class-validator';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';
import { TrendPriceHistory } from './trend-price-history.entity';
import { MarketData } from './market-data.entity';
import { ModerationTask } from './moderation-task.entity';
import { BacktestingResult } from './backtesting-result.entity';
import { User } from './user.entity';

export enum TrendCategory {
  CELEBEX = 'CELEBEX',
  BRANDPULSE = 'BRANDPULSE',
  EDUWAVE = 'EDUWAVE',
  POLITIX = 'POLITIX',
  ENTERTAIN360 = 'ENTERTAIN360',
  TRENDBASE = 'TRENDBASE',
}

export enum TrendStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
}

export enum ModerationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
}

@Entity('trends')
@Index(['symbol'])
@Index(['category'])
@Index(['status'])
@Index(['moderationStatus'])
@Index(['viralityScore'])
@Index(['createdAt'])
@Index(['isActive'])
@Index(['category', 'status', 'isActive'])
@Index(['viralityScore', 'engagementRate'])
@Index(['currentPrice', 'volatilityScore'])
@Index(['platform', 'category'])
export class Trend extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  @IsString()
  symbol: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  @IsString()
  name: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @Column({
    type: 'enum',
    enum: TrendCategory,
  })
  @IsEnum(TrendCategory)
  category: TrendCategory;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'source_url',
  })
  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  author?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  keywords?: string[];

  @Column({
    type: 'json',
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  hashtags?: string[];

  @Column({
    type: 'text',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  content?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  mediaUrls?: string[];

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0.00,
    name: 'virality_score',
  })
  @Min(0)
  @Max(100)
  viralityScore: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0.00,
    name: 'engagement_rate',
  })
  @Min(0)
  @Max(100)
  engagementRate: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0.00,
    name: 'sentiment_score',
  })
  @Min(-1)
  @Max(1)
  sentimentScore: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0.00,
    name: 'content_risk_score',
  })
  @Min(0)
  @Max(100)
  contentRiskScore: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'market_cap',
  })
  @Min(0)
  marketCap: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'circulating_supply',
  })
  @Min(0)
  circulatingSupply: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
    name: 'max_supply',
  })
  @IsOptional()
  @Min(0)
  maxSupply?: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'current_price',
  })
  @Min(0)
  currentPrice: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0.0000,
    name: 'price_24h_change',
  })
  price24hChange: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'volume_24h',
  })
  @Min(0)
  volume24h: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0.00,
    name: 'liquidity_score',
  })
  @Min(0)
  @Max(100)
  liquidityScore: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0.00,
    name: 'volatility_score',
  })
  @Min(0)
  @Max(100)
  volatilityScore: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0.00,
    name: 'trend_strength',
  })
  @Min(0)
  @Max(100)
  trendStrength: number;

  @Column({
    type: 'int',
    nullable: true,
    name: 'predicted_lifespan',
  })
  @IsOptional()
  @Min(1)
  predictedLifespan?: number; // in hours

  @Column({
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.PENDING,
    name: 'moderation_status',
  })
  @IsEnum(ModerationStatus)
  moderationStatus: ModerationStatus;

  @Column({
    type: 'text',
    nullable: true,
    name: 'moderation_reason',
  })
  @IsOptional()
  @IsString()
  moderationReason?: string;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'moderated_by',
  })
  @IsOptional()
  moderatedBy?: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'moderated_at',
  })
  @IsOptional()
  moderatedAt?: Date;

  @Column({
    type: 'enum',
    enum: TrendStatus,
    default: TrendStatus.PENDING,
  })
  @IsEnum(TrendStatus)
  status: TrendStatus;

  @Column({
    type: 'boolean',
    default: true,
    name: 'is_active',
  })
  @IsBoolean()
  isActive: boolean;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'launched_at',
  })
  @IsOptional()
  @IsDateString()
  launchedAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'expires_at',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @Column({
    type: 'json',
    default: () => "'{}'",
  })
  @IsOptional()
  metadata: Record<string, any>;

  // Relationships
  @OneToMany(() => Order, (order) => order.trend)
  orders: Order[];

  @OneToMany(() => TrendPriceHistory, (history) => history.trend)
  priceHistory: TrendPriceHistory[];

  @OneToMany(() => MarketData, (data) => data.trend)
  marketData: MarketData[];

  @OneToMany(() => ModerationTask, (task) => task)
  moderationTasks: ModerationTask[];

  @OneToMany(() => BacktestingResult, (result) => result.trend)
  backtestingResults: BacktestingResult[];

  @ManyToOne(() => User, (user) => user.assignedModerationTasks)
  @JoinColumn({ name: 'moderated_by' })
  moderator?: User;

  // Computed properties
  get isApproved(): boolean {
    return this.status === TrendStatus.APPROVED;
  }

  get isTradable(): boolean {
    return this.isActive && this.isApproved && this.currentPrice > 0;
  }

  get isHighRisk(): boolean {
    return this.contentRiskScore > 70 || this.volatilityScore > 80;
  }

  get isTrending(): boolean {
    return this.viralityScore > 75 && this.engagementRate > 60;
  }

  get daysSinceLaunch(): number {
    if (!this.launchedAt) return 0;
    const now = new Date();
    const diff = now.getTime() - new Date(this.launchedAt).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  get isExpiringSoon(): boolean {
    if (!this.expiresAt) return false;
    const now = new Date();
    const expiresAt = new Date(this.expiresAt);
    const diff = expiresAt.getTime() - now.getTime();
    return diff > 0 && diff < (24 * 60 * 60 * 1000); // Less than 24 hours
  }

  protected validate(): void {
    // Validate score ranges
    if (this.viralityScore < 0 || this.viralityScore > 100) {
      throw new Error('Virality score must be between 0 and 100');
    }
    if (this.engagementRate < 0 || this.engagementRate > 100) {
      throw new Error('Engagement rate must be between 0 and 100');
    }
    if (this.sentimentScore < -1 || this.sentimentScore > 1) {
      throw new Error('Sentiment score must be between -1 and 1');
    }
    if (this.contentRiskScore < 0 || this.contentRiskScore > 100) {
      throw new Error('Content risk score must be between 0 and 100');
    }
    if (this.liquidityScore < 0 || this.liquidityScore > 100) {
      throw new Error('Liquidity score must be between 0 and 100');
    }
    if (this.volatilityScore < 0 || this.volatilityScore > 100) {
      throw new Error('Volatility score must be between 0 and 100');
    }
    if (this.trendStrength < 0 || this.trendStrength > 100) {
      throw new Error('Trend strength must be between 0 and 100');
    }

    // Validate financial values
    if (this.marketCap < 0) {
      throw new Error('Market cap cannot be negative');
    }
    if (this.circulatingSupply < 0) {
      throw new Error('Circulating supply cannot be negative');
    }
    if (this.maxSupply !== undefined && this.maxSupply < 0) {
      throw new Error('Max supply cannot be negative');
    }
    if (this.currentPrice < 0) {
      throw new Error('Current price cannot be negative');
    }
    if (this.volume24h < 0) {
      throw new Error('24h volume cannot be negative');
    }

    // Validate supply constraints
    if (this.maxSupply !== undefined && this.circulatingSupply > this.maxSupply) {
      throw new Error('Circulating supply cannot exceed max supply');
    }

    // Validate symbol format (VIRAL/SA_XXX_001)
    const symbolPattern = /^VIRAL\/[A-Z]{2}_[A-Z0-9_]+$/;
    if (!symbolPattern.test(this.symbol)) {
      throw new Error('Invalid symbol format. Expected format: VIRAL/SA_TREND_NAME_001');
    }

    // Validate business logic
    if (this.launchedAt && this.expiresAt && new Date(this.launchedAt) >= new Date(this.expiresAt)) {
      throw new Error('Launch date must be before expiration date');
    }

    if (this.predictedLifespan !== undefined && this.predictedLifespan <= 0) {
      throw new Error('Predicted lifespan must be positive');
    }
  }
}