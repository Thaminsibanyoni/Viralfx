import { IsUUID, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTicketDto {
  @ApiProperty({
    description: 'ID of the user to assign the ticket to',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  assignedTo: string;
}