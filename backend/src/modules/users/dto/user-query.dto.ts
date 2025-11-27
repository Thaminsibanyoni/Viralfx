import { IsOptional, IsString, IsEnum, IsInt, Min, Max, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export enum KYCStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  KYC_REVIEWER = 'KYC_REVIEWER',
  SUPPORT = 'SUPPORT',
}

export enum SortByField {
  CREATED_AT = 'createdAt',
  LAST_LOGIN_AT = 'lastLoginAt',
  USERNAME = 'username',
  EMAIL = 'email',
  KYC_STATUS = 'kycStatus',
  IS_ACTIVE = 'isActive',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class UserQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Search query to filter users by username or email',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by user status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Filter by KYC status',
    enum: KYCStatus,
    example: KYCStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(KYCStatus)
  kycStatus?: KYCStatus;

  @ApiPropertyOptional({
    description: 'Filter by user role',
    enum: UserRole,
    example: UserRole.USER,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: SortByField,
    example: SortByField.CREATED_AT,
    default: SortByField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortByField)
  sortBy?: SortByField = SortByField.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    example: SortOrder.DESC,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Filter by country code',
    example: 'ZA',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Transform(({ value }) => value?.toUpperCase().trim())
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter users created after this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  createdAfter?: Date;

  @ApiPropertyOptional({
    description: 'Filter users created before this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: Date;

  @ApiPropertyOptional({
    description: 'Filter users who logged in after this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  lastLoginAfter?: Date;

  @ApiPropertyOptional({
    description: 'Filter users who logged in before this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  lastLoginBefore?: Date;

  @ApiPropertyOptional({
    description: 'Filter verified/unverified users',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Filter active/inactive users',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}