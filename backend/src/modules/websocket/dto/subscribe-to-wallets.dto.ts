import { IsArray, IsBoolean, IsOptional, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class SubscribeToWalletsDto {
  @ApiProperty({ description: 'Wallet IDs to subscribe to' })
  @IsArray()
  @IsUUID('4', { each: true })
  walletIds: string[];

  @ApiProperty({ description: 'Subscribe to all user wallets', required: false })
  @IsOptional()
  @IsBoolean()
  allWallets?: boolean;

  @ApiProperty({ description: 'Real-time updates', required: false })
  @IsOptional()
  @IsBoolean()
  realTimeUpdates?: boolean;
}