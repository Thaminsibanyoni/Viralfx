import { IsNumber, IsBoolean, IsOptional, IsString, IsDate, IsObject, ValidateNested, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for individual quality score breakdown components
 */
export class QualityScoreBreakdownDto {
  @IsNumber()
  latencyScore: number;

  @IsNumber()
  latencyWeight: number;

  @IsNumber()
  packetLossScore: number;

  @IsNumber()
  packetLossWeight: number;

  @IsNumber()
  jitterScore: number;

  @IsNumber()
  jitterWeight: number;

  @IsNumber()
  stabilityScore: number;

  @IsNumber()
  stabilityWeight: number;
}

/**
 * DTO for connection quality metrics
 */
export class QualityMetricsDto {
  @IsNumber()
  qualityScore: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => QualityScoreBreakdownDto)
  qualityScoreBreakdown: QualityScoreBreakdownDto;

  @IsNumber()
  latency: number;

  @IsNumber()
  packetLoss: number;

  @IsNumber()
  jitter: number;

  @IsNumber()
  connectionStability: number;

  @IsBoolean()
  usingPollingFallback: boolean;

  @IsBoolean()
  meetsLatencyTarget: boolean;

  @IsNumber()
  timestamp: number;
}

/**
 * DTO for Lamport clock implementation
 */
export class LamportClockDto {
  @IsNumber()
  counter: number;

  @IsString()
  nodeId: string;

  @IsNumber()
  timestamp: number;
}

/**
 * DTO for bandwidth validation results
 */
export class BandwidthValidationDto {
  @IsBoolean()
  isValid: boolean;

  @IsNumber()
  actualReduction: number;

  @IsNumber()
  targetReduction: number;

  @IsNumber()
  fullSize: number;

  @IsNumber()
  deltaSize: number;

  @IsNumber()
  timestamp: number;
}

/**
 * DTO for vector clock with Lamport counter integration
 */
export class VectorClockDto {
  @IsString()
  clientId: string;

  @IsObject()
  versions: Record<string, number>;

  @IsNumber()
  timestamp: number;

  @IsNumber()
  lamportCounter: number;

  @IsString()
  nodeId: string;
}

/**
 * DTO for state version information
 */
export class StateVersionDto {
  @IsString()
  version: string;

  @IsNumber()
  timestamp: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VectorClockDto)
  vectorClock?: VectorClockDto;
}

/**
 * DTO for individual state changes
 */
export class StateChangeDto {
  @IsString()
  field: string;

  @IsOptional()
  oldValue?: any;

  @IsOptional()
  newValue?: any;

  @IsString()
  changeType: 'create' | 'update' | 'delete';

  @IsNumber()
  timestamp: number;
}

/**
 * Enhanced StateDeltaDto with Lamport clock support
 */
export class StateDeltaDto {
  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => VectorClockDto)
  vectorClock: VectorClockDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => LamportClockDto)
  lamportClock: LamportClockDto;

  @IsDefined()
  changes: StateChangeDto[];

  @IsNumber()
  timestamp: number;
}

/**
 * Enhanced SyncStateDto with optional Lamport clock
 */
export class SyncStateDto {
  @IsString()
  clientId: string;

  @IsString()
  entityType: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LamportClockDto)
  lamportClock?: LamportClockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => VectorClockDto)
  lastKnownVectorClock?: VectorClockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => QualityMetricsDto)
  connectionQuality?: QualityMetricsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BandwidthValidationDto)
  bandwidthValidation?: BandwidthValidationDto;

  @IsNumber()
  timestamp: number;
}

/**
 * DTO for sync request messages
 */
export class SyncRequestDto {
  @IsString()
  clientId: string;

  @IsString()
  entityType: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VectorClockDto)
  lastKnownVectorClock?: VectorClockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LamportClockDto)
  clientLamportClock?: LamportClockDto;

  @IsOptional()
  @IsNumber()
  maxDeltaSize?: number;

  @IsOptional()
  @IsBoolean()
  includeQualityMetrics?: boolean;
}

/**
 * DTO for sync response messages
 */
export class SyncResponseDto {
  @IsString()
  clientId: string;

  @IsString()
  entityType: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => StateDeltaDto)
  deltas: StateDeltaDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => VectorClockDto)
  currentVectorClock?: VectorClockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LamportClockDto)
  serverLamportClock?: LamportClockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => QualityMetricsDto)
  qualityMetrics?: QualityMetricsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BandwidthValidationDto)
  bandwidthValidation?: BandwidthValidationDto;

  @IsNumber()
  timestamp: number;
}

/**
 * DTO for conflict resolution strategy
 */
export enum ConflictStrategyDto {
  LAST_WRITE_WINS = 'last_write_wins',
  FIRST_WRITE_WINS = 'first_write_wins',
  MERGE = 'merge',
  MANUAL = 'manual'
}

/**
 * DTO for conflict resolution results
 */
export class ConflictResolutionDto {
  @IsString()
  conflictType: string;

  @IsDefined()
  @ValidateNested()
  strategy: ConflictStrategyDto;

  @IsObject()
  mergedState: any;

  @IsString()
  reasoning: string;

  @IsNumber()
  timestamp: number;
}

/**
 * DTO for sync strategy configuration
 */
export enum SyncStrategyDto {
  DIFFERENTIAL = 'differential',
  FULL = 'full',
  HYBRID = 'hybrid',
  EVENT_DRIVEN = 'event_driven'
}

/**
 * DTO for bandwidth metrics tracking
 */
export class BandwidthMetricsDto {
  @IsNumber()
  fullSize: number;

  @IsNumber()
  deltaSize: number;

  @IsNumber()
  reduction: number;

  @IsNumber()
  timestamp: number;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;
}

/**
 * DTO for sync performance metrics
 */
export class SyncPerformanceMetricsDto {
  @IsString()
  clientId: string;

  @IsNumber()
  syncDuration: number;

  @IsNumber()
  deltaCount: number;

  @IsNumber()
  bytesTransferred: number;

  @IsNumber()
  compressionRatio: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => QualityMetricsDto)
  connectionQuality?: QualityMetricsDto;

  @IsNumber()
  timestamp: number;
}
