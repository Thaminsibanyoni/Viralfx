import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { AdminWebSocketService } from './admin-websocket.service';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class NotificationManagementService {
  private readonly logger = new Logger(NotificationManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly adminWebSocketService: AdminWebSocketService,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  async broadcastNotification(notificationData: any, adminId: string) {
    // Validate notification data
    const validatedData = this.validateNotificationData(notificationData);

    // Create notification record
    const notification = await this.prisma.adminNotification.create({
      data: {
        type: 'BROADCAST',
        title: validatedData.title,
        message: validatedData.message,
        category: validatedData.category || 'system',
        priority: validatedData.priority || 'medium',
        channels: validatedData.channels,
        metadata: {
          ...validatedData.metadata,
          createdBy: adminId,
          createdAt: new Date().toISOString(),
        },
        status: 'PENDING',
        scheduledFor: null,
        createdBy: adminId,
      },
    });

    // Get total active users count
    const recipientCount = await this.prisma.user.count({
      where: {
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

    // Queue notification for processing
    await this.notificationQueue.add('broadcast', {
      notificationId: notification.id,
      recipientType: 'all',
      channels: validatedData.channels,
      notificationData: validatedData,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    // Update notification with recipient count
    await this.prisma.adminNotification.update({
      where: { id: notification.id },
      data: {
        recipientCount,
        metadata: {
          ...notification.metadata,
          recipientCount,
        },
      },
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('admin:notification:broadcasted', {
      id: notification.id,
      title: validatedData.title,
      recipientCount,
      channels: validatedData.channels,
      sentBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Broadcast notification created by admin ${adminId}: ${notification.id}`);

    return {
      id: notification.id,
      title: validatedData.title,
      recipientCount,
      channels: validatedData.channels,
      status: 'PENDING',
    };
  }

  async sendToSegment(segment: any, notificationData: any, adminId: string) {
    // Validate segment data
    const validatedSegment = this.validateSegmentData(segment);
    const validatedNotification = this.validateNotificationData(notificationData);

    // Get filtered users count
    const recipientCount = await this.getSegmentUserCount('custom', validatedSegment.filters);

    // Create notification record
    const notification = await this.prisma.adminNotification.create({
      data: {
        type: 'SEGMENT',
        title: validatedNotification.title,
        message: validatedNotification.message,
        category: validatedNotification.category || 'system',
        priority: validatedNotification.priority || 'medium',
        channels: validatedNotification.channels,
        metadata: {
          ...validatedNotification.metadata,
          segment: validatedSegment,
          createdBy: adminId,
          createdAt: new Date().toISOString(),
        },
        status: 'PENDING',
        scheduledFor: null,
        createdBy: adminId,
        recipientCount,
      },
    });

    // Queue notification for processing
    await this.notificationQueue.add('segment', {
      notificationId: notification.id,
      segment: validatedSegment,
      channels: validatedNotification.channels,
      notificationData: validatedNotification,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('admin:notification:segment_sent', {
      id: notification.id,
      title: validatedNotification.title,
      segment: validatedSegment,
      recipientCount,
      channels: validatedNotification.channels,
      sentBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Segment notification created by admin ${adminId}: ${notification.id}`);

    return {
      id: notification.id,
      title: validatedNotification.title,
      segment: validatedSegment,
      recipientCount,
      channels: validatedNotification.channels,
      status: 'PENDING',
    };
  }

  async sendToUser(userId: string, notificationData: any, adminId: string) {
    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const validatedData = this.validateNotificationData(notificationData);

    // Create notification record
    const notification = await this.prisma.adminNotification.create({
      data: {
        type: 'USER',
        title: validatedData.title,
        message: validatedData.message,
        category: validatedData.category || 'system',
        priority: validatedData.priority || 'medium',
        channels: validatedData.channels,
        metadata: {
          ...validatedData.metadata,
          userId,
          createdBy: adminId,
          createdAt: new Date().toISOString(),
        },
        status: 'PENDING',
        scheduledFor: null,
        createdBy: adminId,
        recipientCount: 1,
      },
    });

    // Queue notification for processing
    await this.notificationQueue.add('user', {
      notificationId: notification.id,
      userId,
      channels: validatedData.channels,
      notificationData: validatedData,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('admin:notification:user_sent', {
      id: notification.id,
      title: validatedData.title,
      userId,
      channels: validatedData.channels,
      sentBy: adminId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`User notification created by admin ${adminId}: ${notification.id} to user ${userId}`);

    return {
      id: notification.id,
      title: validatedData.title,
      userId,
      channels: validatedData.channels,
      status: 'PENDING',
    };
  }

  async getTemplates(filters: {
    page: number;
    limit: number;
    category?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { subject: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await this.prisma.$transaction([
      this.prisma.notificationTemplate.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              adminNotifications: true,
            },
          },
        },
      }),
      this.prisma.notificationTemplate.count({ where }),
    ]);

    return {
      templates: templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        channels: template.channels,
        subject: template.subject,
        content: template.content,
        variables: template.variables,
        usageCount: template._count.adminNotifications,
        isActive: template.isActive,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }

  async getTemplateById(id: string) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            adminNotifications: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      channels: template.channels,
      subject: template.subject,
      content: template.content,
      variables: template.variables,
      usageCount: template._count.adminNotifications,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  async createTemplate(templateData: any, adminId: string) {
    const validatedData = this.validateTemplateData(templateData);

    const template = await this.prisma.notificationTemplate.create({
      data: {
        ...validatedData,
        isActive: true,
        createdBy: adminId,
      },
    });

    this.logger.log(`Notification template created by admin ${adminId}: ${template.name}`);

    return template;
  }

  async updateTemplate(id: string, templateData: any, adminId: string) {
    const validatedData = this.validateTemplateData(templateData);

    const existingTemplate = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      throw new NotFoundException('Notification template not found');
    }

    // Create version history
    await this.prisma.notificationTemplateVersion.create({
      data: {
        templateId: id,
        name: existingTemplate.name,
        subject: existingTemplate.subject,
        content: existingTemplate.content,
        variables: existingTemplate.variables,
        version: (existingTemplate.version || 0) + 1,
        createdBy: adminId,
      },
    });

    const updatedTemplate = await this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...validatedData,
        version: (existingTemplate.version || 0) + 1,
        updatedBy: adminId,
      },
    });

    this.logger.log(`Notification template updated by admin ${adminId}: ${id}`);

    return updatedTemplate;
  }

  async deleteTemplate(id: string, adminId: string) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    // Soft delete
    await this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        deletedBy: adminId,
      },
    });

    this.logger.log(`Notification template deleted by admin ${adminId}: ${id}`);
  }

  async duplicateTemplate(id: string, name: string, adminId: string) {
    const originalTemplate = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!originalTemplate) {
      throw new NotFoundException('Original template not found');
    }

    const duplicatedTemplate = await this.prisma.notificationTemplate.create({
      data: {
        name,
        description: `Duplicate of ${originalTemplate.name}`,
        category: originalTemplate.category,
        channels: originalTemplate.channels,
        subject: originalTemplate.subject,
        content: originalTemplate.content,
        variables: originalTemplate.variables,
        isActive: true,
        createdBy: adminId,
        metadata: {
          ...originalTemplate.metadata,
          duplicatedFrom: id,
        },
      },
    });

    this.logger.log(`Notification template duplicated by admin ${adminId}: ${name}`);

    return duplicatedTemplate;
  }

  async getNotificationHistory(filters: {
    page: number;
    limit: number;
    status?: string;
    channel?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.channel) {
      where.channels = {
        has: filters.channel,
      };
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.adminNotification.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              deliveryLogs: true,
            },
          },
        },
      }),
      this.prisma.adminNotification.count({ where }),
    ]);

    return {
      notifications: notifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        category: notification.category,
        priority: notification.priority,
        channels: notification.channels,
        status: notification.status,
        recipientCount: notification.recipientCount,
        sentCount: notification._count.deliveryLogs,
        scheduledFor: notification.scheduledFor,
        sentAt: notification.sentAt,
        createdAt: notification.createdAt,
        creator: notification.creator,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }

  async getNotificationById(id: string) {
    const notification = await this.prisma.adminNotification.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        deliveryLogs: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            deliveryLogs: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Calculate delivery statistics
    const deliveryStats = this.calculateDeliveryStats(notification.deliveryLogs);

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      category: notification.category,
      priority: notification.priority,
      channels: notification.channels,
      status: notification.status,
      recipientCount: notification.recipientCount,
      scheduledFor: notification.scheduledFor,
      sentAt: notification.sentAt,
      createdAt: notification.createdAt,
      creator: notification.creator,
      metadata: notification.metadata,
      deliveryStats,
      recentDeliveries: notification.deliveryLogs.slice(0, 20),
    };
  }

  async getAnalytics(filters: {
    timeframe?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const startDate = filters.startDate || new Date();
    const timeframes = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };

    if (filters.timeframe) {
      const days = timeframes[filters.timeframe] || 30;
      startDate.setDate(startDate.getDate() - days);
    } else {
      startDate.setDate(startDate.getDate() - 30);
    }

    const [
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      channelBreakdown,
      categoryBreakdown,
      dailyStats,
    ] = await Promise.all([
      this.prisma.adminNotification.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.notificationDeliveryLog.count({
        where: {
          notification: {
            createdAt: { gte: startDate },
          },
          status: 'DELIVERED',
        },
      }),
      this.prisma.notificationDeliveryLog.count({
        where: {
          notification: {
            createdAt: { gte: startDate },
          },
          openedAt: { not: null },
        },
      }),
      this.prisma.notificationDeliveryLog.count({
        where: {
          notification: {
            createdAt: { gte: startDate },
          },
          clickedAt: { not: null },
        },
      }),
      this.getChannelBreakdown(startDate),
      this.getCategoryBreakdown(startDate),
      this.getDailyStats(startDate),
    ]);

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
    const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;

    return {
      summary: {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        deliveryRate,
        openRate,
        clickRate,
      },
      breakdowns: {
        channels: channelBreakdown,
        categories: categoryBreakdown,
      },
      timeline: dailyStats,
      timeframe: filters.timeframe || '30d',
      startDate,
      endDate: new Date(),
    };
  }

  async sendTestNotification(testData: any, adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const notificationData = {
      title: testData.title || 'Test Notification',
      message: testData.customMessage || 'This is a test notification from the SuperAdmin panel.',
      category: 'test',
      priority: 'low',
      channels: testData.channels || ['email'],
    };

    // If using template, get and process it
    if (testData.templateId) {
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { id: testData.templateId },
      });

      if (template) {
        notificationData.title = template.subject;
        notificationData.message = this.processTemplateVariables(
          template.content,
          {
            userName: `${admin.firstName} ${admin.lastName}`,
            adminEmail: admin.email,
          }
        );
      }
    }

    // Create notification record
    const notification = await this.prisma.adminNotification.create({
      data: {
        type: 'TEST',
        title: notificationData.title,
        message: notificationData.message,
        category: 'test',
        priority: 'low',
        channels: notificationData.channels,
        metadata: {
          isTest: true,
          createdBy: adminId,
          createdAt: new Date().toISOString(),
        },
        status: 'PENDING',
        createdBy: adminId,
        recipientCount: 1,
      },
    });

    // Queue for immediate processing
    await this.notificationQueue.add('test', {
      notificationId: notification.id,
      adminId,
      adminEmail: testData.recipientEmail || admin.email,
      channels: notificationData.channels,
      notificationData,
    }, {
      attempts: 3,
      removeOnComplete: true,
    });

    this.logger.log(`Test notification sent by admin ${adminId}: ${notification.id}`);

    return {
      id: notification.id,
      title: notificationData.title,
      channels: notificationData.channels,
      recipient: testData.recipientEmail || admin.email,
      status: 'PENDING',
    };
  }

  async getUserSegments() {
    // Return predefined segments with user counts
    const segments = [
      {
        id: 'active_users',
        name: 'Active Users',
        description: 'Users with active status',
        filters: { status: 'ACTIVE' },
      },
      {
        id: 'verified_users',
        name: 'KYC Verified Users',
        description: 'Users with completed KYC',
        filters: { kycStatus: 'VERIFIED' },
      },
      {
        id: 'trading_users',
        name: 'Active Traders',
        description: 'Users who have placed bets',
        filters: { hasTraded: true },
      },
      {
        id: 'high_balance_users',
        name: 'High Balance Users',
        description: 'Users with balance above $1000',
        filters: { minBalance: 1000 },
      },
      {
        id: 'new_users',
        name: 'New Users (Last 30 days)',
        description: 'Users registered in last 30 days',
        filters: { registeredAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    ];

    // Get user counts for each segment
    const segmentsWithCounts = await Promise.all(
      segments.map(async (segment) => {
        const count = await this.getSegmentUserCount(segment.id, segment.filters);
        return { ...segment, userCount: count };
      })
    );

    return segmentsWithCounts;
  }

  async getSegmentUserCount(segmentId: string, filters: any) {
    const where: any = {};

    switch (segmentId) {
      case 'active_users':
        where.status = 'ACTIVE';
        break;
      case 'verified_users':
        where.kycStatus = 'VERIFIED';
        break;
      case 'trading_users':
        where.bets = {
          some: {}
        };
        break;
      case 'high_balance_users':
        where.balanceUsd = {
          gte: filters.minBalance || 1000,
        };
        break;
      case 'new_users':
        where.createdAt = {
          gte: filters.registeredAfter || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        };
        break;
      case 'custom':
        // Apply custom filters
        if (filters.status) where.status = filters.status;
        if (filters.kycStatus) where.kycStatus = filters.kycStatus;
        if (filters.minBalance) where.balanceUsd = { gte: filters.minBalance };
        if (filters.maxBalance) where.balanceUsd = { lte: filters.maxBalance };
        if (filters.country) where.country = filters.country;
        if (filters.minAge) {
          const minBirthDate = new Date();
          minBirthDate.setFullYear(minBirthDate.getFullYear() - filters.minAge);
          where.dateOfBirth = { lte: minBirthDate };
        }
        break;
    }

    return await this.prisma.user.count({ where });
  }

  async previewNotification(previewData: any) {
    let title = previewData.customMessage?.title || 'Notification Preview';
    let message = previewData.customMessage?.message || 'This is a preview of your notification.';

    // If using template, process with variables
    if (previewData.templateId) {
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { id: previewData.templateId },
      });

      if (template) {
        title = template.subject;
        message = this.processTemplateVariables(
          template.content,
          previewData.variables || {}
        );
      }
    }

    // Process variables in custom message
    if (previewData.customMessage && previewData.variables) {
      title = this.processTemplateVariables(title, previewData.variables);
      message = this.processTemplateVariables(message, previewData.variables);
    }

    return {
      title,
      message,
      channels: previewData.channels || ['email'],
      variables: previewData.variables || {},
    };
  }

  async getDeliveryStatus(notificationId: string, page: number, limit: number) {
    const [deliveryLogs, total] = await this.prisma.$transaction([
      this.prisma.notificationDeliveryLog.findMany({
        where: { notificationId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      }),
      this.prisma.notificationDeliveryLog.count({
        where: { notificationId },
      }),
    ]);

    return {
      deliveries: deliveryLogs.map(log => ({
        id: log.id,
        user: log.user,
        channel: log.channel,
        status: log.status,
        sentAt: log.sentAt,
        deliveredAt: log.deliveredAt,
        openedAt: log.openedAt,
        clickedAt: log.clickedAt,
        error: log.error,
        responseTime: log.responseTime,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async resendFailedNotifications(notificationId: string, adminId: string) {
    const failedDeliveries = await this.prisma.notificationDeliveryLog.findMany({
      where: {
        notificationId,
        status: 'FAILED',
      },
    });

    let resentCount = 0;

    for (const delivery of failedDeliveries) {
      try {
        // Reset delivery status and queue for retry
        await this.prisma.notificationDeliveryLog.update({
          where: { id: delivery.id },
          data: {
            status: 'PENDING',
            error: null,
            sentAt: null,
            deliveredAt: null,
          },
        });

        // Queue for resend
        await this.notificationQueue.add('resend', {
          deliveryId: delivery.id,
          userId: delivery.userId,
          notificationId,
        });

        resentCount++;
      } catch (error) {
        this.logger.error(`Failed to queue resend for delivery ${delivery.id}:`, error);
      }
    }

    this.logger.log(`Resent ${resentCount} failed notifications by admin ${adminId}`);

    return {
      notificationId,
      failedCount: failedDeliveries.length,
      resentCount,
      timestamp: new Date().toISOString(),
    };
  }

  async getNotificationStats(timeframe: string = '30d') {
    const startDate = new Date();
    const timeframes = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };

    const days = timeframes[timeframe] || 30;
    startDate.setDate(startDate.getDate() - days);

    const [totalNotifications, pendingNotifications, scheduledNotifications] = await Promise.all([
      this.prisma.adminNotification.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.adminNotification.count({
        where: {
          createdAt: { gte: startDate },
          status: 'PENDING',
        },
      }),
      this.prisma.adminNotification.count({
        where: {
          scheduledFor: {
            gte: new Date(),
          },
        },
      }),
    ]);

    return {
      timeframe,
      totalNotifications,
      pendingNotifications,
      scheduledNotifications,
      completedNotifications: totalNotifications - pendingNotifications,
    };
  }

  async scheduleNotification(scheduleData: any, adminId: string) {
    const scheduledFor = new Date(scheduleData.scheduledFor);

    if (scheduledFor <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    const validatedNotification = this.validateNotificationData(scheduleData.notification);

    const notification = await this.prisma.adminNotification.create({
      data: {
        type: scheduleData.userId ? 'USER' : scheduleData.segment ? 'SEGMENT' : 'BROADCAST',
        title: validatedNotification.title,
        message: validatedNotification.message,
        category: validatedNotification.category || 'system',
        priority: validatedNotification.priority || 'medium',
        channels: validatedNotification.channels,
        metadata: {
          ...validatedNotification.metadata,
          scheduled: true,
          timezone: scheduleData.timezone || 'UTC',
          createdBy: adminId,
        },
        status: 'SCHEDULED',
        scheduledFor,
        createdBy: adminId,
        recipientCount: scheduleData.userId ? 1 : await this.estimateRecipientCount(scheduleData),
      },
    });

    // Schedule the notification
    await this.notificationQueue.add(
      'scheduled',
      {
        notificationId: notification.id,
        scheduledData,
      },
      {
        delay: scheduledFor.getTime() - Date.now(),
        attempts: 3,
      }
    );

    this.logger.log(`Notification scheduled by admin ${adminId}: ${notification.id} for ${scheduledFor}`);

    return {
      id: notification.id,
      title: validatedNotification.title,
      scheduledFor,
      status: 'SCHEDULED',
    };
  }

  async getScheduledNotifications(filters: {
    page: number;
    limit: number;
    status?: string;
  }) {
    const where: any = {
      scheduledFor: { not: null },
    };

    if (filters.status) {
      where.status = filters.status;
    }

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.adminNotification.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { scheduledFor: 'asc' },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.adminNotification.count({ where }),
    ]);

    return {
      notifications: notifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        type: notification.type,
        scheduledFor: notification.scheduledFor,
        status: notification.status,
        recipientCount: notification.recipientCount,
        creator: notification.creator,
        createdAt: notification.createdAt,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }

  async cancelScheduledNotification(notificationId: string, adminId: string) {
    const notification = await this.prisma.adminNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Scheduled notification not found');
    }

    if (notification.status !== 'SCHEDULED') {
      throw new BadRequestException('Only scheduled notifications can be cancelled');
    }

    // Remove from queue
    const jobs = await this.notificationQueue.getJobs(['delayed'], 0, -1, true);
    for (const job of jobs) {
      if (job.data.notificationId === notificationId) {
        await job.remove();
      }
    }

    // Update status
    await this.prisma.adminNotification.update({
      where: { id: notificationId },
      data: {
        status: 'CANCELLED',
        metadata: {
          ...notification.metadata,
          cancelledBy: adminId,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Scheduled notification cancelled by admin ${adminId}: ${notificationId}`);

    return {
      notificationId,
      status: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
    };
  }

  // Helper methods
  private validateNotificationData(data: any) {
    if (!data.title || !data.message) {
      throw new BadRequestException('Title and message are required');
    }

    if (!data.channels || !Array.isArray(data.channels) || data.channels.length === 0) {
      throw new BadRequestException('At least one channel must be specified');
    }

    const validChannels = ['email', 'sms', 'push', 'in_app'];
    const invalidChannels = data.channels.filter(channel => !validChannels.includes(channel));

    if (invalidChannels.length > 0) {
      throw new BadRequestException(`Invalid channels: ${invalidChannels.join(', ')}`);
    }

    return {
      title: data.title,
      message: data.message,
      category: data.category || 'system',
      priority: data.priority || 'medium',
      channels: data.channels,
      metadata: data.metadata || {},
    };
  }

  private validateSegmentData(segment: any) {
    if (!segment.filters || typeof segment.filters !== 'object') {
      throw new BadRequestException('Segment filters are required');
    }

    return {
      name: segment.name || 'Custom Segment',
      description: segment.description || 'Custom user segment',
      filters: segment.filters,
    };
  }

  private validateTemplateData(data: any) {
    if (!data.name || !data.content) {
      throw new BadRequestException('Name and content are required');
    }

    const validChannels = ['email', 'sms', 'push', 'in_app'];
    if (data.channels) {
      const invalidChannels = data.channels.filter(channel => !validChannels.includes(channel));
      if (invalidChannels.length > 0) {
        throw new BadRequestException(`Invalid channels: ${invalidChannels.join(', ')}`);
      }
    }

    return {
      name: data.name,
      description: data.description || '',
      category: data.category || 'general',
      channels: data.channels || ['email'],
      subject: data.subject || data.name,
      content: data.content,
      variables: data.variables || [],
      metadata: data.metadata || {},
    };
  }

  private calculateDeliveryStats(deliveryLogs: any[]) {
    const stats = {
      total: deliveryLogs.length,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      pending: 0,
    };

    for (const log of deliveryLogs) {
      stats[log.status.toLowerCase()]++;
    }

    return {
      ...stats,
      deliveryRate: stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0,
      openRate: stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0,
      clickRate: stats.opened > 0 ? (stats.clicked / stats.opened) * 100 : 0,
    };
  }

  private async getChannelBreakdown(startDate: Date) {
    const deliveries = await this.prisma.notificationDeliveryLog.groupBy({
      by: ['channel'],
      where: {
        notification: {
          createdAt: { gte: startDate },
        },
      },
      _count: true,
    });

    return deliveries.map(d => ({
      channel: d.channel,
      count: d._count,
    }));
  }

  private async getCategoryBreakdown(startDate: Date) {
    const notifications = await this.prisma.adminNotification.groupBy({
      by: ['category'],
      where: {
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    return notifications.map(n => ({
      category: n.category,
      count: n._count,
    }));
  }

  private async getDailyStats(startDate: Date) {
    return await this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as sent,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'OPENED' THEN 1 ELSE 0 END) as opened
      FROM admin_notifications
      WHERE created_at >= ${startDate}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
      LIMIT 30
    `;
  }

  private processTemplateVariables(content: string, variables: Record<string, any>): string {
    let processedContent = content;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processedContent = processedContent.replace(regex, String(value));
    }

    return processedContent;
  }

  private async estimateRecipientCount(scheduleData: any): Promise<number> {
    if (scheduleData.userId) return 1;
    if (scheduleData.segment) {
      return await this.getSegmentUserCount('custom', scheduleData.segment.filters);
    }

    // Broadcast to all active users
    return await this.prisma.user.count({
      where: {
        status: 'ACTIVE',
        emailVerified: true,
      },
    });
  }
}