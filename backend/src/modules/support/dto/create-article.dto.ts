import { IsString, IsOptional, IsEnum, IsArray, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleStatus } from '../enums/support.enum';

export class CreateArticleDto {
  @ApiProperty({
    description: 'Article title',
    example: 'How to Reset Your Password'
  })
  @IsString()
  @MinLength(5, { message: 'Title must be at least 5 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @ApiProperty({
    description: 'URL slug for the article',
    example: 'how-to-reset-your-password'
  })
  @IsString()
  @MinLength(3, { message: 'Slug must be at least 3 characters long' })
  @MaxLength(200, { message: 'Slug must not exceed 200 characters' })
  slug: string;

  @ApiProperty({
    description: 'Full article content in HTML or Markdown format',
    example: '# Reset Your Password\n\nFollow these steps to reset your password...'
  })
  @IsString()
  @MinLength(10, { message: 'Content must be at least 10 characters long' })
  content: string;

  @ApiPropertyOptional({
    description: 'Short excerpt or summary of the article',
    example: 'Learn how to reset your password and regain access to your account.',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Excerpt must not exceed 500 characters' })
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Category ID for the article',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Tags for categorization',
    type: [String],
    example: ['password', 'account', 'security', 'troubleshooting']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Article status',
    enum: ArticleStatus,
    example: ArticleStatus.DRAFT,
    default: ArticleStatus.DRAFT
  })
  @IsOptional()
  @IsEnum(ArticleStatus, { message: 'Status must be one of: DRAFT, PUBLISHED, ARCHIVED' })
  status?: ArticleStatus;

  @ApiPropertyOptional({
    description: 'Author ID (auto-populated from auth token)',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsOptional()
  @IsUUID()
  authorId?: string;
}
