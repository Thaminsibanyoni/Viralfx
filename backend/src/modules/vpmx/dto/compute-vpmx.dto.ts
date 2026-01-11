import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum VPMXInterval {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  ONE_HOUR = '1h',
  ONE_DAY = '1d'
}

export class ComputeVPMXDto {
  @ApiProperty({
    description: 'VTS symbol to compute VPMX for',
    example: 'V:US:ENT:BEIBERNEWALBUM'
  })
  @IsString()
  vtsSymbol: string;

  @ApiPropertyOptional({
    description: 'Specific timestamp for computation',
    example: '2024-01-15T12:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Force recompute even if recent data exists',
    example: false
  })
  @IsOptional()
  @IsNumber()
  force?: number;
}

export class BatchComputeVPMXDto {
  @ApiProperty({
    description: 'Array of VTS symbols to compute',
    example: ['V:US:ENT:BEIBERNEWALBUM', 'V:ZA:ENT:ZINHLEXD']
  })
  @IsArray()
  @IsString({ each: true })
  vtsSymbols: string[];

  @ApiPropertyOptional({
    description: 'Timestamp for all computations',
    example: '2024-01-15T12:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Force recompute for all symbols',
    example: false
  })
  @IsOptional()
  @IsNumber()
  force?: number;
}

export class VPMXQueryDto {
  @ApiPropertyOptional({
    description: 'Time interval for historical data',
    enum: VPMXInterval,
    default: VPMXInterval.ONE_HOUR
  })
  @IsOptional()
  @IsEnum(VPMXInterval)
  interval?: VPMXInterval;

  @ApiPropertyOptional({
    description: 'Start date for historical data',
    example: '2024-01-01T00:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for historical data',
    example: '2024-01-31T23:59:59Z'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Limit number of results',
    example: 100
  })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1
  })
  @IsOptional()
  @IsNumber()
  page?: number;
}

export class MarketUpdateDto {
  @ApiProperty({
    description: 'VTS symbol',
    example: 'V:US:ENT:BEIBERNEWALBUM'
  })
  @IsString()
  vtsSymbol: string;

  @ApiProperty({
    description: 'Market question',
    example: 'Will Bieber\'s new album reach #1 on Billboard?'
  })
  @IsString()
  question: string;

  @ApiProperty({
    description: 'Market description',
    example: 'Binary market on album chart performance'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Outcome type (BINARY, RANGE, MULTI)',
    example: 'BINARY'
  })
  @IsString()
  outcomeType: string;

  @ApiProperty({
    description: 'Strike price for range markets',
    example: 750
  })
  @IsOptional()
  @IsNumber()
  strikePrice?: number;

  @ApiProperty({
    description: 'Expiry date',
    example: '2024-02-01T23:59:59Z'
  })
  @IsDateString()
  expiryDate: string;

  @ApiProperty({
    description: 'Resolution criteria',
    example: 'Based on official Billboard Hot 100 chart'
  })
  @IsString()
  resolutionCriteria: string;
}

export class PredictionRequestDto {
  @ApiProperty({
    description: 'VTS symbol to predict',
    example: 'V:US:ENT:BEIBERNEWALBUM'
  })
  @IsString()
  vtsSymbol: string;

  @ApiProperty({
    description: 'Prediction horizon',
    example: '24h'
  })
  @IsString()
  predictionHorizon: string;

  @ApiProperty({
    description: 'Model type to use',
    example: 'LSTM'
  })
  @IsString()
  modelType: string;

  @ApiPropertyOptional({
    description: 'Additional prediction parameters',
    example: { confidence: 0.95 }
  })
  @IsOptional()
  parameters?: any;
}

export class RiskAssessmentDto {
  @ApiProperty({
    description: 'VTS symbol to assess',
    example: 'V:US:ENT:BEIBERNEWALBUM'
  })
  @IsString()
  vtsSymbol: string;

  @ApiProperty({
    description: 'Risk tolerance level',
    example: 'MEDIUM'
  })
  @IsString()
  riskTolerance: string;

  @ApiProperty({
    description: 'Position size to assess',
    example: 10000
  })
  @IsNumber()
  positionSize: number;

  @ApiProperty({
    description: 'Assessment timeframe',
    example: '7d'
  })
  @IsString()
  timeframe: string;
}
