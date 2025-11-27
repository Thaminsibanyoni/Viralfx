import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import { Reward } from './reward.entity';

export enum ReferralStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

@Entity('referrals')
@Index(['referralCode'])
@Index(['referrerId'])
@Index(['refereeId'])
@Index(['status'])
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'referrer_id' })
  referrerId: string;

  @Column({ name: 'referee_id', nullable: true })
  refereeId: string;

  @Column({ name: 'referral_code' })
  referralCode: string;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  @Column({ name: 'referral_date', type: 'timestamp', nullable: true })
  referralDate: Date;

  @Column({ name: 'completion_date', type: 'timestamp', nullable: true })
  completionDate: Date;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  expiryDate: Date;

  @Column({ name: 'total_reward_earned', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalRewardEarned: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    ipAddress?: string;
    userAgent?: string;
    referrerUrl?: string;
    conversionEvents?: Array<{
      event: string;
      timestamp: Date;
      data?: any;
    }>;
  };

  @ManyToOne(() => User, user => user.referralsGiven)
  referrer: User;

  @ManyToOne(() => User, user => user.referralsReceived)
  referee: User;

  @OneToMany(() => Reward, reward => reward.referral)
  rewards: Reward[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}