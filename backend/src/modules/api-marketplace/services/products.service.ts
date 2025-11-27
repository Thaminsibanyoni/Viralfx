import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { ApiProduct, ProductWithPlans } from '../interfaces/api-marketplace.interface';

@Injectable()
export class ProductsService {
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createProduct(dto: CreateProductDto): Promise<ApiProduct> {
    // Check if slug already exists
    const existing = await this.prisma.apiProduct.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException(`Product with slug '${dto.slug}' already exists`);
    }

    const product = await this.prisma.apiProduct.create({
      data: {
        ...dto,
        isActive: dto.isActive ?? true,
      },
      include: {
        plans: true,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    return product;
  }

  async updateProduct(id: string, dto: Partial<CreateProductDto>): Promise<ApiProduct> {
    const product = await this.prisma.apiProduct.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check slug uniqueness if updating
    if (dto.slug && dto.slug !== product.slug) {
      const existing = await this.prisma.apiProduct.findUnique({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new BadRequestException(`Product with slug '${dto.slug}' already exists`);
      }
    }

    const updated = await this.prisma.apiProduct.update({
      where: { id },
      data: dto,
      include: {
        plans: true,
      },
    });

    // Invalidate cache
    await this.invalidateCache();
    await this.invalidateProductCache(product.slug);

    return updated;
  }

  async getProduct(slug: string): Promise<ProductWithPlans | null> {
    // Try cache first
    const cacheKey = `api:product:${slug}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const product = await this.prisma.apiProduct.findUnique({
      where: { slug },
      include: {
        plans: {
          where: { isActive: true },
          orderBy: { monthlyFee: 'asc' },
        },
        apiKeys: {
          where: {
            revoked: false,
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          },
          select: { id: true },
        },
        _count: {
          select: {
            apiUsage: true,
          },
        },
      },
    });

    if (product) {
      // Transform to include computed apiKeys count
      const transformedProduct = {
        ...product,
        _count: {
          ...product._count,
          apiKeys: product.apiKeys.length,
        },
        apiKeys: undefined, // Remove the raw apiKeys array
      };

      // Cache the result
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(transformedProduct));
      return transformedProduct;
    }

    return product;
  }

  async listProducts(filters: {
    category?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    const { category, active, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (category) where.category = category;
    if (active !== undefined) where.isActive = active;

    const [products, total] = await Promise.all([
      this.prisma.apiProduct.findMany({
        where,
        include: {
          plans: {
            where: { isActive: true },
            orderBy: { monthlyFee: 'asc' },
          },
          apiKeys: {
            where: {
              revoked: false,
              OR: [
                { expiresAt: null },
                { expiresAt: { gte: new Date() } },
              ],
            },
            select: { id: true },
          },
          _count: {
            select: {
              apiUsage: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.apiProduct.count({ where }),
    ]);

    // Transform products to include computed apiKeys count
    const transformedProducts = products.map(product => ({
      ...product,
      _count: {
        ...product._count,
        apiKeys: product.apiKeys.length,
      },
      apiKeys: undefined, // Remove the raw apiKeys array
    }));

    return {
      products: transformedProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.prisma.apiProduct.findUnique({
      where: { id },
      include: {
        apiKeys: {
          where: {
            revoked: false,
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          },
          select: { id: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if product has active API keys
    if (product.apiKeys.length > 0) {
      throw new BadRequestException('Cannot delete product with active API keys');
    }

    await this.prisma.apiProduct.delete({
      where: { id },
    });

    // Invalidate cache
    await this.invalidateCache();
    await this.invalidateProductCache(product.slug);
  }

  async getProductPlans(productId: string) {
    const plans = await this.prisma.apiPlan.findMany({
      where: { productId },
      orderBy: { monthlyFee: 'asc' },
    });

    return plans;
  }

  async getProductUsageStats(productId: string, dateRange?: { start: Date; end: Date }) {
    const where: any = { productId };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const stats = await this.prisma.apiUsage.aggregate({
      where,
      _count: { id: true },
      _sum: { bytesIn: true, bytesOut: true },
      _avg: { latencyMs: true },
    });

    // Get top endpoints
    const topEndpoints = await this.prisma.apiUsage.groupBy({
      by: ['path', 'method'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Get status code distribution
    const statusCodes = await this.prisma.apiUsage.groupBy({
      by: ['statusCode'],
      where,
      _count: { id: true },
    });

    return {
      totalRequests: stats._count.id || 0,
      totalBandwidth: (stats._sum.bytesIn || 0) + (stats._sum.bytesOut || 0),
      averageLatency: stats._avg.latencyMs || 0,
      topEndpoints: topEndpoints.map(e => ({
        path: e.path,
        method: e.method,
        count: e._count.id,
      })),
      statusCodeDistribution: statusCodes.reduce((acc, curr) => {
        acc[curr.statusCode] = curr._count.id;
        return acc;
      }, {} as Record<number, number>),
    };
  }

  private async invalidateCache(): Promise<void> {
    const pattern = 'api:products:*';
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async invalidateProductCache(slug: string): Promise<void> {
    const keys = [
      `api:product:${slug}`,
      `api:product:${slug}:plans`,
    ];
    await this.redis.del(...keys);
  }
}