import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Ticket } from './ticket.entity';

@Entity('ticket_priorities')
@Index(['isActive'])
export class TicketPriority {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  level: number; // 1=Critical, 2=High, 3=Medium, 4=Low

  @Column({ nullable: true })
  color: string; // Hex color for UI

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'response_time_hours' })
  responseTimeHours: number;

  @Column({ name: 'resolution_time_hours' })
  resolutionTimeHours: number;

  @Column({ name: 'notify_manager', default: false })
  notifyManager: boolean;

  @Column({ name: 'auto_escalate', default: false })
  autoEscalate: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Ticket, ticket => ticket.priority)
  tickets: Ticket[];
}