/**
 * Comprehensive TypeScript types for differential sync system
 * Mirrors backend interfaces with proper serialization/deserialization support
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Conflict resolution strategies for handling concurrent updates
 */
export enum ConflictStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  FIRST_WRITE_WINS = 'first_write_wins',
  MERGE = 'merge',
  MANUAL = 'manual'
}

/**
 * Sync strategy configuration options
 */
export enum SyncStrategy {
  DIFFERENTIAL = 'differential',
  FULL = 'full',
  HYBRID = 'hybrid',
  EVENT_DRIVEN = 'event_driven'
}

/**
 * Connection event types for monitoring
 */
export enum ConnectionEventType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  LATENCY_SPIKE = 'latency_spike',
  PACKET_LOSS = 'packet_loss',
  RECOVERY = 'recovery',
  FALLBACK_ACTIVATED = 'fallback_activated'
}

/**
 * Connection quality alert types
 */
export enum AlertType {
  LATENCY_SPIKE = 'latency_spike',
  PACKET_LOSS = 'packet_loss',
  CONNECTION_UNSTABLE = 'connection_unstable',
  FALLBACK_ACTIVATED = 'fallback_activated',
  QUALITY_DEGRADED = 'quality_degraded'
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Vector clock with proper Map support for version tracking
 * Mirrors backend VectorClock interface with frontend-friendly serialization
 */
export interface VectorClock {
  clientId: string;
  versions: Map<string, number>;
  timestamp: number;
  lamportCounter: number;
  nodeId: string;
}

/**
 * Serialized version of VectorClock for JSON transmission
 */
export interface SerializedVectorClock {
  clientId: string;
  versions: Record<string, number>;
  timestamp: number;
  lamportCounter: number;
  nodeId: string;
}

/**
 * Lamport clock implementation for distributed event ordering
 */
export interface LamportClock {
  counter: number;
  nodeId: string;
  timestamp: number;
}

/**
 * State version information with optional vector clock
 */
export interface StateVersion {
  version: string;
  timestamp: number;
  description?: string;
  vectorClock?: VectorClock;
}

/**
 * Individual state change information with comprehensive type safety
 */
export interface StateChange {
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
  changeType: 'create' | 'update' | 'delete';
  timestamp: number;
}

/**
 * State delta with vector clock and comprehensive metadata
 */
export interface StateDelta {
  entityType: string;
  entityId: string;
  changes: StateChange[];
  vectorClock: VectorClock;
  lamportClock?: LamportClock;
  timestamp: number;
}

/**
 * Serialized version of StateDelta for JSON transmission
 */
export interface SerializedStateDelta {
  entityType: string;
  entityId: string;
  changes: StateChange[];
  vectorClock: SerializedVectorClock;
  lamportClock?: LamportClock;
  timestamp: number;
}

/**
 * Sync request from client with enhanced options
 * Note: lastKnownVectorClock uses SerializedVectorClock for wire format transmission
 */
export interface SyncRequest {
  clientId: string;
  entityType: string;
  entityId?: string;
  lastKnownVectorClock?: SerializedVectorClock;
  clientLamportClock?: LamportClock;
  maxDeltaSize?: number;
  includeQualityMetrics?: boolean;
}

/**
 * Sync response from server with comprehensive metadata
 */
export interface SyncResponse {
  clientId: string;
  entityType: string;
  deltas: StateDelta[];
  currentVectorClock?: VectorClock;
  serverLamportClock?: LamportClock;
  qualityMetrics?: ConnectionQualityMetrics;
  bandwidthValidation?: BandwidthValidationResult;
  timestamp: number;
}

// ============================================================================
// CONFLICT RESOLUTION INTERFACES
// ============================================================================

/**
 * Conflict resolution results with detailed information
 */
export interface ConflictResolution {
  conflictType: string;
  resolution: ConflictStrategy;
  mergedState: unknown;
  reasoning: string;
  timestamp: number;
}

// ============================================================================
// QUALITY AND PERFORMANCE METRICS
// ============================================================================

/**
 * Quality score breakdown for detailed connection assessment
 */
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

/**
 * Connection quality metrics with comprehensive monitoring data
 */
export interface ConnectionQualityMetrics {
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

/**
 * Bandwidth validation results for compression efficiency monitoring
 */
export interface BandwidthValidationResult {
  isValid: boolean;
  actualReduction: number;
  targetReduction: number;
  fullSize: number;
  deltaSize: number;
  timestamp: number;
}

/**
 * Bandwidth metrics for tracking sync efficiency
 */
export interface BandwidthMetrics {
  clientId: string;
  fullSize: number;
  deltaSize: number;
  reduction: number;
  timestamp: number;
  entityType?: string;
}

/**
 * Sync performance metrics for optimization
 */
export interface SyncPerformanceMetrics {
  clientId: string;
  syncDuration: number;
  deltaCount: number;
  bytesTransferred: number;
  compressionRatio: number;
  connectionQuality?: ConnectionQualityMetrics;
  timestamp: number;
}

/**
 * Connection health metrics for system monitoring
 */
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

// ============================================================================
// ADAPTIVE CONFIGURATION INTERFACES
// ============================================================================

/**
 * Adaptive thresholds for dynamic quality adjustment
 */
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

/**
 * Polling fallback configuration for connection degradation handling
 */
export interface PollingFallbackConfig {
  enabled: boolean;
  interval: number;
  maxRetries: number;
  backoffMultiplier: number;
  qualityThreshold: number;
  autoRecovery: boolean;
  recoveryCheckInterval: number;
}

/**
 * Monitoring configuration for quality assessment
 */
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

/**
 * Connection event for monitoring and debugging
 */
export interface ConnectionEvent {
  clientId: string;
  eventType: ConnectionEventType;
  timestamp: Date | number;
  metrics: Partial<ConnectionQualityMetrics>;
  reason?: string;
}

/**
 * Connection quality alert for proactive monitoring
 */
export interface ConnectionQualityAlert {
  clientId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  metrics: Partial<ConnectionQualityMetrics>;
  timestamp: Date;
  resolved: boolean;
}

// ============================================================================
// SERIALIZATION UTILITIES
// ============================================================================

/**
 * Serialization utilities for Map-based vector clocks
 */
export class VectorClockSerializer {
  /**
   * Convert VectorClock with Map to serializable format
   */
  static serialize(clock: VectorClock): SerializedVectorClock {
    return {
      clientId: clock.clientId,
      versions: Object.fromEntries(clock.versions),
      timestamp: clock.timestamp,
      lamportCounter: clock.lamportCounter,
      nodeId: clock.nodeId
    };
  }

  /**
   * Convert serialized format back to VectorClock with Map
   */
  static deserialize(data: SerializedVectorClock | unknown): VectorClock {
    if (!this.isValidSerializedData(data)) {
      throw new Error('Invalid serialized vector clock data');
    }

    const serialized = data as SerializedVectorClock;
    return {
      clientId: serialized.clientId,
      versions: new Map(Object.entries(serialized.versions)),
      timestamp: serialized.timestamp,
      lamportCounter: serialized.lamportCounter,
      nodeId: serialized.nodeId
    };
  }

  /**
   * Type guard for serialized vector clock data
   */
  private static isValidSerializedData(data: unknown): data is SerializedVectorClock {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const obj = data as Record<string, unknown>;
    return (
      typeof obj.clientId === 'string' &&
      typeof obj.versions === 'object' &&
      obj.versions !== null &&
      typeof obj.timestamp === 'number' &&
      typeof obj.lamportCounter === 'number' &&
      typeof obj.nodeId === 'string'
    );
  }
}

/**
 * Serialization utilities for StateDelta objects
 */
export class StateDeltaSerializer {
  /**
   * Convert StateDelta to serializable format
   */
  static serialize(delta: StateDelta): SerializedStateDelta {
    return {
      entityType: delta.entityType,
      entityId: delta.entityId,
      changes: delta.changes,
      vectorClock: VectorClockSerializer.serialize(delta.vectorClock),
      lamportClock: delta.lamportClock,
      timestamp: delta.timestamp
    };
  }

  /**
   * Convert serialized format back to StateDelta
   */
  static deserialize(data: SerializedStateDelta | unknown): StateDelta {
    if (!this.isValidSerializedData(data)) {
      throw new Error('Invalid serialized state delta data');
    }

    const serialized = data as SerializedStateDelta;
    return {
      entityType: serialized.entityType,
      entityId: serialized.entityId,
      changes: serialized.changes,
      vectorClock: VectorClockSerializer.deserialize(serialized.vectorClock),
      lamportClock: serialized.lamportClock,
      timestamp: serialized.timestamp
    };
  }

  /**
   * Type guard for serialized state delta data
   */
  private static isValidSerializedData(data: unknown): data is SerializedStateDelta {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const obj = data as Record<string, unknown>;
    return (
      typeof obj.entityType === 'string' &&
      typeof obj.entityId === 'string' &&
      Array.isArray(obj.changes) &&
      typeof obj.vectorClock === 'object' &&
      obj.vectorClock !== null &&
      typeof obj.timestamp === 'number'
    );
  }
}

// ============================================================================
// TYPE GUARDS AND VALIDATION UTILITIES
// ============================================================================

/**
 * Type guard for VectorClock
 */
export function isValidVectorClock(obj: unknown): obj is VectorClock {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const clock = obj as Record<string, unknown>;
  return (
    typeof clock.clientId === 'string' &&
    clock.versions instanceof Map &&
    typeof clock.timestamp === 'number' &&
    typeof clock.lamportCounter === 'number' &&
    typeof clock.nodeId === 'string' &&
    clock.timestamp > 0 &&
    clock.lamportCounter >= 0
  );
}

/**
 * Type guard for LamportClock
 */
export function isValidLamportClock(obj: unknown): obj is LamportClock {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const clock = obj as Record<string, unknown>;
  return (
    typeof clock.counter === 'number' &&
    typeof clock.nodeId === 'string' &&
    typeof clock.timestamp === 'number' &&
    clock.counter >= 0 &&
    clock.timestamp > 0
  );
}

/**
 * Type guard for StateChange
 */
export function isValidStateChange(obj: unknown): obj is StateChange {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const change = obj as Record<string, unknown>;
  return (
    typeof change.field === 'string' &&
    typeof change.changeType === 'string' &&
    ['create', 'update', 'delete'].includes(change.changeType) &&
    typeof change.timestamp === 'number' &&
    change.timestamp > 0
  );
}

/**
 * Type guard for StateDelta
 */
export function isValidStateDelta(obj: unknown): obj is StateDelta {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const delta = obj as Record<string, unknown>;
  return (
    typeof delta.entityType === 'string' &&
    typeof delta.entityId === 'string' &&
    Array.isArray(delta.changes) &&
    isValidVectorClock(delta.vectorClock) &&
    typeof delta.timestamp === 'number' &&
    delta.changes.every(isValidStateChange)
  );
}

/**
 * Type guard for SyncRequest
 */
export function isValidSyncRequest(obj: unknown): obj is SyncRequest {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const request = obj as Record<string, unknown>;
  return (
    typeof request.clientId === 'string' &&
    typeof request.entityType === 'string' &&
    (request.entityId === undefined || typeof request.entityId === 'string') &&
    (request.lastKnownVectorClock === undefined || isValidVectorClock(request.lastKnownVectorClock)) &&
    (request.clientLamportClock === undefined || isValidLamportClock(request.clientLamportClock)) &&
    (request.maxDeltaSize === undefined || typeof request.maxDeltaSize === 'number') &&
    (request.includeQualityMetrics === undefined || typeof request.includeQualityMetrics === 'boolean')
  );
}

/**
 * Type guard for SyncResponse
 */
export function isValidSyncResponse(obj: unknown): obj is SyncResponse {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const response = obj as Record<string, unknown>;
  return (
    typeof response.clientId === 'string' &&
    typeof response.entityType === 'string' &&
    Array.isArray(response.deltas) &&
    response.deltas.every(isValidStateDelta) &&
    (response.currentVectorClock === undefined || isValidVectorClock(response.currentVectorClock)) &&
    (response.serverLamportClock === undefined || isValidLamportClock(response.serverLamportClock)) &&
    typeof response.timestamp === 'number'
  );
}

// ============================================================================
// VECTOR CLOCK UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an initial vector clock for a new client
 */
export function createInitialVectorClock(clientId: string): VectorClock {
  return {
    clientId,
    versions: new Map<string, number>(),
    timestamp: Date.now(),
    lamportCounter: 0,
    nodeId: clientId
  };
}

/**
 * Create an initial Lamport clock for a new client
 */
export function createInitialLamportClock(clientId: string): LamportClock {
  return {
    counter: 0,
    nodeId: clientId,
    timestamp: Date.now()
  };
}

/**
 * Increment vector clock version for a specific entity
 */
export function incrementVectorClockVersion(
  clock: VectorClock,
  entityId: string,
  increment: number = 1
): VectorClock {
  const newVersions = new Map(clock.versions);
  const currentVersion = newVersions.get(entityId) || 0;
  newVersions.set(entityId, currentVersion + increment);

  return {
    ...clock,
    versions: newVersions,
    timestamp: Date.now(),
    lamportCounter: clock.lamportCounter + increment
  };
}

/**
 * Merge two vector clocks using element-wise maximum
 */
export function mergeVectorClocks(clock1: VectorClock, clock2: VectorClock): VectorClock {
  const mergedVersions = new Map<string, number>();

  // Add all versions from clock1
  for (const [key, value] of clock1.versions) {
    mergedVersions.set(key, value);
  }

  // Merge with clock2 using element-wise maximum
  for (const [key, value] of clock2.versions) {
    const currentValue = mergedVersions.get(key) || 0;
    mergedVersions.set(key, Math.max(currentValue, value));
  }

  return {
    clientId: clock1.clientId,
    versions: mergedVersions,
    timestamp: Date.now(),
    lamportCounter: Math.max(clock1.lamportCounter, clock2.lamportCounter) + 1,
    nodeId: clock1.nodeId
  };
}

/**
 * Compare two vector clocks for causal relationship
 * @returns -1 if clock1 < clock2, 0 if concurrent, 1 if clock1 > clock2
 */
export function compareVectorClocks(clock1: VectorClock, clock2: VectorClock): -1 | 0 | 1 {
  let clock1Greater = false;
  let clock2Greater = false;

  const allKeys = new Set([...clock1.versions.keys(), ...clock2.versions.keys()]);

  for (const key of allKeys) {
    const value1 = clock1.versions.get(key) || 0;
    const value2 = clock2.versions.get(key) || 0;

    if (value1 > value2) {
      clock1Greater = true;
    } else if (value2 > value1) {
      clock2Greater = true;
    }
  }

  if (clock1Greater && !clock2Greater) return 1;
  if (clock2Greater && !clock1Greater) return -1;
  return 0; // Concurrent or equal
}

/**
 * Check if vector clock includes the specified version
 */
export function vectorClockIncludesVersion(
  clock: VectorClock,
  entityId: string,
  version: number
): boolean {
  const entityVersion = clock.versions.get(entityId) || 0;
  return entityVersion >= version;
}

// ============================================================================
// LAMPORT CLOCK UTILITY FUNCTIONS
// ============================================================================

/**
 * Increment Lamport clock
 */
export function incrementLamportClock(clock: LamportClock): LamportClock {
  return {
    ...clock,
    counter: clock.counter + 1,
    timestamp: Date.now()
  };
}

/**
 * Merge Lamport clocks using max+1 rule
 */
export function mergeLamportClocks(localClock: LamportClock, receivedClock: LamportClock): LamportClock {
  const maxCounter = Math.max(localClock.counter, receivedClock.counter);
  return {
    nodeId: localClock.nodeId,
    counter: maxCounter + 1,
    timestamp: Date.now()
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Base error class for differential sync operations
 */
export class DifferentialSyncError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DifferentialSyncError';
  }
}

/**
 * Error for vector clock validation failures
 */
export class VectorClockError extends DifferentialSyncError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VECTOR_CLOCK_ERROR', details);
    this.name = 'VectorClockError';
  }
}

/**
 * Error for serialization/deserialization failures
 */
export class SerializationError extends DifferentialSyncError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SERIALIZATION_ERROR', details);
    this.name = 'SerializationError';
  }
}

/**
 * Error for conflict resolution failures
 */
export class ConflictResolutionError extends DifferentialSyncError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT_RESOLUTION_ERROR', details);
    this.name = 'ConflictResolutionError';
  }
}

/**
 * Error for sync operation failures
 */
export class SyncOperationError extends DifferentialSyncError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SYNC_OPERATION_ERROR', details);
    this.name = 'SyncOperationError';
  }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Default configurations for differential sync
 */
export const _DEFAULT_DIFFERENTIAL_SYNC_CONFIG = {
  maxRetries: 5,
  retryDelay: 1000,
  maxDeltaSize: 100,
  enableCompression: true,
  conflictResolution: ConflictStrategy.LAST_WRITE_WINS,
  syncStrategy: SyncStrategy.DIFFERENTIAL
} as const;

/**
 * Default polling fallback configuration
 */
export const _DEFAULT_POLLING_FALLBACK_CONFIG: PollingFallbackConfig = {
  enabled: true,
  interval: 5000,
  maxRetries: 10,
  backoffMultiplier: 1.5,
  qualityThreshold: 50,
  autoRecovery: true,
  recoveryCheckInterval: 10000
};

/**
 * Default monitoring configuration
 */
export const _DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  pingInterval: 30000,
  healthCheckInterval: 60000,
  metricsRetentionPeriod: 86400000, // 24 hours
  alertThresholds: {
    latencyCritical: 1000,
    latencyWarning: 500,
    packetLossCritical: 0.1,
    packetLossWarning: 0.05,
    qualityScoreCritical: 30,
    qualityScoreWarning: 60
  },
  adaptiveMonitoring: {
    enabled: true,
    qualityBasedAdjustment: true,
    loadBasedAdjustment: true
  }
};

// ============================================================================
// TYPE EXPORTS FOR LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy type aliases for backward compatibility
 * @deprecated Use the new interface names directly
 */
export type QualityMetrics = ConnectionQualityMetrics;
export type BandwidthValidation = BandwidthValidationResult;

// Re-export with original name for compatibility
export const DEFAULT_DIFFERENTIAL_SYNC_CONFIG = _DEFAULT_DIFFERENTIAL_SYNC_CONFIG;
// Re-export with original name for compatibility
export const DEFAULT_POLLING_FALLBACK_CONFIG = _DEFAULT_POLLING_FALLBACK_CONFIG;
// Re-export with original name for compatibility
export const DEFAULT_MONITORING_CONFIG = _DEFAULT_MONITORING_CONFIG;
