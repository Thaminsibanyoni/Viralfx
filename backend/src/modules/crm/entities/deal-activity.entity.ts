import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BrokerDeal } from './broker-deal.entity';
import { User } from '../../users/entities/user.entity';

@Entity('deal_activities')
@Index(['dealId', 'createdAt'])
@Index(['authorId'])
@Index(['type'])
export class DealActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'deal_id' })
  dealId: string;

  @Column({ name: 'author_id' })
  authorId: string;

  @Column()
  type: string; // CALL, EMAIL, MEETING, NOTE, TASK, DEMO, PROPOSAL

  @Column()
  subject: string;

  @Column()
  content: string;

  @Column({ nullable: true })
  duration: number; // Minutes for meetings/calls

  @Column({ nullable: true })
  result: string; // POSITIVE, NEUTRAL, NEGATIVE

  @Column({ name: 'next_steps', nullable: true })
  nextSteps: string;

  @Column({ name: 'attachments', type: 'json', nullable: true })
  attachments: object[]; // [{ "url": "...", "name": "...", "type": "pdf" }]

  @Column({ type: 'json', nullable: true })
  metadata: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => BrokerDeal, deal => deal.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deal_id' })
  deal: BrokerDeal;

  @ManyToOne(() => User, user => user.dealActivities)
  @JoinColumn({ name: 'author_id' })
  author: User;
}