import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateWebhookDto, UpdateWebhookDto, TestWebhookDto } from '../dto/create-webhook.dto';
import { ApiWebhook, WebhookDelivery } from '../interfaces/api-marketplace.interface';
import { RedisService } from "../../redis/redis.service";
import { randomBytes } from 'crypto';
import * as crypto from 'crypto';
import { WebhookDeliveryStatus } from '@prisma/client';

@Injectable()
export class WebhookService {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE = 5000; // 5 seconds
  private readonly TIMEOUT = 5000; // 5 seconds
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private redis: RedisService,
    @InjectQueue('api-webhooks') private webhooksQueue: Queue) {}

  async createWebhook(userId: string, dto: CreateWebhookDto): Promise<ApiWebhook> {
    // Validate events
    const validEvents = [
      'usage.threshold',
      'invoice.paid',
      'invoice.failed',
      'key.created',
      'key.revoked',
      'quota.exceeded',
      'quota.reset',
    ];

    for (const event of dto.events) {
      if (!validEvents.includes(event)) {
        throw new BadRequestException(`Invalid event: ${event}`);
      }
    }

    const secret = dto.secret || this.generateSecret();

    const webhook = await this.prisma.apiWebhook.create({
      data: {
        userId,
        url: dto.url,
        events: dto.events,
        secret,
        isActive: dto.isActive ?? true
      }
    });

    return webhook;
  }

  async updateWebhook(id: string, userId: string, dto: UpdateWebhookDto): Promise<ApiWebhook> {
    const webhook = await this.prisma.apiWebhook.findFirst({
      where: { id, userId }
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Validate events if provided
    if (dto.events) {
      const validEvents = [
        'usage.threshold',
        'invoice.paid',
        'invoice.failed',
        'key.created',
        'key.revoked',
        'quota.exceeded',
        'quota.reset',
      ];

      for (const event of dto.events) {
        if (!validEvents.includes(event)) {
          throw new BadRequestException(`Invalid event: ${event}`);
        }
      }
    }

    const updated = await this.prisma.apiWebhook.update({
      where: { id },
      data: dto
    });

    return updated;
  }

  async deleteWebhook(id: string, userId: string): Promise<void> {
    const webhook = await this.prisma.apiWebhook.findFirst({
      where: { id, userId }
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    await this.prisma.apiWebhook.delete({
      where: { id }
    });
  }

  async listWebhooks(userId: string): Promise<ApiWebhook[]> {
    const webhooks = await this.prisma.apiWebhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return webhooks;
  }

  async triggerWebhook(
    event: string,
    payload: any,
    specificUserId?: string): Promise<void> {
    // Find all webhooks that should receive this event
    const where: any = {
      isActive: true,
      events: {
        has: event
      }
    };

    if (specificUserId) {
      where.userId = specificUserId;
    }

    const webhooks = await this.prisma.apiWebhook.findMany({ where });

    // Queue webhook deliveries
    for (const webhook of webhooks) {
      await this.webhooksQueue.add(
        'deliver',
        {
          webhookId: webhook.id,
          event,
          payload,
          attemptCount: 0
        },
        {
          attempts: this.MAX_RETRIES,
          backoff: {
            type: 'exponential',
            delay: this.RETRY_DELAY_BASE
          },
          removeOnComplete: 100,
          removeOnFail: 50
        });
    }
  }

  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'));
  }

  async testWebhook(id: string, userId: string, dto?: TestWebhookDto): Promise<{
    success: boolean;
    response?: any;
    error?: string;
  }> {
    const webhook = await this.prisma.apiWebhook.findFirst({
      where: { id, userId }
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const testEvent = dto?.event || 'test';
    const testPayload = dto?.data || {
      event: testEvent,
      timestamp: new Date().toISOString(),
      message: 'Test webhook from ViralFX API Marketplace'
    };

    try {
      const signature = this.generateSignature(JSON.stringify(testPayload), webhook.secret);

      const response = await this.httpService.axiosRef.post(
        webhook.url,
        testPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': testEvent,
            'User-Agent': 'ViralFX-Webhooks/1.0'
          },
          timeout: this.TIMEOUT
        });

      return {
        success: true,
        response: {
          status: response.status,
          data: response.data
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWebhookLogs(
    id: string,
    userId: string,
    filters: {
      event?: string;
      status?: WebhookDeliveryStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {}) {
    const webhook = await this.prisma.apiWebhook.findFirst({
      where: { id, userId }
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Build where clause for filters
    const whereClause: any = {
      webhookId: id
    };

    if (filters.event) {
      whereClause.event = filters.event;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) {
        whereClause.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.createdAt.lte = filters.endDate;
      }
    }

    // Get total count for pagination
    const total = await this.prisma.webhookDeliveryLog.count({
      where: whereClause
    });

    // Get logs with pagination
    const logs = await this.prisma.webhookDeliveryLog.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    return {
      logs: logs.map(log => ({
        id: log.id,
        eventId: log.eventId,
        event: log.event,
        status: log.status,
        attempt: log.attempt,
        requestUrl: log.requestUrl,
        responseStatus: log.responseStatus,
        responseTime: log.responseTime,
        errorMessage: log.errorMessage,
        errorType: log.errorType,
        retryCount: log.retryCount,
        maxRetries: log.maxRetries,
        deliveredAt: log.deliveredAt,
        completedAt: log.completedAt,
        processingTime: log.processingTime,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async processWebhookDelivery(job: any): Promise<void> {
    const { webhookId, event, payload, attemptCount } = job.data;
    const startTime = Date.now();
    let logId: string | null = null;

    try {
      // Create initial log entry
      logId = await this.logWebhookDelivery(
        webhookId,
        event,
        payload,
        WebhookDeliveryStatus.PROCESSING,
        { startTime },
        attemptCount + 1);

      const webhook = await this.prisma.apiWebhook.findUnique({
        where: { id: webhookId }
      });

      if (!webhook || !webhook.isActive) {
        // Update log as cancelled
        if (logId) {
          await this.updateWebhookLog(logId, {
            status: WebhookDeliveryStatus.CANCELLED,
            errorMessage: 'Webhook not found or inactive',
            errorType: 'WEBHOOK_INACTIVE',
            completedAt: new Date()
          });
        }
        return; // Skip inactive/deleted webhooks
      }

      // Update log with request details
      await this.updateWebhookLog(logId, {
        requestUrl: webhook.url
      });

      const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);
      const enhancedPayload = {
        ...payload,
        webhookId,
        event,
        timestamp: new Date().toISOString(),
        attemptCount: attemptCount + 1
      };

      const response = await this.httpService.axiosRef.post(
        webhook.url,
        enhancedPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
            'User-Agent': 'ViralFX-Webhooks/1.0'
          },
          timeout: this.TIMEOUT
        });

      const responseTime = Date.now() - startTime;

      // Log successful delivery
      await this.updateWebhookLog(logId, {
        status: WebhookDeliveryStatus.SUCCESS,
        responseStatus: response.status,
        responseHeaders: response.headers,
        responseBody: typeof response.data === 'object' ? JSON.stringify(response.data) : response.data,
        responseTime,
        signature,
        deliveredAt: new Date(),
        completedAt: new Date(),
        processingTime: responseTime
      });

      this.logger.log(`Webhook delivered successfully: ${webhookId}, attempt: ${attemptCount + 1}, response time: ${responseTime}ms`);

      // Reset failure count if any
      await this.resetFailureCount(webhookId);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // Determine error type
      let errorType = 'UNKNOWN_ERROR';
      let errorMessage = error.message;

      if (error.code === 'ECONNABORTED') {
        errorType = 'TIMEOUT';
        errorMessage = 'Request timeout';
      } else if (error.response) {
        errorType = 'HTTP_ERROR';
        errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorType = 'NETWORK_ERROR';
        errorMessage = `Network error: ${error.code}`;
      }

      // Update log with error details
      if (logId) {
        await this.updateWebhookLog(logId, {
          status: attemptCount >= this.MAX_RETRIES ? WebhookDeliveryStatus.PERMANENTLY_FAILED : WebhookDeliveryStatus.FAILED,
          responseStatus: error.response?.status,
          responseTime,
          errorCode: error.code,
          errorMessage,
          errorType,
          retryCount: attemptCount,
          maxRetries: this.MAX_RETRIES,
          nextRetryAt: attemptCount < this.MAX_RETRIES ? new Date(Date.now() + this.RETRY_DELAY_BASE * Math.pow(2, attemptCount)) : null,
          processingTime: responseTime
        });
      }

      this.logger.warn(`Webhook delivery failed: ${webhookId}, attempt: ${attemptCount + 1}, error: ${errorType} - ${errorMessage}`);

      // Increment failure count
      await this.incrementFailureCount(webhookId);

      // Check if webhook should be disabled
      const failureCount = await this.getFailureCount(webhookId);
      if (failureCount >= 10) {
        await this.prisma.apiWebhook.update({
          where: { id: webhookId },
          data: { isActive: false }
        });

        this.logger.warn(`Webhook disabled due to too many failures: ${webhookId}`);
      }

      // Re-throw to trigger Bull retry mechanism
      throw error;
    }
  }

  private generateSecret(): string {
    return `whsec_${randomBytes(32).toString('hex')}`;
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  private async logWebhookDelivery(
    webhookId: string,
    event: string,
    payload: any,
    status: WebhookDeliveryStatus,
    details: any,
    attempt: number = 1,
    responseTime?: number,
    responseBody?: string,
    responseHeaders?: any,
    errorCode?: string,
    errorMessage?: string,
    errorType?: string): Promise<string> {
    try {
      const logEntry = await this.prisma.webhookDeliveryLog.create({
        data: {
          webhookId,
          eventId: randomBytes(16).toString('hex'),
          event,
          status,
          attempt,
          requestUrl: '', // Will be populated in processWebhookDelivery
          requestBody: JSON.stringify(payload),
          responseStatus: details.status || null,
          responseTime,
          responseBody,
          responseHeaders,
          errorCode,
          errorMessage,
          errorType,
          signature: details.signature || null,
          metadata: {
            payload,
            ...details
          },
          deliveredAt: status === WebhookDeliveryStatus.SUCCESS ? new Date() : null,
          completedAt: [WebhookDeliveryStatus.SUCCESS, WebhookDeliveryStatus.PERMANENTLY_FAILED, WebhookDeliveryStatus.CANCELLED].includes(status) ? new Date() : null,
          processingTime: responseTime || null
        }
      });

      this.logger.log(`Webhook delivery log created: ${logEntry.id} for webhook ${webhookId}, status: ${status}`);
      return logEntry.id;
    } catch (error) {
      this.logger.error(`Failed to create webhook delivery log:`, error);
      throw error;
    }
  }

  private async updateWebhookLog(logId: string, updateData: any): Promise<void> {
    try {
      await this.prisma.webhookDeliveryLog.update({
        where: { id: logId },
        data: updateData
      });
    } catch (error) {
      this.logger.error(`Failed to update webhook delivery log ${logId}:`, error);
      // Don't throw - this shouldn't break the main webhook delivery flow
    }
  }

  private async incrementFailureCount(webhookId: string): Promise<void> {
    const key = `webhook:failures:${webhookId}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 86400); // Reset after 24 hours
  }

  private async getFailureCount(webhookId: string): Promise<number> {
    const key = `webhook:failures:${webhookId}`;
    const count = await this.redis.get(key);
    return parseInt(count || '0', 10);
  }

  private async resetFailureCount(webhookId: string): Promise<void> {
    const key = `webhook:failures:${webhookId}`;
    await this.redis.del(key);
  }

  async getWebhook(id: string, userId: string): Promise<ApiWebhook | null> {
    return this.prisma.apiWebhook.findFirst({
      where: { id, userId }
    });
  }

  async toggleWebhook(id: string, userId: string, isActive: boolean): Promise<ApiWebhook> {
    const webhook = await this.prisma.apiWebhook.findFirst({
      where: { id, userId }
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return this.prisma.apiWebhook.update({
      where: { id },
      data: { isActive }
    });
  }

  async getWebhookStats(
    id: string,
    userId: string,
    dateRange?: { start: Date; end: Date }): Promise<any> {
    const webhook = await this.prisma.apiWebhook.findFirst({
      where: { id, userId }
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Build where clause for date range filtering
    const whereClause: any = {
      webhookId: id
    };

    if (dateRange) {
      whereClause.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      };
    }

    // Get stats from database
    const [
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      lastDelivery,
    ] = await Promise.all([
      this.prisma.webhookDeliveryLog.count({ where: whereClause }),
      this.prisma.webhookDeliveryLog.count({
        where: { ...whereClause, status: WebhookDeliveryStatus.SUCCESS }
      }),
      this.prisma.webhookDeliveryLog.count({
        where: { ...whereClause, status: WebhookDeliveryStatus.FAILED }
      }),
      this.prisma.webhookDeliveryLog.findFirst({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      }),
    ]);

    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      successRate: Math.round(successRate * 100) / 100,
      lastDelivery: lastDelivery?.createdAt || null
    };
  }

  async getAvailableEvents(): Promise<any[]> {
    return [
      {
        id: 'usage.threshold',
        name: 'Usage Threshold',
        description: 'Triggered when API usage reaches a threshold',
        category: 'usage'
      },
      {
        id: 'invoice.paid',
        name: 'Invoice Paid',
        description: 'Triggered when an invoice is paid',
        category: 'billing'
      },
      {
        id: 'invoice.failed',
        name: 'Invoice Payment Failed',
        description: 'Triggered when invoice payment fails',
        category: 'billing'
      },
      {
        id: 'key.created',
        name: 'API Key Created',
        description: 'Triggered when a new API key is created',
        category: 'keys'
      },
      {
        id: 'key.revoked',
        name: 'API Key Revoked',
        description: 'Triggered when an API key is revoked',
        category: 'keys'
      },
      {
        id: 'quota.exceeded',
        name: 'Quota Exceeded',
        description: 'Triggered when API quota is exceeded',
        category: 'usage'
      },
      {
        id: 'quota.reset',
        name: 'Quota Reset',
        description: 'Triggered when API quota is reset',
        category: 'usage'
      },
    ];
  }

  async rotateWebhookSecret(id: string, userId: string): Promise<string> {
    const webhook = await this.prisma.apiWebhook.findFirst({
      where: { id, userId }
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const newSecret = this.generateSecret();

    await this.prisma.apiWebhook.update({
      where: { id },
      data: { secret: newSecret }
    });

    return newSecret;
  }

  async getDeliveryOverview(userId: string, dateRange?: { start: Date; end: Date }): Promise<any> {
    const webhooks = await this.prisma.apiWebhook.findMany({
      where: { userId },
      select: { id: true, isActive: true }
    });

    const webhookIds = webhooks.map(w => w.id);

    // Build where clause for filtering
    const whereClause: any = {
      webhookId: { in: webhookIds }
    };

    if (dateRange) {
      whereClause.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      };
    }

    // Get stats from database
    const [
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
    ] = await Promise.all([
      this.prisma.webhookDeliveryLog.count({ where: whereClause }),
      this.prisma.webhookDeliveryLog.count({
        where: { ...whereClause, status: WebhookDeliveryStatus.SUCCESS }
      }),
      this.prisma.webhookDeliveryLog.count({
        where: { ...whereClause, status: WebhookDeliveryStatus.FAILED }
      }),
    ]);

    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      successRate: Math.round(successRate * 100) / 100,
      totalWebhooks: webhooks.length,
      activeWebhooks: webhooks.filter(w => w.isActive).length
    };
  }
}
