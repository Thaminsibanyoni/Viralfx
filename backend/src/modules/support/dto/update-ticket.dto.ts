import { IsOptional, IsEnum, IsArray, IsString, IsObject, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketStatus } from '../enums/support.enum';

export class UpdateTicketDto {
  @ApiPropertyOptional({ description: 'Updated subject', example: 'Updated: Login issues with my account' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Subject must not exceed 200 characters' })
  subject?: string;

  @ApiPropertyOptional({
    description: 'Updated description',
    example: 'I am still unable to log into my account after trying the suggested solutions.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated priority level',
    enum: TicketPriority,
    example: TicketPriority.HIGH
  })
  @IsOptional()
  @IsEnum(TicketPriority, { message: 'Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL' })
  priority?: TicketPriority;

  @ApiPropertyOptional({
    description: 'Updated tags',
    type: [String],
    example: ['login', 'account', 'urgent', 'escalated']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Updated metadata',
    example: {
      browser: 'Chrome 92.0.4515.107',
      operatingSystem: 'Windows 10',
      escalationReason: 'Critical issue affecting multiple users'
    }
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
