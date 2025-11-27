import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOrderDto {
  @ApiProperty({ description: 'Order ID to update' })
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: 'Updated quantity',
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  @Type(() => Number)
  quantity?: number;

  @ApiProperty({
    description: 'Updated price',
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  price?: number;

  @ApiProperty({
    description: 'Updated stop price',
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  stopPrice?: number;
}