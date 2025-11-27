import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';
import { OrderType, OrderSide, TimeInForce } from '../../database/entities/order.entity';

export class PlaceOrderDto {
  @IsUUID(4)
  trendId: string;

  @IsEnum(OrderType)
  orderType: OrderType;

  @IsEnum(OrderSide)
  orderSide: OrderSide;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 8 })
  @IsOptional()
  @Min(0.00000001)
  price?: number;

  @IsNumber({ maxDecimalPlaces: 8 })
  @IsOptional()
  @Min(0.00000001)
  stopPrice?: number;

  @IsEnum(TimeInForce)
  @IsOptional()
  timeInForce?: TimeInForce = TimeInForce.GTC;

  @IsString()
  @IsOptional()
  @Max(50)
  clientOrderId?: string;

  @IsString()
  @IsOptional()
  @Max(500)
  notes?: string;
}