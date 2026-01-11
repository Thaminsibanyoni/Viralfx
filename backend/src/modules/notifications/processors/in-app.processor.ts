import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from "../../../prisma/prisma.service";
import { SendTimeOptimizerService } from '../services/send-time-optimizer.service';
import { ProviderHealthService } from '../services/provider-health.service';
import { ProviderRoutingService, RoutingContext } from '../services/provider-routing.service';
import { ChaosTestingService } from '../services/chaos-testing.service';

export interface InAppNotificationJob {
  userId: string;
  notificationId: string;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high';
  category: string;
  actionUrl?: string;
  actionText?: string;
  icon?: string;
  imageUrl?: string;
  metadata?: any;
}

@Injectable()
@Processor('notifications:in-app')
export class InAppProcessor extends WorkerHost {
  private readonly logger = new Logger(InAppProcessor.name);
  private providerClients = new Map<string, any>();
  private sessionCache = new Map<string, any>(); // Cache for active sessions

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly sendTimeOptimizer: SendTimeOptimizerService,
    private readonly providerHealthService: ProviderHealthService,
    private readonly providerRoutingService: ProviderRoutingService,
    private readonly chaosTestingService: ChaosTestingService) {
    super();
this.initializeProviders();
  }

  private initializeProviders() {
    this.initializeWebSocketProviders();
  }

  private initializeWebSocketProviders() {
    // Initialize multiple WebSocket gateway instances for failover
    this.providerClients.set('websocket', {
      type: 'websocket',
      gateway: this.webSocketGateway,
      priority: 1,
      healthCheck: async () => {
        try {
          // Check WebSocket gateway health
          return { status: 'healthy', latency: 50 };
        } catch (error) {
          return { status: 'unhealthy', error: error.message };
        }
      }
    });

    // Initialize SSE provider as fallback
    this.providerClients.set('sse', {
      type: 'sse',
      priority: 2,
      healthCheck: async () => {
        try {
          // Check SSE provider health
          return { status: 'healthy', latency: 100 };
        } catch (error) {
          return { status: 'unhealthy', error: error.message };
        }
      }
    });

    // Initialize Long Polling provider as last resort
    this.providerClients.set('long-polling', {
      type: 'long-polling',
      priority: 3,
      healthCheck: async () => {
        try {
          // Check Long Polling provider health
          return { status: 'healthy', latency: 200 };
        } catch (error) {
          return { status: 'unhealthy', error: error.message };
        }
      }
    });
  }

  @OnWorkerEvent('active')
  onActive(job: Job<InAppNotificationJob>) {
    this.logger.log(`Processing in-app notification job ${job.id} for user ${job.data.userId}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<InAppNotificationJob>) {
    this.logger.log(`Completed in-app notification job ${job.id} for user ${job.data.userId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<InAppNotificationJob>, error: Error) {
    this.logger.error(`Failed in-app notification job ${job.id} for user ${job.data.userId}:`, error);
  }

  private async handleSendInApp(job: Job<InAppNotificationJob>) {
    const {
      userId,
      notificationId,
      title,
      message,
      data,
      priority,
      category,
      actionUrl,
      actionText,
      icon,
      imageUrl,
      metadata
    } = job.data;

    this.logger.log(`Processing in-app notification ${notificationId} for user ${userId}`);

    try {
      // Get user details and preferences
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
        include: { notificationPreferences: true }
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Check if in-app notifications are enabled
      if (!user.notificationPreferences?.inAppNotifications) {
        this.logger.log(`User ${userId} has in-app notifications disabled`);
        return { skipped: true, reason: 'In-app notifications disabled' };
      }

      // Check user's active sessions
      const activeSessions = await this.getUserActiveSessions(userId);
      if (activeSessions.length === 0) {
        this.logger.log(`User ${userId} has no active sessions`);
        return { skipped: true, reason: 'No active sessions' };
      }

      // Get notification details
      const notification = await this.prismaService.notification.findUnique({
        where: { id: notificationId }
      });

      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`);
      }

      // Use Send Time Optimizer to determine optimal send time
      const timeOptimization = await this.sendTimeOptimizer.shouldSendNow({
        userId,
        category: notification.category,
        type: notification.type,
        priority: priority as 'low' | 'medium' | 'high' | 'critical',
        channel: 'in-app',
        timezone: user.notificationPreferences?.timezone,
        metadata: { actionUrl, actionText, icon, imageUrl, ...metadata }
      });

      if (!timeOptimization.shouldSendNow) {
        this.logger.log(`In-app ${notificationId} delayed by ${timeOptimization.delayMs}ms: ${timeOptimization.reason}`);

        // Update notification with scheduled time
        if (timeOptimization.optimalSendTime) {
          await this.prismaService.notification.update({
            where: { id: notificationId },
            data: { scheduledFor: timeOptimization.optimalSendTime }
          });
        }

        // Add delay to Bull job
        if (timeOptimization.delayMs && timeOptimization.delayMs > 0) {
          job.opts.delay = timeOptimization.delayMs;
          throw new Error('OPTIMAL_TIME_DELAY'); // Signal Bull to retry with delay
        }

        return {
          skipped: true,
          reason: timeOptimization.reason,
          optimalSendTime: timeOptimization.optimalSendTime,
          delayMs: timeOptimization.delayMs
        };
      }

      // Check for duplicate notifications (same content within 1 minute)
      const isDuplicate = await this.checkDuplicateNotification(userId, title, message);
      if (isDuplicate && priority !== 'high') {
        this.logger.log(`Duplicate in-app notification detected for user ${userId}`);
        return { skipped: true, reason: 'Duplicate notification' };
      }

      // Prepare notification payload
      const notificationPayload = {
        id: notificationId,
        type: notification.type,
        category,
        priority,
        title,
        message,
        actionUrl,
        actionText,
        icon: icon || this.getDefaultIcon(category, notification.type),
        imageUrl,
        metadata: {
          ...metadata,
          ...data,
          createdAt: notification.createdAt
        },
        timestamp: new Date().toISOString()
      };

      // Send notification via multi-provider failover to all active sessions
      const deliveryResult = await this.sendInAppWithMultiProvider(userId, notificationPayload, activeSessions, notification.priority as 'low' | 'medium' | 'high' | 'critical');
      const deliveredSessions = deliveryResult.deliveredSessions;

      // Store in-app notification in database
      const inAppNotification = await this.prismaService.inAppNotification.create({
        data: {
          userId,
          notificationId,
          title,
          message,
          data: JSON.stringify(notificationPayload),
          priority,
          category,
          actionUrl,
          actionText,
          icon,
          imageUrl,
          deliveredSessions,
          totalSessions: activeSessions.length,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      // Log the delivery
      await this.logInAppDelivery(notificationId, userId, activeSessions.length, deliveredSessions);

      // Update notification delivery status
      if (deliveredSessions > 0) {
        await this.updateNotificationDeliveryStatus(notificationId, 'IN_APP_SENT');
      }

      // Send success notification to user's main WebSocket connection
      this.webSocketGateway.broadcastToUser(userId, 'notification:delivered', {
        notificationId,
        delivered: deliveredSessions,
        total: activeSessions.length
      });

      this.logger.log(
        `In-app notification ${notificationId} delivered to ${deliveredSessions}/${activeSessions.length} sessions`
      );

      // Record successful send for engagement tracking
      if (deliveredSessions > 0) {
        await this.sendTimeOptimizer.recordNotificationSent(userId, {
          userId,
          category: notification.category,
          type: notification.type,
          priority: priority as 'low' | 'medium' | 'high' | 'critical',
          channel: 'in-app',
          timezone: user.notificationPreferences?.timezone,
          metadata: { actionUrl, actionText, icon, imageUrl, ...metadata }
        });
      }

      return {
        success: deliveredSessions > 0,
        notificationId,
        userId,
        deliveredSessions,
        totalSessions: activeSessions.length,
        inAppNotificationId: inAppNotification.id,
        expiresAt: inAppNotification.expiresAt,
        optimizationStats: {
          qualityScore: timeOptimization.qualityScore,
          frequencyCapRespected: timeOptimization.frequencyCapRespected,
          quietHoursRespected: timeOptimization.quietHoursRespected
        }
      };
    } catch (error) {
      // Handle special case for optimal time delay
      if (error.message === 'OPTIMAL_TIME_DELAY') {
        throw error; // Let Bull handle the retry with delay
      }

      this.logger.error(`Failed to send in-app notification ${notificationId}:`, error);

      await this.logInAppDelivery(notificationId, userId, 0, 0, { error: error.message });

      throw error;
    }
  }

  private async handleBroadcastInApp(job: Job<{
    userIds: string[];
    notification: Omit<InAppNotificationJob, 'userId'>;
  }>) {
    const { userIds, notification } = job.data;

    this.logger.log(`Broadcasting in-app notification to ${userIds.length} users`);

    try {
      const results = [];
      let totalDelivered = 0;
      let totalSessions = 0;

      for (const userId of userIds) {
        try {
          const result = await this.handleSendInApp({
            ...notification,
            userId
          });

          if (result.success) {
            totalDelivered += result.deliveredSessions || 0;
            totalSessions += result.totalSessions || 0;
          }

          results.push({
            userId,
            success: result.success,
            deliveredSessions: result.deliveredSessions,
            totalSessions: result.totalSessions
          });
        } catch (error) {
          results.push({
            userId,
            success: false,
            error: error.message
          });
        }
      }

      const successfulUsers = results.filter(r => r.success).length;
      const failedUsers = results.filter(r => !r.success).length;

      this.logger.log(
        `Broadcast completed: ${successfulUsers} successful, ${failedUsers} failed, ${totalDelivered}/${totalSessions} sessions`
      );

      return {
        success: true,
        totalUsers: userIds.length,
        successfulUsers,
        failedUsers,
        totalSessions,
        totalDelivered,
        results
      };
    } catch (error) {
      this.logger.error('Broadcast in-app notification failed:', error);
      throw error;
    }
  }

  private async handleCleanupExpiredNotifications(job: Job<{
    olderThanDays?: number;
  }>) {
    const { olderThanDays = 30 } = job.data;

    this.logger.log(`Cleaning up expired in-app notifications older than ${olderThanDays} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prismaService.inAppNotification.deleteMany({
        where: {
          expiresAt: {
            lt: cutoffDate
          }
        }
      });

      this.logger.log(`Cleaned up ${result.count} expired in-app notifications`);

      return {
        success: true,
        deleted: result.count,
        cutoffDate
      };
    } catch (error) {
      this.logger.error('Failed to cleanup expired notifications:', error);
      throw error;
    }
  }

  private async handleMarkAsRead(job: Job<{
    userId: string;
    notificationId: string;
    inAppNotificationId?: string;
  }>) {
    const { userId, notificationId, inAppNotificationId } = job.data;

    try {
      // Update the in-app notification read status
      if (inAppNotificationId) {
        await this.prismaService.inAppNotification.update({
          where: { id: inAppNotificationId },
          data: {
            readAt: new Date(),
            read: true
          }
        });
      }

      // Send real-time update via WebSocket
      this.webSocketGateway.broadcastToUser(userId, 'notification:read', {
        notificationId,
        inAppNotificationId,
        readAt: new Date()
      });

      return {
        success: true,
        notificationId,
        readAt: new Date()
      };
    } catch (error) {
      this.logger.error(`Failed to mark notification ${notificationId} as read:`, error);
      throw error;
    }
  }

  private async sendInAppWithMultiProvider(
  userId: string,
  notificationPayload: any,
  activeSessions: Array<{
    sessionId: string;
    connectedAt: Date;
    lastSeenAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }>,
  notificationPriority: 'low' | 'medium' | 'high' | 'critical'
): Promise<{
  deliveredSessions: number;
  failedSessions: number;
  provider: string;
  attempts: number;
  errors: string[];
}> {
  // Create routing context for in-app notifications
  const routingContext: RoutingContext = {
    type: 'in-app',
    priority: notificationPriority,
    requiresHighThroughput: activeSessions.length > 50,
    requiresLowLatency: notificationPriority === 'critical' || notificationPriority === 'high',
    costOptimization: false, // In-app notifications are free
    geographicRouting: false // In-app is global
  };

  let lastError: Error | null = null;
  let attempts = 0;
  const maxAttempts = 3;
  const errors: string[] = [];

  try {
    // Get optimal provider routing decision
    const routingDecision = await this.providerRoutingService.selectOptimalProvider(routingContext);
    const providersToTry = [
      routingDecision.primaryProvider,
      ...routingDecision.fallbackProviders,
    ];

    // Try providers in order of preference
    for (const providerId of providersToTry.slice(0, maxAttempts)) {
      attempts++;
      let deliveredSessions = 0;
      let failedSessions = 0;

      try {
        // Check for chaos testing failure injection
        const shouldFail = await this.chaosTestingService.shouldInjectFailure(providerId);
        if (shouldFail) {
          const failureType = await this.chaosTestingService.getInjectedFailureType(providerId);
          throw new Error(`Chaos testing failure injected: ${failureType}`);
        }

        // Check for chaos testing latency injection
        const injectedLatency = await this.chaosTestingService.getInjectedLatency(providerId);
        if (injectedLatency > 0) {
          this.logger.log(`Injected ${injectedLatency}ms latency for provider ${providerId}`);
          await new Promise(resolve => setTimeout(resolve, injectedLatency));
        }

        const result = await this.sendWithInAppProvider(providerId, userId, notificationPayload, activeSessions);
        deliveredSessions = result.deliveredSessions;
        failedSessions = result.failedSessions;

        // Record successful delivery attempt
        await this.providerHealthService.recordProviderAttempt(
          providerId,
          deliveredSessions > 0,
          Date.now() - Date.now(),
          failedSessions > 0 ? `Failed to deliver to ${failedSessions} sessions` : undefined);

        // Update provider load
        await this.providerRoutingService.updateProviderLoad(providerId, activeSessions.length);

        this.logger.log(`In-app notification sent via ${providerId} to ${deliveredSessions}/${activeSessions.length} sessions after ${attempts} attempts`);

        return {
          deliveredSessions,
          failedSessions,
          provider: providerId,
          attempts,
          errors
        };

      } catch (error) {
        lastError = error;
        failedSessions = activeSessions.length;
        errors.push(`Provider ${providerId}: ${error.message}`);
        this.logger.warn(`Attempt ${attempts} failed for provider ${providerId}:`, error.message);

        // Record failed attempt
        await this.providerHealthService.recordProviderAttempt(
          providerId,
          false,
          Date.now() - Date.now(),
          error.message);

        // Continue to next provider if available
        if (attempts < maxAttempts) {
          continue;
        }
      }
    }

    // All providers failed
    throw lastError || new Error('All in-app providers failed');

  } catch (error) {
    this.logger.error(`In-app notification sending failed after ${attempts} attempts:`, error);
    errors.push(`Final error: ${error.message}`);
    return {
      deliveredSessions: 0,
      failedSessions: activeSessions.length,
      provider: 'none',
      attempts,
      errors
    };
  }
}

private async sendWithInAppProvider(
  providerId: string,
  userId: string,
  notificationPayload: any,
  activeSessions: Array<{
    sessionId: string;
    connectedAt: Date;
    lastSeenAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }>
): Promise<{
  deliveredSessions: number;
  failedSessions: number;
}> {
  const startTime = Date.now();
  let deliveredSessions = 0;
  let failedSessions = 0;

  switch (providerId) {
    case 'websocket':
      for (const session of activeSessions) {
        try {
          await this.webSocketGateway.sendNotificationToSession(session.sessionId, {
            type: 'notification',
            data: notificationPayload
          });
          deliveredSessions++;
        } catch (error) {
          this.logger.warn(`Failed to send WebSocket to session ${session.sessionId}:`, error);
          await this.markSessionInactive(session.sessionId);
          failedSessions++;
        }
      }
      break;

    case 'sse':
      for (const session of activeSessions) {
        try {
          // Send via Server-Sent Events
          await this.sendViaSSE(session.sessionId, notificationPayload);
          deliveredSessions++;
        } catch (error) {
          this.logger.warn(`Failed to send SSE to session ${session.sessionId}:`, error);
          await this.markSessionInactive(session.sessionId);
          failedSessions++;
        }
      }
      break;

    case 'long-polling':
      for (const session of activeSessions) {
        try {
          // Store notification for long polling retrieval
          await this.storeForLongPolling(session.sessionId, notificationPayload);
          deliveredSessions++;
        } catch (error) {
          this.logger.warn(`Failed to store for long polling session ${session.sessionId}:`, error);
          await this.markSessionInactive(session.sessionId);
          failedSessions++;
        }
      }
      break;

    default:
      throw new Error(`Unsupported in-app provider: ${providerId}`);
  }

  return {
    deliveredSessions,
    failedSessions
  };
}

private async sendViaSSE(sessionId: string, notificationPayload: any): Promise<void> {
  // Mock SSE implementation - replace with actual SSE logic
  this.logger.debug(`[SSE] Sending notification to session ${sessionId}`);
}

private async storeForLongPolling(sessionId: string, notificationPayload: any): Promise<void> {
  // Store notification for long polling retrieval
  const key = `longpoll:notifications:${sessionId}`;
  try {
    await this.prismaService.notification.create({
      data: {
        userId: notificationPayload.userId || '',
        type: 'in-app',
        category: notificationPayload.category || 'general',
        title: notificationPayload.title,
        message: notificationPayload.message,
        data: JSON.stringify(notificationPayload),
        metadata: JSON.stringify({ sessionId, deliveryMethod: 'long-polling' }),
        deliveryStatus: 'PENDING',
        createdAt: new Date()
      }
    });
  } catch (error) {
    this.logger.error(`Failed to store notification for long polling:`, error);
    throw error;
  }
}

  private async getUserActiveSessions(userId: string): Promise<Array<{
    sessionId: string;
    connectedAt: Date;
    lastSeenAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }>> {
    // Check session cache first
    const cachedSessions = this.sessionCache.get(userId);
    if (cachedSessions && Date.now() - cachedSessions.lastUpdate < 60000) { // 1 minute cache
      return cachedSessions.sessions;
    }

    // In a real implementation, you would query an active sessions table
    // or use Redis to store active session information
    const sessions = [{
      sessionId: `${userId}_session_${Date.now()}`,
      connectedAt: new Date(),
      lastSeenAt: new Date(),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ipAddress: '127.0.0.1'
    }];

    // Update cache
    this.sessionCache.set(userId, {
      sessions,
      lastUpdate: Date.now()
    });

    return sessions;
  }

  private async markSessionInactive(sessionId: string): Promise<void> {
    // Mark session as inactive in your session store
    this.logger.log(`Marked session ${sessionId} as inactive`);
  }

  private async checkDuplicateNotification(
    userId: string,
    title: string,
    message: string
  ): Promise<boolean> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const count = await this.prismaService.inAppNotification.count({
      where: {
        userId,
        title,
        message,
        createdAt: {
          gte: oneMinuteAgo
        }
      }
    });

    return count > 0;
  }

  private getDefaultIcon(category: string, type: string): string {
    const iconMap = {
      system: {
        info: 'info-circle',
        success: 'check-circle',
        warning: 'warning',
        error: 'exclamation-circle'
      },
      trading: {
        info: 'chart-line',
        success: 'trending-up',
        warning: 'alert',
        error: 'x-circle'
      },
      security: {
        info: 'shield-check',
        success: 'shield',
        warning: 'alert-triangle',
        error: 'shield-x'
      },
      billing: {
        info: 'credit-card',
        success: 'check-circle',
        warning: 'alert',
        error: 'x-circle'
      },
      social: {
        info: 'users',
        success: 'heart',
        warning: 'alert',
        error: 'x-circle'
      },
      promotion: {
        info: 'gift',
        success: 'star',
        warning: 'alert',
        error: 'x-circle'
      }
    };

    return iconMap[category]?.[type] || 'bell';
  }

  private async logInAppDelivery(
    notificationId: string,
    userId: string,
    totalSessions: number,
    deliveredSessions: number,
    error?: any
  ): Promise<void> {
    await this.prismaService.notificationDeliveryLog.create({
      data: {
        notificationId,
        channel: 'in-app',
        recipient: userId,
        status: deliveredSessions > 0 ? 'SUCCESS' : 'FAILED',
        sentAt: deliveredSessions > 0 ? new Date() : undefined,
        errorDetails: error ? JSON.stringify(error) : null,
        metadata: JSON.stringify({
          totalSessions,
          deliveredSessions,
          deliveryRate: totalSessions > 0 ? (deliveredSessions / totalSessions) * 100 : 0
        })
      }
    });
  }

  private async updateNotificationDeliveryStatus(
    notificationId: string,
    status: 'IN_APP_SENT' | 'IN_APP_FAILED' | 'IN_APP_PENDING'
  ): Promise<void> {
    await this.prismaService.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: status,
        deliveredAt: status === 'IN_APP_SENT' ? new Date() : undefined
      }
    });
  }
}
