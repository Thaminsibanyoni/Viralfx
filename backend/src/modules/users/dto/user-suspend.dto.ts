import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
// User entity import removed - using Prisma directly;

export enum SuspensionReason {
  FRAUD = "FRAUD",
  VIOLATION = "VIOLATION",
  SPAM = "SPAM",
  ABUSE = "ABUSE",
  COMPLIANCE = "COMPLIANCE",
  SECURITY = "SECURITY",
  OTHER = "OTHER"
}

export class SuspendUserDto {
  @ApiProperty({
    description: "Reason for suspension",
    enum: SuspensionReason,
    example: SuspensionReason.VIOLATION
  })
  @IsEnum(SuspensionReason)
  reason: SuspensionReason;

  @ApiPropertyOptional({
    description: "Detailed explanation for suspension",
    example: "User violated community guidelines multiple times",
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: "Duration of suspension in days (null for permanent)",
    example: 30,
    minimum: 1,
    maximum: 365
  })
  @IsOptional()
  @IsString()
  durationDays?: number;
}