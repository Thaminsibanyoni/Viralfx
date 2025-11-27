import {
  Entity,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
  ManyToOne,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsEmail, IsString, IsEnum, IsOptional, IsDateString, Min, Max } from 'class-validator';
import { BaseEntity } from './base.entity';
import { UserProfile } from './user-profile.entity';
import { KYCDocument } from './kyc-document.entity';
import { Order } from './order.entity';
import { Wallet } from './wallet.entity';
import { Transaction } from './transaction.entity';
import { PaymentTransaction } from './payment-transaction.entity';
import { Notification } from './notification.entity';
import { BacktestingStrategy } from './backtesting-strategy.entity';
import { AuditLog } from './audit-log.entity';
import { ModerationTask } from './moderation-task.entity';
import { Broker } from '../../modules/brokers/entities/broker.entity';
import { BrokerClient } from '../../modules/brokers/entities/broker-client.entity';
import { Ticket } from '../../modules/crm/entities/ticket.entity';
import { TicketAssignment } from '../../modules/crm/entities/ticket-assignment.entity';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  TRADER = 'TRADER',
  PREMIUM = 'PREMIUM',
  SUPPORT = 'SUPPORT',
  SUPPORT_LEAD = 'SUPPORT_LEAD',
  SUPERVISOR = 'SUPERVISOR',
  FINANCE = 'FINANCE',
  TEAM_LEAD = 'TEAM_LEAD',
  SUPPORT_MANAGER = 'SUPPORT_MANAGER',
  HEAD_OF_SUPPORT = 'HEAD_OF_SUPPORT',
  COMPLIANCE_MANAGER = 'COMPLIANCE_MANAGER',
  CTO = 'CTO',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum KYCStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

@Entity('users')
@Index(['email'])
@Index(['username'])
@Index(['status'])
@Index(['kycStatus'])
@Index(['createdAt'])
@Index(['referralCode'])
export class User extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  @IsEmail()
  email: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  @IsString()
  username: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'password_hash',
  })
  @Exclude()
  passwordHash: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  @IsString()
  firstName: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  @IsString()
  lastName: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'phone_number',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @Column({
    type: 'date',
    nullable: true,
    name: 'date_of_birth',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @Column({
    type: 'varchar',
    length: 2,
    default: 'ZA',
  })
  @IsString()
  country: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  @IsEnum(UserRole)
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  @IsEnum(UserStatus)
  status: UserStatus;

  @Column({
    type: 'boolean',
    default: false,
    name: 'email_verified',
  })
  emailVerified: boolean;

  @Column({
    type: 'boolean',
    default: false,
    name: 'phone_verified',
  })
  phoneVerified: boolean;

  @Column({
    type: 'enum',
    enum: KYCStatus,
    default: KYCStatus.NOT_STARTED,
    name: 'kyc_status',
  })
  @IsEnum(KYCStatus)
  kycStatus: KYCStatus;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'kyc_verified_at',
  })
  @IsOptional()
  kycVerifiedAt?: Date;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_two_factor_enabled',
  })
  @Exclude()
  isTwoFactorEnabled: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'two_factor_secret',
  })
  @Exclude()
  twoFactorSecret?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  @Exclude()
  backupCodes?: string[];

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'avatar_url',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    nullable: true,
    name: 'referral_code',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'referred_by',
  })
  @IsOptional()
  referredBy?: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'last_login_at',
  })
  @IsOptional()
  lastLoginAt?: Date;

  @Column({
    type: 'inet',
    nullable: true,
    name: 'last_login_ip',
  })
  @IsOptional()
  lastLoginIp?: string;

  @Column({
    type: 'int',
    default: 0,
    name: 'login_attempts',
  })
  @Min(0)
  loginAttempts: number;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'locked_until',
  })
  @IsOptional()
  lockedUntil?: Date;

  @Column({
    type: 'json',
    default: () => "'{}'",
  })
  @IsOptional()
  preferences: Record<string, any>;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0.00,
    name: 'risk_score',
  })
  @Min(0)
  @Max(100)
  riskScore: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0.00,
    name: 'compliance_score',
  })
  @Min(0)
  @Max(100)
  complianceScore: number;

  // Support-related fields
  @Column({
    type: 'json',
    nullable: true,
    name: 'agent_categories',
  })
  @IsOptional()
  agentCategories?: string[];

  @Column({
    type: 'text',
    array: true,
    nullable: true,
    name: 'categories',
  })
  @IsOptional()
  categories?: string[];

  // Broker Relationships
  @Column({
    type: 'uuid',
    nullable: true,
    name: 'broker_id',
  })
  @IsOptional()
  brokerId?: string;

  // Relationships
  @OneToOne(() => UserProfile, (profile) => profile.user, {
    cascade: true,
  })
  profile: UserProfile;

  @OneToMany(() => KYCDocument, (kyc) => kyc.user, {
    cascade: true,
  })
  kycDocuments: KYCDocument[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Wallet, (wallet) => wallet.user)
  wallets: Wallet[];

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];

  @OneToMany(() => PaymentTransaction, (payment) => payment.user)
  paymentTransactions: PaymentTransaction[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @OneToMany(() => BacktestingStrategy, (strategy) => strategy.user)
  backtestingStrategies: BacktestingStrategy[];

  @OneToMany(() => AuditLog, (audit) => audit.user)
  auditLogs: AuditLog[];

  @OneToMany(() => ModerationTask, (task) => task.assignedTo)
  assignedModerationTasks: ModerationTask[];

  @ManyToOne(() => Broker, (broker) => broker.clients, {
    nullable: true,
  })
  @JoinColumn({ name: 'broker_id' })
  broker?: Broker;

  @OneToMany(() => BrokerClient, (brokerClient) => brokerClient.user)
  brokerClients: BrokerClient[];

  // Ticket-related relationships
  @OneToMany(() => Ticket, (ticket) => ticket.assignedTo)
  assignedTickets: Ticket[];

  @OneToMany(() => TicketAssignment, (assignment) => assignment.assignedTo)
  ticketAssignments: TicketAssignment[];

  @OneToMany(() => TicketAssignment, (assignment) => assignment.assignedBy)
  ticketAssignmentsBy: TicketAssignment[];

  // Computed properties
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  get isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  get isLocked(): boolean {
    return this.lockedUntil ? new Date() < this.lockedUntil : false;
  }

  get isKYCVerified(): boolean {
    return this.kycStatus === KYCStatus.VERIFIED;
  }

  get isPremium(): boolean {
    return this.role === UserRole.PREMIUM || this.role === UserRole.ADMIN;
  }

  get canTrade(): boolean {
    return this.isActive && !this.isLocked && this.isKYCVerified;
  }

  get hasBroker(): boolean {
    return !!this.brokerId;
  }

  @BeforeInsert()
  protected beforeInsert() {
    super.beforeInsert();
    this.generateReferralCode();
  }

  private generateReferralCode(): void {
    if (!this.referralCode) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      this.referralCode = `VF_${timestamp}_${random}`.toUpperCase();
    }
  }

  protected validate(): void {
    if (this.riskScore < 0 || this.riskScore > 100) {
      throw new Error('Risk score must be between 0 and 100');
    }
    if (this.complianceScore < 0 || this.complianceScore > 100) {
      throw new Error('Compliance score must be between 0 and 100');
    }
    if (this.loginAttempts < 0) {
      throw new Error('Login attempts cannot be negative');
    }
  }
}