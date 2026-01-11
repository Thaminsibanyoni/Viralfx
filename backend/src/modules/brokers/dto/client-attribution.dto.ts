import { IsString, IsEnum, IsOptional, IsUUID, IsObject, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { AttributionType, BrokerClientStatus } from '../enums/broker.enum';

export class AttributeClientDto {
  @IsUUID()
  clientId: string;

  @IsUUID()
  brokerId: string;

  @IsEnum(AttributionType)
  attributionType: AttributionType;

  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  @IsString()
  referralLink?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateClientStatusDto {
  @IsEnum(BrokerClientStatus)
  status: BrokerClientStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GetBrokerClientsDto {
  @IsOptional()
  @IsEnum(BrokerClientStatus)
  status?: BrokerClientStatus;

  @IsOptional()
  @IsEnum(AttributionType)
  attributionType?: AttributionType;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'lastTradeDate' | 'totalCommission' | 'totalTrades' = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class ReferralCodeDto {
  @IsString()
  referralCode: string;
}

export class ClientRevenuePeriodDto {
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Type(() => Date)
  @IsDate()
  endDate: Date;
}

export class ClientRevenueResponseDto {
  period: {
    start: Date;
    end: Date;
  };
  totalRevenue: number;
  brokerRevenue: number;
  platformRevenue: number;
  clientBreakdown: Array<{
    clientId: string;
    clientName: string;
    totalCommission: number;
    brokerCommission: number;
    tradeCount: number;
  }>;
}
