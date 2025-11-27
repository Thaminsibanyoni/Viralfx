import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Broker } from './broker.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum BillStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  DEBIT_ORDER = 'DEBIT_ORDER',
  PAYSTACK = 'PAYSTACK',
  PAYFAST = 'PAYFAST',
  OZOW = 'OZOW',
}

@Entity('broker_bills')
export class BrokerBill {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'uuid' })
  brokerId: string;

  @ApiProperty()
  @Column({ type: 'date' })
  period: Date;

  @ApiProperty({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  baseFee: number;

  @ApiProperty({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  transactionFees: number;

  @ApiProperty({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  volumeDiscount: number;

  @ApiProperty({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  additionalServices: number;

  @ApiProperty({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @ApiProperty({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  vat: number;

  @ApiProperty({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: number;

  @ApiProperty({ enum: BillStatus })
  @Column({ type: 'enum', enum: BillStatus, default: BillStatus.PENDING })
  status: BillStatus;

  @ApiProperty()
  @Column({ type: 'date' })
  dueDate: Date;

  @ApiProperty()
  @Column({ type: 'timestamp', nullable: true })
  paidDate: Date;

  @ApiProperty({ enum: PaymentMethod, nullable: true })
  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod;

  @ApiProperty()
  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentGateway: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentReference: string;

  @ApiProperty()
  @Column({ type: 'jsonb', nullable: true })
  paymentDetails: {
    transactionId?: string;
    amount?: number;
    currency?: string;
    status?: string;
    metadata?: Record<string, any>;
  };

  @ApiProperty()
  @Column({ type: 'varchar', nullable: true })
  invoiceUrl: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Broker, broker => broker.bills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brokerId' })
  broker: Broker;
}