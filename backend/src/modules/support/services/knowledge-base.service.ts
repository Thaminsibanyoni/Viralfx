import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between } from 'typeorm';
import { KnowledgeBaseArticle, ArticleStatus } from '../entities/knowledge-base-article.entity';
import { TicketCategory } from '../entities/ticket-category.entity';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    @InjectRepository(KnowledgeBaseArticle)
    private readonly knowledgeBaseArticleRepository: Repository<KnowledgeBaseArticle>,
    @InjectRepository(TicketCategory)
    private readonly ticketCategoryRepository: Repository<TicketCategory>,
  ) {}

  async getArticles(filters: {
    page?: number;
    limit?: number;
    status?: ArticleStatus;
    categoryId?: string;
    tags?: string[];
    search?: string;
    authorId?: string;
    dateRange?: { start: Date; end: Date };
  }) {
    const {
      page = 1,
      limit = 20,
      status,
      categoryId,
      tags,
      search,
      authorId,
      dateRange,
    } = filters;

    const queryBuilder = this.knowledgeBaseArticleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.category', 'category')
      .where('1 = 1');

    if (status) {
      queryBuilder.andWhere('article.status = :status', { status });
    }

    if (categoryId) {
      queryBuilder.andWhere('article.categoryId = :categoryId', { categoryId });
    }

    if (authorId) {
      queryBuilder.andWhere('article.authorId = :authorId', { authorId });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('article.tags && :tags', { tags });
    }

    if (search) {
      queryBuilder.andWhere(
        '(article.title ILIKE :search OR article.content ILIKE :search OR article.excerpt ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (dateRange) {
      queryBuilder.andWhere('article.createdAt BETWEEN :start AND :end', {
        start: dateRange.start,
        end: dateRange.end,
      });
    }

    const [articles, total] = await queryBuilder
      .orderBy('article.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters,
    };
  }

  async getArticleById(id: string): Promise<KnowledgeBaseArticle> {
    return await this.knowledgeBaseArticleRepository.findOne({
      where: { id },
      relations: ['category'],
    });
  }

  async getArticleBySlug(slug: string): Promise<KnowledgeBaseArticle> {
    return await this.knowledgeBaseArticleRepository.findOne({
      where: { slug, status: ArticleStatus.PUBLISHED },
      relations: ['category'],
    });
  }

  async createArticle(createArticleDto: {
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    categoryId?: string;
    tags?: string[];
    authorId: string;
    status?: ArticleStatus;
  }) {
    const article = this.knowledgeBaseArticleRepository.create(createArticleDto);

    if (article.status === ArticleStatus.PUBLISHED) {
      article.publishedAt = new Date();
    }

    return await this.knowledgeBaseArticleRepository.save(article);
  }

  async updateArticle(id: string, updateArticleDto: Partial<KnowledgeBaseArticle>) {
    const article = await this.getArticleById(id);
    if (!article) {
      throw new Error('Article not found');
    }

    // Handle publishing
    if (updateArticleDto.status === ArticleStatus.PUBLISHED && article.status !== ArticleStatus.PUBLISHED) {
      updateArticleDto.publishedAt = new Date();
    }

    await this.knowledgeBaseArticleRepository.update(id, updateArticleDto);
    return this.getArticleById(id);
  }

  async deleteArticle(id: string) {
    await this.knowledgeBaseArticleRepository.delete(id);
    return { success: true, message: 'Article deleted successfully' };
  }

  async publishArticle(id: string) {
    return this.updateArticle(id, {
      status: ArticleStatus.PUBLISHED,
      publishedAt: new Date(),
    });
  }

  async archiveArticle(id: string) {
    return this.updateArticle(id, {
      status: ArticleStatus.ARCHIVED,
    });
  }

  async incrementViews(id: string) {
    await this.knowledgeBaseArticleRepository.increment({ id }, 'views', 1);
    return this.getArticleById(id);
  }

  async markHelpful(id: string, helpful: boolean) {
    if (helpful) {
      await this.knowledgeBaseArticleRepository.increment({ id }, 'helpful', 1);
    } else {
      await this.knowledgeBaseArticleRepository.increment({ id }, 'notHelpful', 1);
    }

    return this.getArticleById(id);
  }

  async searchArticles(query: string, filters: {
    categoryId?: string;
    tags?: string[];
    limit?: number;
  } = {}) {
    const { categoryId, tags, limit = 10 } = filters;

    const queryBuilder = this.knowledgeBaseArticleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.category', 'category')
      .where('article.status = :status', { status: ArticleStatus.PUBLISHED })
      .andWhere(
        '(article.title ILIKE :search OR article.content ILIKE :search OR article.excerpt ILIKE :search)',
        { search: `%${query}%` }
      );

    if (categoryId) {
      queryBuilder.andWhere('article.categoryId = :categoryId', { categoryId });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('article.tags && :tags', { tags });
    }

    const articles = await queryBuilder
      .orderBy('article.views', 'DESC')
      .addOrderBy('article.helpful', 'DESC')
      .limit(limit)
      .getMany();

    return articles;
  }

  async getRelatedArticles(articleId: string, limit: number = 5) {
    const article = await this.getArticleById(articleId);
    if (!article) {
      return [];
    }

    // Find related articles based on category and tags
    const queryBuilder = this.knowledgeBaseArticleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.category', 'category')
      .where('article.status = :status', { status: ArticleStatus.PUBLISHED })
      .andWhere('article.id != :articleId', { articleId });

    // Match by category first
    if (article.categoryId) {
      queryBuilder.andWhere('(article.categoryId = :categoryId OR article.tags && :tags)', {
        categoryId: article.categoryId,
        tags: article.tags || [],
      });
    } else if (article.tags && article.tags.length > 0) {
      queryBuilder.andWhere('article.tags && :tags', { tags: article.tags });
    }

    const relatedArticles = await queryBuilder
      .orderBy('article.views', 'DESC')
      .addOrderBy('article.helpful', 'DESC')
      .limit(limit)
      .getMany();

    return relatedArticles;
  }

  async getPopularArticles(limit: number = 10, period: 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    return await this.knowledgeBaseArticleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.category', 'category')
      .where('article.status = :status', { status: ArticleStatus.PUBLISHED })
      .andWhere('article.publishedAt BETWEEN :start AND :end', { start: startDate, end: now })
      .orderBy('article.views', 'DESC')
      .addOrderBy('article.helpful', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getArticleStats(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const [
      totalArticles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      totalViews,
      totalHelpful,
      totalNotHelpful,
      articlesByCategory,
      topArticles,
    ] = await Promise.all([
      this.knowledgeBaseArticleRepository.count({
        where: { createdAt: Between(startDate, now) },
      }),
      this.knowledgeBaseArticleRepository.count({
        where: {
          createdAt: Between(startDate, now),
          status: ArticleStatus.PUBLISHED,
        },
      }),
      this.knowledgeBaseArticleRepository.count({
        where: {
          createdAt: Between(startDate, now),
          status: ArticleStatus.DRAFT,
        },
      }),
      this.knowledgeBaseArticleRepository.count({
        where: {
          createdAt: Between(startDate, now),
          status: ArticleStatus.ARCHIVED,
        },
      }),
      this.knowledgeBaseArticleRepository
        .createQueryBuilder('article')
        .select('SUM(article.views)', 'total')
        .where('article.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
        .getRawOne(),
      this.knowledgeBaseArticleRepository
        .createQueryBuilder('article')
        .select('SUM(article.helpful)', 'total')
        .where('article.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
        .getRawOne(),
      this.knowledgeBaseArticleRepository
        .createQueryBuilder('article')
        .select('SUM(article.notHelpful)', 'total')
        .where('article.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
        .getRawOne(),
      this.knowledgeBaseArticleRepository
        .createQueryBuilder('article')
        .leftJoin('article.category', 'category')
        .select('category.name', 'category')
        .addSelect('COUNT(*)', 'count')
        .where('article.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
        .andWhere('article.status = :status', { status: ArticleStatus.PUBLISHED })
        .groupBy('category.name')
        .orderBy('count', 'DESC')
        .getRawMany(),
      this.knowledgeBaseArticleRepository
        .createQueryBuilder('article')
        .leftJoinAndSelect('article.category', 'category')
        .where('article.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
        .andWhere('article.status = :status', { status: ArticleStatus.PUBLISHED })
        .orderBy('article.views', 'DESC')
        .limit(10)
        .getMany(),
    ]);

    return {
      period,
      totalArticles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      totalViews: parseInt(totalViews?.total || 0),
      totalHelpful: parseInt(totalHelpful?.total || 0),
      totalNotHelpful: parseInt(totalNotHelpful?.total || 0),
      helpScore: totalHelpful + totalNotHelpful > 0
        ? (totalHelpful / (totalHelpful + totalNotHelpful)) * 100
        : 0,
      articlesByCategory,
      topArticles,
    };
  }

  async exportArticles(filters: any) {
    const articles = await this.getArticles({ ...filters, limit: 10000 });

    const csvData = [
      [
        'Title',
        'Slug',
        'Status',
        'Category',
        'Views',
        'Helpful',
        'Not Helpful',
        'Created At',
        'Published At',
      ],
      ...articles.articles.map(article => [
        article.title,
        article.slug,
        article.status,
        article.category?.name || '',
        article.views,
        article.helpful,
        article.notHelpful,
        article.createdAt.toISOString(),
        article.publishedAt?.toISOString() || '',
      ]),
    ];

    return csvData.map(row => row.join(',')).join('\n');
  }

  async generateSlug(title: string): Promise<string> {
    let baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');

    // Check if slug exists and add number if needed
    let slug = baseSlug;
    let counter = 1;

    while (await this.knowledgeBaseArticleRepository.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}