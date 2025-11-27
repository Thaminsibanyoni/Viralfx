import { IsString, IsNotEmpty, IsDate, IsNumber, IsOptional, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BacktestConfigDto {
  @ApiProperty({
    description: 'Strategy ID to run backtest for',
    example: 'trend_momentum',
  })
  @IsString()
  @IsNotEmpty()
  strategyId: string;

  @ApiProperty({
    description: 'Symbol/ticker to backtest',
    example: 'AAPL',
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description: 'Start date for backtest period',
    example: '2024-01-01T00:00:00Z',
  })
  @IsDate()
  @Type(() => Date)
  startTime: Date;

  @ApiProperty({
    description: 'End date for backtest period',
    example: '2024-12-31T23:59:59Z',
  })
  @IsDate()
  @Type(() => Date)
  endTime: Date;

  @ApiProperty({
    description: 'Initial capital for backtest',
    example: 10000,
    minimum: 100,
    maximum: 1000000,
    default: 10000,
  })
  @IsNumber()
  @Min(100)
  @Max(1000000)
  initialCapital: number = 10000;

  @ApiPropertyOptional({
    description: 'Strategy parameters to override defaults',
    example: { minViralityScore: 80, sentimentThreshold: 0.6 },
  })
  @IsObject()
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Backtest execution options',
    example: {
      slippage: 0.001,
      commission: 0.002,
      maxPositionSize: 1.0,
    },
  })
  @IsObject()
  @IsOptional()
  options?: {
    slippage?: number;
    commission?: number;
    maxPositionSize?: number;
  };

  // Custom validation to ensure endTime > startTime
  validateDateRange(): void {
    if (this.endTime <= this.startTime) {
      throw new Error('End time must be after start time');
    }

    const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (this.endTime.getTime() - this.startTime.getTime() > maxDuration) {
      throw new Error('Backtest period cannot exceed 1 year');
    }
  }
}