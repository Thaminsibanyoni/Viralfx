import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Redis } from 'ioredis';

interface ViralIndexCalculation {
  topicId: string;
  index: number;
  momentum: number;
  velocity: number;
  acceleration: number;
  engagement: {
    likes: number;
    shares: number;
    comments: number;
    views: number;
  };
  timeWindow: {
    start: Date;
    end: Date;
    duration: number; // in hours
  };
  confidence: number;
  lastUpdated: Date;
}

interface ViralIndexHistory {
  timestamp: Date;
  index: number;
  momentum: number;
  changeRate: number;
}

@Injectable()
export class ViralIndexService {
  private readonly logger = new Logger(ViralIndexService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
  ) {}

  async calculateTopicViralIndex(
    topicId: string,
    timeWindow: number = 24, // hours
  ): Promise<ViralIndexCalculation> {
    const cacheKey = `viral:index:${topicId}:${timeWindow}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeWindow * 60 * 60 * 1000);

    try {
      // Fetch viral content data for the topic within the time window
      const viralContent = await this.prisma.viralContent.findMany({
        where: {
          topicId,
          createdAt: {
            gte: startTime,
            lte: endTime,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (viralContent.length === 0) {
        const emptyResult: ViralIndexCalculation = {
          topicId,
          index: 0,
          momentum: 0,
          velocity: 0,
          acceleration: 0,
          engagement: {
            likes: 0,
            shares: 0,
            comments: 0,
            views: 0,
          },
          timeWindow: {
            start: startTime,
            end: endTime,
            duration: timeWindow,
          },
          confidence: 0,
          lastUpdated: new Date(),
        };

        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(emptyResult));
        return emptyResult;
      }

      // Calculate viral index using the weighted formula
      const viralIndex = this.calculateViralIndex(viralContent, timeWindow);

      // Calculate momentum (rate of change)
      const momentum = this.calculateMomentum(viralContent, timeWindow);

      // Calculate velocity and acceleration
      const velocity = this.calculateVelocity(viralContent);
      const acceleration = this.calculateAcceleration(viralContent);

      // Aggregate engagement metrics
      const engagement = this.aggregateEngagementMetrics(viralContent);

      // Calculate confidence based on data quality and quantity
      const confidence = this.calculateConfidence(viralContent, timeWindow);

      const result: ViralIndexCalculation = {
        topicId,
        index: viralIndex,
        momentum,
        velocity,
        acceleration,
        engagement,
        timeWindow: {
          start: startTime,
          end: endTime,
          duration: timeWindow,
        },
        confidence,
        lastUpdated: new Date(),
      };

      // Cache the result
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

      // Store in database for historical tracking
      await this.storeViralIndexHistory(result);

      this.logger.log(`Calculated viral index for topic ${topicId}: ${viralIndex.toFixed(3)} (confidence: ${(confidence * 100).toFixed(1)}%)`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to calculate viral index for topic ${topicId}:`, error);
      throw error;
    }
  }

  async getViralIndexHistory(
    topicId: string,
    startTime: Date,
    endTime: Date,
    interval: number = 60, // minutes
  ): Promise<ViralIndexHistory[]> {
    const cacheKey = `viral:history:${topicId}:${startTime.getTime()}:${endTime.getTime()}:${interval}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const history = await this.prisma.viralIndexHistory.findMany({
      where: {
        topicId,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group by intervals if needed
    if (interval < 60) {
      // For intervals less than 1 hour, we need more granular data
      const groupedHistory = this.groupHistoryByInterval(history, interval);
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(groupedHistory));
      return groupedHistory;
    }

    const result = history.map(h => ({
      timestamp: h.timestamp,
      index: h.index,
      momentum: h.momentum,
      changeRate: h.changeRate,
    }));

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async getTrendingTopics(
    limit: number = 10,
    timeWindow: number = 24, // hours
    minIndex: number = 0.5
  ): Promise<Array<{
    topicId: string;
    topicName: string;
    viralIndex: number;
    momentum: number;
    velocity: number;
    growth: number;
  }>> {
    const timeAgo = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    const trending = await this.prisma.viralIndexHistory.findMany({
      where: {
        timestamp: { gte: timeAgo },
        index: { gte: minIndex },
      },
      include: {
        topic: {
          select: { name: true },
        },
      },
      orderBy: { momentum: 'desc' },
      take: limit,
      distinct: ['topicId'],
    });

    // Calculate growth rates
    const result = await Promise.all(
      trending.map(async (item) => {
        const previousIndex = await this.getPreviousIndex(item.topicId, item.timestamp, 6); // 6 hours ago
        const growth = previousIndex > 0 ? ((item.index - previousIndex) / previousIndex) * 100 : 0;

        return {
          topicId: item.topicId,
          topicName: item.topic?.name || 'Unknown',
          viralIndex: item.index,
          momentum: item.momentum,
          velocity: item.velocity || 0,
          growth: Math.round(growth * 100) / 100,
        };
      })
    );

    return result.sort((a, b) => b.momentum - a.momentum).slice(0, limit);
  }

  async getViralVelocity(
    topicId: string,
    timeWindow: number = 1, // hours
  ): Promise<number> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeWindow * 60 * 60 * 1000);

    const viralContent = await this.prisma.viralContent.findMany({
      where: {
        topicId,
        createdAt: { gte: startTime, lte: endTime },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (viralContent.length < 2) {
      return 0;
    }

    const firstScore = viralContent[0].viralScore;
    const lastScore = viralContent[viralContent.length - 1].viralScore;
    const timeDiff = (viralContent[viralContent.length - 1].createdAt.getTime() - viralContent[0].createdAt.getTime()) / (1000 * 60 * 60); // in hours

    return timeDiff > 0 ? (lastScore - firstScore) / timeDiff : 0;
  }

  async detectViralBreakouts(
    threshold: number = 0.8,
    momentumThreshold: number = 0.6,
    timeWindow: number = 1, // hours
  ): Promise<Array<{
    topicId: string;
    topicName: string;
    currentScore: number;
    momentum: number;
    breakoutTime: Date;
    confidence: number;
  }>> {
    const breakoutCandidates = await this.prisma.viralContent.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - timeWindow * 60 * 60 * 1000),
        },
        viralScore: { gte: threshold },
      },
      include: {
        topic: {
          select: { name: true },
        },
      },
      orderBy: { momentumScore: 'desc' },
    });

    const breakouts = breakoutCandidates
      .filter(item => item.momentumScore >= momentumThreshold)
      .map(item => ({
        topicId: item.topicId,
        topicName: item.topic?.name || 'Unknown',
        currentScore: item.viralScore,
        momentum: item.momentumScore,
        breakoutTime: item.createdAt,
        confidence: this.calculateBreakoutConfidence(item),
      }));

    return breakouts;
  }

  private calculateViralIndex(viralContent: any[], timeWindow: number): number {
    if (viralContent.length === 0) {
      return 0;
    }

    // Viral Index Formula:
    // VI = (Σ(Vi × Wi × Ti)) / Σ(Wi × Ti)
    // Where:
    // - Vi = Viral score of content i
    // - Wi = Weight factor (based on engagement, recency, quality)
    // - Ti = Time decay factor

    const now = Date.now();
    let weightedSum = 0;
    let weightSum = 0;

    for (const content of viralContent) {
      const ageHours = (now - content.createdAt.getTime()) / (1000 * 60 * 60);

      // Weight based on recency (newer content gets higher weight)
      const timeWeight = Math.exp(-ageHours / (timeWindow / 2));

      // Weight based on engagement
      const engagementWeight = (content.engagementScore || 0.5) * 0.3 + 0.7;

      // Weight based on reach
      const reachWeight = (content.reachScore || 0.5) * 0.2 + 0.8;

      // Combined weight
      const weight = timeWeight * engagementWeight * reachWeight;

      weightedSum += content.viralScore * weight;
      weightSum += weight;
    }

    return weightSum > 0 ? weightedSum / weightSum : 0;
  }

  private calculateMomentum(viralContent: any[], timeWindow: number): number {
    if (viralContent.length < 2) {
      return 0;
    }

    // Calculate momentum as the rate of change of viral scores
    const sortedContent = viralContent.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const firstHalf = sortedContent.slice(0, Math.floor(sortedContent.length / 2));
    const secondHalf = sortedContent.slice(Math.floor(sortedContent.length / 2));

    const firstAvg = firstHalf.reduce((sum, c) => sum + c.viralScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, c) => sum + c.viralScore, 0) / secondHalf.length;

    // Momentum is the rate of change
    const momentum = (secondAvg - firstAvg) / (timeWindow / 2);

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, momentum + 0.5));
  }

  private calculateVelocity(viralContent: any[]): number {
    if (viralContent.length < 2) {
      return 0;
    }

    // Simple velocity calculation based on recent changes
    const recent = viralContent.slice(-5); // Last 5 entries
    if (recent.length < 2) return 0;

    let totalVelocity = 0;
    for (let i = 1; i < recent.length; i++) {
      const timeDiff = (recent[i].createdAt.getTime() - recent[i-1].createdAt.getTime()) / (1000 * 60 * 60); // hours
      const scoreDiff = recent[i].viralScore - recent[i-1].viralScore;
      totalVelocity += timeDiff > 0 ? scoreDiff / timeDiff : 0;
    }

    return totalVelocity / (recent.length - 1);
  }

  private calculateAcceleration(viralContent: any[]): number {
    if (viralContent.length < 3) {
      return 0;
    }

    // Calculate acceleration as the rate of change of velocity
    const recent = viralContent.slice(-5);
    const velocities: number[] = [];

    for (let i = 1; i < recent.length; i++) {
      const timeDiff = (recent[i].createdAt.getTime() - recent[i-1].createdAt.getTime()) / (1000 * 60 * 60);
      const scoreDiff = recent[i].viralScore - recent[i-1].viralScore;
      velocities.push(timeDiff > 0 ? scoreDiff / timeDiff : 0);
    }

    if (velocities.length < 2) return 0;

    // Acceleration is the change in velocity
    let totalAcceleration = 0;
    for (let i = 1; i < velocities.length; i++) {
      totalAcceleration += velocities[i] - velocities[i-1];
    }

    return totalAcceleration / (velocities.length - 1);
  }

  private aggregateEngagementMetrics(viralContent: any[]): {
    likes: number;
    shares: number;
    comments: number;
    views: number;
  } {
    return viralContent.reduce(
      (acc, content) => ({
        likes: acc.likes + (content.metadata?.likes || 0),
        shares: acc.shares + (content.metadata?.shares || 0),
        comments: acc.comments + (content.metadata?.comments || 0),
        views: acc.views + (content.metadata?.views || 0),
      }),
      { likes: 0, shares: 0, comments: 0, views: 0 }
    );
  }

  private calculateConfidence(viralContent: any[], timeWindow: number): number {
    // Confidence based on:
    // 1. Number of data points
    // 2. Distribution over time
    // 3. Quality of data

    const dataPointsFactor = Math.min(viralContent.length / 10, 1); // More points = higher confidence
    const timeSpanFactor = Math.min(timeWindow / 24, 1); // Longer time span = higher confidence
    const qualityFactor = 0.8; // Assume good data quality for now

    return (dataPointsFactor * 0.4 + timeSpanFactor * 0.3 + qualityFactor * 0.3);
  }

  private async storeViralIndexHistory(calculation: ViralIndexCalculation): Promise<void> {
    try {
      await this.prisma.viralIndexHistory.create({
        data: {
          topicId: calculation.topicId,
          index: calculation.index,
          momentum: calculation.momentum,
          velocity: calculation.velocity,
          acceleration: calculation.acceleration,
          engagement: calculation.engagement,
          confidence: calculation.confidence,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to store viral index history for topic ${calculation.topicId}:`, error.message);
    }
  }

  private groupHistoryByInterval(history: any[], intervalMinutes: number): ViralIndexHistory[] {
    const intervalMs = intervalMinutes * 60 * 1000;
    const grouped: { [key: number]: any[] } = {};

    for (const entry of history) {
      const intervalKey = Math.floor(entry.timestamp.getTime() / intervalMs) * intervalMs;
      if (!grouped[intervalKey]) {
        grouped[intervalKey] = [];
      }
      grouped[intervalKey].push(entry);
    }

    return Object.entries(grouped).map(([timestamp, entries]) => {
      const avgIndex = entries.reduce((sum, e) => sum + e.index, 0) / entries.length;
      const avgMomentum = entries.reduce((sum, e) => sum + e.momentum, 0) / entries.length;

      let changeRate = 0;
      if (entries.length > 1) {
        const first = entries[0];
        const last = entries[entries.length - 1];
        changeRate = (last.index - first.index) / entries.length;
      }

      return {
        timestamp: new Date(parseInt(timestamp)),
        index: avgIndex,
        momentum: avgMomentum,
        changeRate,
      };
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private async getPreviousIndex(topicId: string, currentTimestamp: Date, hoursBack: number): Promise<number> {
    const targetTime = new Date(currentTimestamp.getTime() - hoursBack * 60 * 60 * 1000);

    const previousEntry = await this.prisma.viralIndexHistory.findFirst({
      where: {
        topicId,
        timestamp: { lte: targetTime },
      },
      orderBy: { timestamp: 'desc' },
    });

    return previousEntry?.index || 0;
  }

  private calculateBreakoutConfidence(content: any): number {
    // Confidence based on multiple factors
    const score = content.viralScore;
    const momentum = content.momentumScore;
    const engagement = content.engagementScore;

    return (score * 0.4 + momentum * 0.4 + engagement * 0.2);
  }
}