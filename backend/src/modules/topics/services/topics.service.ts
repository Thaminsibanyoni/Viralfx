import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
import { Topic } from '@prisma/client';
import { CanonicalData, asCanonicalData } from '../dto';

interface CreateTopicData {
  name: string;
  slug?: string;
  category: string;
  description?: string;
  canonical: CanonicalData;
}

interface UpdateTopicData extends Partial<CreateTopicData> {
  isVerified?: boolean;
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
}

@Injectable()
export class TopicsService {
  private readonly logger = new Logger(TopicsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly TRENDING_CACHE_TTL = 60; // 1 minute

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis) {}

  async createTopic(data: CreateTopicData): Promise<Topic> {
    const { slug, ...topicData } = data;

    // Check if topic with same name already exists
    const existingTopic = await this.prisma.topic.findFirst({
      where: {
        OR: [
          { name: { equals: data.name, mode: 'insensitive' } },
          ...(slug ? [{ slug }] : []),
        ]
      }
    });

    if (existingTopic) {
      throw new ConflictException('Topic with this name or slug already exists');
    }

    // Generate slug if not provided
    const generatedSlug = slug || this.generateSlug(data.name);

    const topic = await this.prisma.topic.create({
      data: {
        ...topicData,
        slug: generatedSlug,
        canonical: data.canonical || { hashtags: [], keywords: [], entities: [] } satisfies CanonicalData
      }
    });

    // Invalidate relevant caches
    await this.invalidateTopicCaches();

    this.logger.log(`Created topic: ${topic.name} (${topic.id})`);
    return topic;
  }

  async findById(id: string): Promise<Topic | null> {
    // Try cache first
    const cacheKey = `topic:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ingestEvents: true,
            viralSnapshots: true,
            markets: true
          }
        }
      }
    });

    if (topic) {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(topic));
    }

    return topic;
  }

  async findBySlug(slug: string): Promise<Topic | null> {
    const cacheKey = `topic:slug:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            ingestEvents: true,
            viralSnapshots: true,
            markets: true
          }
        }
      }
    });

    if (topic) {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(topic));
    }

    return topic;
  }

  async updateTopic(id: string, data: UpdateTopicData): Promise<Topic> {
    const topic = await this.findById(id);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const updatedTopic = await this.prisma.topic.update({
      where: { id },
      data: {
        ...data,
        slug: data.slug || (data.name ? this.generateSlug(data.name) : topic.slug),
        updatedAt: new Date()
      }
    });

    // Invalidate caches
    await this.redis.del(`topic:${id}`);
    await this.redis.del(`topic:slug:${topic.slug}`);
    await this.invalidateTopicCaches();

    this.logger.log(`Updated topic: ${updatedTopic.name} (${updatedTopic.id})`);
    return updatedTopic;
  }

  async deleteTopic(id: string): Promise<void> {
    const topic = await this.findById(id);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Soft delete
    await this.prisma.topic.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        deletedAt: new Date()
      }
    });

    // Invalidate caches
    await this.redis.del(`topic:${id}`);
    await this.redis.del(`topic:slug:${topic.slug}`);
    await this.invalidateTopicCaches();

    this.logger.log(`Deleted topic: ${topic.name} (${topic.id})`);
  }

  async searchTopics(
    query: string,
    category?: string,
    page: number = 1,
    limit: number = 20): Promise<{ topics: Topic[]; total: number }> {
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ACTIVE',
      deletedAt: null
    };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { canonical: { path: ['keywords'], string_contains: query } },
        { canonical: { path: ['hashtags'], string_contains: query } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const [topics, total] = await Promise.all([
      this.prisma.topic.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.topic.count({ where }),
    ]);

    return { topics, total };
  }

  async getTrendingTopics(limit: number = 10, category?: string): Promise<Topic[]> {
    const cacheKey = `trending:topics:${limit}:${category || 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get topics with recent viral index activity
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const trendingTopics = await this.prisma.topic.findMany({
      where: {
        status: 'ACTIVE',
        ...(category && { category }),
        viralSnapshots: {
          some: {
            ts: { gte: oneHourAgo }
          }
        }
      },
      include: {
        viralSnapshots: {
          where: {
            ts: { gte: oneHourAgo }
          },
          orderBy: { ts: 'desc' },
          take: 1
        },
        _count: {
          select: {
            ingestEvents: true,
            markets: true
          }
        }
      },
      orderBy: {
        viralSnapshots: {
          _count: 'desc'
        }
      },
      take: limit
    });

    await this.redis.setex(cacheKey, this.TRENDING_CACHE_TTL, JSON.stringify(trendingTopics));

    return trendingTopics;
  }

  async getTopicsByCategory(category: string, limit: number = 20): Promise<Topic[]> {
    const cacheKey = `topics:category:${category}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const topics = await this.prisma.topic.findMany({
      where: {
        category,
        status: 'ACTIVE',
        deletedAt: null
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            ingestEvents: true,
            viralSnapshots: true,
            markets: true
          }
        }
      }
    });

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(topics));

    return topics;
  }

  async mergeTopics(sourceTopicIds: string[], targetTopicId: string): Promise<Topic> {
    const targetTopic = await this.findById(targetTopicId);
    if (!targetTopic) {
      throw new NotFoundException('Target topic not found');
    }

    // Validate source topics
    const sourceTopics = await this.prisma.topic.findMany({
      where: {
        id: { in: sourceTopicIds },
        status: 'ACTIVE',
        deletedAt: null
      }
    });

    if (sourceTopics.length !== sourceTopicIds.length) {
      throw new NotFoundException('One or more source topics not found');
    }

    // Merge ingest events
    await this.prisma.ingestEvent.updateMany({
      where: { topicId: { in: sourceTopicIds } },
      data: { topicId: targetTopicId }
    });

    // Merge viral snapshots
    await this.prisma.viralIndexSnapshot.updateMany({
      where: { topicId: { in: sourceTopicIds } },
      data: { topicId: targetTopicId }
    });

    // Merge sentiment snapshots
    await this.prisma.sentimentSnapshot.updateMany({
      where: { topicId: { in: sourceTopicIds } },
      data: { topicId: targetTopicId }
    });

    // Merge deception snapshots
    await this.prisma.deceptionSnapshot.updateMany({
      where: { topicId: { in: sourceTopicIds } },
      data: { topicId: targetTopicId }
    });

    // Update markets (if any)
    await this.prisma.market.updateMany({
      where: { topicId: { in: sourceTopicIds } },
      data: { topicId: targetTopicId }
    });

    // Soft delete source topics
    await Promise.all(
      sourceTopicIds.map(id =>
        this.prisma.topic.update({
          where: { id },
          data: {
            status: 'ARCHIVED',
            deletedAt: new Date(),
            mergedInto: targetTopicId
          }
        })));

    // Update target topic canonical data
    // Extract canonical data safely
    const targetCanonical = asCanonicalData(targetTopic.canonical);
    const sourceCanonicals = sourceTopics.map(t => asCanonicalData(t.canonical));

    const allHashtags = new Set([
      ...targetCanonical.hashtags,
      ...sourceCanonicals.flatMap(c => c.hashtags),
    ]);

    const allKeywords = new Set([
      ...targetCanonical.keywords,
      ...sourceCanonicals.flatMap(c => c.keywords),
    ]);

    await this.prisma.topic.update({
      where: { id: targetTopicId },
      data: {
        canonical: {
          hashtags: Array.from(allHashtags),
          keywords: Array.from(allKeywords),
          entities: targetCanonical.entities
        } satisfies CanonicalData
      }
    });

    // Invalidate all caches
    await this.invalidateAllTopicCaches();

    this.logger.log(`Merged ${sourceTopicIds.length} topics into ${targetTopic.name} (${targetTopicId})`);

    return this.findById(targetTopicId);
  }

  async getTopicStats(topicId: string): Promise<any> {
    const topic = await this.findById(topicId);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const [ingestStats, marketStats, sentimentStats, viralStats] = await Promise.all([
      this.prisma.ingestEvent.aggregate({
        where: { topicId },
        _count: true,
        _max: { ingestedAt: true },
        _min: { ingestedAt: true }
      }),
      this.prisma.market.aggregate({
        where: { topicId },
        _count: true,
        _sum: { totalVolume: true }
      }),
      this.prisma.sentimentSnapshot.aggregate({
        where: { topicId },
        _count: true,
        _avg: { scoreFloat: true }
      }),
      this.prisma.viralIndexSnapshot.aggregate({
        where: { topicId },
        _count: true,
        _max: { viralIndex: true }
      }),
    ]);

    return {
      topic: {
        id: topic.id,
        name: topic.name,
        category: topic.category,
        createdAt: topic.createdAt,
        isVerified: topic.isVerified
      },
      stats: {
        totalIngestEvents: (ingestStats._count as number) ?? 0,
        ingestDateRange: {
          start: ingestStats._min?.ingestedAt ?? null,
          end: ingestStats._max?.ingestedAt ?? null
        },
        totalMarkets: (marketStats._count as number) ?? 0,
        totalVolume: marketStats._sum?.totalVolume ?? 0,
        avgSentimentScore: sentimentStats._avg?.scoreFloat ?? 0,
        totalSentimentSnapshots: (sentimentStats._count as number) ?? 0,
        maxViralIndex: viralStats._max?.viralIndex ?? 0,
        totalViralSnapshots: (viralStats._count as number) ?? 0
      }
    };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private async invalidateTopicCaches(): Promise<void> {
    const patterns = [
      'trending:topics:*',
      'topics:category:*',
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  private async invalidateAllTopicCaches(): Promise<void> {
    const patterns = [
      'topic:*',
      'trending:topics:*',
      'topics:category:*',
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}
