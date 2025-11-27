import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { StaffRole } from './staff-role.entity';

@Entity('staff_members')
@Index(['userId'], { unique: true })
@Index(['roleId', 'isActive'])
@Index(['department', 'isActive'])
export class StaffMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'role_id' })
  roleId: string;

  @Column({ name: 'employee_id', unique: true, nullable: true })
  employeeId: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  position: string;

  @Column({ name: 'reports_to_id', nullable: true })
  reportsToId: string;

  @Column({ name: 'work_email', nullable: true })
  workEmail: string;

  @Column({ name: 'work_phone', nullable: true })
  workPhone: string;

  @Column({ name: 'office_location', nullable: true })
  officeLocation: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ name: 'hire_date', type: 'timestamp' })
  hireDate: Date;

  @Column({ name: 'termination_date', type: 'timestamp', nullable: true })
  terminationDate: Date;

  @Column({ name: 'performance_rating', type: 'decimal', precision: 2, scale: 1, nullable: true })
  performanceRating: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_manager', default: false })
  isManager: boolean;

  @Column({ type: 'json', nullable: true })
  metadata: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.staffMember)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => StaffRole, role => role.staffMembers)
  @JoinColumn({ name: 'role_id' })
  role: StaffRole;

  @ManyToOne(() => StaffMember, member => member.directReports, { nullable: true })
  @JoinColumn({ name: 'reports_to_id' })
  reportsTo: StaffMember;

  @OneToMany(() => StaffMember, member => member.reportsTo)
  directReports: StaffMember[];
}