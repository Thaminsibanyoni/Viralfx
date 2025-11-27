import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { BrokerVerification } from './broker-verification.entity';
import { BrokerBill } from './broker-bill.entity';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../database/entities/order.entity';

export enum BrokerStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export enum BrokerTier {
  STARTER = 'STARTER',
  VERIFIED = 'VERIFIED',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
}

export enum BrokerType {
  FINANCIAL_INSTITUTION = 'FINANCIAL_INSTITUTION',
  INDEPENDENT_BROKER = 'INDEPENDENT_BROKER',
  TRADING_FIRM = 'TRADING_FIRM',
  CRYPTOCURRENCY_EXCHANGE = 'CRYPTOCURRENCY_EXCHANGE',
}

@Entity('brokers')
export class Broker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyName: string;

  @Column({ unique: true })
  registrationNumber: string;

  @Column({ nullable: true })
  fscaLicenseNumber: string;

  @Column({ nullable: true })
  fscaLicenseExpiry: Date;

  @Column({
    type: 'enum',
    enum: BrokerType,
    default: BrokerType.INDEPENDENT_BROKER,
  })
  type: BrokerType;

  @Column({
    type: 'enum',
    enum: BrokerStatus,
    default: BrokerStatus.PENDING,
  })
  status: BrokerStatus;

  @Column({
    type: 'enum',
    enum: BrokerTier,
    default: BrokerTier.STARTER,
  })
  tier: BrokerTier;

  @Column()
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column()
  physicalAddress: string;

  @Column({ nullable: true })
  postalAddress: string;

  @Column({ nullable: true })
  website: string;

  @Column({ type: 'json', nullable: true })
  businessProfile: {
    description: string;
    services: string[];
    markets: string[];
    assetsUnderManagement?: number;
    yearsInBusiness: number;
    numberOfClients?: number;
  };

  @Column({ type: 'json', nullable: true })
  complianceInfo: {
    registeredWithFSCA: boolean;
    compliantWithPOPIA: boolean;
    hasAMLKycProcedures: boolean;
    insuranceCoverage: boolean;
    lastComplianceAudit?: Date;
    auditReport?: string;
  };

  @Column({ type: 'json', nullable: true })
  paymentInfo: {
    supportedMethods: string[];
    currencies: string[];
    minimumDeposit: number;
    maximumDeposit: number;
    processingTime: string;
    fees: {
      deposit: number;
      withdrawal: number;
      trading: number;
    };
  };

  @Column({ type: 'json', nullable: true })
  oauthConfig: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
    enabled: boolean;
  };

  @Column({ type: 'json', nullable: true })
  apiConfig: {
    apiKey: string;
    apiSecret: string;
    webhookUrl: string;
    sandboxMode: boolean;
    rateLimits: {
      requestsPerMinute: number;
      requestsPerHour: number;
    };
  };

  @Column({ type: 'json', nullable: true })
  riskAssessment: {
    riskScore: number;
    riskFactors: string[];
    mitigation: string[];
    lastAssessment: Date;
    nextReview: Date;
  };

  @Column({ default: false })
  isPubliclyListed: boolean;

  @Column({ default: true })
  acceptNewClients: boolean;

  @Column({ default: 0 })
  totalTraders: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalVolume: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  numberOfReviews: number;

  @OneToMany(() => BrokerVerification, verification => verification.broker)
  verifications: BrokerVerification[];

  @OneToMany(() => User, user => user.broker)
  clients: User[];

  @OneToMany(() => BrokerBill, bill => bill.broker)
  bills: BrokerBill[];

  @OneToMany(() => Order, (order) => order.broker)
  orders: Order[];

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  bannerUrl: string;

  @Column({ type: 'json', nullable: true })
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };

  @Column({ type: 'json', nullable: true })
  operatingHours: {
    monday: { open: string; close: string };
    tuesday: { open: string; close: string };
    wednesday: { open: string; close: string };
    thursday: { open: string; close: string };
    friday: { open: string; close: string };
    saturday: { open: string; close: string };
    sunday: { open: string; close: string };
    timezone: string;
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  // CRM Metrics
  @Column({ default: 0 })
  totalDealsWon: number;

  @Column({ default: 0 })
  totalDealsLost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalRevenue: number;

  @Column({ default: 0 })
  totalDeals: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  winRate: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Computed properties
  get verificationStatus(): string {
    if (this.status === BrokerStatus.VERIFIED) {
      return 'FSCA Verified';
    }
    return this.status.charAt(0) + this.status.slice(1).toLowerCase();
  }

  get isFullyCompliant(): boolean {
    return this.complianceInfo?.registeredWithFSCA &&
           this.complianceInfo?.compliantWithPOPIA &&
           this.complianceInfo?.hasAMLKycProcedures &&
           this.complianceInfo?.insuranceCoverage;
  }

  get trustScore(): number {
    let score = 0;

    // FSCA verification (35 points)
    if (this.status === BrokerStatus.VERIFIED) score += 35;

    // Compliance (25 points)
    if (this.isFullyCompliant) score += 25;

    // Broker tier (20 points)
    switch (this.tier) {
      case BrokerTier.ENTERPRISE: score += 20; break;
      case BrokerTier.PREMIUM: score += 15; break;
      case BrokerTier.VERIFIED: score += 10; break;
      case BrokerTier.STARTER: score += 5; break;
    }

    // Business longevity (10 points)
    if (this.businessProfile?.yearsInBusiness >= 5) score += 10;
    else if (this.businessProfile?.yearsInBusiness >= 2) score += 7;
    else if (this.businessProfile?.yearsInBusiness >= 1) score += 3;

    // Client reviews (10 points)
    if (this.numberOfReviews >= 100) score += 10;
    else if (this.numberOfReviews >= 50) score += 7;
    else if (this.numberOfReviews >= 10) score += 3;

    return Math.min(score, 100);
  }
}