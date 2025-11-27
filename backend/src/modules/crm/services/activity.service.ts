import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Activity, ActivityStatus, ActivityType } from '../entities/activity.entity';
import { NotificationService } from '../../notifications/services/notification.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    private readonly notificationService: NotificationService,
    @InjectQueue('crm-tasks')
    private readonly crmQueue: Queue,
  ) {}

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
    },
  ) {
    const activity = this.activityRepository.create({
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
      attachments: activityData.attachments,
    });

    return await this.activityRepository.save(activity);
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
    const activity = this.activityRepository.create({
      ...activityData,
      entityType: activityData.entityType as any,
      status: ActivityStatus.SCHEDULED,
    });

    const savedActivity = await this.activityRepository.save(activity);

    // Schedule reminder notification
    if (activityData.scheduledAt) {
      const reminderTime = new Date(activityData.scheduledAt);
      reminderTime.setMinutes(reminderTime.getMinutes() - 15); // 15 minutes before

      if (reminderTime > new Date()) {
        await this.crmQueue.add(
          'send-activity-reminder',
          {
            activityId: savedActivity.id,
            scheduledAt: activityData.scheduledAt,
            assignedTo: activityData.assignedTo,
          },
          {
            delay: reminderTime.getTime() - Date.now(),
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
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
          scheduledFor: activityData.scheduledAt,
        },
        priority: 'MEDIUM',
      });
    }

    return savedActivity;
  }

  async completeActivity(id: string, outcome: string) {
    const activity = await this.activityRepository.findOne({
      where: { id },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    const completedAt = new Date();
    const duration = activity.scheduledAt
      ? Math.round((completedAt.getTime() - activity.scheduledAt.getTime()) / (1000 * 60))
      : null;

    await this.activityRepository.update(id, {
      status: ActivityStatus.COMPLETED,
      completedAt,
      duration,
      outcome,
    });

    return await this.activityRepository.findOne({ where: { id } });
  }

  async cancelActivity(id: string) {
    const activity = await this.activityRepository.findOne({
      where: { id },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    await this.activityRepository.update(id, {
      status: ActivityStatus.CANCELLED,
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
    },
  ) {
    const queryBuilder = this.activityRepository
      .createQueryBuilder('activity')
      .where('activity.entityType = :entityType', { entityType })
      .andWhere('activity.entityId = :entityId', { entityId });

    if (filters.type) {
      queryBuilder.andWhere('activity.type = :type', { type: filters.type });
    }

    if (filters.status) {
      queryBuilder.andWhere('activity.status = :status', { status: filters.status });
    }

    if (filters.dateRange) {
      queryBuilder.andWhere(
        'activity.createdAt BETWEEN :start AND :end',
        filters.dateRange
      );
    }

    queryBuilder.orderBy('activity.createdAt', 'DESC');

    if (filters.limit) {
      queryBuilder.take(filters.limit);
    }

    return await queryBuilder.getMany();
  }

  async getUpcomingActivities(assignedTo: string, days: number) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return await this.activityRepository.find({
      where: {
        assignedTo,
        status: ActivityStatus.SCHEDULED,
        scheduledAt: Between(new Date(), endDate),
      },
      order: {
        scheduledAt: 'ASC',
      },
    });
  }

  async getActivityStats(assignedTo: string, period: { start: Date; end: Date }) {
    const activities = await this.activityRepository.find({
      where: {
        assignedTo,
        createdAt: Between(period.start, period.end),
      },
    });

    const stats = {
      total: activities.length,
      byType: {} as Record<ActivityType, number>,
      byStatus: {} as Record<ActivityStatus, number>,
      completed: activities.filter(a => a.status === ActivityStatus.COMPLETED).length,
      scheduled: activities.filter(a => a.status === ActivityStatus.SCHEDULED).length,
      cancelled: activities.filter(a => a.status === ActivityStatus.CANCELLED).length,
      averageDuration: 0,
    };

    activities.forEach(activity => {
      stats.byType[activity.type] = (stats.byType[activity.type] || 0) + 1;
      stats.byStatus[activity.status] = (stats.byStatus[activity.status] || 0) + 1;
    });

    const completedWithDuration = activities.filter(
      a => a.status === ActivityStatus.COMPLETED && a.duration
    );

    if (completedWithDuration.length > 0) {
      stats.averageDuration = Math.round(
        completedWithDuration.reduce((sum, a) => sum + a.duration!, 0) / completedWithDuration.length
      );
    }

    return stats;
  }

  async sendReminders() {
    await this.crmQueue.add('send-follow-up-reminders', {}, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}