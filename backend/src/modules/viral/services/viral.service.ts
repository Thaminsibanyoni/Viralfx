import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ViralIndexService } from './viral-index.service';
import { ViralMetricsService } from './viral-metrics.service';

interface ViralContent {
  id: string;
  topicId: string;
  content: string;
  source: string;
  authorId?: string;
  metadata?: any;
  createdAt: Date;
}

interface ViralAnalysis {
  viralScore: number;
  viralIndex: number;
  momentumScore: number;
  engagementScore: number;
  reachScore: number;
  timestamp: number;
  predictedVirality: number;
  viralityFactors: {
    emotionalImpact: number;
    socialProof: number;
    noveltyScore: number;
    controversyLevel: number;
    timelinessScore: number;
    platformFit: number;
  };
}

@Injectable()
export class ViralService {
  private readonly logger = new Logger(ViralService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
    private readonly viralIndexService: ViralIndexService,
    private readonly viralMetricsService: ViralMetricsService,
    @InjectQueue('viral-index-calculation')
    private readonly viralIndexQueue: Queue,
    @InjectQueue('viral-content-analysis')
    private readonly viralAnalysisQueue: Queue,
  ) {}

  async analyzeContentVirality(
    content: string,
    topicId: string,
    source?: string,
    authorId?: string,
    metadata?: any,
  ): Promise<ViralAnalysis> {
    try {
      const cacheKey = `viral:analysis:${this.generateContentHash(content)}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Perform comprehensive virality analysis
      const analysis = await this.performViralityAnalysis(content);

      // Store viral content entry
      await this.prisma.viralContent.create({
        data: {
          topicId,
          content: content.substring(0, 1000), // Store truncated content
          source: source || 'manual',
          authorId,
          viralScore: analysis.viralScore,
          viralIndex: analysis.viralIndex,
          momentumScore: analysis.momentumScore,
          engagementScore: analysis.engagementScore,
          reachScore: analysis.reachScore,
          predictedVirality: analysis.predictedVirality,
          viralityFactors: analysis.viralityFactors,
          metadata: {
            ...metadata,
            fullContentLength: content.length,
            analysisVersion: '1.0',
          },
          createdAt: new Date(),
        },
      });

      // Cache the analysis
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(analysis));

      // Queue background processing for viral index updates
      await this.viralIndexQueue.add('update-viral-index', {
        topicId,
        contentId: content.substring(0, 50), // Use content hash as ID
        analysis,
      });

      this.logger.log(
        `Virality analysis completed for topic ${topicId}: Score ${analysis.viralScore.toFixed(3)}, Index ${analysis.viralIndex.toFixed(3)}`,
      );

      return analysis;
    } catch (error) {
      this.logger.error(`Failed to analyze virality for topic ${topicId}:`, error);
      throw error;
    }
  }

  async getViralContent(
    topicId: string,
    limit: number = 20,
    minViralScore: number = 0.5,
  ): Promise<ViralContent[]> {
    const cacheKey = `viral:content:${topicId}:${limit}:${minViralScore}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const viralContent = await this.prisma.viralContent.findMany({
      where: {
        topicId,
        viralScore: { gte: minViralScore },
      },
      orderBy: { viralScore: 'desc' },
      take: limit,
      select: {
        id: true,
        topicId: true,
        content: true,
        source: true,
        authorId: true,
        metadata: true,
        createdAt: true,
      },
    });

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(viralContent));

    return viralContent;
  }

  async getTrendingViralContent(
    timeWindow: number = 24, // hours
    limit: number = 10,
  ): Promise<Array<{
    id: string;
    topicId: string;
    topicName: string;
    viralScore: number;
    viralIndex: number;
    momentumScore: number;
    engagementRate: number;
    createdAt: Date;
  }>> {
    const timeAgo = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    const trending = await this.prisma.viralContent.findMany({
      where: {
        createdAt: { gte: timeAgo },
        viralScore: { gte: 0.7 },
      },
      include: {
        topic: {
          select: { name: true },
        },
      },
      orderBy: { momentumScore: 'desc' },
      take: limit,
    });

    return trending.map(item => ({
      id: item.id,
      topicId: item.topicId,
      topicName: item.topic?.name || 'Unknown',
      viralScore: item.viralScore,
      viralIndex: item.viralIndex,
      momentumScore: item.momentumScore,
      engagementRate: item.engagementScore,
      createdAt: item.createdAt,
    }));
  }

  async calculateTopicVirality(
    topicId: string,
    timeWindow: number = 24, // hours
  ): Promise<{
    overallVirality: number;
    viralIndex: number;
    momentumScore: number;
    engagementMetrics: {
      totalContent: number;
      avgVirality: number;
      peakVirality: number;
      growthRate: number;
    };
    predictiveInsights: {
      nextHourPrediction: number;
      nextDayPrediction: number;
      viralPotential: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      recommendations: string[];
    };
  }> {
    const timeAgo = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    const [contentMetrics, topicMetrics] = await Promise.all([
      this.viralMetricsService.getContentMetrics(topicId, timeAgo),
      this.viralIndexService.calculateTopicViralIndex(topicId, timeWindow),
    ]);

    const overallVirality = this.calculateOverallVirality(contentMetrics, topicMetrics);

    const predictiveInsights = await this.generatePredictiveInsights(
      topicId,
      contentMetrics,
      topicMetrics,
    );

    return {
      overallVirality,
      viralIndex: topicMetrics.index,
      momentumScore: topicMetrics.momentum,
      engagementMetrics: {
        totalContent: contentMetrics.total,
        avgVirality: contentMetrics.averageScore,
        peakVirality: contentMetrics.peakScore,
        growthRate: contentMetrics.growthRate,
      },
      predictiveInsights,
    };
  }

  async batchAnalyzeVirality(contents: Array<{
    content: string;
    topicId: string;
    source?: string;
    authorId?: string;
    metadata?: any;
  }>): Promise<Array<ViralAnalysis>> {
    const results: ViralAnalysis[] = [];

    // Process in parallel batches
    const batchSize = 5;
    for (let i = 0; i < contents.length; i += batchSize) {
      const batch = contents.slice(i, i + batchSize);

      const batchPromises = batch.map(item =>
        this.analyzeContentVirality(item.content, item.topicId, item.source, item.authorId, item.metadata)
          .catch(error => {
            this.logger.warn(`Failed to analyze content for topic ${item.topicId}:`, error);
            return null;
          })
      );

      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach(result => {
        if (result) {
          results.push(result);
        }
      });

      // Small delay between batches to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.log(`Batch virality analysis completed: ${results.length}/${contents.length} items processed`);

    return results;
  }

  async updateViralMetrics(topicId: string): Promise<void> {
    try {
      // Get recent viral content for the topic
      const recentContent = await this.prisma.viralContent.findMany({
        where: {
          topicId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentContent.length === 0) {
        return;
      }

      // Calculate updated metrics
      const metrics = this.viralMetricsService.calculateMetrics(recentContent);

      // Update topic with viral metrics
      await this.prisma.topic.update({
        where: { id: topicId },
        data: {
          viralIndex: metrics.viralIndex,
          viralScore: metrics.viralScore,
          momentumScore: metrics.momentumScore,
          lastViralAnalysis: new Date(),
        },
      });

      // Invalidate cache
      await this.invalidateViralCache(topicId);

      this.logger.debug(`Updated viral metrics for topic ${topicId}`);
    } catch (error) {
      this.logger.error(`Failed to update viral metrics for topic ${topicId}:`, error);
    }
  }

  async queueViralityAnalysis(data: {
    content: string;
    topicId: string;
    source?: string;
    authorId?: string;
    metadata?: any;
  }) {
    await this.viralAnalysisQueue.add('analyze-virality', data);

    return { message: 'Virality analysis job queued', contentId: this.generateContentHash(data.content) };
  }

  private async performViralityAnalysis(content: string): Promise<ViralAnalysis> {
    // Virality factors calculation
    const viralityFactors = await this.calculateViralityFactors(content);

    // Calculate base viral score
    const viralScore = this.calculateViralScore(content, viralityFactors);

    // Calculate momentum based on content characteristics
    const momentumScore = this.calculateMomentumScore(content, viralityFactors);

    // Calculate engagement potential
    const engagementScore = this.calculateEngagementScore(content, viralityFactors);

    // Calculate reach potential
    const reachScore = this.calculateReachScore(content, viralityFactors);

    // Calculate viral index (combined score)
    const viralIndex = (viralScore * 0.4 + momentumScore * 0.3 + engagementScore * 0.2 + reachScore * 0.1);

    // Predict future virality
    const predictedVirality = this.predictVirality(viralIndex, viralityFactors);

    return {
      viralScore,
      viralIndex,
      momentumScore,
      engagementScore,
      reachScore,
      timestamp: Date.now(),
      predictedVirality,
      viralityFactors,
    };
  }

  private async calculateViralityFactors(content: string): Promise<{
    emotionalImpact: number;
    socialProof: number;
    noveltyScore: number;
    controversyLevel: number;
    timelinessScore: number;
    platformFit: number;
  }> {
    const contentLower = content.toLowerCase();
    const words = content.split(/\s+/);

    // Emotional impact
    const emotionalWords = [
      'amazing', 'incredible', 'shocking', 'heartbreaking', 'inspiring',
      'outrageous', 'unbelievable', 'mind-blowing', 'devastating', 'miraculous',
    ];
    const emotionalCount = words.filter(word => emotionalWords.includes(word)).length;
    const emotionalImpact = Math.min(emotionalCount / words.length * 10, 1.0);

    // Social proof indicators
    const socialProofWords = ['everyone', 'millions', 'viral', 'trending', 'popular'];
    const socialProofCount = socialProofWords.filter(word => contentLower.includes(word)).length;
    const socialProof = Math.min(socialProofCount * 0.3, 1.0);

    // Novelty score (unique words and uncommon phrases)
    const uniqueWords = new Set(words).size;
    const noveltyScore = Math.min(uniqueWords / words.length, 1.0);

    // Controversy level
    const controversyWords = [
      'debate', 'controversial', 'disputed', 'conflict', 'controversy',
      'scandal', 'backlash', 'criticism', 'opposition', 'protest',
    ];
    const controversyCount = words.filter(word => controversyWords.includes(word)).length;
    const controversyLevel = Math.min(controversyCount / words.length * 8, 1.0);

    // Timeliness (recent references)
    const timelyWords = ['breaking', 'news', 'latest', 'just in', 'today', 'yesterday'];
    const timelyCount = timelyWords.filter(word => contentLower.includes(word)).length;
    const timelinessScore = Math.min(timelyCount * 0.4, 1.0);

    // Platform fit (social media friendly)
    const hashtags = (content.match(/#\w+/g) || []).length;
    const mentions = (content.match(/@\w+/g) || []).length;
    const platformFit = Math.min((hashtags + mentions) / words.length * 20, 1.0);

    return {
      emotionalImpact,
      socialProof,
      noveltyScore,
      controversyLevel,
      timelinessScore,
      platformFit,
    };
  }

  private calculateViralScore(content: string, factors: any): number {
    // Weight different factors
    const weights = {
      emotionalImpact: 0.3,
      socialProof: 0.2,
      noveltyScore: 0.2,
      controversyLevel: 0.15,
      timelinessScore: 0.1,
      platformFit: 0.05,
    };

    let score = 0;
    for (const [factor, weight] of Object.entries(weights)) {
      score += factors[factor] * weight;
    }

    // Content length bonus (not too short, not too long)
    const length = content.split(/\s+/).length;
    const lengthBonus = length >= 10 && length <= 500 ? 0.1 : 0;

    return Math.min(score + lengthBonus, 1.0);
  }

  private calculateMomentumScore(content: string, factors: any): number {
    // Momentum based on emotional impact and controversy
    const emotionalMomentum = factors.emotionalImpact * 0.4;
    const controversyMomentum = factors.controversyLevel * 0.3;
    const timelinessMomentum = factors.timelinessScore * 0.3;

    return emotionalMomentum + controversyMomentum + timelinessMomentum;
  }

  private calculateEngagementScore(content: string, factors: any): number {
    // Engagement based on social proof and platform fit
    const socialEngagement = factors.socialProof * 0.6;
    const platformEngagement = factors.platformFit * 0.4;

    return socialEngagement + platformEngagement;
  }

  private calculateReachScore(content: string, factors: any): number {
    // Reach based on novelty and emotional impact
    const noveltyReach = factors.noveltyScore * 0.5;
    const emotionalReach = factors.emotionalImpact * 0.5;

    return noveltyReach + emotionalReach;
  }

  private predictVirality(currentIndex: number, factors: any): number {
    // Simple prediction model based on current index and factors
    const growthPotential = factors.emotionalImpact + factors.socialProof;
    const sustainability = factors.noveltyScore + factors.timelinessScore;

    const predictedGrowth = currentIndex + (growthPotential * 0.1) + (sustainability * 0.05);
    return Math.min(predictedGrowth, 1.0);
  }

  private async generatePredictiveInsights(
    topicId: string,
    contentMetrics: any,
    topicMetrics: any,
  ): Promise<{
    nextHourPrediction: number;
    nextDayPrediction: number;
    viralPotential: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommendations: string[];
  }> {
    const currentScore = contentMetrics.averageScore;
    const momentum = topicMetrics.momentum;

    // Simple predictive model
    const nextHourPrediction = currentScore + (momentum * 0.1);
    const nextDayPrediction = currentScore + (momentum * 0.3);

    // Determine viral potential
    let viralPotential: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (nextDayPrediction >= 0.8) {
      viralPotential = 'CRITICAL';
    } else if (nextDayPrediction >= 0.6) {
      viralPotential = 'HIGH';
    } else if (nextDayPrediction >= 0.4) {
      viralPotential = 'MEDIUM';
    } else {
      viralPotential = 'LOW';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (momentum > 0.7) {
      recommendations.push('High momentum detected - consider boosting content');
    }
    if (contentMetrics.growthRate > 0.5) {
      recommendations.push('Rapid growth - monitor for engagement spikes');
    }
    if (currentScore > 0.6) {
      recommendations.push('High viral potential - prepare for increased traffic');
    }

    return {
      nextHourPrediction: Math.min(nextHourPrediction, 1.0),
      nextDayPrediction: Math.min(nextDayPrediction, 1.0),
      viralPotential,
      recommendations,
    };
  }

  private calculateOverallVirality(contentMetrics: any, topicMetrics: any): number {
    return (contentMetrics.averageScore * 0.6 + topicMetrics.index * 0.4);
  }

  private generateContentHash(content: string): string {
    // Simple hash for content identification
    return Buffer.from(content.substring(0, 100)).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  private async invalidateViralCache(topicId: string): Promise<void> {
    const cacheKeys = [
      `viral:content:${topicId}`,
      `viral:analysis:*`,
      `viral:metrics:${topicId}`,
    ];

    // In a real implementation, this would clear Redis cache with proper pattern matching
    for (const key of cacheKeys) {
      if (!key.includes('*')) {
        await this.redis.del(key);
      }
    }
  }
}