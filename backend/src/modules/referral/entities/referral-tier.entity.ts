import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TierName {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
}

@Entity('referral_tiers')
export class ReferralTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: TierName,
    unique: true,
  })
  name: TierName;

  @Column({ name: 'min_referrals' })
  minReferrals: number;

  @Column({ name: 'max_referrals', nullable: true })
  maxReferrals: number;

  @Column({ name: 'reward_multiplier', type: 'decimal', precision: 5, scale: 2 })
  rewardMultiplier: number;

  @Column({ name: 'bonus_reward', type: 'decimal', precision: 10, scale: 2, default: 0 })
  bonusReward: number;

  @Column({ type: 'jsonb', nullable: true })
  features: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  tierConfig: {
    baseRewardAmount: number;
    rewardCurrency: string;
    expiryDays?: number;
    maxRewardsPerPeriod?: number;
    rewardPeriodDays?: number;
    bonusConditions?: Array<{
      condition: string;
      bonusAmount: number;
    }>;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}