import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

@Entity('AdminSessions')
@Index(['adminId'])
@Index(['token'])
@Index(['isActive'])
@Index(['expiresAt'])
export class AdminSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AdminUser)
  admin: AdminUser;

  @Column()
  adminId: string;

  @Column({ unique: true })
  token: string;

  @Column({ unique: true })
  refreshToken: string;

  @Column({ nullable: true })
  deviceFingerprint?: string;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  lastActivityAt?: Date;

  @Column('jsonb', { default: {} })
  sessionData: Record<string, any>;

  @Column({ default: false })
  isMFAVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;
}