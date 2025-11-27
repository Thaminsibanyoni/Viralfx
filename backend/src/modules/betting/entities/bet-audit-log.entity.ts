import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BetStatus } from './bet.entity';
import { User } from '../../database/entities/user.entity';

@Entity('bet_audit_logs')
export class BetAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bet_id' })
  betId: string;

  @Column({
    type: 'enum',
    enum: BetStatus,
    name: 'from_status'
  })
  fromStatus: BetStatus;

  @Column({
    type: 'enum',
    enum: BetStatus,
    name: 'to_status'
  })
  toStatus: BetStatus;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true, name: 'reason' })
  reason: string;

  @Column({ type: 'jsonb', nullable: true, name: 'metadata' })
  metadata: any;

  @Column({ name: 'performed_by', nullable: true })
  performedBy: string;

  @Column({ type: 'text', nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent: string;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}