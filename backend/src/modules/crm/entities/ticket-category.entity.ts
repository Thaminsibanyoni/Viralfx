import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../../database/entities/user.entity';

@Entity('ticket_categories')
@Index(['isActive'])
@Index(['parentCategoryId'])
export class TicketCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string; // Icon name or emoji

  @Column({ nullable: true })
  color: string; // Hex color for UI

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'parent_category_id', nullable: true })
  parentCategoryId: string;

  @Column({ name: 'default_sla_hours', default: 24 })
  defaultSlaHours: number;

  @Column({ name: 'escalation_hours', nullable: true })
  escalationHours: number;

  // Auto-assignment configuration
  @Column({ name: 'enable_auto_assign', default: false })
  enableAutoAssign: boolean;

  @Column({ name: 'auto_assign_agent_id', nullable: true })
  autoAssignAgentId: string;

  @Column({ name: 'max_concurrent_tickets', default: 10 })
  maxConcurrentTickets: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => TicketCategory, category => category.subcategories, { nullable: true })
  @JoinColumn({ name: 'parent_category_id' })
  parentCategory: TicketCategory;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'auto_assign_agent_id' })
  autoAssignAgent: User;

  @OneToMany(() => TicketCategory, category => category.parentCategory)
  subcategories: TicketCategory[];

  @OneToMany(() => Ticket, ticket => ticket.category)
  tickets: Ticket[];
}