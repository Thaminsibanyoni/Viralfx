import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Redis } from 'ioredis';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  ReferralCodeDto,
  CreateReferralCodeDto,
  ReferralStatsDto,
  LeaderboardDto,
  RewardDto,
  ClaimRewardDto,
  ReferralQueryDto,
  RewardClaimDto,
} from '../dto/referral.dto';
import {
  ReferralStatus,
  RewardStatus,
  RewardType,
  RewardTier,
  ReferralEventType,
} from '../types/referral.types';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);
  private readonly referralCacheTTL = 300; // 5 minutes
  private readonly leaderboardCacheTTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a referral code for a user
   */
  async createReferralCode(
    userId: string,
    createData: CreateReferralCodeDto
  ): Promise<ReferralCodeDto> {
    this.logger.log(`Creating referral code for user ${userId}`);

    try {
      // Check if user already has an active referral code
      const existingCode = await this.prisma.referralCode.findFirst({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      });

      if (existingCode && !createData.allowMultiple) {
        throw new BadRequestException('User already has an active referral code');
      }

      // Generate unique referral code
      const code = await this.generateUniqueReferralCode();

      const referralCode = await this.prisma.referralCode.create({
        data: {
          userId,
          code,
          description: createData.description,
          maxUses: createData.maxUses || 0, // 0 = unlimited
          expiresAt: createData.expiresAt || this.getDefaultExpiryDate(),
          rewardMultiplier: createData.rewardMultiplier || 1.0,
          isActive: true,
          metadata: createData.metadata || {},
        },
      });

      // Cache the referral code
      await this.cacheReferralCode(referralCode);

      this.logger.log(`Referral code created: ${code} for user ${userId}`);
      return this.formatReferralCode(referralCode);
    } catch (error) {
      this.logger.error('Failed to create referral code:', error);
      throw new InternalServerErrorException('Failed to create referral code');
    }
  }

  /**
   * Get user's referral codes
   */
  async getUserReferralCodes(
    userId: string,
    query: ReferralQueryDto = {}
  ): Promise<{
    codes: ReferralCodeDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, isActive } = query;
    const skip = (page - 1) * limit;

    const whereClause: any = { userId };

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
      if (isActive) {
        whereClause.expiresAt = { gt: new Date() };
      }
    }

    const [codes, total] = await Promise.all([
      this.prisma.referralCode.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.referralCode.count({ where: whereClause }),
    ]);

    return {
      codes: codes.map(code => this.formatReferralCode(code)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Validate and use a referral code
   */
  async useReferralCode(
    code: string,
    newUserId: string,
    metadata?: any
  ): Promise<{
    success: boolean;
    referralCode?: ReferralCodeDto;
    message?: string;
  }> {
    this.logger.log(`Attempting to use referral code: ${code} by user ${newUserId}`);

    try {
      // Check cache first
      let referralCode = await this.getCachedReferralCode(code);

      if (!referralCode) {
        // Query database
        referralCode = await this.prisma.referralCode.findUnique({
          where: { code },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        });
      }

      if (!referralCode) {
        return { success: false, message: 'Invalid referral code' };
      }

      // Validate referral code
      const validation = await this.validateReferralCode(referralCode, newUserId);
      if (!validation.isValid) {
        return { success: false, message: validation.reason };
      }

      // Check if user has already used this referral code
      const existingReferral = await this.prisma.referral.findFirst({
        where: {
          referralCodeId: referralCode.id,
          referredUserId: newUserId,
        },
      });

      if (existingReferral) {
        return { success: false, message: 'You have already used this referral code' };
      }

      // Create referral record
      const referral = await this.prisma.$transaction(async (tx) => {
        // Update referral code usage
        await tx.referralCode.update({
          where: { id: referralCode.id },
          data: {
            usedCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });

        // Create referral record
        return await tx.referral.create({
          data: {
            referralCodeId: referralCode.id,
            referrerId: referralCode.userId,
            referredUserId: newUserId,
            status: ReferralStatus.PENDING,
            metadata: {
              ...metadata,
              ipAddress: metadata?.ipAddress,
              userAgent: metadata?.userAgent,
            },
          },
        });
      });

      // Track referral event
      await this.trackReferralEvent({
        referralId: referral.id,
        eventType: ReferralEventType.CODE_USED,
        userId: newUserId,
        metadata: { referralCode: code },
      });

      // Invalidate cache
      await this.invalidateReferralCodeCache(code);

      this.logger.log(`Referral code used successfully: ${code} by user ${newUserId}`);

      return {
        success: true,
        referralCode: this.formatReferralCode(referralCode),
        message: 'Referral code applied successfully!',
      };
    } catch (error) {
      this.logger.error('Failed to use referral code:', error);
      throw new InternalServerErrorException('Failed to process referral code');
    }
  }

  /**
   * Confirm referral (e.g., after user completes registration, makes first purchase, etc.)
   */
  async confirmReferral(
    referralId: string,
    confirmData: {
      eventType: ReferralEventType;
      metadata?: any;
    }
  ): Promise<void> {
    this.logger.log(`Confirming referral: ${referralId} with event: ${confirmData.eventType}`);

    try {
      const referral = await this.prisma.referral.findUnique({
        where: { id: referralId },
        include: {
          referralCode: true,
          referrer: {
            select: {
              id: true,
              username: true,
            },
          },
          referredUser: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      if (!referral) {
        throw new NotFoundException('Referral not found');
      }

      if (referral.status === ReferralStatus.COMPLETED) {
        return; // Already completed
      }

      // Update referral based on event type
      let updateData: any = {};

      switch (confirmData.eventType) {
        case ReferralEventType.REGISTERED:
          updateData.status = ReferralStatus.REGISTERED;
          updateData.registeredAt = new Date();
          break;

        case ReferralEventType.FIRST_PURCHASE:
        case ReferralEventType.FIRST_BET:
          updateData.status = ReferralStatus.COMPLETED;
          updateData.completedAt = new Date();
          updateData.completedEventType = confirmData.eventType;
          break;

        case ReferralEventType.QUALIFIED:
          updateData.status = ReferralStatus.QUALIFIED;
          updateData.qualifiedAt = new Date();
          break;
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.$transaction(async (tx) => {
          await tx.referral.update({
            where: { id: referralId },
            data: {
              ...updateData,
              metadata: {
                ...referral.metadata,
                ...confirmData.metadata,
              },
            },
          });

          // Track the event
          await this.trackReferralEvent({
            referralId,
            eventType: confirmData.eventType,
            userId: referral.referredUserId,
            metadata: confirmData.metadata,
          });
        });

        // If referral is completed, process rewards
        if (updateData.status === ReferralStatus.COMPLETED) {
          await this.processReferralRewards(referral);
        }
      }

      this.logger.log(`Referral confirmed: ${referralId}`);
    } catch (error) {
      this.logger.error('Failed to confirm referral:', error);
      throw new InternalServerErrorException('Failed to confirm referral');
    }
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(
    userId: string,
    timeWindow?: string
  ): Promise<ReferralStatsDto> {
    const cacheKey = `referral:stats:${userId}:${timeWindow || 'all'}`;
    const cached = await this.cacheManager.get<ReferralStatsDto>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const dateFilter = timeWindow ? {
        createdAt: { gte: new Date(Date.now() - this.parseTimeWindow(timeWindow)) },
      } : {};

      const [
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        totalEarnings,
        referralCodes,
        recentReferrals,
      ] = await Promise.all([
        this.prisma.referral.count({
          where: { referrerId: userId, ...dateFilter },
        }),
        this.prisma.referral.count({
          where: { referrerId: userId, status: ReferralStatus.COMPLETED, ...dateFilter },
        }),
        this.prisma.referral.count({
          where: { referrerId: userId, status: ReferralStatus.PENDING, ...dateFilter },
        }),
        this.prisma.referral.aggregate({
          where: {
            referrerId: userId,
            status: ReferralStatus.COMPLETED,
            ...dateFilter,
          },
          _sum: { rewardAmount: true },
        }),
        this.prisma.referralCode.findMany({
          where: { userId },
          select: {
            id: true,
            code: true,
            usedCount: true,
            isActive: true,
            expiresAt: true,
          },
        }),
        this.prisma.referral.findMany({
          where: { referrerId: userId, ...dateFilter },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            referredUser: {
              select: {
                username: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const stats: ReferralStatsDto = {
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        totalEarnings: totalEarnings._sum.rewardAmount || 0,
        conversionRate: totalReferrals > 0 ? (completedReferrals / totalReferrals) * 100 : 0,
        referralCodes: referralCodes.map(code => ({
          code: code.code,
          usedCount: code.usedCount,
          isActive: code.isActive,
          expiresAt: code.expiresAt,
        })),
        recentReferrals: recentReferrals.map(referral => ({
          id: referral.id,
          referredUser: referral.referredUser.username,
          status: referral.status,
          rewardAmount: referral.rewardAmount,
          createdAt: referral.createdAt,
        })),
      };

      // Cache the stats
      await this.cacheManager.set(cacheKey, stats, this.referralCacheTTL);

      return stats;
    } catch (error) {
      this.logger.error('Failed to get referral stats:', error);
      throw new InternalServerErrorException('Failed to get referral statistics');
    }
  }

  /**
   * Get referral leaderboard
   */
  async getLeaderboard(
    timeWindow: string = 'monthly',
    limit: number = 50,
    page: number = 1
  ): Promise<LeaderboardDto> {
    const cacheKey = `referral:leaderboard:${timeWindow}:${limit}:${page}`;
    const cached = await this.cacheManager.get<LeaderboardDto>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const dateFilter = {
        createdAt: { gte: new Date(Date.now() - this.parseTimeWindow(timeWindow)) },
      };

      const leaderboardData = await this.prisma.referral.groupBy({
        by: ['referrerId'],
        where: {
          status: ReferralStatus.COMPLETED,
          ...dateFilter,
        },
        _count: {
          referrerId: true,
        },
        _sum: {
          rewardAmount: true,
        },
        orderBy: {
          _count: { referrerId: 'desc' },
        },
        take: limit,
        skip: (page - 1) * limit,
      });

      // Get user details for leaderboard entries
      const userIds = leaderboardData.map(entry => entry.referrerId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });

      const userMap = users.reduce((map, user) => {
        map[user.id] = user;
        return map;
      }, {});

      const entries = leaderboardData.map((entry, index) => ({
        rank: (page - 1) * limit + index + 1,
        user: userMap[entry.referrerId],
        referralCount: entry._count.referrerId,
        totalEarnings: entry._sum.rewardAmount || 0,
      }));

      const leaderboard: LeaderboardDto = {
        entries,
        timeWindow,
        page,
        totalPages: Math.ceil(leaderboardData.length / limit),
        generatedAt: new Date(),
      };

      // Cache the leaderboard
      await this.cacheManager.set(cacheKey, leaderboard, this.leaderboardCacheTTL);

      return leaderboard;
    } catch (error) {
      this.logger.error('Failed to get referral leaderboard:', error);
      throw new InternalServerErrorException('Failed to get referral leaderboard');
    }
  }

  /**
   * Get available rewards
   */
  async getAvailableRewards(userId?: string): Promise<RewardDto[]> {
    try {
      const whereClause: any = {
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gt: new Date() },
      };

      const rewards = await this.prisma.referralReward.findMany({
        where: whereClause,
        orderBy: { tier: 'asc' },
        include: {
          claims: userId ? {
            where: { userId },
            select: { id: true },
          } : false,
        },
      });

      return rewards.map(reward => ({
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
        canClaim: userId ? reward.currentClaims < reward.maxClaims : false,
        claimedByUser: userId ? reward._count?.claims > 0 : false,
      }));
    } catch (error) {
      this.logger.error('Failed to get available rewards:', error);
      throw new InternalServerErrorException('Failed to get available rewards');
    }
  }

  /**
   * Claim a reward
   */
  async claimReward(
    userId: string,
    claimData: ClaimRewardDto
  ): Promise<RewardClaimDto> {
    this.logger.log(`User ${userId} claiming reward ${claimData.rewardId}`);

    try {
      const [reward, userStats] = await Promise.all([
        this.prisma.referralReward.findUnique({
          where: { id: claimData.rewardId },
        }),
        this.getReferralStats(userId),
      ]);

      if (!reward) {
        throw new NotFoundException('Reward not found');
      }

      // Validate reward claim
      const validation = await this.validateRewardClaim(reward, userStats, userId);
      if (!validation.isValid) {
        throw new BadRequestException(validation.reason);
      }

      // Create reward claim
      const claim = await this.prisma.$transaction(async (tx) => {
        // Create claim record
        const newClaim = await tx.referralRewardClaim.create({
          data: {
            userId,
            rewardId: reward.id,
            status: RewardStatus.PENDING,
            metadata: claimData.metadata || {},
          },
        });

        // Update reward claim count
        await tx.referralReward.update({
          where: { id: reward.id },
          data: {
            currentClaims: { increment: 1 },
          },
        });

        return newClaim;
      });

      // Process the reward (could involve wallet credits, etc.)
      await this.processRewardClaim(claim, reward, userId);

      this.logger.log(`Reward claimed successfully: ${claim.id} by user ${userId}`);

      return {
        id: claim.id,
        rewardId: reward.id,
        userId: userId,
        status: claim.status,
        claimedAt: claim.createdAt,
        processedAt: claim.updatedAt,
        value: reward.value,
        type: reward.type,
        name: reward.name,
      };
    } catch (error) {
      this.logger.error('Failed to claim reward:', error);
      throw new InternalServerErrorException('Failed to claim reward');
    }
  }

  /**
   * Track referral event
   */
  private async trackReferralEvent(eventData: {
    referralId: string;
    eventType: ReferralEventType;
    userId: string;
    metadata?: any;
  }): Promise<void> {
    await this.prisma.referralEvent.create({
      data: {
        referralId: eventData.referralId,
        eventType: eventData.eventType,
        userId: eventData.userId,
        metadata: eventData.metadata || {},
      },
    });
  }

  /**
   * Generate unique referral code
   */
  private async generateUniqueReferralCode(): Promise<string> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const code = this.generateReferralCode();
      const exists = await this.prisma.referralCode.findUnique({
        where: { code },
      });

      if (!exists) {
        return code;
      }

      attempts++;
    }

    throw new Error('Failed to generate unique referral code after multiple attempts');
  }

  private generateReferralCode(): string {
    const prefix = this.configService.get('REFERRAL_CODE_PREFIX', 'VFX');
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${randomPart}`;
  }

  /**
   * Validate referral code
   */
  private async validateReferralCode(
    referralCode: any,
    userId: string
  ): Promise<{ isValid: boolean; reason?: string }> {
    if (!referralCode.isActive) {
      return { isValid: false, reason: 'Referral code is not active' };
    }

    if (referralCode.expiresAt && referralCode.expiresAt < new Date()) {
      return { isValid: false, reason: 'Referral code has expired' };
    }

    if (referralCode.maxUses > 0 && referralCode.usedCount >= referralCode.maxUses) {
      return { isValid: false, reason: 'Referral code has reached maximum uses' };
    }

    if (referralCode.userId === userId) {
      return { isValid: false, reason: 'Cannot use your own referral code' };
    }

    // Check if user was referred by someone else recently
    const recentReferral = await this.prisma.referral.findFirst({
      where: {
        referredUserId: userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      },
    });

    if (recentReferral) {
      return { isValid: false, reason: 'You have already been referred recently' };
    }

    return { isValid: true };
  }

  /**
   * Process referral rewards
   */
  private async processReferralRewards(referral: any): Promise<void> {
    // Calculate rewards based on referral code multiplier
    const baseReward = this.configService.get('REFERRAL_BASE_REWARD', 10);
    const rewardAmount = baseReward * referral.referralCode.rewardMultiplier;

    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        rewardAmount,
      },
    });

    // Add to referrer's wallet (would integrate with wallet service)
    // await this.walletService.addFunds(referral.referrerId, rewardAmount, 'REFERRAL_REWARD');

    // Send notification to referrer
    // await this.notificationService.sendNotification(referral.referrerId, {
    //   type: 'REFERRAL_REWARD',
    //   message: `You earned ${rewardAmount} from a successful referral!`,
    // });
  }

  /**
   * Validate reward claim
   */
  private async validateRewardClaim(
    reward: any,
    userStats: ReferralStatsDto,
    userId: string
  ): Promise<{ isValid: boolean; reason?: string }> {
    if (!reward.isActive) {
      return { isValid: false, reason: 'Reward is not active' };
    }

    if (reward.startDate > new Date() || reward.endDate < new Date()) {
      return { isValid: false, reason: 'Reward is not available at this time' };
    }

    if (reward.currentClaims >= reward.maxClaims) {
      return { isValid: false, reason: 'Reward has reached maximum claims' };
    }

    // Check if user meets requirements
    for (const requirement of reward.requirements) {
      switch (requirement.type) {
        case 'MIN_REFERRALS':
          if (userStats.completedReferrals < requirement.value) {
            return { isValid: false, reason: `You need at least ${requirement.value} completed referrals` };
          }
          break;

        case 'MIN_EARNINGS':
          if (userStats.totalEarnings < requirement.value) {
            return { isValid: false, reason: `You need at least ${requirement.value} total earnings` };
          }
          break;
      }
    }

    return { isValid: true };
  }

  /**
   * Process reward claim
   */
  private async processRewardClaim(
    claim: any,
    reward: any,
    userId: string
  ): Promise<void> {
    try {
      switch (reward.type) {
        case RewardType.WALLET_CREDIT:
          // Add funds to user's wallet
          // await this.walletService.addFunds(userId, reward.value, 'REWARD_CLAIM');
          break;

        case RewardType.DISCOUNT_CODE:
          // Generate discount code
          const discountCode = await this.generateDiscountCode(userId, reward);
          break;

        case RewardType.FEATURE_UNLOCK:
          // Unlock feature for user
          // await this.featuresService.unlockFeature(userId, reward.value);
          break;
      }

      // Update claim status
      await this.prisma.referralRewardClaim.update({
        where: { id: claim.id },
        data: {
          status: RewardStatus.PROCESSED,
        },
      });
    } catch (error) {
      // Mark claim as failed
      await this.prisma.referralRewardClaim.update({
        where: { id: claim.id },
        data: {
          status: RewardStatus.FAILED,
          metadata: {
            error: error.message,
          },
        },
      });

      throw error;
    }
  }

  private async generateDiscountCode(userId: string, reward: any): Promise<string> {
    const code = `DISCOUNT-${userId.substring(0, 8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Store discount code
    // await this.discountService.createDiscountCode({
    //   code,
    //   userId,
    //   value: reward.value,
    //   type: 'PERCENTAGE', // or 'FIXED'
    //   expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    // });

    return code;
  }

  private getDefaultExpiryDate(): Date {
    const defaultDays = parseInt(this.configService.get('REFERRAL_CODE_DEFAULT_DAYS', '365'));
    return new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000);
  }

  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([hdwmy])$/);
    if (!match) {
      return 30 * 24 * 60 * 60 * 1000; // Default to 30 days
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      h: 60 * 60 * 1000,    // hour
      d: 24 * 60 * 60 * 1000, // day
      w: 7 * 24 * 60 * 60 * 1000, // week
      m: 30 * 24 * 60 * 60 * 1000, // month
      y: 365 * 24 * 60 * 60 * 1000, // year
    };

    return value * (multipliers[unit as keyof typeof multipliers] || multipliers.d);
  }

  private async cacheReferralCode(referralCode: any): Promise<void> {
    const cacheKey = `referral:code:${referralCode.code}`;
    await this.cacheManager.set(cacheKey, referralCode, this.referralCacheTTL);
  }

  private async getCachedReferralCode(code: string): Promise<any | null> {
    const cacheKey = `referral:code:${code}`;
    return await this.cacheManager.get<any>(cacheKey);
  }

  private async invalidateReferralCodeCache(code: string): Promise<void> {
    const cacheKey = `referral:code:${code}`;
    await this.cacheManager.del(cacheKey);
  }

  private formatReferralCode(referralCode: any): ReferralCodeDto {
    return {
      id: referralCode.id,
      userId: referralCode.userId,
      code: referralCode.code,
      description: referralCode.description,
      maxUses: referralCode.maxUses,
      usedCount: referralCode.usedCount,
      isActive: referralCode.isActive,
      rewardMultiplier: referralCode.rewardMultiplier,
      expiresAt: referralCode.expiresAt,
      createdAt: referralCode.createdAt,
      lastUsedAt: referralCode.lastUsedAt,
      user: referralCode.user,
    };
  }
}