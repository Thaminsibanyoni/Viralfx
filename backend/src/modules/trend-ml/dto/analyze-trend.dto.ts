import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class AnalyzeTrendDto {
  @IsString()
  trendId: string;

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;

  @IsOptional()
  includeSocialMetrics?: boolean;

  @IsOptional()
  includeSentiment?: boolean;
}
