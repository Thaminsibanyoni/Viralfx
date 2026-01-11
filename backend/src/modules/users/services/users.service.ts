import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
// import { AuditLog } from "../../audit/decorators/audit-log.decorator";

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  preferences?: any;
  isActive: boolean;
  isVerified: boolean;
  isDeleted: boolean;
  kycStatus?: string;
  referralCode?: string;
  referredBy?: string;
  suspensionReason?: string;
  suspendedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis) {}

  async findById(id: string): Promise<User | null> {
    // Try cache first
    const cacheKey = `user:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        preferences: true,
        isActive: true,
        isVerified: true,
        isDeleted: true,
        kycStatus: true,
        referralCode: true,
        referredBy: true,
        suspensionReason: true,
        suspendedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });

    if (user) {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(user));
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        preferences: true,
        isActive: true,
        isVerified: true,
        isDeleted: true,
        kycStatus: true,
        referralCode: true,
        referredBy: true,
        suspensionReason: true,
        suspendedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        preferences: true,
        isActive: true,
        isVerified: true,
        isDeleted: true,
        kycStatus: true,
        referralCode: true,
        referredBy: true,
        suspensionReason: true,
        suspendedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });
  }

  // @AuditLog({ action: 'UPDATE_PROFILE', resource: 'User' })
  async updateProfile(userId: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check for conflicts
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await this.findByEmail(updateData.email);
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await this.findByUsername(updateData.username);
      if (existingUser) {
        throw new ConflictException('Username already exists');
      }
    }

    const { preferences, ...otherData } = updateData;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...otherData,
        preferences: preferences ? { ...(user.preferences || {}), ...preferences } : undefined
      } as any,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        preferences: true,
        isActive: true,
        isVerified: true,
        isDeleted: true,
        kycStatus: true,
        referralCode: true,
        referredBy: true,
        suspensionReason: true,
        suspendedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });

    // Invalidate cache
    await this.redis.del(`user:${userId}`);

    this.logger.log(`Profile updated for user ${userId}`);
    return updatedUser;
  }

  async updatePreferences(userId: string, preferences: any): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: { ...(user.preferences || {}), ...preferences }
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        preferences: true,
        isActive: true,
        isVerified: true,
        isDeleted: true,
        kycStatus: true,
        referralCode: true,
        referredBy: true,
        suspensionReason: true,
        suspendedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });

    // Invalidate cache
    await this.redis.del(`user:${userId}`);

    return updatedUser;
  }

  async searchUsers(query: string, page: number = 1, limit: number = 20): Promise<{ users: User[]; total: number }> {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
          isDeleted: false
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          preferences: true,
          isActive: true,
          isVerified: true,
          isDeleted: true,
          kycStatus: true,
          referralCode: true,
          referredBy: true,
          suspensionReason: true,
          suspendedAt: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true
        },
        skip,
        take: limit
      }),
      this.prisma.user.count({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
          isDeleted: false
        }
      }),
    ]);

    return { users, total };
  }

  async getUserStats(userId: string): Promise<any> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get stats from Prisma
    const [betsCount, marketsCount, totalVolume] = await Promise.all([
      this.prisma.bet.count({ where: { userId } }),
      this.prisma.market.count(), // Count all markets for now
      this.prisma.bet.aggregate({
        where: { userId },
        _sum: { stake: true }
      }),
    ]);

    return {
      totalBets: betsCount,
      totalMarkets: marketsCount,
      totalVolume: totalVolume._sum.stake || 0,
      joinDate: user.createdAt,
      lastLogin: user.lastLoginAt,
      verificationStatus: user.isVerified,
      kycStatus: user.kycStatus
    };
  }

  // @AuditLog({ action: 'SUSPEND_USER', resource: 'User' })
  async suspendUser(userId: string, reason: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        suspensionReason: reason,
        suspendedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        preferences: true,
        isActive: true,
        isVerified: true,
        isDeleted: true,
        kycStatus: true,
        referralCode: true,
        referredBy: true,
        suspensionReason: true,
        suspendedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });

    // Invalidate cache
    await this.redis.del(`user:${userId}`);

    this.logger.warn(`User ${userId} suspended: ${reason}`);
    return updatedUser;
  }

  // @AuditLog({ action: 'ACTIVATE_USER', resource: 'User' })
  async activateUser(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        suspensionReason: null,
        suspendedAt: null
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        preferences: true,
        isActive: true,
        isVerified: true,
        isDeleted: true,
        kycStatus: true,
        referralCode: true,
        referredBy: true,
        suspensionReason: true,
        suspendedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });

    // Invalidate cache
    await this.redis.del(`user:${userId}`);

    this.logger.log(`User ${userId} activated`);
    return updatedUser;
  }

  // @AuditLog({ action: 'DELETE_USER', resource: 'User' })
  async deleteUser(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Perform soft delete while preserving VPMX historical data
    await this.prisma.$transaction(async (tx) => {
      // Soft delete the user account
      await tx.user.update({
        where: { id: userId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false, // Also deactivate the account
          status: 'DELETED' // Update status enum for consistency
        }
      });

      // Preserve VPMX historical data by soft deleting related records
      // This maintains audit trail and market integrity

      // Soft delete VPMX exposure records
      await tx.vpmxExposure.updateMany({
        where: { userId },
        data: {
          deletedAt: new Date(),
          status: 'CLOSED' // Close active exposures
        }
      });

      // Soft delete VPMX user fairness record (preserves historical fairness data)
      await tx.vPMXUserFairness.updateMany({
        where: { userId },
        data: {
          deletedAt: new Date()
        }
      });

      // Close any active VPMX bets to maintain market integrity
      await tx.vPMXBet.updateMany({
        where: {
          userId,
          status: 'PENDING' // Only affect pending bets
        },
        data: {
          status: 'REFUNDED'
        }
      });
    });

    // Invalidate cache
    await this.redis.del(`user:${userId}`);

    this.logger.log(`User ${userId} soft deleted with VPMX historical data preserved`);
  }

  async validateReferralCode(referralCode: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        referralCode,
        isActive: true,
        isDeleted: false
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        preferences: true,
        isActive: true,
        isVerified: true,
        isDeleted: true,
        kycStatus: true,
        referralCode: true,
        referredBy: true,
        suspensionReason: true,
        suspendedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });
  }

  async createReferralRelationship(referrerId: string, refereeId: string): Promise<void> {
    // Update referee with referrer ID
    await this.prisma.user.update({
      where: { id: refereeId },
      data: {
        referredBy: referrerId
      }
    });

    // Invalidate caches
    await Promise.all([
      this.redis.del(`user:${referrerId}`),
      this.redis.del(`user:${refereeId}`),
    ]);

    this.logger.log(`Referral relationship created: ${referrerId} -> ${refereeId}`);
  }

  async listUsers(query: any): Promise<{ users: User[]; total: number }> {
    const {
      search,
      status,
      kycStatus,
      role,
      country,
      createdAfter,
      createdBefore,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { isDeleted: false };

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.isActive = status === 'active';
    }

    if (kycStatus) {
      where.kycStatus = kycStatus;
    }

    if (createdAfter) {
      where.createdAt = { ...where.createdAt, gte: new Date(createdAfter) };
    }

    if (createdBefore) {
      where.createdAt = { ...where.createdAt, lte: new Date(createdBefore) };
    }

    // Build order clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          preferences: true,
          isActive: true,
          isVerified: true,
          isDeleted: true,
          kycStatus: true,
          referralCode: true,
          referredBy: true,
          suspensionReason: true,
          suspendedAt: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true
        },
        skip,
        take: limit,
        orderBy
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }
}
