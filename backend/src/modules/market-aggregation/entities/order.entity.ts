import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('orders')
@Index(['user_id', 'symbol', 'status'])
@Index(['status', 'created_at'])
@Index(['symbol', 'side', 'status'])
export class Order {
  @ApiProperty({ description: 'Unique order identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID who placed the order' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'Market symbol' })
  @Column()
  symbol: string;

  @ApiProperty({ description: 'Order type' })
  @Column({
    type: 'enum',
    enum: ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']
  })
  order_type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';

  @ApiProperty({ description: 'Order side' })
  @Column({
    type: 'enum',
    enum: ['BUY', 'SELL']
  })
  side: 'BUY' | 'SELL';

  @ApiProperty({ description: 'Order quantity' })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  quantity: number;

  @ApiProperty({ description: 'Order price' })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number;

  @ApiProperty({ description: 'Stop price for stop orders' })
  @Column({ name: 'stop_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  stop_price: number;

  @ApiProperty({ description: 'Time in force' })
  @Column({
    type: 'enum',
    enum: ['GTC', 'IOC', 'FOK', 'DAY']
  })
  time_in_force: 'GTC' | 'IOC' | 'FOK' | 'DAY';

  @ApiProperty({ description: 'Order status' })
  @Column({
    type: 'enum',
    enum: ['PENDING', 'OPEN', 'PARTIAL_FILLED', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED']
  })
  status: 'PENDING' | 'OPEN' | 'PARTIAL_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';

  @ApiProperty({ description: 'Filled quantity' })
  @Column({ name: 'filled_quantity', type: 'decimal', precision: 15, scale: 2, default: 0 })
  filled_quantity: number;

  @ApiProperty({ description: 'Remaining quantity' })
  @Column({ name: 'remaining_quantity', type: 'decimal', precision: 15, scale: 2 })
  remaining_quantity: number;

  @ApiProperty({ description: 'Average fill price' })
  @Column({ name: 'avg_fill_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  avg_fill_price: number;

  @ApiProperty({ description: 'Total order value' })
  @Column({ name: 'total_value', type: 'decimal', precision: 15, scale: 2, nullable: true })
  total_value: number;

  @ApiProperty({ description: 'Commission paid' })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  commission: number;

  @ApiProperty({ description: 'Order fee' })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fee: number;

  // Broker Attribution
  @ApiProperty({ description: 'Broker ID for commission attribution', required: false })
  @Column({ name: 'broker_id', type: 'uuid', nullable: true })
  broker_id?: string;

  @ApiProperty({ description: 'Broker commission amount', required: false })
  @Column({ name: 'broker_commission', type: 'decimal', precision: 10, scale: 2, default: 0 })
  broker_commission: number;

  @ApiProperty({ description: 'Platform commission amount', required: false })
  @Column({ name: 'platform_commission', type: 'decimal', precision: 10, scale: 2, default: 0 })
  platform_commission: number;

  @ApiProperty({ description: 'Order created timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ApiProperty({ description: 'Order updated timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ApiProperty({ description: 'Order filled timestamp' })
  @Column({ name: 'filled_at', type: 'timestamp', nullable: true })
  filled_at: Date;

  @ApiProperty({ description: 'Order cancelled timestamp' })
  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelled_at: Date;

  @ApiProperty({ description: 'Order expires at' })
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expires_at: Date;

  @ApiProperty({ description: 'Client order ID' })
  @Column({ name: 'client_order_id', nullable: true })
  client_order_id: string;

  @ApiProperty({ description: 'Reject reason' })
  @Column({ name: 'reject_reason', nullable: true })
  reject_reason: string;

  @ApiProperty({ description: 'Order metadata' })
  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Fill details' })
  @Column('jsonb', { nullable: true })
  fills: Array<{
    id: string;
    quantity: number;
    price: number;
    commission: number;
    fee: number;
    timestamp: Date;
    trade_id: string;
  }>;

  @ApiProperty({ description: 'Order source' })
  @Column({
    type: 'enum',
    enum: ['WEB', 'MOBILE', 'API', 'BOT'],
    default: 'WEB'
  })
  source: 'WEB' | 'MOBILE' | 'API' | 'BOT';

  @ApiProperty({ description: 'IP address' })
  @Column({ name: 'ip_address', nullable: true })
  ip_address: string;

  @ApiProperty({ description: 'User agent' })
  @Column({ name: 'user_agent', nullable: true })
  user_agent: string;

  // Relations
  @ManyToOne('User', 'orders')
  @JoinColumn({ name: 'user_id' })
  user: any;

  @ManyToOne('Market', 'orders')
  @JoinColumn({ name: 'symbol', referencedColumnName: 'symbol' })
  market: any;

  @ManyToOne('Broker', 'orders')
  @JoinColumn({ name: 'broker_id' })
  broker?: any;

  // Calculated properties
  @ApiProperty({ description: 'Is order active' })
  get is_active(): boolean {
    return ['PENDING', 'OPEN', 'PARTIAL_FILLED'].includes(this.status);
  }

  @ApiProperty({ description: 'Is order filled' })
  get is_filled(): boolean {
    return this.status === 'FILLED';
  }

  @ApiProperty({ description: 'Is order cancelled' })
  get is_cancelled(): boolean {
    return ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(this.status);
  }

  @ApiProperty({ description: 'Fill percentage' })
  get fill_percentage(): number {
    if (this.quantity === 0) return 0;
    return (this.filled_quantity / this.quantity) * 100;
  }

  @ApiProperty({ description: 'Realized P&L' })
  get realized_pnl(): number {
    if (!this.fills || this.fills.length === 0) return 0;

    return this.fills.reduce((pnl, fill) => {
      const fillValue = fill.quantity * fill.price;
      const orderValue = fill.quantity * (this.price || fill.price);
      return pnl + (fillValue - orderValue);
    }, 0);
  }

  @ApiProperty({ description: 'Has broker attribution' })
  get has_broker_attribution(): boolean {
    return !!this.broker_id;
  }
}