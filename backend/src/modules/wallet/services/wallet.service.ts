import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { WalletTransactionDto } from '../dto/wallet-transaction.dto';
import { LedgerService } from "./ledger.service";
import { CurrencyConverterService } from "./currency-converter.service";
import { RecordTransactionParams, ConversionResult, PortfolioValue } from "../../order-matching/interfaces/order-matching.interface";

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly ledgerService: LedgerService,
    private readonly currencyConverterService: CurrencyConverterService) {}

  /**
   * Create a new wallet for a user
   */
  async createWallet(userId: string, currency: string, type: 'TRADING' | 'SAVINGS' = 'TRADING'): Promise<any> {
    try {
      // Check if wallet already exists
      const existingWallet = await this.prisma.wallet.findFirst({
        where: { userId, currency, walletType: type }
      });

      if (existingWallet) {
        throw new ConflictException(`Wallet already exists for user ${userId} and currency ${currency}`);
      }

      // Create new wallet
      const wallet = await this.prisma.wallet.create({
        data: {
          userId,
          currency,
          walletType: type,
          isDefault: type === 'TRADING',
          dailyReset: this.getNextDayStart(),
          monthlyReset: this.getNextMonthStart()
        }
      });

      this.logger.log(`Created new ${type} wallet for user ${userId} in ${currency}`);
      return wallet;
    } catch (error) {
      this.logger.error('Failed to create wallet:', error);
      throw error;
    }
  }

  /**
   * Get or create wallet for user and currency
   */
  async getOrCreateWallet(userId: string, currency: string): Promise<any> {
    try {
      // Try to get existing wallet
      let wallet = await this.prisma.wallet.findFirst({
        where: { userId, currency }
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
  async getWalletsByUserId(userId: string): Promise<any[]> {
    try {
      return await this.prisma.wallet.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
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
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Get both wallets
        const [fromWallet, toWallet] = await Promise.all([
          tx.wallet.findUnique({ where: { id: fromWalletId } }),
          tx.wallet.findUnique({ where: { id: toWalletId } }),
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
              targetAmount: convertedAmount
            },
            referenceId: fromWalletId,
            referenceType: 'CURRENCY_CONVERSION'
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
              sourceAmount: netAmount
            },
            referenceId: toWalletId,
            referenceType: 'CURRENCY_CONVERSION'
          });

          return {
            fromWalletId,
            toWalletId,
            fromAmount: amount,
            toAmount: convertedAmount,
            exchangeRate,
            fee: conversionFee,
            transactions: [withdrawalTx, depositTx]
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

          return {
            fromWalletId,
            toWalletId,
            fromAmount: amount,
            toAmount: amount,
            exchangeRate: 1,
            fee: 0,
            transactions
          };
        }
      });
    } catch (error) {
      this.logger.error('Failed to convert and transfer:', error);
      throw error;
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
        const walletValue = Number(wallet.totalBalance) || 0;

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
          balance: walletValue,
          valueZAR,
          valueUSD
        });
      }

      const portfolioValue: PortfolioValue = {
        totalValueZAR,
        totalValueUSD,
        wallets: walletDetails,
        lastUpdated: new Date()
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
   * Process transaction using ledger service
   */
  async processTransaction(params: RecordTransactionParams): Promise<any>;
  async processTransaction(transactionDto: WalletTransactionDto): Promise<any>;
  async processTransaction(params: RecordTransactionParams | WalletTransactionDto): Promise<any> {
    try {
      let transaction: any;

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
   * Lock funds for an order
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
    param3: string,
    description?: string
  ): Promise<{ success: boolean; message?: string } | void> {
    try {
      // New ledger-based implementation
      if (description !== undefined && typeof param3 === 'string') {
        const userId = param1;
        const currency = param3;

        const wallet = await this.getOrCreateWallet(userId, currency);

        if (Number(wallet.availableBalance) < amount) {
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
          referenceType: 'ORDER_LOCK'
        });

        return { success: true };
      } else {
        // Legacy implementation
        const walletId = param1;
        const orderId = param3 as string;

        await this.prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.findUnique({ where: { id: walletId } });

          if (!wallet) {
            throw new NotFoundException('Wallet not found');
          }

          if (Number(wallet.availableBalance) < amount) {
            throw new BadRequestException('Insufficient available balance');
          }

          // Update wallet
          await tx.wallet.update({
            where: { id: walletId },
            data: {
              availableBalance: { decrement: amount },
              lockedBalance: { increment: amount },
              lastActivity: new Date()
            }
          });

          // Create lock transaction
          await tx.transaction.create({
            data: {
              walletId,
              userId: wallet.userId,
              type: 'LOCK',
              amount,
              currency: wallet.currency,
              status: 'COMPLETED',
              description: `Funds locked for order ${orderId}`,
              metadata: { orderId }
            }
          });

          // Cache updated balance
          await this.cacheWalletBalance(walletId, Number(wallet.availableBalance) - amount);
        });
      }
    } catch (error) {
      this.logger.error('Failed to lock funds:', error);
      throw error;
    }
  }

  /**
   * Unlock funds from cancelled/failed order
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
      // New ledger-based implementation
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
          referenceType: 'ORDER_UNLOCK'
        });
      } else {
        // Legacy implementation
        const walletId = param1;
        const orderId = param3;

        await this.prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.findUnique({ where: { id: walletId } });

          if (!wallet) {
            throw new NotFoundException('Wallet not found');
          }

          // Update wallet
          await tx.wallet.update({
            where: { id: walletId },
            data: {
              availableBalance: { increment: amount },
              lockedBalance: { decrement: amount },
              lastActivity: new Date()
            }
          });

          // Create unlock transaction
          await tx.transaction.create({
            data: {
              walletId,
              userId: wallet.userId,
              type: 'UNLOCK',
              amount,
              currency: wallet.currency,
              status: 'COMPLETED',
              description: `Funds unlocked for order ${orderId}`,
              metadata: { orderId }
            }
          });

          // Cache updated balance
          await this.cacheWalletBalance(walletId, Number(wallet.availableBalance) + amount);
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
  async getWallet(walletId: string): Promise<any> {
    const wallet = await this.prisma.wallet.findFirst({ where: { id: walletId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  /**
   * Get a single transaction by ID for a wallet
   */
  async getTransaction(walletId: string, transactionId: string): Promise<any> {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        walletId: walletId
      }
    });

    return transaction;
  }

  /**
   * Get user's wallet by currency
   */
  async getUserWallet(userId: string, currency: string): Promise<any> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, currency }
    });
    if (!wallet) {
      throw new NotFoundException(`Wallet not found for user ${userId} and currency ${currency}`);
    }
    return wallet;
  }

  /**
   * Get all wallets for a user
   */
  async getUserWallets(userId: string): Promise<any[]> {
    return this.prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Process legacy wallet transaction using WalletTransactionDto
   */
  private async processLegacyTransaction(transactionDto: WalletTransactionDto): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: transactionDto.walletId }
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Validate transaction
      this.validateTransaction(wallet, transactionDto);

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId: transactionDto.walletId,
          userId: wallet.userId,
          type: transactionDto.type,
          amount: transactionDto.amount,
          currency: wallet.currency,
          status: 'PROCESSING',
          description: transactionDto.description,
          metadata: transactionDto.metadata
        }
      });

      // Update wallet balance
      await this.updateWalletBalance(tx, wallet, transactionDto);

      // Update transaction status
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      // Update daily/monthly usage for withdrawals
      if (transactionDto.type === 'WITHDRAWAL') {
        await this.updateUsageLimits(tx, wallet, transactionDto.amount);
      }

      // Cache wallet balance for quick access
      await this.cacheWalletBalance(wallet.id, Number(wallet.availableBalance));

      this.logger.log(`Processed ${transactionDto.type} transaction: ${transaction.id}`);
      return transaction;
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
          available: Number(balance.available),
          locked: Number(balance.locked),
          total: Number(balance.total)
        };
      }

      // Get from database
      const wallet = await this.getWallet(walletId);
      return {
        available: Number(wallet.availableBalance),
        locked: Number(wallet.lockedBalance),
        total: Number(wallet.totalBalance)
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
  } = {}): Promise<{ transactions: any[]; total: number }> {
    try {
      const where: any = { walletId };

      if (options.type) {
        where.type = options.type;
      }

      if (options.fromDate || options.toDate) {
        where.createdAt = {};
        if (options.fromDate) where.createdAt.gte = options.fromDate;
        if (options.toDate) where.createdAt.lte = options.toDate;
      }

      const [total, transactions] = await Promise.all([
        this.prisma.transaction.count({ where }),
        this.prisma.transaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: options.limit || 50,
          skip: options.offset || 0
        })
      ]);

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
      const dailyRemaining = Number(wallet.dailyLimit) - Number(wallet.dailyUsed);
      const monthlyRemaining = Number(wallet.monthlyLimit) - Number(wallet.monthlyUsed);

      if (dailyRemaining < amount) {
        return { allowed: false, reason: 'Insufficient daily limit remaining' };
      }

      if (monthlyRemaining < amount) {
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
  async updateWalletSettings(walletId: string, settings: any): Promise<any> {
    try {
      const wallet = await this.prisma.wallet.update({
        where: { id: walletId },
        data: {
          settings: settings
        }
      });

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
  async freezeWallet(walletId: string, reason: string): Promise<any> {
    try {
      const wallet = await this.prisma.wallet.update({
        where: { id: walletId },
        data: {
          status: 'FROZEN',
          metadata: {
            freezeReason: reason,
            frozenAt: new Date()
          }
        }
      });

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
  async unfreezeWallet(walletId: string): Promise<any> {
    try {
      const wallet = await this.prisma.wallet.update({
        where: { id: walletId },
        data: {
          status: 'ACTIVE',
          metadata: {
            freezeReason: null,
            unfrozenAt: new Date()
          }
        }
      });

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
  private validateTransaction(wallet: any, transaction: WalletTransactionDto): void {
    // Check wallet status
    if (wallet.status !== 'ACTIVE') {
      throw new BadRequestException('Wallet is not active');
    }

    // Check withdrawal limits
    if (transaction.type === 'WITHDRAWAL') {
      if (Number(wallet.availableBalance) < transaction.amount) {
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
  private async updateWalletBalance(tx: any, wallet: any, transaction: WalletTransactionDto): Promise<void> {
    let availableChange = 0;
    let totalChange = 0;

    switch (transaction.type) {
      case 'DEPOSIT':
        availableChange = transaction.amount;
        totalChange = transaction.amount;
        break;
      case 'WITHDRAWAL':
        availableChange = -transaction.amount;
        totalChange = -transaction.amount;
        break;
      case 'TRANSFER_IN':
        availableChange = transaction.amount;
        totalChange = transaction.amount;
        break;
      case 'TRANSFER_OUT':
        if (Number(wallet.availableBalance) < transaction.amount) {
          throw new BadRequestException('Insufficient available balance');
        }
        availableChange = -transaction.amount;
        totalChange = -transaction.amount;
        break;
      default:
        throw new BadRequestException(`Unsupported transaction type: ${transaction.type}`);
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: { increment: availableChange },
        totalBalance: { increment: totalChange },
        lastActivity: new Date()
      }
    });
  }

  /**
   * Update usage limits
   */
  private async updateUsageLimits(tx: any, wallet: any, amount: number): Promise<void> {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        dailyUsed: { increment: amount },
        monthlyUsed: { increment: amount }
      }
    });
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
