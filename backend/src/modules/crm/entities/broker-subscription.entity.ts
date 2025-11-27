import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Broker } from '../../brokers/entities/broker.entity';
import { BrokerAccount } from './broker-account.entity';
import { ApiUsageRecord } from '../../api-marketplace/entities/api-usage-record.entity';

@Entity('broker_subscriptions')
@Index(['brokerId', 'status'])
@Index(['nextBillingDate'])
@Index(['tier'])
export class BrokerSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'broker_id' })
  brokerId: string;

  @Column({ name: 'broker_account_id' })
  brokerAccountId: string;

  @Column()
  tier: string; // STARTER, VERIFIED, PARTNER, ENTERPRISE

  @Column({ name: 'plan_type', default: 'MONTHLY' })
  planType: string; // MONTHLY, QUARTERLY, YEARLY

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ name: 'api_calls_limit', nullable: true })
  apiCallsLimit: number;

  @Column({ name: 'api_calls_used', default: 0 })
  apiCallsUsed: number;

  @Column({ name: 'client_limit', nullable: true })
  clientLimit: number;

  @Column({ name: 'client_count', default: 0 })
  clientCount: number;

  @Column({ type: 'json', nullable: true })
  features: object; // { "advanced_analytics": true, "api_access": true, ... }

  @Column({ name: 'billing_cycle', default: 'MONTHLY' })
  billingCycle: string; // MONTHLY, QUARTERLY, YEARLY

  @Column({ name: 'next_billing_date', type: 'timestamp' })
  nextBillingDate: Date;

  @Column({ name: 'trial_ends_at', type: 'timestamp', nullable: true })
  trialEndsAt: Date;

  @Column({ default: 'ACTIVE' })
  status: string; // ACTIVE, SUSPENDED, CANCELLED, EXPIRED

  @Column({ name: 'auto_renew', default: true })
  autoRenew: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date;

  // Relations
  @ManyToOne(() => Broker, broker => broker.brokerSubscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_id' })
  broker: Broker;

  @ManyToOne(() => BrokerAccount, account => account.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_account_id' })
  brokerAccount: BrokerAccount;

  @OneToMany(() => ApiUsageRecord, usage => usage.subscription)
  usageRecords: ApiUsageRecord[];
}