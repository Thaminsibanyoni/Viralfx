import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';
// User entity import removed - using Prisma directly;

export class CreateUserDto {
  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com'
  })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description: 'Password',
    example: 'securePassword123',
    minLength: 8,
    maxLength: 128
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({
    description: 'First name',
    example: 'John',
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Doe',
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Username',
    example: 'johndoe',
    minLength: 3,
    maxLength: 30
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Transform(({ value }) => value?.toLowerCase().trim())
  username?: string;

  @ApiPropertyOptional({
    description: 'Phone number in international format',
    example: '+27123456789',
    maxLength: 20
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Date of birth',
    example: '1990-01-01'
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiPropertyOptional({
    description: 'Country code',
    example: 'ZA',
    minLength: 2,
    maxLength: 2
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase().trim())
  country?: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
    example: UserRole.USER
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Whether the user is active',
    example: true
  })
  @IsOptional()
  isActive?: boolean;
}

export class AdminCreateUserDto extends CreateUserDto {
  @ApiPropertyOptional({
    description: 'User role (admin can set any role)',
    enum: UserRole,
    example: UserRole.USER
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Whether the user email is verified',
    example: false
  })
  @IsOptional()
  isEmailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'KYC verification status',
    enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'],
    example: 'NOT_SUBMITTED'
  })
  @IsOptional()
  @IsEnum(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'])
  kycStatus?: string;

  @ApiPropertyOptional({
    description: 'Admin notes about the user',
    example: 'Created via admin panel for testing purposes',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNotes?: string;
}