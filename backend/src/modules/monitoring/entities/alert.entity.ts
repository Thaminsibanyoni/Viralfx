import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type AlertType = 'SYSTEM_HEALTH' | 'THRESHOLD_EXCEEDED' | 'PERFORMANCE_ANOMALY' | 'SECURITY_INCIDENT' | 'CUSTOM';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  type: AlertType;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  severity: AlertSeverity;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  @Index()
  status: AlertStatus;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rule: string;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  acknowledgedBy?: string;

  @Column({ type: 'text', nullable: true })
  acknowledgementNote?: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resolvedBy?: string;

  @Column({ type: 'text', nullable: true })
  resolutionNote?: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  suppressedUntil?: Date;
}