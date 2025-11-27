import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

import { Transaction, TransactionType } from '../entities/transaction.entity';
import { Wallet } from '../entities/wallet.entity';
import { RecordTransactionParams, ReconciliationResult } from '../../order-matching/interfaces/order-matching.interface';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async recordTransaction(params: RecordTransactionParams): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await this.recordTransactionWithManager(params, queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async recordTransactionWithManager(
    params: RecordTransactionParams,
    manager: EntityManager,
  ): Promise<Transaction> {
    this.logger.log(`Recording transaction ${params.type} for wallet ${params.walletId}`);

    // Get wallet and lock it for update using the provided manager
    const wallet = await manager.findOne(Wallet, {
      where: { id: params.walletId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet) {
      throw new Error(`Wallet ${params.walletId} not found`);
    }

    if (wallet.status !== 'ACTIVE') {
      throw new Error(`Wallet ${params.walletId} is not active`);
    }

    const balanceBefore = wallet.available_balance;
    let balanceAfter = balanceBefore;
    let transactionStatus = 'COMPLETED';
    let completedAt = new Date();

    // Allow initial status to be specified for deposits (PENDING -> COMPLETED flow)
    if (params.type === 'DEPOSIT' && params.metadata?.initialStatus === 'PENDING') {
      transactionStatus = 'PENDING';
      completedAt = null; // No completion time for pending transactions
    }

    // Calculate new balance and update wallet only for COMPLETED transactions
    if (transactionStatus === 'COMPLETED') {
      // Calculate new balance based on transaction type
      if (['DEPOSIT', 'TRADE_SELL', 'TRANSFER_IN', 'BET_PAYOUT', 'BET_REFUND', 'UNLOCK'].includes(params.type)) {
        balanceAfter = balanceBefore + params.amount;
      } else if (['WITHDRAWAL', 'TRADE_BUY', 'TRANSFER_OUT', 'BET_STAKE', 'FEE', 'COMMISSION', 'LOCK'].includes(params.type)) {
        balanceAfter = balanceBefore - params.amount;

        if (balanceAfter < 0) {
          throw new Error(`Insufficient balance. Available: ${balanceBefore}, Required: ${params.amount}`);
        }
      }

      // Update wallet balance for COMPLETED transactions
      wallet.available_balance = balanceAfter;
      wallet.total_balance = wallet.total_balance + (balanceAfter - balanceBefore);
      wallet.last_activity = new Date();

      await manager.save(wallet);
    }

    // Create transaction record
    const transaction = this.transactionRepository.create({
      walletId: params.walletId,
      userId: params.userId,
      type: params.type as TransactionType,
      amount: params.amount,
      currency: params.currency,
      status: transactionStatus,
      balanceBefore,
      balanceAfter: transactionStatus === 'COMPLETED' ? balanceAfter : balanceBefore,
      description: params.description,
      metadata: params.metadata,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      completedAt,
    });

    await manager.save(transaction);

    this.logger.log(`Transaction ${transaction.id} recorded successfully with status ${transactionStatus}`);

    return transaction;
  }

  async updateTransactionStatus(
    transactionId: string,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
    metadata?: Record<string, any>
  ): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Updating transaction ${transactionId} status to ${status}`);

      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: { id: transactionId },
        relations: ['wallet'],
      });

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { id: transaction.walletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new Error(`Wallet ${transaction.walletId} not found`);
      }

      const previousStatus = transaction.status;
      transaction.status = status;

      // Handle balance updates for PENDING -> COMPLETED transitions
      if (previousStatus === 'PENDING' && status === 'COMPLETED') {
        const balanceBefore = transaction.balanceBefore;
        let balanceAfter = balanceBefore;

        // Calculate new balance based on transaction type
        if (['DEPOSIT', 'TRADE_SELL', 'TRANSFER_IN', 'BET_PAYOUT', 'BET_REFUND', 'UNLOCK'].includes(transaction.type)) {
          balanceAfter = balanceBefore + transaction.amount;
        } else if (['WITHDRAWAL', 'TRADE_BUY', 'TRANSFER_OUT', 'BET_STAKE', 'FEE', 'COMMISSION', 'LOCK'].includes(transaction.type)) {
          balanceAfter = balanceBefore - transaction.amount;

          if (balanceAfter < 0) {
            throw new Error(`Insufficient balance for completed transaction. Available: ${balanceBefore}, Required: ${transaction.amount}`);
          }
        }

        // Update wallet balance
        wallet.available_balance = balanceAfter;
        wallet.total_balance = wallet.total_balance + (balanceAfter - transaction.balanceBefore);
        wallet.last_activity = new Date();

        transaction.balanceAfter = balanceAfter;
        transaction.completedAt = new Date();

        await queryRunner.manager.save(wallet);
      }

      // Update metadata if provided
      if (metadata) {
        transaction.metadata = {
          ...transaction.metadata,
          ...metadata,
        };
      }

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      // Clear wallet balance cache for COMPLETED transactions
      if (status === 'COMPLETED') {
        await this.clearWalletCache(transaction.walletId, transaction.userId);
      }

      // Emit transaction updated event
      await this.emitTransactionEvent(transaction);

      this.logger.log(`Transaction ${transactionId} status updated to ${status}`);

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to update transaction status:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findTransactionByProviderReference(
    provider: string,
    providerTxId: string
  ): Promise<Transaction | null> {
    try {
      return await this.transactionRepository.findOne({
        where: {
          metadata: {
            provider,
            providerTxId,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to find transaction by provider reference:`, error);
      throw error;
    }
  }

  async recordDoubleEntry(
    debitWalletId: string,
    creditWalletId: string,
    amount: number,
    currency: string,
    description: string,
    metadata?: Record<string, any>,
  ): Promise<Transaction[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Recording double entry: ${amount} ${currency} from ${debitWalletId} to ${creditWalletId}`);

      // Get both wallets and lock them for update
      const [debitWallet, creditWallet] = await Promise.all([
        queryRunner.manager.findOne(Wallet, {
          where: { id: debitWalletId },
          lock: { mode: 'pessimistic_write' },
        }),
        queryRunner.manager.findOne(Wallet, {
          where: { id: creditWalletId },
          lock: { mode: 'pessimistic_write' },
        }),
      ]);

      if (!debitWallet || !creditWallet) {
        throw new Error('One or both wallets not found');
      }

      if (debitWallet.currency !== creditWallet.currency || debitWallet.currency !== currency) {
        throw new Error('Currency mismatch between wallets');
      }

      if (debitWallet.available_balance < amount) {
        throw new Error(`Insufficient balance in debit wallet. Available: ${debitWallet.available_balance}, Required: ${amount}`);
      }

      // Create debit transaction
      const debitTransaction = this.transactionRepository.create({
        walletId: debitWalletId,
        userId: debitWallet.userId,
        type: 'TRANSFER_OUT',
        amount: -amount,
        currency,
        status: 'COMPLETED',
        balanceBefore: debitWallet.available_balance,
        balanceAfter: debitWallet.available_balance - amount,
        description,
        metadata: {
          ...metadata,
          transferType: 'DEBIT',
          counterpartWalletId: creditWalletId,
        },
        completedAt: new Date(),
      });

      // Create credit transaction
      const creditTransaction = this.transactionRepository.create({
        walletId: creditWalletId,
        userId: creditWallet.userId,
        type: 'TRANSFER_IN',
        amount,
        currency,
        status: 'COMPLETED',
        balanceBefore: creditWallet.available_balance,
        balanceAfter: creditWallet.available_balance + amount,
        description,
        metadata: {
          ...metadata,
          transferType: 'CREDIT',
          counterpartWalletId: debitWalletId,
        },
        completedAt: new Date(),
      });

      // Update wallet balances
      debitWallet.available_balance -= amount;
      debitWallet.total_balance -= amount;
      debitWallet.last_activity = new Date();

      creditWallet.available_balance += amount;
      creditWallet.total_balance += amount;
      creditWallet.last_activity = new Date();

      // Save all entities
      await queryRunner.manager.save([debitTransaction, creditTransaction, debitWallet, creditWallet]);

      await queryRunner.commitTransaction();

      // Cache transactions
      await Promise.all([
        this.cacheTransaction(debitWalletId, debitTransaction),
        this.cacheTransaction(creditWalletId, creditTransaction),
      ]);

      // Clear wallet caches
      await Promise.all([
        this.clearWalletCache(debitWalletId, debitWallet.userId),
        this.clearWalletCache(creditWalletId, creditWallet.userId),
      ]);

      this.logger.log(`Double entry recorded successfully`);

      return [debitTransaction, creditTransaction];
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to record double entry:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getTransactionHistory(
    walletId: string,
    options: {
      page?: number;
      limit?: number;
      filters?: {
        type?: string;
        status?: string;
        dateFrom?: Date;
        dateTo?: Date;
      };
    } = {},
  ): Promise<{ items: Transaction[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 20, 100); // Max 100 per page
      const skip = (page - 1) * limit;

      // Check cache first
      const cacheKey = `wallet:${walletId}:transactions:${JSON.stringify(options)}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const queryBuilder = this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.walletId = :walletId', { walletId });

      // Apply filters
      if (options.filters?.type) {
        queryBuilder.andWhere('transaction.type = :type', { type: options.filters.type });
      }

      if (options.filters?.status) {
        queryBuilder.andWhere('transaction.status = :status', { status: options.filters.status });
      }

      if (options.filters?.dateFrom) {
        queryBuilder.andWhere('transaction.createdAt >= :dateFrom', { dateFrom: options.filters.dateFrom });
      }

      if (options.filters?.dateTo) {
        queryBuilder.andWhere('transaction.createdAt <= :dateTo', { dateTo: options.filters.dateTo });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Get transactions
      const transactions = await queryBuilder
        .orderBy('transaction.createdAt', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany();

      const result = {
        items: transactions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      // Cache result for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(result));

      return result;
    } catch (error) {
      this.logger.error(`Failed to get transaction history for wallet ${walletId}:`, error);
      throw error;
    }
  }

  async reconcileWallet(walletId: string): Promise<ReconciliationResult> {
    try {
      this.logger.log(`Reconciling wallet ${walletId}`);

      const wallet = await this.walletRepository.findOne({ where: { id: walletId } });
      if (!wallet) {
        throw new Error(`Wallet ${walletId} not found`);
      }

      // Get all completed transactions for the wallet
      const transactions = await this.transactionRepository.find({
        where: {
          walletId,
          status: 'COMPLETED',
        },
        order: { createdAt: 'ASC' },
      });

      // Calculate expected balance from transactions
      let expectedBalance = 0;
      for (const transaction of transactions) {
        if (transaction.isCredit) {
          expectedBalance += transaction.amount;
        } else {
          expectedBalance -= transaction.amount;
        }
      }

      const actualBalance = wallet.available_balance;
      const discrepancy = actualBalance - expectedBalance;
      const isReconciled = Math.abs(discrepancy) < 0.00000001; // Small tolerance for floating point

      const result: ReconciliationResult = {
        walletId,
        expectedBalance,
        actualBalance,
        discrepancy,
        isReconciled,
        transactionCount: transactions.length,
        lastReconciled: new Date(),
      };

      if (!isReconciled) {
        this.logger.warn(`Wallet ${walletId} reconciliation failed. Discrepancy: ${discrepancy}`);

        // Log reconciliation failure
        await this.logReconciliationFailure(result);
      } else {
        this.logger.log(`Wallet ${walletId} reconciled successfully`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to reconcile wallet ${walletId}:`, error);
      throw error;
    }
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Rolling back transaction ${transactionId}`);

      const originalTransaction = await queryRunner.manager.findOne(Transaction, {
        where: { id: transactionId, status: 'COMPLETED' },
      });

      if (!originalTransaction) {
        throw new Error(`Transaction ${transactionId} not found or not completed`);
      }

      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { id: originalTransaction.walletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new Error(`Wallet ${originalTransaction.walletId} not found`);
      }

      // Create compensating transaction
      const rollbackTransaction = this.transactionRepository.create({
        walletId: originalTransaction.walletId,
        userId: originalTransaction.userId,
        type: originalTransaction.isCredit ? 'TRANSFER_OUT' : 'TRANSFER_IN',
        amount: originalTransaction.isCredit ? -originalTransaction.amount : originalTransaction.amount,
        currency: originalTransaction.currency,
        status: 'COMPLETED',
        balanceBefore: wallet.available_balance,
        balanceAfter: originalTransaction.balanceBefore, // Restore original balance
        description: `Rollback of transaction ${transactionId}`,
        metadata: {
          rollbackTransactionId: transactionId,
          originalAmount: originalTransaction.amount,
          originalType: originalTransaction.type,
        },
        referenceId: transactionId,
        referenceType: 'ROLLBACK',
        completedAt: new Date(),
      });

      // Update wallet balance to original state
      wallet.available_balance = originalTransaction.balanceBefore;
      wallet.total_balance = wallet.total_balance + (originalTransaction.balanceBefore - wallet.available_balance);
      wallet.last_activity = new Date();

      // Mark original transaction as rolled back
      originalTransaction.status = 'CANCELLED';
      originalTransaction.metadata = {
        ...originalTransaction.metadata,
        rolledBack: true,
        rollbackTransactionId: rollbackTransaction.id,
      };

      // Save all changes
      await queryRunner.manager.save([rollbackTransaction, wallet, originalTransaction]);

      await queryRunner.commitTransaction();

      this.logger.log(`Transaction ${transactionId} rolled back successfully`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to rollback transaction ${transactionId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async cacheTransaction(walletId: string, transaction: Transaction): Promise<void> {
    try {
      const cacheKey = `wallet:${walletId}:transaction:${transaction.id}`;
      await this.redis.setex(cacheKey, 300, JSON.stringify(transaction)); // TTL 5 minutes
    } catch (error) {
      this.logger.error('Failed to cache transaction:', error);
    }
  }

  private async clearWalletCache(walletId: string, userId: string): Promise<void> {
    try {
      const keys = [
        `wallet:${walletId}:balance`,
        `wallet:${walletId}:transactions:*`,
        `portfolio:${userId}:*`,
      ];

      for (const pattern of keys) {
        const matchingKeys = await this.redis.keys(pattern);
        if (matchingKeys.length > 0) {
          await this.redis.del(...matchingKeys);
        }
      }
    } catch (error) {
      this.logger.error('Failed to clear wallet cache:', error);
    }
  }

  private async emitTransactionEvent(transaction: Transaction): Promise<void> {
    try {
      // This would emit transaction events to WebSocket or message queue
      // Implementation would depend on your event system
      this.logger.debug(`Emitted transaction event for ${transaction.id}`);
    } catch (error) {
      this.logger.error('Failed to emit transaction event:', error);
    }
  }

  private async logReconciliationFailure(result: ReconciliationResult): Promise<void> {
    try {
      // Log reconciliation failure for admin review
      this.logger.warn(`Reconciliation failure for wallet ${result.walletId}: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error('Failed to log reconciliation failure:', error);
    }
  }
}