import { PartialType } from '@nestjs/swagger';
import { CreateClientInteractionDto, InteractionType, InteractionDirection, ContactMethod, InteractionOutcome, InteractionPriority } from "./create-client-interaction.dto";
import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsObject, IsDateString } from 'class-validator';

export class UpdateClientInteractionDto extends PartialType(CreateClientInteractionDto) {
  @IsOptional()
  @IsEnum(InteractionType)
  type?: InteractionType;

  @IsOptional()
  @IsEnum(InteractionDirection)
  direction?: InteractionDirection;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsEnum(ContactMethod)
  contactMethod?: ContactMethod;

  @IsOptional()
  @IsString()
  contactDetails?: string;

  @IsOptional()
  @IsEnum(InteractionOutcome)
  outcome?: InteractionOutcome;

  @IsOptional()
  @IsString()
  nextAction?: string;

  @IsOptional()
  @IsDateString()
  nextActionDate?: string;

  @IsOptional()
  @IsEnum(InteractionPriority)
  priority?: InteractionPriority;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  attachments?: object[];

  @IsOptional()
  @IsObject()
  metadata?: object;
}
