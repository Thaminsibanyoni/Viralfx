import { IsOptional, IsString, IsEnum, IsDate } from 'class-validator';

export enum ContractStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
}

export class ContractFiltersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsDate()
  startDateAfter?: Date;

  @IsOptional()
  @IsDate()
  startDateBefore?: Date;

  @IsOptional()
  @IsDate()
  endDateAfter?: Date;

  @IsOptional()
  @IsDate()
  endDateBefore?: Date;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
