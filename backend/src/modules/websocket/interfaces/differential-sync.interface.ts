
export interface VectorClock {
  clientId: string;
  versions: Map<string, number>;
  timestamp: number;
  lamportCounter: number;
  nodeId: string;
}

export interface StateVersion {
  version: string;
  timestamp: number;
  description?: string;
  vectorClock?: VectorClock;
}

export interface StateChange {
  field: string;
  oldValue?: any;
  newValue?: any;
  changeType: 'create' | 'update' | 'delete';
  timestamp: number;
}

export interface StateDelta {
  entityType: string;
  entityId: string;
  changes: StateChange[];
  vectorClock: VectorClock;
  lamportClock?: LamportClock;
  timestamp: number;
}

export interface SyncRequest {
  clientId: string;
  entityType: string;
  entityId?: string;
  lastKnownVectorClock?: VectorClock;
  clientLamportClock?: LamportClock;
  maxDeltaSize?: number;
  includeQualityMetrics?: boolean;
}

export interface SyncResponse {
  clientId: string;
  entityType: string;
  deltas: StateDelta[];
  currentVectorClock?: VectorClock;
  serverLamportClock?: LamportClock;
  qualityMetrics?: QualityMetrics;
  bandwidthValidation?: BandwidthValidationResult;
  timestamp: number;
}

export enum ConflictStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  FIRST_WRITE_WINS = 'first_write_wins',
  MERGE = 'merge',
  MANUAL = 'manual'
}

export interface ConflictResolution {
  conflictType: string;
  resolution: ConflictStrategy;
  mergedState: any;
  reasoning: string;
  timestamp: number;
}

export enum SyncStrategy {
  DIFFERENTIAL = 'differential',
  FULL = 'full',
  HYBRID = 'hybrid',
  EVENT_DRIVEN = 'event_driven'
}

export interface BandwidthValidationResult {
  isValid: boolean;
  actualReduction: number;
  targetReduction: number;
  fullSize: number;
  deltaSize: number;
  timestamp: number;
}

export interface QualityMetrics {
  clientId: string;
  avgLatency: number;
  packetLoss: number;
  jitter: number;
  bandwidthUtilization: number;
  connectionStability: number;
  qualityScore: number; // 0-100
  lastUpdated: Date;
  usingPollingFallback: boolean;
  fallbackReasons: string[];
  reconnectionAttempts: number;
  uptime: number;
  qualityScoreBreakdown: QualityScoreBreakdown;
}

export interface QualityScoreBreakdown {
  latencyScore: number;
  latencyWeight: number;
  packetLossScore: number;
  packetLossWeight: number;
  jitterScore: number;
  jitterWeight: number;
  stabilityScore: number;
  stabilityWeight: number;
  overallScore: number;
}

export interface AdaptiveThresholds {
  latencyThreshold: number;
  packetLossThreshold: number;
  jitterThreshold: number;
  stabilityThreshold: number;
  fallbackThreshold: number;
  recoveryThreshold: number;
  adaptivePingInterval: {
    min: number;
    max: number;
    current: number;
  };
}

export interface ConnectionQualityAlert {
  clientId: string;
  alertType: 'latency_spike' | 'packet_loss' | 'connection_unstable' | 'fallback_activated' | 'quality_degraded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: Partial<QualityMetrics>;
  timestamp: Date;
  resolved: boolean;
}

export interface BandwidthMetrics {
  clientId: string;
  fullSize: number;
  deltaSize: number;
  reduction: number;
  timestamp: number;
  entityType?: string;
}

export interface SyncPerformanceMetrics {
  clientId: string;
  syncDuration: number;
  deltaCount: number;
  bytesTransferred: number;
  compressionRatio: number;
  connectionQuality?: QualityMetrics;
  timestamp: number;
}

export interface ConnectionHealthMetrics {
  totalConnections: number;
  activeConnections: number;
  averageQualityScore: number;
  connectionsInFallback: number;
  averageLatency: number;
  packetLossRate: number;
  systemLoad: number;
  memoryUsage: number;
  uptime: number;
}

export interface PollingFallbackConfig {
  enabled: boolean;
  interval: number;
  maxRetries: number;
  backoffMultiplier: number;
  qualityThreshold: number;
  autoRecovery: boolean;
  recoveryCheckInterval: number;
}

export interface MonitoringConfig {
  pingInterval: number;
  healthCheckInterval: number;
  metricsRetentionPeriod: number;
  alertThresholds: {
    latencyCritical: number;
    latencyWarning: number;
    packetLossCritical: number;
    packetLossWarning: number;
    qualityScoreCritical: number;
    qualityScoreWarning: number;
  };
  adaptiveMonitoring: {
    enabled: boolean;
    qualityBasedAdjustment: boolean;
    loadBasedAdjustment: boolean;
  };
}

export interface ConnectionEvent {
  clientId: string;
  eventType: 'connect' | 'disconnect' | 'latency_spike' | 'packet_loss' | 'recovery' | 'fallback_activated';
  timestamp: Date | number;
  metrics: Partial<QualityMetrics>;
  reason?: string;
}

export interface ConnectionQualityMetrics {
  clientId: string;
  avgLatency: number;
  packetLoss: number;
  jitter: number;
  bandwidthUtilization: number;
  connectionStability: number;
  qualityScore: number;
  lastUpdated: Date;
  usingPollingFallback: boolean;
  fallbackReasons: string[];
  reconnectionAttempts: number;
  uptime: number;
}

export interface LamportClock {
  counter: number;
  nodeId: string;
  timestamp: number;
}
