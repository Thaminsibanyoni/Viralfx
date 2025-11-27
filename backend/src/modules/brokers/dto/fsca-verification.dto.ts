import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsArray, IsOptional, IsNumber, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

class DirectorDto {
  @ApiProperty()
  @IsString()
  fullName: string;

  @ApiProperty()
  @IsString()
  idNumber: string;

  @ApiProperty()
  @IsString()
  role: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class FSCAVerificationDto {
  @ApiProperty()
  @IsUUID()
  brokerId: string;

  @ApiProperty()
  @IsString()
  fscaLicenseNumber: string;

  @ApiProperty({ enum: ['I', 'II', 'III'] })
  @IsEnum(['I', 'II', 'III'])
  licenseCategory: 'I' | 'II' | 'III';

  @ApiProperty()
  @IsString()
  registrationNumber: string;

  @ApiProperty({ type: [DirectorDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectorDto)
  directors: DirectorDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  aum?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  physicalAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;
}