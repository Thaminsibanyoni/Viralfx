import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReportFilterDto {
  @ApiPropertyOptional({
    description: 'Start date for report filtering (ISO date string)',
    example: '2023-01-01'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for report filtering (ISO date string)',
    example: '2023-12-31'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Report type to generate',
    example: 'comprehensive'
  })
  @IsOptional()
  reportType?: string;

  @ApiPropertyOptional({
    description: 'Include charts and visualizations',
    example: false
  })
  @IsOptional()
  includeCharts?: boolean;
}
