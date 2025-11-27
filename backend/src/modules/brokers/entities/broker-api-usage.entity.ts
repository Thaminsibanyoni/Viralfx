import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { Broker } from './broker.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum ApiMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}

@Entity('broker_api_usage')
@Unique(['brokerId', 'date', 'endpoint', 'method'])
export class BrokerApiUsage {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'uuid' })
  brokerId: string;

  @ApiProperty()
  @Column({ type: 'date' })
  date: Date;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  @ApiProperty({ enum: ApiMethod })
  @Column({ type: 'enum', enum: ApiMethod })
  method: ApiMethod;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  requestCount: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  responseTimeAvg: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  errorCount: number;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Broker, broker => broker.apiUsage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brokerId' })
  broker: Broker;
}