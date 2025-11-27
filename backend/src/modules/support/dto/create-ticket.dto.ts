import { IsString, IsOptional, IsEnum, IsArray, IsUUID, ValidateNested, IsObject, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '../entities/ticket.entity';

export class AttachmentDto {
  @ApiProperty({ description: 'Attachment URL' })
  @IsString()
  url: string;

  @ApiProperty({ description: 'Attachment file name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Attachment file size in bytes' })
  @IsString()
  size: number;

  @ApiProperty({ description: 'Attachment MIME type' })
  @IsString()
  type: string;
}

export class CreateTicketDto {
  @ApiProperty({ description: 'Ticket subject', example: 'Login issues with my account' })
  @IsString()
  @MinLength(5, { message: 'Subject must be at least 5 characters long' })
  @MaxLength(200, { message: 'Subject must not exceed 200 characters' })
  subject: string;

  @ApiProperty({
    description: 'Detailed description of the issue',
    example: 'I am unable to log into my account using my credentials. I have tried resetting my password but still cannot access my account.'
  })
  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters long' })
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters' })
  description: string;

  @ApiProperty({ description: 'Ticket category ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({
    description: 'Ticket priority level',
    enum: TicketPriority,
    example: TicketPriority.MEDIUM,
    default: TicketPriority.MEDIUM
  })
  @IsOptional()
  @IsEnum(TicketPriority, { message: 'Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL' })
  priority?: TicketPriority;

  @ApiPropertyOptional({ description: 'User ID (auto-populated from auth token)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Broker ID (if applicable)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  brokerId?: string;

  @ApiPropertyOptional({
    description: 'Tags for categorization',
    type: [String],
    example: ['login', 'account', 'urgent']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'File attachments',
    type: [AttachmentDto],
    example: [{
      url: 'https://example.com/screenshot.png',
      name: 'error-screenshot.png',
      size: 245760,
      type: 'image/png'
    }]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({
    description: 'Additional metadata for the ticket',
    example: {
      browser: 'Chrome 91.0.4472.124',
      operatingSystem: 'Windows 10',
      userAgent: 'Mozilla/5.0...',
      lastPage: '/dashboard'
    }
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}