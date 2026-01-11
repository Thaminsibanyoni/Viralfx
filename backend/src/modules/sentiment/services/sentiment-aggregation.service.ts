import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';

interface SentimentData {
  topicId: string;
  score: number;
  confidence: number;
  source: string;
  metadata?: any;
  timestamp: Date;
}

interface AggregatedSentiment {
  topicId: string;
  averageScore: number;
  totalEntries: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  confidence: number;
  lastUpdated: Date;
  trendScore?: number;
  volatilityScore?: number;
}

@Injectable()
export class SentimentAggregationService {
  private readonly logger = new Logger(SentimentAggregationService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis) {}

  async aggregateSentiment(topicId: string, timeWindow?: { from: Date; to: Date }): Promise<AggregatedSentiment> {
    const cacheKey = `sentiment:aggregated:${topicId}:${JSON.stringify(timeWindow)}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Build time window filter
    const timeFilter = timeWindow ? {
      gte: timeWindow.from,
      lte: timeWindow.to
    } : {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    };

    // Fetch sentiment entries from the last 24 hours
    const sentiments = await this.prisma.sentimentEntry.findMany({
      where: {
        topicId,
        timestamp: timeFilter
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 1000 // Limit to recent entries for performance
    });

    if (sentiments.length === 0) {
      const emptyResult: AggregatedSentiment = {
        topicId,
        averageScore: 0,
        totalEntries: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        confidence: 0,
        lastUpdated: new Date()
      };

      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(emptyResult));
      return emptyResult;
    }

    // Calculate aggregated metrics
    const totalEntries = sentiments.length;
    const averageScore = sentiments.reduce((sum, s) => sum + s.score, 0) / totalEntries;

    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    sentiments.forEach(sentiment => {
      if (sentiment.score > 0.1) {
        positiveCount++;
      } else if (sentiment.score < -0.1) {
        negativeCount++;
      } else {
        neutralCount++;
      }
    });

    // Calculate confidence based on number of entries and consistency
    const confidence = Math.min(
      0.95,
      (totalEntries / 100) * (1 - this.calculateVolatility(sentiments))
    );

    // Calculate trend score (momentum)
    const trendScore = this.calculateTrendScore(sentiments);

    // Calculate volatility score
    const volatilityScore = this.calculateVolatility(sentiments);

    const result: AggregatedSentiment = {
      topicId,
      averageScore,
      totalEntries,
      positiveCount,
      negativeCount,
      neutralCount,
      confidence,
      lastUpdated: new Date(),
      trendScore,
      volatilityScore
    };

    // Cache the result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    // Store aggregated sentiment in database
    await this.prisma.sentimentAggregated.upsert({
      where: {
        topicId_timeWindow: {
          topicId,
          timeWindow: timeWindow?.from.toISOString() || '24h'
        }
      },
      update: {
        averageScore,
        totalEntries,
        positiveCount,
        negativeCount,
        neutralCount,
        confidence,
        trendScore,
        volatilityScore,
        lastUpdated: new Date()
      },
      create: {
        topicId,
        timeWindow: timeWindow?.from.toISOString() || '24h',
        averageScore,
        totalEntries,
        positiveCount,
        negativeCount,
        neutralCount,
        confidence,
        trendScore,
        volatilityScore
      }
    });

    this.logger.log(`Aggregated sentiment for topic ${topicId}: ${averageScore.toFixed(3)} (${totalEntries} entries)`);

    return result;
  }

  async getSentimentHistory(
    topicId: string,
    interval: 'hour' | 'day' | 'week' = 'hour',
    limit: number = 24
  ): Promise<Array<{ timestamp: Date; score: number; confidence: number }>> {
    const cacheKey = `sentiment:history:${topicId}:${interval}:${limit}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    let timeGrouping: string;
    switch (interval) {
      case 'hour':
        timeGrouping = 'DATE_TRUNC(\'hour\', timestamp)';
        break;
      case 'day':
        timeGrouping = 'DATE_TRUNC(\'day\', timestamp)';
        break;
      case 'week':
        timeGrouping = 'DATE_TRUNC(\'week\', timestamp)';
        break;
    }

    const history = await this.prisma.$queryRaw<Array<{ timestamp: Date; score: number; confidence: number }>>`
      SELECT
        ${timeGrouping} as timestamp,
        AVG(score) as score,
        AVG(confidence) as confidence
      FROM sentiment_entries
      WHERE topicId = ${topicId}
        AND timestamp >= NOW() - INTERVAL '${limit * (interval === 'hour' ? 1 : interval === 'day' ? 24 : 168)} hours'
      GROUP BY ${timeGrouping}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    // Reverse to chronological order
    const orderedHistory = history.reverse();

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(orderedHistory));

    return orderedHistory;
  }

  async getTopSentimentTopics(limit: number = 10, timeWindow: '1h' | '24h' | '7d' = '24h'): Promise<Array<{
    topicId: string;
    topicName: string;
    averageScore: number;
    totalEntries: number;
    trendScore: number;
  }>> {
    const cacheKey = `sentiment:top:${limit}:${timeWindow}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const timeFilter = this.getTimeFilterFromWindow(timeWindow);

    const topTopics = await this.prisma.sentimentAggregated.findMany({
      where: {
        lastUpdated: {
          gte: timeFilter
        }
      },
      orderBy: {
        totalEntries: 'desc'
      },
      take: limit,
      include: {
        topic: {
          select: {
            name: true
          }
        }
      }
    });

    const result = topTopics.map(topic => ({
      topicId: topic.topicId,
      topicName: topic.topic?.name || 'Unknown',
      averageScore: topic.averageScore,
      totalEntries: topic.totalEntries,
      trendScore: topic.trendScore || 0
    }));

    await this.redis.setex(cacheKey, 300, JSON.stringify(result)); // 5 minutes cache

    return result;
  }

  async batchAggregateTopics(topicIds: string[]): Promise<Map<string, AggregatedSentiment>> {
    const results = new Map<string, AggregatedSentiment>();

    // Process in parallel batches
    const batchSize = 5;
    for (let i = 0; i < topicIds.length; i += batchSize) {
      const batch = topicIds.slice(i, i + batchSize);
      const batchPromises = batch.map(topicId =>
        this.aggregateSentiment(topicId)
          .then(result => ({ topicId, result }))
          .catch(error => {
            this.logger.error(`Failed to aggregate sentiment for topic ${topicId}:`, error);
            return null;
          })
      );

      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach(item => {
        if (item) {
          results.set(item.topicId, item.result);
        }
      });
    }

    return results;
  }

  async cleanupOldAggregations(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const deletedCount = await this.prisma.sentimentAggregated.deleteMany({
      where: {
        lastUpdated: {
          lt: thirtyDaysAgo
        },
        timeWindow: {
          not: '24h' // Keep 24h aggregations
        }
      }
    });

    this.logger.log(`Cleaned up ${deletedCount.count} old sentiment aggregations`);
  }

  private calculateTrendScore(sentiments: any[]): number {
    if (sentiments.length < 2) return 0;

    // Take recent entries (last 20%) and compare with older entries
    const recentCount = Math.max(1, Math.floor(sentiments.length * 0.2));
    const recentSentiments = sentiments.slice(0, recentCount);
    const olderSentiments = sentiments.slice(recentCount);

    const recentAverage = recentSentiments.reduce((sum, s) => sum + s.score, 0) / recentSentiments.length;
    const olderAverage = olderSentiments.length > 0
      ? olderSentiments.reduce((sum, s) => sum + s.score, 0) / olderSentiments.length
      : 0;

    return recentAverage - olderAverage;
  }

  private calculateVolatility(sentiments: any[]): number {
    if (sentiments.length < 2) return 0;

    const scores = sentiments.map(s => s.score);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    const variance = scores.reduce((sum, score) => {
      const diff = score - mean;
      return sum + (diff * diff);
    }, 0) / scores.length;

    return Math.sqrt(variance);
  }

  private getTimeFilterFromWindow(timeWindow: '1h' | '24h' | '7d'): Date {
    switch (timeWindow) {
      case '1h':
        return new Date(Date.now() - 60 * 60 * 1000);
      case '24h':
        return new Date(Date.now() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      default:
        return new Date(Date.now() - 24 * 60 * 60 * 1000);
    }
  }
}
