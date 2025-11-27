import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsBoolean, Length, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StrategyCategory } from '../../../database/entities/backtesting-strategy.entity';

export class StrategyParameterDto {
  @ApiProperty({
    description: 'Parameter name',
    example: 'minViralityScore',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Parameter type',
    enum: ['number', 'string', 'boolean'],
    example: 'number',
  })
  @IsEnum(['number', 'string', 'boolean'])
  type: 'number' | 'string' | 'boolean';

  @ApiProperty({
    description: 'Default value for the parameter',
    example: 75,
  })
  @IsNotEmpty()
  defaultValue: any;

  @ApiPropertyOptional({
    description: 'Minimum value for numeric parameters',
    example: 0,
  })
  @IsNumber()
  @IsOptional()
  min?: number;

  @ApiPropertyOptional({
    description: 'Maximum value for numeric parameters',
    example: 100,
  })
  @IsNumber()
  @IsOptional()
  max?: number;

  @ApiPropertyOptional({
    description: 'Step size for numeric parameters',
    example: 5,
  })
  @IsNumber()
  @IsOptional()
  step?: number;

  @ApiPropertyOptional({
    description: 'Parameter description',
    example: 'Minimum virality score to trigger buy signal',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class StrategyRuleCriterionDto {
  @ApiProperty({
    description: 'Field to evaluate',
    example: 'momentum_score',
  })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({
    description: 'Comparison operator',
    enum: ['>', '<', '>=', '<=', '==', '!=', 'contains'],
    example: '>',
  })
  @IsEnum(['>', '<', '>=', '<=', '==', '!=', 'contains'])
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains';

  @ApiProperty({
    description: 'Value to compare against (supports template variables)',
    example: '{{minViralityScore}}',
  })
  @IsNotEmpty()
  value: string | number;
}

export class StrategyRuleDto {
  @ApiProperty({
    description: 'Rule type',
    enum: ['BUY', 'SELL', 'EXIT'],
    example: 'BUY',
  })
  @IsEnum(['BUY', 'SELL', 'EXIT'])
  type: 'BUY' | 'SELL' | 'EXIT';

  @ApiProperty({
    description: 'Logical condition for multiple criteria',
    enum: ['AND', 'OR'],
    example: 'AND',
  })
  @IsEnum(['AND', 'OR'])
  condition: 'AND' | 'OR';

  @ApiProperty({
    description: 'Array of criteria to evaluate',
    type: [StrategyRuleCriterionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyRuleCriterionDto)
  criteria: StrategyRuleCriterionDto[];
}

export class CreateStrategyDto {
  @ApiProperty({
    description: 'Strategy name',
    example: 'My Custom Momentum Strategy',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Strategy description',
    example: 'A custom strategy that combines momentum and sentiment indicators',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  description?: string;

  @ApiProperty({
    description: 'Strategy category',
    enum: StrategyCategory,
    example: 'TREND_MOMENTUM',
  })
  @IsEnum(StrategyCategory)
  category: StrategyCategory;

  @ApiProperty({
    description: 'Strategy parameters',
    type: [StrategyParameterDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyParameterDto)
  parameters: StrategyParameterDto[];

  @ApiProperty({
    description: 'Strategy rules',
    type: [StrategyRuleDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyRuleDto)
  rules: StrategyRuleDto[];

  @ApiPropertyOptional({
    description: 'Whether strategy is public',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean = false;
}