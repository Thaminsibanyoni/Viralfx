import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsArray,
  IsString as IsStringValidator,
  IsOptional,
  IsBoolean,
  IsEnum,
  ArrayNotEmpty,
} from 'class-validator';
import { WEBHOOK_EVENTS } from '../interfaces/api-marketplace.interface';

export class CreateWebhookDto {
  @ApiProperty({
    description: 'Webhook URL to receive events',
    example: 'https://api.example.com/webhooks/viralfx',
  })
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    description: 'List of events to subscribe to',
    enum: WEBHOOK_EVENTS,
    example: ['usage.threshold', 'invoice.paid'],
    isArray: true,
  })
  @IsArray()
  @IsEnum(WEBHOOK_EVENTS, { each: true })
  @ArrayNotEmpty()
  events: string[];

  @ApiProperty({
    description: 'Webhook secret for signature verification',
    example: 'whsec_1234567890abcdef',
    required: false,
  })
  @IsString()
  @IsOptional()
  secret?: string;

  @ApiProperty({
    description: 'Whether the webhook is active',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateWebhookDto {
  @ApiProperty({
    description: 'Webhook URL',
    example: 'https://api.example.com/webhooks/viralfx-v2',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  url?: string;

  @ApiProperty({
    description: 'List of events to subscribe to',
    enum: WEBHOOK_EVENTS,
    example: ['usage.threshold', 'invoice.paid', 'key.revoked'],
    required: false,
  })
  @IsArray()
  @IsEnum(WEBHOOK_EVENTS, { each: true })
  @IsOptional()
  events?: string[];

  @ApiProperty({
    description: 'Webhook secret',
    example: 'whsec_newsecret123456',
    required: false,
  })
  @IsString()
  @IsOptional()
  secret?: string;

  @ApiProperty({
    description: 'Whether the webhook is active',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class TestWebhookDto {
  @ApiProperty({
    description: 'Event type to test',
    enum: WEBHOOK_EVENTS,
    example: 'usage.threshold',
  })
  @IsEnum(WEBHOOK_EVENTS)
  event: string;

  @ApiProperty({
    description: 'Test payload data',
    example: {
      apiKeyId: 'test-key-id',
      usage: 9000,
      quota: 10000,
      percentage: 90,
    },
    required: false,
  })
  @IsOptional()
  data?: Record<string, any>;
}

export class WebhookQueryDto {
  @ApiProperty({
    description: 'Filter by event type',
    enum: WEBHOOK_EVENTS,
    example: 'invoice.paid',
    required: false,
  })
  @IsEnum(WEBHOOK_EVENTS)
  @IsOptional()
  event?: string;

  @ApiProperty({
    description: 'Filter by status',
    enum: ['success', 'failed', 'pending'],
    example: 'success',
    required: false,
  })
  @IsEnum(['success', 'failed', 'pending'])
  @IsOptional()
  status?: 'success' | 'failed' | 'pending';

  @ApiProperty({
    description: 'Start date for query',
    example: '2024-01-01',
    required: false,
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date for query',
    example: '2024-01-31',
    required: false,
  })
  @IsString()
  @IsOptional()
  endDate?: string;
}