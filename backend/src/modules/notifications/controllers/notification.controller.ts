import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ValidationPipe,
  ParseUUIDPipe
} from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import {
  GetNotificationsDto,
  UpdatePreferencesDto,
  NotificationResponseDto,
  PaginatedNotificationResponseDto
} from '../dto/notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Get paginated notifications for the current user
   */
  @Get()
  async getNotifications(
    @Query() query: GetNotificationsDto,
    @CurrentUser() user: any): Promise<PaginatedNotificationResponseDto> {
    return this.notificationService.getNotifications(user.id, query);
  }

  /**
   * Get unread notification count
   */
  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser() user: any): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  /**
   * Get notification statistics
   */
  @Get('stats')
  async getStats(
    @CurrentUser() user: any): Promise<any> {
    return this.notificationService.getStats(user.id);
  }

  /**
   * Get user notification preferences
   */
  @Get('preferences')
  async getPreferences(
    @CurrentUser() user: any): Promise<any> {
    return this.notificationService.getPreferences(user.id);
  }

  /**
   * Update notification preferences
   */
  @Patch('preferences')
  async updatePreferences(
    @Body(ValidationPipe) updatePreferencesDto: UpdatePreferencesDto,
    @CurrentUser() user: any): Promise<any> {
    return this.notificationService.updatePreferences(user.id, updatePreferencesDto);
  }

  /**
   * Mark a notification as read
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any): Promise<NotificationResponseDto> {
    return this.notificationService.markAsRead(user.id, id);
  }

  /**
   * Mark all notifications as read
   */
  @Patch('read-all')
  async markAllAsRead(
    @CurrentUser() user: any): Promise<{ updated: number }> {
    const updated = await this.notificationService.markAllAsRead(user.id);
    return { updated };
  }

  /**
   * Delete a single notification
   */
  @Delete(':id')
  async deleteNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any): Promise<{ success: boolean }> {
    await this.notificationService.deleteNotification(user.id, id);
    return { success: true };
  }

  /**
   * Delete all notifications
   */
  @Delete()
  async clearAllNotifications(
    @CurrentUser() user: any): Promise<{ deleted: number }> {
    const deleted = await this.notificationService.clearAllNotifications(user.id);
    return { deleted };
  }

  /**
   * Send a test notification (for development/debugging)
   */
  @Post('test')
  async sendTestNotification(
    @Body() testNotification: any,
    @CurrentUser() user: any): Promise<{ success: boolean; id: string }> {
    const notification = await this.notificationService.createNotification({
      userId: user.id,
      type: testNotification.type || 'info',
      category: testNotification.category || 'system',
      priority: testNotification.priority || 'low',
      title: testNotification.title || 'Test Notification',
      message: testNotification.message || 'This is a test notification',
      actionUrl: testNotification.actionUrl,
      actionText: testNotification.actionText,
      metadata: testNotification.metadata || {}
    });

    return { success: true, id: notification.id };
  }

  /**
   * Broadcast notification to multiple users (admin only)
   */
  @Post('broadcast')
  async broadcastNotification(
    @Body() broadcastData: {
      userIds: string[];
      notification: any;
    },
    @CurrentUser() user: any): Promise<{ success: boolean; sent: number }> {
    // In a real implementation, you would check if user has admin privileges
    const sent = await this.notificationService.broadcastNotification(
      broadcastData.userIds,
      broadcastData.notification);
    return { success: true, sent };
  }
}
