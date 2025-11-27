import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Redis } from 'ioredis';

interface MergeCandidate {
  id: string;
  name: string;
  slug: string;
  category: string;
  similarityScore: number;
  reason: string;
}

interface MergeProposal {
  primaryTopic: {
    id: string;
    name: string;
    slug: string;
  };
  duplicateTopics: MergeCandidate[];
  confidence: number;
  reason: string;
}

@Injectable()
export class TopicMergingService {
  private readonly logger = new Logger(TopicMergingService.name);
  private readonly MERGE_THRESHOLD = 0.85; // 85% similarity threshold
  private readonly MAX_MERGE_CANDIDATES = 5;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('topic-processing')
    private readonly topicQueue: Queue,
    private readonly redis: Redis,
  ) {}

  async detectDuplicates(limit: number = 100): Promise<MergeProposal[]> {
    const topics = await this.prisma.topic.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const proposals: MergeProposal[] = [];
    const processed = new Set<string>();

    for (const topic of topics) {
      if (processed.has(topic.id)) continue;

      const duplicates = await this.findSimilarTopics(topic, topics.filter(t => t.id !== topic.id));

      if (duplicates.length > 0) {
        // Mark all topics as processed
        processed.add(topic.id);
        duplicates.forEach(d => processed.add(d.id));

        // Determine primary topic (most recent, most data, or verified)
        const primaryTopic = await this.selectPrimaryTopic(topic, duplicates);

        const proposal: MergeProposal = {
          primaryTopic: {
            id: primaryTopic.id,
            name: primaryTopic.name,
            slug: primaryTopic.slug,
          },
          duplicateTopics: duplicates.filter(d => d.id !== primaryTopic.id),
          confidence: this.calculateMergeConfidence(duplicates),
          reason: this.generateMergeReason(duplicates),
        };

        proposals.push(proposal);
      }
    }

    return proposals;
  }

  async proposeMerge(topicId: string, duplicateTopicIds: string[]): Promise<MergeProposal> {
    const primaryTopic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        _count: {
          select: {
            ingestEvents: true,
            markets: true,
            viralSnapshots: true,
          },
        },
      },
    });

    if (!primaryTopic) {
      throw new NotFoundException('Primary topic not found');
    }

    const duplicateTopics = await this.prisma.topic.findMany({
      where: {
        id: { in: duplicateTopicIds },
        isActive: true,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            ingestEvents: true,
            markets: true,
            viralSnapshots: true,
          },
        },
      },
    });

    if (duplicateTopics.length !== duplicateTopicIds.length) {
      throw new NotFoundException('One or more duplicate topics not found');
    }

    const candidates: MergeCandidate[] = [];

    for (const duplicate of duplicateTopics) {
      const similarity = await this.calculateSimilarity(primaryTopic, duplicate);

      if (similarity >= this.MERGE_THRESHOLD) {
        candidates.push({
          id: duplicate.id,
          name: duplicate.name,
          slug: duplicate.slug,
          category: duplicate.category,
          similarityScore: similarity,
          reason: this.getSimilarityReason(primaryTopic, duplicate, similarity),
        });
      }
    }

    return {
      primaryTopic: {
        id: primaryTopic.id,
        name: primaryTopic.name,
        slug: primaryTopic.slug,
      },
      duplicateTopics: candidates,
      confidence: this.calculateMergeConfidence(candidates),
      reason: this.generateMergeReason(candidates),
    };
  }

  async executeMerge(proposal: MergeProposal, executorId: string): Promise<any> {
    const { primaryTopic, duplicateTopics } = proposal;

    // Create merge record for audit trail
    const mergeRecord = await this.prisma.topicMerge.create({
      data: {
        primaryTopicId: primaryTopic.id,
        duplicateTopicIds: duplicateTopics.map(t => t.id),
        similarityScores: duplicateTopics.reduce((acc, t) => {
          acc[t.id] = t.similarityScore;
          return acc;
        }, {}),
        confidence: proposal.confidence,
        reason: proposal.reason,
        executedBy: executorId,
        status: 'IN_PROGRESS',
      },
    });

    // Queue merge operation
    await this.topicQueue.add('execute-merge', {
      mergeId: mergeRecord.id,
      primaryTopicId: primaryTopic.id,
      duplicateTopicIds: duplicateTopics.map(t => t.id),
      executorId,
    });

    this.logger.log(`Queued merge operation: ${primaryTopic.id} <- [${duplicateTopics.map(t => t.id).join(', ')}]`);

    return {
      mergeId: mergeRecord.id,
      status: 'QUEUED',
      message: 'Merge operation has been queued for processing',
    };
  }

  async rollbackMerge(mergeId: string, reason?: string): Promise<any> {
    const mergeRecord = await this.prisma.topicMerge.findUnique({
      where: { id: mergeId },
    });

    if (!mergeRecord) {
      throw new NotFoundException('Merge record not found');
    }

    if (mergeRecord.status !== 'COMPLETED') {
      throw new Error('Cannot rollback merge that is not completed');
    }

    // Queue rollback operation
    await this.topicQueue.add('rollback-merge', {
      mergeId,
      reason,
      primaryTopicId: mergeRecord.primaryTopicId,
      duplicateTopicIds: mergeRecord.duplicateTopicIds,
    });

    // Update merge record status
    await this.prisma.topicMerge.update({
      where: { id: mergeId },
      data: {
        status: 'ROLLING_BACK',
        rollbackReason: reason,
        rolledBackAt: new Date(),
      },
    });

    this.logger.log(`Queued rollback operation for merge: ${mergeId}`);

    return {
      mergeId,
      status: 'QUEUED_FOR_ROLLBACK',
      message: 'Rollback operation has been queued for processing',
    };
  }

  async getMergeHistory(topicId: string): Promise<any[]> {
    const mergeHistory = await this.prisma.topicMerge.findMany({
      where: {
        OR: [
          { primaryTopicId: topicId },
          { duplicateTopicIds: { has: topicId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return mergeHistory.map(merge => ({
      id: merge.id,
      primaryTopicId: merge.primaryTopicId,
      duplicateTopicIds: merge.duplicateTopicIds,
      confidence: merge.confidence,
      reason: merge.reason,
      status: merge.status,
      createdAt: merge.createdAt,
      completedAt: merge.completedAt,
      rolledBackAt: merge.rolledBackAt,
      rollbackReason: merge.rollbackReason,
    }));
  }

  private async findSimilarTopics(topic: any, allTopics: any[]): Promise<MergeCandidate[]> {
    const candidates: MergeCandidate[] = [];

    for (const otherTopic of allTopics) {
      const similarity = await this.calculateSimilarity(topic, otherTopic);

      if (similarity >= this.MERGE_THRESHOLD) {
        candidates.push({
          id: otherTopic.id,
          name: otherTopic.name,
          slug: otherTopic.slug,
          category: otherTopic.category,
          similarityScore: similarity,
          reason: this.getSimilarityReason(topic, otherTopic, similarity),
        });
      }
    }

    // Sort by similarity score and limit results
    return candidates
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, this.MAX_MERGE_CANDIDATES);
  }

  private async calculateSimilarity(topic1: any, topic2: any): Promise<number> {
    let score = 0;
    let factors = 0;

    // Name similarity (40% weight)
    const nameSimilarity = this.calculateStringSimilarity(topic1.name.toLowerCase(), topic2.name.toLowerCase());
    score += nameSimilarity * 0.4;
    factors += 0.4;

    // Category match (20% weight)
    const categoryMatch = topic1.category === topic2.category ? 1 : 0;
    score += categoryMatch * 0.2;
    factors += 0.2;

    // Canonical data similarity (30% weight)
    const canonicalSimilarity = await this.calculateCanonicalSimilarity(topic1.canonical, topic2.canonical);
    score += canonicalSimilarity * 0.3;
    factors += 0.3;

    // Slug similarity (10% weight)
    const slugSimilarity = this.calculateStringSimilarity(topic1.slug, topic2.slug);
    score += slugSimilarity * 0.1;
    factors += 0.1;

    return score;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async calculateCanonicalSimilarity(canonical1: any, canonical2: any): Promise<number> {
    if (!canonical1 || !canonical2) return 0;

    const hashtags1 = new Set((canonical1.hashtags || []).map(h => h.toLowerCase()));
    const hashtags2 = new Set((canonical2.hashtags || []).map(h => h.toLowerCase()));

    const keywords1 = new Set((canonical1.keywords || []).map(k => k.toLowerCase()));
    const keywords2 = new Set((canonical2.keywords || []).map(k => k.toLowerCase()));

    // Calculate Jaccard similarity for hashtags
    const hashtagIntersection = new Set([...hashtags1].filter(x => hashtags2.has(x)));
    const hashtagUnion = new Set([...hashtags1, ...hashtags2]);
    const hashtagSimilarity = hashtagUnion.size > 0 ? hashtagIntersection.size / hashtagUnion.size : 0;

    // Calculate Jaccard similarity for keywords
    const keywordIntersection = new Set([...keywords1].filter(x => keywords2.has(x)));
    const keywordUnion = new Set([...keywords1, ...keywords2]);
    const keywordSimilarity = keywordUnion.size > 0 ? keywordIntersection.size / keywordUnion.size : 0;

    return (hashtagSimilarity + keywordSimilarity) / 2;
  }

  private async selectPrimaryTopic(topic: any, duplicates: MergeCandidate[]): Promise<any> {
    const allTopics = [topic, ...duplicates];

    // Sort by priority: verified > most data > most recent
    return allTopics.sort((a, b) => {
      // Verified topics first
      if (a.isVerified && !b.isVerified) return -1;
      if (!a.isVerified && b.isVerified) return 1;

      // Then by amount of data (using ingestion events count)
      if (a._count && b._count) {
        if (a._count.ingestEvents > b._count.ingestEvents) return -1;
        if (a._count.ingestEvents < b._count.ingestEvents) return 1;
      }

      // Finally by creation date (most recent)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0];
  }

  private calculateMergeConfidence(duplicates: MergeCandidate[]): number {
    if (duplicates.length === 0) return 0;

    const avgSimilarity = duplicates.reduce((sum, d) => sum + d.similarityScore, 0) / duplicates.length;
    return avgSimilarity;
  }

  private generateMergeReason(duplicates: MergeCandidate[]): string {
    if (duplicates.length === 0) return 'No duplicates found';

    const reasons = duplicates.map(d => d.reason).filter(Boolean);
    const uniqueReasons = [...new Set(reasons)];

    if (uniqueReasons.length === 1) {
      return uniqueReasons[0];
    }

    return `Similar names, categories, or canonical data (${duplicates.length} duplicates)`;
  }

  private getSimilarityReason(topic1: any, topic2: any, similarity: number): string {
    const nameSimilarity = this.calculateStringSimilarity(topic1.name.toLowerCase(), topic2.name.toLowerCase());
    const slugSimilarity = this.calculateStringSimilarity(topic1.slug, topic2.slug);

    if (nameSimilarity > 0.9) {
      return 'Nearly identical names';
    } else if (slugSimilarity > 0.9) {
      return 'Nearly identical slugs';
    } else if (topic1.category === topic2.category) {
      return 'Same category with similar names';
    } else {
      return `Overall similarity score: ${(similarity * 100).toFixed(1)}%`;
    }
  }
}