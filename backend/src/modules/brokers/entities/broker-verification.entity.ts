import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Broker } from './broker.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum VerificationType {
  FSCA_LICENSE = 'FSCA_LICENSE',
  DOCUMENTS = 'DOCUMENTS',
  TECHNICAL = 'TECHNICAL',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  KYC_DIRECTORS = 'KYC_DIRECTORS',
  KYC_UBOS = 'KYC_UBOS',
  AML_SANCTIONS = 'AML_SANCTIONS',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum KycStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ADDITIONAL_INFO_REQUIRED = 'ADDITIONAL_INFO_REQUIRED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('broker_verifications')
export class BrokerVerification {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'uuid' })
  brokerId: string;

  @ApiProperty({ enum: VerificationType })
  @Column({ type: 'enum', enum: VerificationType })
  verificationType: VerificationType;

  @ApiProperty({ enum: VerificationStatus })
  @Column({ type: 'enum', enum: VerificationStatus, default: VerificationStatus.PENDING })
  status: VerificationStatus;

  @ApiProperty()
  @Column({ type: 'jsonb', nullable: true })
  documents: Array<{
    id: string;
    type: string;
    url: string;
    uploadedAt: Date;
    verified: boolean;
    verificationOutcome?: 'APPROVED' | 'REJECTED' | 'PENDING';
    verifiedAt?: Date;
    verifiedBy?: string;
    rejectionReason?: string;
    expiryDate?: Date;
  }>;

  @ApiProperty({ enum: KycStatus, nullable: true })
  @Column({ type: 'enum', enum: KycStatus, nullable: true })
  kycStatus: KycStatus;

  @ApiProperty()
  @Column({ type: 'jsonb', nullable: true })
  fscaResponse: {
    isValid: boolean;
    licenseStatus: string;
    verificationDate: Date;
    expiryDate?: Date;
    restrictions?: string[];
    approvedInstruments?: string[];
    riskRating?: string;
  };

  @ApiProperty()
  @Column({ type: 'jsonb', nullable: true })
  kycData: {
    directors?: Array<{
      id: string;
      name: string;
      idNumber: string;
      role: string;
      shareholding: number;
      verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
      verificationDate?: Date;
      documents: string[];
      riskScore?: number;
      notes?: string;
    }>;
    ubos?: Array<{
      id: string;
      name: string;
      idNumber: string;
      shareholding: number;
      verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
      verificationDate?: Date;
      documents: string[];
      riskScore?: number;
      notes?: string;
    }>;
    amlChecks?: {
      sanctionsScreening: {
        checked: boolean;
        result: 'CLEAR' | 'MATCH' | 'POTENTIAL_MATCH';
        checkedAt?: Date;
        details?: any;
      };
      pepScreening: {
        checked: boolean;
        result: 'CLEAR' | 'MATCH';
        checkedAt?: Date;
        details?: any;
      };
      adverseMedia: {
        checked: boolean;
        result: 'CLEAR' | 'FOUND';
        checkedAt?: Date;
        details?: any;
      };
    };
    overallRiskScore?: number;
    riskFactors?: string[];
  };

  @ApiProperty()
  @Column({ type: 'jsonb', nullable: true })
  kycDecision: {
    status: 'APPROVED' | 'REJECTED' | 'REQUIRES_ADDITIONAL_INFO';
    decidedAt?: Date;
    decidedBy?: string;
    reason?: string;
    additionalInfoRequired?: string[];
    nextReviewDate?: Date;
    conditions?: string[];
  };

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @ApiProperty()
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @ApiProperty()
  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string;

  @ApiProperty()
  @CreateDateColumn()
  submittedAt: Date;

  @ApiProperty()
  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Broker, broker => broker.verifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brokerId' })
  broker: Broker;
}