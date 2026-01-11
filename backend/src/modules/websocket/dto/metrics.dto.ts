import { IsNumber, IsString, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for per-client error statistics
 */
export class ErrorRateDto {
  @IsString()
  clientId: string;

  @IsNumber()
  errorRate: number;

  @IsNumber()
  totalOperations: number;

  @IsNumber()
  errorCount: number;

  @IsNumber()
  lastSyncTime: number;
}

/**
 * DTO for client bandwidth utilization details
 */
export class ClientBandwidthDto {
  @IsString()
  clientId: string;

  @IsObject()
  utilization: {
    bytesPerSecond: number;
    kbps: number;
    utilizationPercentage: number;
    totalBytesTransferred: number;
    totalBytesSent: number;
    totalBytesReceived: number;
    messageCount: number;
    connectionDuration: number;
  };
}

/**
 * DTO for system-level bandwidth metrics
 */
export class SystemBandwidthDto {
  @IsNumber()
  totalBytesTransferred: number;

  @IsNumber()
  totalBytesSent: number;

  @IsNumber()
  totalBytesReceived: number;

  @IsNumber()
  averageUtilization: number;

  @IsNumber()
  totalConnections: number;

  @IsNumber()
  totalMessages: number;
}

/**
 * DTO for comprehensive bandwidth metrics
 */
export class BandwidthMetricsDto {
  @ValidateNested()
  @Type(() => SystemBandwidthDto)
  system: SystemBandwidthDto;

  @ValidateNested()
  @Type(() => ClientBandwidthDto)
  clients: ClientBandwidthDto[];
}

/**
 * DTO for quality metrics summary
 */
export class QualityMetricsSummaryDto {
  @IsNumber()
  averageScore: number;

  @IsNumber()
  sub100msPercentage: number;
}

/**
 * Main response DTO for WebSocket metrics endpoint
 */
export class WebSocketMetricsResponseDto {
  @ValidateNested()
  @Type(() => BandwidthMetricsDto)
  bandwidth: BandwidthMetricsDto;

  @ValidateNested()
  @Type(() => ErrorRateDto)
  errorRates: ErrorRateDto[];

  @ValidateNested()
  @Type(() => QualityMetricsSummaryDto)
  quality: QualityMetricsSummaryDto;

  @IsNumber()
  timestamp: number;
}
