import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { PaymentMethod } from '../entities/broker-bill.entity';

export class InitiatePaymentDto {
  @ApiProperty()
  @IsUUID()
  billId: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  cancelUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class WebhookPaymentDto {
  @ApiProperty()
  reference: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  transactionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  signature?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}