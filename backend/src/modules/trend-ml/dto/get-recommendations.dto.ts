import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class GetRecommendationsDto {
  @IsString()
  trendId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  riskTolerance?: 'low' | 'medium' | 'high';

  @IsOptional()
  timeframe?: 'short' | 'medium' | 'long';
}
