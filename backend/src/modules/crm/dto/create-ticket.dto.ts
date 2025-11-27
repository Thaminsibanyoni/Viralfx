import { IsString, IsNotEmpty, IsOptional, IsUUID, IsArray, MinLength, MaxLength, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({ description: 'Ticket title', example: 'Login issue with platform', minLength: 5, maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Ticket description', example: 'I am unable to log in to my account.', minLength: 10 })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description: string;

  @ApiProperty({ description: 'Ticket category ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ description: 'Ticket priority ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsNotEmpty()
  priorityId: string;

  @ApiPropertyOptional({ description: 'Broker ID for broker-related tickets', example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  @IsOptional()
  brokerId?: string;

  @ApiPropertyOptional({
    description: 'Attachment file URLs',
    example: ['https://example.com/files/screenshot.png'],
    type: [String]
  })
  @IsArray()
  @IsOptional()
  attachments?: string[];

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { userAgent: 'Mozilla/5.0...', operatingSystem: 'Windows 10' }
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}