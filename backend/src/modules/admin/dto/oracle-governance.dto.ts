import { IsEnum, IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OracleSource {
  TWITTER = 'twitter',
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
  REDDIT = 'reddit',
  YOUTUBE = 'youtube',
}

export enum OracleHealthStatus {
  ACTIVE = 'active',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
}

export enum SignalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
}

export class ApproveSignalDto {
  @ApiProperty({ description: 'Signal ID' })
  @IsString()
  signalId: string;

  @ApiProperty({ description: 'Approval notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectSignalDto {
  @ApiProperty({ description: 'Signal ID' })
  @IsString()
  signalId: string;

  @ApiProperty({ description: 'Rejection reason' })
  @IsString()
  reason: string;
}

export class UpdateOracleHealthDto {
  @ApiProperty({ description: 'Oracle source', enum: OracleSource })
  @IsEnum(OracleSource)
  source: OracleSource;

  @ApiProperty({ description: 'Health status', enum: OracleHealthStatus })
  @IsEnum(OracleHealthStatus)
  status: OracleHealthStatus;

  @ApiProperty({ description: 'Confidence score (0-100)', required: false })
  @IsOptional()
  @IsNumber()
  confidenceScore?: number;

  @ApiProperty({ description: 'Deception risk % (0-100)', required: false })
  @IsOptional()
  @IsNumber()
  deceptionRisk?: number;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetOracleModeDto {
  @ApiProperty({ description: 'Oracle source', enum: OracleSource })
  @IsEnum(OracleSource)
  source: OracleSource;

  @ApiProperty({ description: 'Mode (live, simulated, seed)', enum: ['LIVE', 'SIMULATED', 'SEED'] })
  @IsEnum(['LIVE', 'SIMULATED', 'SEED'])
  mode: 'LIVE' | 'SIMULATED' | 'SEED';
}

export class UpdateSignalConfidenceDto {
  @ApiProperty({ description: 'Signal ID' })
  @IsString()
  signalId: string;

  @ApiProperty({ description: 'Confidence score (0-100)' })
  @IsNumber()
  confidenceScore: number;

  @ApiProperty({ description: 'Reason for adjustment', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class FlagSignalDto {
  @ApiProperty({ description: 'Signal ID' })
  @IsString()
  signalId: string;

  @ApiProperty({ description: 'Flag reason' })
  @IsString()
  reason: string;

  @ApiProperty({ description: 'Requires review', required: false })
  @IsOptional()
  @IsBoolean()
  requiresReview?: boolean;
}
