import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

import { DepositService } from '../services/deposit.service';
import { WebSocketGateway } from '../../websocket/gateways/websocket.gateway';
import { NotificationService } from '../../notification/services/notification.service';

interface ConfirmDepositJob {
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  gateway: string;
  webhookData: any;
}

interface CheckPendingDepositsJob {
  userId?: string;
}

@Processor('wallet-deposit')
export class DepositProcessor {
  private readonly logger = new Logger(DepositProcessor.name);

  constructor(
    private readonly depositService: DepositService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly notificationService: NotificationService,
  ) {}

  @Process('confirm-deposit')
  async confirmDeposit(job: Job<ConfirmDepositJob>): Promise<void> {
    try {
      const { transactionId, userId, amount, currency, gateway, webhookData } = job.data;
      this.logger.log(`Confirming deposit ${transactionId} from ${gateway}`);

      // Process deposit confirmation through deposit service
      // This would update transaction status and credit wallet
      // The actual processing logic is in the deposit service webhook handler

      // Broadcast deposit confirmation to user
      await this.webSocketGateway.server?.to(`user:${userId}`).emit('deposit:confirmed', {
        transactionId,
        amount,
        currency,
        gateway,
        timestamp: new Date(),
      });

      // Send notification
      await this.notificationService.sendNotification({
        userId,
        type: 'DEPOSIT_CONFIRMED',
        title: 'Deposit Confirmed',
        message: `Your deposit of ${amount} ${currency} has been confirmed and credited to your wallet`,
        metadata: {
          transactionId,
          amount,
          currency,
          gateway,
        },
      });

      // Send email notification for significant deposits
      if (amount >= 1000) {
        await this.notificationService.sendEmail({
          to: userId,
          subject: 'Deposit Confirmation',
          template: 'deposit-confirmation',
          data: {
            amount,
            currency,
            gateway,
            transactionId,
          },
        });
      }

      this.logger.log(`Deposit ${transactionId} confirmed successfully`);
    } catch (error) {
      this.logger.error(`Failed to confirm deposit ${job.data.transactionId}:`, error);
      throw error;
    }
  }

  @Process('check-pending-deposits')
  async checkPendingDeposits(job: Job<CheckPendingDepositsJob>): Promise<void> {
    try {
      this.logger.log('Checking pending deposits');

      // Check all pending deposits with payment gateways
      await this.depositService.checkPendingDeposits();

      this.logger.log('Pending deposits check completed');
    } catch (error) {
      this.logger.error('Failed to check pending deposits:', error);
      throw error;
    }
  }

  @Process('send-deposit-reminders')
  async sendDepositReminders(): Promise<void> {
    try {
      this.logger.log('Sending deposit reminders');

      // This would find incomplete deposits and send reminders
      // Implementation would depend on your business logic

      this.logger.log('Deposit reminders sent');
    } catch (error) {
      this.logger.error('Failed to send deposit reminders:', error);
      throw error;
    }
  }

  @Process('reconcile-deposits')
  async reconcileDeposits(job: Job<{ dateFrom: Date; dateTo: Date }>): Promise<void> {
    try {
      const { dateFrom, dateTo } = job.data;
      this.logger.log(`Reconciling deposits from ${dateFrom} to ${dateTo}`);

      // This would reconcile deposits with payment gateway records
      // Implementation would depend on your reconciliation process

      this.logger.log('Deposit reconciliation completed');
    } catch (error) {
      this.logger.error('Failed to reconcile deposits:', error);
      throw error;
    }
  }

  @Process('process-deposit-refund')
  async processDepositRefund(job: Job<{ transactionId: string; reason: string }>): Promise<void> {
    try {
      const { transactionId, reason } = job.data;
      this.logger.log(`Processing refund for deposit ${transactionId}`);

      // This would process refund for failed or cancelled deposit
      // Implementation would depend on your refund process

      this.logger.log(`Refund processed for deposit ${transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to process refund for deposit ${job.data.transactionId}:`, error);
      throw error;
    }
  }

  @OnQueueFailed()
  async onQueueFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`Deposit job ${job.id} failed:`, error);

    // Move to dead letter queue after max attempts
    if (job.opts.attempts >= 5) {
      await this.moveToDeadLetterQueue(job);
      await this.notifyAdmins({
        type: 'DEPOSIT_PROCESSING_FAILURE',
        jobId: job.id,
        error: error.message,
        data: job.data,
      });
    }
  }

  private async moveToDeadLetterQueue(job: Job): Promise<void> {
    try {
      this.logger.warn(`Moving deposit job ${job.id} to dead letter queue`);

      // Implementation would move job to dead letter queue
      // This would depend on your queue configuration
    } catch (error) {
      this.logger.error('Failed to move job to dead letter queue:', error);
    }
  }

  private async notifyAdmins(notification: any): Promise<void> {
    try {
      await this.notificationService.sendAdminNotification({
        type: 'SYSTEM_ALERT',
        title: 'Deposit Processing Failure',
        message: `Critical deposit processing failure: ${notification.error}`,
        metadata: notification,
        priority: 'high',
      });

      this.logger.warn(`Admin notification sent: ${JSON.stringify(notification)}`);
    } catch (error) {
      this.logger.error('Failed to notify admins:', error);
    }
  }
}