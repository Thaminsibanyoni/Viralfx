import { Injectable } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { Prisma } from '@prisma/client';

@Injectable()
export class UsageService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService) {}

  async trackApiUsage(apiKeyId: string, endpoint: string, method: string, responseTime: number) {
    try {
      // Track usage in database
      await this.prisma.apiUsage.create({
        data: {
          apiKeyId,
          endpoint,
          method,
          responseTime,
          timestamp: new Date(),
        },
      });

      // Update Redis counters
      const key = `api-usage:${apiKeyId}:${new Date().toISOString().split('T')[0]}`;
      await this.redis.incr(key);
      await this.redis.expire(key, 86400); // 24 hours

      return true;
    } catch (error) {
      console.error('Failed to track API usage:', error);
      return false;
    }
  }

  async getUsageStats(apiKeyId: string, dateFrom?: Date, dateTo?: Date) {
    try {
      const where: Prisma.ApiUsageWhereInput = {
        apiKeyId,
      };

      if (dateFrom || dateTo) {
        where.timestamp = {};
        if (dateFrom) where.timestamp.gte = dateFrom;
        if (dateTo) where.timestamp.lte = dateTo;
      }

      const [total, usage, avgResponseTime] = await Promise.all([
        this.prisma.apiUsage.count({ where }),
        this.prisma.apiUsage.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: 100,
        }),
        this.prisma.apiUsage.aggregate({
          where,
          _avg: { responseTime: true },
        }),
      ]);

      return {
        total,
        usage,
        avgResponseTime: avgResponseTime._avg.responseTime || 0,
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      throw error;
    }
  }
}