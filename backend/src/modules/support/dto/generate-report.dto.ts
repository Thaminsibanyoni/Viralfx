import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateReportDto {
  @ApiProperty({
    description: 'Start date for the report period (ISO date string)',
    example: '2023-01-01'
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for the report period (ISO date string)',
    example: '2023-12-31'
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Report format',
    enum: ['json', 'csv'],
    example: 'json',
    default: 'json'
  })
  @IsOptional()
  @IsEnum(['json', 'csv'])
  format?: 'json' | 'csv' = 'json';
}