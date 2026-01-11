import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { CreatePlanDto, UpdatePlanDto } from '../dto/create-plan.dto';
import { ApiPlan } from '../interfaces/api-marketplace.interface';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async createPlan(productId: string, dto: CreatePlanDto): Promise<ApiPlan> {
    // Check if plan code already exists
    const existing = await this.prisma.apiPlan.findUnique({
      where: { code: dto.code }
    });

    if (existing) {
      throw new BadRequestException(`Plan with code '${dto.code}' already exists`);
    }

    // Validate that product exists
    const product = await this.prisma.apiProduct.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Validation: if perCallFee is set, quota should be null (unlimited)
    if (dto.perCallFee && dto.quota) {
      throw new BadRequestException('Cannot set both perCallFee and quota. Use one pricing model.');
    }

    const plan = await this.prisma.apiPlan.create({
      data: {
        ...dto,
        productId
      },
      include: {
        product: true
      }
    });

    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<ApiPlan> {
    const plan = await this.prisma.apiPlan.findUnique({
      where: { id },
      include: { _count: { select: { apiKeys: true } } }
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Check code uniqueness if updating
    if (dto.code && dto.code !== plan.code) {
      const existing = await this.prisma.apiPlan.findUnique({
        where: { code: dto.code }
      });

      if (existing) {
        throw new BadRequestException(`Plan with code '${dto.code}' already exists`);
      }
    }

    // Validate pricing model
    if (dto.perCallFee && dto.quota) {
      throw new BadRequestException('Cannot set both perCallFee and quota. Use one pricing model.');
    }

    // Don't allow removing quota if plan has active keys and no perCallFee
    if (dto.quota === null && !dto.perCallFee && plan._count.apiKeys > 0) {
      throw new BadRequestException('Cannot remove quota from plan with active API keys without setting perCallFee');
    }

    const updated = await this.prisma.apiPlan.update({
      where: { id },
      data: dto,
      include: {
        product: true
      }
    });

    return updated;
  }

  async getPlan(code: string): Promise<ApiPlan | null> {
    const plan = await this.prisma.apiPlan.findUnique({
      where: { code },
      include: {
        product: true,
        _count: {
          select: { apiKeys: true }
        }
      }
    });

    return plan;
  }

  async listPlans(productId?: string): Promise<ApiPlan[]> {
    const where = productId ? { productId } : {};

    const plans = await this.prisma.apiPlan.findMany({
      where,
      include: {
        product: true,
        _count: {
          select: { apiKeys: true }
        }
      },
      orderBy: [
        { productId: 'asc' },
        { monthlyFee: 'asc' },
      ]
    });

    return plans;
  }

  async deletePlan(id: string): Promise<void> {
    const plan = await this.prisma.apiPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { apiKeys: true }
        }
      }
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Check if plan has active API keys
    if (plan._count.apiKeys > 0) {
      throw new BadRequestException('Cannot delete plan with active API keys');
    }

    await this.prisma.apiPlan.delete({
      where: { id }
    });
  }

  async validatePlanLimits(planId: string, currentUsage: number): Promise<{
    withinLimit: boolean;
    remaining?: number;
    overage?: number;
  }> {
    const plan = await this.prisma.apiPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (!plan.quota) {
      // Unlimited quota
      return { withinLimit: true };
    }

    const remaining = plan.quota - currentUsage;

    return {
      withinLimit: remaining >= 0,
      remaining: Math.max(0, remaining),
      overage: remaining < 0 ? Math.abs(remaining) : undefined
    };
  }

  async calculateOverageFees(planId: string, overageCalls: number): Promise<number> {
    const plan = await this.prisma.apiPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (!plan.perCallFee) {
      return 0; // No per-call fee for this plan
    }

    // Calculate overage fees in ZAR
    return Number(plan.perCallFee) * overageCalls;
  }

  async getPlanRevenue(planId: string, dateRange?: { start: Date; end: Date }): Promise<{
    subscriptionRevenue: number;
    overageRevenue: number;
    totalRevenue: number;
    activeKeys: number;
  }> {
    // Count active API keys for this plan
    const activeKeys = await this.prisma.apiKey.count({
      where: {
        planId,
        revoked: false,
        expiresAt: {
          gte: new Date()
        }
      }
    });

    // Get plan details
    const plan = await this.prisma.apiPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Calculate subscription revenue (active keys * monthly fee)
    const subscriptionRevenue = activeKeys * Number(plan.monthlyFee);

    // Calculate overage revenue from usage using relational filter
    const usageWhere: any = {
      apiKey: {
        planId
      }
    };

    if (dateRange) {
      usageWhere.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      };
    }

    const usage = await this.prisma.apiUsage.findMany({
      where: usageWhere,
      include: {
        apiKey: {
          select: {
            quotaResetAt: true,
            usageCount: true
          }
        }
      }
    });

    let overageRevenue = 0;
    if (plan.perCallFee) {
      // This is simplified - in production, you'd need to track monthly quotas per key
      const totalOverageCalls = usage.length; // Simplified calculation
      overageRevenue = Number(plan.perCallFee) * totalOverageCalls;
    }

    return {
      subscriptionRevenue,
      overageRevenue,
      totalRevenue: subscriptionRevenue + overageRevenue,
      activeKeys
    };
  }

  async getPlanUsageStats(planId: string, dateRange?: { start: Date; end: Date }): Promise<{
    totalRequests: number;
    uniqueKeys: number;
    averageUsagePerKey: number;
    topUsers: Array<{
      id: string;
      email?: string;
      companyName?: string;
      usage: number;
    }>;
  }> {
    // Build relational filter for ApiUsage through ApiKey
    const usageWhere: any = {
      apiKey: {
        planId
      }
    };

    if (dateRange) {
      usageWhere.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      };
    }

    const [totalRequests, uniqueKeysData] = await Promise.all([
      // Total requests
      this.prisma.apiUsage.count({
        where: usageWhere
      }),

      // Unique keys with usage counts
      this.prisma.apiUsage.groupBy({
        by: ['apiKeyId'],
        where: usageWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      }),
    ]);

    // Get details for top users
    const topUsers = await this.prisma.apiKey.findMany({
      where: {
        id: {
          in: uniqueKeysData.map(u => u.apiKeyId)
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        broker: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true
          }
        },
        _count: {
          select: {
            apiUsage: {
              where: dateRange ? {
                apiKey: {
                  planId
                },
                createdAt: {
                  gte: dateRange.start,
                  lte: dateRange.end
                }
              } : {
                apiKey: {
                  planId
                }
              }
            }
          }
        }
      },
      orderBy: {
        apiUsage: {
          _count: 'desc'
        }
      }
    });

    return {
      totalRequests,
      uniqueKeys: uniqueKeysData.length,
      averageUsagePerKey: uniqueKeysData.length > 0 ? totalRequests / uniqueKeysData.length : 0,
      topUsers: topUsers.map(key => ({
        id: key.userId || key.brokerId || key.id,
        email: key.user?.email || key.broker?.contactEmail,
        companyName: key.broker?.companyName,
        usage: key._count.apiUsage
      }))
    };
  }
}
