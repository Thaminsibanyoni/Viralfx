/**
 * Predictive Notification Preloading - Behavior Tracking Service
 *
 * This service tracks user interaction patterns to predict notification access behavior
 * and optimize preloading strategies. It uses machine learning techniques to learn
 * from user behavior and improve notification cache performance.
 */

import { Notification } from '../../types/notification.types';

// Types for behavior tracking
export interface UserClickPattern {
  timestamp: number;
  notificationId: string;
  category: string;
  type: string;
  priority: string;
  hourOfDay: number;
  dayOfWeek: number;
  timeToClick: number; // ms from notification creation to click
  deviceType: 'mobile' | 'desktop' | 'tablet';
  sessionId: string;
}

export interface ActivityHotspot {
  hourOfDay: number;
  dayOfWeek: number;
  activityScore: number; // 0-1, higher = more active
  notificationProbability: number; // 0-1, likelihood of checking notifications
}

export interface EngagementMetrics {
  totalInteractions: number;
  clickRate: number; // clicked / viewed
  dismissRate: number; // dismissed / viewed
  averageReadTime: number; // ms
  categoryEngagement: Record<string, number>; // category -> engagement score
  typeEngagement: Record<string, number>; // type -> engagement score
  timeBasedEngagement: Record<string, number>; // hour -> engagement score
}

export interface CategoryWeights {
  [category: string]: {
    weight: number; // 0-1, user preference weight
    confidence: number; // 0-1, model confidence in this weight
    lastUpdated: number;
  };
}

export interface BehaviorTrackingConfig {
  trackingEnabled: boolean;
  dataRetentionDays: number;
  minInteractionsForML: number;
  predictionConfidenceThreshold: number;
  maxTrackedPatterns: number;
  cacheHitThreshold: number;
  batteryOptimizationEnabled: boolean;
}

export class BehaviorTrackingService {
  private config: BehaviorTrackingConfig = {
    trackingEnabled: true,
    dataRetentionDays: 90,
    minInteractionsForML: 50,
    predictionConfidenceThreshold: 0.7,
    maxTrackedPatterns: 1000,
    cacheHitThreshold: 0.8,
    batteryOptimizationEnabled: true,
  };

  private clickPatterns: UserClickPattern[] = [];
  private activityHotspots: ActivityHotspot[] = [];
  private engagementMetrics: EngagementMetrics;
  private categoryWeights: CategoryWeights = {};
  private sessionId: string;
  private lastCleanup: number = Date.now();

  constructor(config?: Partial<BehaviorTrackingConfig>) {
    this.config = { ...this.config, ...config };
    this.sessionId = this.generateSessionId();
    this.initializeMetrics();
    this.loadStoredData();

    // Setup periodic cleanup
    this.setupPeriodicCleanup();

    // Track page visibility for battery optimization
    this.setupVisibilityTracking();
  }

  /**
   * Track when a user views a notification
   */
  trackNotificationView(notification: Notification, renderTime: number): void {
    if (!this.config.trackingEnabled) return;

    // Type guards for required fields
    if (!notification.id || !notification.category || !notification.type || !notification.priority) {
      console.warn('Invalid notification structure for tracking:', notification);
      return;
    }

    const pattern: UserClickPattern = {
      timestamp: Date.now(),
      notificationId: notification.id,
      category: notification.category,
      type: notification.type,
      priority: notification.priority,
      hourOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      timeToClick: renderTime, // Time from creation to view
      deviceType: this.getDeviceType(),
      sessionId: this.sessionId,
    };

    this.addClickPattern(pattern);
    this.updateActivityHotspots(pattern);
    this.updateEngagementMetrics('view', notification);
    this.saveData();
  }

  /**
   * Track when a user clicks on a notification
   */
  trackNotificationClick(notification: Notification, timeToClick: number): void {
    if (!this.config.trackingEnabled) return;

    // Type guards for required fields
    if (!notification.id || !notification.category || !notification.type || !notification.priority) {
      console.warn('Invalid notification structure for tracking:', notification);
      return;
    }

    const pattern: UserClickPattern = {
      timestamp: Date.now(),
      notificationId: notification.id,
      category: notification.category,
      type: notification.type,
      priority: notification.priority,
      hourOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      timeToClick,
      deviceType: this.getDeviceType(),
      sessionId: this.sessionId,
    };

    this.addClickPattern(pattern);
    this.updateActivityHotspots(pattern);
    this.updateEngagementMetrics('click', notification);
    this.updateCategoryWeights(notification.category, true);
    this.saveData();
  }

  /**
   * Track when a user dismisses a notification
   */
  trackNotificationDismiss(notification: Notification): void {
    if (!this.config.trackingEnabled) return;

    // Type guards for required fields
    if (!notification.category) {
      console.warn('Invalid notification structure for tracking:', notification);
      return;
    }

    this.updateEngagementMetrics('dismiss', notification);
    this.updateCategoryWeights(notification.category, false);
    this.saveData();
  }

  /**
   * Predict likelihood of user accessing notifications in the next time window
   */
  predictNotificationAccess(timeWindowMinutes: number = 15): {
    probability: number;
    confidence: number;
    preferredCategories: string[];
    reasoning: string[];
  } {
    const currentHour = new Date().getHours();
    const currentDayOfWeek = new Date().getDay();

    // Calculate activity score for current time
    const currentActivity = this.getActivityScore(currentHour, currentDayOfWeek);

    // Calculate time-based engagement
    const timeEngagement = this.getTimeBasedEngagement(currentHour);

    // Get user's preferred categories
    const preferredCategories = this.getPreferredCategories();

    // Calculate overall probability
    const baseProbability = currentActivity * 0.4 + timeEngagement * 0.6;
    const categoryBonus = preferredCategories.length > 0 ? 0.1 : 0;
    const probability = Math.min(1, baseProbability + categoryBonus);

    // Calculate confidence based on data amount
    const confidence = this.calculatePredictionConfidence();

    // Generate reasoning
    const reasoning = this.generatePredictionReasoning(
      currentActivity,
      timeEngagement,
      preferredCategories
    );

    return {
      probability,
      confidence,
      preferredCategories,
      reasoning,
    };
  }

  /**
   * Get notifications to preload based on prediction
   */
  getNotificationsToPreload(
    availableNotifications: Notification[],
    maxCount: number = 10
  ): Notification[] {
    const prediction = this.predictNotificationAccess();

    // If confidence is low, don't preload aggressively
    if (prediction.confidence < this.config.predictionConfidenceThreshold) {
      return availableNotifications
        .filter(n => n.priority === 'high')
        .slice(0, Math.min(3, maxCount));
    }

    // Score notifications based on user preferences and patterns
    const scoredNotifications = availableNotifications.map(notification => {
      let score = 0;

      // Category preference weight
      if (prediction.preferredCategories.includes(notification.category)) {
        const categoryWeight = this.categoryWeights[notification.category]?.weight || 0.5;
        score += categoryWeight * 0.4;
      }

      // Priority weight
      const priorityWeight = notification.priority === 'high' ? 0.3 :
                           notification.priority === 'medium' ? 0.2 : 0.1;
      score += priorityWeight;

      // Time-based relevance
      const hourOfDay = new Date().getHours();
      const timeRelevance = this.getTimeBasedEngagement(hourOfDay);
      score += timeRelevance * 0.2;

      // Recent engagement with similar notifications
      const recentEngagement = this.getRecentEngagementScore(notification);
      score += recentEngagement * 0.1;

      return { notification, score };
    });

    // Sort by score and return top notifications
    return scoredNotifications
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCount)
      .map(item => item.notification);
  }

  /**
   * Get user's preferred notification categories
   */
  getPreferredCategories(): string[] {
    return Object.entries(this.categoryWeights)
      .filter(([_, weight]) => weight.weight > 0.6 && weight.confidence > 0.5)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 5)
      .map(([category]) => category);
  }

  /**
   * Check if user is currently in an active period
   */
  isUserInActivePeriod(): boolean {
    const currentHour = new Date().getHours();
    const currentDayOfWeek = new Date().getDay();
    const activityScore = this.getActivityScore(currentHour, currentDayOfWeek);
    return activityScore > 0.3;
  }

  /**
   * Get user behavior analytics (for debugging/monitoring)
   */
  getBehaviorAnalytics(): {
    totalPatterns: number;
    engagementMetrics: EngagementMetrics;
    categoryWeights: CategoryWeights;
    activityHotspots: ActivityHotspot[];
    predictionAccuracy?: number;
  } {
    return {
      totalPatterns: this.clickPatterns.length,
      engagementMetrics: this.engagementMetrics,
      categoryWeights: this.categoryWeights,
      activityHotspots: this.activityHotspots,
    };
  }

  // Private helper methods

  private initializeMetrics(): void {
    this.engagementMetrics = {
      totalInteractions: 0,
      clickRate: 0,
      dismissRate: 0,
      averageReadTime: 0,
      categoryEngagement: {},
      typeEngagement: {},
      timeBasedEngagement: {},
    };
  }

  private addClickPattern(pattern: UserClickPattern): void {
    this.clickPatterns.push(pattern);

    // Maintain maximum patterns limit
    if (this.clickPatterns.length > this.config.maxTrackedPatterns) {
      this.clickPatterns = this.clickPatterns.slice(-this.config.maxTrackedPatterns);
    }
  }

  private updateActivityHotspots(pattern: UserClickPattern): void {
    const key = `${pattern.hourOfDay}-${pattern.dayOfWeek}`;
    const existingIndex = this.activityHotspots.findIndex(
      spot => spot.hourOfDay === pattern.hourOfDay && spot.dayOfWeek === pattern.dayOfWeek
    );

    if (existingIndex >= 0) {
      // Update existing hotspot
      const hotspot = this.activityHotspots[existingIndex];
      hotspot.activityScore = Math.min(1, hotspot.activityScore + 0.1);
      hotspot.notificationProbability = Math.min(1, hotspot.notificationProbability + 0.05);
    } else {
      // Create new hotspot
      this.activityHotspots.push({
        hourOfDay: pattern.hourOfDay,
        dayOfWeek: pattern.dayOfWeek,
        activityScore: 0.1,
        notificationProbability: 0.05,
      });
    }
  }

  private updateEngagementMetrics(action: 'view' | 'click' | 'dismiss', notification: Notification): void {
    this.engagementMetrics.totalInteractions++;

    // Update category engagement
    const currentCategoryEngagement = this.engagementMetrics.categoryEngagement[notification.category] || 0;
    const engagementDelta = action === 'click' ? 0.1 : action === 'dismiss' ? -0.05 : 0.02;
    this.engagementMetrics.categoryEngagement[notification.category] =
      Math.max(0, Math.min(1, currentCategoryEngagement + engagementDelta));

    // Update type engagement
    const currentTypeEngagement = this.engagementMetrics.typeEngagement[notification.type] || 0;
    this.engagementMetrics.typeEngagement[notification.type] =
      Math.max(0, Math.min(1, currentTypeEngagement + engagementDelta));

    // Update time-based engagement
    const hour = new Date().getHours().toString();
    const currentTimeEngagement = this.engagementMetrics.timeBasedEngagement[hour] || 0;
    this.engagementMetrics.timeBasedEngagement[hour] =
      Math.max(0, Math.min(1, currentTimeEngagement + engagementDelta));

    // Recalculate rates
    this.calculateEngagementRates();
  }

  private updateCategoryWeights(category: string, positiveEngagement: boolean): void {
    const currentWeight = this.categoryWeights[category]?.weight || 0.5;
    const currentConfidence = this.categoryWeights[category]?.confidence || 0.1;

    const weightDelta = positiveEngagement ? 0.05 : -0.03;
    const confidenceDelta = 0.02;

    this.categoryWeights[category] = {
      weight: Math.max(0, Math.min(1, currentWeight + weightDelta)),
      confidence: Math.max(0, Math.min(1, currentConfidence + confidenceDelta)),
      lastUpdated: Date.now(),
    };
  }

  private calculateEngagementRates(): void {
    const totalViews = this.clickPatterns.length;
    const totalClicks = this.clickPatterns.filter(p => p.timeToClick < 30000).length; // Clicked within 30s

    this.engagementMetrics.clickRate = totalViews > 0 ? totalClicks / totalViews : 0;
  }

  private getActivityScore(hourOfDay: number, dayOfWeek: number): number {
    const hotspot = this.activityHotspots.find(
      spot => spot.hourOfDay === hourOfDay && spot.dayOfWeek === dayOfWeek
    );
    return hotspot?.activityScore || 0.1;
  }

  private getTimeBasedEngagement(hourOfDay: number): number {
    return this.engagementMetrics.timeBasedEngagement[hourOfDay.toString()] || 0.1;
  }

  private getRecentEngagementScore(notification: Notification): number {
    const recentPatterns = this.clickPatterns.filter(
      p => Date.now() - p.timestamp < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    const similarPatterns = recentPatterns.filter(
      p => p.category === notification.category || p.type === notification.type
    );

    return Math.min(1, similarPatterns.length / 10);
  }

  private calculatePredictionConfidence(): number {
    const dataPoints = this.clickPatterns.length;
    if (dataPoints < this.config.minInteractionsForML) {
      return 0.3; // Low confidence with insufficient data
    }

    // Higher confidence with more data points, capped at 0.95
    return Math.min(0.95, dataPoints / this.config.minInteractionsForML);
  }

  private generatePredictionReasoning(
    activityScore: number,
    timeEngagement: number,
    preferredCategories: string[]
  ): string[] {
    const reasoning = [];

    if (activityScore > 0.7) {
      reasoning.push("User typically active during this time");
    } else if (activityScore < 0.3) {
      reasoning.push("User usually less active during this time");
    }

    if (timeEngagement > 0.6) {
      reasoning.push("High engagement with notifications at this hour");
    }

    if (preferredCategories.length > 0) {
      reasoning.push(`User prefers ${preferredCategories.slice(0, 3).join(", ")} notifications`);
    }

    if (this.clickPatterns.length < this.config.minInteractionsForML) {
      reasoning.push("Limited user data - learning patterns");
    }

    return reasoning;
  }

  private getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.config.batteryOptimizationEnabled) {
        // Pause tracking when page is hidden to save battery
        this.pauseTracking();
      } else {
        this.resumeTracking();
      }
    });
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - (this.config.dataRetentionDays * 24 * 60 * 60 * 1000);

    // Remove old patterns
    this.clickPatterns = this.clickPatterns.filter(pattern => pattern.timestamp > cutoffTime);

    // Remove old category weights
    Object.keys(this.categoryWeights).forEach(category => {
      if (this.categoryWeights[category].lastUpdated < cutoffTime) {
        delete this.categoryWeights[category];
      }
    });

    this.lastCleanup = Date.now();
    this.saveData();
  }

  private pauseTracking(): void {
    // Implement tracking pause logic
  }

  private resumeTracking(): void {
    // Implement tracking resume logic
  }

  private saveData(): void {
    try {
      const data = {
        clickPatterns: this.clickPatterns,
        activityHotspots: this.activityHotspots,
        engagementMetrics: this.engagementMetrics,
        categoryWeights: this.categoryWeights,
        lastCleanup: this.lastCleanup,
      };
      localStorage.setItem('notificationBehaviorData', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save behavior data:', error);
    }
  }

  private loadStoredData(): void {
    try {
      const stored = localStorage.getItem('notificationBehaviorData');
      if (stored) {
        const data = JSON.parse(stored);
        this.clickPatterns = data.clickPatterns || [];
        this.activityHotspots = data.activityHotspots || [];
        this.engagementMetrics = data.engagementMetrics || this.engagementMetrics;
        this.categoryWeights = data.categoryWeights || {};
        this.lastCleanup = data.lastCleanup || Date.now();

        // Clean up old data on load
        if (Date.now() - this.lastCleanup > 24 * 60 * 60 * 1000) {
          this.cleanupOldData();
        }
      }
    } catch (error) {
      console.warn('Failed to load behavior data:', error);
    }
  }

  /**
   * Public method to run cleanup of old behavior tracking data
   * This provides a safe public interface for the performance optimization service
   */
  runCleanup(): void {
    this.cleanupOldData();
  }
}

// Singleton instance
export const _behaviorTrackingService = new BehaviorTrackingService();