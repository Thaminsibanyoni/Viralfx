import {
  Entity,
  Column,
  OneToMany,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsString, IsEnum, IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';
import { BaseEntity } from './base.entity';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';

export enum WalletType {
  SPOT = 'SPOT',
  MARGIN = 'MARGIN',
  SAVINGS = 'SAVINGS',
  STAKING = 'STAKING',
}

export enum CurrencyType {
  FIAT = 'FIAT',
  CRYPTO = 'CRYPTO',
}

@Entity('wallets')
@Index(['userId'])
@Index(['currency'])
@Index(['isActive'])
@Index(['userId', 'currency'])
@Index(['userId', 'currency', 'walletType'])
@Index(['balance'])
export class Wallet extends BaseEntity {
  @Column({
    type: 'uuid',
    name: 'user_id',
  })
  userId: string;

  @Column({
    type: 'varchar',
    length: 10,
  })
  @IsString()
  currency: string;

  @Column({
    type: 'enum',
    enum: CurrencyType,
    name: 'currency_type',
  })
  @IsEnum(CurrencyType)
  currencyType: CurrencyType;

  @Column({
    type: 'enum',
    enum: WalletType,
    default: WalletType.SPOT,
    name: 'wallet_type',
  })
  @IsEnum(WalletType)
  walletType: WalletType;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
  })
  @Min(0)
  balance: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'available_balance',
  })
  @Min(0)
  availableBalance: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'locked_balance',
  })
  @Min(0)
  lockedBalance: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'cold_balance',
  })
  @Min(0)
  coldBalance: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  memo?: string;

  @Column({
    type: 'boolean',
    default: true,
    name: 'is_active',
  })
  @IsBoolean()
  isActive: boolean;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'daily_limit',
  })
  @Min(0)
  dailyLimit: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'daily_used',
  })
  @Min(0)
  dailyUsed: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'monthly_limit',
  })
  @Min(0)
  monthlyLimit: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'monthly_used',
  })
  @Min(0)
  monthlyUsed: number;

  @Column({
    type: 'json',
    default: () => "'{}'",
  })
  @IsOptional()
  metadata: Record<string, any>;

  // Relationships
  @OneToMany(() => Transaction, (transaction) => transaction.wallet)
  transactions: Transaction[];

  @ManyToOne(() => User, (user) => user.wallets)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Computed properties
  get totalBalance(): number {
    return this.balance;
  }

  get isBalancePositive(): boolean {
    return this.balance > 0;
  }

  get hasAvailableFunds(): boolean {
    return this.availableBalance > 0;
  }

  get hasLockedFunds(): boolean {
    return this.lockedBalance > 0;
  }

  get utilizationRate(): number {
    return this.balance > 0 ? (this.lockedBalance / this.balance) * 100 : 0;
  }

  get availablePercentage(): number {
    return this.balance > 0 ? (this.availableBalance / this.balance) * 100 : 100;
  }

  get lockedPercentage(): number {
    return this.balance > 0 ? (this.lockedBalance / this.balance) * 100 : 0;
  }

  get dailyLimitRemaining(): number {
    return Math.max(0, this.dailyLimit - this.dailyUsed);
  }

  get monthlyLimitRemaining(): number {
    return Math.max(0, this.monthlyLimit - this.monthlyUsed);
  }

  get dailyLimitUsagePercentage(): number {
    return this.dailyLimit > 0 ? (this.dailyUsed / this.dailyLimit) * 100 : 0;
  }

  get monthlyLimitUsagePercentage(): number {
    return this.monthlyLimit > 0 ? (this.monthlyUsed / this.monthlyLimit) * 100 : 0;
  }

  get isNearDailyLimit(): boolean {
    return this.dailyLimitUsagePercentage >= 80;
  }

  get isNearMonthlyLimit(): boolean {
    return this.monthlyLimitUsagePercentage >= 80;
  }

  get isAtDailyLimit(): boolean {
    return this.dailyUsed >= this.dailyLimit;
  }

  get isAtMonthlyLimit(): boolean {
    return this.monthlyUsed >= this.monthlyLimit;
  }

  get isFiatCurrency(): boolean {
    return this.currencyType === CurrencyType.FIAT;
  }

  get isCryptoCurrency(): boolean {
    return this.currencyType === CurrencyType.CRYPTO;
  }

  // Utility methods
  canWithdraw(amount: number): boolean {
    return this.availableBalance >= amount && !this.isAtDailyLimit && !this.isAtMonthlyLimit;
  }

  canWithdrawWithDailyLimit(amount: number): boolean {
    return this.availableBalance >= amount && (this.dailyUsed + amount) <= this.dailyLimit && !this.isAtMonthlyLimit;
  }

  canWithdrawWithMonthlyLimit(amount: number): boolean {
    return this.availableBalance >= amount && (this.monthlyUsed + amount) <= this.monthlyLimit && !this.isAtDailyLimit;
  }

  canWithdrawWithAllLimits(amount: number): boolean {
    return (
      this.availableBalance >= amount &&
      (this.dailyUsed + amount) <= this.dailyLimit &&
      (this.monthlyUsed + amount) <= this.monthlyLimit
    );
  }

  getMaxWithdrawalAmount(): number {
    const dailyRemaining = this.dailyLimitRemaining;
    const monthlyRemaining = this.monthlyLimitRemaining;
    const availableBalance = this.availableBalance;

    return Math.min(availableBalance, dailyRemaining, monthlyRemaining);
  }

  getBalanceInBaseCurrency(baseCurrencyRate: number = 1): number {
    return this.balance * baseCurrencyRate;
  }

  // Validation methods
  protected validate(): void {
    // Balance consistency checks
    if (this.balance < 0) {
      throw new Error('Balance cannot be negative');
    }

    if (this.availableBalance < 0) {
      throw new Error('Available balance cannot be negative');
    }

    if (this.lockedBalance < 0) {
      throw new Error('Locked balance cannot be negative');
    }

    if (this.coldBalance < 0) {
      throw new Error('Cold balance cannot be negative');
    }

    // Balance relationship checks
    const calculatedBalance = this.availableBalance + this.lockedBalance + this.coldBalance;
    if (Math.abs(this.balance - calculatedBalance) > 0.00000001) {
      throw new Error('Balance inconsistency: balance must equal available + locked + cold balance');
    }

    // Limit validation
    if (this.dailyLimit < 0) {
      throw new Error('Daily limit cannot be negative');
    }

    if (this.monthlyLimit < 0) {
      throw new Error('Monthly limit cannot be negative');
    }

    if (this.dailyUsed < 0) {
      throw new Error('Daily used cannot be negative');
    }

    if (this.monthlyUsed < 0) {
      throw new Error('Monthly used cannot be negative');
    }

    // Usage consistency checks
    if (this.dailyUsed > this.dailyLimit) {
      throw new Error('Daily used cannot exceed daily limit');
    }

    if (this.monthlyUsed > this.monthlyLimit) {
      throw new Error('Monthly used cannot exceed monthly limit');
    }

    // Currency validation
    if (!this.currency || this.currency.trim().length === 0) {
      throw new Error('Currency code is required');
    }

    if (!/^[A-Z]{2,10}$/.test(this.currency)) {
      throw new Error('Currency code must be uppercase letters (2-10 characters)');
    }

    // Address validation for crypto wallets
    if (this.isCryptoCurrency && this.address && this.address.trim().length === 0) {
      throw new Error('Crypto wallet address cannot be empty if provided');
    }

    // Memo validation (common for XRP, XLM, etc.)
    if (this.memo && this.memo.trim().length > 255) {
      throw new Error('Memo cannot exceed 255 characters');
    }

    // Address format validation based on currency
    if (this.address && this.isCryptoCurrency) {
      this.validateCryptoAddress();
    }
  }

  private validateCryptoAddress(): void {
    const currency = this.currency.toUpperCase();
    const address = this.address!.trim();

    // Basic format validation for common cryptocurrencies
    switch (currency) {
      case 'BTC':
        // Bitcoin addresses start with 1, 3, or bc1
        if (!/^(1|3|bc1)/.test(address)) {
          throw new Error('Invalid Bitcoin address format');
        }
        break;

      case 'ETH':
        // Ethereum addresses are 42 characters starting with 0x
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          throw new Error('Invalid Ethereum address format');
        }
        break;

      case 'USDT':
      case 'USDC':
        // ERC-20 tokens use Ethereum addresses
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          throw new Error('Invalid ERC-20 token address format');
        }
        break;

      case 'XRP':
        // XRP addresses are 25-34 characters and start with 'r'
        if (!/^r[1-9A-HJ-NP-Za-km-z]{24,33}$/.test(address)) {
          throw new Error('Invalid XRP address format');
        }
        break;

      case 'LTC':
        // Litecoin addresses start with L, M, or 3
        if (!/^(L|M|3)/.test(address)) {
          throw new Error('Invalid Litecoin address format');
        }
        break;

      case 'BCH':
        // Bitcoin Cash addresses start with bitcoincash: or q
        if (!/^(bitcoincash:|q)/.test(address)) {
          throw new Error('Invalid Bitcoin Cash address format');
        }
        break;

      default:
        // For other cryptocurrencies, do basic length validation
        if (address.length < 10 || address.length > 100) {
          throw new Error('Invalid crypto address length');
        }
    }
  }

  // Business logic methods
  @BeforeInsert()
  protected beforeInsert() {
    super.beforeInsert();
    this.setDefaultLimits();
    this.validate();
  }

  @BeforeUpdate()
  protected beforeUpdate() {
    super.beforeUpdate();
    this.validate();
  }

  private setDefaultLimits(): void {
    // Set default limits based on currency type and wallet type
    if (this.dailyLimit === 0) {
      if (this.isFiatCurrency) {
        this.dailyLimit = 50000; // R50,000 daily limit for ZAR
        this.monthlyLimit = 500000; // R500,000 monthly limit for ZAR
      } else {
        // Higher limits for crypto due to market volatility
        this.dailyLimit = 0.5; // 0.5 BTC daily limit for BTC
        this.monthlyLimit = 5; // 5 BTC monthly limit for BTC
      }
    }
  }

  // Reset daily usage (should be called daily via scheduled job)
  resetDailyUsage(): void {
    this.dailyUsed = 0;
  }

  // Reset monthly usage (should be called monthly via scheduled job)
  resetMonthlyUsage(): void {
    this.monthlyUsed = 0;
    this.dailyUsed = 0; // Also reset daily when monthly resets
  }
}