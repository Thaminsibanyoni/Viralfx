import { IsOptional, IsBoolean, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum PriceInterval {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1d'
}

export class GetMarketDto {
  @ApiPropertyOptional({
    description: 'Whether to include order book data',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeOrderBook?: boolean = false;

  @ApiPropertyOptional({
    description: 'Whether to include price history',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeHistory?: boolean = false;

  @ApiPropertyOptional({
    description: 'Price history interval',
    enum: PriceInterval,
    example: PriceInterval.ONE_HOUR,
    default: PriceInterval.ONE_HOUR
  })
  @IsOptional()
  @IsEnum(PriceInterval)
  historyInterval?: PriceInterval = PriceInterval.ONE_HOUR;

  @ApiPropertyOptional({
    description: 'Number of price history records to return',
    example: 100,
    minimum: 1,
    maximum: 1000,
    default: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  historyLimit?: number = 100;
}
