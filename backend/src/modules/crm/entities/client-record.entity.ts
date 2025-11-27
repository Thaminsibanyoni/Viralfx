import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Broker } from '../../brokers/entities/broker.entity';
import { ClientInteraction } from './client-interaction.entity';

@Entity('client_records')
@Index(['userId'])
@Index(['brokerId', 'segment'])
@Index(['segment', 'status'])
@Index(['lastActivityAt'])
export class ClientRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'email', nullable: true })
  email: string;

  @Column({ name: 'phone', nullable: true })
  phone: string;

  @Column({ name: 'country', nullable: true })
  country: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'broker_id', nullable: true })
  brokerId: string;

  @Column({ default: 'STANDARD' })
  segment: string; // VIP, ACTIVE, DORMANT, HIGH_RISK, STANDARD

  @Column({ nullable: true })
  source: string; // ORGANIC, REFERRAL, ADVERTISING, PARTNER, BROKER

  @Column({ nullable: true })
  campaign: string;

  @Column({ name: 'total_trades', default: 0 })
  totalTrades: number;

  @Column({ name: 'total_volume', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalVolume: number;

  @Column({ name: 'total_pnl', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPnl: number;

  @Column({ name: 'avg_trade_size', type: 'decimal', precision: 12, scale: 2, default: 0 })
  avgTradeSize: number;

  @Column({ name: 'last_activity_at', type: 'timestamp', nullable: true })
  lastActivityAt: Date;

  @Column({ name: 'risk_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  riskScore: number;

  @Column({ name: 'risk_factors', type: 'json', nullable: true })
  riskFactors: object; // { "high_volatility": true, "large_positions": false, ... }

  @Column({ name: 'preferred_contact', default: 'EMAIL' })
  preferredContact: string; // EMAIL, SMS, PHONE, WHATSAPP

  @Column({ name: 'marketing_consent', default: false })
  marketingConsent: boolean;

  @Column({ name: 'newsletter_consent', default: true })
  newsletterConsent: boolean;

  @Column({ default: 'ACTIVE' })
  status: string; // ACTIVE, INACTIVE, SUSPENDED, CHURNED

  @Column({ nullable: true })
  notes: string;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ name: 'custom_fields', type: 'json', nullable: true })
  customFields: object;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.clientRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Broker, broker => broker.clientRecords, { nullable: true })
  @JoinColumn({ name: 'broker_id' })
  broker: Broker;

  @OneToMany(() => ClientInteraction, interaction => interaction.clientRecord)
  interactions: ClientInteraction[];
}