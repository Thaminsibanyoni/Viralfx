import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ClientRecord } from './client-record.entity';
import { User } from '../../users/entities/user.entity';

@Entity('client_interactions')
@Index(['clientId', 'createdAt'])
@Index(['staffId', 'createdAt'])
@Index(['type', 'direction'])
@Index(['nextActionDate'])
export class ClientInteraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @Column({ name: 'staff_id' })
  staffId: string;

  @Column()
  type: string; // CALL, EMAIL, MEETING, NOTE, TICKET, CHAT

  @Column()
  direction: string; // INBOUND, OUTBOUND

  @Column({ nullable: true })
  subject: string;

  @Column()
  content: string;

  @Column({ nullable: true })
  duration: number; // Minutes for calls/meetings

  @Column({ name: 'contact_method', nullable: true })
  contactMethod: string; // PHONE, EMAIL, SMS, WHATSAPP, IN_PERSON

  @Column({ name: 'contact_details', nullable: true })
  contactDetails: string; // Phone number, email address, etc.

  @Column({ nullable: true })
  outcome: string; // SUCCESSFUL, NEEDS_FOLLOWUP, NOT_INTERESTED, CALLBACK_REQUIRED

  @Column({ name: 'next_action', nullable: true })
  nextAction: string;

  @Column({ name: 'next_action_date', type: 'timestamp', nullable: true })
  nextActionDate: Date;

  @Column({ default: 'NORMAL' })
  priority: string; // LOW, NORMAL, HIGH, URGENT

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ name: 'attachments', type: 'json', nullable: true })
  attachments: object[]; // [{ "url": "...", "name": "...", "type": "pdf" }]

  @Column({ type: 'json', nullable: true })
  metadata: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => ClientRecord, record => record.interactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  clientRecord: ClientRecord;

  @ManyToOne(() => User, user => user.clientInteractions)
  @JoinColumn({ name: 'staff_id' })
  staff: User;
}