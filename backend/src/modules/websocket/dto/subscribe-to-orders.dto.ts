import { IsOptional, IsUUID } from 'class-validator';

export class SubscribeToOrdersDto {
  @IsUUID(4)
  @IsOptional()
  userId?: string; // If not provided, uses current user's ID
}
