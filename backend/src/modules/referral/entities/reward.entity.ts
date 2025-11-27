import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import { Referral } from './referral.entity';

export enum RewardType {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  DISCOUNT = 'DISCOUNT',
  FEATURES = 'FEATURES',
}

export enum RewardStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('rewards')
@Index(['userId'])
@Index(['referralId'])
@Index(['status'])
@Index(['expiresAt'])
export class Reward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'referral_id', nullable: true })
  referralId: string;

  @Column({
    type: 'enum',
    enum: RewardType,
  })
  rewardType: RewardType;

  @Column({ name: 'reward_amount', type: 'decimal', precision: 10, scale: 2 })
  rewardAmount: number;

  @Column({ length: 3, default: 'ZAR' })
  currency: string;

  @Column({
    type: 'enum',
    enum: RewardStatus,
    default: RewardStatus.PENDING,
  })
  status: RewardStatus;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    tierMultiplier?: number;
    bonusAmount?: number;
    transactionId?: string;
    walletAddress?: string;
    claimCode?: string;
    features?: string[];
    discountCode?: string;
    discountPercentage?: number;
  };

  @ManyToOne(() => User, user => user.rewards)
  user: User;

  @ManyToOne(() => Referral, referral => referral.rewards)
  referral: Referral;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}