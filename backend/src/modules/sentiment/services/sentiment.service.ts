import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface SentimentAnalysis {
  sentimentScore: number;
  confidence: number;
  emotions: {
    joy: number;
    anger: number;
    fear: number;
    sadness: number;
    surprise: number;
    disgust: number;
  };
  metadata: {
    model: string;
    version: string;
    processedAt: Date;
  };
}

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
    @InjectQueue('sentiment-analysis')
    private readonly sentimentQueue: Queue,
  ) {}

  async analyzeSentiment(content: string, topicId: string, metadata?: any): Promise<SentimentAnalysis> {
    try {
      // Simple sentiment analysis for now
      const analysis = await this.performSimpleSentimentAnalysis(content);

      // Create sentiment entry
      await this.prisma.sentimentEntry.create({
        data: {
          topicId,
          score: analysis.sentimentScore,
          confidence: analysis.confidence,
          source: metadata?.source || 'manual',
          content: content.substring(0, 1000),
          metadata: {
            ...analysis.metadata,
            ...metadata,
          },
          timestamp: new Date(),
        },
      });

      // Queue follow-up processing
      await this.sentimentQueue.add('analyze-content', {
        type: 'single',
        data: {
          content,
          topicId,
          source: metadata?.source || 'manual',
          metadata,
        },
      });

      this.logger.log(`Sentiment analysis completed for topic ${topicId}: ${analysis.sentimentScore}`);

      return analysis;
    } catch (error) {
      this.logger.error(`Failed to analyze sentiment for topic ${topicId}:`, error);
      throw error;
    }
  }

  async getSentimentSnapshot(topicId: string, timestamp?: Date): Promise<SentimentSnapshot | null> {
    const cacheKey = `sentiment:${topicId}:${timestamp ? timestamp.getTime() : 'latest'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const snapshot = await this.prisma.sentimentSnapshot.findFirst({
      where: {
        topicId,
        ...(timestamp && { timestamp: { lte: timestamp } }),
      },
      orderBy: { timestamp: 'desc' },
    });

    if (snapshot) {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(snapshot));
    }

    return snapshot;
  }

  async getSentimentHistory(
    topicId: string,
    startTime: Date,
    endTime: Date,
    interval: number = 60, // minutes
  ): Promise<Array<{ timestamp: Date; sentimentScore: number; confidence: number }>> {
    const cacheKey = `sentiment:${topicId}:history:${startTime.getTime()}:${endTime.getTime()}:${interval}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const snapshots = await this.prisma.sentimentSnapshot.findMany({
      where: {
        topicId,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group snapshots by intervals
    const intervalMs = interval * 60 * 1000;
    const grouped: { [key: number]: SentimentSnapshot[] } = {};

    for (const snapshot of snapshots) {
      const intervalKey = Math.floor(snapshot.timestamp.getTime() / intervalMs) * intervalMs;
      if (!grouped[intervalKey]) {
        grouped[intervalKey] = [];
      }
      grouped[intervalKey].push(snapshot);
    }

    // Calculate average sentiment for each interval
    const history = Object.entries(grouped).map(([timestamp, snapshots]) => {
      const avgSentiment = snapshots.reduce((sum, s) => sum + s.sentimentScore, 0) / snapshots.length;
      const avgConfidence = snapshots.reduce((sum, s) => sum + s.confidence, 0) / snapshots.length;

      return {
        timestamp: new Date(parseInt(timestamp)),
        sentimentScore: Math.round(avgSentiment * 1000) / 1000,
        confidence: Math.round(avgConfidence * 1000) / 1000,
      };
    });

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(history));

    return history;
  }

  async aggregateSentimentByTopic(topicIds: string[], timeWindow: number = 60): Promise<any> {
    const timeAgo = new Date(Date.now() - timeWindow * 60 * 1000);

    const results = await Promise.all(
      topicIds.map(async (topicId) => {
        const snapshots = await this.prisma.sentimentSnapshot.findMany({
          where: {
            topicId,
            timestamp: { gte: timeAgo },
          },
        });

        if (snapshots.length === 0) {
          return { topicId, count: 0 };
        }

        const avgSentiment = snapshots.reduce((sum, s) => sum + s.sentimentScore, 0) / snapshots.length;
        const avgConfidence = snapshots.reduce((sum, s) => sum + s.confidence, 0) / snapshots.length;

        // Calculate emotion aggregates
        const emotionAggregates = snapshots.reduce(
          (acc, snapshot) => {
            Object.keys(snapshot.emotions as any).forEach((emotion) => {
              acc[emotion] = (acc[emotion] || 0) + (snapshot.emotions as any)[emotion];
            });
            return acc;
          },
          {} as any,
        );

        Object.keys(emotionAggregates).forEach((emotion) => {
          emotionAggregates[emotion] = emotionAggregates[emotion] / snapshots.length;
        });

        return {
          topicId,
          count: snapshots.length,
          avgSentiment: Math.round(avgSentiment * 1000) / 1000,
          avgConfidence: Math.round(avgConfidence * 1000) / 1000,
          emotions: emotionAggregates,
        };
      }),
    );

    return results;
  }

  async getSentimentTrends(
    topicId: string,
    periods: number = 7, // number of periods
    periodLength: number = 24, // hours per period
  ): Promise<Array<{ period: Date; trend: 'rising' | 'falling' | 'stable'; change: number }>> {
    const trends: Array<{ period: Date; trend: 'rising' | 'falling' | 'stable'; change: number }> = [];

    for (let i = periods - 1; i >= 0; i--) {
      const periodStart = new Date(Date.now() - (i + 1) * periodLength * 60 * 60 * 1000);
      const periodEnd = new Date(Date.now() - i * periodLength * 60 * 60 * 1000);

      const snapshots = await this.prisma.sentimentSnapshot.findMany({
        where: {
          topicId,
          timestamp: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
      });

      if (snapshots.length > 0) {
        const avgSentiment = snapshots.reduce((sum, s) => sum + s.sentimentScore, 0) / snapshots.length;

        let trend: 'rising' | 'falling' | 'stable' = 'stable';
        let change = 0;

        if (i < periods - 1) {
          const previousPeriod = trends[periods - 2 - i];
          if (previousPeriod) {
            change = avgSentiment - previousPeriod.change; // Using change as previous avg
            if (Math.abs(change) > 0.1) {
              trend = change > 0 ? 'rising' : 'falling';
            }
          }
        }

        trends.push({
          period: periodStart,
          trend,
          change: avgSentiment,
        });
      }
    }

    return trends;
  }

  async batchAnalyzeSentiment(ingestEventIds: string[]): Promise<void> {
    // Get ingest events
    const events = await this.prisma.ingestEvent.findMany({
      where: {
        id: { in: ingestEventIds },
      },
    });

    // Queue batch processing
    await this.sentimentQueue.add('batch-analyze', {
      events,
    });

    this.logger.log(`Queued batch sentiment analysis for ${events.length} events`);
  }

  async getSentimentVolatility(topicId: string, timeWindow: number = 24): Promise<number> {
    const startTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    const snapshots = await this.prisma.sentimentSnapshot.findMany({
      where: {
        topicId,
        timestamp: { gte: startTime },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (snapshots.length < 2) {
      return 0;
    }

    // Calculate standard deviation of sentiment scores
    const sentiments = snapshots.map(s => s.sentimentScore);
    const mean = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sentiments.length;

    return Math.sqrt(variance);
  }

  async detectSentimentShifts(
    topicId: string,
    threshold: number = 0.5,
    timeWindow: number = 12, // hours
  ): Promise<Array<{ timestamp: Date; beforeSentiment: number; afterSentiment: number; shift: number }>> {
    const startTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    const snapshots = await this.prisma.sentimentSnapshot.findMany({
      where: {
        topicId,
        timestamp: { gte: startTime },
      },
      orderBy: { timestamp: 'asc' },
    });

    const shifts: Array<{ timestamp: Date; beforeSentiment: number; afterSentiment: number; shift: number }> = [];

    for (let i = 1; i < snapshots.length; i++) {
      const current = snapshots[i];
      const previous = snapshots[i - 1];

      const shift = Math.abs(current.sentimentScore - previous.sentimentScore);

      if (shift >= threshold) {
        shifts.push({
          timestamp: current.timestamp,
          beforeSentiment: previous.sentimentScore,
          afterSentiment: current.sentimentScore,
          shift,
        });
      }
    }

    return shifts;
  }

  async getTopPositiveTopics(limit: number = 10, timeWindow: number = 24): Promise<Array<{ topicId: string; avgSentiment: number; count: number }>> {
    const timeAgo = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    const results = await this.prisma.sentimentSnapshot.groupBy({
      by: ['topicId'],
      where: {
        timestamp: { gte: timeAgo },
      },
      _avg: {
        sentimentScore: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _avg: {
          sentimentScore: 'desc',
        },
      },
      take: limit,
    });

    return results.map(result => ({
      topicId: result.topicId,
      avgSentiment: Math.round((result._avg.sentimentScore || 0) * 1000) / 1000,
      count: result._count.id,
    }));
  }

  async getTopNegativeTopics(limit: number = 10, timeWindow: number = 24): Promise<Array<{ topicId: string; avgSentiment: number; count: number }>> {
    const timeAgo = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    const results = await this.prisma.sentimentSnapshot.groupBy({
      by: ['topicId'],
      where: {
        timestamp: { gte: timeAgo },
      },
      _avg: {
        sentimentScore: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _avg: {
          sentimentScore: 'asc',
        },
      },
      take: limit,
    });

    return results.map(result => ({
      topicId: result.topicId,
      avgSentiment: Math.round((result._avg.sentimentScore || 0) * 1000) / 1000,
      count: result._count.id,
    }));
  }

  async getSentimentEntries(
    topicId: string,
    page: number = 1,
    limit: number = 20,
    source?: string,
    minConfidence?: number,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { topicId };

    if (source) {
      where.source = source;
    }

    if (minConfidence) {
      where.confidence = { gte: minConfidence };
    }

    const [entries, total] = await Promise.all([
      this.prisma.sentimentEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          score: true,
          confidence: true,
          source: true,
          content: true,
          metadata: true,
          timestamp: true,
        },
      }),
      this.prisma.sentimentEntry.count({ where }),
    ]);

    return {
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSentimentOverview(timeWindow: '1h' | '24h' | '7d' = '24h') {
    const timeFilter = this.getTimeFilter(timeWindow);

    const [totalEntries, avgScore, topicCount] = await Promise.all([
      this.prisma.sentimentEntry.count({
        where: {
          timestamp: {
            gte: timeFilter.from,
          },
        },
      }),
      this.prisma.sentimentEntry.aggregate({
        where: {
          timestamp: {
            gte: timeFilter.from,
          },
        },
        _avg: {
          score: true,
        },
      }),
      this.prisma.sentimentEntry.findMany({
        where: {
          timestamp: {
            gte: timeFilter.from,
          },
        },
        select: {
          topicId: true,
        },
        distinct: ['topicId'],
      }).then(topics => topics.length),
    ]);

    return {
      timeWindow,
      totalEntries,
      averageScore: avgScore._avg.score || 0,
      topicCount,
      periodStart: timeFilter.from,
      periodEnd: timeFilter.to,
    };
  }

  async queueSentimentAnalysis(data: {
    content: string;
    topicId?: string;
    source?: string;
    metadata?: any;
  }) {
    await this.sentimentQueue.add('analyze-content', {
      type: 'single',
      data,
    });

    return { message: 'Sentiment analysis job queued', jobId: data.content.substring(0, 50) };
  }

  async queueBatchSentimentAnalysis(topicIds: string[], forceRefresh: boolean = false) {
    await this.sentimentQueue.add('analyze-content', {
      type: 'batch',
      data: {
        topicIds,
        forceRefresh,
      },
    });

    return { message: 'Batch sentiment analysis job queued', topicCount: topicIds.length };
  }

  async getTopicSentimentStats(topicId: string, timeFilter: { from: Date; to: Date }) {
    const [entries, sentimentData] = await Promise.all([
      this.prisma.sentimentEntry.count({
        where: {
          topicId,
          timestamp: {
            gte: timeFilter.from,
            lte: timeFilter.to,
          },
        },
      }),
      this.prisma.sentimentEntry.aggregate({
        where: {
          topicId,
          timestamp: {
            gte: timeFilter.from,
            lte: timeFilter.to,
          },
        },
        _avg: {
          score: true,
          confidence: true,
        },
        _min: {
          score: true,
        },
        _max: {
          score: true,
        },
      }),
    ]);

    return {
      topicId,
      period: timeFilter,
      totalEntries: entries,
      averageScore: sentimentData._avg.score || 0,
      averageConfidence: sentimentData._avg.confidence || 0,
      minScore: sentimentData._min.score || 0,
      maxScore: sentimentData._max.score || 0,
      scoreRange: (sentimentData._max.score || 0) - (sentimentData._min.score || 0),
    };
  }

  async cleanupOldData(olderThanDays: number = 30, keepAggregated: boolean = true) {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const deletedCount = await this.prisma.sentimentEntry.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${deletedCount.count} old sentiment entries older than ${olderThanDays} days`);

    return { deletedEntries: deletedCount.count, cutoffDate };
  }

  private async performSimpleSentimentAnalysis(content: string): Promise<SentimentAnalysis> {
    // Simple rule-based sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'happy', 'positive'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'disgusting', 'poor', 'negative', 'sad'];

    const words = content.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;

    let sentimentScore = 0;
    if (positiveCount > negativeCount) {
      sentimentScore = Math.min(0.9, 0.3 + (positiveCount - negativeCount) / words.length);
    } else if (negativeCount > positiveCount) {
      sentimentScore = Math.max(-0.9, -0.3 - (negativeCount - positiveCount) / words.length);
    } else {
      sentimentScore = (Math.random() - 0.5) * 0.2; // Small random for neutral
    }

    const confidence = 0.6 + Math.random() * 0.35;

    return {
      sentimentScore,
      confidence,
      emotions: {
        joy: Math.max(0, sentimentScore) * 0.8,
        anger: Math.max(0, -sentimentScore) * 0.6,
        fear: Math.random() * 0.2,
        sadness: Math.max(0, -sentimentScore) * 0.4,
        surprise: Math.random() * 0.3,
        disgust: Math.max(0, -sentimentScore) * 0.3,
      },
      metadata: {
        model: 'simple-rule-based',
        version: '1.0.0',
        processedAt: new Date(),
        wordCount: words.length,
        positiveWords: positiveCount,
        negativeWords: negativeCount,
      },
    };
  }

  private getTimeFilter(timeWindow: '1h' | '24h' | '7d'): { from: Date; to: Date } {
    const now = new Date();
    let from: Date;

    switch (timeWindow) {
      case '1h':
        from = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { from, to: now };
  }
}