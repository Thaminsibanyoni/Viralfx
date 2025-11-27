import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsObject,
  IsIP,
  ArrayNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateKeyDto {
  @ApiProperty({
    description: 'Plan ID to subscribe to',
    example: 'uuid-of-plan',
  })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({
    description: 'Friendly label for the API key',
    example: 'Production API Key',
    required: false,
  })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({
    description: 'IP whitelist (CIDR notation)',
    example: ['192.168.1.1/32', '10.0.0.0/8'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ipWhitelist?: string[];

  @ApiProperty({
    description: 'Whether this is a sandbox key',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isSandbox?: boolean;

  @ApiProperty({
    description: 'Additional metadata',
    example: { department: 'Engineering', project: 'Mobile App' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateKeyDto {
  @ApiProperty({
    description: 'Friendly label for the API key',
    example: 'Updated Production Key',
    required: false,
  })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({
    description: 'IP whitelist (CIDR notation)',
    example: ['192.168.1.1/32', '10.0.0.0/8', '203.0.113.0/24'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ipWhitelist?: string[];

  @ApiProperty({
    description: 'Additional metadata',
    example: { department: 'Product', project: 'Dashboard' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

// Custom validator for CIDR notation
export const IsCIDR = (property?: string) => {
  return (object: any, propertyName: string) => {
    const value = object[propertyName];
    if (value && Array.isArray(value)) {
      for (const ip of value) {
        // Basic CIDR validation - more sophisticated validation can be added
        if (!/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/.test(ip)) {
          throw new Error(`${property || propertyName} must contain valid CIDR notation IP addresses`);
        }
      }
    }
  };
};