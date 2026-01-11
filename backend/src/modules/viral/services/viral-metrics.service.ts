import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';

interface ContentMetrics {
  total: number;
  averageScore: number;
  peakScore: number;
  medianScore: number;
  growthRate: number;
  engagementRate: number;
  distribution: {
    low: number;    // 0.0 - 0.3
    medium: number; // 0.3 - 0.7
    high: number;   // 0.7 - 1.0
  };
  timeDistribution: {
    hourly: Array<{ hour: number; count: number; avgScore: number }>;
    daily: Array<{ day: string; count: number; avgScore: number }>;
  };
}

interface TopicMetrics {
  topicId: string;
  totalContent: number;
  viralIndex: number;
  viralScore: number;
  momentumScore: number;
  topPerformingContent: Array<{
    id: string;
    score: number;
    timestamp: Date;
  }>;
  engagementMetrics: {
    totalLikes: number;
    totalShares: number;
    totalComments: number;
    totalViews: number;
    averageEngagement: number;
  };
  growthMetrics: {
    dailyGrowth: number;
    weeklyGrowth: number;
    monthlyGrowth: number;
  };
}

interface SystemMetrics {
  totalTopics: number;
  totalViralContent: number;
  averageViralIndex: number;
  topPerformingTopics: Array<{
    topicId: string;
    topicName: string;
    viralIndex: number;
    momentum: number;
  }>;
  trendingCategories: Array<{
    category: string;
    count: number;
    avgViralScore: number;
  }>;
  performanceMetrics: {
    processingTime: number;
    successRate: number;
    errorRate: number;
  };
}

@Injectable()
export class ViralMetricsService {
  private readonly logger = new Logger(ViralMetricsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis) {}

  async getContentMetrics(
    topicId: string,
    since: Date): Promise<ContentMetrics> {
    const cacheKey = `viral:metrics:content:${topicId}:${since.getTime()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const viralContent = await this.prisma.viralContent.findMany({
        where: {
          topicId,
          createdAt: { gte: since }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (viralContent.length === 0) {
        const emptyMetrics: ContentMetrics = {
          total: 0,
          averageScore: 0,
          peakScore: 0,
          medianScore: 0,
          growthRate: 0,
          engagementRate: 0,
          distribution: { low: 0, medium: 0, high: 0 },
          timeDistribution: {
            hourly: [],
            daily: []
          }
        };

        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(emptyMetrics));
        return emptyMetrics;
      }

      const scores = viralContent.map(c => c.viralScore);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const peakScore = Math.max(...scores);
      const medianScore = this.calculateMedian(scores);

      // Calculate growth rate
      const growthRate = this.calculateGrowthRate(viralContent);

      // Calculate engagement rate
      const engagementRate = this.calculateEngagementRate(viralContent);

      // Calculate distribution
      const distribution = this.calculateScoreDistribution(scores);

      // Calculate time distribution
      const timeDistribution = await this.calculateTimeDistribution(topicId, since);

      const metrics: ContentMetrics = {
        total: viralContent.length,
        averageScore,
        peakScore,
        medianScore,
        growthRate,
        engagementRate,
        distribution,
        timeDistribution
      };

      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(metrics));
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get content metrics for topic ${topicId}:`, error);
      throw error;
    }
  }

  async getTopicMetrics(
    topicId: string,
    timeWindow: number = 24, // hours
  ): Promise<TopicMetrics> {
    const cacheKey = `viral:metrics:topic:${topicId}:${timeWindow}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const since = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    try {
      const [viralContent, topic] = await Promise.all([
        this.prisma.viralContent.findMany({
          where: {
            topicId,
            createdAt: { gte: since }
          },
          orderBy: { viralScore: 'desc' },
          take: 10
        }),
        this.prisma.topic.findUnique({
          where: { id: topicId },
          select: { name: true, viralIndex: true, viralScore: true, momentumScore: true }
        }),
      ]);

      // Calculate engagement metrics
      const engagementMetrics = await this.calculateEngagementMetrics(topicId, since);

      // Calculate growth metrics
      const growthMetrics = await this.calculateGrowthMetrics(topicId);

      const metrics: TopicMetrics = {
        topicId,
        totalContent: viralContent.length,
        viralIndex: topic?.viralIndex || 0,
        viralScore: topic?.viralScore || 0,
        momentumScore: topic?.momentumScore || 0,
        topPerformingContent: viralContent.map(c => ({
          id: c.id,
          score: c.viralScore,
          timestamp: c.createdAt
        })),
        engagementMetrics,
        growthMetrics
      };

      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(metrics));
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get topic metrics for ${topicId}:`, error);
      throw error;
    }
  }

  async getSystemMetrics(timeWindow: number = 24): Promise<SystemMetrics> {
    const cacheKey = `viral:metrics:system:${timeWindow}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const since = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    try {
      const [totalTopics, totalViralContent, avgIndex] = await Promise.all([
        this.prisma.topic.count(),
        this.prisma.viralContent.count({
          where: { createdAt: { gte: since } }
        }),
        this.prisma.topic.aggregate({
          _avg: { viralIndex: true }
        }),
      ]);

      // Get top performing topics
      const topTopics = await this.prisma.topic.findMany({
        where: {
          viralIndex: { gte: 0.5 }
        },
        select: {
          id: true,
          name: true,
          viralIndex: true,
          momentumScore: true
        },
        orderBy: { viralIndex: 'desc' },
        take: 10
      });

      // Get trending categories
      const trendingCategories = await this.getTrendingCategories(since);

      // Get performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(since);

      const metrics: SystemMetrics = {
        totalTopics,
        totalViralContent,
        averageViralIndex: avgIndex._avg.viralIndex || 0,
        topPerformingTopics: topTopics.map(t => ({
          topicId: t.id,
          topicName: t.name,
          viralIndex: t.viralIndex,
          momentum: t.momentumScore
        })),
        trendingCategories,
        performanceMetrics
      };

      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(metrics));
      return metrics;
    } catch (error) {
      this.logger.error('Failed to get system metrics:', error);
      throw error;
    }
  }

  calculateMetrics(viralContent: any[]): {
    viralIndex: number;
    viralScore: number;
    momentumScore: number;
  } {
    if (viralContent.length === 0) {
      return { viralIndex: 0, viralScore: 0, momentumScore: 0 };
    }

    const scores = viralContent.map(c => c.viralScore);
    const viralScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Calculate momentum based on recent trends
    const momentumScore = this.calculateMomentumFromContent(viralContent);

    // Viral index is a weighted combination
    const viralIndex = (viralScore * 0.6 + momentumScore * 0.4);

    return {
      viralIndex: Math.min(1, viralIndex),
      viralScore: Math.min(1, viralScore),
      momentumScore: Math.min(1, momentumScore)
    };
  }

  async trackMetrics(
    topicId: string,
    contentType: string,
    score: number,
    metadata?: any): Promise<void> {
    try {
      // Store metrics event for analytics
      await this.prisma.metricsEvent.create({
        data: {
          topicId,
          eventType: 'VIRAL_CONTENT_ANALYZED',
          contentType,
          score,
          metadata: metadata || {},
          timestamp: new Date()
        }
      });

      // Update real-time counters
      const counterKey = `viral:counters:${topicId}:${contentType}`;
      await this.redis.incr(counterKey);
      await this.redis.expire(counterKey, 24 * 60 * 60); // 24 hours

      // Update score aggregates
      const scoreKey = `viral:scores:${topicId}:${contentType}`;
      await this.redis.lpush(scoreKey, score.toString());
      await this.redis.ltrim(scoreKey, 0, 999); // Keep last 1000 scores
      await this.redis.expire(scoreKey, 24 * 60 * 60);

      this.logger.debug(`Tracked metrics for topic ${topicId}: ${contentType} = ${score}`);
    } catch (error) {
      this.logger.error(`Failed to track metrics for topic ${topicId}:`, error);
    }
  }

  async getMetricsSummary(
    topicId: string,
    timeWindow: number = 24): Promise<{
    totalAnalyses: number;
    averageScore: number;
    peakScore: number;
    currentTrend: 'rising' | 'falling' | 'stable';
    topContentTypes: Array<{ type: string; count: number; avgScore: number }>;
  }> {
    const since = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    try {
      const [metrics, contentTypes] = await Promise.all([
        this.prisma.metricsEvent.findMany({
          where: {
            topicId,
            eventType: 'VIRAL_CONTENT_ANALYZED',
            timestamp: { gte: since }
          },
          orderBy: { timestamp: 'desc' }
        }),
        this.getTopContentTypes(topicId, since),
      ]);

      if (metrics.length === 0) {
        return {
          totalAnalyses: 0,
          averageScore: 0,
          peakScore: 0,
          currentTrend: 'stable',
          topContentTypes: contentTypes
        };
      }

      const scores = metrics.map(m => m.score);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const peakScore = Math.max(...scores);

      // Determine trend
      const recentScores = scores.slice(0, 10); // Last 10 analyses
      const olderScores = scores.slice(10, 20); // Previous 10 analyses

      let currentTrend: 'rising' | 'falling' | 'stable' = 'stable';
      if (recentScores.length >= 5 && olderScores.length >= 5) {
        const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
        const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
        const difference = recentAvg - olderAvg;

        if (Math.abs(difference) > 0.1) {
          currentTrend = difference > 0 ? 'rising' : 'falling';
        }
      }

      return {
        totalAnalyses: metrics.length,
        averageScore,
        peakScore,
        currentTrend,
        topContentTypes: contentTypes
      };
    } catch (error) {
      this.logger.error(`Failed to get metrics summary for topic ${topicId}:`, error);
      throw error;
    }
  }

  private calculateMedian(scores: number[]): number {
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculateGrowthRate(viralContent: any[]): number {
    if (viralContent.length < 2) return 0;

    const sorted = viralContent.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const firstScore = sorted[0].viralScore;
    const lastScore = sorted[sorted.length - 1].viralScore;
    const timeSpan = (sorted[sorted.length - 1].createdAt.getTime() - sorted[0].createdAt.getTime()) / (1000 * 60 * 60 * 24); // days

    return timeSpan > 0 ? ((lastScore - firstScore) / firstScore) / timeSpan : 0;
  }

  private calculateEngagementRate(viralContent: any[]): number {
    if (viralContent.length === 0) return 0;

    const totalEngagement = viralContent.reduce((sum, content) => {
      const engagement = content.metadata?.totalEngagement || 0;
      return sum + engagement;
    }, 0);

    // Normalize to 0-1 range (assuming max expected engagement of 10000)
    return Math.min(totalEngagement / (viralContent.length * 10000), 1);
  }

  private calculateScoreDistribution(scores: number[]): {
    low: number;
    medium: number;
    high: number;
  } {
    const distribution = { low: 0, medium: 0, high: 0 };

    scores.forEach(score => {
      if (score < 0.3) distribution.low++;
      else if (score < 0.7) distribution.medium++;
      else distribution.high++;
    });

    return {
      low: distribution.low / scores.length,
      medium: distribution.medium / scores.length,
      high: distribution.high / scores.length
    };
  }

  private async calculateTimeDistribution(
    topicId: string,
    since: Date): Promise<{
    hourly: Array<{ hour: number; count: number; avgScore: number }>;
    daily: Array<{ day: string; count: number; avgScore: number }>;
  }> {
    const viralContent = await this.prisma.viralContent.findMany({
      where: {
        topicId,
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Hourly distribution
    const hourlyMap = new Map<number, { count: number; totalScore: number }>();
    viralContent.forEach(content => {
      const hour = content.createdAt.getHours();
      const existing = hourlyMap.get(hour) || { count: 0, totalScore: 0 };
      hourlyMap.set(hour, {
        count: existing.count + 1,
        totalScore: existing.totalScore + content.viralScore
      });
    });

    const hourly = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
      hour,
      count: data.count,
      avgScore: data.totalScore / data.count
    })).sort((a, b) => a.hour - b.hour);

    // Daily distribution
    const dailyMap = new Map<string, { count: number; totalScore: number }>();
    viralContent.forEach(content => {
      const day = content.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(day) || { count: 0, totalScore: 0 };
      dailyMap.set(day, {
        count: existing.count + 1,
        totalScore: existing.totalScore + content.viralScore
      });
    });

    const daily = Array.from(dailyMap.entries()).map(([day, data]) => ({
      day,
      count: data.count,
      avgScore: data.totalScore / data.count
    })).sort((a, b) => a.day.localeCompare(b.day));

    return { hourly, daily };
  }

  private async calculateEngagementMetrics(
    topicId: string,
    since: Date): Promise<{
    totalLikes: number;
    totalShares: number;
    totalComments: number;
    totalViews: number;
    averageEngagement: number;
  }> {
    const viralContent = await this.prisma.viralContent.findMany({
      where: {
        topicId,
        createdAt: { gte: since }
      }
    });

    return viralContent.reduce(
      (metrics, content) => {
        const metadata = content.metadata || {};
        const likes = metadata.likes || 0;
        const shares = metadata.shares || 0;
        const comments = metadata.comments || 0;
        const views = metadata.views || 0;

        return {
          totalLikes: metrics.totalLikes + likes,
          totalShares: metrics.totalShares + shares,
          totalComments: metrics.totalComments + comments,
          totalViews: metrics.totalViews + views,
          averageEngagement: metrics.averageEngagement + (likes + shares + comments)
        };
      },
      { totalLikes: 0, totalShares: 0, totalComments: 0, totalViews: 0, averageEngagement: 0 }
    );
  }

  private async calculateGrowthMetrics(topicId: string): Promise<{
    dailyGrowth: number;
    weeklyGrowth: number;
    monthlyGrowth: number;
  }> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dailyCount, weeklyCount, monthlyCount] = await Promise.all([
      this.prisma.viralContent.count({
        where: { topicId, createdAt: { gte: dayAgo } }
      }),
      this.prisma.viralContent.count({
        where: { topicId, createdAt: { gte: weekAgo, lt: dayAgo } }
      }),
      this.prisma.viralContent.count({
        where: { topicId, createdAt: { gte: monthAgo, lt: weekAgo } }
      }),
    ]);

    const dailyGrowth = weeklyCount > 0 ? ((dailyCount - weeklyCount) / weeklyCount) * 100 : 0;
    const weeklyGrowth = monthlyCount > 0 ? ((weeklyCount - monthlyCount) / monthlyCount) * 100 : 0;
    const monthlyGrowth = 0; // Would need longer history for this

    return {
      dailyGrowth: Math.round(dailyGrowth * 100) / 100,
      weeklyGrowth: Math.round(weeklyGrowth * 100) / 100,
      monthlyGrowth
    };
  }

  private async getTrendingCategories(since: Date): Promise<Array<{
    category: string;
    count: number;
    avgViralScore: number;
  }>> {
    // This would join with topics and group by category
    // For now, return mock data
    return [
      { category: 'POLITICS', count: 15, avgViralScore: 0.75 },
      { category: 'SPORTS', count: 12, avgViralScore: 0.68 },
      { category: 'ENTERTAINMENT', count: 18, avgViralScore: 0.72 },
    ];
  }

  private async getPerformanceMetrics(since: Date): Promise<{
    processingTime: number;
    successRate: number;
    errorRate: number;
  }> {
    const totalEvents = await this.prisma.metricsEvent.count({
      where: {
        eventType: 'VIRAL_CONTENT_ANALYZED',
        timestamp: { gte: since }
      }
    });

    const errorEvents = await this.prisma.metricsEvent.count({
      where: {
        eventType: 'VIRAL_ANALYSIS_ERROR',
        timestamp: { gte: since }
      }
    });

    const successRate = totalEvents > 0 ? ((totalEvents - errorEvents) / totalEvents) * 100 : 100;
    const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;

    // Average processing time would need to be tracked separately
    const processingTime = 150; // milliseconds (mock data)

    return {
      processingTime,
      successRate: Math.round(successRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  private calculateMomentumFromContent(viralContent: any[]): number {
    if (viralContent.length < 2) return 0;

    const sorted = viralContent.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const recent = sorted.slice(-Math.min(10, sorted.length));
    const older = sorted.slice(0, Math.max(0, sorted.length - 10));

    if (recent.length === 0 || older.length === 0) return 0;

    const recentAvg = recent.reduce((sum, c) => sum + c.viralScore, 0) / recent.length;
    const olderAvg = older.reduce((sum, c) => sum + c.viralScore, 0) / older.length;

    return Math.max(0, (recentAvg - olderAvg + 1) / 2); // Normalize to 0-1
  }

  private async getTopContentTypes(
    topicId: string,
    since: Date): Promise<Array<{ type: string; count: number; avgScore: number }>> {
    const contentTypes = await this.prisma.metricsEvent.groupBy({
      by: ['contentType'],
      where: {
        topicId,
        eventType: 'VIRAL_CONTENT_ANALYZED',
        timestamp: { gte: since }
      },
      _count: { id: true },
      _avg: { score: true }
    });

    return contentTypes.map(item => ({
      type: item.contentType,
      count: item._count.id,
      avgScore: item._avg.score || 0
    })).sort((a, b) => b.count - a.count);
  }
}
