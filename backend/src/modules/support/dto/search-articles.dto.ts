import { IsString, MinLength, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchArticlesDto {
  @ApiProperty({
    description: 'Search query string',
    example: 'password reset account access'
  })
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters long' })
  query: string;

  @ApiPropertyOptional({
    description: 'Filter by category ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tags',
    type: [String],
    example: ['password', 'security']
  })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    example: 10,
    default: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}