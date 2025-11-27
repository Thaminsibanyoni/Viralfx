import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  USER_SUSPEND = 'USER_SUSPEND',
  USER_UNSUSPEND = 'USER_UNSUSPEND',
  USER_BAN = 'USER_BAN',
  USER_UNBAN = 'USER_UNBAN',
  BROKER_APPROVE = 'BROKER_APPROVE',
  BROKER_SUSPEND = 'BROKER_SUSPEND',
  PLATFORM_SETTING_CHANGE = 'PLATFORM_SETTING_CHANGE',
  VTS_SYMBOL_UPDATE = 'VTS_SYMBOL_UPDATE',
  TREND_OVERRIDE = 'TREND_OVERRIDE',
  RISK_ACTION = 'RISK_ACTION',
  FINANCE_TRANSACTION = 'FINANCE_TRANSACTION',
  SYSTEM_ACTION = 'SYSTEM_ACTION',
  NOTIFICATION_SEND = 'NOTIFICATION_SEND',
  ADMIN_CREATE = 'ADMIN_CREATE',
  ADMIN_UPDATE = 'ADMIN_UPDATE',
  ADMIN_DELETE = 'ADMIN_DELETE',
  PERMISSION_GRANT = 'PERMISSION_GRANT',
  PERMISSION_REVOKE = 'PERMISSION_REVOKE',
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('AdminAuditLogs')
@Index(['adminId'])
@Index(['action'])
@Index(['targetType'])
@Index(['targetId'])
@Index(['severity'])
@Index(['createdAt'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AdminUser, { nullable: true })
  admin?: AdminUser;

  @Column({ nullable: true })
  adminId?: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: AuditSeverity,
    default: AuditSeverity.LOW,
  })
  severity: AuditSeverity;

  @Column()
  targetType: string;

  @Column()
  targetId: string;

  @Column('jsonb')
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  sessionId?: string;

  @Column({ default: false })
  requiresReview: boolean;

  @Column({ nullable: true })
  reviewedBy?: string;

  @Column({ nullable: true })
  reviewedAt?: Date;

  @Column('text', { nullable: true })
  reviewNotes?: string;

  @Column({ default: false })
  isAutomatedAction: boolean;

  @Column('text', { nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;
}