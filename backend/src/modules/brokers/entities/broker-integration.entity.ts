import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Broker } from './broker.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum IntegrationType {
  REST_API = 'REST_API',
  WEBSOCKET = 'WEBSOCKET',
  WEBHOOK = 'WEBHOOK',
  SDK = 'SDK',
}

export enum IntegrationStatus {
  PENDING = 'PENDING',
  TESTING = 'TESTING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  DISABLED = 'DISABLED',
}

@Entity('broker_integrations')
export class BrokerIntegration {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'uuid' })
  brokerId: string;

  @ApiProperty({ enum: IntegrationType })
  @Column({ type: 'enum', enum: IntegrationType })
  integrationType: IntegrationType;

  @ApiProperty({ enum: IntegrationStatus })
  @Column({ type: 'enum', enum: IntegrationStatus, default: IntegrationStatus.PENDING })
  status: IntegrationStatus;

  @ApiProperty()
  @Column({ type: 'jsonb' })
  configuration: {
    baseUrl?: string;
    apiKey?: string;
    apiSecret?: string;
    version?: string;
    timeout?: number;
    retryAttempts?: number;
    headers?: Record<string, string>;
    webhookUrl?: string;
    events?: string[];
    scopes?: string[];
    customSettings?: Record<string, any>;
  };

  @ApiProperty()
  @Column({ type: 'jsonb', nullable: true })
  testResults: {
    success: boolean;
    errors?: string[];
    latency?: number;
    timestamp: Date;
    details?: {
      endpoint?: string;
      method?: string;
      responseCode?: number;
      responseTime?: number;
      testData?: Record<string, any>;
    };
  };

  @ApiProperty()
  @Column({ type: 'timestamp', nullable: true })
  lastTestDate: Date;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Broker, broker => broker.integrations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brokerId' })
  broker: Broker;
}