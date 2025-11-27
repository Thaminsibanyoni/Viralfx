import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, OneToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { TicketCategory } from './ticket-category.entity';
import { TicketSLA } from './ticket-sla.entity';
import { TicketMessage } from './ticket-message.entity';

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TicketStatus {
  NEW = 'NEW',
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

@Entity('tickets')
@Index(['ticketNumber'])
@Index(['userId'])
@Index(['brokerId'])
@Index(['status'])
@Index(['priority'])
@Index(['assignedTo'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  ticketNumber: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', nullable: true })
  brokerId: string | null;

  @Column({ type: 'uuid' })
  categoryId: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  priority: TicketPriority;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.NEW,
  })
  status: TicketStatus;

  @Column({ type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{
    url: string;
    name: string;
    size: number;
    type: string;
  }> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true })
  firstResponseAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => TicketCategory, (category) => category.tickets)
  category: TicketCategory;

  @OneToOne(() => TicketSLA, (ticketSLA) => ticketSLA.ticket)
  ticketSLA: TicketSLA;

  @OneToMany(() => TicketMessage, (message) => message.ticket)
  messages: TicketMessage[];
}