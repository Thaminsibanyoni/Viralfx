import {Processor, WorkerHost} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RewardService } from '../services/reward.service';
import { RewardStatus, RewardType } from '../types/referral.types';

interface DistributeRewardJob {
  claimId: string;
  userId: string;
  rewardId: string;
  referralId?: string;
  metadata?: any;
}

interface ProcessPayoutJob {
  claimId: string;
  attempt: number;
  maxAttempts: number;
  paymentMethod?: string;
}

interface ExpireRewardJob {
  claimId: string;
  reason?: string;
}

interface AuditRewardJob {
  claimId: string;
  action: 'CREATED' | 'PROCESSED' | 'PAID' | 'FAILED' | 'EXPIRED';
  metadata?: any;
}

@Processor('reward-distribution')
export class RewardDistributionProcessor extends WorkerHost {
  private readonly logger = new Logger(RewardDistributionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly rewardService: RewardService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectQueue('wallet') private readonly walletQueue: Queue) {}

  private async distributeReward(job: Job<DistributeRewardJob>): Promise<void> {
    this.logger.log(`Processing reward distribution job: ${job.id} for claim: ${job.data.claimId}`);

    try {
      const { claimId, userId, rewardId, referralId, metadata } = job.data;

      const claim = await this.prisma.referralRewardClaim.findUnique({
        where: { id: claimId },
        include: {
          reward: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              kycStatus: true
            }
          },
          referral: {
            include: {
              referrer: {
                select: { username: true }
              }
            }
          }
        }
      });

      if (!claim) {
        this.logger.warn(`Reward claim not found: ${claimId}`);
        return;
      }

      if (claim.status !== RewardStatus.PENDING) {
        this.logger.warn(`Reward claim ${claimId} is not pending, current status: ${claim.status}`);
        return;
      }

      // Validate user eligibility
      if (claim.user.kycStatus !== 'VERIFIED') {
        await this.prisma.referralRewardClaim.update({
          where: { id: claimId },
          data: {
            status: RewardStatus.FAILED,
            metadata: {
              ...claim.metadata,
              error: 'User KYC not verified',
              processedAt: new Date().toISOString(),
              jobId: job.id
            }
          }
        });

        // Queue notification about KYC requirement
        await this.queueNotification(userId, 'REWARD_KYC_REQUIRED', {
          rewardName: claim.reward.name,
          rewardValue: claim.reward.value
        });

        return;
      }

      // Process reward based on type
      let processingResult: any = null;
      let newStatus = RewardStatus.PROCESSED;

      switch (claim.reward.type) {
        case RewardType.WALLET_CREDIT:
          processingResult = await this.processWalletCredit(claim);
          newStatus = RewardStatus.PAID;
          break;

        case RewardType.DISCOUNT_CODE:
          processingResult = await this.processDiscountCode(claim);
          break;

        case RewardType.FEATURE_UNLOCK:
          processingResult = await this.processFeatureUnlock(claim);
          break;

        case RewardType.VOUCHER:
          processingResult = await this.processVoucher(claim);
          break;

        default:
          throw new Error(`Unsupported reward type: ${claim.reward.type}`);
      }

      // Update claim status
      await this.prisma.referralRewardClaim.update({
        where: { id: claimId },
        data: {
          status: newStatus,
          processedAt: new Date(),
          metadata: {
            ...claim.metadata,
            ...metadata,
            processingResult,
            processedAt: new Date().toISOString(),
            jobId: job.id
          }
        }
      });

      // Queue success notification
      await this.queueNotification(userId, 'REWARD_DISTRIBUTED', {
        rewardName: claim.reward.name,
        rewardValue: claim.reward.value,
        rewardType: claim.reward.type,
        processingResult,
        referralInfo: referralId ? {
          referrer: claim.referral?.referrer.username
        } : null
      });

      // Queue audit log
      await this.queueAuditLog(claimId, 'PROCESSED', {
        processingResult,
        newStatus,
        metadata
      });

      this.logger.log(`Reward distributed successfully: ${claimId}, type: ${claim.reward.type}`);
    } catch (error) {
      this.logger.error(`Failed to distribute reward for job ${job.id}:`, error);

      // Mark claim as failed
      try {
        await this.prisma.referralRewardClaim.update({
          where: { id: job.data.claimId },
          data: {
            status: RewardStatus.FAILED,
            metadata: {
              error: error.message,
              failedAt: new Date().toISOString(),
              jobId: job.id
            }
          }
        });
      } catch (updateError) {
        this.logger.error('Failed to update claim status to FAILED:', updateError);
      }

      throw error;
    }
  }

  private async processPayout(job: Job<ProcessPayoutJob>): Promise<void> {
    this.logger.log(`Processing payout job: ${job.id} for claim: ${job.data.claimId}`);

    try {
      const { claimId, attempt, maxAttempts, paymentMethod } = job.data;

      const claim = await this.prisma.referralRewardClaim.findUnique({
        where: { id: claimId },
        include: {
          reward: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true
            }
          }
        }
      });

      if (!claim) {
        this.logger.warn(`Reward claim not found: ${claimId}`);
        return;
      }

      if (attempt > maxAttempts) {
        // Mark as permanently failed
        await this.prisma.referralRewardClaim.update({
          where: { id: claimId },
          data: {
            status: RewardStatus.FAILED,
            metadata: {
              ...claim.metadata,
              failedAt: new Date().toISOString(),
              failureReason: 'Max payout attempts exceeded',
              finalAttempt: attempt
            }
          }
        });

        // Queue failure notification
        await this.queueNotification(claim.userId, 'REWARD_PAYOUT_FAILED', {
          rewardName: claim.reward.name,
          attempts: attempt
        });

        this.logger.error(`Payout failed after ${attempt} attempts for claim: ${claimId}`);
        return;
      }

      // Simulate payout processing (would integrate with actual payment gateway)
      const payoutResult = await this.simulatePayout(claim, paymentMethod);

      if (payoutResult.success) {
        await this.prisma.referralRewardClaim.update({
          where: { id: claimId },
          data: {
            status: RewardStatus.PAID,
            metadata: {
              ...claim.metadata,
              payoutResult,
              paidAt: new Date().toISOString(),
              finalAttempt: attempt
            }
          }
        });

        // Queue success notification
        await this.queueNotification(claim.userId, 'REWARD_PAID', {
          rewardName: claim.reward.name,
          payoutAmount: claim.reward.value,
          payoutMethod: paymentMethod
        });

        this.logger.log(`Payout successful for claim: ${claimId}, attempt: ${attempt}`);
      } else {
        // Retry payout
        await this.queuePayoutRetry(claimId, attempt + 1, maxAttempts, paymentMethod, payoutResult.error);

        this.logger.warn(`Payout failed for claim: ${claimId}, attempt: ${attempt}, error: ${payoutResult.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process payout for job ${job.id}:`, error);
      throw error;
    }
  }

  private async expireReward(job: Job<ExpireRewardJob>): Promise<void> {
    this.logger.log(`Processing reward expiration job: ${job.id} for claim: ${job.data.claimId}`);

    try {
      const { claimId, reason } = job.data;

      const claim = await this.prisma.referralRewardClaim.findUnique({
        where: { id: claimId },
        include: {
          reward: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true
            }
          }
        }
      });

      if (!claim) {
        this.logger.warn(`Reward claim not found: ${claimId}`);
        return;
      }

      if (claim.status === RewardStatus.EXPIRED) {
        return;
      }

      await this.prisma.referralRewardClaim.update({
        where: { id: claimId },
        data: {
          status: RewardStatus.EXPIRED,
          metadata: {
            ...claim.metadata,
            expiredAt: new Date().toISOString(),
            expirationReason: reason || 'Expiration job processed',
            jobId: job.id
          }
        }
      });

      // Queue expiration notification
      await this.queueNotification(claim.userId, 'REWARD_EXPIRED', {
        rewardName: claim.reward.name,
        reason: reason || 'Reward expired due to inactivity'
      });

      // Queue audit log
      await this.queueAuditLog(claimId, 'EXPIRED', { reason });

      this.logger.log(`Reward expired successfully: ${claimId}`);
    } catch (error) {
      this.logger.error(`Failed to expire reward for job ${job.id}:`, error);
      throw error;
    }
  }

  private async batchExpireRewards(job: Job<{ daysUnclaimed: number }>): Promise<void> {
    this.logger.log(`Processing batch reward expiration job: ${job.id}`);

    try {
      const { daysUnclaimed = 30 } = job.data;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysUnclaimed);

      const claimsToExpire = await this.prisma.referralRewardClaim.findMany({
        where: {
          status: { in: [RewardStatus.PENDING, RewardStatus.PROCESSED] },
          createdAt: { lt: cutoffDate }
        },
        include: {
          reward: true,
          user: { select: { id: true, email: true } }
        }
      });

      for (const claim of claimsToExpire) {
        await this.prisma.referralRewardClaim.update({
          where: { id: claim.id },
          data: {
            status: RewardStatus.EXPIRED,
            metadata: {
              ...claim.metadata,
              expiredAt: new Date().toISOString(),
              expirationReason: `Unclaimed for ${daysUnclaimed} days`,
              batchJobId: job.id
            }
          }
        });

        // Queue expiration notification
        await this.queueNotification(claim.user.id, 'REWARD_EXPIRED', {
          rewardName: claim.reward.name,
          reason: `Unclaimed for ${daysUnclaimed} days`
        });
      }

      this.logger.log(`Batch expired ${claimsToExpire.length} rewards in job ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to batch expire rewards for job ${job.id}:`, error);
      throw error;
    }
  }

  private async processWalletCredit(claim: any): Promise<any> {
    // Queue wallet transaction
    await this.walletQueue.add('create-transaction', {
      userId: claim.userId,
      type: 'BONUS',
      amount: claim.reward.value,
      description: `Referral reward: ${claim.reward.name}`,
      metadata: {
        claimId: claim.id,
        rewardId: claim.rewardId,
        referralId: claim.referralId
      }
    });

    return {
      method: 'wallet_credit',
      amount: claim.reward.value,
      currency: 'USD',
      transactionId: `pending_${claim.id}_${Date.now()}`
    };
  }

  private async processDiscountCode(claim: any): Promise<any> {
    const discountCode = `REFERRAL-${claim.user.username.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Store discount code (would integrate with discount service)
    await this.prisma.discountCode.create({
      data: {
        code: discountCode,
        userId: claim.userId,
        type: 'PERCENTAGE',
        value: claim.reward.value,
        maxUses: 1,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        metadata: {
          claimId: claim.id,
          rewardId: claim.rewardId
        }
      }
    });

    return {
      method: 'discount_code',
      code: discountCode,
      type: 'PERCENTAGE',
      value: claim.reward.value,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    };
  }

  private async processFeatureUnlock(claim: any): Promise<any> {
    // Unlock features for user (would integrate with features/permissions service)
    const featureName = claim.reward.metadata?.featureName || `feature_${claim.reward.id}`;

    await this.prisma.userFeature.create({
      data: {
        userId: claim.userId,
        featureName,
        grantedAt: new Date(),
        expiresAt: claim.reward.metadata?.expiresAt || null,
        metadata: {
          claimId: claim.id,
          rewardId: claim.rewardId
        }
      }
    });

    return {
      method: 'feature_unlock',
      featureName,
      grantedAt: new Date(),
      expiresAt: claim.reward.metadata?.expiresAt
    };
  }

  private async processVoucher(claim: any): Promise<any> {
    const voucherCode = `VOUCHER-${claim.user.username.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Store voucher (would integrate with voucher service)
    await this.prisma.voucher.create({
      data: {
        code: voucherCode,
        userId: claim.userId,
        type: 'REWARD',
        value: claim.reward.value,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days
        metadata: {
          claimId: claim.id,
          rewardId: claim.rewardId
        }
      }
    });

    return {
      method: 'voucher',
      code: voucherCode,
      value: claim.reward.value,
      type: 'REWARD',
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    };
  }

  private async simulatePayout(claim: any, paymentMethod?: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // Simulate payment processing with 95% success rate
    const isSuccess = Math.random() > 0.05;

    if (isSuccess) {
      return {
        success: true,
        transactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
      };
    } else {
      return {
        success: false,
        error: 'Payment gateway temporarily unavailable'
      };
    }
  }

  private async queuePayoutRetry(claimId: string, attempt: number, maxAttempts: number, paymentMethod?: string, error?: string): Promise<void> {
    await this.walletQueue.add(
      'process-payout',
      {
        claimId,
        attempt,
        maxAttempts,
        paymentMethod,
        lastError: error
      },
      {
        delay: Math.pow(2, attempt) * 1000, // Exponential backoff
        attempts: 1
      }
    );
  }

  private async queueNotification(userId: string, type: string, data: any): Promise<void> {
    await this.notificationsQueue.add(
      'send-notification',
      {
        userId,
        type,
        data,
        channels: ['in_app', 'email']
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    );
  }

  private async queueAuditLog(claimId: string, action: string, metadata?: any): Promise<void> {
    await this.notificationsQueue.add(
      'create-audit-log',
      {
        entityType: 'reward_claim',
        entityId: claimId,
        action,
        userId: metadata?.userId,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      },
      {
        attempts: 3
      }
    );
  }
}
