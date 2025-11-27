import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Broker } from '../../brokers/entities/broker.entity';
import { Opportunity } from './opportunity.entity';

export enum ContractType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  ONE_TIME = 'ONE_TIME',
  CUSTOM = 'CUSTOM',
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  SIGNED = 'SIGNED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
}

@Entity('contracts')
@Index(['brokerId'])
@Index(['status'])
@Index(['contractNumber'])
@Index(['endDate'])
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  opportunityId: string;

  @Column({ type: 'uuid' })
  brokerId: string;

  @Column({ unique: true })
  contractNumber: string;

  @Column({
    type: 'enum',
    enum: ContractType,
  })
  type: ContractType;

  @Column({
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.DRAFT,
  })
  status: ContractStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  value: number;

  @Column({ default: 'ZAR' })
  currency: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'date', nullable: true })
  renewalDate: Date | null;

  @Column({ default: false })
  autoRenew: boolean;

  @Column({ type: 'text', nullable: true })
  terms: string | null;

  @Column({ type: 'uuid', nullable: true })
  templateId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  signedBy: {
    name: string;
    email: string;
    signedAt: Date;
    ipAddress: string;
  } | null;

  @Column({ nullable: true })
  documentUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Opportunity, (opportunity) => opportunity.contract)
  opportunity: Opportunity;

  @ManyToOne(() => Broker, (broker) => broker.contracts)
  broker: Broker;
}