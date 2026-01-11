import { IsOptional, IsString, IsEnum, IsNumberString, IsDate } from 'class-validator';

export enum OpportunityStatus {
  LEAD = 'LEAD',
  QUALIFIED = 'QUALIFIED',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
}

export enum OpportunityStage {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  NEED_ANALYSIS = 'NEED_ANALYSIS',
  VALUE_PROPOSITION = 'VALUE_PROPOSITION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

export class OpportunityFiltersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(OpportunityStatus)
  status?: OpportunityStatus;

  @IsOptional()
  @IsEnum(OpportunityStage)
  stage?: OpportunityStage;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsNumberString()
  valueMin?: string;

  @IsOptional()
  @IsNumberString()
  valueMax?: string;

  @IsOptional()
  @IsDate()
  createdAfter?: Date;

  @IsOptional()
  @IsDate()
  createdBefore?: Date;

  @IsOptional()
  @IsDate()
  expectedCloseDateAfter?: Date;

  @IsOptional()
  @IsDate()
  expectedCloseDateBefore?: Date;

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
