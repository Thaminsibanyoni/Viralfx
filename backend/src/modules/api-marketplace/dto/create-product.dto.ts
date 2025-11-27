import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { API_PRODUCT_CATEGORIES } from '../interfaces/api-marketplace.interface';

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Social Mood Index API',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Unique slug identifier',
    example: 'smi-api',
  })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({
    description: 'Product description',
    example: 'Real-time social sentiment scores for financial markets',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Public documentation URL or markdown path',
    example: '/docs/smi-api',
    required: false,
  })
  @IsString()
  @IsOptional()
  publicDocs?: string;

  @ApiProperty({
    description: 'Product category',
    enum: API_PRODUCT_CATEGORIES,
    example: 'SMI',
  })
  @IsString()
  @IsIn(API_PRODUCT_CATEGORIES)
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'Default plan code',
    example: 'starter',
  })
  @IsString()
  @IsNotEmpty()
  defaultPlan: string;

  @ApiProperty({
    description: 'List of product features',
    example: ['Real-time scores', 'Historical data', 'Webhook support'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiProperty({
    description: 'Whether the product is active',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}