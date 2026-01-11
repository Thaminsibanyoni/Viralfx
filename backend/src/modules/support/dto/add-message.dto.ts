import { IsString, IsOptional, IsArray, ValidateNested, IsBoolean, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageAttachmentDto {
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

export class AddMessageDto {
  @ApiProperty({
  description: 'Message content',
  example: 'I have tried the suggested solution but the issue persists. Here is a screenshot of the error message.'
  })
  @IsString()
  @MinLength(1, { message: 'Message content cannot be empty' })
  @MaxLength(10000, { message: 'Message content must not exceed 10000 characters' })
  content: string;

  @ApiPropertyOptional({
  description: 'Whether this is an internal note (only visible to support team)',
  default: false,
  example: false
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @ApiPropertyOptional({
  description: 'File attachments',
  type: [MessageAttachmentDto],
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
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}