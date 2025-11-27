import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum ValidatorStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
  SUSPENDED = 'SUSPENDED',
}

@Entity('validator_nodes')
@Index(['nodeId'])
@Index(['status'])
@Index(['lastSeen'])
export class ValidatorNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'node_id', unique: true, length: 50 })
  nodeId: string;

  @Column({ name: 'endpoint', nullable: true })
  endpoint?: string;

  @Column({ name: 'public_key', length: 128, nullable: true })
  publicKey?: string;

  @Column({ nullable: true })
  version?: string;

  @Column({
    type: 'enum',
    enum: ValidatorStatus,
    default: ValidatorStatus.OFFLINE,
  })
  status: ValidatorStatus;

  @Column({ name: 'last_seen', type: 'timestamp', nullable: true })
  lastSeen?: Date;

  @Column({ name: 'response_time', type: 'integer', nullable: true })
  responseTime?: number; // Response time in milliseconds

  @Column({ name: 'total_requests', default: 0 })
  totalRequests: number;

  @Column({ name: 'successful_requests', default: 0 })
  successfulRequests: number;

  @Column({ name: 'average_response_time', type: 'decimal', precision: 8, scale: 2, nullable: true })
  averageResponseTime?: number;

  @Column({ name: 'reputation_score', type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  reputationScore: number;

  @Column({ name: 'stake_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  stakeAmount: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}