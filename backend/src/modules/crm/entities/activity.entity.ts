import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ActivityEntityType {
  LEAD = 'LEAD',
  OPPORTUNITY = 'OPPORTUNITY',
  CONTRACT = 'CONTRACT',
  BROKER = 'BROKER',
}

export enum ActivityType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  NOTE = 'NOTE',
  TASK = 'TASK',
  DOCUMENT = 'DOCUMENT',
  ASSIGNMENT = 'ASSIGNMENT',
  CONVERSION = 'CONVERSION',
  CREATION = 'CREATION',
}

export enum ActivityStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('activities')
@Index(['entityType'])
@Index(['entityId'])
@Index(['assignedTo'])
@Index(['scheduledAt'])
@Index(['status'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ActivityEntityType,
  })
  entityType: ActivityEntityType;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  type: ActivityType;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ActivityStatus,
    default: ActivityStatus.SCHEDULED,
  })
  status: ActivityStatus;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  duration: number | null; // in minutes

  @Column({ type: 'text', nullable: true })
  outcome: string | null;

  @Column({ type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ type: 'jsonb', nullable: true })
  participants: Array<{
    name: string;
    email: string;
    type: 'INTERNAL' | 'EXTERNAL';
  }> | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{
    url: string;
    name: string;
    size: number;
    type: string;
  }> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}