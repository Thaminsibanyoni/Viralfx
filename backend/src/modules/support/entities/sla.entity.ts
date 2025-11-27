import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { TicketPriority } from './ticket.entity';
import { TicketCategory } from './ticket-category.entity';
import { TicketSLA } from './ticket-sla.entity';

@Entity('sla')
@Index(['priority'])
@Index(['isActive'])
export class SLA {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    unique: true,
  })
  priority: TicketPriority;

  @Column({ type: 'int' }) // in minutes
  firstResponseTime: number;

  @Column({ type: 'int' }) // in minutes
  resolutionTime: number;

  @Column({ default: true })
  businessHoursOnly: boolean;

  @Column({ type: 'jsonb', nullable: true })
  escalationRules: Array<{
    level: number;
    timeout: number; // minutes after previous level
    assignTo: string; // user or team ID
    notify: string[]; // user IDs to notify
  }> | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => TicketCategory, (category) => category.sla)
  categories: TicketCategory[];

  @OneToMany(() => TicketSLA, (ticketSLA) => ticketSLA.sla)
  ticketSLAs: TicketSLA[];
}