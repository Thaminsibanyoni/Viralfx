import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

import { LedgerService } from '../services/ledger.service';
import { WalletService } from '../services/wallet.service';
import { WebSocketGateway } from '../../websocket/gateways/websocket.gateway';
import { NotificationService } from '../../notification/services/notification.service';
import { RecordTransactionParams } from '../../order-matching/interfaces/order-matching.interface';

@Processor('wallet-transaction')
export class TransactionProcessor {
  private readonly logger = new Logger(TransactionProcessor.name);

  constructor(
    private readonly ledgerService: LedgerService,
    private readonly walletService: WalletService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly notificationService: NotificationService,
  ) {}

  @Process('process-transaction')
  async processTransaction(job: Job<RecordTransactionParams>): Promise<void> {
    try {
      const transactionParams = job.data;
      this.logger.log(`Processing transaction ${transactionParams.type} for wallet ${transactionParams.walletId}`);

      // Record transaction using ledger service
      const transaction = await this.ledgerService.recordTransaction(transactionParams);

      // Broadcast wallet update
      await this.webSocketGateway.broadcastWalletBalanceUpdate(
        transactionParams.userId,
        await this.walletService.getWalletsByUserId(transactionParams.userId)
      );

      // Send notification for significant transactions
      if (this.shouldNotifyTransaction(transactionParams)) {
        await this.notificationService.sendNotification({
          userId: transactionParams.userId,
          type: 'WALLET_TRANSACTION',
          title: this.getTransactionTitle(transactionParams),
          message: this.getTransactionMessage(transactionParams),
          metadata: {
            transactionId: transaction.id,
            amount: transactionParams.amount,
            currency: transactionParams.currency,
            type: transactionParams.type,
          },
        });
      }

      this.logger.log(`Transaction ${transaction.id} processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process transaction in job ${job.id}:`, error);
      throw error;
    }
  }

  @Process('reconcile-wallet')
  async reconcileWallet(job: Job<{ walletId: string }>): Promise<void> {
    try {
      const { walletId } = job.data;
      this.logger.log(`Reconciling wallet ${walletId}`);

      const result = await this.ledgerService.reconcileWallet(walletId);

      if (!result.isReconciled) {
        this.logger.warn(`Wallet ${walletId} reconciliation failed. Discrepancy: ${result.discrepancy}`);

        // Send alert to admins
        await this.notificationService.sendAdminNotification({
          type: 'WALLET_RECONCILIATION_FAILURE',
          title: 'Wallet Reconciliation Failure',
          message: `Wallet ${walletId} reconciliation failed with discrepancy of ${result.discrepancy}`,
          metadata: result,
          priority: 'high',
        });
      } else {
        this.logger.log(`Wallet ${walletId} reconciled successfully`);
      }
    } catch (error) {
      this.logger.error(`Failed to reconcile wallet ${job.data.walletId}:`, error);
      throw error;
    }
  }

  @Process('cleanup-transactions')
  async cleanupTransactions(): Promise<void> {
    try {
      this.logger.log('Starting transaction cleanup');

      // This would clean up old or failed transactions
      // Implementation would depend on your transaction repository

      this.logger.log('Transaction cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup transactions:', error);
      throw error;
    }
  }

  @Process('audit-transactions')
  async auditTransactions(job: Job<{ userId?: string; dateFrom?: Date; dateTo?: Date }>): Promise<void> {
    try {
      const { userId, dateFrom, dateTo } = job.data;
      this.logger.log(`Starting transaction audit for user ${userId || 'all'}`);

      // This would audit transactions for compliance and reporting
      // Implementation would depend on your audit requirements

      this.logger.log('Transaction audit completed');
    } catch (error) {
      this.logger.error('Failed to audit transactions:', error);
      throw error;
    }
  }

  @OnQueueFailed()
  async onQueueFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`Transaction job ${job.id} failed:`, error);

    // Send alert for critical failures
    if (job.opts.attempts >= 3) {
      await this.notifyAdmins({
        type: 'TRANSACTION_PROCESSING_FAILURE',
        jobId: job.id,
        error: error.message,
        data: job.data,
        critical: true,
      });
    }
  }

  private shouldNotifyTransaction(params: RecordTransactionParams): boolean {
    // Notify for significant transactions
    const significantAmounts = {
      DEPOSIT: 10000,
      WITHDRAWAL: 5000,
      TRADE_BUY: 50000,
      TRADE_SELL: 50000,
    };

    const threshold = significantAmounts[params.type] || 0;
    return params.amount >= threshold;
  }

  private getTransactionTitle(params: RecordTransactionParams): string {
    const titles = {
      DEPOSIT: 'Deposit Received',
      WITHDRAWAL: 'Withdrawal Initiated',
      TRADE_BUY: 'Trade Executed',
      TRADE_SELL: 'Trade Executed',
      TRANSFER_IN: 'Transfer Received',
      TRANSFER_OUT: 'Transfer Sent',
      BET_PAYOUT: 'Bet Payout',
      BET_STAKE: 'Bet Placed',
      FEE: 'Fee Charged',
      COMMISSION: 'Commission Charged',
    };

    return titles[params.type] || 'Transaction Processed';
  }

  private getTransactionMessage(params: RecordTransactionParams): string {
    const sign = ['DEPOSIT', 'TRADE_SELL', 'TRANSFER_IN', 'BET_PAYOUT', 'UNLOCK'].includes(params.type) ? '+' : '-';
    return `${sign}${params.amount.toLocaleString()} ${params.currency} - ${params.description || params.type}`;
  }

  private async notifyAdmins(notification: any): Promise<void> {
    try {
      await this.notificationService.sendAdminNotification({
        type: 'SYSTEM_ALERT',
        title: 'Transaction Processing Failure',
        message: `Critical transaction processing failure: ${notification.error}`,
        metadata: notification,
        priority: 'high',
      });

      this.logger.warn(`Admin notification sent: ${JSON.stringify(notification)}`);
    } catch (error) {
      this.logger.error('Failed to notify admins:', error);
    }
  }
}