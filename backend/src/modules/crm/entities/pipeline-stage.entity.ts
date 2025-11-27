import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BrokerDeal } from './broker-deal.entity';

@Entity('pipeline_stages')
@Index(['stageOrder'], { unique: true })
export class PipelineStage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'stage_order', unique: true })
  stageOrder: number;

  @Column({ nullable: true })
  color: string; // Hex color for UI

  @Column({ name: 'default_probability', default: 50 })
  defaultProbability: number; // Percentage

  @Column({ name: 'average_duration', nullable: true })
  averageDuration: number; // Days in stage

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'requires_approval', default: false })
  requiresApproval: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => BrokerDeal, deal => deal.stage)
  deals: BrokerDeal[];
}