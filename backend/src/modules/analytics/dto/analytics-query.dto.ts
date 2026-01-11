import { IsString, IsNotEmpty, IsOptional, IsDate, IsEnum, IsArray, IsString as IsStringValidator } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticsQueryDto {
  @ApiProperty({
    description: 'Symbol to query analytics for',
    example: 'AAPL'
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiPropertyOptional({
    description: 'Start time for query period',
    example: '2024-01-01T00:00:00Z'
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startTime?: Date;

  @ApiPropertyOptional({
    description: 'End time for query period',
    example: '2024-12-31T23:59:59Z'
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endTime?: Date;

  @ApiPropertyOptional({
    description: 'Data interval',
    enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
    example: '1h',
    default: '1h'
  })
  @IsEnum(['1m', '5m', '15m', '1h', '4h', '1d'])
  @IsOptional()
  interval?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h';

  @ApiPropertyOptional({
    description: 'Metrics to include in response',
    example: ['viralityScore', 'sentimentScore', 'velocity'],
    type: [String]
  })
  @IsArray()
  @IsStringValidator({ each: true })
  @IsOptional()
  metrics?: string[];

  @ApiPropertyOptional({
    description: 'Aggregation method for metrics',
    enum: ['avg', 'sum', 'min', 'max', 'count'],
    example: 'avg',
    default: 'avg'
  })
  @IsEnum(['avg', 'sum', 'min', 'max', 'count'])
  @IsOptional()
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count' = 'avg';

  // Custom validation to ensure reasonable date ranges
  validateDateRange(): void {
    if (!this.startTime || !this.endTime) return;

    const duration = this.endTime.getTime() - this.startTime.getTime();
    const maxDurationByInterval = {
      '1m': 7 * 24 * 60 * 60 * 1000, // 7 days for minute data
      '5m': 30 * 24 * 60 * 60 * 1000, // 30 days for 5-minute data
      '15m': 60 * 24 * 60 * 60 * 1000, // 60 days for 15-minute data
      '1h': 365 * 24 * 60 * 60 * 1000, // 1 year for hourly data
      '4h': 365 * 24 * 60 * 60 * 1000, // 1 year for 4-hour data
      '1d': 5 * 365 * 24 * 60 * 60 * 1000 // 5 years for daily data
    };

    const maxDuration = maxDurationByInterval[this.interval] || maxDurationByInterval['1h'];
    if (duration > maxDuration) {
      throw new Error(`Date range too large for ${this.interval} interval. Maximum: ${maxDuration / (24 * 60 * 60 * 1000)} days`);
    }
  }
}
