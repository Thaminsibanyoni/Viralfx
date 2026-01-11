import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsArray,
  IsString as IsStringValidator,
  IsOptional,
  IsEnum,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWebhookDto {
  @ApiProperty({ description: 'Webhook name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Webhook URL' })
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ description: 'Webhook events' })
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @ApiProperty({ description: 'Webhook secret' })
  @IsString()
  @IsOptional()
  secret?: string;

  @ApiProperty({ description: 'Active status' })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}