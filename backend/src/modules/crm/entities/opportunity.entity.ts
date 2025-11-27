import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, OneToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Broker } from '../../brokers/entities/broker.entity';
import { Lead } from './lead.entity';
import { Contract } from './contract.entity';
import { Activity } from './activity.entity';

export enum OpportunityStage {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

@Entity('opportunities')
@Index(['brokerId'])
@Index(['stage'])
@Index(['assignedTo'])
@Index(['expectedCloseDate'])
export class Opportunity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  leadId: string | null;

  @Column({ type: 'uuid' })
  brokerId: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: OpportunityStage,
    default: OpportunityStage.PROSPECTING,
  })
  stage: OpportunityStage;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  value: number;

  @Column({ type: 'int', default: 50 })
  probability: number;

  @Column({ type: 'date', nullable: true })
  expectedCloseDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  actualCloseDate: Date | null;

  @Column({ type: 'text', nullable: true })
  lostReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ type: 'jsonb', nullable: true })
  products: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  competitors: string[] | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Lead, (lead) => lead.opportunities, { nullable: true })
  lead: Lead | null;

  @ManyToOne(() => Broker, (broker) => broker.opportunities)
  broker: Broker;

  @OneToOne(() => Contract, (contract) => contract.opportunity, { nullable: true })
  contract: Contract | null;

  @OneToMany(() => Activity, (activity) => activity.opportunity)
  activities: Activity[];
}