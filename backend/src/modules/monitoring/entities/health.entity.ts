import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
export type ComponentType = 'DATABASE' | 'REDIS' | 'WEBSOCKET' | 'EXTERNAL_API' | 'DISK' | 'MEMORY' | 'CPU';

@Entity('system_health')
export class SystemHealth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  component: ComponentType;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  status: HealthStatus;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'jsonb', nullable: true })
  metrics: {
    responseTime?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    connectionCount?: number;
    errorRate?: number;
    uptime?: number;
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  thresholds: {
    responseTime?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    connectionCount?: number;
    errorRate?: number;
    [key: string]: number;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  endpoint?: string;

  @Column({ type: 'int', nullable: true })
  statusCode?: number;

  @Column({ type: 'int', nullable: true })
  duration?: number; // Response time in milliseconds

  @Column({ type: 'jsonb', nullable: true })
  dependencies: Array<{
    name: string;
    status: HealthStatus;
    responseTime?: number;
  }>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  environment?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  version?: string;

  @Column({ type: 'jsonb', nullable: true })
  tags: Record<string, string>;

  @CreateDateColumn()
  @Index()
  timestamp: Date;
}