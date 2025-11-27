import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from '../entities/transaction.entity';

export class TransactionResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: string;

  @ApiProperty({ description: 'Wallet ID' })
  walletId: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: [
      'DEPOSIT', 'WITHDRAWAL', 'TRADE_BUY', 'TRADE_SELL',
      'FEE', 'COMMISSION', 'TRANSFER_IN', 'TRANSFER_OUT',
      'LOCK', 'UNLOCK', 'BET_STAKE', 'BET_PAYOUT', 'BET_REFUND'
    ]
  })
  type: string;

  @ApiProperty({ description: 'Transaction amount' })
  amount: number;

  @ApiProperty({
    description: 'Transaction currency',
    enum: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH']
  })
  currency: string;

  @ApiProperty({
    description: 'Transaction status',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']
  })
  status: string;

  @ApiProperty({ description: 'Balance before transaction' })
  balanceBefore: number;

  @ApiProperty({ description: 'Balance after transaction' })
  balanceAfter: number;

  @ApiProperty({ description: 'Transaction description' })
  description: string;

  @ApiProperty({ description: 'Transaction metadata' })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Reference ID' })
  referenceId: string;

  @ApiProperty({ description: 'Reference type' })
  referenceType: string;

  @ApiProperty({ description: 'Payment provider' })
  provider: string;

  @ApiProperty({ description: 'Provider transaction ID' })
  providerTxId: string;

  @ApiProperty({ description: 'Transaction created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Transaction updated at' })
  updatedAt: Date;

  @ApiProperty({ description: 'Transaction completed at' })
  completedAt: Date;

  @ApiProperty({ description: 'Is transaction completed' })
  isCompleted: boolean;

  static toDTO(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction.id,
      walletId: transaction.walletId,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      description: transaction.description,
      metadata: transaction.metadata,
      referenceId: transaction.referenceId,
      referenceType: transaction.referenceType,
      provider: transaction.provider,
      providerTxId: transaction.providerTxId,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      completedAt: transaction.completedAt,
      isCompleted: transaction.isCompleted,
    };
  }
}