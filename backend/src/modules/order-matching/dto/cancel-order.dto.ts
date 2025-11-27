import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @ApiProperty({ description: 'Order ID to cancel' })
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: 'Cancellation reason',
    required: false,
    maxLength: 200
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}