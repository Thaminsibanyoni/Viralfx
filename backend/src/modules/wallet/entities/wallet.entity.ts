import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('wallets')
@Index(['user_id', 'currency'])
@Index(['user_id', 'is_default'])
export class Wallet {
  @ApiProperty({ description: 'Unique wallet identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID who owns the wallet' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'Wallet currency' })
  @Column({
    type: 'enum',
    enum: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH']
  })
  currency: 'ZAR' | 'USD' | 'EUR' | 'BTC' | 'ETH';

  @ApiProperty({ description: 'Available balance' })
  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  available_balance: number;

  @ApiProperty({ description: 'Total balance including locked funds' })
  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  total_balance: number;

  @ApiProperty({ description: 'Locked balance (pending orders, withdrawals)' })
  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  locked_balance: number;

  @ApiProperty({ description: 'Is this the default wallet for the currency' })
  @Column({ name: 'is_default', default: false })
  is_default: boolean;

  @ApiProperty({ description: 'Wallet status' })
  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'FROZEN', 'SUSPENDED', 'CLOSED'],
    default: 'ACTIVE'
  })
  status: 'ACTIVE' | 'FROZEN' | 'SUSPENDED' | 'CLOSED';

  @ApiProperty({ description: 'Wallet type' })
  @Column({
    type: 'enum',
    enum: ['TRADING', 'SAVINGS', 'INVESTMENT', 'CUSTODIAL']
  })
  wallet_type: 'TRADING' | 'SAVINGS' | 'INVESTMENT' | 'CUSTODIAL';

  @ApiProperty({ description: 'Wallet level' })
  @Column({
    type: 'enum',
    enum: ['BASIC', 'VERIFIED', 'PREMIUM', 'ENTERPRISE'],
    default: 'BASIC'
  })
  level: 'BASIC' | 'VERIFIED' | 'PREMIUM' | 'ENTERPRISE';

  @ApiProperty({ description: 'Daily withdrawal limit' })
  @Column({ name: 'daily_limit', type: 'decimal', precision: 15, scale: 2, nullable: true })
  daily_limit: number;

  @ApiProperty({ description: 'Daily withdrawal amount used' })
  @Column({ name: 'daily_used', type: 'decimal', precision: 15, scale: 2, default: 0 })
  daily_used: number;

  @ApiProperty({ description: 'Last daily limit reset timestamp' })
  @Column({ name: 'daily_reset', type: 'timestamp', nullable: true })
  daily_reset: Date;

  @ApiProperty({ description: 'Monthly withdrawal limit' })
  @Column({ name: 'monthly_limit', type: 'decimal', precision: 15, scale: 2, nullable: true })
  monthly_limit: number;

  @ApiProperty({ description: 'Monthly withdrawal amount used' })
  @Column({ name: 'monthly_used', type: 'decimal', precision: 15, scale: 2, default: 0 })
  monthly_used: number;

  @ApiProperty({ description: 'Last monthly limit reset timestamp' })
  @Column({ name: 'monthly_reset', type: 'timestamp', nullable: true })
  monthly_reset: Date;

  @ApiProperty({ description: 'Wallet metadata' })
  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Wallet settings' })
  @Column('jsonb', { nullable: true })
  settings: {
    auto_withdraw?: boolean;
    withdrawal_address?: string;
    two_factor_required?: boolean;
    notifications?: {
      deposit?: boolean;
      withdrawal?: boolean;
      low_balance?: boolean;
    };
    risk_management?: {
      max_single_withdrawal?: number;
      require_verification_above?: number;
    };
  };

  @ApiProperty({ description: 'Wallet created timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ApiProperty({ description: 'Wallet updated timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ApiProperty({ description: 'Last activity timestamp' })
  @Column({ name: 'last_activity', type: 'timestamp', nullable: true })
  last_activity: Date;

  @ApiProperty({ description: 'Is wallet verified' })
  @Column({ name: 'is_verified', default: false })
  is_verified: boolean;

  @ApiProperty({ description: 'Verification level' })
  @Column({ name: 'verification_level', type: 'smallint', default: 0 })
  verification_level: number;

  @ApiProperty({ description: 'Risk score' })
  @Column({ name: 'risk_score', type: 'decimal', precision: 3, scale: 2, default: 0 })
  risk_score: number;

  @ApiProperty({ description: 'Compliance flags' })
  @Column('simple-array', { nullable: true })
  compliance_flags: string[];

  // Relations
  @OneToMany('Transaction', 'wallet')
  transactions: any[];

  @ManyToOne('User', 'wallets')
  user: any;

  // Calculated properties
  @ApiProperty({ description: 'Available balance percentage' })
  get available_balance_percentage(): number {
    if (this.total_balance === 0) return 100;
    return (this.available_balance / this.total_balance) * 100;
  }

  @ApiProperty({ description: 'Locked balance percentage' })
  get locked_balance_percentage(): number {
    if (this.total_balance === 0) return 0;
    return (this.locked_balance / this.total_balance) * 100;
  }

  @ApiProperty({ description: 'Is wallet active' })
  get is_active(): boolean {
    return this.status === 'ACTIVE';
  }

  @ApiProperty({ description: 'Daily limit remaining' })
  get daily_limit_remaining(): number {
    if (!this.daily_limit) return Infinity;
    return Math.max(0, this.daily_limit - this.daily_used);
  }

  @ApiProperty({ description: 'Monthly limit remaining' })
  get monthly_limit_remaining(): number {
    if (!this.monthly_limit) return Infinity;
    return Math.max(0, this.monthly_limit - this.monthly_used);
  }

  @ApiProperty({ description: 'Is daily limit exceeded' })
  get is_daily_limit_exceeded(): boolean {
    if (!this.daily_limit) return false;
    return this.daily_used >= this.daily_limit;
  }

  @ApiProperty({ description: 'Is monthly limit exceeded' })
  get is_monthly_limit_exceeded(): boolean {
    if (!this.monthly_limit) return false;
    return this.monthly_used >= this.monthly_limit;
  }
}