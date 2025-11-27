import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Ticket } from './ticket.entity';
import { SLA } from './sla.entity';
import { KnowledgeBaseArticle } from './knowledge-base-article.entity';

@Entity('ticket_categories')
@Index(['slug'])
@Index(['parentId'])
@Index(['isActive'])
export class TicketCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ nullable: true })
  icon: string | null;

  @Column({ nullable: true })
  color: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    nullable: true,
  })
  defaultPriority: TicketPriority | null;

  @Column({ type: 'uuid', nullable: true })
  defaultAssignedTo: string | null;

  @Column({ type: 'uuid', nullable: true })
  slaId: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => TicketCategory, (category) => category.children, { nullable: true })
  parent: TicketCategory | null;

  @OneToMany(() => TicketCategory, (category) => category.parent)
  children: TicketCategory[];

  @ManyToOne(() => SLA, (sla) => sla.categories, { nullable: true })
  sla: SLA | null;

  @OneToMany(() => Ticket, (ticket) => ticket.category)
  tickets: Ticket[];

  @OneToMany(() => KnowledgeBaseArticle, (article) => article.category)
  knowledgeBaseArticles: KnowledgeBaseArticle[];
}

// Import for type reference
import { TicketPriority } from './ticket.entity';