import { IsEnum, IsOptional, IsString, IsArray, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum MarketStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  FROZEN = 'frozen',
  ARCHIVED = 'archived',
}

export class CreateMarketDto {
  @ApiProperty({ description: 'VTS Symbol (e.g., V:ZA:ENT:ZINHLEXD)' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: 'Market name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Market category' })
  @IsString()
  category: string;

  @ApiProperty({ description: 'Maximum exposure allowed' })
  @IsNumber()
  maxExposure: number;

  @ApiProperty({ description: 'Allowed regions (e.g., [ZA, NG, KE])', type: [String] })
  @IsArray()
  @IsString({ each: true })
  regions: string[];

  @ApiProperty({ description: 'Available timeframes (e.g., [1m, 5m, 1h, 1D])', type: [String] })
  @IsArray()
  @IsString({ each: true })
  timeframes: string[];

  @ApiProperty({ description: 'Trading enabled', required: false })
  @IsOptional()
  @IsBoolean()
  tradingEnabled?: boolean;
}

export class UpdateMarketRegionsDto {
  @ApiProperty({ description: 'Allowed regions', type: [String] })
  @IsArray()
  @IsString({ each: true })
  regions: string[];
}

export class ToggleTradingDto {
  @ApiProperty({ description: 'Enable or disable trading' })
  @IsBoolean()
  enabled: boolean;
}

export class FreezeMarketDto {
  @ApiProperty({ description: 'Reason for freezing' })
  @IsString()
  reason: string;
}
