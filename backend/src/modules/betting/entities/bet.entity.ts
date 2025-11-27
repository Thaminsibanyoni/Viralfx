import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Trend } from '../../database/entities/trend.entity';

export enum BetStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  WON = 'WON',
  LOST = 'LOST',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum BetType {
  VIRALITY_PREDICTION = 'VIRALITY_PREDICTION',
  TREND_DIRECTION = 'TREND_DIRECTION',
  PRICE_MOVEMENT = 'PRICE_MOVEMENT',
  SENTIMENT_OUTCOME = 'SENTIMENT_OUTCOME'
}

@Entity('bets')
export class Bet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'trend_id' })
  trendId: string;

  @ManyToOne(() => Trend)
  @JoinColumn({ name: 'trend_id' })
  trend: Trend;

  @Column({
    type: 'enum',
    enum: BetType,
    name: 'bet_type'
  })
  betType: BetType;

  @Column({
    type: 'enum',
    enum: BetStatus,
    default: BetStatus.PENDING,
    name: 'status'
  })
  status: BetStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'amount' })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'odds' })
  odds: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'potential_payout' })
  potentialPayout: number;

  @Column({ type: 'jsonb', nullable: true, name: 'bet_data' })
  betData: any;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'actual_payout' })
  actualPayout: number;

  @Column({ type: 'text', nullable: true, name: 'settlement_reason' })
  settlementReason: string;

  @Column({ type: 'timestamp', nullable: true, name: 'settled_at' })
  settledAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}