import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Platform enum matching Prisma schema
enum Platform {
  ALL = 'all',
  TWITTER = 'TWITTER',
  INSTAGRAM = 'INSTAGRAM',
  TIKTOK = 'TIKTOK',
  YOUTUBE = 'YOUTUBE',
  FACEBOOK = 'FACEBOOK',
  REDDIT = 'REDDIT',
  DISCORD = 'DISCORD',
  TELEGRAM = 'TELEGRAM',
  CUSTOM = 'CUSTOM',
}

export class TriggerCollectionDto {
  @ApiPropertyOptional({
    description: 'Platform to collect from. Use "all" for all platforms, or specify a specific platform',
    enum: Platform,
    example: 'all',
  })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiPropertyOptional({
    description: 'Maximum number of posts to collect',
    default: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Override default keywords for filtering',
    type: [String],
    example: ['South Africa', 'Mzansi', 'SA'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({
    description: 'Override default hashtags for filtering',
    type: [String],
    example: ['SouthAfrica', 'Mzansi', '#SA'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional({
    description: 'Override default regions for filtering',
    type: [String],
    example: ['ZA'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regions?: string[];

  @ApiPropertyOptional({
    description: 'Override default languages for filtering',
    type: [String],
    example: ['en', 'af'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];
}