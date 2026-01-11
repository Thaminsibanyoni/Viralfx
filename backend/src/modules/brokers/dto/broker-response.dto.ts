import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerVerification, VerificationStatus } from '../entities/broker-verification.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerBill } from '../entities/broker-bill.entity';

export class BrokerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyName: string;

  @ApiProperty()
  registrationNumber: string;

  @ApiProperty()
  fscaLicenseNumber?: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  tier: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  contactEmail: string;

  @ApiProperty()
  contactPhone?: string;

  @ApiProperty()
  physicalAddress: string;

  @ApiProperty()
  website?: string;

  @ApiProperty()
  logoUrl?: string;

  @ApiProperty()
  businessProfile: {
    description: string;
    services: string[];
    markets: string[];
    yearsInBusiness: string;
  };

  @ApiProperty()
  complianceInfo: {
    fscaVerified: boolean;
    aum?: number;
    clientCount?: number;
    insuranceCoverage?: number;
  };

  @ApiProperty()
  paymentInfo: {
    billingEmail?: string;
    paymentMethod?: string;
    billingAddress?: string;
  };

  @ApiProperty()
  apiConfig: {
    apiKey?: string;
    apiSecret?: string;
    webhookUrl?: string;
    rateLimit?: number;
    allowedIps?: string[];
  };

  @ApiProperty()
  oauthConfig: {
    provider?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string[];
  };

  @ApiProperty()
  trustScore: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  verifiedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  verificationStatus: VerificationStatus;

  @ApiProperty()
  isFullyCompliant: boolean;

  @ApiProperty({ required: false })
  latestVerification?: BrokerVerification;

  @ApiProperty({ required: false })
  currentBill?: BrokerBill;
}
