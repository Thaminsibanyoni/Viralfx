import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { API_CURRENCY_CONFIG } from '../interfaces/api-marketplace.interface';

export class CreatePlanDto {
  @ApiProperty({
    description: 'Plan name',
    example: 'Starter',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Unique plan code',
    example: 'starter',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Monthly fee in ZAR',
    example: 890,
  })
  @IsNumber()
  @Min(0)
  monthlyFee: number;

  @ApiProperty({
    description: 'Per-call fee in ZAR (for pay-per-call pricing)',
    example: 0.05,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  perCallFee?: number;

  @ApiProperty({
    description: 'Rate limit (requests per minute)',
    example: 100,
  })
  @IsInt()
  @Min(1)
  rateLimit: number;

  @ApiProperty({
    description: 'Burst limit (short-term spike allowance)',
    example: 150,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  burstLimit?: number;

  @ApiProperty({
    description: 'Monthly quota (number of calls included)',
    example: 10000,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  quota?: number;

  @ApiProperty({
    description: 'Plan description',
    example: 'Perfect for developers getting started with our API',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePlanDto {
  @ApiProperty({
    description: 'Plan name',
    example: 'Starter Plus',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Monthly fee in ZAR',
    example: 1290,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyFee?: number;

  @ApiProperty({
    description: 'Per-call fee in ZAR',
    example: 0.04,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  perCallFee?: number;

  @ApiProperty({
    description: 'Rate limit (requests per minute)',
    example: 200,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  rateLimit?: number;

  @ApiProperty({
    description: 'Burst limit',
    example: 300,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  burstLimit?: number;

  @ApiProperty({
    description: 'Monthly quota',
    example: 20000,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  quota?: number;

  @ApiProperty({
    description: 'Plan description',
    example: 'Enhanced starter plan with double the quota',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}