import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import { Broker } from '../../brokers/entities/broker.entity';
import { TicketCategory } from './ticket-category.entity';
import { TicketPriority } from './ticket-priority.entity';
import { TicketMessage } from './ticket-message.entity';
import { TicketAssignment } from './ticket-assignment.entity';

@Entity('tickets')
@Index(['status', 'priorityId'])
@Index(['assignedToId', 'status'])
@Index(['slaDueDate', 'slaBreach'])
@Index(['userId', 'createdAt'])
@Index(['brokerId', 'createdAt'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  ticketNumber: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'broker_id', nullable: true })
  brokerId: string;

  @Column()
  subject: string;

  @Column({ nullable: true })
  title: string; // Ticket title/subject (distinct from subject field)

  @Column()
  description: string;

  @Column({ name: 'category_id' })
  categoryId: string;

  @Column({ name: 'priority_id' })
  priorityId: string;

  @Column({ name: 'assigned_to_id', nullable: true })
  assignedToId: string;

  @Column({ nullable: true })
  department: string; // SUPPORT, BILLING, TECHNICAL, COMPLIANCE, SALES

  @Column({ default: 'OPEN' })
  status: string; // OPEN, IN_PROGRESS, PENDING_CUSTOMER, RESOLVED, CLOSED

  @Column({ name: 'escalation_level', default: 0 })
  escalationLevel: number; // Current escalation level

  @Column({ nullable: true })
  resolution: string;

  @Column({ name: 'sla_due_date', type: 'timestamp' })
  slaDueDate: Date;

  @Column({ name: 'sla_breach', default: false })
  slaBreach: boolean;

  @Column({ name: 'first_response_at', type: 'timestamp', nullable: true })
  firstResponseAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'satisfaction_score', nullable: true })
  satisfactionScore: number; // 1-5

  @Column({ name: 'satisfaction_comment', nullable: true })
  satisfactionComment: string;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string; // Notes about ticket resolution

  @Column({ name: 'satisfaction_rating', type: 'int', nullable: true })
  satisfactionRating: number; // Customer satisfaction rating 1-5

  @Column({ default: 'WEB' })
  source: string; // WEB, EMAIL, API, PHONE, CHAT

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ name: 'custom_fields', type: 'json', nullable: true })
  customFields: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean; // Whether ticket is archived

  @Column({ name: 'archived_at', type: 'timestamp', nullable: true })
  archivedAt: Date; // When ticket was archived

  @Column({ name: 'created_by', nullable: true })
  createdBy: string; // User who created the ticket

  // Relations
  @ManyToOne(() => User, user => user.assignedTickets, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Broker, broker => broker.tickets, { nullable: true })
  @JoinColumn({ name: 'broker_id' })
  broker: Broker;

  @ManyToOne(() => TicketCategory, category => category.tickets)
  @JoinColumn({ name: 'category_id' })
  category: TicketCategory;

  @ManyToOne(() => TicketPriority, priority => priority.tickets)
  @JoinColumn({ name: 'priority_id' })
  priority: TicketPriority;

  @ManyToOne(() => User, user => user.ticketAssignments, { nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @OneToMany(() => TicketMessage, message => message.ticket)
  messages: TicketMessage[];

  @OneToMany(() => TicketAssignment, assignment => assignment.ticket)
  assignments: TicketAssignment[];
}