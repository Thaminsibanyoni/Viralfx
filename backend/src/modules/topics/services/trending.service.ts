import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface TrendingScore {
  topicId: string;
  score: number;
  components: {
    viralIndex: number;
    velocity: number;
    engagement: number;
  };
  metadata: {
    lastUpdated: Date;
    sampleSize: number;
    timeWindow: number;
  };
}

interface TrendingTopic {
  id: string;
  name: string;
  slug: string;
  category: string;
  score: number;
  velocity: number;
  engagementRate: number;
  viralIndex: number;
  lastUpdated: Date;
  metadata: any;
}

@Injectable()
export class TrendingService {
  private readonly logger = new Logger(TrendingService.name);
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly TRENDING_LISTS = {
    GLOBAL: 'trending:global',
    REGION_AFRICA: 'trending:region:africa',
    REGION_EUROPE: 'trending:region:europe',
    REGION_AMERICAS: 'trending:region:americas',
    REGION_ASIA: 'trending:region:asia'
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
    @InjectQueue('topic-processing')
    private readonly topicQueue: Queue) {}

  async calculateTrending(
    timeWindow: number = 60, // minutes
    region?: string,
    category?: string): Promise<TrendingScore[]> {
    const timeAgo = new Date(Date.now() - timeWindow * 60 * 1000);

    // Get topics with recent activity
    const topics = await this.prisma.topic.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        ...(category && { category }),
        viralSnapshots: {
          some: {
            ts: { gte: timeAgo }
          }
        }
      },
      include: {
        viralSnapshots: {
          where: {
            ts: { gte: timeAgo }
          },
          orderBy: { ts: 'desc' }
        },
        ingestEvents: {
          where: {
            ingestedAt: { gte: timeAgo },
            ...(region && { metadata: { path: ['region'], equals: region } })
          }
        },
        _count: {
          select: {
            ingestEvents: {
              where: {
                ingestedAt: { gte: timeAgo }
              }
            }
          }
        }
      }
    });

    const scores: TrendingScore[] = [];

    for (const topic of topics) {
      const score = await this.calculateTopicTrendingScore(topic, timeWindow);
      if (score.score > 0) {
        scores.push(score);
      }
    }

    // Sort by score and return top results
    return scores.sort((a, b) => b.score - a.score);
  }

  async getTrendingByRegion(
    region: string,
    limit: number = 10,
    category?: string): Promise<TrendingTopic[]> {
    const cacheKey = `trending:region:${region}:${limit}:${category || 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const trendingScores = await this.calculateTrending(60, region, category);

    const trendingTopics: TrendingTopic[] = [];

    for (const score of trendingScores.slice(0, limit)) {
      const topic = await this.prisma.topic.findUnique({
        where: { id: score.topicId },
        select: {
          id: true,
          name: true,
          slug: true,
          category: true
        }
      });

      if (topic) {
        trendingTopics.push({
          ...topic,
          score: score.score,
          velocity: score.components.velocity,
          engagementRate: score.components.engagement,
          viralIndex: score.components.viralIndex,
          lastUpdated: score.metadata.lastUpdated,
          metadata: score.metadata
        });
      }
    }

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(trendingTopics));

    return trendingTopics;
  }

  async getTrendingByCategory(
    category: string,
    limit: number = 10,
    region?: string): Promise<TrendingTopic[]> {
    const cacheKey = `trending:category:${category}:${limit}:${region || 'global'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const trendingScores = await this.calculateTrending(60, region, category);

    const trendingTopics: TrendingTopic[] = [];

    for (const score of trendingScores.slice(0, limit)) {
      const topic = await this.prisma.topic.findUnique({
        where: { id: score.topicId },
        select: {
          id: true,
          name: true,
          slug: true,
          category: true
        }
      });

      if (topic) {
        trendingTopics.push({
          ...topic,
          score: score.score,
          velocity: score.components.velocity,
          engagementRate: score.components.engagement,
          viralIndex: score.components.viralIndex,
          lastUpdated: score.metadata.lastUpdated,
          metadata: score.metadata
        });
      }
    }

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(trendingTopics));

    return trendingTopics;
  }

  async updateTrendingCache(): Promise<void> {
    try {
      // Update global trending
      const globalTrending = await this.calculateTrending(60);
      await this.updateRedisSortedSet(this.TRENDING_LISTS.GLOBAL, globalTrending);

      // Update regional trending
      const regions = ['africa', 'europe', 'americas', 'asia'];
      for (const region of regions) {
        const regionTrending = await this.calculateTrending(60, region);
        const cacheKey = this.TRENDING_LISTS[`REGION_${region.toUpperCase()}`];
        await this.updateRedisSortedSet(cacheKey, regionTrending);
      }

      // Update category trending
      const categories = await this.getCategories();
      for (const category of categories) {
        const categoryTrending = await this.calculateTrending(60, undefined, category);
        const cacheKey = `trending:category:${category}`;
        await this.updateRedisSortedSet(cacheKey, categoryTrending);
      }

      this.logger.log('Trending cache updated successfully');
    } catch (error) {
      this.logger.error('Failed to update trending cache:', error);
      throw error;
    }
  }

  async getTrendingHistory(
    topicId: string,
    timeRange: number = 24, // hours
    interval: number = 60, // minutes
  ): Promise<Array<{ timestamp: Date; score: number }>> {
    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    const snapshots = await this.prisma.viralIndexSnapshot.findMany({
      where: {
        topicId,
        ts: { gte: startTime }
      },
      orderBy: { ts: 'asc' }
    });

    // Group snapshots by intervals
    const intervalMs = interval * 60 * 1000;
    const grouped: { [key: number]: number[] } = {};

    for (const snapshot of snapshots) {
      const intervalKey = Math.floor(snapshot.ts.getTime() / intervalMs) * intervalMs;
      if (!grouped[intervalKey]) {
        grouped[intervalKey] = [];
      }
      grouped[intervalKey].push(snapshot.viralIndex);
    }

    // Calculate average scores for each interval
    return Object.entries(grouped).map(([timestamp, scores]) => ({
      timestamp: new Date(parseInt(timestamp)),
      score: scores.reduce((sum, score) => sum + score, 0) / scores.length
    }));
  }

  async detectViralSpikes(
    threshold: number = 2.0, // multiplier for spike detection
    windowSize: number = 60, // minutes
  ): Promise<Array<{ topicId: string; spikeScore: number; currentScore: number; baselineScore: number }>> {
    const currentTime = new Date();
    const windowStart = new Date(currentTime.getTime() - windowSize * 60 * 1000);
    const baselineStart = new Date(currentTime.getTime() - windowSize * 2 * 60 * 1000);

    const topics = await this.prisma.topic.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null
      },
      include: {
        viralSnapshots: {
          where: {
            ts: { gte: baselineStart }
          },
          orderBy: { ts: 'asc' }
        }
      }
    });

    const spikes: Array<any> = [];

    for (const topic of topics) {
      const windowSnapshots = topic.viralSnapshots.filter(s => s.ts >= windowStart);
      const baselineSnapshots = topic.viralSnapshots.filter(s => s.ts >= baselineStart && s.ts < windowStart);

      if (windowSnapshots.length > 0 && baselineSnapshots.length > 0) {
        const currentScore = windowSnapshots.reduce((sum, s) => sum + s.viralIndex, 0) / windowSnapshots.length;
        const baselineScore = baselineSnapshots.reduce((sum, s) => sum + s.viralIndex, 0) / baselineSnapshots.length;

        const spikeScore = baselineScore > 0 ? currentScore / baselineScore : currentScore;

        if (spikeScore >= threshold) {
          spikes.push({
            topicId: topic.id,
            spikeScore,
            currentScore,
            baselineScore
          });
        }
      }
    }

    return spikes.sort((a, b) => b.spikeScore - a.spikeScore);
  }

  private async calculateTopicTrendingScore(topic: any, timeWindow: number): Promise<TrendingScore> {
    const viralSnapshots = topic.viralSnapshots || [];
    const ingestEvents = topic.ingestEvents || [];

    // Calculate components
    const viralIndex = this.calculateViralIndexScore(viralSnapshots);
    const velocity = this.calculateVelocityScore(viralSnapshots, timeWindow);
    const engagement = this.calculateEngagementScore(ingestEvents, topic._count.ingestEvents);

    // Calculate composite score
    const score = (viralIndex * 0.4) + (velocity * 0.3) + (engagement * 0.3);

    return {
      topicId: topic.id,
      score: Math.round(score * 100) / 100, // Round to 2 decimal places
      components: {
        viralIndex: Math.round(viralIndex * 100) / 100,
        velocity: Math.round(velocity * 100) / 100,
        engagement: Math.round(engagement * 100) / 100
      },
      metadata: {
        lastUpdated: new Date(),
        sampleSize: viralSnapshots.length + ingestEvents.length,
        timeWindow
      }
    };
  }

  private calculateViralIndexScore(viralSnapshots: any[]): number {
    if (viralSnapshots.length === 0) return 0;

    // Use the most recent viral index, normalized to 0-100 scale
    const latestSnapshot = viralSnapshots[0]; // Already ordered by timestamp desc
    return Math.min(latestSnapshot.viralIndex, 100);
  }

  private calculateVelocityScore(viralSnapshots: any[], timeWindow: number): number {
    if (viralSnapshots.length < 2) return 0;

    // Calculate rate of change (slope) of viral index
    const latest = viralSnapshots[0];
    const earliest = viralSnapshots[viralSnapshots.length - 1];

    const timeDiff = (latest.ts.getTime() - earliest.ts.getTime()) / (1000 * 60); // minutes
    const indexDiff = latest.viralIndex - earliest.viralIndex;

    const velocity = timeDiff > 0 ? indexDiff / timeDiff : 0;

    // Normalize to 0-100 scale
    return Math.max(0, Math.min(100, velocity + 50)); // Add 50 to center around 0
  }

  private calculateEngagementScore(ingestEvents: any[], totalEvents: number): number {
    if (totalEvents === 0) return 0;

    // Calculate engagement rate based on event volume
    // Normalize to 0-100 scale (assuming max 1000 events as baseline)
    const normalizedEvents = Math.min(totalEvents, 1000);
    return (normalizedEvents / 1000) * 100;
  }

  private async updateRedisSortedSet(key: string, scores: TrendingScore[]): Promise<void> {
    if (scores.length === 0) return;

    const pipeline = this.redis.pipeline();
    pipeline.del(key); // Clear existing data

    for (const score of scores) {
      pipeline.zadd(key, score.score, score.topicId);
    }

    // Set expiration
    pipeline.expire(key, this.CACHE_TTL);

    await pipeline.exec();
  }

  private async getCategories(): Promise<string[]> {
    const categories = await this.prisma.topic.findMany({
      select: { category: true },
      distinct: ['category'],
      where: {
        status: 'ACTIVE',
        deletedAt: null
      }
    });

    return categories.map(c => c.category);
  }
}
