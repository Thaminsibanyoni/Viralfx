import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum, IsObject, IsPhoneNumber, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BrokerType } from '../enums/broker.enum';

class BusinessProfileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  services: string[];

  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  markets: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  yearsInBusiness: string;
}

export class CreateBrokerDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  companyName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  registrationNumber: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  fscaLicenseNumber?: string;

  @ApiProperty({ enum: BrokerType })
  @IsEnum(BrokerType)
  type: BrokerType;

  @ApiProperty()
  @IsEmail()
  contactEmail: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsPhoneNumber('ZA')
  contactPhone?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  physicalAddress: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty()
  @IsObject()
  @ValidateNested()
  @Type(() => BusinessProfileDto)
  businessProfile: BusinessProfileDto;
}
