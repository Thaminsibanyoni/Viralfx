import { Injectable } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
// COMMENTED OUT (TypeORM entity deleted): import { ActivityStatus, ActivityType } from '../entities/activity.entity';
import { NotificationService } from "../../notifications/services/notification.service";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ActivityService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationService: NotificationService,
    @InjectQueue('crm-tasks')
    private readonly crmQueue: Queue) {}

  async logActivity(
    entityType: string,
    entityId: string,
    activityData: {
      type: string;
      subject: string;
      description: string;
      assignedTo?: string;
      scheduledAt?: Date;
      duration?: number;
      participants?: Array<{
        name: string;
        email: string;
        type: 'INTERNAL' | 'EXTERNAL';
      }>;
      attachments?: Array<{
        url: string;
        name: string;
        size: number;
        type: string;
      }>;
    }) {
    const activity = await this.prisma.activity.create({
      data: {
        entityType: entityType as any,
        entityId,
        type: activityData.type as any,
        subject: activityData.subject,
        description: activityData.description,
        status: activityData.scheduledAt
          ? ActivityStatus.SCHEDULED
          : ActivityStatus.COMPLETED,
        scheduledAt: activityData.scheduledAt,
        completedAt: activityData.scheduledAt ? null : new Date(),
        duration: activityData.duration,
        assignedTo: activityData.assignedTo,
        participants: activityData.participants,
        attachments: activityData.attachments
      }
    });

    return activity;
  }

  async scheduleActivity(activityData: {
    entityType: string;
    entityId: string;
    type: ActivityType;
    subject: string;
    description: string;
    scheduledAt: Date;
    duration?: number;
    assignedTo?: string;
    participants?: Array<{
      name: string;
      email: string;
      type: 'INTERNAL' | 'EXTERNAL';
    }>;
  }) {
    const activity = await this.prisma.activity.create({
      data: {
        ...activityData,
        entityType: activityData.entityType as any,
        status: ActivityStatus.SCHEDULED
      }
    });

    // Schedule reminder notification
    if (activityData.scheduledAt) {
      const reminderTime = new Date(activityData.scheduledAt);
      reminderTime.setMinutes(reminderTime.getMinutes() - 15); // 15 minutes before

      if (reminderTime > new Date()) {
        await this.crmQueue.add(
          'send-activity-reminder',
          {
            activityId: activity.id,
            scheduledAt: activityData.scheduledAt,
            assignedTo: activityData.assignedTo
          },
          {
            delay: reminderTime.getTime() - Date.now(),
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000
            }
          }
        );
      }
    }

    // Send immediate notification if assigned to someone
    if (activityData.assignedTo) {
      await this.notificationService.sendNotification({
        userId: activityData.assignedTo,
        type: 'activity_scheduled',
        channels: ['EMAIL', 'IN_APP'],
        data: {
          category: 'crm',
          activityType: activityData.type,
          activityTitle: activityData.subject,
          scheduledFor: activityData.scheduledAt
        },
        priority: 'MEDIUM'
      });
    }

    return activity;
  }

  async completeActivity(id: string, outcome: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id }
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    const completedAt = new Date();
    const duration = activity.scheduledAt
      ? Math.round((completedAt.getTime() - activity.scheduledAt.getTime()) / (1000 * 60))
      : null;

    await this.prisma.activity.update({
      where: { id },
      data: {
        status: ActivityStatus.COMPLETED,
        completedAt,
        duration,
        outcome
      }
    });

    return await this.prisma.activity.findFirst({ where: { id } });
  }

  async cancelActivity(id: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id }
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    await this.prisma.activity.update({
      where: { id },
      data: {
        status: ActivityStatus.CANCELLED
      }
    });

    // Cancel scheduled reminder job if exists
    // This would require tracking job IDs in the activity metadata

    return { success: true };
  }

  async getActivities(
    entityType: string,
    entityId: string,
    filters: {
      type?: ActivityType;
      status?: ActivityStatus;
      dateRange?: { start: Date; end: Date };
      limit?: number;
    }) {
    const where: any = {
      entityType: entityType as any,
      entityId
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.dateRange) {
      where.createdAt = {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end
      };
    }

    const activities = await this.prisma.activity.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: filters.limit
    });

    return activities;
  }

  async getUpcomingActivities(assignedTo: string, days: number) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return await this.prisma.activity.findMany({
      where: {
        assignedTo,
        status: ActivityStatus.SCHEDULED,
        scheduledAt: {
          gte: new Date(),
          lte: endDate
        }
      },
      orderBy: {
        scheduledAt: 'asc'
      }
    });
  }

  async getActivityStats(assignedTo: string, period: { start: Date; end: Date }) {
    const activities = await this.prisma.activity.findMany({
      where: {
        assignedTo,
        createdAt: {
          gte: period.start,
          lte: period.end
        }
      }
    });

    const stats = {
      total: activities.length,
      byType: {} as Record<ActivityType, number>,
      byStatus: {} as Record<ActivityStatus, number>,
      completed: activities.filter(a => a.status === ActivityStatus.COMPLETED).length,
      scheduled: activities.filter(a => a.status === ActivityStatus.SCHEDULED).length,
      cancelled: activities.filter(a => a.status === ActivityStatus.CANCELLED).length,
      averageDuration: 0
    };

    activities.forEach(activity => {
      stats.byType[activity.type as ActivityType] = (stats.byType[activity.type as ActivityType] || 0) + 1;
      stats.byStatus[activity.status as ActivityStatus] = (stats.byStatus[activity.status as ActivityStatus] || 0) + 1;
    });

    const completedWithDuration = activities.filter(
      a => a.status === ActivityStatus.COMPLETED && a.duration
    );

    if (completedWithDuration.length > 0) {
      stats.averageDuration = Math.round(
        completedWithDuration.reduce((sum, a) => sum + (a.duration || 0), 0) / completedWithDuration.length
      );
    }

    return stats;
  }

  async sendReminders() {
    await this.crmQueue.add('send-follow-up-reminders', {}, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }
}
