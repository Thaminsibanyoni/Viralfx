import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ticket_assignments')
@Index(['ticketId', 'isCurrent'])
@Index(['assignedToId', 'createdAt'])
export class TicketAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id' })
  ticketId: string;

  @Column({ name: 'assigned_by_id' })
  assignedById: string;

  @Column({ name: 'assigned_to_id' })
  assignedToId: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ name: 'is_current', default: true })
  isCurrent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Ticket, ticket => ticket.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @ManyToOne(() => User, user => user.ticketAssignmentsBy)
  @JoinColumn({ name: 'assigned_by_id' })
  assignedBy: User;

  @ManyToOne(() => User, user => user.ticketAssignmentsTo)
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: User;
}