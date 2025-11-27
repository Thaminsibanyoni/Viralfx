import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRADE_BUY'
  | 'TRADE_SELL'
  | 'FEE'
  | 'COMMISSION'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'LOCK'
  | 'UNLOCK'
  | 'BET_STAKE'
  | 'BET_PAYOUT'
  | 'BET_REFUND';

export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type Currency = 'ZAR' | 'USD' | 'EUR' | 'BTC' | 'ETH';

@Entity('wallet_transactions')
@Index(['walletId', 'type', 'status'])
@Index(['userId', 'createdAt'])
@Index(['referenceId', 'referenceType'])
@Index(['provider', 'status'])
export class Transaction {
  @ApiProperty({ description: 'Unique transaction identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Wallet ID' })
  @Column({ name: 'wallet_id' })
  walletId: string;

  @ApiProperty({ description: 'User ID' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'Transaction type' })
  @Column({
    type: 'enum',
    enum: [
      'DEPOSIT',
      'WITHDRAWAL',
      'TRADE_BUY',
      'TRADE_SELL',
      'FEE',
      'COMMISSION',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'LOCK',
      'UNLOCK',
      'BET_STAKE',
      'BET_PAYOUT',
      'BET_REFUND'
    ]
  })
  type: TransactionType;

  @ApiProperty({ description: 'Transaction amount' })
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: number;

  @ApiProperty({ description: 'Transaction currency' })
  @Column({
    type: 'enum',
    enum: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH']
  })
  currency: Currency;

  @ApiProperty({ description: 'Transaction status' })
  @Column({
    type: 'enum',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  })
  status: TransactionStatus;

  @ApiProperty({ description: 'Balance before transaction' })
  @Column({ name: 'balance_before', type: 'decimal', precision: 20, scale: 8 })
  balanceBefore: number;

  @ApiProperty({ description: 'Balance after transaction' })
  @Column({ name: 'balance_after', type: 'decimal', precision: 20, scale: 8 })
  balanceAfter: number;

  @ApiProperty({ description: 'Transaction description', required: false })
  @Column({ nullable: true })
  description: string;

  @ApiProperty({ description: 'Transaction metadata', required: false })
  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Reference ID for linking', required: false })
  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @ApiProperty({ description: 'Reference type', required: false })
  @Column({ name: 'reference_type', nullable: true })
  referenceType: string;

  @ApiProperty({ description: 'Payment provider', required: false })
  @Column({ nullable: true })
  provider: string;

  @ApiProperty({ description: 'Provider transaction ID', required: false })
  @Column({ name: 'provider_tx_id', nullable: true })
  providerTxId: string;

  @ApiProperty({ description: 'Provider response', required: false })
  @Column({ name: 'provider_response', type: 'jsonb', nullable: true })
  providerResponse: Record<string, any>;

  @ApiProperty({ description: 'Transaction created at' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Transaction updated at' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: 'Transaction completed at', required: false })
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @ApiProperty({ description: 'Is transaction completed', required: false })
  get isCompleted(): boolean {
    return this.status === 'COMPLETED';
  }

  @ApiProperty({ description: 'Is transaction pending', required: false })
  get isPending(): boolean {
    return ['PENDING', 'PROCESSING'].includes(this.status);
  }

  @ApiProperty({ description: 'Is transaction failed', required: false })
  get isFailed(): boolean {
    return ['FAILED', 'CANCELLED'].includes(this.status);
  }

  @ApiProperty({ description: 'Is credit transaction', required: false })
  get isCredit(): boolean {
    return ['DEPOSIT', 'TRADE_SELL', 'TRANSFER_IN', 'BET_PAYOUT', 'BET_REFUND', 'UNLOCK'].includes(this.type);
  }

  @ApiProperty({ description: 'Is debit transaction', required: false })
  get isDebit(): boolean {
    return ['WITHDRAWAL', 'TRADE_BUY', 'TRANSFER_OUT', 'BET_STAKE', 'FEE', 'COMMISSION', 'LOCK'].includes(this.type);
  }

  // Relations
  @ManyToOne('Wallet', 'transactions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: any;

  @ManyToOne('User', 'transactions')
  @JoinColumn({ name: 'user_id' })
  user: any;
}