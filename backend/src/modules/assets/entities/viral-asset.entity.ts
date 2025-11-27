import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, IsDate, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { Price } from './price.entity';
import { Broker } from '../../brokers/entities/broker.entity';

export enum ViralCategory {
  CELEBEX = 'CelebEx',
  BRANDPULSE = 'BrandPulse',
  EDUWAVE = 'EduWave',
  POLITIX = 'Politix',
  ENTERTAIN360 = 'Entertain360',
  TRENDBASE = 'TrendBase'
}

export enum SocialPlatform {
  TWITTER = 'twitter',
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  FACEBOOK = 'facebook'
}

export enum ContentSafetyLevel {
  SAFE = 'SAFE',
  FLAGGED = 'FLAGGED',
  BLOCKED = 'BLOCKED'
}

export enum ModerationStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED'
}

@Entity('viral_assets')
export class ViralAsset {
  @ApiProperty({ description: 'Unique viral trend identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Trading symbol (e.g., CELEB/SA_MUSIC_STAR_ALBUM)' })
  @Column({ unique: true })
  symbol: string;

  @ApiProperty({ description: 'Human-readable name' })
  @Column()
  name: string;

  @ApiProperty({ description: 'Detailed description' })
  @Column('text')
  description: string;

  @ApiProperty({ enum: ViralCategory, description: 'Core viral category' })
  @Column({
    type: 'enum',
    enum: ViralCategory
  })
  category: ViralCategory;

  @ApiProperty({ description: 'Optional subcategory' })
  @Column({ nullable: true })
  subcategory: string;

  @ApiProperty({ enum: SocialPlatform, description: 'Platform where trend originated' })
  @Column({
    type: 'enum',
    enum: SocialPlatform
  })
  origin_platform: SocialPlatform;

  @ApiProperty({
    type: [String],
    enum: SocialPlatform,
    description: 'Platforms where trend is currently active'
  })
  @Column('simple-array', { nullable: true })
  current_platforms: SocialPlatform[];

  // Metrics
  @ApiProperty({ description: '0-100 viral momentum index' })
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  momentum_score: number;

  @ApiProperty({ description: '-1.0 to +1.0 sentiment score' })
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  sentiment_index: number;

  @ApiProperty({ description: 'Speed of spread (posts/minute)' })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  virality_rate: number;

  @ApiProperty({ description: 'Engagement rate change' })
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  engagement_velocity: number;

  @ApiProperty({ description: 'Estimated unique reach' })
  @Column({ type: 'bigint', default: 0 })
  reach_estimate: number;

  // Market Data
  @ApiProperty({ description: 'Current tradable price' })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 100 })
  current_price: number;

  @ApiProperty({ description: '24-hour trading volume' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  volume_24h: number;

  @ApiProperty({ description: 'Market capitalization' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  market_cap: number;

  // Content & Safety
  @ApiProperty({ enum: ContentSafetyLevel, description: 'Content safety level' })
  @Column({
    type: 'enum',
    enum: ContentSafetyLevel,
    default: ContentSafetyLevel.SAFE
  })
  content_safety: ContentSafetyLevel;

  @ApiProperty({ description: '0-1 risk assessment score' })
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  content_risk_score: number;

  @ApiProperty({ enum: ModerationStatus, description: 'Moderation status' })
  @Column({
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.PENDING
  })
  moderation_status: ModerationStatus;

  @ApiProperty({ description: 'Last moderation review timestamp' })
  @Column({ nullable: true })
  last_moderated: Date;

  @Column({ nullable: true })
  last_moderated_by: string;

  // Broker Integration
  @ApiProperty({ description: 'Available for broker trading' })
  @Column({ default: true })
  broker_interest: boolean;

  @ApiProperty({ description: 'Sponsoring broker IDs' })
  @ManyToMany(() => Broker, broker => broker.sponsored_assets)
  @JoinTable({
    name: 'broker_sponsored_assets',
    joinColumn: { name: 'asset_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'broker_id', referencedColumnName: 'id' }
  })
  sponsoring_brokers: Broker[];

  @ApiProperty({ description: 'Brokers featuring this asset' })
  @ManyToMany(() => Broker, broker => broker.featured_assets)
  @JoinTable({
    name: 'broker_featured_assets',
    joinColumn: { name: 'asset_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'broker_id', referencedColumnName: 'id' }
  })
  featuring_brokers: Broker[];

  // Metadata
  @ApiProperty({ description: 'First detection timestamp' })
  @CreateDateColumn({ name: 'first_seen' })
  first_seen: Date;

  @ApiProperty({ description: 'Peak virality time' })
  @Column({ nullable: true, type: 'timestamp' })
  peak_time: Date;

  @ApiProperty({ description: 'Asset expiration time' })
  @Column({ type: 'timestamp' })
  expiry_time: Date;

  @ApiProperty({ description: 'Source content URLs' })
  @Column('simple-array', { nullable: true })
  source_urls: string[];

  @ApiProperty({ description: 'Content keywords' })
  @Column('simple-array', { nullable: true })
  keywords: string[];

  @ApiProperty({ description: 'Geographic relevance (ISO codes)' })
  @Column('simple-array', { nullable: true })
  geographic_relevance: string[];

  @ApiProperty({ description: 'Language codes' })
  @Column('simple-array', { nullable: true })
  languages: string[];

  @ApiProperty({ description: 'Target demographics' })
  @Column('simple-array', { nullable: true })
  target_demographics: string[];

  @ApiProperty({ description: 'Asset status' })
  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'DELISTED'],
    default: 'ACTIVE'
  })
  status: string;

  @ApiProperty({ description: 'Is currently trending' })
  @Column({ default: false })
  is_trending: boolean;

  @ApiProperty({ description: 'Trending rank' })
  @Column({ nullable: true })
  trending_rank: number;

  @ApiProperty({ description: 'Created timestamp' })
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany(() => Price, price => price.asset)
  price_history: Price[];
}