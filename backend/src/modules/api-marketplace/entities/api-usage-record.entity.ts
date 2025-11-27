import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { BrokerSubscription } from '../../crm/entities/broker-subscription.entity';
import { ApiProduct } from '../../../api-marketplace/entities/api-product.entity';

@Entity('api_usage_records')
@Index(['subscriptionId', 'createdAt'])
@Index(['productId', 'createdAt'])
export class ApiUsageRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subscription_id' })
  subscriptionId: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'api_key_id' })
  apiKeyId: string;

  @Column()
  endpoint: string;

  @Column()
  method: string;

  @Column({ name: 'status_code' })
  statusCode: number;

  @Column({ name: 'bytes_in', default: 0 })
  bytesIn: number;

  @Column({ name: 'bytes_out', default: 0 })
  bytesOut: number;

  @Column({ name: 'latency_ms', default: 0 })
  latencyMs: number;

  // Cost calculation fields
  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantity: number;

  @Column({ name: 'billing_rate', type: 'decimal', precision: 10, scale: 6, default: 0 })
  billingRate: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => BrokerSubscription, subscription => subscription.usageRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: BrokerSubscription;

  @ManyToOne(() => ApiProduct, product => product.apiUsage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: ApiProduct;
}