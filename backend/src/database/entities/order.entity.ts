import {
  Entity,
  Column,
  OneToMany,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsString, IsEnum, IsOptional, IsNumber, Min, IsDateString } from 'class-validator';
import { BaseEntity } from './base.entity';
import { OrderFill } from './order-fill.entity';
import { User } from './user.entity';
import { Trend } from './trend.entity';
import { Transaction } from './transaction.entity';
import { Broker } from '../../modules/brokers/entities/broker.entity';

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP_LOSS = 'STOP_LOSS',
  TAKE_PROFIT = 'TAKE_PROFIT',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PARTIAL_FILLED = 'PARTIAL_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum TimeInForce {
  GTC = 'GTC', // Good Till Canceled
  IOC = 'IOC', // Immediate Or Cancel
  FOK = 'FOK', // Fill Or Kill
  DAY = 'DAY', // Day Order
}

@Entity('orders')
@Index(['userId'])
@Index(['trendId'])
@Index(['status'])
@Index(['orderType'])
@Index(['createdAt'])
@Index(['status', 'orderSide', 'price'])
@Index(['trendId', 'price', 'createdAt'])
@Index(['userId', 'status'])
@Index(['userId', 'status', 'createdAt'])
export class Order extends BaseEntity {
  @Column({
    type: 'uuid',
    name: 'user_id',
  })
  userId: string;

  @Column({
    type: 'uuid',
    name: 'trend_id',
  })
  trendId: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    name: 'order_id',
  })
  @IsString()
  orderId: string;

  @Column({
    type: 'enum',
    enum: OrderType,
    name: 'order_type',
  })
  @IsEnum(OrderType)
  orderType: OrderType;

  @Column({
    type: 'enum',
    enum: OrderSide,
    name: 'order_side',
  })
  @IsEnum(OrderSide)
  orderSide: OrderSide;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
  })
  @Min(0.00000001)
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  @IsOptional()
  @Min(0.00000001)
  price?: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
    name: 'stop_price',
  })
  @IsOptional()
  @Min(0.00000001)
  stopPrice?: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'filled_quantity',
  })
  @Min(0)
  filledQuantity: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'remaining_quantity',
  })
  @Min(0)
  remainingQuantity: number; // This will be computed as quantity - filled_quantity

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'average_fill_price',
  })
  @Min(0)
  averageFillPrice: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'total_value',
  })
  @Min(0)
  totalValue: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @Column({
    type: 'varchar',
    length: 20,
    default: TimeInForce.GTC,
    name: 'time_in_force',
  })
  @IsEnum(TimeInForce)
  timeInForce: TimeInForce;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'WEB',
    name: 'order_source',
  })
  @IsOptional()
  @IsString()
  orderSource: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'client_order_id',
  })
  @IsOptional()
  @IsString()
  clientOrderId?: string;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 6,
    default: 0.000000,
    name: 'fee_rate',
  })
  @Min(0)
  feeRate: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0.00000000,
    name: 'fee_amount',
  })
  @Min(0)
  feeAmount: number;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'ZAR',
    name: 'fee_currency',
  })
  @IsString()
  feeCurrency: string;

  // Broker Attribution
  @Column({
    type: 'uuid',
    nullable: true,
    name: 'broker_id',
  })
  @IsOptional()
  brokerId?: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.00,
    name: 'broker_commission',
  })
  @Min(0)
  brokerCommission: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.00,
    name: 'platform_commission',
  })
  @Min(0)
  platformCommission: number;

  @Column({
    type: 'text',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @Column({
    type: 'json',
    default: () => "'{}'",
  })
  @IsOptional()
  metadata: Record<string, any>;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'expires_at',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'filled_at',
  })
  @IsOptional()
  @IsDateString()
  filledAt?: Date;

  // Relationships
  @OneToMany(() => OrderFill, (fill) => fill.order)
  fills: OrderFill[];

  @OneToMany(() => OrderFill, (fill) => fill.takerOrder)
  takerFills: OrderFill[];

  @OneToMany(() => OrderFill, (fill) => fill.makerOrder)
  makerFills: OrderFill[];

  @OneToMany(() => Transaction, (transaction) => transaction.order)
  transactions: Transaction[];

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Trend, (trend) => trend.orders)
  @JoinColumn({ name: 'trend_id' })
  trend: Trend;

  @ManyToOne(() => Broker, (broker) => broker.orders, {
    nullable: true,
  })
  @JoinColumn({ name: 'broker_id' })
  broker?: Broker;

  // Computed properties
  get fillPercentage(): number {
    return this.quantity > 0 ? (this.filledQuantity / this.quantity) * 100 : 0;
  }

  get isFilled(): boolean {
    return this.filledQuantity >= this.quantity;
  }

  get isPartiallyFilled(): boolean {
    return this.filledQuantity > 0 && this.filledQuantity < this.quantity;
  }

  get isActive(): boolean {
    return this.status === OrderStatus.PENDING || this.status === OrderStatus.PARTIAL_FILLED;
  }

  get isCompleted(): boolean {
    return this.status === OrderStatus.FILLED || this.status === OrderStatus.CANCELLED || this.status === OrderStatus.REJECTED;
  }

  get isMarketOrder(): boolean {
    return this.orderType === OrderType.MARKET;
  }

  get isLimitOrder(): boolean {
    return this.orderType === OrderType.LIMIT;
  }

  get isBuyOrder(): boolean {
    return this.orderSide === OrderSide.BUY;
  }

  get isSellOrder(): boolean {
    return this.orderSide === OrderSide.SELL;
  }

  get effectivePrice(): number {
    if (this.isMarketOrder) {
      return this.averageFillPrice || 0;
    }
    return this.price || 0;
  }

  get remainingValue(): number {
    return this.remainingQuantity * this.effectivePrice;
  }

  get filledValue(): number {
    return this.filledQuantity * this.averageFillPrice;
  }

  get estimatedFee(): number {
    return this.totalValue * this.feeRate;
  }

  get netValue(): number {
    return this.totalValue + this.feeAmount;
  }

  get isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  }

  get timeToExpiry(): number | null {
    if (!this.expiresAt) return null;
    const now = new Date();
    const expiry = new Date(this.expiresAt);
    return expiry.getTime() - now.getTime();
  }

  get hasBrokerAttribution(): boolean {
    return !!this.brokerId;
  }

  @BeforeInsert()
  protected beforeInsert() {
    super.beforeInsert();
    this.calculateOrderValues();
    this.generateOrderId();
  }

  @BeforeUpdate()
  protected beforeUpdate() {
    super.beforeUpdate();
    this.calculateOrderValues();
    this.updateRemainingQuantity();
  }

  private generateOrderId(): void {
    if (!this.orderId) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const sidePrefix = this.orderSide === OrderSide.BUY ? 'B' : 'S';
      const typePrefix = this.orderType === OrderType.MARKET ? 'M' : 'L';
      this.orderId = `${sidePrefix}${typePrefix}_${timestamp}_${random}`;
    }
  }

  private calculateOrderValues(): void {
    // Calculate total value based on order type
    if (this.isMarketOrder) {
      // Market orders: value will be calculated based on fills
      this.totalValue = 0;
    } else {
      // Limit orders: value = quantity × price
      this.totalValue = this.quantity * (this.price || 0);
    }

    // Calculate estimated fee
    this.feeAmount = this.totalValue * this.feeRate;

    // Initialize commission fields (will be updated by attribution service)
    if (!this.brokerCommission) {
      this.brokerCommission = 0;
    }
    if (!this.platformCommission) {
      this.platformCommission = this.feeAmount;
    }

    // Update average fill price when filled
    if (this.filledQuantity > 0 && this.fills && this.fills.length > 0) {
      let totalFillValue = 0;
      let totalFillQuantity = 0;

      this.fills.forEach(fill => {
        totalFillValue += fill.quantity * fill.price;
        totalFillQuantity += fill.quantity;
      });

      if (totalFillQuantity > 0) {
        this.averageFillPrice = totalFillValue / totalFillQuantity;
      }
    }
  }

  private updateRemainingQuantity(): void {
    this.remainingQuantity = this.quantity - this.filledQuantity;
  }

  protected validate(): void {
    // Basic validation
    if (this.quantity <= 0) {
      throw new Error('Order quantity must be positive');
    }

    if (this.price !== undefined && this.price <= 0) {
      throw new Error('Order price must be positive for limit orders');
    }

    if (this.stopPrice !== undefined && this.stopPrice <= 0) {
      throw new Error('Stop price must be positive');
    }

    if (this.filledQuantity < 0 || this.filledQuantity > this.quantity) {
      throw new Error('Filled quantity must be between 0 and total quantity');
    }

    if (this.remainingQuantity < 0) {
      throw new Error('Remaining quantity cannot be negative');
    }

    if (this.feeRate < 0) {
      throw new Error('Fee rate cannot be negative');
    }

    if (this.feeAmount < 0) {
      throw new Error('Fee amount cannot be negative');
    }

    // Order type specific validation
    if (this.isLimitOrder && !this.price) {
      throw new Error('Limit orders must have a specified price');
    }

    if (this.isMarketOrder && this.price) {
      throw new Error('Market orders should not have a specified price');
    }

    // Stop order validation
    if (this.orderType === OrderType.STOP_LOSS && !this.stopPrice) {
      throw new Error('Stop loss orders must have a stop price');
    }

    if (this.orderType === OrderType.TAKE_PROFIT && !this.stopPrice) {
      throw new Error('Take profit orders must have a stop price');
    }

    // Status consistency validation
    if (this.status === OrderStatus.FILLED && !this.isFilled) {
      throw new Error('Filled status requires complete fill');
    }

    if (this.status === OrderStatus.PARTIAL_FILLED && (this.filledQuantity === 0 || this.isFilled)) {
      throw new Error('Partial filled status requires partial fill');
    }

    if ((this.status === OrderStatus.CANCELLED || this.status === OrderStatus.REJECTED) && this.filledQuantity > 0) {
      // Allow cancelled orders with partial fills
      if (this.status === OrderStatus.CANCELLED && this.filledQuantity === this.quantity) {
        throw new Error('Completely filled orders cannot be cancelled');
      }
    }

    // Time validation
    if (this.expiresAt && this.launchedAt && new Date(this.expiresAt) <= new Date(this.launchedAt)) {
      throw new Error('Expiration must be after creation time');
    }

    if (this.filledAt && new Date(this.filledAt) < new Date(this.createdAt)) {
      throw new Error('Fill time cannot be before creation time');
    }
  }
}