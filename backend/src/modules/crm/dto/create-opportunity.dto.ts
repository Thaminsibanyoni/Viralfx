import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsArray, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OpportunityStage } from '../entities/opportunity.entity';

export class CreateOpportunityDto {
  @ApiPropertyOptional({ description: 'Lead ID if created from a lead' })
  @IsUUID()
  @IsOptional()
  leadId?: string;

  @ApiProperty({ description: 'Broker ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  brokerId: string;

  @ApiProperty({ description: 'Opportunity name', example: 'Premium Broker Partnership' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    enum: OpportunityStage,
    description: 'Current stage',
    default: OpportunityStage.PROSPECTING
  })
  @IsEnum(OpportunityStage)
  @IsOptional()
  stage?: OpportunityStage;

  @ApiProperty({ description: 'Opportunity value', example: 100000 })
  @IsNumber()
  @IsNotEmpty()
  value: number;

  @ApiPropertyOptional({
    description: 'Probability of success (%)',
    minimum: 0,
    maximum: 100,
    default: 50
  })
  @IsNumber()
  @IsOptional()
  probability?: number;

  @ApiPropertyOptional({
    description: 'Expected close date',
    example: '2024-12-31'
  })
  @IsDateString()
  @IsOptional()
  expectedCloseDate?: string;

  @ApiPropertyOptional({
    description: 'Products involved',
    type: [String],
    example: ['Premium Analytics', 'Real-time Data']
  })
  @IsArray()
  @IsOptional()
  products?: string[];

  @ApiPropertyOptional({
    description: 'Competitors',
    type: [String],
    example: ['CompetitorA', 'CompetitorB']
  })
  @IsArray()
  @IsOptional()
  competitors?: string[];

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}