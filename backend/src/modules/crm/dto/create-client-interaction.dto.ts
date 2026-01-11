import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsObject, IsDateString, IsUUID, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InteractionType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  NOTE = 'NOTE',
  TICKET = 'TICKET',
  CHAT = 'CHAT'
}

export enum InteractionDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND'
}

export enum ContactMethod {
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  IN_PERSON = 'IN_PERSON'
}

export enum InteractionOutcome {
  SUCCESSFUL = 'SUCCESSFUL',
  NEEDS_FOLLOWUP = 'NEEDS_FOLLOWUP',
  NOT_INTERESTED = 'NOT_INTERESTED',
  CALLBACK_REQUIRED = 'CALLBACK_REQUIRED'
}

export enum InteractionPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export class CreateClientInteractionDto {
  @ApiProperty({ description: 'Client record ID' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ enum: InteractionType, description: 'Type of interaction' })
  @IsEnum(InteractionType)
  type: InteractionType;

  @ApiProperty({ enum: InteractionDirection, description: 'Direction of interaction' })
  @IsEnum(InteractionDirection)
  direction: InteractionDirection;

  @ApiPropertyOptional({ description: 'Subject of the interaction' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Body/content of the interaction' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes (for calls/meetings)' })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({ enum: ContactMethod, description: 'Contact method used' })
  @IsOptional()
  @IsEnum(ContactMethod)
  contactMethod?: ContactMethod;

  @ApiPropertyOptional({ description: 'Contact details (phone, email, etc.)' })
  @IsOptional()
  @IsString()
  contactDetails?: string;

  @ApiPropertyOptional({ description: 'Channel used for interaction' })
  @IsOptional()
  @IsIn(['phone', 'email', 'meet'])
  channel?: 'phone' | 'email' | 'meet';

  @ApiPropertyOptional({ description: 'Broker ID if interaction involves a broker' })
  @IsOptional()
  @IsUUID()
  brokerId?: string;

  @ApiPropertyOptional({ enum: InteractionOutcome, description: 'Outcome of the interaction' })
  @IsOptional()
  @IsEnum(InteractionOutcome)
  outcome?: InteractionOutcome;

  @ApiPropertyOptional({ description: 'Next action required' })
  @IsOptional()
  @IsString()
  nextAction?: string;

  @ApiPropertyOptional({ description: 'Next action date' })
  @IsOptional()
  @IsDateString()
  nextActionDate?: string;

  @ApiPropertyOptional({ enum: InteractionPriority, description: 'Priority of the interaction' })
  @IsOptional()
  @IsEnum(InteractionPriority)
  priority?: InteractionPriority;

  @ApiPropertyOptional({ description: 'Tags for categorization', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Attachment details', type: 'array' })
  @IsOptional()
  @IsArray()
  attachments?: object[];

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: object;
}
