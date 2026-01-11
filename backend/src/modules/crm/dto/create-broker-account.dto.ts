import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum, IsUrl, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBrokerAccountDto {
  // Company Information
  @ApiProperty({ description: 'Company name', example: 'Acme Trading (Pty) Ltd' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  companyName: string;

  @ApiProperty({ description: 'Company registration number', example: '2023/123456/07' })
  @IsString()
  @IsNotEmpty()
  registrationNumber: string;

  @ApiPropertyOptional({ description: 'Tax number', example: '4012345678' })
  @IsString()
  @IsOptional()
  taxNumber?: string;

  @ApiProperty({
    description: 'Company type',
    enum: ['LLC', 'CORPORATION', 'PARTNERSHIP', 'SOLE_PROPRIETORSHIP'],
    example: 'CORPORATION'
  })
  @IsEnum(['LLC', 'CORPORATION', 'PARTNERSHIP', 'SOLE_PROPRIETORSHIP'])
  @IsNotEmpty()
  companyType: string;

  // Contact Information
  @ApiProperty({ description: 'Contact email address', example: 'info@acmetrading.co.za' })
  @IsEmail()
  @IsNotEmpty()
  contactEmail: string;

  @ApiProperty({ description: 'Contact phone number', example: '+27 11 123 4567' })
  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  @ApiProperty({ description: 'Contact person name', example: 'John Smith' })
  @IsString()
  @IsNotEmpty()
  contactPerson: string;

  @ApiPropertyOptional({
    description: 'Company website URL',
    example: 'https://www.acmetrading.co.za'
  })
  @IsUrl()
  @IsOptional()
  website?: string;

  // Address
  @ApiProperty({ description: 'Address line 1', example: '123 Main Street' })
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiPropertyOptional({ description: 'Address line 2', example: 'Suite 456' })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({ description: 'City', example: 'Johannesburg' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State/Province', example: 'Gauteng' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'Postal code', example: '2001' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ description: 'Country', example: 'South Africa' })
  @IsString()
  @IsNotEmpty()
  country: string;

  // Banking Details
  @ApiProperty({ description: 'Bank name', example: 'Standard Bank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ description: 'Account number', example: '1234567890123' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({ description: 'Account holder name', example: 'Acme Trading (Pty) Ltd' })
  @IsString()
  @IsNotEmpty()
  accountHolderName: string;

  @ApiPropertyOptional({ description: 'SWIFT code', example: 'SBZAZAJJ' })
  @IsString()
  @IsOptional()
  swiftCode?: string;

  @ApiPropertyOptional({ description: 'IBAN', example: 'ZA1234567890123456' })
  @IsString()
  @IsOptional()
  iban?: string;

  // Subscription
  @ApiProperty({
    description: 'Subscription tier',
    enum: ['STARTER', 'VERIFIED', 'PARTNER', 'ENTERPRISE'],
    example: 'VERIFIED'
  })
  @IsEnum(['STARTER', 'VERIFIED', 'PARTNER', 'ENTERPRISE'])
  @IsNotEmpty()
  tier: string;

  @ApiPropertyOptional({
    description: 'Subscription start date',
    type: Date,
    example: '2024-01-01T00:00:00.000Z'
  })
  @IsOptional()
  @Type(() => Date)
  subscriptionStartDate?: Date;
}
