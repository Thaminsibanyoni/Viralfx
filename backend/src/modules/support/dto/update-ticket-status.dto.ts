import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '../enums/support.enum';

export class UpdateTicketStatusDto {
  @ApiProperty({
    description: 'New ticket status',
    enum: TicketStatus,
    example: TicketStatus.RESOLVED
  })
  @IsEnum(TicketStatus, { message: 'Status must be one of: NEW, OPEN, PENDING, RESOLVED, CLOSED, REOPENED' })
  status: TicketStatus;

  @ApiPropertyOptional({
    description: 'Notes about the status change',
    example: 'Issue resolved by resetting user password. User can now log in successfully.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Notes must not exceed 2000 characters' })
  notes?: string;
}
