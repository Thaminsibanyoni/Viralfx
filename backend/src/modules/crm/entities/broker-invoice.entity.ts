import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Broker } from '../../brokers/entities/broker.entity';
import { BrokerAccount } from './broker-account.entity';
import { BrokerPayment } from './broker-payment.entity';
import { BrokerInvoiceItem } from './broker-invoice-item.entity';

@Entity('broker_invoices')
@Index(['brokerId', 'status'])
@Index(['dueDate', 'status'])
@Index(['invoiceNumber'])
export class BrokerInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'broker_id' })
  brokerId: string;

  @Column({ name: 'broker_account_id' })
  brokerAccountId: string;

  @Column({ unique: true })
  invoiceNumber: string;

  @Column({ type: 'timestamp', name: 'issue_date' })
  issueDate: Date;

  @Column({ type: 'timestamp', name: 'due_date' })
  dueDate: Date;

  @Column({ type: 'timestamp', name: 'period_start' })
  periodStart: Date;

  @Column({ type: 'timestamp', name: 'period_end' })
  periodEnd: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'subscription_fee' })
  subscriptionFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'api_usage_fee' })
  apiUsageFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'transaction_fee' })
  transactionFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'overage_fee' })
  overageFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'penalty_fee' })
  penaltyFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'vat_amount' })
  vatAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount' })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'amount_paid' })
  amountPaid: number;

  @Column({ default: 'DRAFT' })
  status: string; // DRAFT, SENT, PAID, OVERDUE, CANCELLED

  @Column({ name: 'payment_status', default: 'UNPAID' })
  paymentStatus: string; // UNPAID, PARTIALLY_PAID, PAID, OVERDUE

  @Column({ default: 'USD' })
  currency: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ type: 'json', nullable: true })
  metadata: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamp', name: 'paid_at', nullable: true })
  paidAt: Date;

  // Relations
  @ManyToOne(() => Broker, broker => broker.brokerInvoices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_id' })
  broker: Broker;

  @ManyToOne(() => BrokerAccount, account => account.invoices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_account_id' })
  brokerAccount: BrokerAccount;

  @OneToMany(() => BrokerPayment, payment => payment.invoice)
  payments: BrokerPayment[];

  @OneToMany(() => BrokerInvoiceItem, item => item.invoice)
  items: BrokerInvoiceItem[];
}