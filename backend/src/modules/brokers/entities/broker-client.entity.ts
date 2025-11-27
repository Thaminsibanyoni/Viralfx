import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Broker } from './broker.entity';
import { User } from '../../users/entities/user.entity';

export enum ClientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  CHURNED = 'CHURNED'
}

export enum AttributionType {
  REFERRAL_LINK = 'REFERRAL_LINK',
  REFERRAL_CODE = 'REFERRAL_CODE',
  DIRECT_SIGNUP = 'DIRECT_SIGNUP',
  API_INTEGRATION = 'API_INTEGRATION',
  WHITE_LABEL = 'WHITE_LABEL'
}

@Entity('broker_clients')
@Index(['brokerId', 'clientId'])
@Index(['brokerId', 'status'])
@Index(['brokerId', 'attributionType'])
@Index(['createdAt'])
export class BrokerClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'broker_id' })
  brokerId: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @Column({
    type: 'enum',
    enum: ClientStatus,
    default: ClientStatus.ACTIVE
  })
  status: ClientStatus;

  @Column({
    type: 'enum',
    enum: AttributionType,
    default: AttributionType.DIRECT_SIGNUP
  })
  attributionType: AttributionType;

  @Column({ name: 'referral_code', nullable: true })
  referralCode?: string;

  @Column({ name: 'referral_link', nullable: true })
  referralLink?: string;

  @Column({ name: 'attributionDate', type: 'timestamp' })
  attributionDate: Date;

  @Column({ name: 'firstTradeDate', type: 'timestamp', nullable: true })
  firstTradeDate?: Date;

  @Column({ name: 'lastTradeDate', type: 'timestamp', nullable: true })
  lastTradeDate?: Date;

  @Column({ name: 'totalTrades', default: 0 })
  totalTrades: number;

  @Column({ name: 'totalVolume', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalVolume: number;

  @Column({ name: 'totalCommission', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCommission: number;

  @Column({ name: 'totalBrokerCommission', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalBrokerCommission: number;

  @Column({ name: 'totalPlatformCommission', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPlatformCommission: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Broker, broker => broker.clients, { onDelete: 'CASCADE' })
  broker: Broker;

  @ManyToOne(() => User, user => user.brokerClients, { onDelete: 'CASCADE' })
  client: User;
}