import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  Max
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class UsageQueryDto {
  @ApiProperty({
    description: 'API key ID to filter by',
    example: 'uuid-of-api-key',
    required: false
  })
  @IsString()
  @IsOptional()
  apiKeyId?: string;

  @ApiProperty({
    description: 'Product ID to filter by',
    example: 'uuid-of-product',
    required: false
  })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiProperty({
    description: 'Start date for usage query',
    example: '2024-01-01',
    required: false
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date for usage query',
    example: '2024-01-31',
    required: false
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Group usage by time period',
    enum: ['hour', 'day', 'month'],
    example: 'day',
    required: false
  })
  @IsEnum(['hour', 'day', 'month'])
  @IsOptional()
  groupBy?: 'hour' | 'day' | 'month';

  @ApiProperty({
    description: 'Maximum number of results to return',
    example: 50,
    minimum: 1,
    maximum: 100,
    required: false
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;
}

export class UsageExportDto extends UsageQueryDto {
  @ApiProperty({
    description: 'Export format',
    enum: ['csv', 'json'],
    example: 'csv'
  })
  @IsEnum(['csv', 'json'])
  format: 'csv' | 'json';
}

export class AdminUsageQueryDto extends UsageQueryDto {
  @ApiProperty({
    description: 'Filter by customer ID (user or broker)',
    example: 'uuid-of-customer',
    required: false
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({
    description: 'Filter by customer type',
    enum: ['USER', 'BROKER'],
    example: 'USER',
    required: false
  })
  @IsEnum(['USER', 'BROKER'])
  @IsOptional()
  customerType?: 'USER' | 'BROKER';

  @ApiProperty({
    description: 'Filter by status codes',
    example: ['200', '404', '500'],
    required: false
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim());
    }
    return value;
  })
  @IsOptional()
  statusCodes?: string[];
}
