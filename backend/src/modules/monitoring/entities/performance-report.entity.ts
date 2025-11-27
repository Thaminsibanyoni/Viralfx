import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type ReportType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type ReportStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';

@Entity('performance_reports')
export class PerformanceReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  type: ReportType;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: ReportStatus;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'timestamp' })
  @Index()
  periodStart: Date;

  @Column({ type: 'timestamp' })
  @Index()
  periodEnd: Date;

  @Column({ type: 'jsonb', nullable: true })
  data: {
    systemMetrics: Record<string, any>;
    applicationMetrics: Record<string, any>;
    performanceIndicators: Record<string, any>;
    recommendations: string[];
    anomalies: Array<{
      metric: string;
      expected: number;
      actual: number;
      deviation: number;
      severity: string;
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  summary: {
    overallScore: number;
    systemHealth: string;
    keyInsights: string[];
    issuesIdentified: number;
    improvements: number;
  };

  @Column({ type: 'text', nullable: true })
  reportUrl?: string;

  @Column({ type: 'jsonb', nullable: true })
  configuration: {
    includeCharts: boolean;
    includeRecommendations: boolean;
    includeAnomalies: boolean;
    customMetrics: string[];
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  generatedBy?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;
}