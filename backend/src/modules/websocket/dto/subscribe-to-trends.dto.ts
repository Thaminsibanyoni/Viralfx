import { IsArray, IsBoolean, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SubscribeToTrendsDto {
  @IsArray()
  @IsUUID(4, { each: true })
  @IsOptional()
  trendIds?: string[];

  @IsBoolean()
  @IsOptional()
  subscribeAll?: boolean = false;
}
