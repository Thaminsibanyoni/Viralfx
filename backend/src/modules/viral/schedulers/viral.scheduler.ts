import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ViralIndexService } from '../services/viral-index.service';
import { ViralMetricsService } from '../services/viral-metrics.service';
import { ViralService } from '../services/viral.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ViralScheduler implements OnModuleInit {
  private readonly logger = new Logger(ViralScheduler.name);

  constructor(
    private readonly viralIndexService: ViralIndexService,
    private readonly viralMetricsService: ViralMetricsService,
    private readonly viralService: ViralService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.logger.log('Viral scheduler initialized');
  }

  // Update viral indices every hour
  @Cron('0 * * * *') // Every hour at minute 0
  async updateViralIndices(): Promise<void> {
    this.logger.log('Starting scheduled viral index updates');

    try {
      // Get all active topics
      const activeTopics = await this.prisma.topic.findMany({
        where: {
          isActive: true,
          lastViralAnalysis: {
            // Only update topics that haven't been analyzed in the last 30 minutes
            lt: new Date(Date.now() - 30 * 60 * 1000),
          },
        },
        select: { id: true, name: true },
        take: 100, // Limit to prevent overwhelming the system
      });

      if (activeTopics.length === 0) {
        this.logger.log('No topics requiring viral index updates');
        return;
      }

      this.logger.log(`Updating viral indices for ${activeTopics.length} topics`);

      // Process topics in batches
      const batchSize = 10;
      let processed = 0;

      for (let i = 0; i < activeTopics.length; i += batchSize) {
        const batch = activeTopics.slice(i, i + batchSize);

        const batchPromises = batch.map(async (topic) => {
          try {
            await this.viralIndexService.calculateTopicViralIndex(topic.id, 24);
            await this.viralService.updateViralMetrics(topic.id);
            processed++;
            return { topicId: topic.id, success: true };
          } catch (error) {
            this.logger.warn(`Failed to update viral index for topic ${topic.id}:`, error.message);
            return { topicId: topic.id, success: false, error: error.message };
          }
        });

        await Promise.all(batchPromises);

        // Small delay between batches
        if (i + batchSize < activeTopics.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.logger.log(`Viral index update completed: ${processed}/${activeTopics.length} topics updated`);
    } catch (error) {
      this.logger.error('Scheduled viral index update failed:', error);
    }
  }

  // Detect viral breakouts every 30 minutes
  @Cron('*/30 * * * *') // Every 30 minutes
  async detectViralBreakouts(): Promise<void> {
    this.logger.log('Starting viral breakout detection');

    try {
      // Check for recent content with high viral scores
      const recentBreakouts = await this.prisma.viralContent.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
          },
          viralScore: {
            gte: 0.85, // High viral score threshold
          },
          momentumScore: {
            gte: 0.7, // High momentum threshold
          },
        },
        include: {
          topic: {
            select: { name: true },
          },
        },
        orderBy: { viralScore: 'desc' },
        take: 20,
      });

      if (recentBreakouts.length > 0) {
        this.logger.warn(`DETECTED ${recentBreakouts.length} VIRAL BREAKOUTS`);

        // Process each breakout
        for (const breakout of recentBreakouts) {
          await this.handleViralBreakoutAlert(breakout);
        }
      }

      // Also check trending topics for sudden spikes
      const trendingTopics = await this.viralIndexService.getTrendingTopics(10, 1, 0.6);

      for (const topic of trendingTopics) {
        if (topic.momentum > 0.8 && topic.growth > 50) {
          this.logger.warn(`VIRAL MOMENTUM DETECTED - Topic: ${topic.topicName}, Growth: ${topic.growth}%`);
          await this.handleMomentumAlert(topic);
        }
      }

      this.logger.log(`Viral breakout detection completed: ${recentBreakouts.length} breakouts, ${trendingTopics.length} trending topics`);
    } catch (error) {
      this.logger.error('Viral breakout detection failed:', error);
    }
  }

  // Update viral metrics every 15 minutes
  @Cron('*/15 * * * *') // Every 15 minutes
  async updateViralMetrics(): Promise<void> {
    this.logger.log('Starting scheduled viral metrics update');

    try {
      // Get topics with recent activity
      const activeTopics = await this.prisma.viralContent.groupBy({
        by: ['topicId'],
        where: {
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
          },
        },
        _count: { id: true },
        having: {
          id: {
            _count: {
              gte: 5, // At least 5 recent content items
            },
          },
        },
        take: 50,
      });

      if (activeTopics.length === 0) {
        this.logger.log('No topics requiring metrics updates');
        return;
      }

      this.logger.log(`Updating viral metrics for ${activeTopics.length} topics`);

      let updated = 0;

      for (const topicGroup of activeTopics) {
        try {
          const metrics = await this.viralMetricsService.getTopicMetrics(topicGroup.topicId, 2);

          // Update topic with latest metrics
          await this.prisma.topic.update({
            where: { id: topicGroup.topicId },
            data: {
              viralScore: metrics.viralScore,
              momentumScore: metrics.momentumScore,
              lastViralAnalysis: new Date(),
            },
          });

          updated++;
        } catch (error) {
          this.logger.warn(`Failed to update metrics for topic ${topicGroup.topicId}:`, error.message);
        }
      }

      this.logger.log(`Viral metrics update completed: ${updated}/${activeTopics.length} topics updated`);
    } catch (error) {
      this.logger.error('Scheduled viral metrics update failed:', error);
    }
  }

  // Cleanup old data daily at 2 AM
  @Cron('0 2 * * *') // Every day at 2 AM
  async cleanupOldData(): Promise<void> {
    this.logger.log('Starting daily viral data cleanup');

    try {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

      // Clean up old viral content (keep high-performing content)
      const deletedContent = await this.prisma.viralContent.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          viralScore: {
            lt: 0.8, // Keep high viral content
          },
        },
      });

      // Clean up old viral index history
      const deletedHistory = await this.prisma.viralIndexHistory.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
          index: {
            lt: 0.7, // Keep high-performing history
          },
        },
      });

      // Clean up old metrics events
      const deletedEvents = await this.prisma.metricsEvent.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
          eventType: {
            in: ['VIRAL_CONTENT_ANALYZED', 'VIRAL_INDEX_UPDATE'],
          },
        },
      });

      this.logger.log(
        `Daily cleanup completed: ${deletedContent.count} content, ` +
        `${deletedHistory.count} history, ${deletedEvents.count} events deleted`
      );
    } catch (error) {
      this.logger.error('Daily viral data cleanup failed:', error);
    }
  }

  // Generate viral performance reports weekly on Sundays at 3 AM
  @Cron('0 3 * * 0') // Every Sunday at 3 AM
  async generateWeeklyReports(): Promise<void> {
    this.logger.log('Starting weekly viral performance report generation');

    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get overall system metrics
      const systemMetrics = await this.viralMetricsService.getSystemMetrics(168); // 7 days

      // Get top performing topics
      const topTopics = await this.viralIndexService.getTrendingTopics(20, 168, 0.7);

      // Get viral breakouts during the week
      const breakouts = await this.prisma.viralContent.findMany({
        where: {
          createdAt: { gte: weekAgo },
          viralScore: { gte: 0.9 },
          metadata: {
            path: ['eventType'],
            equals: 'VIRAL_BREAKOUT',
          },
        },
        include: {
          topic: {
            select: { name: true },
          },
        },
      });

      // Generate summary report
      const report = {
        period: {
          start: weekAgo.toISOString(),
          end: new Date().toISOString(),
        },
        overview: {
          totalTopics: systemMetrics.totalTopics,
          totalViralContent: systemMetrics.totalViralContent,
          averageViralIndex: systemMetrics.averageViralIndex,
          performanceMetrics: systemMetrics.performanceMetrics,
        },
        topPerformers: topTopics.slice(0, 10),
        viralBreakouts: breakouts.map(b => ({
          topicName: b.topic?.name || 'Unknown',
          breakoutTime: b.createdAt,
          viralScore: b.viralScore,
          momentumScore: b.momentumScore,
        })),
        trendingCategories: systemMetrics.trendingCategories,
        insights: this.generateWeeklyInsights(systemMetrics, topTopics, breakouts),
      };

      // Store report in database (would have reports table)
      this.logger.log('Weekly viral performance report generated', {
        totalTopics: report.overview.totalTopics,
        totalViralContent: report.overview.totalViralContent,
        viralBreakouts: report.viralBreakouts.length,
      });

      // Clean up very old reports (keep last 12 weeks)
      const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);
      // await this.prisma.viralReport.deleteMany({
      //   where: { createdAt: { lt: twelveWeeksAgo } },
      // });

      this.logger.log('Weekly viral performance report generation completed');
    } catch (error) {
      this.logger.error('Weekly viral performance report generation failed:', error);
    }
  }

  private async handleViralBreakoutAlert(breakout: any): Promise<void> {
    try {
      // Create high-priority notification
      await this.prisma.notification.create({
        data: {
          type: 'VIRAL_BREAKOUT_ALERT',
          title: '🚨 VIRAL BREAKOUT DETECTED',
          message: `Topic "${breakout.topic.name}" achieved viral score of ${breakout.viralScore.toFixed(3)}`,
          metadata: {
            topicId: breakout.topicId,
            topicName: breakout.topic.name,
            viralScore: breakout.viralScore,
            momentumScore: breakout.momentumScore,
            predictedVirality: breakout.predictedVirality,
            timestamp: breakout.createdAt.toISOString(),
          },
          priority: 'CRITICAL',
          createdAt: new Date(),
        },
      });

      // Could also send WebSocket notifications, emails, etc.
      this.logger.warn(`VIRAL BREAKOUT ALERT: ${breakout.topic.name} (Score: ${breakout.viralScore.toFixed(3)})`);
    } catch (error) {
      this.logger.error('Failed to create viral breakout alert:', error);
    }
  }

  private async handleMomentumAlert(topic: any): Promise<void> {
    try {
      // Create momentum alert
      await this.prisma.notification.create({
        data: {
          type: 'VIRAL_MOMENTUM_ALERT',
          title: '📈 High Viral Momentum Detected',
          message: `Topic "${topic.topicName}" showing ${topic.growth}% growth with high momentum`,
          metadata: {
            topicId: topic.topicId,
            topicName: topic.topicName,
            momentum: topic.momentum,
            growth: topic.growth,
            viralIndex: topic.viralIndex,
            timestamp: new Date().toISOString(),
          },
          priority: 'HIGH',
          createdAt: new Date(),
        },
      });

      this.logger.warn(`VIRAL MOMENTUM: ${topic.topicName} (${topic.growth}% growth, momentum: ${topic.momentum})`);
    } catch (error) {
      this.logger.error('Failed to create viral momentum alert:', error);
    }
  }

  private generateWeeklyInsights(
    systemMetrics: any,
    topTopics: any[],
    breakouts: any[]
  ): string[] {
    const insights: string[] = [];

    // Performance insights
    if (systemMetrics.performanceMetrics.successRate > 95) {
      insights.push('Excellent system performance with 95%+ success rate');
    } else if (systemMetrics.performanceMetrics.successRate < 85) {
      insights.push('System performance needs attention - success rate below 85%');
    }

    // Content insights
    if (systemMetrics.totalViralContent > 1000) {
      insights.push('High volume of viral content detected - excellent content engagement');
    } else if (systemMetrics.totalViralContent < 100) {
      insights.push('Low viral content volume - may need content strategy review');
    }

    // Breakout insights
    if (breakouts.length > 10) {
      insights.push('Exceptional viral activity with multiple breakouts this week');
    } else if (breakouts.length === 0) {
      insights.push('No viral breakouts detected - monitor content strategies');
    }

    // Top performer insights
    if (topTopics.length > 0) {
      const topPerformer = topTopics[0];
      insights.push(`Top performer: "${topPerformer.topicName}" with viral index ${topPerformer.viralIndex.toFixed(3)}`);
    }

    return insights;
  }
}