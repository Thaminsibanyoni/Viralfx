import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsObject, IsOptional, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBrokerDto } from './create-broker.dto';
import { BrokerStatus } from '../entities/broker.entity';

class ComplianceInfoDto {
  @ApiProperty({ required: false })
  @IsOptional()
  aum?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  clientCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  insuranceCoverage?: number;
}

class PaymentInfoDto {
  @ApiProperty({ required: false })
  @IsOptional()
  billingEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  paymentMethod?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  billingAddress?: string;
}

export class UpdateBrokerDto extends PartialType(CreateBrokerDto) {
  @ApiProperty({ enum: BrokerStatus, required: false })
  @IsOptional()
  @IsEnum(BrokerStatus)
  status?: BrokerStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ComplianceInfoDto)
  complianceInfo?: ComplianceInfoDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentInfoDto)
  paymentInfo?: PaymentInfoDto;
}