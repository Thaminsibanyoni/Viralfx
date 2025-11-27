import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsObject, Min, Max, IsEmail, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ClientSegment {
  RETAIL = 'RETAIL',
  VIP = 'VIP',
  ACTIVE = 'ACTIVE',
  DORMANT = 'DORMANT',
  HIGH_RISK = 'HIGH_RISK',
  STANDARD = 'STANDARD',
}

export enum ClientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  CHURNED = 'CHURNED',
}

export enum ClientSource {
  ORGANIC = 'ORGANIC',
  REFERRAL = 'REFERRAL',
  ADVERTISING = 'ADVERTISING',
  PARTNER = 'PARTNER',
  BROKER = 'BROKER',
}

export enum PreferredContact {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PHONE = 'PHONE',
  WHATSAPP = 'WHATSAPP',
}

export class CreateClientRecordDto {
  @ApiProperty({ description: 'Client name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Client email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Client phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Client country code' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'User ID associated with this client record' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Client metadata object' })
  @IsOptional()
  @IsObject()
  metadata?: object;

  @ApiPropertyOptional({ description: 'Broker ID if client is managed by a broker' })
  @IsOptional()
  @IsString()
  brokerId?: string;

  @ApiPropertyOptional({ enum: ClientSegment, description: 'Client segment', default: ClientSegment.RETAIL })
  @IsOptional()
  @IsEnum(ClientSegment)
  segment?: ClientSegment = ClientSegment.RETAIL;

  @ApiPropertyOptional({ enum: ClientSource, description: 'Client acquisition source' })
  @IsOptional()
  @IsEnum(ClientSource)
  source?: ClientSource;

  @ApiPropertyOptional({ description: 'Marketing campaign name' })
  @IsOptional()
  @IsString()
  campaign?: string;

  @ApiPropertyOptional({ description: 'Risk assessment score (0-1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  riskScore?: number;

  @ApiPropertyOptional({ description: 'Risk factors object' })
  @IsOptional()
  @IsObject()
  riskFactors?: object;

  @ApiPropertyOptional({ enum: PreferredContact, description: 'Preferred contact method' })
  @IsOptional()
  @IsEnum(PreferredContact)
  preferredContact?: PreferredContact;

  @ApiPropertyOptional({ description: 'Marketing consent' })
  @IsOptional()
  marketingConsent?: boolean;

  @ApiPropertyOptional({ description: 'Newsletter consent' })
  @IsOptional()
  newsletterConsent?: boolean;

  @ApiPropertyOptional({ enum: ClientStatus, description: 'Client status' })
  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @ApiPropertyOptional({ description: 'Internal notes about client' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Client tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Custom fields object' })
  @IsOptional()
  @IsObject()
  customFields?: object;
}