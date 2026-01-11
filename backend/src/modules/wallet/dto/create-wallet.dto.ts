import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class CreateWalletDto {
  @ApiProperty({
    description: 'Wallet currency',
    enum: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH']
  })
  @IsEnum(['ZAR', 'USD', 'EUR', 'BTC', 'ETH'])
  currency: 'ZAR' | 'USD' | 'EUR' | 'BTC' | 'ETH';

  @ApiProperty({
    description: 'Wallet type',
    enum: ['TRADING', 'SAVINGS', 'INVESTMENT', 'CUSTODIAL'],
    default: 'TRADING'
  })
  @IsOptional()
  @IsEnum(['TRADING', 'SAVINGS', 'INVESTMENT', 'CUSTODIAL'])
  walletType?: 'TRADING' | 'SAVINGS' | 'INVESTMENT' | 'CUSTODIAL';

  @ApiProperty({
    description: 'Is default wallet for the currency',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
