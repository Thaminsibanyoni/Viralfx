import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WalletService } from './wallet.service';
import { LedgerService } from './ledger.service';
import { PaymentGatewayService } from '../../payment/services/payment-gateway.service';
import { CurrencyConverterService } from './currency-converter.service';
import { WebSocketGateway } from '../../websocket/gateways/websocket.gateway';
import { DepositInitiation } from '../../order-matching/interfaces/order-matching.interface';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly currencyConverterService: CurrencyConverterService,
    private readonly webSocketGateway: WebSocketGateway,
    @InjectQueue('wallet-deposit')
    private readonly depositQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async initiateDeposit(
    userId: string,
    amount: number,
    currency: string,
    gateway: 'paystack' | 'payfast' | 'ozow'
  ): Promise<DepositInitiation> {
    try {
      this.logger.log(`Initiating deposit of ${amount} ${currency} via ${gateway} for user ${userId}`);

      // Validate amount using currency converter
      await this.currencyConverterService.validateAmount(amount, currency);

      // Get or create wallet for the currency
      const wallet = await this.walletService.getOrCreateWallet(userId, currency);

      // Create PENDING transaction (no balance change yet)
      const transaction = await this.ledgerService.recordTransaction({
        walletId: wallet.id,
        userId,
        type: 'DEPOSIT',
        amount,
        currency,
        description: `Deposit via ${gateway}`,
        metadata: {
          gateway,
          provider: gateway.toUpperCase(),
          initialStatus: 'PENDING',
          initiatedAt: new Date(),
        },
        referenceId: wallet.id,
        referenceType: 'DEPOSIT',
      });

      // Process payment through gateway
      const paymentResult = await this.paymentGatewayService.processPayment({
        gateway,
        amount,
        currency,
        userId,
        reference: transaction.id,
        callbackUrl: `${process.env.API_BASE_URL}/api/v1/payments/webhook/${gateway}`,
        metadata: {
          transactionId: transaction.id,
          walletId: wallet.id,
          userId,
        },
      });

      // Store payment reference in transaction metadata
      await this.ledgerService.updateTransactionStatus(transaction.id, 'PENDING', {
        providerReference: paymentResult.reference,
        providerCheckoutUrl: paymentResult.checkoutUrl,
        providerResponse: paymentResult,
        providerTxId: paymentResult.reference,
      });

      // Cache pending deposit
      await this.cachePendingDeposit(userId, {
        transactionId: transaction.id,
        amount,
        currency,
        gateway,
        reference: paymentResult.reference,
        initiatedAt: new Date(),
      });

      this.logger.log(`Deposit initiated successfully. Transaction ID: ${transaction.id}`);

      return {
        transactionId: transaction.id,
        checkoutUrl: paymentResult.checkoutUrl,
        reference: paymentResult.reference,
        estimatedProcessingTime: this.getEstimatedProcessingTime(gateway),
      };
    } catch (error) {
      this.logger.error('Failed to initiate deposit:', error);
      throw error;
    }
  }

  async processDepositWebhook(
    gateway: string,
    webhookData: any
  ): Promise<void> {
    try {
      this.logger.log(`Processing deposit webhook from ${gateway}`);

      // Verify webhook signature
      const isValid = await this.paymentGatewayService.verifyWebhook(gateway, webhookData);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      const providerTxId = webhookData.reference || webhookData.transaction_id;
      if (!providerTxId) {
        throw new Error('Missing provider transaction ID in webhook');
      }

      // Check for duplicate processing
      const duplicateKey = `webhook:${gateway}:${providerTxId}`;
      const isDuplicate = await this.redis.set(duplicateKey, 'processed', 'EX', 86400, 'NX');
      if (!isDuplicate) {
        this.logger.warn(`Duplicate webhook ignored for ${gateway}:${providerTxId}`);
        return;
      }

      // Find transaction by provider reference using LedgerService
      const transaction = await this.ledgerService.findTransactionByProviderReference(gateway.toUpperCase(), providerTxId);
      if (!transaction) {
        this.logger.error(`Transaction not found for provider reference: ${providerTxId}`);
        return;
      }

      // Check if already processed
      if (transaction.status === 'COMPLETED') {
        this.logger.log(`Transaction ${transaction.id} already completed`);
        return;
      }

      // Process based on webhook status
      if (webhookData.status === 'successful' || webhookData.status === 'completed') {
        await this.processSuccessfulDeposit(transaction, webhookData);
      } else {
        await this.processFailedDeposit(transaction, webhookData);
      }

      this.logger.log(`Deposit webhook processed successfully for transaction ${transaction.id}`);
    } catch (error) {
      this.logger.error(`Failed to process deposit webhook from ${gateway}:`, error);
      throw error;
    }
  }

  async handleDepositFailure(transactionId: string, reason: string): Promise<void> {
    try {
      this.logger.log(`Handling deposit failure for transaction ${transactionId}`);

      // Update transaction status to FAILED using LedgerService
      const transaction = await this.ledgerService.updateTransactionStatus(transactionId, 'FAILED', {
        failureReason: reason,
        failedAt: new Date(),
      });

      await this.webSocketGateway.server?.to(`user:${transaction.userId}`).emit('deposit:failed', {
        transactionId,
        reason,
        timestamp: new Date(),
      });

      this.logger.log(`Deposit failure handled for transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to handle deposit failure for ${transactionId}:`, error);
      throw error;
    }
  }

  async checkPendingDeposits(): Promise<void> {
    try {
      this.logger.log('Checking pending deposits');

      // Get all pending deposits older than 30 minutes
      const pendingDeposits = await this.getPendingDepositsOlderThan(30); // minutes

      for (const deposit of pendingDeposits) {
        try {
          // Check if deposit has valid gateway and reference before calling gateway
          const supportedGateways = ['paystack', 'payfast', 'ozow'];
          if (!deposit.gateway || !supportedGateways.includes(deposit.gateway)) {
            this.logger.warn(`Skipping deposit ${deposit.transactionId} - unsupported or missing gateway: ${deposit.gateway}`);
            continue;
          }

          if (!deposit.reference || deposit.reference.trim() === '') {
            this.logger.warn(`Skipping deposit ${deposit.transactionId} - missing or empty reference: ${deposit.reference}`);
            continue;
          }

          // Check status with payment gateway
          const status = await this.paymentGatewayService.checkPaymentStatus(
            deposit.gateway,
            deposit.reference
          );

          if (status === 'successful') {
            await this.processSuccessfulDeposit(
              { id: deposit.transactionId, userId: deposit.userId, walletId: deposit.walletId },
              { gateway: deposit.gateway, amount: deposit.amount }
            );
          } else if (status === 'failed') {
            await this.processFailedDeposit(
              { id: deposit.transactionId, userId: deposit.userId },
              { gateway: deposit.gateway, reason: 'Payment failed' }
            );
          }
        } catch (error) {
          this.logger.error(`Failed to check deposit status for ${deposit.transactionId}:`, error);
        }
      }

      this.logger.log(`Checked ${pendingDeposits.length} pending deposits`);
    } catch (error) {
      this.logger.error('Failed to check pending deposits:', error);
    }
  }

  private async processSuccessfulDeposit(transaction: any, webhookData: any): Promise<void> {
    try {
      // Mark transaction as COMPLETED to credit the wallet
      await this.ledgerService.updateTransactionStatus(transaction.id, 'COMPLETED', {
        completedAt: new Date(),
        providerResponse: webhookData,
        webhookProcessedAt: new Date(),
      });

      // Queue deposit confirmation for notification purposes
      await this.depositQueue.add(
        'confirm-deposit',
        {
          transactionId: transaction.id,
          userId: transaction.userId,
          amount: transaction.amount,
          currency: transaction.currency,
          gateway: webhookData.gateway,
          webhookData,
        },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }
      );
    } catch (error) {
      this.logger.error(`Failed to process successful deposit for transaction ${transaction.id}:`, error);
      throw error;
    }
  }

  private async processFailedDeposit(transaction: any, webhookData: any): Promise<void> {
    try {
      // Update transaction status to FAILED using LedgerService
      await this.ledgerService.updateTransactionStatus(transaction.id, 'FAILED', {
        failureReason: webhookData.reason || 'Payment failed',
        failedAt: new Date(),
        providerResponse: webhookData,
      });

      await this.webSocketGateway.server?.to(`user:${transaction.userId}`).emit('deposit:failed', {
        transactionId: transaction.id,
        reason: webhookData.reason || 'Payment failed',
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to process failed deposit for transaction ${transaction.id}:`, error);
      throw error;
    }
  }

  private async cachePendingDeposit(userId: string, depositData: any): Promise<void> {
    try {
      const cacheKey = `deposits:pending:${userId}`;
      await this.redis.lpush(cacheKey, JSON.stringify(depositData));
      await this.redis.expire(cacheKey, 3600); // TTL 1 hour
    } catch (error) {
      this.logger.error('Failed to cache pending deposit:', error);
    }
  }

  private async getPendingDepositsOlderThan(minutes: number): Promise<any[]> {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

      this.logger.log(`Querying pending deposits older than ${minutes} minutes (before ${cutoffTime.toISOString()})`);

      // Create QueryBuilder query on transactionRepository
      const queryBuilder = this.transactionRepository.createQueryBuilder('transaction')
        .where('transaction.type = :type', { type: 'DEPOSIT' })
        .andWhere('transaction.status = :status', { status: 'PENDING' })
        .andWhere('transaction.createdAt < :cutoffTime', { cutoffTime })
        .orderBy('transaction.createdAt', 'ASC') // Oldest first
        .take(100); // Limit to prevent memory issues

      // Execute query
      const transactions = await queryBuilder.getMany();

      // Map transactions to return format
      const pendingDeposits = transactions.map(transaction => ({
        transactionId: transaction.id,
        userId: transaction.userId,
        walletId: transaction.walletId,
        amount: transaction.amount,
        currency: transaction.currency,
        gateway: transaction.metadata?.gateway || 'unknown',
        reference: transaction.metadata?.providerReference || '',
        initiatedAt: transaction.createdAt,
      }));

      this.logger.log(`Found ${pendingDeposits.length} pending deposits older than ${minutes} minutes`);

      return pendingDeposits;
    } catch (error) {
      this.logger.error(`Failed to get pending deposits older than ${minutes} minutes:`, error);
      return [];
    }
  }

  private getEstimatedProcessingTime(gateway: string): number {
    switch (gateway) {
      case 'paystack':
        return 5; // 5 minutes
      case 'payfast':
        return 10; // 10 minutes
      case 'ozow':
        return 2; // 2 minutes
      default:
        return 10; // Default 10 minutes
    }
  }

  /**
   * Get recent deposits for a user
   */
  async getRecentDeposits(
    userId: string,
    options: {
      limit?: number;
      status?: string;
      currency?: string;
      dateFrom?: Date;
    } = {}
  ): Promise<{
    deposits: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      createdAt: Date;
      completedAt?: Date;
      gateway: string;
      description: string;
    }>;
    total: number;
  }> {
    try {
      const {
        limit = 20,
        status,
        currency,
        dateFrom,
      } = options;

      // Sanitize limit to prevent very large queries
      const pageSize = Math.min(limit, 100);

      // Calculate cutoff time if not provided
      const cutoffTime = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days

      this.logger.log(`Querying recent deposits for user ${userId} with options:`, {
        limit,
        status,
        currency,
        cutoffTime,
      });

      // Create QueryBuilder query on transactionRepository
      const queryBuilder = this.transactionRepository.createQueryBuilder('transaction')
        .where('transaction.userId = :userId', { userId })
        .andWhere('transaction.type = :type', { type: 'DEPOSIT' })
        .andWhere('transaction.createdAt >= :cutoffTime', { cutoffTime });

      // Add optional status filter if provided
      if (status) {
        queryBuilder.andWhere('transaction.status = :status', { status });
      }

      // Add optional currency filter if provided
      if (currency) {
        queryBuilder.andWhere('transaction.currency = :currency', { currency });
      }

      // Order by createdAt DESC (most recent first)
      queryBuilder.orderBy('transaction.createdAt', 'DESC');

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply limit
      queryBuilder.take(pageSize);

      // Execute query
      const transactions = await queryBuilder.getMany();

      // Map transactions to expected return format
      const deposits = transactions.map(transaction => ({
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt,
        completedAt: transaction.completedAt,
        gateway: transaction.metadata?.gateway || 'unknown',
        description: transaction.description || `Deposit via ${transaction.metadata?.gateway || 'payment gateway'}`,
      }));

      this.logger.log(`Retrieved ${deposits.length} recent deposits for user ${userId}, total: ${total}`);

      return {
        deposits,
        total,
      };
    } catch (error) {
      this.logger.error(`Failed to get recent deposits for user ${userId}:`, error);
      return {
        deposits: [],
        total: 0,
      };
    }
  }

  /**
   * Get recent deposits for all users (admin function)
   */
  async getAllRecentDeposits(
    options: {
      limit?: number;
      status?: string;
      currency?: string;
      dateFrom?: Date;
      page?: number;
    } = {}
  ): Promise<{
    deposits: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      createdAt: Date;
      completedAt?: Date;
      gateway: string;
      description: string;
    }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const {
        limit = 20,
        status,
        currency,
        dateFrom,
        page = 1,
      } = options;

      // Sanitize limit to prevent very large queries
      const pageSize = Math.min(limit, 100);

      // Calculate cutoff time if not provided
      const cutoffTime = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days

      // Calculate skip for pagination
      const skip = (page - 1) * pageSize;

      this.logger.log(`Querying all recent deposits (admin) with options:`, {
        limit: pageSize,
        status,
        currency,
        page,
        skip,
        cutoffTime,
      });

      // Create QueryBuilder query on transactionRepository
      const queryBuilder = this.transactionRepository.createQueryBuilder('transaction')
        .where('transaction.type = :type', { type: 'DEPOSIT' })
        .andWhere('transaction.createdAt >= :cutoffTime', { cutoffTime });

      // Add optional status filter if provided
      if (status) {
        queryBuilder.andWhere('transaction.status = :status', { status });
      }

      // Add optional currency filter if provided
      if (currency) {
        queryBuilder.andWhere('transaction.currency = :currency', { currency });
      }

      // Get total count before pagination
      const total = await queryBuilder.getCount();

      // Order by createdAt DESC (most recent first)
      queryBuilder.orderBy('transaction.createdAt', 'DESC');

      // Apply pagination
      queryBuilder.skip(skip).take(pageSize);

      // Execute query
      const transactions = await queryBuilder.getMany();

      // Map transactions to expected format
      const deposits = transactions.map(transaction => ({
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt,
        completedAt: transaction.completedAt,
        gateway: transaction.metadata?.gateway || 'unknown',
        description: transaction.description || `Deposit via ${transaction.metadata?.gateway || 'payment gateway'}`,
      }));

      // Calculate totalPages
      const totalPages = Math.ceil(total / pageSize);

      this.logger.log(`Retrieved ${deposits.length} deposits for admin view (page ${page}), total: ${total}, totalPages: ${totalPages}`);

      return {
        deposits,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to get all recent deposits:', error);
      return {
        deposits: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    }
  }
}