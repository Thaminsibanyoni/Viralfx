import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class SubscribeToNotificationsDto {
  @ApiProperty({ description: 'Notification types to subscribe to' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  notificationTypes?: string[];

  @ApiProperty({ description: 'Subscribe to all notifications', required: false })
  @IsOptional()
  @IsBoolean()
  allNotifications?: boolean;

  @ApiProperty({ description: 'Email notifications enabled', required: false })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiProperty({ description: 'Push notifications enabled', required: false })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiProperty({ description: 'Real-time updates enabled', required: false })
  @IsOptional()
  @IsBoolean()
  realTimeUpdates?: boolean;
}