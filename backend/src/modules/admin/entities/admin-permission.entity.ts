import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

export enum PermissionCategory {
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  BROKER_MANAGEMENT = 'BROKER_MANAGEMENT',
  TREND_MANAGEMENT = 'TREND_MANAGEMENT',
  RISK_MANAGEMENT = 'RISK_MANAGEMENT',
  FINANCE_MANAGEMENT = 'FINANCE_MANAGEMENT',
  PLATFORM_MANAGEMENT = 'PLATFORM_MANAGEMENT',
  SYSTEM_MANAGEMENT = 'SYSTEM_MANAGEMENT',
  AUDIT_VIEW = 'AUDIT_VIEW',
  PREDICTIVE_ANALYTICS = 'PREDICTIVE_ANALYTICS',
  VTS_MANAGEMENT = 'VTS_MANAGEMENT',
  ORACLE_MANAGEMENT = 'ORACLE_MANAGEMENT',
  NOTIFICATION_MANAGEMENT = 'NOTIFICATION_MANAGEMENT',
  ADMIN_MANAGEMENT = 'ADMIN_MANAGEMENT',
  CRM_MANAGEMENT = 'CRM_MANAGEMENT',
}

@Entity('AdminPermissions')
export class AdminPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @Column({
    type: 'enum',
    enum: PermissionCategory,
  })
  category: PermissionCategory;

  @Column()
  resource: string;

  @Column()
  action: string;

  @Column('jsonb', { default: [] })
  conditions: Record<string, any>[];

  @Column({ default: false })
  isSystemPermission: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // Relationships
  @ManyToMany(() => AdminUser, (admin) => admin.permissions)
  @JoinTable({
    name: 'AdminUserPermissions',
    joinColumn: { name: 'permissionId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'adminId', referencedColumnName: 'id' },
  })
  admins: AdminUser[];
}