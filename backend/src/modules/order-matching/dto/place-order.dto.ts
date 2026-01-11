import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, Min, IsOptional, IsUUID, MaxLength, validate, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class PlaceOrderDto {
  @ApiProperty({ description: 'Market symbol' })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: 'Order type',
    enum: ['MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT']
  })
  @IsEnum(['MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT'])
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';

  @ApiProperty({
    description: 'Order side',
    enum: ['BUY', 'SELL']
  })
  @IsEnum(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @ApiProperty({ description: 'Order quantity' })
  @IsNumber()
  @Min(0.00000001)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    description: 'Order price (required for LIMIT orders)',
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  price?: number;

  @ApiProperty({
    description: 'Stop price for STOP_LOSS orders. When market price reaches this level, the order will be triggered as a market order.',
    required: false
  })
  @ValidateIf(o => o.orderType === 'STOP_LOSS')
  @IsNumber({ message: 'Stop price is required for STOP_LOSS orders' })
  @Min(0.01, { message: 'Stop price must be greater than 0' })
  @Type(() => Number)
  stopPrice?: number;

  @ApiProperty({
    description: 'Take profit price for TAKE_PROFIT orders. When market price reaches this level, the order will be triggered as a limit order.',
    required: false
  })
  @ValidateIf(o => o.orderType === 'TAKE_PROFIT')
  @IsNumber({ message: 'Take profit price is required for TAKE_PROFIT orders' })
  @Min(0.01, { message: 'Take profit price must be greater than 0' })
  @Type(() => Number)
  takeProfitPrice?: number;

  @ApiProperty({
    description: 'Time in force',
    enum: ['GTC', 'IOC', 'FOK', 'DAY'],
    default: 'GTC'
  })
  @IsOptional()
  @IsEnum(['GTC', 'IOC', 'FOK', 'DAY'])
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'DAY';

  @ApiProperty({
    description: 'Client order ID',
    required: false,
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  clientOrderId?: string;

  @ApiProperty({
    description: 'Broker ID for commission attribution',
    required: false
  })
  @IsOptional()
  @IsUUID()
  brokerId?: string;
}
