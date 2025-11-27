import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Broker } from './broker.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum ComplianceCheckType {
  FSCA_LICENSE = 'FSCA_LICENSE',
  SANCTIONS_LIST = 'SANCTIONS_LIST',
  ADVERSE_MEDIA = 'ADVERSE_MEDIA',
  FINANCIAL_HEALTH = 'FINANCIAL_HEALTH',
  SECURITY_ASSESSMENT = 'SECURITY_ASSESSMENT',
}

export enum ComplianceResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
}

@Entity('broker_compliance_checks')
export class BrokerComplianceCheck {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'uuid' })
  brokerId: string;

  @ApiProperty({ enum: ComplianceCheckType })
  @Column({ type: 'enum', enum: ComplianceCheckType })
  checkType: ComplianceCheckType;

  @ApiProperty()
  @Column({ type: 'timestamp' })
  checkDate: Date;

  @ApiProperty({ enum: ComplianceResult })
  @Column({ type: 'enum', enum: ComplianceResult })
  result: ComplianceResult;

  @ApiProperty({ type: 'decimal', precision: 3, scale: 2 })
  @Column({ type: 'decimal', precision: 3, scale: 2 })
  score: number;

  @ApiProperty()
  @Column({ type: 'jsonb' })
  details: {
    checkedValue?: string;
    expectedValue?: string;
    threshold?: number;
    actualValue?: number;
    sources?: string[];
    flags?: string[];
    metadata?: Record<string, any>;
  };

  @ApiProperty()
  @Column({ type: 'jsonb', default: [] })
  recommendations: string[];

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Broker, broker => broker.complianceChecks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brokerId' })
  broker: Broker;
}