import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

import { Wallet } from '../entities/wallet.entity';
import { Transaction } from '../entities/transaction.entity';
import { WalletTransactionDto } from '../dto/wallet-transaction.dto';
import { LedgerService } from './ledger.service';
import { CurrencyConverterService } from './currency-converter.service';
import { WebSocketGateway } from '../../websocket/gateways/websocket.gateway';
import { RecordTransactionParams, ConversionResult, PortfolioValue } from '../../order-matching/interfaces/order-matching.interface';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
    private readonly ledgerService: LedgerService,
    private readonly currencyConverterService: CurrencyConverterService,
    private readonly webSocketGateway: WebSocketGateway,
  ) {}

  /**
   * Create a new wallet for a user
   */
  async createWallet(userId: string, currency: string, type: 'TRADING' | 'SAVINGS' = 'TRADING'): Promise<Wallet> {
    try {
      // Check if wallet already exists
      const existingWallet = await this.walletRepository.findOne({
        where: { userId, currency, wallet_type: type }
      });

      if (existingWallet) {
        throw new ConflictException(`Wallet already exists for user ${userId} and currency ${currency}`);
      }

      // Create new wallet
      const wallet = this.walletRepository.create({
        userId,
        currency: currency as any,
        wallet_type: type,
        is_default: type === 'TRADING', // Make trading wallet default
        daily_reset: this.getNextDayStart(),
        monthly_reset: this.getNextMonthStart()
      });

      const savedWallet = await this.walletRepository.save(wallet);

      this.logger.log(`Created new ${type} wallet for user ${userId} in ${currency}`);
      return savedWallet;
    } catch (error) {
      this.logger.error('Failed to create wallet:', error);
      throw error;
    }
  }

  /**
   * Get or create wallet for user and currency
   */
  async getOrCreateWallet(userId: string, currency: string): Promise<Wallet> {
    try {
      // Try to get existing wallet
      let wallet = await this.walletRepository.findOne({
        where: { userId, currency: currency as any }
      });

      // Create if doesn't exist
      if (!wallet) {
        wallet = await this.createWallet(userId, currency);
      }

      return wallet;
    } catch (error) {
      this.logger.error(`Failed to get or create wallet for user ${userId} and currency ${currency}:`, error);
      throw error;
    }
  }

  /**
   * Get all wallets for a user with balances
   */
  async getWalletsByUserId(userId: string): Promise<Wallet[]> {
    try {
      return await this.walletRepository.find({
        where: { userId },
        order: { created_at: 'ASC' }
      });
    } catch (error) {
      this.logger.error(`Failed to get wallets for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Convert and transfer funds between wallets with different currencies
   */
  async convertAndTransfer(
    fromWalletId: string,
    toWalletId: string,
    amount: number
  ): Promise<ConversionResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get both wallets
      const [fromWallet, toWallet] = await Promise.all([
        queryRunner.manager.findOne(Wallet, { where: { id: fromWalletId } }),
        queryRunner.manager.findOne(Wallet, { where: { id: toWalletId } }),
      ]);

      if (!fromWallet || !toWallet) {
        throw new Error('One or both wallets not found');
      }

      // Check if same wallet
      if (fromWalletId === toWalletId) {
        throw new Error('Cannot transfer to the same wallet');
      }

      // Convert currency if different
      if (fromWallet.currency !== toWallet.currency) {
        const exchangeRate = await this.currencyConverterService.getExchangeRate(
          fromWallet.currency,
          toWallet.currency
        );

        const conversionFee = amount * 0.005; // 0.5% conversion fee
        const netAmount = amount - conversionFee;
        const convertedAmount = netAmount * exchangeRate;

        // Create withdrawal transaction
        const withdrawalTx = await this.ledgerService.recordTransaction({
          walletId: fromWalletId,
          userId: fromWallet.userId,
          type: 'TRANSFER_OUT',
          amount: amount,
          currency: fromWallet.currency,
          description: `Currency conversion to ${toWallet.currency}`,
          metadata: {
            exchangeRate,
            conversionFee,
            targetCurrency: toWallet.currency,
            targetAmount: convertedAmount,
          },
          referenceId: fromWalletId,
          referenceType: 'CURRENCY_CONVERSION',
        });

        // Create deposit transaction
        const depositTx = await this.ledgerService.recordTransaction({
          walletId: toWalletId,
          userId: toWallet.userId,
          type: 'TRANSFER_IN',
          amount: convertedAmount,
          currency: toWallet.currency,
          description: `Currency conversion from ${fromWallet.currency}`,
          metadata: {
            exchangeRate,
            conversionFee,
            sourceCurrency: fromWallet.currency,
            sourceAmount: netAmount,
          },
          referenceId: toWalletId,
          referenceType: 'CURRENCY_CONVERSION',
        });

        await queryRunner.commitTransaction();

        return {
          fromWalletId,
          toWalletId,
          fromAmount: amount,
          toAmount: convertedAmount,
          exchangeRate,
          fee: conversionFee,
          transactions: [withdrawalTx, depositTx],
        };
      } else {
        // Simple transfer between same currency wallets
        const transactions = await this.ledgerService.recordDoubleEntry(
          fromWalletId,
          toWalletId,
          amount,
          fromWallet.currency,
          'Wallet transfer'
        );

        await queryRunner.commitTransaction();

        return {
          fromWalletId,
          toWalletId,
          fromAmount: amount,
          toAmount: amount,
          exchangeRate: 1,
          fee: 0,
          transactions,
        };
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to convert and transfer:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get portfolio value across all currencies
   */
  async getPortfolioValue(userId: string, targetCurrency: string = 'ZAR'): Promise<PortfolioValue> {
    try {
      // Check cache first
      const cacheKey = `portfolio:${userId}:${targetCurrency}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const wallets = await this.getWalletsByUserId(userId);

      // Calculate total value in target currency
      let totalValueZAR = 0;
      let totalValueUSD = 0;
      const walletDetails = [];

      for (const wallet of wallets) {
        const walletValue = wallet.total_balance;

        // Convert to ZAR and USD
        const [valueZAR, valueUSD] = await Promise.all([
          wallet.currency === 'ZAR'
            ? walletValue
            : await this.currencyConverterService.convert(walletValue, wallet.currency, 'ZAR'),
          wallet.currency === 'USD'
            ? walletValue
            : await this.currencyConverterService.convert(walletValue, wallet.currency, 'USD'),
        ]);

        totalValueZAR += valueZAR;
        totalValueUSD += valueUSD;

        walletDetails.push({
          currency: wallet.currency,
          balance: wallet.total_balance,
          valueZAR,
          valueUSD,
        });
      }

      const portfolioValue: PortfolioValue = {
        totalValueZAR,
        totalValueUSD,
        wallets: walletDetails,
        lastUpdated: new Date(),
      };

      // Cache for 1 minute
      await this.redis.setex(cacheKey, 60, JSON.stringify(portfolioValue));

      return portfolioValue;
    } catch (error) {
      this.logger.error(`Failed to get portfolio value for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Process transaction using ledger service (ledger-based implementation)
   */
  async processTransaction(params: RecordTransactionParams): Promise<Transaction>;
  async processTransaction(transactionDto: WalletTransactionDto): Promise<Transaction>;
  async processTransaction(params: RecordTransactionParams | WalletTransactionDto): Promise<Transaction> {
    try {
      let transaction: Transaction;

      if ('walletId' in params && 'userId' in params) {
        // New ledger-based implementation
        transaction = await this.ledgerService.recordTransaction(params as RecordTransactionParams);
        await this.broadcastWalletUpdate((params as RecordTransactionParams).userId);
      } else {
        // Legacy implementation using WalletTransactionDto
        transaction = await this.processLegacyTransaction(params as WalletTransactionDto);
      }

      return transaction;
    } catch (error) {
      this.logger.error('Failed to process transaction:', error);
      throw error;
    }
  }

  /**
   * Lock funds for an order (ledger-based implementation)
   */
  async lockFunds(
    userId: string,
    amount: number,
    currency: string,
    description: string
  ): Promise<{ success: boolean; message?: string }>;
  async lockFunds(walletId: string, amount: number, orderId: string): Promise<void>;
  async lockFunds(
    param1: string,
    amount: number,
    param3: string | number,
    description?: string
  ): Promise<{ success: boolean; message?: string } | void> {
    try {
      // New ledger-based implementation (userId + amount + currency + description)
      if (description !== undefined && typeof param3 === 'string') {
        const userId = param1;
        const currency = param3;

        const wallet = await this.getOrCreateWallet(userId, currency);

        if (wallet.available_balance < amount) {
          return { success: false, message: 'Insufficient available balance' };
        }

        await this.ledgerService.recordTransaction({
          walletId: wallet.id,
          userId,
          type: 'LOCK',
          amount,
          currency,
          description,
          referenceId: wallet.id,
          referenceType: 'ORDER_LOCK',
        });

        return { success: true };
      } else {
        // Legacy implementation (walletId + amount + orderId)
        const walletId = param1;
        const orderId = param3 as string;

        return await this.dataSource.transaction(async manager => {
          const wallet = await manager.findOne(Wallet, {
            where: { id: walletId }
          });

          if (!wallet) {
            throw new NotFoundException('Wallet not found');
          }

          if (wallet.available_balance < amount) {
            throw new BadRequestException('Insufficient available balance');
          }

          // Update wallet
          wallet.available_balance -= amount;
          wallet.locked_balance += amount;
          wallet.last_activity = new Date();
          await manager.save(wallet);

          // Create lock transaction
          const lockTransaction = manager.create(Transaction, {
            walletId,
            userId: wallet.userId,
            type: 'LOCK',
            amount,
            currency: wallet.currency,
            status: 'COMPLETED',
            description: `Funds locked for order ${orderId}`,
            metadata: { orderId }
          });

          await manager.save(lockTransaction);

          // Cache updated balance
          await this.cacheWalletBalance(walletId, wallet.available_balance);
        });
      }
    } catch (error) {
      this.logger.error('Failed to lock funds:', error);
      throw error;
    }
  }

  /**
   * Unlock funds from cancelled/failed order (ledger-based implementation)
   */
  async unlockFunds(
    userId: string,
    amount: number,
    currency: string,
    description: string
  ): Promise<void>;
  async unlockFunds(walletId: string, amount: number, orderId: string): Promise<void>;
  async unlockFunds(
    param1: string,
    amount: number,
    param3: string,
    description?: string
  ): Promise<void> {
    try {
      // New ledger-based implementation (userId + amount + currency + description)
      if (description !== undefined) {
        const userId = param1;
        const currency = param3;

        const wallet = await this.getOrCreateWallet(userId, currency);

        await this.ledgerService.recordTransaction({
          walletId: wallet.id,
          userId,
          type: 'UNLOCK',
          amount,
          currency,
          description,
          referenceId: wallet.id,
          referenceType: 'ORDER_UNLOCK',
        });
      } else {
        // Legacy implementation (walletId + amount + orderId)
        const walletId = param1;
        const orderId = param3;

        return await this.dataSource.transaction(async manager => {
          const wallet = await manager.findOne(Wallet, {
            where: { id: walletId }
          });

          if (!wallet) {
            throw new NotFoundException('Wallet not found');
          }

          // Update wallet
          wallet.available_balance += amount;
          wallet.locked_balance -= amount;
          wallet.last_activity = new Date();
          await manager.save(wallet);

          // Create unlock transaction
          const unlockTransaction = manager.create(Transaction, {
            walletId,
            userId: wallet.userId,
            type: 'UNLOCK',
            amount,
            currency: wallet.currency,
            status: 'COMPLETED',
            description: `Funds unlocked for order ${orderId}`,
            metadata: { orderId }
          });

          await manager.save(unlockTransaction);

          // Cache updated balance
          await this.cacheWalletBalance(walletId, wallet.available_balance);
        });
      }
    } catch (error) {
      this.logger.error('Failed to unlock funds:', error);
      throw error;
    }
  }

  /**
   * Get wallet by ID
   */
  async getWallet(walletId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({ where: { id: walletId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  /**
   * Get user's wallet by currency
   */
  async getUserWallet(userId: string, currency: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { userId, currency: currency as any }
    });
    if (!wallet) {
      throw new NotFoundException(`Wallet not found for user ${userId} and currency ${currency}`);
    }
    return wallet;
  }

  /**
   * Get all wallets for a user
   */
  async getUserWallets(userId: string): Promise<Wallet[]> {
    return this.walletRepository.find({
      where: { userId },
      order: { created_at: 'ASC' }
    });
  }

  /**
   * Process legacy wallet transaction using WalletTransactionDto
   */
  private async processLegacyTransaction(transactionDto: WalletTransactionDto): Promise<Transaction> {
    return await this.dataSource.transaction(async manager => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: transactionDto.walletId }
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Validate transaction
      this.validateTransaction(wallet, transactionDto);

      // Create transaction record
      const transaction = manager.create(Transaction, {
        walletId: transactionDto.walletId,
        userId: wallet.userId,
        type: transactionDto.type,
        amount: transactionDto.amount,
        currency: wallet.currency,
        status: 'PROCESSING',
        description: transactionDto.description,
        metadata: transactionDto.metadata
      });

      const savedTransaction = await manager.save(transaction);

      // Update wallet balance
      await this.updateWalletBalance(manager, wallet, transactionDto);

      // Update transaction status
      savedTransaction.status = 'COMPLETED';
      savedTransaction.completed_at = new Date();
      await manager.save(savedTransaction);

      // Update daily/monthly usage for withdrawals
      if (transactionDto.type === 'WITHDRAWAL') {
        await this.updateUsageLimits(manager, wallet, transactionDto.amount);
      }

      // Cache wallet balance for quick access
      await this.cacheWalletBalance(wallet.id, wallet.available_balance);

      this.logger.log(`Processed ${transactionDto.type} transaction: ${savedTransaction.id}`);
      return savedTransaction;
    });
  }

  /**
   * Get wallet balance (from cache if available)
   */
  async getBalance(walletId: string): Promise<{ available: number; locked: number; total: number }> {
    try {
      // Try cache first
      const cachedBalance = await this.redis.get(`wallet:balance:${walletId}`);
      if (cachedBalance) {
        const balance = JSON.parse(cachedBalance);
        return {
          available: balance.available,
          locked: balance.locked,
          total: balance.total
        };
      }

      // Get from database
      const wallet = await this.getWallet(walletId);
      return {
        available: wallet.available_balance,
        locked: wallet.locked_balance,
        total: wallet.total_balance
      };
    } catch (error) {
      this.logger.error('Failed to get wallet balance:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(walletId: string, options: {
    limit?: number;
    offset?: number;
    type?: string;
    fromDate?: Date;
    toDate?: Date;
  } = {}): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      const query = this.transactionRepository.createQueryBuilder('transaction')
        .where('walletId = :walletId', { walletId });

      if (options.type) {
        query.andWhere('type = :type', { type: options.type });
      }

      if (options.fromDate) {
        query.andWhere('created_at >= :fromDate', { fromDate: options.fromDate });
      }

      if (options.toDate) {
        query.andWhere('created_at <= :toDate', { toDate: options.toDate });
      }

      const total = await query.getCount();

      query.orderBy('created_at', 'DESC')
        .limit(options.limit || 50)
        .offset(options.offset || 0);

      const transactions = await query.getMany();

      return { transactions, total };
    } catch (error) {
      this.logger.error('Failed to get transaction history:', error);
      throw error;
    }
  }

  /**
   * Check if withdrawal is within limits
   */
  async checkWithdrawalLimits(walletId: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const wallet = await this.getWallet(walletId);

      // Check daily limit
      if (wallet.is_daily_limit_exceeded) {
        return { allowed: false, reason: 'Daily withdrawal limit exceeded' };
      }

      if (wallet.daily_limit_remaining < amount) {
        return { allowed: false, reason: 'Insufficient daily limit remaining' };
      }

      // Check monthly limit
      if (wallet.is_monthly_limit_exceeded) {
        return { allowed: false, reason: 'Monthly withdrawal limit exceeded' };
      }

      if (wallet.monthly_limit_remaining < amount) {
        return { allowed: false, reason: 'Insufficient monthly limit remaining' };
      }

      return { allowed: true };
    } catch (error) {
      this.logger.error('Failed to check withdrawal limits:', error);
      throw error;
    }
  }

  /**
   * Update wallet settings
   */
  async updateWalletSettings(walletId: string, settings: Partial<Wallet['settings']>): Promise<Wallet> {
    try {
      const wallet = await this.getWallet(walletId);

      wallet.settings = {
        ...wallet.settings,
        ...settings
      };

      await this.walletRepository.save(wallet);

      this.logger.log(`Updated settings for wallet ${walletId}`);
      return wallet;
    } catch (error) {
      this.logger.error('Failed to update wallet settings:', error);
      throw error;
    }
  }

  /**
   * Freeze wallet (admin function)
   */
  async freezeWallet(walletId: string, reason: string): Promise<Wallet> {
    try {
      const wallet = await this.getWallet(walletId);

      wallet.status = 'FROZEN';
      wallet.metadata = {
        ...wallet.metadata,
        freeze_reason: reason,
        frozen_at: new Date()
      };

      await this.walletRepository.save(wallet);

      this.logger.log(`Froze wallet ${walletId}: ${reason}`);
      return wallet;
    } catch (error) {
      this.logger.error('Failed to freeze wallet:', error);
      throw error;
    }
  }

  /**
   * Unfreeze wallet (admin function)
   */
  async unfreezeWallet(walletId: string): Promise<Wallet> {
    try {
      const wallet = await this.getWallet(walletId);

      wallet.status = 'ACTIVE';
      wallet.metadata = {
        ...wallet.metadata,
        freeze_reason: null,
        frozen_at: null,
        unfrozen_at: new Date()
      };

      await this.walletRepository.save(wallet);

      this.logger.log(`Unfroze wallet ${walletId}`);
      return wallet;
    } catch (error) {
      this.logger.error('Failed to unfreeze wallet:', error);
      throw error;
    }
  }

  /**
   * Validate transaction
   */
  private validateTransaction(wallet: Wallet, transaction: WalletTransactionDto): void {
    // Check wallet status
    if (wallet.status !== 'ACTIVE') {
      throw new BadRequestException('Wallet is not active');
    }

    // Check withdrawal limits
    if (transaction.type === 'WITHDRAWAL') {
      if (wallet.available_balance < transaction.amount) {
        throw new BadRequestException('Insufficient available balance');
      }
    }

    // Check minimum amounts
    if (transaction.amount <= 0) {
      throw new BadRequestException('Transaction amount must be positive');
    }

    if (transaction.type === 'WITHDRAWAL' && transaction.amount < 10) {
      throw new BadRequestException('Minimum withdrawal amount is 10');
    }
  }

  /**
   * Update wallet balance
   */
  private async updateWalletBalance(manager: any, wallet: Wallet, transaction: WalletTransactionDto): Promise<void> {
    switch (transaction.type) {
      case 'DEPOSIT':
        wallet.available_balance += transaction.amount;
        wallet.total_balance += transaction.amount;
        break;
      case 'WITHDRAWAL':
        wallet.available_balance -= transaction.amount;
        wallet.total_balance -= transaction.amount;
        break;
      case 'TRANSFER_IN':
        wallet.available_balance += transaction.amount;
        wallet.total_balance += transaction.amount;
        break;
      case 'TRANSFER_OUT':
        if (wallet.available_balance < transaction.amount) {
          throw new BadRequestException('Insufficient available balance');
        }
        wallet.available_balance -= transaction.amount;
        wallet.total_balance -= transaction.amount;
        break;
      default:
        throw new BadRequestException(`Unsupported transaction type: ${transaction.type}`);
    }

    wallet.last_activity = new Date();
    await manager.save(wallet);
  }

  /**
   * Update usage limits
   */
  private async updateUsageLimits(manager: any, wallet: Wallet, amount: number): Promise<void> {
    // Reset limits if needed
    if (this.shouldResetDailyLimit(wallet)) {
      wallet.daily_used = 0;
      wallet.daily_reset = this.getNextDayStart();
    }

    if (this.shouldResetMonthlyLimit(wallet)) {
      wallet.monthly_used = 0;
      wallet.monthly_reset = this.getNextMonthStart();
    }

    // Update usage
    wallet.daily_used += amount;
    wallet.monthly_used += amount;

    await manager.save(wallet);
  }

  /**
   * Cache wallet balance
   */
  private async cacheWalletBalance(walletId: string, balance: number): Promise<void> {
    await this.redis.setex(
      `wallet:balance:${walletId}`,
      60, // Cache for 1 minute
      JSON.stringify({ available: balance })
    );
  }

  /**
   * Check if daily limit should be reset
   */
  private shouldResetDailyLimit(wallet: Wallet): boolean {
    if (!wallet.daily_reset) return true;
    return new Date() >= wallet.daily_reset;
  }

  /**
   * Check if monthly limit should be reset
   */
  private shouldResetMonthlyLimit(wallet: Wallet): boolean {
    if (!wallet.monthly_reset) return true;
    return new Date() >= wallet.monthly_reset;
  }

  /**
   * Get next day start time
   */
  private getNextDayStart(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Get next month start time
   */
  private getNextMonthStart(): Date {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }

  /**
   * Broadcast wallet balance update via WebSocket
   */
  private async broadcastWalletUpdate(userId: string): Promise<void> {
    try {
      const wallets = await this.getWalletsByUserId(userId);
      const portfolioValue = await this.getPortfolioValue(userId);

      await this.webSocketGateway.broadcastWalletBalanceUpdate(userId, wallets);

      this.logger.debug(`Broadcasted wallet update for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to broadcast wallet update:', error);
    }
  }
}