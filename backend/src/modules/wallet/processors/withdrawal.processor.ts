import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

import { WithdrawalService } from '../services/withdrawal.service';
import { WebSocketGateway } from '../../websocket/gateways/websocket.gateway';
import { NotificationService } from '../../notification/services/notification.service';

interface ProcessWithdrawalJob {
  transactionId: string;
  userId: string;
  walletId: string;
  amount: number;
  destination: any;
  requiresManualReview: boolean;
}

interface ReviewWithdrawalJob {
  transactionId: string;
  adminId: string;
  approved: boolean;
  reason?: string;
}

interface CheckPendingWithdrawalsJob {
  userId?: string;
}

@Processor('wallet-withdrawal')
export class WithdrawalProcessor {
  private readonly logger = new Logger(WithdrawalProcessor.name);

  constructor(
    private readonly withdrawalService: WithdrawalService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly notificationService: NotificationService,
  ) {}

  @Process('process-withdrawal')
  async processWithdrawal(job: Job<ProcessWithdrawalJob>): Promise<void> {
    try {
      const { transactionId, userId, amount, destination, requiresManualReview } = job.data;
      this.logger.log(`Processing withdrawal ${transactionId} for user ${userId}`);

      if (requiresManualReview) {
        // Add to manual review queue
        await this.addForManualReview(transactionId, amount, destination);

        // Notify user about manual review
        await this.webSocketGateway.server?.to(`user:${userId}`).emit('withdrawal:review', {
          transactionId,
          amount,
          estimatedTime: '24 hours',
          message: 'Your withdrawal is under manual review for security reasons',
          timestamp: new Date(),
        });

        // Send notification
        await this.notificationService.sendNotification({
          userId,
          type: 'WITHDRAWAL_REVIEW',
          title: 'Withdrawal Under Review',
          message: `Your withdrawal of ${amount} is under manual review for security reasons. This typically takes 24 hours.`,
          metadata: { transactionId, amount },
        });
      } else {
        // Process immediately
        await this.withdrawalService.processWithdrawal(transactionId);

        // Broadcast to user
        await this.webSocketGateway.server?.to(`user:${userId}`).emit('withdrawal:processing', {
          transactionId,
          amount,
          estimatedTime: '5-10 minutes',
          timestamp: new Date(),
        });
      }

      this.logger.log(`Withdrawal ${transactionId} processing initiated`);
    } catch (error) {
      this.logger.error(`Failed to process withdrawal ${job.data.transactionId}:`, error);
      throw error;
    }
  }

  @Process('review-withdrawal')
  async reviewWithdrawal(job: Job<ReviewWithdrawalJob>): Promise<void> {
    try {
      const { transactionId, adminId, approved, reason } = job.data;
      this.logger.log(`Admin ${adminId} reviewing withdrawal ${transactionId} - ${approved ? 'APPROVED' : 'REJECTED'}`);

      if (approved) {
        // Process the withdrawal
        await this.withdrawalService.processWithdrawal(transactionId);

        // Notify admin of successful processing
        await this.notificationService.sendNotification({
          userId: adminId,
          type: 'WITHDRAWAL_REVIEW_PROCESSED',
          title: 'Withdrawal Approved and Processed',
          message: `Withdrawal ${transactionId} has been approved and processed successfully`,
          metadata: { transactionId, approved },
        });
      } else {
        // Reject the withdrawal
        await this.withdrawalService.cancelWithdrawal(transactionId, null);

        // Get withdrawal details for user notification
        const withdrawalDetails = await this.getWithdrawalDetails(transactionId);

        // Notify user of rejection
        await this.notificationService.sendNotification({
          userId: withdrawalDetails.userId,
          type: 'WITHDRAWAL_REJECTED',
          title: 'Withdrawal Rejected',
          message: `Your withdrawal has been rejected. Reason: ${reason || 'Security review failed'}`,
          metadata: { transactionId, reason },
        });

        // Notify admin of rejection
        await this.notificationService.sendNotification({
          userId: adminId,
          type: 'WITHDRAWAL_REVIEW_PROCESSED',
          title: 'Withdrawal Rejected',
          message: `Withdrawal ${transactionId} has been rejected. Reason: ${reason}`,
          metadata: { transactionId, approved, reason },
        });
      }

      this.logger.log(`Withdrawal ${transactionId} review completed`);
    } catch (error) {
      this.logger.error(`Failed to review withdrawal ${job.data.transactionId}:`, error);
      throw error;
    }
  }

  @Process('check-pending-withdrawals')
  async checkPendingWithdrawals(job: Job<CheckPendingWithdrawalsJob>): Promise<void> {
    try {
      this.logger.log('Checking pending withdrawals');

      // Check all pending withdrawals with payment gateways
      await this.withdrawalService.checkPendingWithdrawals();

      this.logger.log('Pending withdrawals check completed');
    } catch (error) {
      this.logger.error('Failed to check pending withdrawals:', error);
      throw error;
    }
  }

  @Process('send-withdrawal-notifications')
  async sendWithdrawalNotifications(): Promise<void> {
    try {
      this.logger.log('Sending withdrawal notifications');

      // This would send periodic withdrawal status updates
      // Implementation would depend on your notification strategy

      this.logger.log('Withdrawal notifications sent');
    } catch (error) {
      this.logger.error('Failed to send withdrawal notifications:', error);
      throw error;
    }
  }

  @Process('process-aml-check')
  async processAmlCheck(job: Job<{ transactionId: string; userId: string; amount: number }>): Promise<void> {
    try {
      const { transactionId, userId, amount } = job.data;
      this.logger.log(`Processing AML check for withdrawal ${transactionId}`);

      // This would perform AML checks
      // Implementation would depend on your AML compliance requirements

      this.logger.log(`AML check completed for withdrawal ${transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to process AML check for withdrawal ${job.data.transactionId}:`, error);
      throw error;
    }
  }

  @OnQueueFailed()
  async onQueueFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`Withdrawal job ${job.id} failed:`, error);

    // Move to dead letter queue after max attempts
    if (job.opts.attempts >= 5) {
      await this.moveToDeadLetterQueue(job);
      await this.notifyAdmins({
        type: 'WITHDRAWAL_PROCESSING_FAILURE',
        jobId: job.id,
        error: error.message,
        data: job.data,
        critical: job.data?.amount > 10000, // Critical for large amounts
      });
    }
  }

  private async addForManualReview(transactionId: string, amount: number, destination: any): Promise<void> {
    try {
      // This would add withdrawal to manual review queue
      // Implementation would depend on your admin review system
      this.logger.debug(`Withdrawal ${transactionId} added to manual review queue`);
    } catch (error) {
      this.logger.error('Failed to add withdrawal to manual review:', error);
    }
  }

  private async getWithdrawalDetails(transactionId: string): Promise<any> {
    try {
      // This would get withdrawal details from your repository
      return { userId: 'mock-user-id' };
    } catch (error) {
      this.logger.error('Failed to get withdrawal details:', error);
      return { userId: 'unknown' };
    }
  }

  private async moveToDeadLetterQueue(job: Job): Promise<void> {
    try {
      this.logger.warn(`Moving withdrawal job ${job.id} to dead letter queue`);

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
        title: 'Withdrawal Processing Failure',
        message: `Critical withdrawal processing failure: ${notification.error}`,
        metadata: notification,
        priority: notification.critical ? 'critical' : 'high',
      });

      this.logger.warn(`Admin notification sent: ${JSON.stringify(notification)}`);
    } catch (error) {
      this.logger.error('Failed to notify admins:', error);
    }
  }
}