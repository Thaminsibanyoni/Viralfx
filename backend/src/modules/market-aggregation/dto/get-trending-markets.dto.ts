import { IsOptional, IsEnum, IsNumber, Min, Max, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SortBy {
  VOLUME = 'volume',
  PRICE_CHANGE = 'priceChange',
  VIRALITY_SCORE = 'viralityScore',
  TRADES = 'trades'
}

export enum Timeframe {
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  TWENTY_FOUR_HOURS = '24h',
  SEVEN_DAYS = '7d'
}

export class GetTrendingMarketsDto {
  @ApiPropertyOptional({
    description: 'Number of trending markets to return',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field for trending markets',
    enum: SortBy,
    example: SortBy.VOLUME,
    default: SortBy.VOLUME
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.VOLUME;

  @ApiPropertyOptional({
    description: 'Timeframe for trend calculation',
    enum: Timeframe,
    example: Timeframe.TWENTY_FOUR_HOURS,
    default: Timeframe.TWENTY_FOUR_HOURS
  })
  @IsOptional()
  @IsEnum(Timeframe)
  timeframe?: Timeframe = Timeframe.TWENTY_FOUR_HOURS;

  @ApiPropertyOptional({
    description: 'Filter by category (CELEB, SPORTS, BRAND, etc.)',
    example: 'CELEB'
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by region (SA, GP, WC, etc.)',
    example: 'SA'
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: 'Minimum virality score threshold',
    example: 50,
    minimum: 0,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  minViralityScore?: number;
}
