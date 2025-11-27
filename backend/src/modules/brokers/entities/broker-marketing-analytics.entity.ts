import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { Broker } from './broker.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('broker_marketing_analytics')
@Unique(['brokerId', 'date'])
export class BrokerMarketingAnalytics {
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
  @Column({ type: 'int', default: 0 })
  profileViews: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  contactClicks: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  websiteClicks: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  referralsSent: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  referralsConverted: number;

  @ApiProperty({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  referralRevenue: number;

  @ApiProperty({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  conversionRate: number;

  @ApiProperty({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Broker, broker => broker.marketingAnalytics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brokerId' })
  broker: Broker;
}