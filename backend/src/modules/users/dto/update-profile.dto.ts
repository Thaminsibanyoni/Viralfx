import { IsOptional, IsString, IsEmail, IsDateString, Length, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'First name of the user',
    example: 'John',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name of the user',
    example: 'Doe',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiPropertyOptional({
    description: 'Username of the user',
    example: 'johndoe',
    minLength: 3,
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Transform(({ value }) => value?.toLowerCase().trim())
  username?: string;

  @ApiPropertyOptional({
    description: 'Phone number in international format',
    example: '+27123456789',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @Length(10, 20)
  @Transform(({ value }) => value?.trim())
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Date of birth of the user',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiPropertyOptional({
    description: 'Country code of the user',
    example: 'ZA',
    minLength: 2,
    maxLength: 2,
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Transform(({ value }) => value?.toUpperCase().trim())
  country?: string;

  @ApiPropertyOptional({
    description: 'Bio or description of the user',
    example: 'Passionate trader and tech enthusiast',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  bio?: string;

  @ApiPropertyOptional({
    description: 'Avatar URL of the user',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Time zone of the user',
    example: 'Africa/Johannesburg',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => value?.trim())
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Language preference of the user',
    example: 'en',
    minLength: 2,
    maxLength: 5,
  })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  @Transform(({ value }) => value?.toLowerCase().trim())
  language?: string;

  @ApiPropertyOptional({
    description: 'User preferences as JSON object',
    example: {
      notifications: {
        email: true,
        push: false,
        sms: false,
      },
      marketing: {
        newsletter: true,
        promotions: false,
      },
    },
  })
  @IsOptional()
  preferences?: Record<string, any>;
}