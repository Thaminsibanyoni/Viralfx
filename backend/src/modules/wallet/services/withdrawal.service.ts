import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

import { WalletService } from "./wallet.service";
import { LedgerService } from "./ledger.service";
import { PaymentGatewayService } from "../../payment/services/payment-gateway.service";
import { WithdrawalInitiation, WithdrawalDestination } from "../../order-matching/interfaces/order-matching.interface";
// COMMENTED OUT (TypeORM entity deleted): import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly prisma: PrismaService,
    @InjectQueue('wallet-withdrawal')
    private readonly withdrawalQueue: Queue,
    @InjectRedis() private readonly redis: Redis) {}

  async initiateWithdrawal(
    userId: string,
    walletId: string,
    amount: number,
    destination: WithdrawalDestination,
    twoFactorCode?: string
  ): Promise<WithdrawalInitiation> {
    try {
      this.logger.log(`Initiating withdrawal of ${amount} from wallet ${walletId} for user ${userId}`);

      // Get wallet
      const wallet = await this.walletService.getWallet(walletId);
      if (wallet.userId !== userId) {
        throw new Error('Wallet does not belong to user');
      }

      // Check withdrawal limits
      const limitCheck = await this.walletService.checkWithdrawalLimits(walletId, amount);
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.reason);
      }

      // Validate destination
      await this.validateDestination(wallet.currency, destination);

      // Check KYC status
      await this.checkKycStatus(userId, amount);

      // Check 2FA for amounts above threshold
      const twoFactorThreshold = parseInt(process.env.WITHDRAWAL_2FA_THRESHOLD || '10000');
      if (amount >= twoFactorThreshold) {
        if (!twoFactorCode) {
          throw new Error('Two-factor authentication code required for withdrawals above ' + twoFactorThreshold);
        }
        await this.verifyTwoFactorCode(userId, twoFactorCode);
      }

      // Check rate limiting
      await this.checkWithdrawalRateLimit(userId);

      // Create pending transaction and lock funds
      const transaction = await this.ledgerService.recordTransaction({
        walletId,
        userId,
        type: 'WITHDRAWAL',
        amount,
        currency: wallet.currency,
        description: `Withdrawal to ${destination.type}`,
        status: 'PROCESSING', // Will be set to PENDING initially
        metadata: {
          destination,
          initiatedAt: new Date()
        },
        referenceId: walletId,
        referenceType: 'WITHDRAWAL'
      });

      // Lock funds
      const lockResult = await this.walletService.lockFunds(userId, amount, wallet.currency, 'Withdrawal processing');
      if (!lockResult.success) {
        throw new Error('Failed to lock funds for withdrawal');
      }

      // Check if manual review is needed
      const reviewThreshold = parseInt(process.env.WITHDRAWAL_REVIEW_THRESHOLD || '50000');
      const requiresManualReview = amount >= reviewThreshold;

      // Queue for processing
      await this.withdrawalQueue.add(
        'process-withdrawal',
        {
          transactionId: transaction.id,
          userId,
          walletId,
          amount,
          destination,
          requiresManualReview
        },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 10000
          },
          delay: requiresManualReview ? 0 : 1000 // Process immediately if no review needed
        }
      );

      this.logger.log(`Withdrawal initiated successfully. Transaction ID: ${transaction.id}`);

      return {
        transactionId: transaction.id,
        estimatedProcessingTime: requiresManualReview ? 3600 : 300, // 1 hour for review, 5 minutes for auto
        requirements: {
          verification: requiresManualReview ? 'MANUAL_REVIEW' : 'AUTOMATIC',
          twoFactor: amount >= twoFactorThreshold,
          manualReview: requiresManualReview
        }
      };
    } catch (error) {
      this.logger.error('Failed to initiate withdrawal:', error);
      throw error;
    }
  }

  async processWithdrawal(transactionId: string): Promise<void> {
    let transaction: Transaction | null = null;

    try {
      this.logger.log(`Processing withdrawal for transaction ${transactionId}`);

      // Get transaction details
      transaction = await this.getTransaction(transactionId);
      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      if (transaction.status !== 'PROCESSING') {
        throw new Error(`Transaction ${transactionId} is not in processing state`);
      }

      // Get wallet
      const wallet = await this.walletService.getWallet(transaction.walletId);

      // Process withdrawal based on currency type
      if (['ZAR', 'USD', 'EUR'].includes(wallet.currency)) {
        await this.processFiatWithdrawal(transaction, wallet);
      } else {
        await this.processCryptoWithdrawal(transaction, wallet);
      }

      this.logger.log(`Withdrawal processed successfully for transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to process withdrawal for transaction ${transactionId}:`, error);

      // Unlock funds on failure if we have the transaction
      if (transaction) {
        await this.walletService.unlockFunds(
          transaction.userId,
          transaction.amount,
          transaction.currency,
          `Withdrawal failed: ${error.message}`
        );

        // Mark transaction as failed
        await this.failWithdrawal(transactionId, error.message);
      }

      throw error;
    }
  }

  async cancelWithdrawal(transactionId: string, userId: string): Promise<void> {
    try {
      this.logger.log(`Cancelling withdrawal ${transactionId} for user ${userId}`);

      // Get transaction
      const transaction = await this.getTransaction(transactionId);
      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      if (transaction.userId !== userId) {
        throw new Error('Transaction does not belong to user');
      }

      if (transaction.status !== 'PROCESSING' && transaction.status !== 'PENDING') {
        throw new Error('Cannot cancel withdrawal in current state');
      }

      // Unlock funds
      await this.walletService.unlockFunds(
        userId,
        transaction.amount,
        transaction.currency,
        'Withdrawal cancelled by user'
      );

      // Update transaction status
      await this.updateTransactionStatus(transactionId, 'CANCELLED');

      // Broadcast cancellation
      await this.webSocketGateway.server?.to(`user:${userId}`).emit('withdrawal:cancelled', {
        transactionId,
        timestamp: new Date()
      });

      this.logger.log(`Withdrawal cancelled successfully for transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel withdrawal ${transactionId}:`, error);
      throw error;
    }
  }

  async checkPendingWithdrawals(): Promise<void> {
    try {
      this.logger.log('Checking pending withdrawals');

      // Get pending withdrawals older than 1 hour
      const pendingWithdrawals = await this.getPendingWithdrawalsOlderThan(60); // minutes

      for (const withdrawal of pendingWithdrawals) {
        try {
          // Check status with payment gateway
          const status = await this.paymentGatewayService.checkPaymentStatus(
            withdrawal.gateway,
            withdrawal.reference
          );

          if (status === 'successful') {
            await this.completeWithdrawal(withdrawal.transactionId);
          } else if (status === 'failed') {
            await this.failWithdrawal(withdrawal.transactionId, 'Payment gateway reported failure');
          }
        } catch (error) {
          this.logger.error(`Failed to check withdrawal status for ${withdrawal.transactionId}:`, error);
        }
      }

      this.logger.log(`Checked ${pendingWithdrawals.length} pending withdrawals`);
    } catch (error) {
      this.logger.error('Failed to check pending withdrawals:', error);
    }
  }

  private async processFiatWithdrawal(transaction: any, wallet: any): Promise<void> {
    try {
      const destination = transaction.metadata.destination;

      // Process through payment gateway
      const paymentResult = await this.paymentGatewayService.processPayment({
        gateway: this.getPaymentGateway(wallet.currency),
        amount: transaction.amount,
        currency: wallet.currency,
        userId: transaction.userId,
        type: 'WITHDRAWAL',
        destination,
        reference: transaction.id
      });

      // Update transaction with provider details
      await this.updateTransactionMetadata(transaction.id, {
        providerReference: paymentResult.reference,
        providerResponse: paymentResult,
        processedAt: new Date()
      });

      // Update status to completed
      await this.updateTransactionStatus(transaction.id, 'COMPLETED');

      // Broadcast completion
      await this.webSocketGateway.server?.to(`user:${transaction.userId}`).emit('withdrawal:completed', {
        transactionId: transaction.id,
        reference: paymentResult.reference,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error(`Failed to process fiat withdrawal:`, error);
      throw error;
    }
  }

  private async processCryptoWithdrawal(transaction: any, wallet: any): Promise<void> {
    try {
      const destination = transaction.metadata.destination;

      // Process through crypto payment processor
      const cryptoResult = await this.paymentGatewayService.processCryptoWithdrawal({
        currency: wallet.currency,
        amount: transaction.amount,
        address: destination.details.cryptoAddress,
        network: destination.details.network,
        userId: transaction.userId,
        reference: transaction.id
      });

      // Update transaction with blockchain details
      await this.updateTransactionMetadata(transaction.id, {
        blockchainTxId: cryptoResult.transactionHash,
        networkFee: cryptoResult.networkFee,
        confirmations: 0,
        processedAt: new Date()
      });

      // Update status to completed
      await this.updateTransactionStatus(transaction.id, 'COMPLETED');

      // Broadcast completion
      await this.webSocketGateway.server?.to(`user:${transaction.userId}`).emit('withdrawal:completed', {
        transactionId: transaction.id,
        blockchainTxId: cryptoResult.transactionHash,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error(`Failed to process crypto withdrawal:`, error);
      throw error;
    }
  }

  private async validateDestination(currency: string, destination: WithdrawalDestination): Promise<void> {
    if (['ZAR', 'USD', 'EUR'].includes(currency)) {
      if (destination.type !== 'BANK_ACCOUNT') {
        throw new Error('Bank account destination required for fiat withdrawals');
      }

      const requiredFields = ['bankName', 'accountNumber', 'accountHolder'];
      for (const field of requiredFields) {
        if (!destination.details[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    } else {
      if (destination.type !== 'CRYPTO_ADDRESS') {
        throw new Error('Crypto address destination required for cryptocurrency withdrawals');
      }

      if (!destination.details.cryptoAddress) {
        throw new Error('Crypto address is required');
      }
    }
  }

  private async checkKycStatus(userId: string, amount: number): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (!user || user.kycStatus !== 'APPROVED') {
      throw new Error('KYC verification required for withdrawals');
    }

    // Check AML flags
    if (user.complianceFlags && user.complianceFlags.includes('AML_SUSPICIOUS')) {
      throw new Error('Account under review. Please contact support.');
    }
  }

  private async verifyTwoFactorCode(userId: string, code: string): Promise<void> {
    // This would verify the 2FA code
    // Implementation would depend on your 2FA system
    this.logger.debug(`Verifying 2FA code for user ${userId}`);
  }

  private async checkWithdrawalRateLimit(userId: string): Promise<void> {
    const key = `withdrawal:rate-limit:${userId}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, 86400); // 24 hours
    }

    const maxWithdrawalsPerDay = parseInt(process.env.MAX_WITHDRAWALS_PER_DAY || '3');
    if (count > maxWithdrawalsPerDay) {
      throw new Error('Daily withdrawal limit exceeded');
    }
  }

  private getPaymentGateway(currency: string): string {
    switch (currency) {
      case 'ZAR':
        return 'payfast';
      case 'USD':
        return 'paystack';
      case 'EUR':
        return 'paystack';
      default:
        throw new Error(`Unsupported withdrawal currency: ${currency}`);
    }
  }

  private async getTransaction(transactionId: string): Promise<Transaction | null> {
    try {
      return await this.prisma.transactionrepository.findFirst({
        where: { id: transactionId }
      });
    } catch (error) {
      this.logger.error(`Failed to get transaction ${transactionId}:`, error);
      throw error;
    }
  }

  private async updateTransactionStatus(transactionId: string, status: string): Promise<void> {
    try {
      await this.ledgerService.updateTransactionStatus(
        transactionId,
        status as any
      );
      this.logger.debug(`Updated transaction ${transactionId} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update transaction status:`, error);
      throw error;
    }
  }

  private async updateTransactionMetadata(transactionId: string, metadata: any): Promise<void> {
    try {
      await this.ledgerService.updateTransactionStatus(
        transactionId,
        'PROCESSING',
        metadata
      );
      this.logger.debug(`Updated metadata for transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to update transaction metadata:`, error);
      throw error;
    }
  }

  private async getPendingWithdrawalsOlderThan(minutes: number): Promise<Transaction[]> {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

      return await this.prisma.transactionrepository.findMany({
        where: {
          type: 'WITHDRAWAL',
          status: 'PROCESSING',
          createdAt: LessThan(cutoffTime)
        }
      });
    } catch (error) {
      this.logger.error(`Failed to get pending withdrawals older than ${minutes} minutes:`, error);
      throw error;
    }
  }

  private async completeWithdrawal(transactionId: string): Promise<void> {
    await this.updateTransactionStatus(transactionId, 'COMPLETED');
    // This would also handle any post-completion logic
  }

  private async failWithdrawal(transactionId: string, reason: string): Promise<void> {
    try {
      const transaction = await this.getTransaction(transactionId);
      if (transaction) {
        await this.walletService.unlockFunds(
          transaction.userId,
          transaction.amount,
          transaction.currency,
          `Withdrawal failed: ${reason}`
        );

        // Update transaction with failure reason
        await this.updateTransactionMetadata(transactionId, {
          failedReason: reason,
          failedAt: new Date()
        });
      }
      await this.updateTransactionStatus(transactionId, 'FAILED');
    } catch (error) {
      this.logger.error(`Failed to fail withdrawal ${transactionId}:`, error);
      throw error;
    }
  }
}
