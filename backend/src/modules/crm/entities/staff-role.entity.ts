import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { StaffMember } from './staff-member.entity';

@Entity('staff_roles')
@Index(['isActive'])
@Index(['department'])
export class StaffRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  department: string; // SALES, SUPPORT, COMPLIANCE, BILLING, TECHNICAL, ADMIN

  @Column({ default: 0 })
  level: number; // 0=Lowest, higher numbers have more authority

  @Column({ name: 'parent_role_id', nullable: true })
  parentRoleId: string;

  @Column({ type: 'json' })
  permissions: object; // { "crm": ["read", "write"], "billing": ["read"], ... }

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => StaffRole, role => role.subRoles, { nullable: true })
  @JoinColumn({ name: 'parent_role_id' })
  parentRole: StaffRole;

  @OneToMany(() => StaffRole, role => role.parentRole)
  subRoles: StaffRole[];

  @OneToMany(() => StaffMember, member => member.role)
  staffMembers: StaffMember[];
}