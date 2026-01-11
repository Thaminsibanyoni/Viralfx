import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from "../../../prisma/prisma.service";
import { SendTimeOptimizerService } from '../services/send-time-optimizer.service';
// User entity import removed - using Prisma directly;

@Injectable()
export class SendTimeOptimizerScheduler {
  private readonly logger = new Logger(SendTimeOptimizerScheduler.name);

  constructor(
  private readonly prisma: PrismaService,
  private readonly sendTimeOptimizerService: SendTimeOptimizerService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async analyzeUserEngagementPatterns(): Promise<void> {
  this.logger.log('Starting hourly user engagement pattern analysis');
  try {
      // Get active users who have had notifications in the last 30 days
  const activeUsers = await this.prisma.user.findMany({
  where: {
  isActive: true,
  notifications: {
  some: {
  createdAt: {
  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  }
  }
  }
  },
  select: {
  id: true,
  timezone: true
  }
  });
  this.logger.log(`Analyzing engagement patterns for ${activeUsers.length} active users`);
  for (const user of activeUsers) {
  try {
  await this.sendTimeOptimizerService.analyzeUserEngagement(user.id);
        } catch (error) {
  this.logger.error(`Failed to analyze engagement for user ${user.id}:`, error);
  continue;
  }
  }
  this.logger.log('User engagement pattern analysis completed');
    } catch (error) {
  this.logger.error('Failed to analyze user engagement patterns:', error);
  }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateOptimalSendTimes(): Promise<void> {
  this.logger.log('Starting daily optimal send times update');
  try {
      // Update optimal send times for all users
  const updatedUsers = await this.sendTimeOptimizerService.updateAllUserOptimalTimes();
  this.logger.log(`Updated optimal send times for ${updatedUsers} users`);
    } catch (error) {
  this.logger.error('Failed to update optimal send times:', error);
  }
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async cleanupOldEngagementData(): Promise<void> {
  this.logger.log('Starting engagement data cleanup');
  try {
      // Clean up engagement data older than 90 days
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const result = await this.prisma.userEngagement.deleteMany({
  where: {
  timestamp: {
  lt: cutoffDate
  }
  }
  });
  this.logger.log(`Cleaned up ${result.count} old engagement records`);
    } catch (error) {
  this.logger.error('Failed to cleanup old engagement data:', error);
  }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async generateEngagementReports(): Promise<void> {
  this.logger.log('Starting weekly engagement report generation');
  try {
      // Generate weekly engagement reports
  const reports = await this.sendTimeOptimizerService.generateWeeklyEngagementReports();
  this.logger.log(`Generated ${reports.length} engagement reports`);
    } catch (error) {
  this.logger.error('Failed to generate engagement reports:', error);
  }
  }

  @Cron('*/30 * * * *') // Every 30 minutes
  async processPendingNotifications(): Promise<void> {
  this.logger.debug('Checking for pending notifications to optimize send times');
  try {
      // Find notifications that are pending and haven't been sent yet
  const pendingNotifications = await this.prisma.notification.findMany({
  where: {
  status: 'PENDING',
  scheduledAt: null
  },
  select: {
  id: true,
  userId: true
  }
  });
  if (pendingNotifications.length > 0) {
  this.logger.log(`Processing ${pendingNotifications.length} pending notifications`);
  for (const notification of pendingNotifications) {
  try {
  await this.sendTimeOptimizerService.scheduleNotificationForOptimalTime(notification.id);
          } catch (error) {
  this.logger.error(`Failed to schedule notification ${notification.id}:`, error);
  continue;
  }
  }
  }
    } catch (error) {
  this.logger.error('Failed to process pending notifications:', error);
  }
  }
}