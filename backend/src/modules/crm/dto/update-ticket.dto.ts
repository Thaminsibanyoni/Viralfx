import { IsString, IsOptional, IsEnum, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTicketDto {
  @ApiPropertyOptional({
    description: 'Ticket status',
    enum: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
    example: 'IN_PROGRESS'
  })
  @IsEnum(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Priority ID',
    example: '550e8400-e29b-41d4-a716-446655440001'
  })
  @IsUUID()
  @IsOptional()
  priorityId?: string;

  @ApiPropertyOptional({
    description: 'Category ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Staff member ID to assign ticket to',
    example: '550e8400-e29b-41d4-a716-446655440003'
  })
  @IsUUID()
  @IsOptional()
  assignedTo?: string;

  @ApiPropertyOptional({
    description: 'Resolution notes',
    example: 'Issue resolved by resetting user password.'
  })
  @IsString()
  @IsOptional()
  resolutionNotes?: string;

  @ApiPropertyOptional({
    description: 'Customer satisfaction rating (1-5)',
    example: 4,
    minimum: 1,
    maximum: 5
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(5)
  satisfactionRating?: number;
}
