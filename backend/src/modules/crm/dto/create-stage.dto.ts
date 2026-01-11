import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional, IsBoolean, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStageDto {
  @ApiProperty({ description: 'Stage name', example: 'Qualified Lead', minLength: 2, maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Stage description', example: 'Lead has been qualified and is ready for initial contact' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Stage order in pipeline', example: 1, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  order: number;

  @ApiProperty({
    description: 'Win probability percentage',
    example: 75,
    minimum: 0,
    maximum: 100
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  probability: number;

  @ApiPropertyOptional({
    description: 'Stage color (hex code)',
    example: '#3B82F6'
  })
  @IsOptional()
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'Color must be a valid hex color code' })
  color?: string;

  @ApiPropertyOptional({ description: 'Stage icon', example: 'check-circle' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Whether stage is active', example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiPropertyOptional({ description: 'Whether stage requires approval', example: false })
  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean = false;
}
