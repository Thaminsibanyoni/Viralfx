import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface UserEngagementProfile {
  userId: string;
  timezone: string;
  optimalSendTimes: {
    email: number[][]; // Array of [startHour, startMinute] slots
    sms: number[][];
    push: number[][];
    inApp: number[][];
  };
  engagementPatterns: {
    hourlyOpenRates: number[];
    dailyEngagementScores: number[];
    preferredChannels: string[];
    lastEngagementAt?: Date;
  };
  frequencyCaps: {
    email: { maxPerDay: number; maxPerWeek: number; maxPerMonth: number; };
    sms: { maxPerDay: number; maxPerWeek: number; maxPerMonth: number; };
    push: { maxPerDay: number; maxPerWeek: number; maxPerMonth: number; };
    inApp: { maxPerDay: number; maxPerWeek: number; maxPerMonth: number; };
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM
    end: string;   // HH:MM
    timezone: string;
  };
  qualityScore: number; // 0-100 engagement quality score
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationData {
  userId: string;
  category: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  channel: 'email' | 'sms' | 'push' | 'in-app';
  timezone?: string;
  metadata?: any;
}

export interface SendTimeRecommendation {
  shouldSendNow: boolean;
  optimalSendTime?: Date;
  delayMs?: number;
  reason: string;
  qualityScore: number;
  frequencyCapRespected: boolean;
  quietHoursRespected: boolean;
}

export interface EngagementMetrics {
  deliveredAt: Date;
  openedAt?: Date;
  clickedAt?: Date;
  convertedAt?: Date;
  channel: string;
  category: string;
  type: string;
  deviceType?: string;
  timeToOpen?: number; // seconds
  timeToClick?: number; // seconds
}

@Injectable()
export class SendTimeOptimizerService {
  private readonly logger = new Logger(SendTimeOptimizerService.name);
  private readonly featureEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    this.featureEnabled = this.configService.get('SEND_TIME_OPTIMIZATION_ENABLED', 'true') === 'true';
    this.logger.log(`Send Time Optimization: ${this.featureEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Main method to determine if a notification should be sent now
   */
  async shouldSendNow(notificationData: NotificationData): Promise<SendTimeRecommendation> {
    // Feature flag check
    if (!this.featureEnabled) {
      return {
        shouldSendNow: true,
        reason: 'Feature disabled',
        qualityScore: 100,
        frequencyCapRespected: true,
        quietHoursRespected: true,
      };
    }

    try {
      // Bypass optimization for critical notifications
      if (notificationData.priority === 'critical') {
        return {
          shouldSendNow: true,
          reason: 'Critical priority bypass',
          qualityScore: 100,
          frequencyCapRespected: true,
          quietHoursRespected: true,
        };
      }

      // Bypass for verification codes
      if (this.isVerificationNotification(notificationData)) {
        return {
          shouldSendNow: true,
          reason: 'Verification notification bypass',
          qualityScore: 100,
          frequencyCapRespected: true,
          quietHoursRespected: true,
        };
      }

      // Get or create user engagement profile
      const profile = await this.getOrCreateUserEngagementProfile(notificationData.userId);

      // Check frequency caps
      const frequencyCheck = await this.checkFrequencyCaps(notificationData.userId, notificationData.channel, profile);
      if (!frequencyCheck.canSend) {
        return {
          shouldSendNow: false,
          optimalSendTime: frequencyCheck.nextAvailableTime,
          delayMs: frequencyCheck.nextAvailableTime ? frequencyCheck.nextAvailableTime.getTime() - Date.now() : undefined,
          reason: `Frequency cap exceeded: ${frequencyCheck.reason}`,
          qualityScore: profile.qualityScore,
          frequencyCapRespected: false,
          quietHoursRespected: true,
        };
      }

      // Check quiet hours
      const quietHoursCheck = this.checkQuietHours(notificationData, profile);
      if (!quietHoursCheck.canSend) {
        return {
          shouldSendNow: false,
          optimalSendTime: quietHoursCheck.nextAvailableTime,
          delayMs: quietHoursCheck.nextAvailableTime ? quietHoursCheck.nextAvailableTime.getTime() - Date.now() : undefined,
          reason: `Quiet hours: ${quietHoursCheck.reason}`,
          qualityScore: profile.qualityScore,
          frequencyCapRespected: true,
          quietHoursRespected: false,
        };
      }

      // Check optimal send time
      const optimalTimeCheck = this.checkOptimalSendTime(notificationData, profile);
      if (!optimalTimeCheck.shouldSendNow) {
        return {
          shouldSendNow: false,
          optimalSendTime: optimalTimeCheck.nextOptimalTime,
          delayMs: optimalTimeCheck.nextOptimalTime ? optimalTimeCheck.nextOptimalTime.getTime() - Date.now() : undefined,
          reason: `Suboptimal send time: ${optimalTimeCheck.reason}`,
          qualityScore: profile.qualityScore,
          frequencyCapRespected: true,
          quietHoursRespected: true,
        };
      }

      // All checks passed
      return {
        shouldSendNow: true,
        reason: 'Optimal send time',
        qualityScore: profile.qualityScore,
        frequencyCapRespected: true,
        quietHoursRespected: true,
      };
    } catch (error) {
      this.logger.error(`Error in shouldSendNow for user ${notificationData.userId}:`, error);
      // Fail safe - send immediately if optimization fails
      return {
        shouldSendNow: true,
        reason: 'Optimization failed - fail safe',
        qualityScore: 50,
        frequencyCapRespected: true,
        quietHoursRespected: true,
      };
    }
  }

  /**
   * Record that a notification was sent for engagement tracking
   */
  async recordNotificationSent(
    userId: string,
    notificationData: NotificationData,
    sentAt: Date = new Date()
  ): Promise<void> {
    if (!this.featureEnabled) {
      return;
    }

    try {
      // Update user engagement profile
      await this.updateEngagementProfile(userId, notificationData, sentAt);

      // Track frequency usage
      await this.trackFrequencyUsage(userId, notificationData.channel, sentAt);

      this.logger.debug(`Recorded notification sent for user ${userId}, channel: ${notificationData.channel}`);
    } catch (error) {
      this.logger.error(`Error recording notification sent for user ${userId}:`, error);
    }
  }

  /**
   * Record engagement metrics for learning
   */
  async recordEngagement(
    userId: string,
    notificationId: string,
    metrics: Partial<EngagementMetrics>
  ): Promise<void> {
    if (!this.featureEnabled) {
      return;
    }

    try {
      // Store engagement data
      await this.prismaService.notificationEngagement.create({
        data: {
          userId,
          notificationId,
          deliveredAt: metrics.deliveredAt,
          openedAt: metrics.openedAt,
          clickedAt: metrics.clickedAt,
          convertedAt: metrics.convertedAt,
          channel: metrics.channel,
          category: metrics.category,
          type: metrics.type,
          deviceType: metrics.deviceType,
          timeToOpen: metrics.timeToOpen,
          timeToClick: metrics.timeToClick,
        },
      });

      // Update user profile based on engagement
      await this.updateProfileFromEngagement(userId, metrics);

      this.logger.debug(`Recorded engagement for user ${userId}, notification: ${notificationId}`);
    } catch (error) {
      this.logger.error(`Error recording engagement for user ${userId}:`, error);
    }
  }

  /**
   * Get user's current engagement profile
   */
  async getUserEngagementProfile(userId: string): Promise<UserEngagementProfile | null> {
    try {
      const profile = await this.prismaService.userEngagementProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return null;
      }

      return {
        userId: profile.userId,
        timezone: profile.timezone,
        optimalSendTimes: JSON.parse(profile.optimalSendTimes as string),
        engagementPatterns: JSON.parse(profile.engagementPatterns as string),
        frequencyCaps: JSON.parse(profile.frequencyCaps as string),
        quietHours: JSON.parse(profile.quietHours as string),
        qualityScore: profile.qualityScore,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Error getting user engagement profile for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Build or update user engagement profile
   */
  private async getOrCreateUserEngagementProfile(userId: string): Promise<UserEngagementProfile> {
    try {
      // Try to get existing profile
      let profile = await this.getUserEngagementProfile(userId);

      if (!profile) {
        // Create new profile with defaults
        profile = await this.createDefaultProfile(userId);
      }

      // Update profile with latest engagement data
      profile = await this.refreshProfileData(profile);

      return profile;
    } catch (error) {
      this.logger.error(`Error getting/creating user engagement profile for ${userId}:`, error);
      // Return safe default profile
      return this.createDefaultProfile(userId);
    }
  }

  /**
   * Create default user engagement profile
   */
  private createDefaultProfile(userId: string): UserEngagementProfile {
    const now = new Date();
    return {
      userId,
      timezone: 'UTC', // Will be updated from user preferences
      optimalSendTimes: {
        email: [[9, 0], [12, 0], [18, 0]], // 9 AM, 12 PM, 6 PM
        sms: [[10, 0], [14, 0], [19, 0]],  // 10 AM, 2 PM, 7 PM
        push: [[8, 0], [12, 30], [17, 0]], // 8 AM, 12:30 PM, 5 PM
        inApp: [[9, 0], [13, 0], [20, 0]], // 9 AM, 1 PM, 8 PM
      },
      engagementPatterns: {
        hourlyOpenRates: new Array(24).fill(0.5), // Default 50% open rate
        dailyEngagementScores: new Array(7).fill(0.5), // Default 50% engagement
        preferredChannels: ['push', 'email'],
        lastEngagementAt: undefined,
      },
      frequencyCaps: {
        email: { maxPerDay: 5, maxPerWeek: 20, maxPerMonth: 50 },
        sms: { maxPerDay: 3, maxPerWeek: 10, maxPerMonth: 25 },
        push: { maxPerDay: 10, maxPerWeek: 40, maxPerMonth: 100 },
        inApp: { maxPerDay: 20, maxPerWeek: 80, maxPerMonth: 200 },
      },
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC',
      },
      qualityScore: 50, // Default medium quality
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Refresh profile with latest engagement data
   */
  private async refreshProfileData(profile: UserEngagementProfile): Promise<UserEngagementProfile> {
    try {
      // Get user's timezone from preferences
      const user = await this.prismaService.user.findUnique({
        where: { id: profile.userId },
        include: { notificationPreferences: true },
      });

      if (user?.notificationPreferences?.timezone) {
        profile.timezone = user.notificationPreferences.timezone;
      }

      if (user?.notificationPreferences?.quietHours) {
        profile.quietHours = {
          ...profile.quietHours,
          ...user.notificationPreferences.quietHours,
        };
      }

      // Get recent engagement data
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentEngagement = await this.prismaService.notificationEngagement.findMany({
        where: {
          userId: profile.userId,
          deliveredAt: { gte: thirtyDaysAgo },
        },
        orderBy: { deliveredAt: 'desc' },
        take: 1000,
      });

      // Update engagement patterns based on recent data
      profile = this.updateEngagementPatterns(profile, recentEngagement);

      // Save updated profile
      await this.saveUserEngagementProfile(profile);

      return profile;
    } catch (error) {
      this.logger.error(`Error refreshing profile data for user ${profile.userId}:`, error);
      return profile;
    }
  }

  /**
   * Update engagement patterns based on recent engagement data
   */
  private updateEngagementPatterns(
    profile: UserEngagementProfile,
    engagementData: any[]
  ): UserEngagementProfile {
    if (engagementData.length === 0) {
      return profile;
    }

    // Calculate hourly open rates
    const hourlyEngagement = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    engagementData.forEach(data => {
      const hour = data.deliveredAt.getHours();
      hourlyCounts[hour]++;
      if (data.openedAt) {
        hourlyEngagement[hour]++;
      }
    });

    profile.engagementPatterns.hourlyOpenRates = hourlyCounts.map((count, hour) =>
      count > 0 ? hourlyEngagement[hour] / count : 0
    );

    // Update optimal send times based on hourly engagement
    profile.optimalSendTimes = this.calculateOptimalSendTimes(
      profile.engagementPatterns.hourlyOpenRates,
      profile.timezone
    );

    // Calculate quality score
    const totalEngagement = engagementData.filter(data => data.openedAt).length;
    profile.qualityScore = Math.min(100, Math.round((totalEngagement / engagementData.length) * 100));

    profile.updatedAt = new Date();

    return profile;
  }

  /**
   * Calculate optimal send times based on hourly engagement
   */
  private calculateOptimalSendTimes(
    hourlyOpenRates: number[],
    timezone: string
  ): UserEngagementProfile['optimalSendTimes'] {
    // Find top 3 engagement hours
    const sortedHours = hourlyOpenRates
      .map((rate, hour) => ({ hour, rate }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3)
      .map(item => item.hour);

    return {
      email: sortedHours.map(hour => [hour, 0]),
      sms: sortedHours.map(hour => [hour, 30]), // 30 minutes later
      push: sortedHours.map(hour => [Math.max(0, hour - 1), 0]), // 1 hour earlier
      inApp: sortedHours.map(hour => [hour, 15]), // 15 minutes later
    };
  }

  /**
   * Check frequency caps
   */
  private async checkFrequencyCaps(
    userId: string,
    channel: string,
    profile: UserEngagementProfile
  ): Promise<{ canSend: boolean; reason?: string; nextAvailableTime?: Date }> {
    try {
      const caps = profile.frequencyCaps[channel as keyof typeof profile.frequencyCaps];
      const now = new Date();

      // Check daily cap
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dailyCount = await this.prismaService.notificationDeliveryLog.count({
        where: {
          channel,
          status: 'SUCCESS',
          sentAt: { gte: dayStart },
          // Note: In a real implementation, you'd need to join with notifications table
          // or store userId in the delivery log
        },
      });

      if (dailyCount >= caps.maxPerDay) {
        const nextDay = new Date(dayStart);
        nextDay.setDate(nextDay.getDate() + 1);
        return {
          canSend: false,
          reason: `Daily limit reached (${dailyCount}/${caps.maxPerDay})`,
          nextAvailableTime: nextDay,
        };
      }

      // Check weekly cap
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weeklyCount = await this.prismaService.notificationDeliveryLog.count({
        where: {
          channel,
          status: 'SUCCESS',
          sentAt: { gte: weekStart },
        },
      });

      if (weeklyCount >= caps.maxPerWeek) {
        const nextWeek = new Date(weekStart);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return {
          canSend: false,
          reason: `Weekly limit reached (${weeklyCount}/${caps.maxPerWeek})`,
          nextAvailableTime: nextWeek,
        };
      }

      return { canSend: true };
    } catch (error) {
      this.logger.error(`Error checking frequency caps for user ${userId}:`, error);
      return { canSend: true }; // Fail safe
    }
  }

  /**
   * Check quiet hours
   */
  private checkQuietHours(
    notificationData: NotificationData,
    profile: UserEngagementProfile
  ): { canSend: boolean; reason?: string; nextAvailableTime?: Date } {
    const quietHours = profile.quietHours;

    if (!quietHours.enabled) {
      return { canSend: true };
    }

    const now = new Date();
    const userTime = this.convertToUserTimezone(now, profile.timezone);
    const currentTime = userTime.getHours() * 60 + userTime.getMinutes();

    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    let inQuietHours: boolean;

    if (startTime <= endTime) {
      // Same day range
      inQuietHours = currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight range
      inQuietHours = currentTime >= startTime || currentTime <= endTime;
    }

    if (inQuietHours && notificationData.priority !== 'high') {
      // Calculate next available time outside quiet hours
      const nextAvailable = this.calculateNextAvailableTime(userTime, quietHours);
      return {
        canSend: false,
        reason: 'Currently in quiet hours',
        nextAvailableTime: this.convertFromUserTimezone(nextAvailable, profile.timezone),
      };
    }

    return { canSend: true };
  }

  /**
   * Check if current time is optimal for sending
   */
  private checkOptimalSendTime(
    notificationData: NotificationData,
    profile: UserEngagementProfile
  ): { shouldSendNow: boolean; reason?: string; nextOptimalTime?: Date } {
    // High priority notifications bypass optimal time checking
    if (notificationData.priority === 'high') {
      return { shouldSendNow: true };
    }

    const now = new Date();
    const userTime = this.convertToUserTimezone(now, profile.timezone);
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const optimalTimes = profile.optimalSendTimes[notificationData.channel as keyof typeof profile.optimalSendTimes];

    // Check if current time is within 30 minutes of an optimal send time
    const isOptimalTime = optimalTimes.some(([hour, minute]) => {
      const optimalTime = hour * 60 + minute;
      const timeDiff = Math.abs(currentTime - optimalTime);
      return timeDiff <= 30; // Within 30 minutes
    });

    if (isOptimalTime) {
      return { shouldSendNow: true };
    }

    // Find next optimal time
    const nextOptimal = this.findNextOptimalTime(userTime, optimalTimes);

    return {
      shouldSendNow: false,
      reason: 'Not in optimal send time window',
      nextOptimalTime: this.convertFromUserTimezone(nextOptimal, profile.timezone),
    };
  }

  /**
   * Check if notification is a verification type
   */
  private isVerificationNotification(notificationData: NotificationData): boolean {
    const verificationTypes = [
      'phone_verification',
      'two_factor',
      'email_verification',
      'password_reset',
      'account_verification',
    ];

    return verificationTypes.includes(notificationData.type) ||
           notificationData.category === 'verification' ||
           (notificationData.metadata?.isVerification === true);
  }

  /**
   * Update engagement profile after notification sent
   */
  private async updateEngagementProfile(
    userId: string,
    notificationData: NotificationData,
    sentAt: Date
  ): Promise<void> {
    try {
      const profile = await this.getUserEngagementProfile(userId);
      if (!profile) {
        return;
      }

      // Update last engagement time
      profile.engagementPatterns.lastEngagementAt = sentAt;
      profile.updatedAt = new Date();

      await this.saveUserEngagementProfile(profile);
    } catch (error) {
      this.logger.error(`Error updating engagement profile for user ${userId}:`, error);
    }
  }

  /**
   * Track frequency usage
   */
  private async trackFrequencyUsage(
    userId: string,
    channel: string,
    sentAt: Date
  ): Promise<void> {
    try {
      // This would typically update a frequency tracking table
      // For now, we'll rely on the delivery logs
      this.logger.debug(`Tracked frequency usage for user ${userId}, channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Error tracking frequency usage for user ${userId}:`, error);
    }
  }

  /**
   * Update profile based on engagement metrics
   */
  private async updateProfileFromEngagement(
    userId: string,
    metrics: Partial<EngagementMetrics>
  ): Promise<void> {
    try {
      const profile = await this.getUserEngagementProfile(userId);
      if (!profile) {
        return;
      }

      // Update quality score based on engagement
      if (metrics.openedAt) {
        profile.qualityScore = Math.min(100, profile.qualityScore + 2);
      } else {
        profile.qualityScore = Math.max(0, profile.qualityScore - 1);
      }

      profile.updatedAt = new Date();

      await this.saveUserEngagementProfile(profile);
    } catch (error) {
      this.logger.error(`Error updating profile from engagement for user ${userId}:`, error);
    }
  }

  /**
   * Save user engagement profile to database
   */
  private async saveUserEngagementProfile(profile: UserEngagementProfile): Promise<void> {
    try {
      await this.prismaService.userEngagementProfile.upsert({
        where: { userId: profile.userId },
        update: {
          timezone: profile.timezone,
          optimalSendTimes: JSON.stringify(profile.optimalSendTimes),
          engagementPatterns: JSON.stringify(profile.engagementPatterns),
          frequencyCaps: JSON.stringify(profile.frequencyCaps),
          quietHours: JSON.stringify(profile.quietHours),
          qualityScore: profile.qualityScore,
          updatedAt: new Date(),
        },
        create: {
          userId: profile.userId,
          timezone: profile.timezone,
          optimalSendTimes: JSON.stringify(profile.optimalSendTimes),
          engagementPatterns: JSON.stringify(profile.engagementPatterns),
          frequencyCaps: JSON.stringify(profile.frequencyCaps),
          quietHours: JSON.stringify(profile.quietHours),
          qualityScore: profile.qualityScore,
        },
      });
    } catch (error) {
      this.logger.error(`Error saving user engagement profile for ${profile.userId}:`, error);
    }
  }

  /**
   * Timezone helper methods
   */
  private convertToUserTimezone(date: Date, timezone: string): Date {
    // In a real implementation, you'd use a library like moment-timezone or date-fns-tz
    // For now, return the date as-is (UTC)
    return new Date(date);
  }

  private convertFromUserTimezone(date: Date, timezone: string): Date {
    // In a real implementation, you'd use a library like moment-timezone or date-fns-tz
    // For now, return the date as-is (UTC)
    return new Date(date);
  }

  /**
   * Calculate next available time outside quiet hours
   */
  private calculateNextAvailableTime(currentTime: Date, quietHours: UserEngagementProfile['quietHours']): Date {
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    const nextAvailable = new Date(currentTime);
    nextAvailable.setHours(endHour, endMin, 0, 0);

    // If end time is earlier than current time, schedule for next day
    if (nextAvailable <= currentTime) {
      nextAvailable.setDate(nextAvailable.getDate() + 1);
    }

    return nextAvailable;
  }

  /**
   * Find next optimal send time
   */
  private findNextOptimalTime(currentTime: Date, optimalTimes: number[][]): Date {
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Sort optimal times and find the next one
    const sortedTimes = optimalTimes
      .map(([hour, minute]) => hour * 60 + minute)
      .sort((a, b) => a - b);

    for (const timeMinutes of sortedTimes) {
      if (timeMinutes > currentTimeMinutes) {
        const nextOptimal = new Date(currentTime);
        nextOptimal.setHours(
          Math.floor(timeMinutes / 60),
          timeMinutes % 60,
          0,
          0
        );
        return nextOptimal;
      }
    }

    // If no optimal time left today, use first one tomorrow
    const firstTime = sortedTimes[0];
    const nextOptimal = new Date(currentTime);
    nextOptimal.setDate(nextOptimal.getDate() + 1);
    nextOptimal.setHours(
      Math.floor(firstTime / 60),
      firstTime % 60,
      0,
      0
    );

    return nextOptimal;
  }
}