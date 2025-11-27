import { IsOptional, IsEnum, IsArray, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleStatus } from '../entities/knowledge-base-article.entity';

export class UpdateArticleDto {
  @ApiPropertyOptional({ description: 'Updated title', example: 'Updated: How to Reset Your Password' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @ApiPropertyOptional({ description: 'Updated slug', example: 'updated-how-to-reset-password' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Slug must not exceed 200 characters' })
  slug?: string;

  @ApiPropertyOptional({
    description: 'Updated article content',
    example: '# Reset Your Password (Updated)\n\nFollow these updated steps...'
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Updated excerpt',
    example: 'Learn how to reset your password with these updated instructions.',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Excerpt must not exceed 500 characters' })
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Updated category ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Updated tags',
    type: [String],
    example: ['password', 'account', 'security', 'troubleshooting', 'updated']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Updated article status',
    enum: ArticleStatus,
    example: ArticleStatus.PUBLISHED
  })
  @IsOptional()
  @IsEnum(ArticleStatus, { message: 'Status must be one of: DRAFT, PUBLISHED, ARCHIVED' })
  status?: ArticleStatus;
}