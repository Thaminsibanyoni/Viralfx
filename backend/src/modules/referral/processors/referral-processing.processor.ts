import {Processor, WorkerHost} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { ReferralService } from '../services/referral.service';
import { ReferralTrackingService } from '../services/referral-tracking.service';
import { ReferralEventType, ReferralStatus } from '../types/referral.types';

interface ReferralProcessingJob {
  referralId: string;
  userId: string;
  eventType: ReferralEventType;
  metadata?: any;
}

interface ReferralExpirationJob {
  referralId?: string;
  daysOld?: number;
}

interface ReferralCompletionJob {
  referralId: string;
  checkCriteria: {
    kycRequired?: boolean;
    firstTradeRequired?: boolean;
    minTradeAmount?: number;
  };
}

@Processor('referral-processing')
export class ReferralProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ReferralProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly referralService: ReferralService,
    private readonly referralTrackingService: ReferralTrackingService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'process-referral-signup':
        return this.processReferralSignup(job);
      case 'check-referral-completion':
        return this.checkReferralCompletion(job);
      case 'expire-referrals':
        return this.expireReferrals(job);
      case 'validate-referral-chain':
        return this.validateReferralChain(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async processReferralSignup(job: Job<ReferralProcessingJob>): Promise<void> {
    this.logger.log(`Processing referral signup job: ${job.id} for referral: ${job.data.referralId}`);

    try {
      const { referralId, userId, eventType, metadata } = job.data;

      // Validate referral exists and belongs to the user
      const referral = await this.prisma.referral.findUnique({
        where: { id: referralId },
        include: {
          referralCode: true,
          referrer: true,
          referredUser: true
        }
      });

      if (!referral) {
        this.logger.warn(`Referral not found: ${referralId}`);
        return;
      }

      if (referral.referredUserId !== userId) {
        this.logger.warn(`User ${userId} does not own referral ${referralId}`);
        return;
      }

      // Track the signup event
      await this.referralTrackingService.trackReferralSignup(
        referral.referralCode.code,
        userId,
        metadata || {});

      // Update referral status
      await this.prisma.referral.update({
        where: { id: referralId },
        data: {
          status: ReferralStatus.REGISTERED,
          registeredAt: new Date(),
          metadata: {
            ...referral.metadata,
            ...metadata,
            processedAt: new Date().toISOString()
          }
        }
      });

      // Create event record
      await this.prisma.referralEvent.create({
        data: {
          referralId,
          eventType: ReferralEventType.REGISTERED,
          userId,
          metadata: metadata || {}
        }
      });

      // Queue completion check if needed
      await this.queueCompletionCheck(referralId);

      this.logger.log(`Referral signup processed successfully: ${referralId}`);
    } catch (error) {
      this.logger.error(`Failed to process referral signup job ${job.id}:`, error);
      throw error;
    }
  }

  private async checkReferralCompletion(job: Job<ReferralCompletionJob>): Promise<void> {
    this.logger.log(`Checking referral completion: ${job.data.referralId}`);

    try {
      const { referralId, checkCriteria } = job.data;

      const referral = await this.prisma.referral.findUnique({
        where: { id: referralId },
        include: {
          referredUser: {
            select: {
              id: true,
              kycStatus: true,
              profile: true
            }
          }
        }
      });

      if (!referral || referral.status === ReferralStatus.COMPLETED) {
        return;
      }

      let isCompleted = false;
      let completionEvent: ReferralEventType | null = null;
      const updateData: any = {};

      // Check KYC completion
      if (checkCriteria.kycRequired && referral.referredUser.kycStatus === 'VERIFIED') {
        if (referral.status !== ReferralStatus.QUALIFIED) {
          updateData.status = ReferralStatus.QUALIFIED;
          updateData.qualifiedAt = new Date();
          completionEvent = ReferralEventType.KYC_COMPLETED;
        }
      }

      // Check for first trade (this would integrate with wallet/betting modules)
      if (checkCriteria.firstTradeRequired) {
        const firstTrade = await this.checkFirstTrade(referral.referredUserId, checkCriteria.minTradeAmount);

        if (firstTrade) {
          updateData.status = ReferralStatus.COMPLETED;
          updateData.completedAt = new Date();
          updateData.completedEventType = ReferralEventType.FIRST_TRADE;
          updateData.conversionAmount = firstTrade.amount;
          updateData.conversionType = firstTrade.type;
          completionEvent = ReferralEventType.FIRST_TRADE;
          isCompleted = true;
        }
      }

      // Update referral if there are changes
      if (Object.keys(updateData).length > 0) {
        await this.prisma.$transaction(async (tx) => {
          await tx.referral.update({
            where: { id: referralId },
            data: {
              ...updateData,
              metadata: {
                ...referral.metadata,
                lastCheckedAt: new Date().toISOString(),
                completionCheckId: job.id
              }
            }
          });

          if (completionEvent) {
            await tx.referralEvent.create({
              data: {
                referralId,
                eventType: completionEvent,
                userId: referral.referredUserId,
                metadata: {
                  jobId: job.id,
                  checkCriteria
                }
              }
            });
          }
        });

        // Track conversion if completed
        if (isCompleted) {
          await this.referralTrackingService.trackReferralConversion(referralId, {
            eventType: ReferralEventType.FIRST_TRADE,
            metadata: { jobId: job.id },
            amount: updateData.conversionAmount
          });

          // Queue reward processing
          await this.queueRewardProcessing(referralId);
        }

        this.logger.log(`Referral completion check processed: ${referralId}, status: ${updateData.status}`);
      }
    } catch (error) {
      this.logger.error(`Failed to check referral completion for job ${job.id}:`, error);
      throw error;
    }
  }

  private async expireReferrals(job: Job<ReferralExpirationJob>): Promise<void> {
    this.logger.log(`Processing referral expiration job: ${job.id}`);

    try {
      const { referralId, daysOld = 30 } = job.data;

      let whereClause: any = {
        status: { in: [ReferralStatus.PENDING, ReferralStatus.REGISTERED] }
      };

      if (referralId) {
        whereClause.id = referralId;
      } else {
        // Expire all old pending/registered referrals
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        whereClause.createdAt = { lt: cutoffDate };
      }

      const referralsToExpire = await this.prisma.referral.findMany({
        where: whereClause,
        include: {
          referralCode: true,
          referrer: true,
          referredUser: true
        }
      });

      for (const referral of referralsToExpire) {
        await this.prisma.$transaction(async (tx) => {
          // Update referral status
          await tx.referral.update({
            where: { id: referral.id },
            data: {
              status: 'EXPIRED',
              metadata: {
                ...referral.metadata,
                expiredAt: new Date().toISOString(),
                expirationJobId: job.id,
                expirationReason: daysOld ? `Older than ${daysOld} days` : 'Manual expiration'
              }
            }
          });

          // Create expiration event
          await tx.referralEvent.create({
            data: {
              referralId: referral.id,
              eventType: 'EXPIRED' as ReferralEventType,
              userId: referral.referredUserId,
              metadata: {
                jobId: job.id,
                expiredAt: new Date().toISOString()
              }
            }
          });
        });

        this.logger.log(`Referral expired: ${referral.id}`);
      }

      this.logger.log(`Expired ${referralsToExpire.length} referrals in job ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to process referral expiration job ${job.id}:`, error);
      throw error;
    }
  }

  private async validateReferralChain(job: Job<{ referralId: string }>): Promise<void> {
    this.logger.log(`Validating referral chain: ${job.data.referralId}`);

    try {
      const { referralId } = job.data;

      const referral = await this.prisma.referral.findUnique({
        where: { id: referralId },
        include: {
          referralCode: true,
          referrer: {
            include: {
              referredByReferrals: {
                where: { status: ReferralStatus.COMPLETED },
                take: 1
              }
            }
          },
          referredUser: true
        }
      });

      if (!referral) {
        this.logger.warn(`Referral not found for chain validation: ${referralId}`);
        return;
      }

      // Check for circular referrals
      if (this.detectCircularReferral(referral)) {
        this.logger.warn(`Circular referral detected: ${referralId}`);

        // Mark as invalid
        await this.prisma.referral.update({
          where: { id: referralId },
          data: {
            status: 'INVALID',
            metadata: {
              ...referral.metadata,
              invalidReason: 'Circular referral detected',
              invalidatedAt: new Date().toISOString(),
              validationJobId: job.id
            }
          }
        });

        return;
      }

      // Validate referral chain depth (prevent unlimited chains)
      const chainDepth = await this.calculateReferralChainDepth(referral.referrerId);
      const maxChainDepth = parseInt(process.env.MAX_REFERRAL_CHAIN_DEPTH || '5');

      if (chainDepth > maxChainDepth) {
        this.logger.warn(`Referral chain too deep (${chainDepth} levels): ${referralId}`);

        await this.prisma.referral.update({
          where: { id: referralId },
          data: {
            status: 'INVALID',
            metadata: {
              ...referral.metadata,
              invalidReason: `Referral chain exceeds maximum depth of ${maxChainDepth}`,
              invalidatedAt: new Date().toISOString(),
              validationJobId: job.id,
              chainDepth
            }
          }
        });

        return;
      }

      // Mark as validated
      await this.prisma.referral.update({
        where: { id: referralId },
        data: {
          metadata: {
            ...referral.metadata,
            validatedAt: new Date().toISOString(),
            validationJobId: job.id,
            chainDepth
          }
        }
      });

      this.logger.log(`Referral chain validated successfully: ${referralId}, depth: ${chainDepth}`);
    } catch (error) {
      this.logger.error(`Failed to validate referral chain for job ${job.id}:`, error);
      throw error;
    }
  }

  private async checkFirstTrade(userId: string, minAmount?: number): Promise<{ amount: number; type: string } | null> {
    // This would integrate with the wallet or betting modules
    // For now, return a placeholder implementation

    try {
      // Check if user has any trades/transactions
      const trades = await this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'TRADE',
          status: 'COMPLETED'
        },
        orderBy: { createdAt: 'asc' },
        take: 1
      });

      if (trades.length === 0) {
        return null;
      }

      const firstTrade = trades[0];

      if (minAmount && firstTrade.amount < minAmount) {
        return null;
      }

      return {
        amount: firstTrade.amount,
        type: firstTrade.metadata?.tradeType || 'UNKNOWN'
      };
    } catch (error) {
      this.logger.error('Failed to check first trade:', error);
      return null;
    }
  }

  private async queueCompletionCheck(referralId: string): Promise<void> {
    // This would use the queue service to schedule a completion check
    // For now, this is a placeholder
    this.logger.log(`Queuing completion check for referral: ${referralId}`);
  }

  private async queueRewardProcessing(referralId: string): Promise<void> {
    // This would use the queue service to schedule reward processing
    // For now, this is a placeholder
    this.logger.log(`Queuing reward processing for referral: ${referralId}`);
  }

  private detectCircularReferral(referral: any): boolean {
    // Check if the referred user has already referred the referrer
    // This would need more complex logic for deep chain detection
    return referral.referrer?.referredByReferrals?.length > 0;
  }

  private async calculateReferralChainDepth(userId: string, visited: Set<string> = new Set()): Promise<number> {
    if (visited.has(userId)) {
      return Infinity; // Circular reference detected
    }

    visited.add(userId);

    const referral = await this.prisma.referral.findFirst({
      where: { referredUserId: userId, status: ReferralStatus.COMPLETED },
      include: { referralCode: true }
    });

    if (!referral) {
      return 0;
    }

    const nextDepth = await this.calculateReferralChainDepth(referral.referrerId, visited);
    return 1 + nextDepth;
  }
}
