import { IsString, IsNotEmpty, IsUUID, IsNumber, Min, IsDate, IsOptional, IsUrl, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordPaymentDto {
  @ApiProperty({ description: 'Invoice ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  invoiceId: string;

  @ApiProperty({ description: 'Payment amount', example: 299.99, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Payment date', example: '2024-11-15T10:30:00.000Z' })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  paymentDate: Date;

  @ApiProperty({
    description: 'Payment method',
    enum: ['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'CHECK', 'OTHER'],
    example: 'BANK_TRANSFER'
  })
  @IsEnum(['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'CHECK', 'OTHER'])
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ description: 'Transaction reference number', example: 'TXN123456789' })
  @IsString()
  @IsNotEmpty()
  transactionReference: string;

  @ApiPropertyOptional({
    description: 'Processing fee charged by payment processor',
    example: 5.50,
    minimum: 0
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  processingFee?: number = 0;

  @ApiPropertyOptional({
    description: 'Payment notes',
    example: 'Payment processed via online banking.'
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Receipt URL',
    example: 'https://example.com/receipts/TXN123456789.pdf'
  })
  @IsUrl()
  @IsOptional()
  receiptUrl?: string;
}
