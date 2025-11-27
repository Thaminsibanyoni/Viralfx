import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Broker } from '../../brokers/entities/broker.entity';
import { BrokerAccount } from './broker-account.entity';
import { User } from '../../users/entities/user.entity';

@Entity('broker_notes')
@Index(['brokerId', 'category'])
@Index(['authorId'])
@Index(['reminderDate'])
export class BrokerNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'broker_id' })
  brokerId: string;

  @Column({ name: 'broker_account_id' })
  brokerAccountId: string;

  @Column({ name: 'author_id' })
  authorId: string;

  @Column()
  title: string;

  @Column()
  content: string;

  @Column()
  category: string; // GENERAL, COMPLIANCE, BILLING, SUPPORT, PERFORMANCE

  @Column({ default: 'NORMAL' })
  priority: string; // LOW, NORMAL, HIGH, URGENT

  @Column({ name: 'is_internal', default: true })
  isInternal: boolean;

  @Column({ name: 'is_pinned', default: false })
  isPinned: boolean;

  @Column({ name: 'reminder_date', type: 'timestamp', nullable: true })
  reminderDate: Date;

  @Column({ name: 'reminder_sent', default: false })
  reminderSent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Broker, broker => broker.brokerNotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_id' })
  broker: Broker;

  @ManyToOne(() => BrokerAccount, account => account.notes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_account_id' })
  brokerAccount: BrokerAccount;

  @ManyToOne(() => User, user => user.authoredBrokerNotes)
  @JoinColumn({ name: 'author_id' })
  author: User;
}