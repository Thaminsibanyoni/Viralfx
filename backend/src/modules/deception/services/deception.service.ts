import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface DeceptionSnapshot {
  id: string;
  topicId: string;
  deceptionScore: number;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flaggedContent: string[];
  analysisDetails: any;
  timestamp: Date;
}

interface DeceptionAnalysis {
  deceptionScore: number;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flaggedPhrases: string[];
  manipulationIndicators: string[];
  credibilityScore: number;
  sourceReliability: number;
  metadata: any;
}

@Injectable()
export class DeceptionService {
  private readonly logger = new Logger(DeceptionService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
    @InjectQueue('deception-analysis')
    private readonly deceptionQueue: Queue,
    @InjectQueue('high-risk-content')
    private readonly highRiskQueue: Queue) {}

  async analyzeDeception(
    content: string,
    topicId: string,
    source?: string,
    metadata?: any): Promise<DeceptionAnalysis> {
    try {
      const analysis = await this.performDeceptionAnalysis(content);

      // Store deception snapshot
      const snapshot = await this.prisma.deceptionSnapshot.create({
        data: {
          topicId,
          deceptionScore: analysis.deceptionScore,
          confidence: analysis.confidence,
          riskLevel: analysis.riskLevel,
          flaggedContent: analysis.flaggedPhrases,
          analysisDetails: {
            ...analysis,
            content: content.substring(0, 1000),
            source,
            ...metadata
          },
          timestamp: new Date()
        }
      });

      // Cache recent analysis
      const cacheKey = `deception:${topicId}:latest`;
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(snapshot));

      // Queue follow-up processing for high-risk content
      if (analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'CRITICAL') {
        await this.highRiskQueue.add('process-high-risk', {
          snapshotId: snapshot.id,
          topicId,
          analysis,
          content
        });
      }

      // Queue background processing
      await this.deceptionQueue.add('process-deception-update', {
        topicId,
        snapshotId: snapshot.id,
        analysis
      });

      this.logger.log(
        `Deception analysis completed for topic ${topicId}: ${analysis.deceptionScore.toFixed(3)} (${analysis.riskLevel})`);

      return analysis;
    } catch (error) {
      this.logger.error(`Failed to analyze deception for topic ${topicId}:`, error);
      throw error;
    }
  }

  async getDeceptionSnapshot(
    topicId: string,
    timestamp?: Date): Promise<DeceptionSnapshot | null> {
    const cacheKey = `deception:${topicId}:${timestamp ? timestamp.getTime() : 'latest'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const snapshot = await this.prisma.deceptionSnapshot.findFirst({
      where: {
        topicId,
        ...(timestamp && { timestamp: { lte: timestamp } })
      },
      orderBy: { timestamp: 'desc' }
    });

    if (snapshot) {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(snapshot));
    }

    return snapshot;
  }

  async getDeceptionHistory(
    topicId: string,
    startTime: Date,
    endTime: Date,
    interval: number = 60, // minutes
  ): Promise<Array<{ timestamp: Date; deceptionScore: number; riskLevel: string; confidence: number }>> {
    const cacheKey = `deception:${topicId}:history:${startTime.getTime()}:${endTime.getTime()}:${interval}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const snapshots = await this.prisma.deceptionSnapshot.findMany({
      where: {
        topicId,
        timestamp: {
          gte: startTime,
          lte: endTime
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Group snapshots by intervals
    const intervalMs = interval * 60 * 1000;
    const grouped: { [key: number]: any[] } = {};

    for (const snapshot of snapshots) {
      const intervalKey = Math.floor(snapshot.timestamp.getTime() / intervalMs) * intervalMs;
      if (!grouped[intervalKey]) {
        grouped[intervalKey] = [];
      }
      grouped[intervalKey].push(snapshot);
    }

    // Calculate average deception for each interval
    const history = Object.entries(grouped).map(([timestamp, snapshots]) => {
      const avgDeception = snapshots.reduce((sum, s) => sum + s.deceptionScore, 0) / snapshots.length;
      const avgConfidence = snapshots.reduce((sum, s) => sum + s.confidence, 0) / snapshots.length;

      // Determine highest risk level in the interval
      const riskLevels = snapshots.map(s => s.riskLevel);
      const highestRisk = this.getHighestRiskLevel(riskLevels);

      return {
        timestamp: new Date(parseInt(timestamp)),
        deceptionScore: Math.round(avgDeception * 1000) / 1000,
        riskLevel: highestRisk,
        confidence: Math.round(avgConfidence * 1000) / 1000
      };
    });

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(history));

    return history;
  }

  async getHighRiskContent(
    limit: number = 20,
    minRiskLevel: 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH',
    timeWindow: number = 24, // hours
  ): Promise<DeceptionSnapshot[]> {
    const timeAgo = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    const riskLevels = this.getRiskLevelsAndAbove(minRiskLevel);

    return this.prisma.deceptionSnapshot.findMany({
      where: {
        timestamp: { gte: timeAgo },
        riskLevel: { in: riskLevels }
      },
      orderBy: [
        { deceptionScore: 'desc' },
        { timestamp: 'desc' },
      ],
      take: limit
    });
  }

  async getDeceptionStats(
    topicId: string,
    timeWindow: number = 24, // hours
  ): Promise<{
    totalAnalyses: number;
    averageDeceptionScore: number;
    riskDistribution: Record<string, number>;
    trendDirection: 'increasing' | 'decreasing' | 'stable';
    highRiskCount: number;
  }> {
    const timeAgo = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    const [snapshots, stats] = await Promise.all([
      this.prisma.deceptionSnapshot.findMany({
        where: {
          topicId,
          timestamp: { gte: timeAgo }
        },
        orderBy: { timestamp: 'asc' }
      }),
      this.prisma.deceptionSnapshot.aggregate({
        where: {
          topicId,
          timestamp: { gte: timeAgo }
        },
        _avg: {
          deceptionScore: true
        },
        _count: {
          id: true
        }
      }),
    ]);

    // Calculate risk distribution
    const riskDistribution = snapshots.reduce((acc, snapshot) => {
      acc[snapshot.riskLevel] = (acc[snapshot.riskLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate trend direction
    const trendDirection = this.calculateTrendDirection(snapshots);

    // Count high risk content
    const highRiskCount = snapshots.filter(s =>
      s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL'
    ).length;

    return {
      totalAnalyses: stats._count.id,
      averageDeceptionScore: stats._avg.deceptionScore || 0,
      riskDistribution,
      trendDirection,
      highRiskCount
    };
  }

  async updateDeceptionStatus(
    snapshotId: string,
    status: 'REVIEWED' | 'FALSE_POSITIVE' | 'CONFIRMED',
    reviewerId: string,
    notes?: string): Promise<DeceptionSnapshot> {
    const updatedSnapshot = await this.prisma.deceptionSnapshot.update({
      where: { id: snapshotId },
      data: {
        analysisDetails: {
          reviewStatus: status,
          reviewerId,
          reviewedAt: new Date(),
          reviewNotes: notes
        }
      }
    });

    this.logger.log(`Updated deception status for snapshot ${snapshotId} to ${status}`);

    return updatedSnapshot;
  }

  async queueDeceptionAnalysis(data: {
    content: string;
    topicId?: string;
    source?: string;
    metadata?: any;
  }) {
    await this.deceptionQueue.add('analyze-deception', {
      type: 'single',
      data
    });

    return { message: 'Deception analysis job queued', jobId: data.content.substring(0, 50) };
  }

  async batchAnalyzeDeception(contents: Array<{
    content: string;
    topicId: string;
    source?: string;
    metadata?: any;
  }>) {
    await this.deceptionQueue.add('analyze-deception', {
      type: 'batch',
      data: { contents }
    });

    return { message: 'Batch deception analysis job queued', contentCount: contents.length };
  }

  async cleanupOldData(olderThanDays: number = 90): Promise<{ deletedSnapshots: number }> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const deletedCount = await this.prisma.deceptionSnapshot.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        },
        riskLevel: {
          not: 'CRITICAL' // Keep critical content longer
        }
      }
    });

    this.logger.log(`Cleaned up ${deletedCount.count} old deception snapshots older than ${olderThanDays} days`);

    return { deletedSnapshots: deletedCount.count };
  }

  private async performDeceptionAnalysis(content: string): Promise<DeceptionAnalysis> {
    // Deception detection keywords and patterns
    const deceptivePhrases = [
      'guaranteed', 'secret', 'exclusive', 'limited time', 'act now',
      'shocking', 'unbelievable', 'miracle', 'breakthrough',
      'fake news', 'conspiracy', 'cover up', 'hidden truth',
      'they don\'t want you to know', 'mainstream media won\'t report',
    ];

    const manipulationIndicators = [
      'everyone agrees', 'experts say', 'studies show',
      'it\'s obvious', 'clearly', 'undoubtedly',
      'conspiracy', 'agenda', 'propaganda',
    ];

    const words = content.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    // Count deceptive phrases
    const flaggedPhrases: string[] = [];
    for (const phrase of deceptivePhrases) {
      if (contentLower.includes(phrase)) {
        flaggedPhrases.push(phrase);
      }
    }

    // Count manipulation indicators
    const foundIndicators: string[] = [];
    for (const indicator of manipulationIndicators) {
      if (contentLower.includes(indicator)) {
        foundIndicators.push(indicator);
      }
    }

    // Calculate deception score based on multiple factors
    const phraseScore = Math.min(flaggedPhrases.length * 0.2, 0.6);
    const indicatorScore = Math.min(foundIndicators.length * 0.15, 0.4);
    const emotionalWords = this.countEmotionalWords(content);
    const emotionalScore = Math.min(emotionalWords / words.length * 2, 0.3);

    const deceptionScore = Math.min(phraseScore + indicatorScore + emotionalScore, 1.0);

    // Calculate confidence based on content length and number of indicators
    const confidence = Math.min(
      0.95,
      0.5 + (flaggedPhrases.length + foundIndicators.length) / 10 + Math.min(words.length / 500, 0.3)
    );

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (deceptionScore >= 0.8) {
      riskLevel = 'CRITICAL';
    } else if (deceptionScore >= 0.6) {
      riskLevel = 'HIGH';
    } else if (deceptionScore >= 0.3) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    // Calculate credibility score (inverse of deception)
    const credibilityScore = Math.max(0.1, 1 - deceptionScore);

    // Source reliability (simplified - would normally check source reputation)
    const sourceReliability = 0.5 + Math.random() * 0.5;

    return {
      deceptionScore,
      confidence,
      riskLevel,
      flaggedPhrases,
      manipulationIndicators: foundIndicators,
      credibilityScore,
      sourceReliability,
      metadata: {
        model: 'deception-detection-v1',
        version: '1.0.0',
        processedAt: new Date(),
        wordCount: words.length,
        emotionalWordCount: emotionalWords,
        analysisBreakdown: {
          phraseScore,
          indicatorScore,
          emotionalScore
        }
      }
    };
  }

  private countEmotionalWords(content: string): number {
    const emotionalWords = [
      'amazing', 'terrible', 'horrible', 'wonderful', 'awful',
      'shocking', 'outrageous', 'incredible', 'unbelievable',
      'disgusting', 'hate', 'love', 'passion', 'anger',
      'fear', 'disaster', 'catastrophe', 'miracle',
    ];

    const words = content.toLowerCase().split(/\s+/);
    return words.filter(word => emotionalWords.includes(word)).length;
  }

  private getHighestRiskLevel(riskLevels: string[]): string {
    const riskHierarchy = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    for (const level of riskHierarchy) {
      if (riskLevels.includes(level)) {
        return level;
      }
    }

    return 'LOW';
  }

  private getRiskLevelsAndAbove(minLevel: 'MEDIUM' | 'HIGH' | 'CRITICAL'): string[] {
    const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const startIndex = levels.indexOf(minLevel);
    return levels.slice(startIndex);
  }

  private calculateTrendDirection(snapshots: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (snapshots.length < 2) return 'stable';

    const firstHalf = snapshots.slice(0, Math.floor(snapshots.length / 2));
    const secondHalf = snapshots.slice(Math.floor(snapshots.length / 2));

    const firstAvg = firstHalf.reduce((sum, s) => sum + s.deceptionScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.deceptionScore, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;

    if (Math.abs(difference) < 0.1) {
      return 'stable';
    } else if (difference > 0) {
      return 'increasing';
    } else {
      return 'decreasing';
    }
  }
}
