import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum Department {
  SALES = 'SALES',
  SUPPORT = 'SUPPORT',
  COMPLIANCE = 'COMPLIANCE',
  FINANCE = 'FINANCE',
}

@Entity('relationship_managers')
@Index(['userId'])
@Index(['isActive'])
@Index(['department'])
export class RelationshipManager {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string; // Link to admin user

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string | null;

  @Column({
    type: 'enum',
    enum: Department,
  })
  department: Department;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 50 })
  maxLeads: number;

  @Column({ type: 'int', default: 0 })
  currentLeads: number;

  @Column({ type: 'jsonb', nullable: true })
  performance: {
    conversionRate: number;
    responseTime: number; // in hours
    dealsWon: number;
    revenueGenerated: number;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  territories: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}