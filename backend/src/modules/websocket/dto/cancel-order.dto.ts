import { IsUUID, IsString, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CancelOrderDto {
  @ApiProperty({ description: 'Order ID to cancel' })
  @IsUUID('4')
  orderId: string;

  @ApiProperty({ description: 'Cancellation reason', required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ description: 'Cancel only portion', required: false })
  @IsOptional()
  quantity?: number;
}