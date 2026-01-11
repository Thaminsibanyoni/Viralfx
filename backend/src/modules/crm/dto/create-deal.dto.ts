import { IsString, IsNotEmpty, IsUUID, IsNumber, IsOptional, IsEnum, IsDate, IsArray, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDealDto {
  @ApiProperty({
    description: 'Deal title',
    example: 'Enterprise API Integration',
    minLength: 5,
    maxLength: 200
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Broker ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  brokerId: string;

  @ApiProperty({ description: 'Deal value', example: 50000, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  value: number;

  @ApiPropertyOptional({
    description: 'Currency',
    enum: ['ZAR', 'USD', 'EUR', 'GBP'],
    example: 'ZAR'
  })
  @IsEnum(['ZAR', 'USD', 'EUR', 'GBP'])
  @IsOptional()
  currency?: string = 'ZAR';

  @ApiProperty({ description: 'Pipeline stage ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsNotEmpty()
  stageId: string;

  @ApiPropertyOptional({
    description: 'Win probability percentage',
    example: 60,
    minimum: 0,
    maximum: 100
  })
  @IsNumber()
  @IsOptional()
  probability?: number;

  @ApiProperty({ description: 'Expected close date', example: '2024-12-31T23:59:59.000Z' })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  expectedCloseDate: Date;

  @ApiPropertyOptional({
    description: 'Deal description',
    example: 'Large-scale API integration for enterprise client.'
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Deal source',
    example: 'REFERRAL'
  })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({
    description: 'Deal tags',
    example: ['enterprise', 'api', 'integration'],
    type: [String]
  })
  @IsArray()
  @IsOptional()
  tags?: string[];
}
