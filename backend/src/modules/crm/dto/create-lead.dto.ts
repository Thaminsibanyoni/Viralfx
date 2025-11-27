import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsObject, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource } from '../entities/lead.entity';

export class CreateLeadDto {
  @ApiPropertyOptional({ description: 'Broker ID if lead is associated with a broker' })
  @IsUUID()
  @IsOptional()
  brokerId?: string;

  @ApiProperty({ enum: LeadSource, description: 'Source of the lead' })
  @IsEnum(LeadSource)
  @IsNotEmpty()
  source: LeadSource;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Email address', example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+27 83 123 4567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Company name', example: 'Acme Corporation' })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiPropertyOptional({ description: 'Job position', example: 'CEO' })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'South Africa' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Region', example: 'Gauteng' })
  @IsString()
  @IsOptional()
  region?: string;

  @ApiPropertyOptional({ description: 'Estimated revenue', example: 50000 })
  @IsNumber()
  @IsOptional()
  estimatedRevenue?: number;

  @ApiPropertyOptional({ description: 'Lead notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}