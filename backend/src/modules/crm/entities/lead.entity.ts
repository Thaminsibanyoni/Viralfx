import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Broker } from '../../brokers/entities/broker.entity';
import { RelationshipManager } from './relationship-manager.entity';
import { Activity } from './activity.entity';

export enum LeadSource {
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  COLD_CALL = 'COLD_CALL',
  EVENT = 'EVENT',
  PARTNER = 'PARTNER',
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  UNQUALIFIED = 'UNQUALIFIED',
  CONVERTED = 'CONVERTED',
}

@Entity('leads')
@Index(['brokerId'])
@Index(['status'])
@Index(['assignedTo'])
@Index(['leadScore'])
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  brokerId: string | null;

  @Column({
    type: 'enum',
    enum: LeadSource,
  })
  source: LeadSource;

  @Column({
    type: 'enum',
    enum: LeadStatus,
    default: LeadStatus.NEW,
  })
  status: LeadStatus;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ nullable: true })
  company: string | null;

  @Column({ nullable: true })
  position: string | null;

  @Column({ nullable: true })
  country: string | null;

  @Column({ nullable: true })
  region: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedRevenue: number | null;

  @Column({ type: 'int', default: 0 })
  leadScore: number;

  @Column({ type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true })
  convertedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Broker, (broker) => broker.leads, { nullable: true })
  broker: Broker | null;

  @ManyToOne(() => RelationshipManager, (manager) => manager.leads, { nullable: true })
  relationshipManager: RelationshipManager | null;

  @OneToMany(() => Activity, (activity) => activity.lead)
  activities: Activity[];
}