import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Ticket } from './ticket.entity';
import { SLA } from './sla.entity';

@Entity('ticket_sla')
@Index(['ticketId'])
@Index(['slaId'])
@Index(['firstResponseBreached'])
@Index(['resolutionBreached'])
export class TicketSLA {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  ticketId: string;

  @Column({ type: 'uuid' })
  slaId: string;

  @Column({ type: 'timestamp' })
  firstResponseDue: Date;

  @Column({ type: 'timestamp', nullable: true })
  firstResponseAt: Date | null;

  @Column({ default: false })
  firstResponseBreached: boolean;

  @Column({ type: 'timestamp' })
  resolutionDue: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ default: false })
  resolutionBreached: boolean;

  @Column({ type: 'int', default: 0 })
  escalationLevel: number;

  @Column({ type: 'timestamp', nullable: true })
  escalatedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  pausedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  pausedDuration: number; // in minutes

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToOne(() => Ticket, (ticket) => ticket.ticketSLA, { onDelete: 'CASCADE' })
  ticket: Ticket;

  @ManyToOne(() => SLA, (sla) => sla.ticketSLAs)
  sla: SLA;
}