import { 
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { UserRole } from "../../../common/enums/user-role.enum";
import { KnowledgeBaseService } from '../services/knowledge-base.service';
import { CreateArticleDto } from '../dto/create-article.dto';
import { UpdateArticleDto } from '../dto/update-article.dto';
import { ArticleFilterDto } from '../dto/article-filter.dto';
import { SearchArticlesDto } from '../dto/search-articles.dto';
// COMMENTED OUT (TypeORM entity deleted): import { KnowledgeBaseArticle, ArticleStatus } from '../entities/knowledge-base-article.entity';

@ApiTags('knowledge-base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get()
  @ApiOperation({ summary: 'Get knowledge base articles with filtering' })
  @ApiResponse({ status: 200, description: 'Articles retrieved successfully' })
  async getArticles(@Query() filters: ArticleFilterDto) {
    const articles = await this.knowledgeBaseService.getArticles(filters);
    return {
      success: true,
      data: articles,
      message: 'Articles retrieved successfully'
    };
  }

  @Get('public')
  @ApiOperation({ summary: 'Get public knowledge base articles' })
  @ApiResponse({ status: 200, description: 'Public articles retrieved successfully' })
  async getPublicArticles(@Query() filters: ArticleFilterDto) {
    return await this.knowledgeBaseService.getArticles({
      ...filters,
      status: ArticleStatus.PUBLISHED
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get knowledge base statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async getArticleStats(@Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month') {
    return await this.knowledgeBaseService.getArticleStats(period);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular articles' })
  @ApiResponse({ status: 200, description: 'Popular articles retrieved successfully' })
  async getPopularArticles(
    @Query('limit') limit: number = 10,
    @Query('period') period: 'week' | 'month' | 'year' = 'month'
  ) {
    return await this.knowledgeBaseService.getPopularArticles(limit, period);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search knowledge base articles' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchArticles(@Query() searchDto: SearchArticlesDto) {
    const results = await this.knowledgeBaseService.searchArticles(searchDto.query, {
      categoryId: searchDto.categoryId,
      tags: searchDto.tags,
      limit: searchDto.limit
    });
    return {
      success: true,
      data: results,
      message: 'Search results retrieved successfully'
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export knowledge base articles to CSV' })
  @ApiResponse({ status: 200, description: 'Articles exported successfully' })
  @Roles(UserRole.ADMIN)
  async exportArticles(@Query() filters: ArticleFilterDto) {
    const csvData = await this.knowledgeBaseService.exportArticles(filters);
    return csvData;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get article by ID' })
  @ApiResponse({ status: 200, description: 'Article retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async getArticleById(@Param('id') id: string) {
    return await this.knowledgeBaseService.getArticleById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get article by slug' })
  @ApiResponse({ status: 200, description: 'Article retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async getArticleBySlug(@Param('slug') slug: string) {
    return await this.knowledgeBaseService.getArticleBySlug(slug);
  }

  @Get(':id/related')
  @ApiOperation({ summary: 'Get related articles' })
  @ApiResponse({ status: 200, description: 'Related articles retrieved successfully' })
  async getRelatedArticles(
    @Param('id') id: string,
    @Query('limit') limit: number = 5
  ) {
    return await this.knowledgeBaseService.getRelatedArticles(id, limit);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new knowledge base article' })
  @ApiResponse({ status: 201, description: 'Article created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async createArticle(@Body() createArticleDto: CreateArticleDto, @Req() req) {
    return await this.knowledgeBaseService.createArticle({
      ...createArticleDto,
      authorId: req.user.id
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update knowledge base article' })
  @ApiResponse({ status: 200, description: 'Article updated successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async updateArticle(
    @Param('id') id: string,
    @Body() updateArticleDto: UpdateArticleDto
  ) {
    return await this.knowledgeBaseService.updateArticle(id, updateArticleDto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish knowledge base article' })
  @ApiResponse({ status: 200, description: 'Article published successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async publishArticle(@Param('id') id: string) {
    return await this.knowledgeBaseService.publishArticle(id);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive knowledge base article' })
  @ApiResponse({ status: 200, description: 'Article archived successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async archiveArticle(@Param('id') id: string) {
    return await this.knowledgeBaseService.archiveArticle(id);
  }

  @Post(':id/view')
  @ApiOperation({ summary: 'Increment article view count' })
  @ApiResponse({ status: 200, description: 'View count incremented successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async incrementViews(@Param('id') id: string) {
    return await this.knowledgeBaseService.incrementViews(id);
  }

  @Post(':id/helpful')
  @ApiOperation({ summary: 'Mark article as helpful or not helpful' })
  @ApiResponse({ status: 200, description: 'Feedback recorded successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async markHelpful(
    @Param('id') id: string,
    @Body('helpful') helpful: boolean
  ) {
    return await this.knowledgeBaseService.markHelpful(id, helpful);
  }

  @Post('generate-slug')
  @ApiOperation({ summary: 'Generate a unique slug for an article' })
  @ApiResponse({ status: 200, description: 'Slug generated successfully' })
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async generateSlug(@Body('title') title: string) {
    const slug = await this.knowledgeBaseService.generateSlug(title);
    return { slug };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete knowledge base article' })
  @ApiResponse({ status: 204, description: 'Article deleted successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @Roles(UserRole.ADMIN)
  async deleteArticle(@Param('id') id: string) {
    await this.knowledgeBaseService.deleteArticle(id);
  }
}
