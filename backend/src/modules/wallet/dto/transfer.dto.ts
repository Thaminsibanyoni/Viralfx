import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, Min, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferDto {
  @ApiProperty({ description: 'Source wallet ID' })
  @IsUUID()
  fromWalletId: string;

  @ApiProperty({ description: 'Destination wallet ID' })
  @IsUUID()
  toWalletId: string;

  @ApiProperty({ description: 'Transfer amount' })
  @IsNumber()
  @Min(0.00000001)
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Transfer description',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}