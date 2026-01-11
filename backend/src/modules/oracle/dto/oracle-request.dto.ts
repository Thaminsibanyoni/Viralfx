import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class OracleRequestDto {
  @IsString()
  @IsNotEmpty()
  trendId: string;

  @IsString()
  @IsOptional()
  platform?: string;

  @IsArray()
  @IsOptional()
  keywords?: string[];

  @IsString()
  @IsOptional()
  timeframe?: string; // e.g., '1h', '24h', '7d'

  @IsString()
  @IsOptional()
  dataType?: string; // 'sentiment', 'virality', 'volume'
}
