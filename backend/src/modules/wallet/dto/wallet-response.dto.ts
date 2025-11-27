import { ApiProperty } from '@nestjs/swagger';
import { Wallet } from '../entities/wallet.entity';

export class WalletResponseDto {
  @ApiProperty({ description: 'Wallet ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({
    description: 'Wallet currency',
    enum: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH']
  })
  currency: 'ZAR' | 'USD' | 'EUR' | 'BTC' | 'ETH';

  @ApiProperty({ description: 'Available balance' })
  availableBalance: number;

  @ApiProperty({ description: 'Total balance' })
  totalBalance: number;

  @ApiProperty({ description: 'Locked balance' })
  lockedBalance: number;

  @ApiProperty({ description: 'Is default wallet' })
  isDefault: boolean;

  @ApiProperty({
    description: 'Wallet status',
    enum: ['ACTIVE', 'FROZEN', 'SUSPENDED', 'CLOSED']
  })
  status: 'ACTIVE' | 'FROZEN' | 'SUSPENDED' | 'CLOSED';

  @ApiProperty({
    description: 'Wallet type',
    enum: ['TRADING', 'SAVINGS', 'INVESTMENT', 'CUSTODIAL']
  })
  walletType: 'TRADING' | 'SAVINGS' | 'INVESTMENT' | 'CUSTODIAL';

  @ApiProperty({
    description: 'Wallet level',
    enum: ['BASIC', 'VERIFIED', 'PREMIUM', 'ENTERPRISE']
  })
  level: 'BASIC' | 'VERIFIED' | 'PREMIUM' | 'ENTERPRISE';

  @ApiProperty({ description: 'Daily limit' })
  dailyLimit: number;

  @ApiProperty({ description: 'Daily used amount' })
  dailyUsed: number;

  @ApiProperty({ description: 'Monthly limit' })
  monthlyLimit: number;

  @ApiProperty({ description: 'Monthly used amount' })
  monthlyUsed: number;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  @ApiProperty({ description: 'Last activity' })
  lastActivity: Date;

  @ApiProperty({ description: 'Available balance percentage' })
  availableBalancePercentage: number;

  @ApiProperty({ description: 'Locked balance percentage' })
  lockedBalancePercentage: number;

  @ApiProperty({ description: 'Is wallet active' })
  isActive: boolean;

  @ApiProperty({ description: 'Daily limit remaining' })
  dailyLimitRemaining: number;

  @ApiProperty({ description: 'Monthly limit remaining' })
  monthlyLimitRemaining: number;

  @ApiProperty({ description: 'Is daily limit exceeded' })
  isDailyLimitExceeded: boolean;

  @ApiProperty({ description: 'Is monthly limit exceeded' })
  isMonthlyLimitExceeded: boolean;

  static toDTO(wallet: Wallet): WalletResponseDto {
    return {
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency,
      availableBalance: wallet.available_balance,
      totalBalance: wallet.total_balance,
      lockedBalance: wallet.locked_balance,
      isDefault: wallet.is_default,
      status: wallet.status,
      walletType: wallet.wallet_type,
      level: wallet.level,
      dailyLimit: wallet.daily_limit,
      dailyUsed: wallet.daily_used,
      monthlyLimit: wallet.monthly_limit,
      monthlyUsed: wallet.monthly_used,
      createdAt: wallet.created_at,
      updatedAt: wallet.updated_at,
      lastActivity: wallet.last_activity,
      availableBalancePercentage: wallet.available_balance_percentage,
      lockedBalancePercentage: wallet.locked_balance_percentage,
      isActive: wallet.is_active,
      dailyLimitRemaining: wallet.daily_limit_remaining,
      monthlyLimitRemaining: wallet.monthly_limit_remaining,
      isDailyLimitExceeded: wallet.is_daily_limit_exceeded,
      isMonthlyLimitExceeded: wallet.is_monthly_limit_exceeded,
    };
  }
}