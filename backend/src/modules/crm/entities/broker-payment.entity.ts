import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Broker } from '../../brokers/entities/broker.entity';
import { BrokerInvoice } from './broker-invoice.entity';

@Entity('broker_payments')
@Index(['brokerId', 'status'])
@Index(['invoiceId'])
@Index(['paymentDate'])
export class BrokerPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'broker_id' })
  brokerId: string;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'timestamp', name: 'payment_date' })
  paymentDate: Date;

  @Column({ name: 'payment_method' })
  paymentMethod: string; // BANK_TRANSFER, CREDIT_CARD, CRYPTO, WALLET

  @Column({ name: 'transaction_id', nullable: true })
  transactionId: string;

  @Column({ nullable: true })
  reference: string;

  @Column({ default: 'PENDING' })
  status: string; // PENDING, COMPLETED, FAILED, REFUNDED

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  fees: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'net_amount' })
  netAmount: number;

  @Column({ nullable: true })
  provider: string;

  @Column({ type: 'json', nullable: true })
  metadata: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamp', name: 'completed_at', nullable: true })
  completedAt: Date;

  // Relations
  @ManyToOne(() => Broker, broker => broker.brokerPayments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_id' })
  broker: Broker;

  @ManyToOne(() => BrokerInvoice, invoice => invoice.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: BrokerInvoice;
}