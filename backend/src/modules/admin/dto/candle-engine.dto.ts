import { IsEnum, IsOptional, IsString, IsArray, IsBoolean, IsNumber, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CandleTimeframe {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1D',
  ONE_WEEK = '1W',
}

export enum CandleStatus {
  ACTIVE = 'active',
  REBUILDING = 'rebuilding',
  DISABLED = 'disabled',
}

export class ConfigureTimeframesDto {
  @ApiProperty({ description: 'Market ID', type: String })
  @IsString()
  marketId: string;

  @ApiProperty({ description: 'Available timeframes', type: [String] })
  @IsArray()
  @IsEnum(CandleTimeframe, { each: true })
  timeframes: CandleTimeframe[];
}

export class RebuildCandlesDto {
  @ApiProperty({ description: 'Market ID', type: String })
  @IsString()
  marketId: string;

  @ApiProperty({ description: 'Timeframe to rebuild', enum: CandleTimeframe })
  @IsEnum(CandleTimeframe)
  timeframe: CandleTimeframe;

  @ApiProperty({ description: 'Start date for rebuild', required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ description: 'End date for rebuild', required: false })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ description: 'Force rebuild even if candles exist', required: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class UpdateAggregationRulesDto {
  @ApiProperty({ description: 'Market ID', type: String })
  @IsString()
  marketId: string;

  @ApiProperty({ description: 'Volume weight in candle calculation', required: false })
  @IsOptional()
  @IsNumber()
  volumeWeight?: number;

  @ApiProperty({ description: 'VPMX weight in candle calculation', required: false })
  @IsOptional()
  @IsNumber()
  vpmxWeight?: number;

  @ApiProperty({ description: 'Social engagement weight', required: false })
  @IsOptional()
  @IsNumber()
  engagementWeight?: number;

  @ApiProperty({ description: 'Enable smoothing algorithm', required: false })
  @IsOptional()
  @IsBoolean()
  enableSmoothing?: boolean;

  @ApiProperty({ description: 'Smoothing period', required: false })
  @IsOptional()
  @IsInt()
  smoothingPeriod?: number;
}

export class UpdateVolumeWeightingDto {
  @ApiProperty({ description: 'Market ID', type: String })
  @IsString()
  marketId: string;

  @ApiProperty({ description: 'Mentions weight', required: false })
  @IsOptional()
  @IsNumber()
  mentionsWeight?: number;

  @ApiProperty({ description: 'Shares weight', required: false })
  @IsOptional()
  @IsNumber()
  sharesWeight?: number;

  @ApiProperty({ description: 'Likes weight', required: false })
  @IsOptional()
  @IsNumber()
  likesWeight?: number;

  @ApiProperty({ description: 'Comments weight', required: false })
  @IsOptional()
  @IsNumber()
  commentsWeight?: number;
}

export class EnableTimeframeDto {
  @ApiProperty({ description: 'Market ID', type: String })
  @IsString()
  marketId: string;

  @ApiProperty({ description: 'Timeframe to enable', enum: CandleTimeframe })
  @IsEnum(CandleTimeframe)
  timeframe: CandleTimeframe;

  @ApiProperty({ description: 'Enabled status' })
  @IsBoolean()
  enabled: boolean;
}
