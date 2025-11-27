import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CreateKeyDto, UpdateKeyDto } from '../dto/create-key.dto';
import { ApiKey, ApiKeyWithDetails, RateLimitResult } from '../interfaces/api-marketplace.interface';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class KeysService {
  private readonly KEY_LENGTH = 32;
  private readonly SALT_ROUNDS = 12;
  private readonly RATE_LIMIT_TTL = 60; // 1 minute
  private readonly BURST_TTL = 10; // 10 seconds

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async generateKey(
    userId: string | null,
    brokerId: string | null,
    dto: CreateKeyDto,
  ): Promise<{ key: string; apiKey: ApiKey }> {
    // Validate that exactly one of userId or brokerId is provided
    if (!userId && !brokerId) {
      throw new BadRequestException('Either userId or brokerId must be provided');
    }
    if (userId && brokerId) {
      throw new BadRequestException('Cannot specify both userId and brokerId');
    }

    // Validate plan exists
    const plan = await this.prisma.apiPlan.findUnique({
      where: { id: dto.planId },
      include: { product: true },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Generate API key
    const rawKey = `vrfx_${randomBytes(this.KEY_LENGTH).toString('hex').toUpperCase()}`;
    const keyHash = await bcrypt.hash(rawKey, this.SALT_ROUNDS);

    // Set quota reset date to next month
    const now = new Date();
    const quotaResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        brokerId,
        planId: dto.planId,
        productId: plan.productId,
        key: keyHash,
        secretHash: await bcrypt.hash(randomBytes(32).toString('hex'), this.SALT_ROUNDS),
        label: dto.label,
        ipWhitelist: dto.ipWhitelist || [],
        isSandbox: dto.isSandbox ?? false,
        metadata: dto.metadata || {},
        quotaResetAt,
        expiresAt: dto.isSandbox ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null, // 30 days for sandbox
      },
      include: {
        plan: {
          include: { product: true },
        },
      },
    });

    // Invalidate product cache
    await this.invalidateProductCache(plan.product.slug);

    return { key: rawKey, apiKey };
  }

  async validateKey(key: string): Promise<ApiKeyWithDetails | null> {
    // Extract the unique identifier from the key (everything after vrfx_ up to first underscore)
    const keyMatch = key.match(/^vrfx_([A-F0-9]+)_?/);
    if (!keyMatch) {
      return null;
    }

    const keyIdentifier = keyMatch[1];

    // Get API keys that match the identifier pattern (much more efficient)
    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
        // Look for keys that might contain this identifier
        key: {
          contains: keyIdentifier,
        },
      },
      include: {
        plan: {
          include: { product: true },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        broker: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
          },
        },
      },
    });

    // Check each key hash (much smaller subset now)
    for (const apiKey of apiKeys) {
      const isValid = await bcrypt.compare(key, apiKey.key);
      if (isValid) {
        // Update last used timestamp
        await this.prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        });

        return apiKey as ApiKeyWithDetails;
      }
    }

    return null;
  }

  async updateKey(
    id: string,
    userId: string | undefined,
    brokerId: string | undefined,
    dto: UpdateKeyDto,
  ): Promise<ApiKeyWithDetails> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    // Check ownership
    if (userId && apiKey.userId !== userId) {
      throw new ForbiddenException('You can only update your own API keys');
    }
    if (brokerId && apiKey.brokerId !== brokerId) {
      throw new ForbiddenException('You can only update your own API keys');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        label: dto.label,
        ipWhitelist: dto.ipWhitelist,
        metadata: dto.metadata,
      },
      include: {
        plan: {
          include: { product: true },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        broker: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
          },
        },
      },
    });

    return updated as ApiKeyWithDetails;
  }

  async revokeKey(id: string, userId?: string, brokerId?: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
      include: {
        plan: {
          include: { product: true },
        },
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    // Check ownership
    if (userId && apiKey.userId !== userId) {
      throw new ForbiddenException('You can only revoke your own API keys');
    }
    if (brokerId && apiKey.brokerId !== brokerId) {
      throw new ForbiddenException('You can only revoke your own API keys');
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: { revoked: true },
    });

    // Clear from cache
    await this.clearKeyFromCache(apiKey.id);

    // Invalidate product cache
    if (apiKey.plan?.product?.slug) {
      await this.invalidateProductCache(apiKey.plan.product.slug);
    }
  }

  async rotateKey(id: string, userId?: string, brokerId?: string): Promise<{ key: string; apiKey: ApiKey }> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
      include: {
        plan: {
          include: { product: true },
        },
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    // Check ownership
    if (userId && apiKey.userId !== userId) {
      throw new ForbiddenException('You can only rotate your own API keys');
    }
    if (brokerId && apiKey.brokerId !== brokerId) {
      throw new ForbiddenException('You can only rotate your own API keys');
    }

    // Generate new key
    const rawKey = `vrfx_${randomBytes(this.KEY_LENGTH).toString('hex').toUpperCase()}`;
    const keyHash = await bcrypt.hash(rawKey, this.SALT_ROUNDS);

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        key: keyHash,
        lastUsedAt: new Date(),
      },
      include: {
        plan: {
          include: { product: true },
        },
      },
    });

    // Clear old key from cache
    await this.clearKeyFromCache(id);

    // Invalidate product cache
    if (apiKey.plan?.product?.slug) {
      await this.invalidateProductCache(apiKey.plan.product.slug);
    }

    return { key: rawKey, apiKey: updated };
  }

  async listKeys(userId?: string, brokerId?: string): Promise<ApiKeyWithDetails[]> {
    const where: any = {};

    if (userId) where.userId = userId;
    if (brokerId) where.brokerId = brokerId;

    const apiKeys = await this.prisma.apiKey.findMany({
      where,
      include: {
        plan: {
          include: { product: true },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        broker: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
          },
        },
        _count: {
          select: { apiUsage: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys as ApiKeyWithDetails[];
  }

  async checkRateLimit(apiKeyId: string): Promise<RateLimitResult> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      include: { plan: true },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const { rateLimit, burstLimit } = apiKey.plan;
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000) * 60000;

    // Check regular rate limit (sliding window)
    const rateLimitKey = `ratelimit:${apiKeyId}:${currentMinute}`;
    const currentCount = await this.redis.incr(rateLimitKey);

    if (currentCount === 1) {
      await this.redis.expire(rateLimitKey, this.RATE_LIMIT_TTL);
    }

    const remaining = Math.max(0, rateLimit - currentCount);
    const allowed = currentCount <= rateLimit;

    // Check burst limit if configured
    if (burstLimit && allowed) {
      const burstKey = `burst:${apiKeyId}:${Math.floor(now / 10000) * 10000}`; // 10-second windows
      const burstCount = await this.redis.incr(burstKey);

      if (burstCount === 1) {
        await this.redis.expire(burstKey, this.BURST_TTL);
      }

      if (burstCount > burstLimit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(currentMinute + 60000),
          retryAfter: this.BURST_TTL,
        };
      }
    }

    return {
      allowed,
      remaining,
      resetAt: new Date(currentMinute + 60000),
      retryAfter: allowed ? undefined : 60,
    };
  }

  async incrementUsage(apiKeyId: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  async resetQuota(apiKeyId: string): Promise<void> {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        usageCount: 0,
        quotaResetAt: nextMonth,
      },
    });

    // Clear usage cache
    await this.clearKeyFromCache(apiKeyId);
  }

  async getRemainingQuota(apiKeyId: string): Promise<number> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      include: { plan: true },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    if (!apiKey.plan.quota) {
      return Infinity; // Unlimited
    }

    const remaining = apiKey.plan.quota - apiKey.usageCount;
    return Math.max(0, remaining);
  }

  async validateIpWhitelist(apiKey: ApiKey, clientIp: string): Promise<boolean> {
    if (!apiKey.ipWhitelist || apiKey.ipWhitelist.length === 0) {
      return true; // No IP whitelist restriction
    }

    // Simple IP check (can be enhanced for CIDR)
    return apiKey.ipWhitelist.includes(clientIp);
  }

  private async clearKeyFromCache(apiKeyId: string): Promise<void> {
    const patterns = [
      `ratelimit:${apiKeyId}:*`,
      `burst:${apiKeyId}:*`,
      `api:usage:${apiKeyId}`,
      `api:quota:${apiKeyId}`,
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  private async invalidateProductCache(productSlug: string): Promise<void> {
    const keys = [
      `api:product:${productSlug}`,
      `api:products:*`, // Invalidate the list as well
    ];

    // Delete specific product key
    await this.redis.del(`api:product:${productSlug}`);

    // Clear all list cache keys
    const listKeys = await this.redis.keys('api:products:*');
    if (listKeys.length > 0) {
      await this.redis.del(...listKeys);
    }
  }
}