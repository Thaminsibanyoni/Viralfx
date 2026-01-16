import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIP } from 'class-validator';

export class BrokerLoginDto {
  @ApiProperty({
    description: 'Broker email address',
    example: 'broker@broker.com'
  })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Broker password',
    example: '1234'
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'Client IP address for security tracking',
    example: '192.168.1.1',
    required: false
  })
  @IsOptional()
  @IsIP()
  clientIp?: string;

  @ApiProperty({
    description: 'User agent string',
    example: 'Mozilla/5.0...',
    required: false
  })
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class BrokerRefreshDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class BrokerChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: '1234'
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'New password',
    example: 'newPassword123'
  })
  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
