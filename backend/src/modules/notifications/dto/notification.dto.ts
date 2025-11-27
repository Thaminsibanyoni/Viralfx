import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsIn,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Exclude } from 'class-transformer';

export class GetNotificationsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number = 20;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @IsOptional()
  @IsString()
  @IsIn(['info', 'success', 'warning', 'error'])
  readonly type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['system', 'trading', 'security', 'billing', 'social', 'promotion', 'order', 'alert', 'broker'])
  readonly category?: string;

  @IsOptional()
  @IsBoolean()
  readonly read?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high'])
  readonly priority?: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  readonly emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly pushNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly smsNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly inAppNotifications?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  readonly quietHours?: QuietHoursDto;
}

export class QuietHoursDto {
  @IsOptional()
  @IsBoolean()
  readonly enabled?: boolean;

  @IsOptional()
  @IsString()
  readonly start?: string; // Format: "HH:MM"

  @IsOptional()
  @IsString()
  readonly end?: string; // Format: "HH:MM"
}

export class NotificationResponseDto {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;

  // Exclude sensitive fields from responses
  @Exclude()
  userId: string;

  @Exclude()
  deletedAt?: Date;
}

export class PaginatedNotificationResponseDto {
  notifications: NotificationResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class CreateNotificationDto {
  @IsString()
  readonly userId: string;

  @IsString()
  @IsIn(['info', 'success', 'warning', 'error'])
  readonly type: string;

  @IsString()
  @IsIn(['system', 'trading', 'security', 'billing', 'social', 'promotion', 'order', 'alert', 'broker'])
  readonly category: string;

  @IsString()
  @IsIn(['low', 'medium', 'high'])
  readonly priority: string;

  @IsString()
  readonly title: string;

  @IsString()
  readonly message: string;

  @IsOptional()
  @IsString()
  readonly actionUrl?: string;

  @IsOptional()
  @IsString()
  readonly actionText?: string;

  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, any>;
}

export class BroadcastNotificationDto {
  @IsString()
  @IsIn(['info', 'success', 'warning', 'error'])
  readonly type: string;

  @IsString()
  @IsIn(['system', 'trading', 'security', 'billing', 'social', 'promotion', 'order', 'alert', 'broker'])
  readonly category: string;

  @IsString()
  @IsIn(['low', 'medium', 'high'])
  readonly priority: string;

  @IsString()
  readonly title: string;

  @IsString()
  readonly message: string;

  @IsOptional()
  @IsString()
  readonly actionUrl?: string;

  @IsOptional()
  @IsString()
  readonly actionText?: string;

  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, any>;
}

export class NotificationStatsDto {
  total: number;
  unread: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  recent: number; // Last 24 hours
}

export class NotificationPreferencesDto {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  inAppNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}