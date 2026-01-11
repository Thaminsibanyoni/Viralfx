import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException, Inject } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  RewardDto,
  CreateRewardDto,
  UpdateRewardDto,
  RewardClaimDto,
  RewardStatus,
  RewardType
} from '../dto/referral.dto';

@Injectable()
export class RewardService {
  private readonly logger = new Logger(RewardService.name);
  private readonly rewardCacheTTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
    @InjectQueue('reward-distribution') private readonly rewardDistributionQueue: Queue) {}

  /**
   * Create a new reward
   */
  async createReward(createData: CreateRewardDto): Promise<RewardDto> {
    this.logger.log(`Creating reward: ${createData.name}`);

    try {
      const reward = await this.prisma.referralReward.create({
        data: {
          name: createData.name,
          description: createData.description,
          type: createData.type,
          tier: createData.tier,
          value: createData.value,
          requirements: createData.requirements || [],
          isActive: createData.isActive ?? true,
          startDate: createData.startDate,
          endDate: createData.endDate,
          maxClaims: createData.maxClaims,
          metadata: createData.metadata || {}
        }
      });

      // Invalidate cache
      await this.invalidateRewardCache();

      this.logger.log(`Reward created: ${reward.id}`);
      return this.formatReward(reward);
    } catch (error) {
      this.logger.error('Failed to create reward:', error);
      throw new InternalServerErrorException('Failed to create reward');
    }
  }

  /**
   * Approve a reward (admin action)
   */
  async approveReward(rewardId: string, adminId: string): Promise<RewardDto> {
    this.logger.log(`Approving reward: ${rewardId} by admin: ${adminId}`);

    try {
      const reward = await this.prisma.referralReward.update({
        where: { id: rewardId },
        data: {
          isActive: true,
          approvedBy: adminId,
          approvedAt: new Date()
        }
      });

      // Invalidate cache
      await this.invalidateRewardCache();

      this.logger.log(`Reward approved: ${rewardId}`);
      return this.formatReward(reward);
    } catch (error) {
      this.logger.error('Failed to approve reward:', error);
      throw new InternalServerErrorException('Failed to approve reward');
    }
  }

  /**
   * Distribute reward to user
   */
  async distributeReward(
    rewardId: string,
    userId: string,
    referralId?: string,
    metadata?: any
  ): Promise<RewardClaimDto> {
    this.logger.log(`Distributing reward: ${rewardId} to user: ${userId}`);

    try {
      const reward = await this.prisma.referralReward.findUnique({
        where: { id: rewardId }
      });

      if (!reward) {
        throw new NotFoundException('Reward not found');
      }

      // Check if user has already claimed this reward
      const existingClaim = await this.prisma.referralRewardClaim.findFirst({
        where: {
          userId,
          rewardId,
          status: { in: [RewardStatus.PENDING, RewardStatus.PROCESSED, RewardStatus.PAID] }
        }
      });

      if (existingClaim) {
        throw new BadRequestException('User has already claimed this reward');
      }

      // Create reward claim
      const claim = await this.prisma.$transaction(async (tx) => {
        // Create claim record
        const newClaim = await tx.referralRewardClaim.create({
          data: {
            userId,
            rewardId,
            referralId,
            status: RewardStatus.PENDING,
            metadata: metadata || {}
          }
        });

        // Update reward claim count
        await tx.referralReward.update({
          where: { id: rewardId },
          data: {
            currentClaims: { increment: 1 }
          }
        });

        return newClaim;
      });

      // Queue distribution for async processing
      await this.rewardDistributionQueue.add(
        'distribute-reward',
        {
          claimId: claim.id,
          userId,
          rewardId,
          referralId
        },
        {
          delay: 0,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      );

      this.logger.log(`Reward queued for distribution: ${claim.id}`);

      return {
        id: claim.id,
        rewardId: reward.id,
        userId: userId,
        status: claim.status,
        claimedAt: claim.createdAt,
        processedAt: claim.updatedAt,
        value: reward.value,
        type: reward.type,
        name: reward.name
      };
    } catch (error) {
      this.logger.error('Failed to distribute reward:', error);
      throw new InternalServerErrorException('Failed to distribute reward');
    }
  }

  /**
   * Expire reward
   */
  async expireReward(rewardId: string, reason?: string): Promise<RewardDto> {
    this.logger.log(`Expiring reward: ${rewardId}`);

    try {
      const reward = await this.prisma.referralReward.update({
        where: { id: rewardId },
        data: {
          isActive: false,
          endDate: new Date(),
          metadata: {
            expired: true,
            expiredAt: new Date(),
            expiredReason: reason || 'Manual expiration'
          }
        }
      });

      // Invalidate cache
      await this.invalidateRewardCache();

      this.logger.log(`Reward expired: ${rewardId}`);
      return this.formatReward(reward);
    } catch (error) {
      this.logger.error('Failed to expire reward:', error);
      throw new InternalServerErrorException('Failed to expire reward');
    }
  }

  /**
   * Get user rewards with filtering
   */
  async getUserRewards(
    userId: string,
    filters: {
      status?: RewardStatus;
      type?: RewardType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ rewards: RewardDto[]; total: number }> {
    const cacheKey = `user:rewards:${userId}:${JSON.stringify(filters)}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const { status, type, limit = 50, offset = 0 } = filters;

      const whereClause: any = { userId };
      if (status) whereClause.status = status;
      if (type) whereClause.reward = { type };

      const [claims, total] = await Promise.all([
        this.prisma.referralRewardClaim.findMany({
          where: whereClause,
          include: {
            reward: true,
            referral: {
              include: {
                referredUser: {
                  select: { username: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.referralRewardClaim.count({ where: whereClause }),
      ]);

      const rewards = claims.map(claim => ({
        id: claim.id,
        rewardId: claim.rewardId,
        userId: claim.userId,
        status: claim.status,
        claimedAt: claim.createdAt,
        processedAt: claim.updatedAt,
        value: claim.reward.value,
        type: claim.reward.type,
        name: claim.reward.name,
        description: claim.reward.description,
        referralId: claim.referralId,
        referral: claim.referral,
        metadata: claim.metadata
      }));

      const result = { rewards, total };

      // Cache the result
      await this.redis.setex(cacheKey, this.rewardCacheTTL, JSON.stringify(result));

      return result;
    } catch (error) {
      this.logger.error('Failed to get user rewards:', error);
      throw new InternalServerErrorException('Failed to get user rewards');
    }
  }

  /**
   * Calculate reward amount based on tier and activity
   */
  async calculateRewardAmount(
    tier: string,
    activity: string,
    multiplier: number = 1.0
  ): Promise<number> {
    try {
      // Get base reward amounts from config
      const baseRewards = this.configService.get('REFERRAL_BASE_REWARDS', {
        SIGNUP: 5,
        KYC: 10,
        FIRST_TRADE: 20,
        FIRST_BET: 15
      });

      // Get tier multipliers
      const tierMultipliers = this.configService.get('REFERRAL_TIER_MULTIPLIERS', {
        BRONZE: 1.0,
        SILVER: 1.5,
        GOLD: 2.0,
        PLATINUM: 3.0,
        DIAMOND: 5.0
      });

      const baseAmount = baseRewards[activity] || 0;
      const tierMultiplier = tierMultipliers[tier] || 1.0;

      return Math.round(baseAmount * tierMultiplier * multiplier);
    } catch (error) {
      this.logger.error('Failed to calculate reward amount:', error);
      return 0;
    }
  }

  /**
   * Get tier multiplier for user
   */
  async getTierMultiplier(userId: string): Promise<number> {
    try {
      // Get user's referral stats to determine tier
      const stats = await this.prisma.referral.groupBy({
        by: ['referrerId'],
        where: {
          referrerId: userId,
          status: 'COMPLETED'
        },
        _count: {
          referrerId: true
        },
        _sum: {
          rewardAmount: true
        }
      });

      const completedReferrals = stats[0]?._count.referrerId || 0;
      const totalEarnings = stats[0]?._sum.rewardAmount || 0;

      // Determine tier based on referral count and earnings
      if (completedReferrals >= 50 || totalEarnings >= 1000) return 5.0; // DIAMOND
      if (completedReferrals >= 20 || totalEarnings >= 500) return 3.0;   // PLATINUM
      if (completedReferrals >= 10 || totalEarnings >= 200) return 2.0;   // GOLD
      if (completedReferrals >= 5 || totalEarnings >= 100) return 1.5;    // SILVER
      if (completedReferrals >= 1 || totalEarnings >= 50) return 1.0;     // BRONZE

      return 1.0; // Default
    } catch (error) {
      this.logger.error('Failed to get tier multiplier:', error);
      return 1.0;
    }
  }

  /**
   * Get available reward types
   */
  async getAvailableRewardTypes(): Promise<RewardType[]> {
    return Object.values(RewardType);
  }

  /**
   * Get reward by ID
   */
  async getRewardById(rewardId: string): Promise<RewardDto> {
    try {
      const reward = await this.prisma.referralReward.findUnique({
        where: { id: rewardId },
        include: {
          claims: {
            select: { id: true }
          }
        }
      });

      if (!reward) {
        throw new NotFoundException('Reward not found');
      }

      return this.formatReward(reward);
    } catch (error) {
      this.logger.error('Failed to get reward:', error);
      throw error;
    }
  }

  /**
   * Update reward
   */
  async updateReward(rewardId: string, updateData: UpdateRewardDto): Promise<RewardDto> {
    this.logger.log(`Updating reward: ${rewardId}`);

    try {
      const reward = await this.prisma.referralReward.update({
        where: { id: rewardId },
        data: updateData
      });

      // Invalidate cache
      await this.invalidateRewardCache();

      this.logger.log(`Reward updated: ${rewardId}`);
      return this.formatReward(reward);
    } catch (error) {
      this.logger.error('Failed to update reward:', error);
      throw new InternalServerErrorException('Failed to update reward');
    }
  }

  /**
   * Delete reward
   */
  async deleteReward(rewardId: string): Promise<void> {
    this.logger.log(`Deleting reward: ${rewardId}`);

    try {
      await this.prisma.referralReward.delete({
        where: { id: rewardId }
      });

      // Invalidate cache
      await this.invalidateRewardCache();

      this.logger.log(`Reward deleted: ${rewardId}`);
    } catch (error) {
      this.logger.error('Failed to delete reward:', error);
      throw new InternalServerErrorException('Failed to delete reward');
    }
  }

  /**
   * Get all rewards (admin)
   */
  async getAllRewards(filters: {
    isActive?: boolean;
    type?: RewardType;
    tier?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ rewards: RewardDto[]; total: number }> {
    try {
      const { isActive, type, tier, limit = 50, offset = 0 } = filters;

      const whereClause: any = {};
      if (isActive !== undefined) whereClause.isActive = isActive;
      if (type) whereClause.type = type;
      if (tier) whereClause.tier = tier;

      const [rewards, total] = await Promise.all([
        this.prisma.referralReward.findMany({
          where: whereClause,
          include: {
            claims: {
              select: { id: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.referralReward.count({ where: whereClause }),
      ]);

      const formattedRewards = rewards.map(reward => this.formatReward(reward));

      return { rewards: formattedRewards, total };
    } catch (error) {
      this.logger.error('Failed to get all rewards:', error);
      throw new InternalServerErrorException('Failed to get rewards');
    }
  }

  private async invalidateRewardCache(): Promise<void> {
    const keys = await this.redis.keys('user:rewards:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private formatReward(reward: any): RewardDto {
    return {
      id: reward.id,
      name: reward.name,
      description: reward.description,
      type: reward.type,
      tier: reward.tier,
      value: reward.value,
      requirements: reward.requirements,
      isActive: reward.isActive,
      startDate: reward.startDate,
      endDate: reward.endDate,
      maxClaims: reward.maxClaims,
      currentClaims: reward._count?.claims || 0,
      canClaim: reward.isActive &&
                reward.startDate <= new Date() &&
                reward.endDate >= new Date() &&
                (reward.maxClaims === 0 || reward._count?.claims < reward.maxClaims),
      claimedByUser: false, // This would be set per user context
      createdAt: reward.createdAt,
      updatedAt: reward.updatedAt
    };
  }
}
