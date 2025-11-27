import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { AdminAuditLog } from './admin-audit-log.entity';
import { AdminPermission } from './admin-permission.entity';
import { AdminSession } from './admin-session.entity';

export enum AdminRole {
  SUPER_ADMIN = 'SuperAdmin',
  USER_OPS = 'UserOps',
  BROKER_OPS = 'BrokerOps',
  TREND_OPS = 'TrendOps',
  RISK_OPS = 'RiskOps',
  FINANCE_OPS = 'FinanceOps',
  SUPPORT_OPS = 'SupportOps',
  TECH_OPS = 'TechOps',
  CONTENT_OPS = 'ContentOps',
  DEPARTMENT_HEAD = 'DepartmentHead',
}

export enum AdminStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  LOCKED = 'LOCKED',
}

@Entity('AdminUsers')
@Index(['email'], { unique: true })
@Index(['role'])
@Index(['status'])
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({
    type: 'enum',
    enum: AdminRole,
    default: AdminRole.USER_OPS,
  })
  role: AdminRole;

  @Column({
    type: 'enum',
    enum: AdminStatus,
    default: AdminStatus.ACTIVE,
  })
  status: AdminStatus;

  @Column({ nullable: true })
  department?: string;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ nullable: true })
  twoFactorSecret?: string;

  @Column('jsonb', { default: [] })
  ipWhitelist: string[];

  @Column('decimal', { precision: 5, scale: 2, default: 0.0 })
  riskScore: number;

  @Column('jsonb', { nullable: true })
  behaviorPattern?: Record<string, any>;

  @Column('jsonb', { default: [] })
  predictiveFlags: Array<{
    type: string;
    severity: string;
    probability: number;
    timeHorizon: number;
    mitigation: string[];
    autoActionable: boolean;
  }>;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ nullable: true })
  lastLoginIp?: string;

  @Column({ nullable: true })
  deviceFingerprint?: string;

  @Column({ default: false })
  isSuperAdmin: boolean;

  @Column('jsonb', { default: [] })
  jurisdictionClearance: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => AdminAuditLog, (auditLog) => auditLog.admin)
  auditLogs: AdminAuditLog[];

  @OneToMany(() => AdminSession, (session) => session.admin)
  sessions: AdminSession[];

  @ManyToMany(() => AdminPermission, { cascade: true })
  @JoinTable({
    name: 'AdminUserPermissions',
    joinColumn: { name: 'adminId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
  })
  permissions: AdminPermission[];
}