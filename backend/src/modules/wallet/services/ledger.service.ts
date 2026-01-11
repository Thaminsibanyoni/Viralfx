import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { RecordTransactionParams, ReconciliationResult } from "../../order-matching/interfaces/order-matching.interface";

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis) {}

  async recordTransaction(params: RecordTransactionParams): Promise<any> {
    this.logger.log(`Recording transaction ${params.type} for wallet ${params.walletId}`);
    
    // Prisma implementation
    return await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: params.walletId }
      });

      if (!wallet) {
        throw new Error(`Wallet ${params.walletId} not found`);
      }

      const balanceBefore = Number(wallet.availableBalance);
      let balanceAfter = balanceBefore;
      let transactionStatus = 'COMPLETED';

      // Calculate new balance
      if (['DEPOSIT', 'TRADE_SELL', 'TRANSFER_IN', 'BET_PAYOUT', 'BET_REFUND', 'UNLOCK'].includes(params.type)) {
        balanceAfter = balanceBefore + params.amount;
      } else if (['WITHDRAWAL', 'TRADE_BUY', 'TRANSFER_OUT', 'BET_STAKE', 'FEE', 'COMMISSION', 'LOCK'].includes(params.type)) {
        balanceAfter = balanceBefore - params.amount;
        if (balanceAfter < 0) {
          throw new Error(`Insufficient balance. Available: ${balanceBefore}, Required: ${params.amount}`);
        }
      }

      // Update wallet balance
      await tx.wallet.update({
        where: { id: params.walletId },
        data: {
          availableBalance: balanceAfter,
          totalBalance: { increment: balanceAfter - balanceBefore },
          lastActivity: new Date()
        }
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId: params.walletId,
          userId: params.userId,
          type: params.type,
          amount: params.amount,
          currency: params.currency,
          status: transactionStatus,
          balanceBefore,
          balanceAfter,
          description: params.description,
          metadata: params.metadata || {},
          referenceId: params.referenceId,
          referenceType: params.referenceType
        }
      });

      this.logger.log(`Transaction recorded: ${transaction.id}`);
      return transaction;
    });
  }

  async recordDoubleEntry(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    currency: string,
    description: string
  ): Promise<any[]> {
    this.logger.log(`Recording double entry: ${fromWalletId} -> ${toWalletId}, amount: ${amount}`);

    const [debitTx, creditTx] = await Promise.all([
      this.recordTransaction({
        walletId: fromWalletId,
        userId: '', // Will be filled from wallet
        type: 'TRANSFER_OUT',
        amount,
        currency,
        description: `${description} (to ${toWalletId})`,
        referenceId: toWalletId,
        referenceType: 'WALLET_TRANSFER'
      }),
      this.recordTransaction({
        walletId: toWalletId,
        userId: '', // Will be filled from wallet
        type: 'TRANSFER_IN',
        amount,
        currency,
        description: `${description} (from ${fromWalletId})`,
        referenceId: fromWalletId,
        referenceType: 'WALLET_TRANSFER'
      })
    ]);

    return [debitTx, creditTx];
  }

  async getTransactions(walletId: string, options: any = {}): Promise<{ transactions: any[]; total: number }> {
    const where: any = { walletId };

    if (options.type) {
      where.type = options.type;
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
  }

  async reconcileTransactions(walletId: string): Promise<ReconciliationResult> {
    this.logger.log(`Reconciling transactions for wallet ${walletId}`);
    
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 100
        }
      }
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    // Calculate expected balance from transactions
    let calculatedBalance = 0;
    wallet.transactions.forEach(tx => {
      if (['DEPOSIT', 'TRADE_SELL', 'TRANSFER_IN', 'BET_PAYOUT', 'BET_REFUND', 'UNLOCK'].includes(tx.type)) {
        calculatedBalance += Number(tx.amount);
      } else if (['WITHDRAWAL', 'TRADE_BUY', 'TRANSFER_OUT', 'BET_STAKE', 'FEE', 'COMMISSION', 'LOCK'].includes(tx.type)) {
        calculatedBalance -= Number(tx.amount);
      }
    });

    const actualBalance = Number(wallet.availableBalance);
    const isBalanced = Math.abs(calculatedBalance - actualBalance) < 0.01;

    return {
      walletId,
      actualBalance,
      calculatedBalance,
      difference: actualBalance - calculatedBalance,
      isBalanced,
      transactionCount: wallet.transactions.length,
      lastReconciledAt: new Date()
    };
  }

  // Additional stub methods for compatibility
  async updateTransactionStatus(transactionId: string, status: string, metadata?: any): Promise<any> {
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status,
        metadata: metadata || undefined
      }
    });
  }

  async getTransactionById(transactionId: string): Promise<any> {
    return this.prisma.transaction.findUnique({
      where: { id: transactionId }
    });
  }
}
