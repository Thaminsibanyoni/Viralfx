import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsBoolean, IsUUID, IsObject, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType } from '../enums/crm.enum';

export class CreateContractDto {
  @ApiProperty({ description: 'Opportunity ID' })
  @IsUUID()
  @IsNotEmpty()
  opportunityId: string;

  @ApiProperty({ description: 'Broker ID' })
  @IsUUID()
  @IsNotEmpty()
  brokerId: string;

  @ApiProperty({
    enum: ContractType,
    description: 'Contract type'
  })
  @IsEnum(ContractType)
  @IsNotEmpty()
  type: ContractType;

  @ApiProperty({ description: 'Contract value', example: 100000 })
  @IsNumber()
  @IsNotEmpty()
  value: number;

  @ApiPropertyOptional({ description: 'Currency', default: 'ZAR', example: 'ZAR' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    description: 'Contract start date',
    example: '2024-01-01'
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Contract end date',
    example: '2024-12-31'
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Auto-renew contract',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean;

  @ApiPropertyOptional({ description: 'Contract terms and conditions' })
  @IsString()
  @IsOptional()
  terms?: string;

  @ApiPropertyOptional({ description: 'Contract template ID' })
  @IsUUID()
  @IsOptional()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
