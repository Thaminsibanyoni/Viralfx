import { IsString, IsNotEmpty, IsUUID, IsDate, IsEnum, IsArray, IsNumber, Min, Max, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceItemDto {
  @ApiProperty({ description: 'Item description', example: 'Monthly subscription fee' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Quantity', example: 1, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Unit price', example: 299.99, minimum: 0 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    description: 'Item type',
    enum: ['SUBSCRIPTION', 'API_USAGE', 'OVERAGE', 'PENALTY', 'OTHER'],
    example: 'SUBSCRIPTION'
  })
  @IsEnum(['SUBSCRIPTION', 'API_USAGE', 'OVERAGE', 'PENALTY', 'OTHER'])
  @IsNotEmpty()
  itemType: string;
}

export class GenerateInvoiceDto {
  @ApiProperty({ description: 'Broker ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  brokerId: string;

  @ApiProperty({ description: 'Billing period (YYYY-MM format)', example: '2024-11' })
  @IsString()
  @IsNotEmpty()
  period: string;

  @ApiProperty({ description: 'Due date', example: '2024-11-30T00:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  dueDate: Date;

  @ApiPropertyOptional({
    description: 'Currency',
    enum: ['ZAR', 'USD', 'EUR', 'GBP'],
    example: 'ZAR'
  })
  @IsEnum(['ZAR', 'USD', 'EUR', 'GBP'])
  @IsOptional()
  currency?: string = 'ZAR';

  @ApiProperty({
    description: 'Invoice line items',
    type: [InvoiceItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiPropertyOptional({
    description: 'Invoice notes',
    example: 'Payment due within 30 days.'
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Tax rate (decimal)',
    example: 0.15,
    minimum: 0,
    maximum: 1
  })
  @IsNumber()
  @IsOptional()
  taxRate?: number = 0.15;

  @ApiPropertyOptional({
    description: 'Discount percentage (0-100)',
    example: 5,
    minimum: 0,
    maximum: 100
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  discountPercentage?: number;
}