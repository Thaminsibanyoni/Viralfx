import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, Min, IsObject, IsOptional, IsString, IsEnum, Length, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { WithdrawalDestination } from "../../order-matching/interfaces/order-matching.interface";

export class WithdrawalDto {
  @ApiProperty({ description: 'Wallet ID to withdraw from' })
  @IsUUID()
  walletId: string;

  @ApiProperty({ description: 'Withdrawal amount' })
  @IsNumber()
  @Min(10)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ description: 'Withdrawal destination' })
  @IsObject()
  destination: WithdrawalDestination;

  @ApiProperty({
    description: 'Two-factor authentication code',
    required: false
  })
  @IsOptional()
  @ValidateIf((o) => o.amount >= 10000) // Required for amounts >= 10,000
  @IsString()
  @Length(6, 6)
  twoFactorCode?: string;

  @ApiProperty({
    description: 'Withdrawal reason',
    required: false
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
