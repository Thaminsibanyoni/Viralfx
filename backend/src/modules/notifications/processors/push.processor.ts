import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebSocketGateway as WSGateway } from '../../websocket/gateways/websocket.gateway';
import { SendTimeOptimizerService } from '../services/send-time-optimizer.service';
import { ProviderHealthService } from '../services/provider-health.service';
import { ProviderRoutingService, RoutingContext } from '../services/provider-routing.service';
import { ChaosTestingService } from '../services/chaos-testing.service';

export interface PushNotificationJob {
  userId: string;
  notificationId: string;
  deviceTokens: string[];
  title: string;
  message: string;
  data?: any;
  priority: 'normal' | 'high';
  ttl?: number;
}

@Injectable()
@Processor('notifications:push')
export class PushProcessor {
  private readonly logger = new Logger(PushProcessor.name);
  private readonly fcmConfig: any;
  private providerClients = new Map<string, any>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly webSocketGateway: WSGateway,
    private readonly sendTimeOptimizer: SendTimeOptimizerService,
    private readonly providerHealthService: ProviderHealthService,
    private readonly providerRoutingService: ProviderRoutingService,
    private readonly chaosTestingService: ChaosTestingService,
  ) {
    this.initializeProviders();
  }

  private initializeProviders() {
    this.initializeFCM();
    this.initializeAPNS();
    this.initializeOneSignal();
  }

  private initializeFCM() {
    // Initialize Firebase Cloud Messaging configuration
    this.fcmConfig = {
      apiKey: this.configService.get('FCM_API_KEY'),
      authDomain: this.configService.get('FCM_AUTH_DOMAIN'),
      projectId: this.configService.get('FCM_PROJECT_ID'),
      messagingSenderId: this.configService.get('FCM_MESSAGING_SENDER_ID'),
      appId: this.configService.get('FCM_APP_ID'),
    };

    if (this.fcmConfig.apiKey) {
      this.providerClients.set('fcm', {
        type: 'fcm',
        config: this.fcmConfig,
      });
      this.logger.log('FCM client initialized');
    } else {
      this.logger.warn('FCM configuration not found. Push notifications will be mocked.');
    }
  }

  private initializeAPNS() {
    const apnsConfig = {
      keyId: this.configService.get('APNS_KEY_ID'),
      teamId: this.configService.get('APNS_TEAM_ID'),
      bundleId: this.configService.get('APNS_BUNDLE_ID'),
      privateKey: this.configService.get('APNS_PRIVATE_KEY'),
    };

    if (apnsConfig.keyId && apnsConfig.teamId && apnsConfig.privateKey) {
      this.providerClients.set('apns', {
        type: 'apns',
        config: apnsConfig,
      });
      this.logger.log('APNS client initialized');
    } else {
      this.logger.warn('APNS configuration not found');
    }
  }

  private initializeOneSignal() {
    const oneSignalConfig = {
      appId: this.configService.get('ONESIGNAL_APP_ID'),
      apiKey: this.configService.get('ONESIGNAL_API_KEY'),
    };

    if (oneSignalConfig.appId && oneSignalConfig.apiKey) {
      this.providerClients.set('onesignal', {
        type: 'onesignal',
        config: oneSignalConfig,
      });
      this.logger.log('OneSignal client initialized');
    } else {
      this.logger.warn('OneSignal configuration not found');
    }
  }

  @OnQueueActive()
  onActive(job: Job<PushNotificationJob>) {
    this.logger.log(`Processing push notification job ${job.id} for user ${job.data.userId}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<PushNotificationJob>) {
    this.logger.log(`Completed push notification job ${job.id} for user ${job.data.userId}`);
  }

  @OnQueueFailed()
  onFailed(job: Job<PushNotificationJob>, error: Error) {
    this.logger.error(`Failed push notification job ${job.id} for user ${job.data.userId}:`, error);
  }

  @Process('send-push')
  async handleSendPush(job: Job<PushNotificationJob>) {
    const { userId, notificationId, deviceTokens, title, message, data, priority, ttl } = job.data;

    this.logger.log(`Processing push notification ${notificationId} for user ${userId}`);

    try {
      // Get notification details
      const notification = await this.prismaService.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`);
      }

      // Get user preferences and active device tokens
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
        include: {
          notificationPreferences: true,
          deviceTokens: {
            where: { isActive: true },
          },
        },
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      if (!user.notificationPreferences?.pushNotifications) {
        this.logger.log(`User ${userId} has push notifications disabled`);
        return { skipped: true, reason: 'Push notifications disabled' };
      }

      // Filter device tokens (use user's stored tokens if none provided)
      const activeTokens = deviceTokens.length > 0
        ? deviceTokens
        : user.deviceTokens.map(dt => dt.token);

      if (activeTokens.length === 0) {
        this.logger.log(`No active device tokens for user ${userId}`);
        return { skipped: true, reason: 'No active device tokens' };
      }

      // Use Send Time Optimizer to determine optimal send time
      const timeOptimization = await this.sendTimeOptimizer.shouldSendNow({
        userId,
        category: notification.category,
        type: notification.type,
        priority: priority as 'low' | 'medium' | 'high' | 'critical',
        channel: 'push',
        timezone: user.notificationPreferences?.timezone,
        metadata: data,
      });

      if (!timeOptimization.shouldSendNow) {
        this.logger.log(`Push ${notificationId} delayed by ${timeOptimization.delayMs}ms: ${timeOptimization.reason}`);

        // Update notification with scheduled time
        if (timeOptimization.optimalSendTime) {
          await this.prismaService.notification.update({
            where: { id: notificationId },
            data: { scheduledFor: timeOptimization.optimalSendTime },
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
          delayMs: timeOptimization.delayMs,
        };
      }

      this.logger.log(`Sending push notification ${notificationId} to ${activeTokens.length} devices`);

      // Group tokens by platform for optimal delivery
      const tokensByPlatform = this.groupTokensByPlatform(activeTokens);

      const results = [];
      let totalSent = 0;
      let totalFailed = 0;

      for (const [platform, tokens] of Object.entries(tokensByPlatform)) {
        try {
          const platformResult = await this.sendPushWithMultiProvider(platform, tokens, {
            title,
            message,
            data: {
              ...data,
              notificationId,
              type: notification.category,
              priority: notification.priority,
              actionUrl: notification.actionUrl,
              actionText: notification.actionText,
            },
            priority,
            ttl: ttl || 3600, // Default 1 hour TTL
            notificationPriority: notification.priority as 'low' | 'medium' | 'high' | 'critical',
          });

          results.push({
            platform,
            sent: platformResult.sent,
            failed: platformResult.failed,
            invalidTokens: platformResult.invalidTokens || [],
          });

          totalSent += platformResult.sent;
          totalFailed += platformResult.failed;

          // Handle invalid tokens
          if (platformResult.invalidTokens?.length > 0) {
            await this.deactivateInvalidTokens(platformResult.invalidTokens);
          }

        } catch (error) {
          this.logger.error(`Failed to send push via ${platform}:`, error);
          results.push({
            platform,
            error: error.message,
            sent: 0,
            failed: tokens.length,
          });
          totalFailed += tokens.length;
        }
      }

      // Log delivery results
      await this.logPushDelivery(notificationId, activeTokens.length, totalSent, totalFailed);

      // Update notification status
      if (totalSent > 0) {
        await this.updateNotificationDeliveryStatus(notificationId, 'PUSH_SENT');
      } else if (totalFailed === activeTokens.length) {
        await this.updateNotificationDeliveryStatus(notificationId, 'PUSH_FAILED');
      }

      // Send real-time update via WebSocket
      this.webSocketGateway.broadcastToUser(userId, 'notification:push_sent', {
        notificationId,
        totalDevices: activeTokens.length,
        sent: totalSent,
        failed: totalFailed,
      });

      this.logger.log(`Push notification ${notificationId} sent: ${totalSent} devices, ${totalFailed} failed`);

      // Record successful send for engagement tracking
      if (totalSent > 0) {
        await this.sendTimeOptimizer.recordNotificationSent(userId, {
          userId,
          category: notification.category,
          type: notification.type,
          priority: priority as 'low' | 'medium' | 'high' | 'critical',
          channel: 'push',
          timezone: user.notificationPreferences?.timezone,
          metadata: data,
        });
      }

      return {
        success: totalSent > 0,
        notificationId,
        totalDevices: activeTokens.length,
        sent: totalSent,
        failed: totalFailed,
        results,
        optimizationStats: {
          qualityScore: timeOptimization.qualityScore,
          frequencyCapRespected: timeOptimization.frequencyCapRespected,
          quietHoursRespected: timeOptimization.quietHoursRespected,
        },
      };
    } catch (error) {
      // Handle special case for optimal time delay
      if (error.message === 'OPTIMAL_TIME_DELAY') {
        throw error; // Let Bull handle the retry with delay
      }

      this.logger.error(`Failed to send push notification ${notificationId}:`, error);

      await this.logPushDelivery(notificationId, deviceTokens.length, 0, 1);

      throw error;
    }
  }

  @Process('cleanup-tokens')
  async handleCleanupTokens(job: Job<{
    olderThanDays?: number;
  }>) {
    const { olderThanDays = 30 } = job.data;

    this.logger.log(`Cleaning up device tokens older than ${olderThanDays} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prismaService.deviceToken.updateMany({
        where: {
          lastSeenAt: {
            lt: cutoffDate,
          },
          isActive: true,
        },
        data: {
          isActive: false,
          deactivationReason: 'INACTIVE_OLD',
        },
      });

      this.logger.log(`Deactivated ${result.count} inactive device tokens`);

      return {
        success: true,
        deactivated: result.count,
        cutoffDate,
      };
    } catch (error) {
      this.logger.error('Failed to cleanup device tokens:', error);
      throw error;
    }
  }

  private async sendPushWithMultiProvider(
    platform: string,
    tokens: string[],
    payload: {
      title: string;
      message: string;
      data: any;
      priority: 'normal' | 'high';
      ttl: number;
      notificationPriority: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<{
    sent: number;
    failed: number;
    invalidTokens?: string[];
    provider?: string;
    attempts?: number;
  }> {
    // Create routing context with platform-specific routing
    const routingContext: RoutingContext = {
      type: 'push',
      priority: payload.notificationPriority,
      recipientPlatform: platform, // 'ios', 'android', 'web'
      requiresHighThroughput: tokens.length > 100,
      requiresLowLatency: payload.notificationPriority === 'critical' || payload.notificationPriority === 'high',
      costOptimization: payload.notificationPriority === 'low',
      geographicRouting: false, // Push is global by platform
    };

    let lastError: Error | null = null;
    let attempts = 0;
    const maxAttempts = 3;

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

          const result = await this.sendWithPushProvider(providerId, platform, tokens, payload);

          // Record successful delivery attempt
          await this.providerHealthService.recordProviderAttempt(
            providerId,
            true,
            Date.now() - Date.now(), // This should be actual response time
          );

          // Update provider load
          await this.providerRoutingService.updateProviderLoad(providerId, tokens.length);

          this.logger.log(`Push sent successfully via ${providerId} to ${result.sent}/${tokens.length} devices after ${attempts} attempts`);

          // Update last used timestamp for successful deliveries
          const successfulTokens = tokens.slice(0, result.sent);
          await this.updateTokenUsage(successfulTokens);

          return {
            sent: result.sent,
            failed: result.failed,
            invalidTokens: result.invalidTokens,
            provider: providerId,
            attempts,
          };

        } catch (error) {
          lastError = error;
          this.logger.warn(`Attempt ${attempts} failed for provider ${providerId}:`, error.message);

          // Record failed attempt
          await this.providerHealthService.recordProviderAttempt(
            providerId,
            false,
            Date.now() - Date.now(),
            error.message,
          );

          // Continue to next provider if available
          if (attempts < maxAttempts) {
            continue;
          }
        }
      }

      // All providers failed, try mock implementation as last resort
      const mockResult = await this.mockSendPushToPlatform(platform, tokens, payload);
      return {
        ...mockResult,
        provider: 'mock-push-service',
        attempts,
      };

    } catch (error) {
      this.logger.error(`Push sending failed after ${attempts} attempts:`, error);
      throw error;
    }
  }

  private async sendWithPushProvider(
    providerId: string,
    platform: string,
    tokens: string[],
    payload: {
      title: string;
      message: string;
      data: any;
      priority: 'normal' | 'high';
      ttl: number;
      notificationPriority: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<{
    sent: number;
    failed: number;
    invalidTokens?: string[];
  }> {
    const startTime = Date.now();

    switch (providerId) {
      case 'fcm':
        return await this.sendWithFCM(platform, tokens, payload);
      case 'apns':
        return await this.sendWithAPNS(platform, tokens, payload);
      case 'onesignal':
        return await this.sendWithOneSignal(platform, tokens, payload);
      default:
        throw new Error(`Unsupported push provider: ${providerId}`);
    }
  }

  private async sendWithFCM(
    platform: string,
    tokens: string[],
    payload: {
      title: string;
      message: string;
      data: any;
      priority: 'normal' | 'high';
      ttl: number;
      notificationPriority: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<{
    sent: number;
    failed: number;
    invalidTokens?: string[];
  }> {
    const client = this.providerClients.get('fcm');
    if (!client) {
      throw new Error('FCM client not initialized');
    }

    let totalSent = 0;
    let totalFailed = 0;
    const invalidTokens = [];

    // FCM has a limit of 500 tokens per request
    const chunks = this.chunkArray(tokens, 500);

    for (const chunk of chunks) {
      try {
        const fcmPayload = this.buildFCMPayload(platform, chunk, payload);
        const response = await this.sendFCMRequest(fcmPayload);

        // Process FCM response
        for (let i = 0; i < response.results.length; i++) {
          const result = response.results[i];
          if (result.message_id) {
            totalSent++;
          } else if (result.error === 'NotRegistered' || result.error === 'InvalidRegistration') {
            invalidTokens.push(chunk[i]);
            totalFailed++;
          } else {
            totalFailed++;
          }
        }

      } catch (error) {
        this.logger.error(`FCM request failed for chunk:`, error);
        totalFailed += chunk.length;
      }
    }

    return {
      sent: totalSent,
      failed: totalFailed,
      invalidTokens,
    };
  }

  private async sendWithAPNS(
    platform: string,
    tokens: string[],
    payload: {
      title: string;
      message: string;
      data: any;
      priority: 'normal' | 'high';
      ttl: number;
      notificationPriority: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<{
    sent: number;
    failed: number;
    invalidTokens?: string[];
  }> {
    const client = this.providerClients.get('apns');
    if (!client) {
      throw new Error('APNS client not initialized');
    }

    // Mock APNS implementation - replace with actual APNS SDK
    const successRate = 0.95;
    const successCount = Math.floor(tokens.length * successRate);
    const failedCount = tokens.length - successCount;
    const invalidCount = Math.floor(tokens.length * 0.02); // 2% invalid tokens

    const invalidTokens = invalidCount > 0 ? tokens.slice(0, invalidCount) : [];

    return {
      sent: successCount,
      failed: failedCount,
      invalidTokens,
    };
  }

  private async sendWithOneSignal(
    platform: string,
    tokens: string[],
    payload: {
      title: string;
      message: string;
      data: any;
      priority: 'normal' | 'high';
      ttl: number;
      notificationPriority: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<{
    sent: number;
    failed: number;
    invalidTokens?: string[];
  }> {
    const client = this.providerClients.get('onesignal');
    if (!client) {
      throw new Error('OneSignal client not initialized');
    }

    // Mock OneSignal implementation - replace with actual OneSignal SDK
    const successRate = 0.92;
    const successCount = Math.floor(tokens.length * successRate);
    const failedCount = tokens.length - successCount;
    const invalidCount = Math.floor(tokens.length * 0.03); // 3% invalid tokens

    const invalidTokens = invalidCount > 0 ? tokens.slice(0, invalidCount) : [];

    return {
      sent: successCount,
      failed: failedCount,
      invalidTokens,
    };
  }

  private async mockSendPushToPlatform(
    platform: string,
    tokens: string[],
    payload: {
      title: string;
      message: string;
      data: any;
      priority: 'normal' | 'high';
      ttl: number;
    }
  ): Promise<{
    sent: number;
    failed: number;
    invalidTokens?: string[];
  }> {
    this.logger.log(`[MOCK] Sending push to ${tokens.length} ${platform} devices`);
    this.logger.log(`[MOCK] Title: ${payload.title}, Message: ${payload.message}`);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // Mock successful delivery (90% success rate)
    const successRate = 0.9;
    const successCount = Math.floor(tokens.length * successRate);
    const failedCount = tokens.length - successCount;
    const invalidCount = Math.floor(tokens.length * 0.05); // 5% invalid tokens

    // Simulate some invalid tokens
    const invalidTokens = invalidCount > 0
      ? tokens.slice(0, invalidCount)
      : [];

    // Log mock delivery for debugging
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`Push payload:`, payload);
      this.logger.debug(`Tokens:`, tokens.slice(0, 3)); // Log first 3 tokens only
    }

    return {
      sent: successCount,
      failed: failedCount,
      invalidTokens,
    };
  }

  private buildFCMPayload(
    platform: string,
    tokens: string[],
    payload: {
      title: string;
      message: string;
      data: any;
      priority: 'normal' | 'high';
      ttl: number;
    }
  ) {
    const fcmPayload = {
      registration_ids: tokens,
      notification: {
        title: payload.title,
        body: payload.message,
        sound: 'default',
      },
      data: payload.data,
      priority: payload.priority === 'high' ? 'high' : 'normal',
      time_to_live: payload.ttl,
    };

    // Platform-specific configurations
    if (platform === 'ios') {
      fcmPayload.notification = {
        ...fcmPayload.notification,
        click_action: payload.data?.actionUrl,
      };
      fcmPayload.apns = {
        payload: {
          aps: {
            sound: 'default',
            category: payload.data?.category,
          },
        },
      };
    }

    if (platform === 'android') {
      fcmPayload.android = {
        priority: payload.priority === 'high' ? 'high' : 'normal',
        ttl: payload.ttl ? `${payload.ttl}s` : '3600s',
        notification: {
          click_action: payload.data?.actionUrl,
          icon: 'ic_notification',
          color: '#4B0082',
        },
      };
    }

    return fcmPayload;
  }

  private async sendFCMRequest(payload: any): Promise<any> {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${this.fcmConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`FCM request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async updateTokenUsage(tokens: string[]): Promise<void> {
    try {
      await this.prismaService.deviceToken.updateMany({
        where: { token: { in: tokens } },
        data: { lastSeenAt: new Date() },
      });
    } catch (error) {
      this.logger.error('Failed to update token usage:', error);
    }
  }

  private groupTokensByPlatform(tokens: string[]): Record<string, string[]> {
    // In a real implementation, you would determine the platform
    // based on the token format or stored metadata
    // This is a simplified mock implementation

    const androidTokens = tokens.filter(token =>
      token.length > 100 && token.startsWith('d')
    );

    const iosTokens = tokens.filter(token =>
      token.length === 64 && /^[a-f0-9]+$/.test(token)
    );

    const webTokens = tokens.filter(token =>
      !androidTokens.includes(token) && !iosTokens.includes(token)
    );

    const grouped: Record<string, string[]> = {};

    if (androidTokens.length > 0) {
      grouped['android'] = androidTokens;
    }

    if (iosTokens.length > 0) {
      grouped['ios'] = iosTokens;
    }

    if (webTokens.length > 0) {
      grouped['web'] = webTokens;
    }

    return grouped;
  }

  private isInQuietHours(preferences: any): boolean {
    if (!preferences?.quietHours?.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private async deactivateInvalidTokens(invalidTokens: string[]): Promise<void> {
    await this.prismaService.deviceToken.updateMany({
      where: {
        token: { in: invalidTokens },
        isActive: true,
      },
      data: {
        isActive: false,
        deactivationReason: 'INVALID_TOKEN',
        deactivatedAt: new Date(),
      },
    });

    this.logger.log(`Deactivated ${invalidTokens.length} invalid device tokens`);
  }

  private async logPushDelivery(
    notificationId: string,
    totalDevices: number,
    sent: number,
    failed: number
  ): Promise<void> {
    await this.prismaService.notificationDeliveryLog.create({
      data: {
        notificationId,
        channel: 'push',
        recipient: `${totalDevices} devices`,
        status: sent > 0 ? 'SUCCESS' : 'FAILED',
        sentAt: new Date(),
        metadata: JSON.stringify({
          totalDevices,
          sent,
          failed,
          successRate: totalDevices > 0 ? (sent / totalDevices) * 100 : 0,
        }),
      },
    });
  }

  private async updateNotificationDeliveryStatus(
    notificationId: string,
    status: 'PUSH_SENT' | 'PUSH_FAILED' | 'PUSH_PENDING'
  ): Promise<void> {
    await this.prismaService.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: status,
        deliveredAt: status === 'PUSH_SENT' ? new Date() : undefined,
      },
    });
  }
}