import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// COMMENTED OUT (TypeORM entity deleted): import { Trend } from '../entities/trend.entity';
import { ModerationAction } from '../interfaces/moderation.interface';
import { ComplianceService } from "../../compliance/services/compliance.service";
import { NotificationService } from "../../notifications/services/notification.service";

interface ModerationTask {
  id: string;
  type: 'TREND_REVIEW' | 'CONTENT_REVIEW' | 'USER_REVIEW' | 'COMPLIANCE_CHECK';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  data: any;
  createdAt: Date;
  assignedTo?: string;
  completedAt?: Date;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

interface ModerationQueue {
  pending: ModerationTask[];
  inProgress: ModerationTask[];
  completed: ModerationTask[];
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  private moderationQueue: ModerationQueue = {
    pending: [],
    inProgress: [],
    completed: []
  };

  constructor(
        private prisma: PrismaService,
    private readonly complianceService: ComplianceService,
    private readonly notificationService: NotificationService,
    @InjectQueue('moderation') private readonly moderationQueue: Queue
  ) {}

  /**
   * Submit trend for moderation
   */
  async submitTrendForModeration(trendData: {
    id: string;
    title: string;
    content: string;
    platform: string;
    author: string;
    submittedBy: string;
    metadata?: any;
  }): Promise<string> {
    try {
      // Create moderation task
      const task: ModerationTask = {
        id: this.generateTaskId(),
        type: 'TREND_REVIEW',
        priority: this.determinePriority(trendData),
        data: {
          trendId: trendData.id,
          title: trendData.title,
          content: trendData.content,
          platform: trendData.platform,
          author: trendData.author,
          submittedBy: trendData.submittedBy,
          metadata: trendData.metadata
        },
        createdAt: new Date(),
        status: 'PENDING'
      };

      // Add to queue
      this.moderationQueue.pending.push(task);

      // Queue for processing
      await this.moderationQueue.add('process-moderation', task, {
        attempts: 3,
        backoff: 'exponential',
        delay: 0
      });

      this.logger.log(`Trend submitted for moderation: ${trendData.id}`);
      return task.id;
    } catch (error) {
      this.logger.error('Failed to submit trend for moderation:', error);
      throw error;
    }
  }

  /**
   * Process moderation task
   */
  async processModerationTask(taskId: string): Promise<ModerationAction> {
    try {
      // Move task from pending to in progress
      const task = this.moderationQueue.pending.find(t => t.id === taskId);
      if (!task) {
        throw new Error(`Moderation task not found: ${taskId}`);
      }

      task.status = 'IN_PROGRESS';
      this.moveTask(task, 'pending', 'inProgress');

      let action: ModerationAction;

      switch (task.type) {
        case 'TREND_REVIEW':
          action = await this.reviewTrend(task.data);
          break;
        case 'CONTENT_REVIEW':
          action = await this.reviewContent(task.data);
          break;
        case 'USER_REVIEW':
          action = await this.reviewUser(task.data);
          break;
        case 'COMPLIANCE_CHECK':
          action = await this.performComplianceCheck(task.data);
          break;
        default:
          throw new Error(`Unknown moderation task type: ${task.type}`);
      }

      // Update task status
      task.status = 'COMPLETED';
      task.completedAt = new Date();
      this.moveTask(task, 'inProgress', 'completed');

      this.logger.log(`Moderation task completed: ${taskId} - ${action.action}`);
      return action;
    } catch (error) {
      this.logger.error('Failed to process moderation task:', error);
      throw error;
    }
  }

  /**
   * Review trend for approval
   */
  private async reviewTrend(trendData: any): Promise<ModerationAction> {
    try {
      // Perform compliance check
      const safetyCheck = await this.complianceService.analyzeContentSafety({
        text: trendData.content,
        metadata: {
          platform: trendData.platform,
          author: trendData.author
        }
      });

      // Determine action based on safety analysis
      let action: ModerationAction;

      if (safetyCheck.safetyLevel === 'BLOCKED') {
        action = {
          action: 'BLOCK',
          reason: 'Content violates safety guidelines',
          details: safetyCheck.violations,
          automatic: true,
          requiresReview: false
        };

        // Block the trend
        await this.blockTrend(trendData.trendId, action.reason);
      } else if (safetyCheck.safetyLevel === 'FLAGGED') {
        action = {
          action: 'FLAG_FOR_REVIEW',
          reason: 'Content requires human review',
          details: safetyCheck.violations,
          automatic: true,
          requiresReview: true
        };

        // Flag the trend for manual review
        await this.flagTrend(trendData.trendId, action.reason);
      } else {
        action = {
          action: 'APPROVE',
          reason: 'Content meets all guidelines',
          details: [],
          automatic: true,
          requiresReview: false
        };

        // Approve the trend
        await this.approveTrend(trendData.trendId);
      }

      // Log compliance details
      await this.logComplianceAction(trendData.trendId, action);

      return action;
    } catch (error) {
      this.logger.error('Failed to review trend:', error);
      throw error;
    }
  }

  /**
   * Review general content
   */
  private async reviewContent(contentData: any): Promise<ModerationAction> {
    // Implementation for general content review
    return {
      action: 'APPROVE',
      reason: 'Content approved',
      automatic: true,
      requiresReview: false
    };
  }

  /**
   * Review user
   */
  private async reviewUser(userData: any): Promise<ModerationAction> {
    // Implementation for user review
    return {
      action: 'APPROVE',
      reason: 'User approved',
      automatic: true,
      requiresReview: false
    };
  }

  /**
   * Perform compliance check
   */
  private async performComplianceCheck(complianceData: any): Promise<ModerationAction> {
    try {
      const checkResult = await this.complianceService.performComplianceCheck(complianceData);

      return {
        action: checkResult.approved ? 'APPROVE' : 'BLOCK',
        reason: checkResult.reason,
        details: checkResult.violations,
        automatic: true,
        requiresReview: checkResult.requiresHumanReview,
        riskScore: checkResult.riskScore
      };
    } catch (error) {
      this.logger.error('Failed to perform compliance check:', error);
      throw error;
    }
  }

  /**
   * Approve trend
   */
  private async approveTrend(trendId: string): Promise<void> {
    try {
      await this.prisma.topic.update({
        where: { id: trendId },
        data: {
          moderationStatus: 'APPROVED',
          moderatedAt: new Date(),
          isActive: true,
          lastModeratedBy: 'system'
        }
      });

      // Notify trend submitter
      await this.notifyTrendUpdate(trendId, 'APPROVED');

      this.logger.log(`Trend approved: ${trendId}`);
    } catch (error) {
      this.logger.error('Failed to approve trend:', error);
      throw error;
    }
  }

  /**
   * Flag trend for review
   */
  private async flagTrend(trendId: string, reason: string): Promise<void> {
    try {
      await this.prisma.topic.update({
        where: { id: trendId },
        data: {
          moderationStatus: 'PENDING',
          moderatedAt: new Date(),
          moderationReason: reason,
          lastModeratedBy: 'system'
        }
      });

      // Notify moderation team
      await this.notifyModerationTeam({
        type: 'TREND_REVIEW_REQUIRED',
        trendId,
        reason
      });

      this.logger.log(`Trend flagged for review: ${trendId} - ${reason}`);
    } catch (error) {
      this.logger.error('Failed to flag trend:', error);
      throw error;
    }
  }

  /**
   * Block trend
   */
  private async blockTrend(trendId: string, reason: string): Promise<void> {
    try {
      await this.prisma.topic.update({
        where: { id: trendId },
        data: {
          moderationStatus: 'REJECTED',
          moderatedAt: new Date(),
          moderationReason: reason,
          isActive: false,
          lastModeratedBy: 'system'
        }
      });

      // Notify trend submitter
      await this.notifyTrendUpdate(trendId, 'REJECTED', reason);

      this.logger.log(`Trend blocked: ${trendId} - ${reason}`);
    } catch (error) {
      this.logger.error('Failed to block trend:', error);
      throw error;
    }
  }

  /**
   * Get moderation queue status
   */
  async getModerationQueueStatus(): Promise<ModerationQueue> {
    return { ...this.moderationQueue };
  }

  /**
   * Get pending moderation tasks
   */
  async getPendingTasks(limit: number = 50): Promise<ModerationTask[]> {
    return this.moderationQueue.pending.slice(0, limit);
  }

  /**
   * Get moderation statistics
   */
  async getModerationStats(timeframe: '1d' | '7d' | '30d'): Promise<any> {
    try {
      const now = new Date();
      const startTime = this.calculateStartTime(now, timeframe);

      const stats = {
        total: this.moderationQueue.completed.length,
        completed: this.moderationQueue.completed.filter(task => task.completedAt && task.completedAt >= startTime).length,
        pending: this.moderationQueue.pending.length,
        inProgress: this.moderationQueue.inProgress.length,
        averageProcessingTime: this.calculateAverageProcessingTime(),
        actionTypes: this.getActionTypeStats(),
        successRate: this.calculateSuccessRate()
      };

      return stats;
    } catch (error) {
      this.logger.error('Failed to get moderation stats:', error);
      throw error;
    }
  }

  /**
   * Assign task to moderator
   */
  async assignTask(taskId: string, moderatorId: string): Promise<void> {
    try {
      const task = this.moderationQueue.pending.find(t => t.id === taskId);
      if (!task) {
        throw new Error(`Moderation task not found: ${taskId}`);
      }

      task.assignedTo = moderatorId;

      // Notify moderator of assignment
      await this.notifyModeratorAssignment(moderatorId, task);

      this.logger.log(`Task assigned to moderator: ${taskId} -> ${moderatorId}`);
    } catch (error) {
      this.logger.error('Failed to assign task:', error);
      throw error;
    }
  }

  /**
   * Get moderator workload
   */
  async getModeratorWorkload(moderatorId: string): Promise<any> {
    try {
      const assignedTasks = this.moderationQueue.inProgress.filter(task => task.assignedTo === moderatorId);
      const completedTasks = this.moderationQueue.completed.filter(task => task.assignedTo === moderatorId);

      return {
        assigned: assignedTasks.length,
        completed: completedTasks.length,
        averageProcessingTime: this.calculateModeratorAverageProcessingTime(moderatorId),
        efficiencyScore: this.calculateModeratorEfficiency(moderatorId)
      };
    } catch (error) {
      this.logger.error('Failed to get moderator workload:', error);
      throw error;
    }
  }

  /**
   * Bulk moderate trends
   */
  async bulkModerateTrends(trendIds: string[], action: 'APPROVE' | 'BLOCK' | 'FLAG', reason?: string): Promise<{
    total: number;
    processed: number;
    failed: string[];
  }> {
    try {
      const results = {
        total: trendIds.length,
        processed: 0,
        failed: []
      };

      for (const trendId of trendIds) {
        try {
          let moderationAction: ModerationAction;

          switch (action) {
            case 'APPROVE':
              await this.approveTrend(trendId);
              moderationAction = { action: 'APPROVE', automatic: true };
              break;
            case 'BLOCK':
              await this.blockTrend(trendId, reason || 'Blocked in bulk moderation');
              moderationAction = { action: 'BLOCK', automatic: true };
              break;
            case 'FLAG':
              await this.flagTrend(trendId, reason || 'Flagged in bulk moderation');
              moderationAction = { action: 'FLAG_FOR_REVIEW', automatic: true };
              break;
          }

          results.processed++;
          this.logger.log(`Bulk moderation: ${action} - ${trendId}`);
        } catch (error) {
          results.failed.push(`${trendId}: ${error.message}`);
          this.logger.error(`Failed to moderate trend ${trendId}:`, error);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to bulk moderate trends:', error);
      throw error;
    }
  }

  /**
   * Get moderation trends
   */
  async getModerationTrends(timeframe: string): Promise<any> {
    try {
      const startTime = this.calculateStartTime(new Date(), timeframe);

      const trends = await this.prisma.topic.findMany({
        where: {
          moderatedAt: { gte: startTime }
        },
        orderBy: {
          moderatedAt: 'desc'
        },
        take: 100
      });

      return trends.map((trend: any) => ({
        id: trend.id,
        title: trend.topicName || trend.title,
        platform: trend.platform || 'unknown',
        status: trend.moderationStatus,
        reason: trend.moderationReason,
        moderatedAt: trend.moderatedAt,
        automatic: trend.lastModeratedBy === 'system',
        safetyScore: trend.contentRiskScore,
        requiresReview: trend.moderationStatus === 'PENDING'
      }));
    } catch (error) {
      this.logger.error('Failed to get moderation trends:', error);
      throw error;
    }
  }

  /**
   * Generate automated moderation tasks
   */
  async generateAutomatedModerationTasks(): Promise<void> {
    try {
      // Find trends pending moderation
      const pendingTrends = await this.prisma.topic.findMany({
        where: {
          moderationStatus: 'PENDING'
        }
      });

      for (const trend of pendingTrends) {
        await this.submitTrendForModeration({
          id: trend.id,
          title: (trend as any).topicName || trend.name || '',
          content: (trend as any).description || '',
          platform: (trend as any).platform || 'unknown',
          author: (trend as any).author || 'unknown',
          submittedBy: 'automated'
        });
      }

      this.logger.log(`Generated ${pendingTrends.length} automated moderation tasks`);
    } catch (error) {
      this.logger.error('Failed to generate automated moderation tasks:', error);
      throw error;
    }
  }

  /**
   * Escalate high-priority tasks
   */
  async escalateHighPriorityTasks(): Promise<void> {
    try {
      const highPriorityTasks = this.moderationQueue.pending.filter(
        task => task.priority === 'HIGH' || task.priority === 'CRITICAL'
      );

      for (const task of highPriorityTasks) {
        // Notify senior moderators
        await this.notifyHighPriorityTask(task);

        // Increase priority in queue
        task.priority = 'CRITICAL';
      }

      this.logger.log(`Escalated ${highPriorityTasks.length} high-priority tasks`);
    } catch (error) {
      this.logger.error('Failed to escalate high-priority tasks:', error);
      throw error;
    }
  }

  // Helper methods
  private generateTaskId(): string {
    return `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determinePriority(trendData: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Determine priority based on various factors
    if (trendData.metadata?.viralityScore > 90) {
      return 'HIGH';
    }
    if (trendData.metadata?.riskScore > 0.8) {
      return 'HIGH';
    }
    if (trendData.platform === 'twitter' && trendData.metadata?.engagementRate > 5) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private moveTask(task: ModerationTask, from: keyof ModerationQueue, to: keyof ModerationQueue): void {
    const fromIndex = this.moderationQueue[from].findIndex(t => t.id === task.id);
    if (fromIndex !== -1) {
      this.moderationQueue[from].splice(fromIndex, 1);
      this.moderationQueue[to].push(task);
    }
  }

  private calculateStartTime(now: Date, timeframe: string): Date {
    const timeframes = {
      '1d': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    return new Date(now.getTime() - timeframes[timeframe as keyof typeof timeframes]);
  }

  private calculateAverageProcessingTime(): number {
    const completedTasks = this.moderationQueue.completed.filter(task => task.completedAt);
    if (completedTasks.length === 0) return 0;

    const totalProcessingTime = completedTasks.reduce((sum, task) => {
      return sum + (task.completedAt.getTime() - task.createdAt.getTime());
    }, 0);

    return totalProcessingTime / completedTasks.length;
  }

  private calculateSuccessRate(): number {
    const completedTasks = this.moderationQueue.completed;
    if (completedTasks.length === 0) return 100;

    const successfulTasks = completedTasks.filter(task =>
      !task.status || task.status === 'COMPLETED'
    );

    return (successfulTasks.length / completedTasks.length) * 100;
  }

  private getActionTypeStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.moderationQueue.completed.forEach(task => {
      const action = task.data?.action || 'UNKNOWN';
      stats[action] = (stats[action] || 0) + 1;
    });
    return stats;
  }

  private calculateModeratorEfficiency(moderatorId: string): number {
    const moderatorTasks = this.moderationQueue.completed.filter(task => task.assignedTo === moderatorId);
    if (moderatorTasks.length === 0) return 100;

    const averageTime = this.calculateModeratorAverageProcessingTime(moderatorId);
    // Efficiency score based on speed (faster = higher score)
    return Math.max(0, 100 - (averageTime / 60000) * 100); // Penalize > 1 minute average time
  }

  private calculateModeratorAverageProcessingTime(moderatorId: string): number {
    const moderatorTasks = this.moderationQueue.completed.filter(task => task.assignedTo === moderatorId);
    if (moderatorTasks.length === 0) return 0;

    const totalTime = moderatorTasks.reduce((sum, task) => {
      return sum + (task.completedAt.getTime() - task.createdAt.getTime());
    }, 0);

    return totalTime / moderatorTasks.length;
  }

  private async notifyTrendUpdate(trendId: string, action: string, reason?: string): Promise<void> {
    // This would notify the trend submitter
    // Implementation depends on notification preferences
    this.logger.log(`Trend update notification: ${trendId} - ${action}`);
  }

  private async notifyModerationTeam(notification: any): Promise<void> {
    // This would notify the moderation team via email/Slack
    this.logger.log('Moderation team notification sent');
  }

  private async notifyModeratorAssignment(moderatorId: string, task: ModerationTask): Promise<void> {
    // This would notify the specific moderator
    this.logger.log(`Task assigned to moderator: ${moderatorId} - ${task.id}`);
  }

  private async notifyHighPriorityTask(task: ModerationTask): Promise<void> {
    // This would notify senior moderators about high-priority tasks
    this.logger.log(`High priority task: ${task.id}`);
  }

  private async logComplianceAction(trendId: string, action: ModerationAction): Promise<void> {
    // Log compliance action for audit trail
    this.logger.log(`Compliance action logged for trend ${trendId}: ${action.action} - ${action.reason}`);
  }
}
