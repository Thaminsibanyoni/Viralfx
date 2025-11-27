import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, Min, IsOptional, IsUrl, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class DepositDto {
  @ApiProperty({ description: 'Deposit amount' })
  @IsNumber()
  @Min(10)
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Deposit currency',
    enum: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH']
  })
  @IsEnum(['ZAR', 'USD', 'EUR', 'BTC', 'ETH'])
  currency: 'ZAR' | 'USD' | 'EUR' | 'BTC' | 'ETH';

  @ApiProperty({
    description: 'Payment gateway',
    enum: ['paystack', 'payfast', 'ozow']
  })
  @IsEnum(['paystack', 'payfast', 'ozow'])
  gateway: 'paystack' | 'payfast' | 'ozow';

  @ApiProperty({
    description: 'Callback URL',
    required: false
  })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @ApiProperty({
    description: 'Additional metadata',
    required: false
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}