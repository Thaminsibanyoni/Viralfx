import { ApiProperty } from '@nestjs/swagger';
import { Order } from '../market-aggregation/entities/order.entity';

export class OrderResponseDto {
  @ApiProperty({ description: 'Order ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Market symbol' })
  symbol: string;

  @ApiProperty({
    description: 'Order type',
    enum: ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']
  })
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';

  @ApiProperty({
    description: 'Order side',
    enum: ['BUY', 'SELL']
  })
  side: 'BUY' | 'SELL';

  @ApiProperty({ description: 'Order quantity' })
  quantity: number;

  @ApiProperty({ description: 'Order price' })
  price: number;

  @ApiProperty({ description: 'Stop price' })
  stopPrice: number;

  @ApiProperty({
    description: 'Time in force',
    enum: ['GTC', 'IOC', 'FOK', 'DAY']
  })
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';

  @ApiProperty({
    description: 'Order status',
    enum: ['PENDING', 'OPEN', 'PARTIAL_FILLED', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED']
  })
  status: 'PENDING' | 'OPEN' | 'PARTIAL_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';

  @ApiProperty({ description: 'Filled quantity' })
  filledQuantity: number;

  @ApiProperty({ description: 'Remaining quantity' })
  remainingQuantity: number;

  @ApiProperty({ description: 'Average fill price' })
  avgFillPrice: number;

  @ApiProperty({ description: 'Total order value' })
  totalValue: number;

  @ApiProperty({ description: 'Commission paid' })
  commission: number;

  @ApiProperty({ description: 'Order fee' })
  fee: number;

  @ApiProperty({ description: 'Order created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Order updated at' })
  updatedAt: Date;

  @ApiProperty({ description: 'Order filled at' })
  filledAt: Date;

  @ApiProperty({ description: 'Fill details' })
  fills: Array<{
    id: string;
    quantity: number;
    price: number;
    commission: number;
    fee: number;
    timestamp: Date;
    tradeId: string;
  }>;

  @ApiProperty({ description: 'Is order active' })
  isActive: boolean;

  @ApiProperty({ description: 'Is order filled' })
  isFilled: boolean;

  @ApiProperty({ description: 'Is order cancelled' })
  isCancelled: boolean;

  @ApiProperty({ description: 'Fill percentage' })
  fillPercentage: number;

  static toDTO(order: Order): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      orderType: order.order_type,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      stopPrice: order.stop_price,
      timeInForce: order.time_in_force,
      status: order.status,
      filledQuantity: order.filled_quantity,
      remainingQuantity: order.remaining_quantity,
      avgFillPrice: order.avg_fill_price,
      totalValue: order.total_value,
      commission: order.commission,
      fee: order.fee,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      filledAt: order.filled_at,
      fills: order.fills || [],
      isActive: order.is_active,
      isFilled: order.is_filled,
      isCancelled: order.is_cancelled,
      fillPercentage: order.fill_percentage,
    };
  }
}