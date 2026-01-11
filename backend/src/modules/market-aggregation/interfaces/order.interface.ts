export interface Order {
  id?: string;
  userId: string;
  trendId?: string;
  symbol?: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP';
  quantity: number;
  price?: number;
  stopPrice?: number;
  filledQuantity?: number;
  averagePrice?: number;
  status: 'PENDING' | 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';
  orderReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
  filledAt?: Date;
  cancelledAt?: Date;
}

export interface OrderFill {
  fillId: string;
  orderId: string;
  quantity: number;
  price: number;
  timestamp: Date;
  tradeId?: string;
}
