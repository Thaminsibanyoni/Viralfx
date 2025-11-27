import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface CreateMarketData {
  title: string;
  description: string;
  topicId: string;
  marketType: 'BINARY' | 'MULTIPLE_CHOICE' | 'RANGE' | 'VOLUME';
  category: string;
  endDate: Date;
  settlementConditions: any;
  initialPrice?: number;
  minBetAmount: number;
  maxBetAmount?: number;
  liquidityPool?: number;
  metadata?: any;
}

interface MarketOutcome {
  id: string;
  title: string;
  probability: number;
  totalVolume: number;
  payouts: number;
  isWinning?: boolean;
}

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
    @InjectQueue('bet-processing')
    private readonly betProcessingQueue: Queue,
    @InjectQueue('market-closure')
    private readonly marketClosureQueue: Queue,
  ) {}

  async createMarket(
    createData: CreateMarketData,
    createdBy: string,
  ): Promise<any> {
    try {
      // Validate topic exists
      const topic = await this.prisma.topic.findUnique({
        where: { id: createData.topicId },
      });

      if (!topic) {
        throw new NotFoundException('Topic not found');
      }

      // Check if market already exists for this topic
      const existingMarket = await this.prisma.market.findFirst({
        where: {
          topicId: createData.topicId,
          status: 'ACTIVE',
        },
      });

      if (existingMarket) {
        throw new ConflictException('Active market already exists for this topic');
      }

      // Validate end date
      if (new Date(createData.endDate) <= new Date()) {
        throw new BadRequestException('End date must be in the future');
      }

      // Calculate initial probabilities based on sentiment and viral data
      const initialProbabilities = await this.calculateInitialProbabilities(createData.topicId);

      // Create market with outcomes
      const market = await this.prisma.market.create({
        data: {
          title: createData.title,
          description: createData.description,
          topicId: createData.topicId,
          marketType: createData.marketType,
          category: createData.category,
          status: 'PENDING',
          startDate: new Date(),
          endDate: new Date(createData.endDate),
          settlementConditions: createData.settlementConditions,
          initialPrice: createData.initialPrice || 100,
          currentPrice: createData.initialPrice || 100,
          minBetAmount: createData.minBetAmount,
          maxBetAmount: createData.maxBetAmount || 10000,
          totalVolume: 0,
          liquidityPool: createData.liquidityPool || 0,
          createdBy,
          metadata: {
            ...createData.metadata,
            initialSentiment: initialProbabilities.sentiment,
            initialViralIndex: initialProbabilities.viralIndex,
            calculatedProbabilities: initialProbabilities.probabilities,
          },
        },
      });

      // Create market outcomes based on market type
      const outcomes = await this.createMarketOutcomes(market.id, createData.marketType, createData.settlementConditions);

      // Update market with created outcomes
      await this.prisma.market.update({
        where: { id: market.id },
        data: {
          outcomes: {
            connect: outcomes.map(o => ({ id: o.id })),
          },
          status: 'ACTIVE',
        },
      });

      // Schedule market closure
      await this.scheduleMarketClosure(market.id, createData.endDate);

      // Cache market data
      await this.cacheMarketData(market.id);

      this.logger.log(`Created market: ${market.title} for topic ${createData.topicId}`);

      return {
        ...market,
        outcomes,
      };
    } catch (error) {
      this.logger.error('Failed to create market:', error);
      throw error;
    }
  }

  async getMarket(marketId: string): Promise<any> {
    const cacheKey = `market:${marketId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        outcomes: {
          select: {
            id: true,
            title: true,
            probability: true,
            totalVolume: true,
            payouts: true,
            isWinning: true,
          },
          orderBy: { probability: 'desc' },
        },
        topic: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        bets: {
          select: {
            id: true,
            userId: true,
            amount: true,
            outcomeId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!market) {
      throw new NotFoundException('Market not found');
    }

    // Calculate additional metrics
    const enrichedMarket = {
      ...market,
      currentOdds: this.calculateCurrentOdds(market.outcomes),
      totalBets: market.bets.length,
      uniqueBettors: new Set(market.bets.map(b => b.userId)).size,
      timeRemaining: this.calculateTimeRemaining(market.endDate),
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedMarket));
    return enrichedMarket;
  }

  async getMarkets(
    filters: {
      status?: 'PENDING' | 'ACTIVE' | 'CLOSED' | 'SETTLED';
      category?: string;
      topicId?: string;
      createdBy?: string;
    } = {},
    pagination: {
      page: number;
      limit: number;
    } = { page: 1, limit: 20 },
  ): Promise<any> {
    const skip = (pagination.page - 1) * pagination.limit;
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.topicId) {
      where.topicId = filters.topicId;
    }
    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    const [markets, total] = await Promise.all([
      this.prisma.market.findMany({
        where,
        include: {
          topic: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
          outcomes: {
            select: {
              id: true,
              title: true,
              probability: true,
              totalVolume: true,
            },
            orderBy: { probability: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.limit,
      }),
      this.prisma.market.count({ where }),
    ]);

    return {
      markets,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async updateMarketPrices(marketId: string): Promise<void> {
    try {
      const market = await this.prisma.market.findUnique({
        where: { id: marketId },
        include: { outcomes: true },
      });

      if (!market) {
        throw new NotFoundException('Market not found');
      }

      if (market.status !== 'ACTIVE') {
        return;
      }

      // Calculate new probabilities based on betting patterns and external factors
      const updatedProbabilities = await this.calculateUpdatedProbabilities(market);

      // Update outcome probabilities
      await Promise.all(
        market.outcomes.map(outcome =>
          this.prisma.marketOutcome.update({
            where: { id: outcome.id },
            data: {
              probability: updatedProbabilities[outcome.id],
            },
          })
        )
      );

      // Update market current price (could be based on volume-weighted average)
      const newCurrentPrice = this.calculateCurrentPrice(market, updatedProbabilities);

      await this.prisma.market.update({
        where: { id: marketId },
        data: {
          currentPrice: newCurrentPrice,
          lastPriceUpdate: new Date(),
        },
      });

      // Invalidate cache
      await this.redis.del(`market:${marketId}`);

      this.logger.debug(`Updated prices for market ${marketId}`);
    } catch (error) {
      this.logger.error(`Failed to update market prices for ${marketId}:`, error);
    }
  }

  async closeMarket(marketId: string, reason?: string): Promise<any> {
    try {
      const market = await this.prisma.market.findUnique({
        where: { id: marketId },
        include: { outcomes: true },
      });

      if (!market) {
        throw new NotFoundException('Market not found');
      }

      if (market.status !== 'ACTIVE') {
        throw new BadRequestException('Market is not active');
      }

      // Update market status
      const updatedMarket = await this.prisma.market.update({
        where: { id: marketId },
        data: {
          status: 'CLOSED',
          endDate: new Date(),
          metadata: {
            ...market.metadata,
            closedReason: reason || 'Manual closure',
            closedAt: new Date().toISOString(),
          },
        },
      });

      // Queue settlement processing
      await this.marketClosureQueue.add('process-market-settlement', {
        marketId,
        reason: reason || 'Manual closure',
      });

      // Invalidate cache
      await this.redis.del(`market:${marketId}`);

      this.logger.log(`Closed market ${marketId}: ${reason || 'Manual closure'}`);

      return updatedMarket;
    } catch (error) {
      this.logger.error(`Failed to close market ${marketId}:`, error);
      throw error;
    }
  }

  async getMarketHistory(marketId: string): Promise<any[]> {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        priceHistory: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!market) {
      throw new NotFoundException('Market not found');
    }

    return market.priceHistory.map(entry => ({
      timestamp: entry.timestamp,
      price: entry.price,
      volume: entry.volume,
      change: entry.change,
    }));
  }

  async getMarketPerformance(marketId: string): Promise<any> {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        outcomes: true,
        bets: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!market) {
      throw new NotFoundException('Market not found');
    }

    const totalVolume = market.totalVolume;
    const totalBets = market.bets.length;
    const uniqueBettors = new Set(market.bets.map(b => b.userId)).size;
    const averageBetSize = totalBets > 0 ? totalVolume / totalBets : 0;

    // Performance by outcome
    const outcomePerformance = market.outcomes.map(outcome => ({
      outcomeId: outcome.id,
      title: outcome.title,
      probability: outcome.probability,
      volume: outcome.totalVolume,
      bets: market.bets.filter(b => b.outcomeId === outcome.id).length,
      payouts: outcome.payouts,
    }));

    return {
      marketId: market.id,
      title: market.title,
      status: market.status,
      totalVolume,
      totalBets,
      uniqueBettors,
      averageBetSize,
      createdAt: market.createdAt,
      endDate: market.endDate,
      outcomePerformance,
    };
  }

  async searchMarkets(query: string, limit: number = 10): Promise<any[]> {
    const markets = await this.prisma.market.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ],
        status: 'ACTIVE',
      },
      include: {
        topic: {
          select: { id: true, name: true },
        },
        outcomes: {
          select: {
            id: true,
            title: true,
            probability: true,
          },
          orderBy: { probability: 'desc' },
        },
      },
      orderBy: { totalVolume: 'desc' },
      take: limit,
    });

    return markets;
  }

  private async calculateInitialProbabilities(topicId: string): Promise<any> {
    try {
      // Get sentiment and viral data for the topic
      const [sentimentData, viralData] = await Promise.all([
        this.getSentimentData(topicId),
        this.getViralData(topicId),
      ]);

      // Calculate base probabilities from sentiment and viral index
      const sentiment = sentimentData.averageScore || 0.5;
      const viralIndex = viralData.index || 0.5;

      // Combine factors (this could be more sophisticated)
      const positiveProbability = (sentiment + viralIndex) / 2;
      const negativeProbability = 1 - positiveProbability;

      return {
        sentiment,
        viralIndex,
        probabilities: {
          YES: positiveProbability,
          NO: negativeProbability,
        },
      };
    } catch (error) {
      this.logger.warn('Failed to calculate initial probabilities, using defaults:', error.message);
      return {
        sentiment: 0.5,
        viralIndex: 0.5,
        probabilities: {
          YES: 0.5,
          NO: 0.5,
        },
      };
    }
  }

  private async createMarketOutcomes(marketId: string, marketType: string, settlementConditions: any): Promise<any[]> {
    switch (marketType) {
      case 'BINARY':
        return await this.prisma.marketOutcome.createMany({
          data: [
            {
              marketId,
              title: 'YES',
              probability: 0.5,
              totalVolume: 0,
              payouts: 0,
            },
            {
              marketId,
              title: 'NO',
              probability: 0.5,
              totalVolume: 0,
              payouts: 0,
            },
          ],
        });

      case 'MULTIPLE_CHOICE':
        return await this.prisma.marketOutcome.createMany({
          data: settlementConditions.options.map((option: string, index: number) => ({
            marketId,
            title: option,
            probability: 1 / settlementConditions.options.length,
            totalVolume: 0,
            payouts: 0,
          })),
        });

      default:
        throw new BadRequestException(`Unsupported market type: ${marketType}`);
    }
  }

  private async scheduleMarketClosure(marketId: string, endDate: Date): Promise<void> {
    const delay = endDate.getTime() - Date.now();
    if (delay > 0) {
      await this.marketClosureQueue.add('auto-close-market', {
        marketId,
        scheduledCloseTime: endDate.toISOString(),
      }, {
        delay,
      });
    }
  }

  private async calculateUpdatedProbabilities(market: any): Promise<Record<string, number>> {
    // This is a simplified implementation
    // In reality, this would consider:
    // - Current betting volumes
    // - Market depth
    // - External sentiment/viral changes
    // - Time decay
    // - Liquidity provider adjustments

    const probabilities: Record<string, number> = {};

    for (const outcome of market.outcomes) {
      // Start with current probability
      let newProbability = outcome.probability;

      // Adjust based on volume (more volume = higher confidence)
      const volumeAdjustment = Math.min(outcome.totalVolume / 10000, 0.1);
      newProbability += volumeAdjustment;

      // Normalize
      probabilities[outcome.id] = Math.max(0.01, Math.min(0.99, newProbability));
    }

    // Ensure probabilities sum to 1
    const totalProbability = Object.values(probabilities).reduce((sum, prob) => sum + prob, 0);
    Object.keys(probabilities).forEach(key => {
      probabilities[key] /= totalProbability;
    });

    return probabilities;
  }

  private calculateCurrentOdds(outcomes: any[]): any[] {
    return outcomes.map(outcome => ({
      outcomeId: outcome.id,
      title: outcome.title,
      probability: outcome.probability,
      odds: this.probabilityToOdds(outcome.probability),
    }));
  }

  private probabilityToOdds(probability: number): number {
    return Math.max(1.01, 1 / probability);
  }

  private calculateTimeRemaining(endDate: Date): {
    days: number;
    hours: number;
    minutes: number;
    isExpired: boolean;
  } {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, isExpired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, isExpired: false };
  }

  private calculateCurrentPrice(market: any, updatedProbabilities: Record<string, number>): number {
    // Price based on weighted average of outcome probabilities
    let weightedSum = 0;
    let totalWeight = 0;

    for (const outcome of market.outcomes) {
      const probability = updatedProbabilities[outcome.id] || outcome.probability;
      weightedSum += probability * 100; // Base price is 100
      totalWeight += probability;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : market.initialPrice;
  }

  private async cacheMarketData(marketId: string): Promise<void> {
    // Cache would be populated with market data
    await this.redis.setex(`market:${marketId}`, this.CACHE_TTL, JSON.stringify({}));
  }

  private async getSentimentData(topicId: string): Promise<any> {
    // Would integrate with SentimentModule
    // For now, return mock data
    return {
      averageScore: 0.5,
      confidence: 0.8,
    };
  }

  private async getViralData(topicId: string): Promise<any> {
    // Would integrate with ViralModule
    // For now, return mock data
    return {
      index: 0.6,
      momentum: 0.4,
    };
  }
}