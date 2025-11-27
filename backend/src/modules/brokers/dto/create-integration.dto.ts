import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsUrl, IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IntegrationType } from '../entities/broker-integration.entity';

class RestApiConfigDto {
  @ApiProperty()
  @IsUrl()
  baseUrl: string;

  @ApiProperty()
  @IsString()
  version: string;

  @ApiProperty()
  @IsString()
  apiKey: string;

  @ApiProperty()
  @IsString()
  apiSecret: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  timeout?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  retryAttempts?: string;
}

class WebSocketConfigDto {
  @ApiProperty()
  @IsUrl()
  wsUrl: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  apiKey?: string;
}

class WebhookConfigDto {
  @ApiProperty()
  @IsUrl()
  webhookUrl: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  secret?: string;
}

class SdkConfigDto {
  @ApiProperty()
  @IsString()
  platform: string;

  @ApiProperty()
  @IsString()
  version: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  customSettings?: Record<string, any>;
}

export class CreateIntegrationDto {
  @ApiProperty({ enum: IntegrationType })
  @IsEnum(IntegrationType)
  integrationType: IntegrationType;

  @ApiProperty()
  @IsObject()
  @ValidateNested()
  @Type(() => RestApiConfigDto, {
    discriminator: {
      property: 'integrationType',
      subTypes: [
        { value: RestApiConfigDto, name: IntegrationType.REST_API },
        { value: WebSocketConfigDto, name: IntegrationType.WEBSOCKET },
        { value: WebhookConfigDto, name: IntegrationType.WEBHOOK },
        { value: SdkConfigDto, name: IntegrationType.SDK },
      ],
    },
  })
  configuration: RestApiConfigDto | WebSocketConfigDto | WebhookConfigDto | SdkConfigDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}