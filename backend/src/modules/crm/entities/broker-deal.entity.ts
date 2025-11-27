import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Broker } from '../../brokers/entities/broker.entity';
import { PipelineStage } from './pipeline-stage.entity';
import { User } from '../../users/entities/user.entity';
import { DealActivity } from './deal-activity.entity';

@Entity('broker_deals')
@Index(['brokerId', 'status'])
@Index(['stageId'])
@Index(['assignedToId'])
@Index(['expectedCloseDate'])
export class BrokerDeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'broker_id' })
  brokerId: string;

  @Column({ name: 'stage_id' })
  stageId: string;

  @Column({ name: 'assigned_to_id', nullable: true })
  assignedToId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  value: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ default: 50 })
  probability: number; // Percentage

  @Column({ name: 'weighted_value', type: 'decimal', precision: 12, scale: 2 })
  weightedValue: number;

  @Column({ name: 'expected_close_date', type: 'timestamp', nullable: true })
  expectedCloseDate: Date;

  @Column({ name: 'actual_close_date', type: 'timestamp', nullable: true })
  actualCloseDate: Date;

  @Column({ nullable: true })
  source: string; // WEBSITE, REFERRAL, COLD_CALL, PARTNER, EVENT

  @Column({ nullable: true })
  campaign: string;

  @Column({ name: 'contact_person', nullable: true })
  contactPerson: string;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail: string;

  @Column({ name: 'contact_phone', nullable: true })
  contactPhone: string;

  @Column({ default: 'OPEN' })
  status: string; // OPEN, WON, LOST, CANCELLED, ON_HOLD

  @Column({ name: 'loss_reason', nullable: true })
  lossReason: string;

  @Column({ name: 'win_reason', nullable: true })
  winReason: string;

  @Column({ type: 'json', nullable: true })
  requirements: object; // { "kyc_required": true, "api_access": true, ... }

  @Column({ name: 'custom_fields', type: 'json', nullable: true })
  customFields: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Broker, broker => broker.deals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_id' })
  broker: Broker;

  @ManyToOne(() => PipelineStage, stage => stage.deals)
  @JoinColumn({ name: 'stage_id' })
  stage: PipelineStage;

  @ManyToOne(() => User, user => user.assignedDeals, { nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: User;

  @OneToMany(() => DealActivity, activity => activity.deal)
  activities: DealActivity[];
}