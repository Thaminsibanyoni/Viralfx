import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TopicStatus } from '@prisma/client';

/**
 * Trend Approval Service
 *
 * Manages the admin workflow for approving/rejecting auto-generated trends
 * from free API sources before they become visible to users.
 */

interface PendingTrend {
  id: string;
  name: string;
  source: string;
  category: string;
  region: string;
  vpmxScore: number;
  engagementScore: number;
  fetchedAt: Date;
  metadata?: any;
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  todayApproved: number;
  todayRejected: number;
  thisWeekApproved: number;
}

@Injectable()
export class TrendApprovalService {
  private readonly logger = new Logger(TrendApprovalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all pending trends awaiting approval
   */
  async getPendingTrends(limit: number = 50): Promise<PendingTrend[]> {
    try {
      const trends = await this.prisma.topic.findMany({
        where: {
          status: TopicStatus.PAUSED,
          metadata: {
            path: ['requiresApproval'],
            equals: true
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });

      return trends.map(trend => this.mapToPendingTrend(trend));
    } catch (error) {
      this.logger.error('Failed to fetch pending trends:', error);
      throw error;
    }
  }

  /**
   * Approve a trend (makes it active)
   */
  async approveTrend(topicId: string, adminId: string): Promise<any> {
    try {
      // Get the trend
      const trend = await this.prisma.topic.findUnique({
        where: { id: topicId }
      });

      if (!trend) {
        throw new Error('Trend not found');
      }

      // Update to ACTIVE
      const updated = await this.prisma.topic.update({
        where: { id: topicId },
        data: {
          status: TopicStatus.ACTIVE,
          isVerified: true,
          metadata: {
            ...(trend.metadata as any),
            approvedBy: adminId,
            approvedAt: new Date().toISOString(),
            requiresApproval: false
          }
        }
      });

      this.logger.log(`✅ Trend approved: ${updated.name} by admin ${adminId}`);

      return {
        success: true,
        trend: updated,
        message: 'Trend approved successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to approve trend ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Reject a trend (deletes or archives it)
   */
  async rejectTrend(topicId: string, adminId: string, reason?: string): Promise<any> {
    try {
      // Instead of deleting, we'll mark it as ARCHIVED with rejection reason
      const trend = await this.prisma.topic.update({
        where: { id: topicId },
        data: {
          status: TopicStatus.ARCHIVED,
          metadata: {
            rejectedBy: adminId,
            rejectedAt: new Date().toISOString(),
            rejectionReason: reason || 'No reason provided',
            requiresApproval: false
          }
        }
      });

      this.logger.log(`❌ Trend rejected: ${trend.name} by admin ${adminId}. Reason: ${reason}`);

      return {
        success: true,
        trend,
        message: 'Trend rejected successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to reject trend ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk approve multiple trends
   */
  async bulkApprove(topicIds: string[], adminId: string): Promise<any> {
    const results = {
      successful: [] as string[],
      failed: [] as { id: string; error: string }[]
    };

    for (const topicId of topicIds) {
      try {
        await this.approveTrend(topicId, adminId);
        results.successful.push(topicId);
      } catch (error) {
        results.failed.push({
          id: topicId,
          error: error.message
        });
      }
    }

    this.logger.log(`📊 Bulk approval: ${results.successful.length} approved, ${results.failed.length} failed`);

    return results;
  }

  /**
   * Bulk reject multiple trends
   */
  async bulkReject(topicIds: string[], adminId: string, reason?: string): Promise<any> {
    const results = {
      successful: [] as string[],
      failed: [] as { id: string; error: string }[]
    };

    for (const topicId of topicIds) {
      try {
        await this.rejectTrend(topicId, adminId, reason);
        results.successful.push(topicId);
      } catch (error) {
        results.failed.push({
          id: topicId,
          error: error.message
        });
      }
    }

    this.logger.log(`📊 Bulk rejection: ${results.successful.length} rejected, ${results.failed.length} failed`);

    return results;
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(): Promise<ApprovalStats> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const startOfWeek = new Date(now.setDate(now.getDate() - 7));

      const [pending, approved, rejected, todayApproved, todayRejected, thisWeekApproved] = await Promise.all([
        this.prisma.topic.count({
          where: {
            status: TopicStatus.PAUSED,
            metadata: { path: ['requiresApproval'], equals: true }
          }
        }),
        this.prisma.topic.count({
          where: {
            status: TopicStatus.ACTIVE,
            metadata: { path: ['approvedBy'], equals: undefined } // Has been approved
          }
        }),
        this.prisma.topic.count({
          where: {
            status: TopicStatus.ARCHIVED,
            metadata: { path: ['rejectedBy'], exists: true }
          }
        }),
        this.prisma.topic.count({
          where: {
            status: TopicStatus.ACTIVE,
            metadata: {
              path: ['approvedAt'],
              gte: startOfDay.toISOString()
            }
          }
        }),
        this.prisma.topic.count({
          where: {
            status: TopicStatus.ARCHIVED,
            metadata: {
              path: ['rejectedAt'],
              gte: startOfDay.toISOString()
            }
          }
        }),
        this.prisma.topic.count({
          where: {
            status: TopicStatus.ACTIVE,
            metadata: {
              path: ['approvedAt'],
              gte: startOfWeek.toISOString()
            }
          }
        })
      ]);

      return {
        pending,
        approved,
        rejected,
        todayApproved,
        todayRejected,
        thisWeekApproved
      };
    } catch (error) {
      this.logger.error('Failed to fetch approval stats:', error);
      throw error;
    }
  }

  /**
   * Get trends by source
   */
  async getTrendsBySource(source: string, status: TopicStatus = TopicStatus.PAUSED) {
    try {
      const trends = await this.prisma.topic.findMany({
        where: {
          status,
          metadata: {
            path: ['source'],
            equals: source
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      return trends.map(trend => this.mapToPendingTrend(trend));
    } catch (error) {
      this.logger.error(`Failed to fetch trends from source ${source}:`, error);
      throw error;
    }
  }

  /**
   * Search trends by keyword
   */
  async searchTrends(query: string, status: TopicStatus = TopicStatus.PAUSED) {
    try {
      const trends = await this.prisma.topic.findMany({
        where: {
          status,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      return trends.map(trend => this.mapToPendingTrend(trend));
    } catch (error) {
      this.logger.error(`Failed to search trends with query "${query}":`, error);
      throw error;
    }
  }

  /**
   * Get trend approval history
   */
  async getApprovalHistory(limit: number = 50) {
    try {
      const trends = await this.prisma.topic.findMany({
        where: {
          OR: [
            { metadata: { path: ['approvedAt'], exists: true } },
            { metadata: { path: ['rejectedAt'], exists: true } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return trends.map(trend => ({
        id: trend.id,
        name: trend.name,
        category: trend.category,
        status: trend.status,
        approvedBy: (trend.metadata as any)?.approvedBy,
        approvedAt: (trend.metadata as any)?.approvedAt,
        rejectedBy: (trend.metadata as any)?.rejectedBy,
        rejectedAt: (trend.metadata as any)?.rejectedAt,
        rejectionReason: (trend.metadata as any)?.rejectionReason
      }));
    } catch (error) {
      this.logger.error('Failed to fetch approval history:', error);
      throw error;
    }
  }

  /**
   * Map Topic entity to PendingTrend DTO
   */
  private mapToPendingTrend(trend: any): PendingTrend {
    const metadata = trend.metadata as any;

    return {
      id: trend.id,
      name: trend.name,
      source: metadata?.source || 'unknown',
      category: trend.category,
      region: trend.region || 'GLOBAL',
      vpmxScore: metadata?.vpmxScore || 0,
      engagementScore: metadata?.engagementScore || 0,
      fetchedAt: trend.createdAt,
      metadata
    };
  }
}
