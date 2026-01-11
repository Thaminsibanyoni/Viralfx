import { IsUUID, IsNumber, IsString, IsOptional, Min, Max, IsEnum, IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateOrderDto {
  @ApiProperty({ description: 'Order ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Price', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ description: 'Quantity', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Order type', required: false })
  @IsOptional()
  @IsEnum(['buy', 'sell'])
  type?: 'buy' | 'sell';

  @ApiProperty({ description: 'Order status', required: false })
  @IsOptional()
  @IsEnum(['pending', 'filled', 'cancelled', 'partial'])
  status?: 'pending' | 'filled' | 'cancelled' | 'partial';

  @ApiProperty({ description: 'Fill price', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fillPrice?: number;

  @ApiProperty({ description: 'Filled quantity', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  filledQuantity?: number;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}