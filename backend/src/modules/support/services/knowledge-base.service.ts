import { Injectable } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";

enum ArticleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED'
}

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

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
      dateRange
    } = filters;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (dateRange) {
      where.createdAt = { gte: dateRange.start, lte: dateRange.end };
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    const [articles, total] = await Promise.all([
      this.prisma.knowledgeBaseArticle.findMany({
        where,
        include: {
          category: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.knowledgeBaseArticle.count({ where })
    ]);

    return {
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters
    };
  }

  async getArticleById(id: string) {
    return await this.prisma.knowledgeBaseArticle.findFirst({
      where: { id },
      include: { category: true }
    });
  }

  async getArticleBySlug(slug: string) {
    return await this.prisma.knowledgeBaseArticle.findFirst({
      where: { slug, status: ArticleStatus.PUBLISHED },
      include: { category: true }
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
    const data: any = {
      ...createArticleDto,
      ...(createArticleDto.status === ArticleStatus.PUBLISHED && { publishedAt: new Date() })
    };

    return await this.prisma.knowledgeBaseArticle.create({
      data,
      include: { category: true }
    });
  }

  async updateArticle(id: string, updateArticleDto: any) {
    const article = await this.getArticleById(id);
    if (!article) {
      throw new Error('Article not found');
    }

    // Handle publishing
    const data: any = { ...updateArticleDto };
    if (updateArticleDto.status === ArticleStatus.PUBLISHED && article.status !== ArticleStatus.PUBLISHED) {
      data.publishedAt = new Date();
    }

    return await this.prisma.knowledgeBaseArticle.update({
      where: { id },
      data,
      include: { category: true }
    });
  }

  async deleteArticle(id: string) {
    await this.prisma.knowledgeBaseArticle.delete({ where: { id } });
    return { success: true, message: 'Article deleted successfully' };
  }

  async publishArticle(id: string) {
    return this.updateArticle(id, {
      status: ArticleStatus.PUBLISHED,
      publishedAt: new Date()
    });
  }

  async archiveArticle(id: string) {
    return this.updateArticle(id, {
      status: ArticleStatus.ARCHIVED
    });
  }

  async incrementViews(id: string) {
    await this.prisma.knowledgeBaseArticle.update({
      where: { id },
      data: { views: { increment: 1 } }
    });
    return this.getArticleById(id);
  }

  async markHelpful(id: string, helpful: boolean) {
    if (helpful) {
      await this.prisma.knowledgeBaseArticle.update({
        where: { id },
        data: { helpful: { increment: 1 } }
      });
    } else {
      await this.prisma.knowledgeBaseArticle.update({
        where: { id },
        data: { notHelpful: { increment: 1 } }
      });
    }

    return this.getArticleById(id);
  }

  async searchArticles(query: string, filters: {
    categoryId?: string;
    tags?: string[];
    limit?: number;
  } = {}) {
    const { categoryId, tags, limit = 10 } = filters;

    const where: any = {
      status: ArticleStatus.PUBLISHED,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } }
      ]
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    return await this.prisma.knowledgeBaseArticle.findMany({
      where,
      include: { category: true },
      orderBy: [
        { views: 'desc' },
        { helpful: 'desc' }
      ],
      take: limit
    });
  }

  async getRelatedArticles(articleId: string, limit: number = 5) {
    const article = await this.getArticleById(articleId);
    if (!article) {
      return [];
    }

    const where: any = {
      status: ArticleStatus.PUBLISHED,
      id: { not: articleId }
    };

    // Match by category or tags
    if (article.categoryId || (article.tags && article.tags.length > 0)) {
      where.OR = [];
      if (article.categoryId) {
        where.OR.push({ categoryId: article.categoryId });
      }
      if (article.tags && article.tags.length > 0) {
        where.OR.push({ tags: { hasSome: article.tags } });
      }
    }

    const relatedArticles = await this.prisma.knowledgeBaseArticle.findMany({
      where,
      include: { category: true },
      orderBy: [
        { views: 'desc' },
        { helpful: 'desc' }
      ],
      take: limit
    });

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

    return await this.prisma.knowledgeBaseArticle.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: { gte: startDate, lte: now }
      },
      include: { category: true },
      orderBy: [
        { views: 'desc' },
        { helpful: 'desc' }
      ],
      take: limit
    });
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

    const dateFilter = { gte: startDate, lte: now };

    const [
      totalArticles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      articlesWithViews,
      articlesWithHelpful,
      articlesWithNotHelpful,
      topArticles,
    ] = await Promise.all([
      this.prisma.knowledgeBaseArticle.count({
        where: { createdAt: dateFilter }
      }),
      this.prisma.knowledgeBaseArticle.count({
        where: {
          createdAt: dateFilter,
          status: ArticleStatus.PUBLISHED
        }
      }),
      this.prisma.knowledgeBaseArticle.count({
        where: {
          createdAt: dateFilter,
          status: ArticleStatus.DRAFT
        }
      }),
      this.prisma.knowledgeBaseArticle.count({
        where: {
          createdAt: dateFilter,
          status: ArticleStatus.ARCHIVED
        }
      }),
      this.prisma.knowledgeBaseArticle.aggregate({
        where: { createdAt: dateFilter },
        _sum: { views: true }
      }),
      this.prisma.knowledgeBaseArticle.aggregate({
        where: { createdAt: dateFilter },
        _sum: { helpful: true }
      }),
      this.prisma.knowledgeBaseArticle.aggregate({
        where: { createdAt: dateFilter },
        _sum: { notHelpful: true }
      }),
      this.prisma.knowledgeBaseArticle.findMany({
        where: {
          createdAt: dateFilter,
          status: ArticleStatus.PUBLISHED
        },
        include: { category: true },
        orderBy: { views: 'desc' },
        take: 10
      }),
    ]);

    return {
      period,
      totalArticles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      totalViews: articlesWithViews._sum.views || 0,
      totalHelpful: articlesWithHelpful._sum.helpful || 0,
      totalNotHelpful: articlesWithNotHelpful._sum.notHelpful || 0,
      helpScore: (articlesWithHelpful._sum.helpful || 0) + (articlesWithNotHelpful._sum.notHelpful || 0) > 0
        ? ((articlesWithHelpful._sum.helpful || 0) / ((articlesWithHelpful._sum.helpful || 0) + (articlesWithNotHelpful._sum.notHelpful || 0))) * 100
        : 0,
      topArticles
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
      ...articles.articles.map((article: any) => [
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

    while (await this.prisma.knowledgeBaseArticle.findFirst({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
