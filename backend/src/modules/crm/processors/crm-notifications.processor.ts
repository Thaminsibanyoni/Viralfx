import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RedisService } from "../../redis/redis.service";
import { HttpService } from '@nestjs/axios';
import { User } from "../../../common/enums/user-role.enum";
// UserNotificationPreference entity removed;
import { NotificationService } from "../../notifications/services/notification.service";

interface BatchNotificationData {
  userIds: string[];
  type: string;
  channels: string[];
  data: any;
  template?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

@Processor('crm-notifications')
export class CrmNotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(CrmNotificationsProcessor.name);

  constructor(
        private redisService: RedisService,
    private httpService: HttpService,
    private notificationsService: NotificationService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'send-batch':
        return this.handleBatchNotifications(job);
      case 'send-digest':
        return this.handleDigestNotifications(job);
      case 'process-escalation':
        return this.handleEscalationNotifications(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async handleBatchNotifications(job: Job<BatchNotificationData>) {
    const { userIds, type, channels, data, template, priority = 'NORMAL' } = job.data;

    this.logger.log(`Processing batch notification: ${type} for ${userIds.length} users`);

    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    // Process in batches to avoid overwhelming services
    const batchSize = 50;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      try {
        const batchResults = await this.processBatch(batch, { type, channels, data, template, priority });

        results.successful.push(...batchResults.successful);
        results.failed.push(...batchResults.failed);
        results.skipped.push(...batchResults.skipped);

        // Add delay between batches to prevent rate limiting
        if (i + batchSize < userIds.length) {
          await this.delay(1000); // 1 second delay
        }

      } catch (error) {
        this.logger.error(`Batch processing failed for batch ${i}:`, error);
        results.failed.push(...batch.map(userId => ({ userId, error: error.message })));
      }
    }

    this.logger.log(`Batch notification completed. Success: ${results.successful.length}, Failed: ${results.failed.length}, Skipped: ${results.skipped.length}`);

    return results;
  }

  private async handleDigestNotifications(job: Job<{
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    userId?: string;
    category?: string;
  }>) {
    const { type, userId, category } = job.data;

    this.logger.log(`Processing ${type} digest${userId ? ` for user ${userId}` : ''}${category ? ` for category ${category}` : ''}`);

    try {
      let targetUsers: User[];

      if (userId) {
        const user = await this.prisma.user.findFirst({ where: { id: userId } });
        targetUsers = user ? [user] : [];
      } else {
        // Get users who have opted into digest notifications
        const query = this.prisma.createQueryBuilder('user')
          .leftJoinAndSelect('user.notificationPreferences', 'preferences')
          .where('user.isActive = :isActive', { isActive: true })
          .andWhere('preferences.enableDigest = :enableDigest', { enableDigest: true });

        if (type === 'DAILY') {
          query.andWhere('preferences.dailyDigest = :dailyDigest', { dailyDigest: true });
        } else if (type === 'WEEKLY') {
          query.andWhere('preferences.weeklyDigest = :weeklyDigest', { weeklyDigest: true });
        } else if (type === 'MONTHLY') {
          query.andWhere('preferences.monthlyDigest = :monthlyDigest', { monthlyDigest: true });
        }

        targetUsers = await query.getMany();
      }

      this.logger.log(`Sending ${type} digest to ${targetUsers.length} users`);

      const results = {
        sent: 0,
        failed: 0,
        skipped: 0
      };

      for (const user of targetUsers) {
        try {
          const digestData = await this.generateDigestData(user, type, category);

          if (digestData.items.length === 0) {
            results.skipped++;
            continue;
          }

          await this.notificationsService.sendNotification({
            userId: user.id,
            type: `digest_${type.toLowerCase()}`,
            channels: ['email'],
            data: digestData,
            template: `digest-${type.toLowerCase()}`
          });

          results.sent++;
        } catch (error) {
          this.logger.error(`Failed to send digest to user ${user.id}:`, error);
          results.failed++;
        }
      }

      this.logger.log(`Digest sending completed. Sent: ${results.sent}, Failed: ${results.failed}, Skipped: ${results.skipped}`);

      return results;
    } catch (error) {
      this.logger.error(`Digest processing failed:`, error);
      throw error;
    }
  }

  private async handleEscalationNotifications(job: Job<{
    entityType: 'TICKET' | 'PAYMENT' | 'DOCUMENT' | 'CLIENT';
    entityId: string;
    escalationLevel: number;
    reason: string;
    previousAssigneeId?: string;
  }>) {
    const { entityType, entityId, escalationLevel, reason, previousAssigneeId } = job.data;

    this.logger.log(`Processing escalation notification for ${entityType} ${entityId} to level ${escalationLevel}`);

    try {
      // Get escalation targets
      const targets = await this.getEscalationTargets(entityType, escalationLevel);

      const notificationData = {
        entityType,
        entityId,
        escalationLevel,
        reason,
        timestamp: new Date().toISOString(),
        escalatedBy: previousAssigneeId ? 'previous_assignee' : 'system'
      };

      const results = {
        notified: [],
        failed: []
      };

      for (const target of targets) {
        try {
          await this.notificationsService.sendNotification({
            userId: target.id,
            type: 'escalation',
            channels: target.notificationChannels || ['email', 'push'],
            data: notificationData,
            priority: escalationLevel > 3 ? 'URGENT' : 'HIGH'
          });

          results.notified.push(target.id);
        } catch (error) {
          this.logger.error(`Failed to notify escalation target ${target.id}:`, error);
          results.failed.push({ userId: target.id, error: error.message });
        }
      }

      // Notify previous assignee if specified
      if (previousAssigneeId) {
        try {
          await this.notificationsService.sendNotification({
            userId: previousAssigneeId,
            type: 'escalation_handoff',
            channels: ['email'],
            data: {
              ...notificationData,
              handoffReason: reason,
              newLevel: escalationLevel
            }
          });
        } catch (error) {
          this.logger.error(`Failed to notify previous assignee ${previousAssigneeId}:`, error);
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Escalation notification processing failed:`, error);
      throw error;
    }
  }

  private async processBatch(userIds: string[], notificationData: {
    type: string;
    channels: string[];
    data: any;
    template?: string;
    priority?: string;
  }): Promise<{ successful: any[]; failed: any[]; skipped: any[] }> {
    const results = { successful: [], failed: [], skipped: [] };

    // Get user preferences in bulk
    const users = await this.prisma.user.findMany({
      where: { id: In(userIds) },
      relations: ['notificationPreferences']
    });

    const userPreferencesMap = new Map();
    users.forEach(user => {
      userPreferencesMap.set(user.id, user.notificationPreferences || {});
    });

    for (const userId of userIds) {
      try {
        const preferences = userPreferencesMap.get(userId);
        const allowedChannels = this.filterChannelsByPreferences(notificationData.channels, preferences);

        if (allowedChannels.length === 0) {
          results.skipped.push({ userId, reason: 'no_allowed_channels' });
          continue;
        }

        // Check rate limiting
        const rateLimitKey = `notification-limit:${userId}:${notificationData.type}`;
        const isRateLimited = await this.checkRateLimit(rateLimitKey);

        if (isRateLimited) {
          results.skipped.push({ userId, reason: 'rate_limited' });
          continue;
        }

        await this.notificationsService.sendNotification({
          userId,
          type: notificationData.type,
          channels: allowedChannels,
          data: notificationData.data,
          template: notificationData.template,
          priority: notificationData.priority as any
        });

        results.successful.push(userId);
      } catch (error) {
        this.logger.error(`Failed to send notification to user ${userId}:`, error);
        results.failed.push({ userId, error: error.message });
      }
    }

    return results;
  }

  private filterChannelsByPreferences(channels: string[], preferences: any): string[] {
    if (!preferences || !preferences.channels) {
      return channels; // No preferences set, allow all channels
    }

    const userChannels = JSON.parse(preferences.channels);
    return channels.filter(channel => {
      const channelKey = channel.toLowerCase();
      return userChannels[channelKey] !== false; // Allow unless explicitly disabled
    });
  }

  private async checkRateLimit(key: string, limit: number = 5, window: number = 3600): Promise<boolean> {
    const current = await this.redisService.get(key);

    if (!current) {
      await this.redisService.setex(key, window, '1');
      return false;
    }

    const count = parseInt(current);
    if (count >= limit) {
      return true; // Rate limited
    }

    await this.redisService.incr(key);
    return false;
  }

  private async generateDigestData(user: User, type: string, category?: string): Promise<any> {
    // This would aggregate relevant notifications/activity for the user
    // For now, return mock data
    const timeRanges = {
      DAILY: 24,
      WEEKLY: 24 * 7,
      MONTHLY: 24 * 30
    };

    const hoursBack = timeRanges[type] || 24;
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Query different data sources based on category
    const items = [];

    if (!category || category === 'CLIENTS') {
      // Get new client updates
      const clientUpdates = await this.getClientUpdates(user.id, since);
      items.push(...clientUpdates);
    }

    if (!category || category === 'TICKETS') {
      // Get ticket updates
      const ticketUpdates = await this.getTicketUpdates(user.id, since);
      items.push(...ticketUpdates);
    }

    if (!category || category === 'PAYMENTS') {
      // Get payment updates
      const paymentUpdates = await this.getPaymentUpdates(user.id, since);
      items.push(...paymentUpdates);
    }

    return {
      user: {
        id: user.id,
        name: user.firstName ? `${user.firstName} ${user.lastName}` : user.email
      },
      type,
      period: {
        start: since.toISOString(),
        end: new Date().toISOString()
      },
      items: items.slice(0, 50), // Limit to 50 items
      totalCount: items.length
    };
  }

  private async getClientUpdates(userId: string, since: Date): Promise<any[]> {
    // Mock implementation - would query actual client data
    return [
      {
        type: 'CLIENT_ADDED',
        message: 'New client registered',
        timestamp: new Date().toISOString(),
        link: '/clients/new'
      },
    ];
  }

  private async getTicketUpdates(userId: string, since: Date): Promise<any[]> {
    // Mock implementation - would query actual ticket data
    return [
      {
        type: 'TICKET_UPDATED',
        message: 'Ticket status changed',
        timestamp: new Date().toISOString(),
        link: '/tickets/123'
      },
    ];
  }

  private async getPaymentUpdates(userId: string, since: Date): Promise<any[]> {
    // Mock implementation - would query actual payment data
    return [
      {
        type: 'PAYMENT_RECEIVED',
        message: 'Payment received',
        timestamp: new Date().toISOString(),
        link: '/payments/456'
      },
    ];
  }

  private async getEscalationTargets(entityType: string, level: number): Promise<User[]> {
    // Get users responsible for handling escalations at this level
    const roleMapping = {
      1: ['TEAM_LEAD'],
      2: ['SUPPORT_MANAGER'],
      3: ['HEAD_OF_SUPPORT'],
      4: ['COMPLIANCE_MANAGER'],
      5: ['CTO', 'CEO']
    };

    const roles = roleMapping[level] || ['TEAM_LEAD'];

    return await this.prisma.user.findMany({
      where: {
        role: In(roles),
        isActive: true
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing notification job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed notification job ${job.id} of type ${job.name}. Result:`, result);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed notification job ${job.id} of type ${job.name}:`, error);
  }
}
