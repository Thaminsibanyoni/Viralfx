import { 
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
  ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { Permissions } from '../decorators/permissions.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationManagementService } from '../services/notification-management.service';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('Notification Management')
@Controller('admin/notifications')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class NotificationManagementController {
  private readonly logger = new Logger(NotificationManagementController.name);

  constructor(
    private readonly notificationManagementService: NotificationManagementService,
        private prisma: PrismaService) {}

  @Post('broadcast')
  @Permissions('notifications:send')
  @ApiOperation({ summary: 'Send broadcast notification to all users' })
  @ApiResponse({ status: 201, description: 'Broadcast notification sent successfully' })
  async broadcastNotification(
    @Body() notificationData: any,
    @Req() req: any) {
    const result = await this.notificationManagementService.broadcastNotification(
      notificationData,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.HIGH,
      targetType: 'Notification',
      targetId: result.id,
      metadata: {
        type: 'broadcast',
        recipientCount: result.recipientCount,
        channels: notificationData.channels
      },
      description: `Sent broadcast notification to ${result.recipientCount} users`
    });

    this.logger.log(`Broadcast notification sent by admin ${req.admin.id}: ${result.id}`);

    return result;
  }

  @Post('segment')
  @Permissions('notifications:send')
  @ApiOperation({ summary: 'Send notification to user segment' })
  @ApiResponse({ status: 201, description: 'Segment notification sent successfully' })
  async sendToSegment(
    @Body() data: {
      segment: any;
      notification: any;
    },
    @Req() req: any) {
    const result = await this.notificationManagementService.sendToSegment(
      data.segment,
      data.notification,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.HIGH,
      targetType: 'Notification',
      targetId: result.id,
      metadata: {
        type: 'segment',
        segment: data.segment,
        recipientCount: result.recipientCount,
        channels: data.notification.channels
      },
      description: `Sent notification to segment: ${JSON.stringify(data.segment)}`
    });

    this.logger.log(`Segment notification sent by admin ${req.admin.id}: ${result.id}`);

    return result;
  }

  @Post('user/:userId')
  @Permissions('notifications:send')
  @ApiOperation({ summary: 'Send notification to specific user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 201, description: 'User notification sent successfully' })
  async sendToUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() notificationData: any,
    @Req() req: any) {
    const result = await this.notificationManagementService.sendToUser(
      userId,
      notificationData,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'Notification',
      targetId: result.id,
      metadata: {
        type: 'user',
        userId,
        channels: notificationData.channels
      },
      description: `Sent notification to user: ${userId}`
    });

    this.logger.log(`User notification sent by admin ${req.admin.id}: ${result.id} to user ${userId}`);

    return result;
  }

  @Get('templates')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get notification templates' })
  @ApiResponse({ status: 200, description: 'Notification templates retrieved successfully' })
  async getNotificationTemplates(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('category') category?: string,
    @Query('search') search?: string) {
    return await this.notificationManagementService.getTemplates({
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      search
    });
  }

  @Post('templates')
  @Permissions('notifications:*')
  @ApiOperation({ summary: 'Create new notification template' })
  @ApiResponse({ status: 201, description: 'Notification template created successfully' })
  async createTemplate(
    @Body() templateData: any,
    @Req() req: any) {
    const result = await this.notificationManagementService.createTemplate(
      templateData,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.LOW,
      targetType: 'NotificationTemplate',
      targetId: result.id,
      metadata: { templateName: templateData.name },
      description: `Created notification template: ${templateData.name}`
    });

    this.logger.log(`Notification template created by admin ${req.admin.id}: ${templateData.name}`);

    return result;
  }

  @Put('templates/:id')
  @Permissions('notifications:*')
  @ApiOperation({ summary: 'Update notification template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Notification template updated successfully' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() templateData: any,
    @Req() req: any) {
    const result = await this.notificationManagementService.updateTemplate(
      id,
      templateData,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.LOW,
      targetType: 'NotificationTemplate',
      targetId: id,
      metadata: { templateName: templateData.name },
      description: `Updated notification template: ${templateData.name}`
    });

    this.logger.log(`Notification template updated by admin ${req.admin.id}: ${id}`);

    return result;
  }

  @Delete('templates/:id')
  @Permissions('notifications:*')
  @ApiOperation({ summary: 'Delete notification template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Notification template deleted successfully' })
  async deleteTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any) {
    const template = await this.notificationManagementService.getTemplateById(id);

    await this.notificationManagementService.deleteTemplate(id, req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.LOW,
      targetType: 'NotificationTemplate',
      targetId: id,
      metadata: { templateName: template.name },
      description: `Deleted notification template: ${template.name}`
    });

    this.logger.log(`Notification template deleted by admin ${req.admin.id}: ${id}`);

    return { success: true, message: 'Template deleted successfully' };
  }

  @Get('templates/:id')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get notification template by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Notification template retrieved successfully' })
  async getTemplateById(
    @Param('id', ParseUUIDPipe) id: string) {
    return await this.notificationManagementService.getTemplateById(id);
  }

  @Post('templates/:id/duplicate')
  @Permissions('notifications:*')
  @ApiOperation({ summary: 'Duplicate notification template' })
  @ApiParam({ name: 'id', description: 'Template ID to duplicate' })
  @ApiResponse({ status: 201, description: 'Notification template duplicated successfully' })
  async duplicateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('name') name: string,
    @Req() req: any) {
    const result = await this.notificationManagementService.duplicateTemplate(
      id,
      name,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.LOW,
      targetType: 'NotificationTemplate',
      targetId: result.id,
      metadata: {
        originalTemplateId: id,
        templateName: name
      },
      description: `Duplicated notification template: ${name}`
    });

    this.logger.log(`Notification template duplicated by admin ${req.admin.id}: ${name}`);

    return result;
  }

  @Get('history')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get notification history' })
  @ApiResponse({ status: 200, description: 'Notification history retrieved successfully' })
  async getNotificationHistory(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string) {
    return await this.notificationManagementService.getNotificationHistory({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      channel,
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }

  @Get('history/:id')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get notification details by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification details retrieved successfully' })
  async getNotificationById(
    @Param('id', ParseUUIDPipe) id: string) {
    return await this.notificationManagementService.getNotificationById(id);
  }

  @Get('analytics')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get notification analytics' })
  @ApiResponse({ status: 200, description: 'Notification analytics retrieved successfully' })
  async getNotificationAnalytics(
    @Query('timeframe') timeframe: string = '30d',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string) {
    return await this.notificationManagementService.getAnalytics({
      timeframe,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }

  @Post('test')
  @Permissions('notifications:send')
  @ApiOperation({ summary: 'Send test notification' })
  @ApiResponse({ status: 201, description: 'Test notification sent successfully' })
  async sendTestNotification(
    @Body() testData: {
      channels: string[];
      templateId?: string;
      customMessage?: string;
      recipientEmail?: string;
    },
    @Req() req: any) {
    const result = await this.notificationManagementService.sendTestNotification(
      testData,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.LOW,
      targetType: 'Notification',
      targetId: result.id,
      metadata: {
        type: 'test',
        channels: testData.channels,
        templateId: testData.templateId
      },
      description: `Sent test notification`
    });

    this.logger.log(`Test notification sent by admin ${req.admin.id}: ${result.id}`);

    return result;
  }

  @Get('segments')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get available user segments' })
  @ApiResponse({ status: 200, description: 'User segments retrieved successfully' })
  async getUserSegments() {
    return await this.notificationManagementService.getUserSegments();
  }

  @Get('segments/:id/count')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get user count for segment' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Segment user count retrieved successfully' })
  async getSegmentUserCount(
    @Param('id') id: string,
    @Query() segmentFilters: any) {
    return await this.notificationManagementService.getSegmentUserCount(id, segmentFilters);
  }

  @Post('preview')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Preview notification with template variables' })
  @ApiResponse({ status: 200, description: 'Notification preview generated successfully' })
  async previewNotification(
    @Body() previewData: {
      templateId?: string;
      customMessage?: string;
      variables?: Record<string, any>;
      channels: string[];
    }) {
    return await this.notificationManagementService.previewNotification(previewData);
  }

  @Get('delivery-status/:notificationId')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get delivery status for notification' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Delivery status retrieved successfully' })
  async getDeliveryStatus(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50') {
    return await this.notificationManagementService.getDeliveryStatus(
      notificationId,
      parseInt(page),
      parseInt(limit));
  }

  @Post('resend/:notificationId')
  @Permissions('notifications:send')
  @ApiOperation({ summary: 'Resend failed notification deliveries' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification resend initiated successfully' })
  async resendFailedNotifications(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Req() req: any) {
    const result = await this.notificationManagementService.resendFailedNotifications(
      notificationId,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'Notification',
      targetId: notificationId,
      metadata: {
        type: 'resend',
        resentCount: result.resentCount
      },
      description: `Resent ${result.resentCount} failed notifications`
    });

    this.logger.log(`Failed notifications resent by admin ${req.admin.id}: ${notificationId}`);

    return result;
  }

  @Get('stats')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({ status: 200, description: 'Notification statistics retrieved successfully' })
  async getNotificationStats(
    @Query('timeframe') timeframe: string = '30d') {
    return await this.notificationManagementService.getNotificationStats(timeframe);
  }

  @Post('schedule')
  @Permissions('notifications:send')
  @ApiOperation({ summary: 'Schedule notification for later delivery' })
  @ApiResponse({ status: 201, description: 'Notification scheduled successfully' })
  async scheduleNotification(
    @Body() scheduleData: {
      notification: any;
      scheduledFor: string;
      timezone?: string;
      segment?: any;
      userId?: string;
    },
    @Req() req: any) {
    const result = await this.notificationManagementService.scheduleNotification(
      scheduleData,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'Notification',
      targetId: result.id,
      metadata: {
        type: 'scheduled',
        scheduledFor: scheduleData.scheduledFor,
        timezone: scheduleData.timezone
      },
      description: `Scheduled notification for ${scheduleData.scheduledFor}`
    });

    this.logger.log(`Notification scheduled by admin ${req.admin.id}: ${result.id}`);

    return result;
  }

  @Get('scheduled')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get scheduled notifications' })
  @ApiResponse({ status: 200, description: 'Scheduled notifications retrieved successfully' })
  async getScheduledNotifications(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string) {
    return await this.notificationManagementService.getScheduledNotifications({
      page: parseInt(page),
      limit: parseInt(limit),
      status
    });
  }

  @Put('scheduled/:id/cancel')
  @Permissions('notifications:*')
  @ApiOperation({ summary: 'Cancel scheduled notification' })
  @ApiParam({ name: 'id', description: 'Scheduled notification ID' })
  @ApiResponse({ status: 200, description: 'Scheduled notification cancelled successfully' })
  async cancelScheduledNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any) {
    const result = await this.notificationManagementService.cancelScheduledNotification(
      id,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'Notification',
      targetId: id,
      metadata: { type: 'cancelled' },
      description: `Cancelled scheduled notification: ${id}`
    });

    this.logger.log(`Scheduled notification cancelled by admin ${req.admin.id}: ${id}`);

    return result;
  }
}
