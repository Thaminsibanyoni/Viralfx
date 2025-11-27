import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Broker } from '../../brokers/entities/broker.entity';
import { BrokerAccount } from './broker-account.entity';
import { User } from '../../users/entities/user.entity';

@Entity('broker_documents')
@Index(['brokerId', 'documentType'])
@Index(['status', 'expiryDate'])
@Index(['uploadedBy'])
export class BrokerDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'broker_id' })
  brokerId: string;

  @Column({ name: 'broker_account_id' })
  brokerAccountId: string;

  @Column({ name: 'document_type' })
  documentType: string; // KYC, FSCA_LICENSE, CERTIFICATE_OF_INCORPORATION, TAX_CLEARANCE, BANK_DETAILS, CONTRACT

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_url', nullable: true })
  fileUrl: string;

  @Column({ name: 's3_path', nullable: true })
  s3Path: string; // S3/MinIO storage path

  @Column({ name: 'file_id', nullable: true })
  fileId: string; // Reference to FilesModule record

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'file_hash', nullable: true })
  fileHash: string; // SHA-256 hash for integrity verification

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ name: 'uploaded_at', type: 'timestamp', nullable: true })
  uploadedAt: Date;

  @Column({ default: 'PENDING_VERIFICATION' })
  status: string; // PENDING_VERIFICATION, VERIFICATION_FAILED, VIRUS_SCAN_FAILED, PENDING_REVIEW, APPROVED, REJECTED, EXPIRED, ARCHIVED

  @Column({ name: 'verified_by', nullable: true })
  verifiedBy: string;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  expiryDate: Date;

  @Column({ name: 'reminder_sent', default: false })
  reminderSent: boolean;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @Column({ type: 'json', nullable: true })
  metadata: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Broker, broker => broker.brokerDocuments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_id' })
  broker: Broker;

  @ManyToOne(() => BrokerAccount, account => account.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broker_account_id' })
  brokerAccount: BrokerAccount;

  @ManyToOne(() => User, user => user.uploadedDocuments)
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;

  @ManyToOne(() => User, user => user.verifiedDocuments, { nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifier: User;
}