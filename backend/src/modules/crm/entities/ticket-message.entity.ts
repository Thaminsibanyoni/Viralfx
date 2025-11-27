import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ticket_messages')
@Index(['ticketId', 'createdAt'])
@Index(['authorId'])
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id' })
  ticketId: string;

  @Column({ name: 'author_id' })
  authorId: string;

  @Column()
  content: string;

  @Column({ name: 'is_internal', default: false })
  isInternal: boolean;

  @Column({ name: 'is_draft', default: false })
  isDraft: boolean;

  @Column({ name: 'attachments', type: 'json', nullable: true })
  attachments: object[]; // [{ "url": "...", "name": "...", "type": "pdf", "size": 1024 }]

  @Column({ default: 'WEB' })
  source: string; // WEB, EMAIL, API

  @Column({ type: 'json', nullable: true })
  metadata: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Ticket, ticket => ticket.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @ManyToOne(() => User, user => user.ticketMessagesAsAuthor)
  @JoinColumn({ name: 'author_id' })
  author: User;
}