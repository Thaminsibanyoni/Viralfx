import { IsString, IsOptional, IsEnum, IsArray, IsObject, MaxLength, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface CanonicalEntity {
  type: string;
  value: string;
  confidence: number;
}

export interface CanonicalData {
  hashtags: string[];
  keywords: string[];
  entities: CanonicalEntity[];
}

/**
 * Type guard to check if a value is a valid CanonicalEntity
 */
export function isCanonicalEntity(value: unknown): value is CanonicalEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'value' in value &&
    'confidence' in value &&
    typeof (value as any).type === 'string' &&
    typeof (value as any).value === 'string' &&
    typeof (value as any).confidence === 'number' &&
    (value as any).confidence >= 0 &&
    (value as any).confidence <= 1
  );
}

/**
 * Type guard to check if a value is a valid CanonicalData
 */
export function isCanonicalData(value: unknown): value is CanonicalData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'hashtags' in value &&
    'keywords' in value &&
    'entities' in value &&
    Array.isArray((value as any).hashtags) &&
    Array.isArray((value as any).keywords) &&
    Array.isArray((value as any).entities) &&
    (value as any).hashtags.every((item: unknown) => typeof item === 'string') &&
    (value as any).keywords.every((item: unknown) => typeof item === 'string') &&
    (value as any).entities.every((item: unknown) => isCanonicalEntity(item))
  );
}

/**
 * Safely cast a value to CanonicalData with type validation
 * Returns a default empty structure if the value is invalid or null
 */
export function asCanonicalData(value: unknown): CanonicalData {
  if (value === null || value === undefined) {
    return { hashtags: [], keywords: [], entities: [] };
  }

  if (isCanonicalData(value)) {
    return value;
  }

  return { hashtags: [], keywords: [], entities: [] };
}

export class CanonicalDataDto implements CanonicalData {
  @ApiProperty({
    description: 'Array of hashtags related to the topic',
    example: ['#viralfx', '#trading', '#market'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  hashtags: string[];

  @ApiProperty({
    description: 'Array of keywords related to the topic',
    example: ['trading', 'finance', 'cryptocurrency'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  keywords: string[];

  @ApiProperty({
    description: 'Array of entities with their confidence scores',
    example: [
      { type: 'PERSON', value: 'Elon Musk', confidence: 0.95 },
      { type: 'ORGANIZATION', value: 'Tesla', confidence: 0.88 },
    ],
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'PERSON' },
        value: { type: 'string', example: 'Elon Musk' },
        confidence: { type: 'number', example: 0.95, minimum: 0, maximum: 1 }
      }
    }
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CanonicalEntityDto)
  entities: CanonicalEntity[];
}

class CanonicalEntityDto implements CanonicalEntity {
  @ApiProperty({
    description: 'Type of entity',
    example: 'PERSON'
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: 'Value of the entity',
    example: 'Elon Musk'
  })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({
    description: 'Confidence score (0-1)',
    example: 0.95,
    minimum: 0,
    maximum: 1
  })
  confidence: number;
}

export class CreateTopicDto {
  @ApiProperty({
    description: 'Name of the topic',
    example: 'Cryptocurrency Trading',
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug for the topic (auto-generated if not provided)',
    example: 'cryptocurrency-trading',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiProperty({
    description: 'Category of the topic',
    example: 'FINANCE',
    enum: [
      'POLITICS',
      'SPORTS',
      'ENTERTAINMENT',
      'TECHNOLOGY',
      'BUSINESS',
      'HEALTH',
      'SCIENCE',
      'ENVIRONMENT',
      'FINANCE',
      'CRYPTOCURRENCY',
      'SOCIAL_MEDIA',
      'BREAKING_NEWS',
      'INTERNATIONAL',
      'LOCAL',
      'OTHER',
    ]
  })
  @IsEnum([
    'POLITICS',
    'SPORTS',
    'ENTERTAINMENT',
    'TECHNOLOGY',
    'BUSINESS',
    'HEALTH',
    'SCIENCE',
    'ENVIRONMENT',
    'FINANCE',
    'CRYPTOCURRENCY',
    'SOCIAL_MEDIA',
    'BREAKING_NEWS',
    'INTERNATIONAL',
    'LOCAL',
    'OTHER',
  ])
  category: string;

  @ApiPropertyOptional({
    description: 'Description of the topic',
    example: 'Topics related to cryptocurrency trading and market analysis',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Canonical representation data including hashtags, keywords, and entities',
    type: CanonicalDataDto
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CanonicalDataDto)
  canonical?: CanonicalData;
}
