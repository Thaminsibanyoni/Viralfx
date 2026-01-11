import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';
// TypeORM entity enums removed - using string literals instead
// import { OrderType, OrderSide, TimeInForce } // Removed database entity import - using Prismaorder.entity';

export class PlaceOrderDto {
  @IsUUID(4)
  trendId: string;

  @IsEnum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'])
  orderType: string;

  @IsEnum(['BUY', 'SELL'])
  orderSide: string;

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

  @IsEnum(['GTC', 'IOC', 'FOK', 'DAY'])
  @IsOptional()
  timeInForce?: string = 'GTC';

  @IsString()
  @IsOptional()
  @Max(50)
  clientOrderId?: string;

  @IsString()
  @IsOptional()
  @Max(500)
  notes?: string;
}
