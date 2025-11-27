import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { KeysService } from '../services/keys.service';
import { WebhookService } from '../services/webhook.service';
import { ApiUsageLog } from '../interfaces/api-marketplace.interface';

@Processor('api-usage')
export class UsageProcessor {
  private readonly logger = new Logger(UsageProcessor.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private keysService: KeysService,
    private webhookService: WebhookService,
  ) {}

  @Process('log')
  async handleUsageLog(job: Job<ApiUsageLog>): Promise<void> {
    const data = job.data;

    try {
      // Create usage record in database
      await this.prisma.apiUsage.create({
        data: {
          apiKeyId: data.apiKeyId,
          productId: data.productId,
          path: data.path,
          method: data.method,
          statusCode: data.statusCode,
          bytesIn: data.bytesIn,
          bytesOut: data.bytesOut,
          latencyMs: data.latencyMs,
        },
      });

      // Update API key usage count
      await this.keysService.incrementUsage(data.apiKeyId);

      // Update Redis counters
      await this.updateRedisCounters(data);

      // Check quota threshold and trigger webhook if needed
      await this.checkQuotaThreshold(data.apiKeyId);

      // Check for error rate alerts
      if (data.statusCode >= 400) {
        await this.checkErrorRate(data.apiKeyId, data.productId);
      }

      this.logger.debug(`Usage logged for API key ${data.apiKeyId}`);
    } catch (error) {
      this.logger.error(
        `Failed to log usage for API key ${data.apiKeyId}`,
        error.stack,
      );
      throw error; // Re-throw to trigger Bull retry mechanism
    }
  }

  @Process('aggregate-daily')
  async handleDailyAggregation(job: Job): Promise<void> {
    const { date } = job.data;
    const targetDate = date ? new Date(date) : new Date();

    try {
      const startDate = new Date(targetDate);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(targetDate);
      endDate.setUTCHours(23, 59, 59, 999);

      // Get all usage for the day
      const dailyUsage = await this.prisma.apiUsage.groupBy({
        by: ['productId', 'apiKeyId'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: { id: true },
        _sum: {
          bytesIn: true,
          bytesOut: true,
          latencyMs: true,
        },
      });

      // Store aggregated data in Redis
      const aggregationKey = `api:usage:aggregate:${targetDate.toISOString().split('T')[0]}`;
      for (const usage of dailyUsage) {
        const key = `${usage.productId}:${usage.apiKeyId}`;
        await this.redis.hset(
          aggregationKey,
          key,
          JSON.stringify({
            requests: usage._count.id,
            bytesIn: usage._sum.bytesIn || 0,
            bytesOut: usage._sum.bytesOut || 0,
            avgLatency: usage._count.id > 0 ? (usage._sum.latencyMs || 0) / usage._count.id : 0,
          }),
        );
      }

      // Set expiration for aggregated data (30 days)
      await this.redis.expire(aggregationKey, 86400 * 30);

      this.logger.log(`Daily usage aggregation completed for ${targetDate.toISOString().split('T')[0]}`);
    } catch (error) {
      this.logger.error(
        `Failed to aggregate daily usage for ${targetDate}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process('cleanup-old-usage')
  async handleUsageCleanup(job: Job): Promise<void> {
    const { retentionDays = 90 } = job.data;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      // Delete old usage records
      const result = await this.prisma.apiUsage.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} old usage records older than ${retentionDays} days`);
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old usage records`,
        error.stack,
      );
      throw error;
    }
  }

  private async updateRedisCounters(data: ApiUsageLog): Promise<void> {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH

    // Increment various counters
    const counters = [
      `api:usage:${data.apiKeyId}`,
      `api:usage:${data.productId}`,
      `api:usage:daily:${dateKey}`,
      `api:usage:product:${data.productId}:${dateKey}`,
      `api:usage:hourly:${hourKey}`,
      `api:status:${data.productId}:${data.statusCode}`,
    ];

    for (const counter of counters) {
      await this.redis.incr(counter);
      await this.redis.expire(counter, 86400 * 30); // 30 days
    }

    // Track endpoints
    const endpointKey = `api:endpoints:${data.apiKeyId}`;
    await this.redis.hincrby(endpointKey, `${data.method}:${data.path}`, 1);
    await this.redis.expire(endpointKey, 86400 * 7); // 7 days

    // Track latency averages
    const latencyKey = `api:latency:${data.productId}:${dateKey}`;
    await this.redis.lpush(latencyKey, data.latencyMs.toString());
    await this.redis.ltrim(latencyKey, 0, 9999); // Keep last 10k samples
    await this.redis.expire(latencyKey, 86400 * 30);
  }

  private async checkQuotaThreshold(apiKeyId: string): Promise<void> {
    try {
      const remaining = await this.keysService.getRemainingQuota(apiKeyId);

      // Get the API key to check its quota
      const apiKey = await this.prisma.apiKey.findUnique({
        where: { id: apiKeyId },
        include: {
          plan: {
            select: { quota: true },
          },
        },
      });

      if (!apiKey?.plan.quota) {
        return; // No quota configured
      }

      const percentage = ((apiKey.plan.quota - remaining) / apiKey.plan.quota) * 100;

      // Trigger webhook at 90% usage
      if (percentage >= 90 && percentage < 91) {
        await this.webhookService.triggerWebhook(
          'usage.threshold',
          {
            apiKeyId,
            usage: apiKey.usageCount,
            quota: apiKey.plan.quota,
            percentage: Math.round(percentage),
            threshold: 90,
          },
          apiKey.userId || undefined,
        );
      }

      // Trigger webhook when quota is exceeded
      if (percentage >= 100 && percentage < 101) {
        await this.webhookService.triggerWebhook(
          'quota.exceeded',
          {
            apiKeyId,
            usage: apiKey.usageCount,
            quota: apiKey.plan.quota,
            overage: apiKey.usageCount - apiKey.plan.quota,
          },
          apiKey.userId || undefined,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to check quota threshold for API key ${apiKeyId}`,
        error.message,
      );
    }
  }

  private async checkErrorRate(apiKeyId: string, productId: string): Promise<void> {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Get recent requests
      const recentUsage = await this.prisma.apiUsage.findMany({
        where: {
          apiKeyId,
          createdAt: {
            gte: fiveMinutesAgo,
          },
        },
      });

      if (recentUsage.length < 10) {
        return; // Not enough data to calculate error rate
      }

      const errorCount = recentUsage.filter(u => u.statusCode >= 400).length;
      const errorRate = (errorCount / recentUsage.length) * 100;

      // Alert if error rate is above 50%
      if (errorRate > 50) {
        await this.webhookService.triggerWebhook(
          'usage.threshold',
          {
            type: 'error_rate',
            apiKeyId,
            productId,
            errorRate: Math.round(errorRate),
            errorCount,
            totalRequests: recentUsage.length,
            timeframe: '5m',
          },
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to check error rate for API key ${apiKeyId}`,
        error.message,
      );
    }
  }
}