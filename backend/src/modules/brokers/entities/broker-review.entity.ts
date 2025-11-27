import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Broker } from './broker.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('broker_reviews')
export class BrokerReview {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'uuid' })
  brokerId: string;

  @ApiProperty()
  @Column({ type: 'uuid', nullable: true })
  clientId: string;

  @ApiProperty()
  @Column({ type: 'int', minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty()
  @Column({ type: 'text' })
  comment: string;

  @ApiProperty({ enum: ReviewStatus })
  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
  status: ReviewStatus;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @ApiProperty()
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    source?: string;
    ipAddress?: string;
    userAgent?: string;
    approvedBy?: string;
    rejectionReason?: string;
  };

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Broker, broker => broker.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brokerId' })
  broker: Broker;
}