import { IsArray, IsString, IsOptional, IsBoolean } from 'class-validator';

export class BatchAnalyzeDto {
  @IsArray()
  @IsString({ each: true })
  trendIds: string[];

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;

  @IsOptional()
  includeSocialMetrics?: boolean;

  @IsOptional()
  includeSentiment?: boolean;
}
