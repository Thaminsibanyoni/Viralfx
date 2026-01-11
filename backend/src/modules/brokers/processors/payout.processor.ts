import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RevenueSharingService } from '../services/revenue-sharing.service';
import { NotificationService } from "../../notifications/services/notification.service";
import { PrismaService } from "../../../prisma/prisma.service";

export interface PayoutJobData {
  brokerId: string;
  payout: {
    brokerId: string;
    period: { start: Date; end: Date };
    totalRevenue: number;
    platformShare: number;
    brokerShare: number;
    volumeDiscount: number;
    performanceBonus: number;
    netPayout: number;
    transactionCount: number;
    clientCount: number;
  };
  billId: string;
}

@Processor('payout-processing')
export class PayoutProcessor extends WorkerHost {
  private readonly logger = new Logger(PayoutProcessor.name);

  constructor(
    private readonly revenueSharingService: RevenueSharingService,
    private readonly notificationService: NotificationService,
    private readonly prismaService: PrismaService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'process-broker-payout':
        return this.handleBrokerPayout(job);
      case 'retry-failed-payout':
        return this.handleFailedPayoutRetry(job);
      case 'monthly-payout-reconciliation':
        return this.handleMonthlyPayoutReconciliation(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  @OnWorkerEvent('active')
  onActive(job: Job<PayoutJobData>) {
    this.logger.log(`Processing payout job ${job.id} for broker ${job.data.brokerId}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<PayoutJobData>) {
    this.logger.log(`Completed payout job ${job.id} for broker ${job.data.brokerId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PayoutJobData>, error: Error) {
    this.logger.error(`Failed payout job ${job.id} for broker ${job.data.brokerId}:`, error);
  }

  private async handleBrokerPayout(job: Job<PayoutJobData>) {
    const { brokerId, payout, billId } = job.data;

    this.logger.log(`Processing broker payout for ${brokerId}, amount: R${payout.netPayout.toFixed(2)}`);

    try {
      // Validate payout calculation
      const validation = await this.revenueSharingService.validatePayoutCalculation(payout);
      if (!validation.isValid) {
        this.logger.error(`Payout validation failed for broker ${brokerId}:`, validation.errors);
        await this.handlePayoutFailure(brokerId, payout, validation.errors);
        throw new Error(`Payout validation failed: ${validation.errors.join(', ')}`);
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        this.logger.warn(`Payout warnings for broker ${brokerId}:`, validation.warnings);
      }

      // Initiate the payout
      const success = await this.revenueSharingService.initiatePayout(brokerId, payout);

      if (success) {
        await this.logPayoutActivity(brokerId, 'PAYOUT_SUCCESS', {
          billId,
          amount: payout.netPayout,
          period: payout.period,
          transactionCount: payout.transactionCount,
          clientCount: payout.clientCount
        });

        this.logger.log(`Payout successfully processed for broker ${brokerId}`);
        return { success: true, message: 'Payout processed successfully' };
      } else {
        await this.handlePayoutFailure(brokerId, payout, ['Payment gateway processing failed']);
        throw new Error('Payout processing failed');
      }
    } catch (error) {
      this.logger.error(`Failed to process payout for broker ${brokerId}:`, error);

      await this.logPayoutActivity(brokerId, 'PAYOUT_ERROR', {
        billId,
        error: error.message,
        payout
      });

      // Send failure notification
      await this.notificationService.sendPayoutFailureAlert(brokerId, {
        amount: payout.netPayout,
        period: payout.period,
        error: error.message
      });

      throw error;
    }
  }

  private async handleFailedPayoutRetry(job: Job<PayoutJobData>) {
    const { brokerId, payout, billId } = job.data;

    this.logger.log(`Retrying failed payout for broker ${brokerId}`);

    try {
      // Check if payout is still needed (might have been manually processed)
      const bill = await this.prismaService.brokerBill.findFirst({
        where: { id: billId }
      });

      if (bill && bill.status === 'PAID') {
        this.logger.log(`Payout for broker ${brokerId} already processed, skipping retry`);
        return { success: true, message: 'Payout already processed' };
      }

      // Retry the payout with lower amount (security measure)
      const retryPayout = {
        ...payout,
        netPayout: payout.netPayout * 0.95 // Retry with 95% of original amount
      };

      const success = await this.revenueSharingService.initiatePayout(brokerId, retryPayout);

      if (success) {
        await this.logPayoutActivity(brokerId, 'PAYOUT_RETRY_SUCCESS', {
          billId,
          originalAmount: payout.netPayout,
          retryAmount: retryPayout.netPayout,
          period: payout.period
        });

        return { success: true, message: 'Payout retry successful' };
      } else {
        throw new Error('Payout retry failed');
      }
    } catch (error) {
      this.logger.error(`Payout retry failed for broker ${brokerId}:`, error);

      await this.logPayoutActivity(brokerId, 'PAYOUT_RETRY_FAILED', {
        billId,
        error: error.message
      });

      // Escalate to manual processing
      await this.escalateToManualProcessing(brokerId, payout, billId);

      throw error;
    }
  }

  private async handleMonthlyPayoutReconciliation(job: Job<{ year: number; month: number }>) {
    const { year, month } = job.data;

    this.logger.log(`Performing monthly payout reconciliation for ${year}-${month}`);

    try {
      // Get all payout attempts for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const reconciliationData = await this.generateReconciliationData(startDate, endDate);

      // Generate reconciliation report
      const report = {
        period: { start: startDate, end: endDate },
        totalExpected: reconciliationData.totalExpected,
        totalProcessed: reconciliationData.totalProcessed,
        totalFailed: reconciliationData.totalFailed,
        failedPayouts: reconciliationData.failedPayouts,
        reconciliation: {
          matched: reconciliationData.matched,
          unmatched: reconciliationData.unmatched,
          discrepancies: reconciliationData.discrepancies
        }
      };

      // Send reconciliation report to finance team
      await this.notificationService.sendReconciliationReport(report);

      this.logger.log(`Monthly reconciliation completed for ${year}-${month}`);
      return report;
    } catch (error) {
      this.logger.error(`Monthly reconciliation failed for ${year}-${month}:`, error);
      throw error;
    }
  }

  private async handlePayoutFailure(brokerId: string, payout: any, errors: string[]): Promise<void> {
    // Log the failure
    await this.logPayoutActivity(brokerId, 'PAYOUT_FAILED', {
      errors,
      payout
    });

    // Schedule retry for next business day
    // In production, this would respect business days and banking hours
    const retryDelay = 24 * 60 * 60 * 1000; // 24 hours

    // Add to retry queue
    // Note: This would need the queue to be injected
    // await this.payoutQueue.add('retry-failed-payout', {
    //   brokerId
    //   payout
    //   billId: payout.billId
    // }, { delay: retryDelay });

    // Send immediate alert
    await this.notificationService.sendPayoutFailureAlert(brokerId, {
      amount: payout.netPayout,
      period: payout.period,
      errors
    });
  }

  private async escalateToManualProcessing(brokerId: string, payout: any, billId: string): Promise<void> {
    this.logger.warn(`Escalating payout to manual processing for broker ${brokerId}`);

    // Mark for manual review
    await this.prismaService.brokerBill.update({
      where: { id: billId },
      data: {
        status: 'MANUAL_REVIEW',
        notes: `Automatic payout failed after retry. Requires manual processing. Errors: Payment gateway timeout.`
      }
    });

    // Escalate to finance team
    await this.notificationService.sendManualProcessingEscalation({
      brokerId,
      billId,
      amount: payout.netPayout,
      period: payout.period,
      urgency: 'HIGH'
    });

    await this.logPayoutActivity(brokerId, 'PAYOUT_ESCALATED', {
      billId,
      amount: payout.netPayout,
      period: payout.period,
      escalatedTo: 'FINANCE_TEAM'
    });
  }

  private async generateReconciliationData(startDate: Date, endDate: Date) {
    // Get all expected payouts for the period
    const expectedPayouts = await this.prismaService.brokerBill.findMany({
      where: {
        period: {
          gte: startDate,
          lte: endDate
        },
        status: 'PAID'
      }
    });

    // Get actual payout records from payment gateway
    // This would integrate with the payment gateway's reconciliation API
    const actualPayouts = []; // Mock data

    const totalExpected = expectedPayouts.reduce((sum, bill) => sum + Number(bill.total), 0);
    const totalProcessed = actualPayouts.reduce((sum, payout) => sum + payout.amount, 0);

    return {
      totalExpected,
      totalProcessed,
      totalFailed: totalExpected - totalProcessed,
      failedPayouts: [], // Would contain details of failed payouts
      matched: expectedPayouts.length,
      unmatched: 0,
      discrepancies: []
    };
  }

  private async logPayoutActivity(brokerId: string, activity: string, details: any): Promise<void> {
    await this.prismaService.auditLog.create({
      data: {
        action: 'PAYOUT_PROCESSING',
        entityType: 'BROKER_PAYOUT',
        entityId: brokerId,
        oldValues: null,
        newValues: JSON.stringify({
          activity,
          details,
          timestamp: new Date().toISOString()
        }),
        userId: null,
        ipAddress: null,
        userAgent: 'Payout Processor'
      }
    });
  }
}
