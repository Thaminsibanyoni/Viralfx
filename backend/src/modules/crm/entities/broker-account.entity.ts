import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Broker } from '../../brokers/entities/broker.entity';
import { BrokerInvoice } from './broker-invoice.entity';
import { BrokerPayment } from './broker-payment.entity';
import { BrokerSubscription } from './broker-subscription.entity';
import { BrokerNote } from './broker-note.entity';
import { BrokerDocument } from './broker-document.entity';

@Entity('broker_accounts')
@Index(['brokerId'])
@Index(['status'])
@Index(['complianceStatus'])
export class BrokerAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'broker_id' })
  brokerId: string;

  @Column()
  accountType: string; // CORPORATE, INDIVIDUAL, PARTNERSHIP

  @Column({ name: 'business_number', nullable: true })
  businessNumber: string;

  @Column({ name: 'tax_number', nullable: true })
  taxNumber: string;

  @Column({ name: 'vat_registered', default: false })
  vatRegistered: boolean;

  @Column({ name: 'vat_number', nullable: true })
  vatNumber: string;

  @Column({ name: 'bank_name', nullable: true })
  bankName: string;

  @Column({ name: 'bank_account_number', nullable: true })
  bankAccountNumber: string;

  @Column({ name: 'bank_account_type', nullable: true })
  bankAccountType: string; // CHEQUE, SAVINGS, BUSINESS

  @Column({ name: 'bank_branch_code', nullable: true })
  bankBranchCode: string;

  @Column({ name: 'swift_code', nullable: true })
  swiftCode: string;

  @Column({ name: 'fsca_verified', default: false })
  fscaVerified: boolean;

  @Column({ name: 'fsca_verification_date', type: 'timestamp', nullable: true })
  fscaVerificationDate: Date;

  @Column({ default: 'MEDIUM' })
  riskRating: string; // LOW, MEDIUM, HIGH

  @Column({ name: 'compliance_status', default: 'PENDING' })
  complianceStatus: string; // PENDING, APPROVED, SUSPENDED

  @Column({ default: 'ACTIVE' })
  status: string; // ACTIVE, SUSPENDED, PENDING, TERMINATED

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  creditLimit: number;

  @Column({ name: 'payment_terms', default: 30 })
  paymentTerms: number; // Days

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToOne(() => Broker, broker => broker.brokerAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_id' })
  broker: Broker;

  @OneToMany(() => BrokerInvoice, invoice => invoice.brokerAccount)
  invoices: BrokerInvoice[];

  @OneToMany(() => BrokerPayment, payment => payment.brokerAccount)
  payments: BrokerPayment[];

  @OneToMany(() => BrokerSubscription, subscription => subscription.brokerAccount)
  subscriptions: BrokerSubscription[];

  @OneToMany(() => BrokerNote, note => note.brokerAccount)
  notes: BrokerNote[];

  @OneToMany(() => BrokerDocument, document => document.brokerAccount)
  documents: BrokerDocument[];
}