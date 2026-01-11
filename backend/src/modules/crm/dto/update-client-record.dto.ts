import { PartialType } from '@nestjs/swagger';
import { CreateClientRecordDto, ClientSegment, ClientStatus, PreferredContact } from "./create-client-record.dto";
import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsObject, Min, Max, IsDateString } from 'class-validator';

export class UpdateClientRecordDto extends PartialType(CreateClientRecordDto) {
  @IsOptional()
  @IsEnum(ClientSegment)
  segment?: ClientSegment;

  @IsOptional()
  @IsEnum(PreferredContact)
  preferredContact?: PreferredContact;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalTrades?: number;

  @IsOptional()
  @IsNumber()
  totalVolume?: number;

  @IsOptional()
  @IsNumber()
  totalPnl?: number;

  @IsOptional()
  @IsNumber()
  avgTradeSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  riskScore?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  customFields?: object;

  @IsOptional()
  @IsString()
  campaign?: string;

  @IsOptional()
  @IsDateString()
  lastActivityAt?: string;
}
