import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Ticket } from './ticket.entity';

export enum AuthorType {
  USER = 'USER',
  BROKER = 'BROKER',
  AGENT = 'AGENT',
  SYSTEM = 'SYSTEM',
}

@Entity('ticket_messages')
@Index(['ticketId'])
@Index(['authorId'])
@Index(['createdAt'])
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticketId: string;

  @Column({ type: 'uuid', nullable: true })
  authorId: string | null;

  @Column({
    type: 'enum',
    enum: AuthorType,
  })
  authorType: AuthorType;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  isInternal: boolean;

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

  // Relationships
  @ManyToOne(() => Ticket, (ticket) => ticket.messages, { onDelete: 'CASCADE' })
  ticket: Ticket;
}