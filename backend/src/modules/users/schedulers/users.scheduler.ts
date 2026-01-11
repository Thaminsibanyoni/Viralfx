import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from "../../../prisma/prisma.service";
import { UsersService } from '../services/users.service';

@Injectable()
export class UsersScheduler {
  private readonly logger = new Logger(UsersScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService
  ) {}

  @Cron('0 2 * * *') // Daily at 2 AM
  async cleanupInactiveUsers(): Promise<void> {
    this.logger.log('Starting inactive users cleanup');
    try {
      // Find users inactive for more than 365 days
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const inactiveUsers = await this.prisma.user.findMany({
        where: {
          isActive: true,
          lastLoginAt: {
            lt: oneYearAgo
          }
        }
      });

      for (const user of inactiveUsers) {
        try {
          // Deactivate inactive users
          await this.usersService.deactivateUser(user.id);
          this.logger.log(`Deactivated inactive user: ${user.email}`);
        } catch (error) {
          this.logger.error(`Failed to deactivate user ${user.id}:`, error);
          continue;
        }
      }

      this.logger.log(`Deactivated ${inactiveUsers.length} inactive users`);
    } catch (error) {
      this.logger.error('Failed to cleanup inactive users:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateUserStatistics(): Promise<void> {
    this.logger.log('Starting daily user statistics update');
    try {
      // Update daily active users count
      const activeUsersCount = await this.prisma.user.count({
        where: {
          isActive: true
        }
      });

      // Update users who logged in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dailyActiveUsers = await this.prisma.user.count({
        where: {
          lastLoginAt: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      // Store daily statistics
      await this.prisma.userStatistics.create({
        data: {
          date: today,
          totalUsers: activeUsersCount,
          dailyActiveUsers,
          newUsers: await this.getNewUsersCount(today, tomorrow)
        }
      });

      this.logger.log(`Updated user statistics: ${activeUsersCount} total, ${dailyActiveUsers} daily active`);
    } catch (error) {
      this.logger.error('Failed to update user statistics:', error);
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async sendUserDigests(): Promise<void> {
    this.logger.log('Starting weekly user digest sending');
    try {
      // Get users who have opted in for weekly digests
      const usersNeedingDigest = await this.prisma.user.findMany({
        where: {
          isActive: true,
          preferences: {
            path: ['emailDigest'],
            equals: 'weekly'
          }
        }
      });

      for (const user of usersNeedingDigest) {
        try {
          // Send weekly digest notification
          await this.prisma.notification.create({
            data: {
              userId: user.id,
              type: 'WEEKLY_DIGEST',
              title: 'Your Weekly Activity Summary',
              message: 'Here\'s your weekly activity summary and platform updates.',
              metadata: {
                digestType: 'weekly',
                generatedAt: new Date().toISOString()
              },
              status: 'PENDING'
            }
          });
        } catch (error) {
          this.logger.error(`Failed to create digest notification for user ${user.id}:`, error);
          continue;
        }
      }

      this.logger.log(`Created ${usersNeedingDigest.length} weekly digest notifications`);
    } catch (error) {
      this.logger.error('Failed to send user digests:', error);
    }
  }

  @Cron('0 0 1 * *') // Monthly on the 1st at midnight
  async updateSubscriptionStatus(): Promise<void> {
    this.logger.log('Starting monthly subscription status update');
    try {
      // Update subscription status for all users
      const users = await this.prisma.user.findMany({
        where: {
          isActive: true
        }
      });

      for (const user of users) {
        try {
          await this.usersService.updateSubscriptionStatus(user.id);
        } catch (error) {
          this.logger.error(`Failed to update subscription status for user ${user.id}:`, error);
          continue;
        }
      }

      this.logger.log(`Updated subscription status for ${users.length} users`);
    } catch (error) {
      this.logger.error('Failed to update subscription status:', error);
    }
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async updateUserRiskScores(): Promise<void> {
    this.logger.log('Starting user risk score updates');
    try {
      // Get users with recent activity
      const activeUsers = await this.prisma.user.findMany({
        where: {
          isActive: true,
          lastLoginAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      for (const user of activeUsers) {
        try {
          await this.usersService.updateRiskScore(user.id);
        } catch (error) {
          this.logger.error(`Failed to update risk score for user ${user.id}:`, error);
          continue;
        }
      }

      this.logger.log(`Updated risk scores for ${activeUsers.length} users`);
    } catch (error) {
      this.logger.error('Failed to update user risk scores:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredSessions(): Promise<void> {
    this.logger.log('Starting expired sessions cleanup');
    try {
      // Clean up expired user sessions
      const result = await this.prisma.userSession.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      this.logger.log(`Cleaned up ${result.count} expired user sessions`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions:', error);
    }
  }

  @Cron('0 0 * * 0') // Weekly on Sunday at midnight
  async generateUserReports(): Promise<void> {
    this.logger.log('Starting weekly user reports generation');
    try {
      // Generate user engagement reports
      const report = await this.usersService.generateEngagementReport();

      // Store report
      await this.prisma.userReport.create({
        data: {
          reportType: 'WEEKLY_ENGAGEMENT',
          data: report,
          generatedAt: new Date()
        }
      });

      this.logger.log('Generated weekly user engagement report');
    } catch (error) {
      this.logger.error('Failed to generate user reports:', error);
    }
  }

  @Cron('*/10 * * * *') // Every 10 minutes
  async processUserVerificationQueue(): Promise<void> {
    this.logger.debug('Processing user verification queue');
    try {
      // Get pending KYC verifications
      const pendingVerifications = await this.prisma.kYCDocument.findMany({
        where: {
          status: 'PENDING',
          submittedAt: {
            lt: new Date(Date.now() - 5 * 60 * 1000) // At least 5 minutes old
          }
        },
        take: 10 // Process in batches
      });

      for (const verification of pendingVerifications) {
        try {
          // Add to processing queue
          await this.prisma.notification.create({
            data: {
              userId: verification.userId,
              type: 'VERIFICATION_UPDATE',
              title: 'KYC Verification Under Review',
              message: 'Your KYC documents are being reviewed. You will be notified once the process is complete.',
              metadata: {
                verificationId: verification.id,
                status: 'PENDING'
              }
            }
          });

          // Mark as processing
          await this.prisma.kYCDocument.update({
            where: { id: verification.id },
            data: { status: 'PROCESSING' }
          });
        } catch (error) {
          this.logger.error(`Failed to process verification ${verification.id}:`, error);
          continue;
        }
      }

      if (pendingVerifications.length > 0) {
        this.logger.log(`Processed ${pendingVerifications.length} user verifications`);
      }
    } catch (error) {
      this.logger.error('Failed to process user verification queue:', error);
    }
  }

  private async getNewUsersCount(startDate: Date, endDate: Date): Promise<number> {
    try {
      return await this.prisma.user.count({
        where: {
          createdAt: {
            gte: startDate,
            lt: endDate
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to get new users count:', error);
      return 0;
    }
  }
}