import { EventEmitter } from 'eventemitter3';
import {
  QualityMetrics, LamportClock, BandwidthValidation, VectorClock, StateDelta, SyncRequest, SyncResponse, SyncPerformanceMetrics, StateVersion, ConflictStrategy, SyncStrategy, SerializedVectorClock, SerializedStateDelta, VectorClockSerializer, StateDeltaSerializer, isValidVectorClock, isValidLamportClock, isValidStateDelta, isValidSyncResponse, SerializationError, SyncOperationError, DifferentialSyncError, createInitialVectorClock, createInitialLamportClock, mergeLamportClocks, DEFAULT_DIFFERENTIAL_SYNC_CONFIG
} from '../../types/differentialSync';
import { logWarn, logError } from '../../services/logger';

export interface DifferentialSyncClientOptions {
  clientId: string;
  websocketUrl: string;
  entityType?: string;
  entityTypes?: string[];
  syncStrategy?: SyncStrategy;
  maxRetries?: number;
  retryDelay?: number;
  enableCompression?: boolean;
  conflictResolution?: ConflictStrategy;
  autoReconnect?: boolean;
  qualityMonitoring?: boolean;
  connectionTimeout?: number;
}

export interface SyncMetrics extends SyncPerformanceMetrics {
  qualityMetrics?: QualityMetrics;
  bandwidthValidation?: BandwidthValidation;
  sub100msLatencyCount: number;
  totalSyncCount: number;
  averageLatency: number;
  lastSyncTimestamp: number;
}

export default class DifferentialSyncClient extends EventEmitter {
  private clientId: string;
  private websocketUrl: string;
  private entityTypes: Set<string>;
  private options: Required<DifferentialSyncClientOptions>;

  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private qualityMonitoringTimer: NodeJS.Timeout | null = null;

  // Local state tracking
  private localStates = new Map<string, any>();
  private lastKnownVectorClocks = new Map<string, VectorClock>();

  // Enhanced properties for Lamport clocks and quality metrics
  private lamportClock: LamportClock | null = null;
  private qualityMetrics: QualityMetrics | null = null;
  private bandwidthValidation: BandwidthValidation | null = null;

  // Performance tracking
  private syncMetrics: SyncMetrics;
  private pendingSyncs = new Map<string, {
    resolve: (deltas: StateDelta[]) => void;
    reject: (error: Error) => void;
    timestamp: number;
    entityType: string;
    retryCount?: number;
  }>();

  // Event listeners for proper cleanup
  private eventListeners = new Map<string, Set<(data: any) => void>>();

  // Subscription tracking for proper unsubscription
  private subscriptions = new Set<string>();
  private cleanupCallbacks = new Set<() => void>();

  constructor(options: DifferentialSyncClientOptions) {
    super();

    this.clientId = options.clientId;
    this.websocketUrl = options.websocketUrl;

    // Handle entity type configuration
    this.entityTypes = new Set();
    if (options.entityType) {
      this.entityTypes.add(options.entityType);
    }
    if (options.entityTypes) {
      options.entityTypes.forEach(type => this.entityTypes.add(type));
    }
    if (this.entityTypes.size === 0) {
      this.entityTypes.add('default');
    }

    this.options = {
      entityType: this.entityTypes.values().next().value,
      entityTypes: Array.from(this.entityTypes),
      syncStrategy: options.syncStrategy || DEFAULT_DIFFERENTIAL_SYNC_CONFIG.syncStrategy,
      maxRetries: options.maxRetries || DEFAULT_DIFFERENTIAL_SYNC_CONFIG.maxRetries,
      retryDelay: options.retryDelay || DEFAULT_DIFFERENTIAL_SYNC_CONFIG.retryDelay,
      enableCompression: options.enableCompression || DEFAULT_DIFFERENTIAL_SYNC_CONFIG.enableCompression,
      conflictResolution: options.conflictResolution || DEFAULT_DIFFERENTIAL_SYNC_CONFIG.conflictResolution,
      autoReconnect: options.autoReconnect ?? true,
      qualityMonitoring: options.qualityMonitoring ?? true,
      connectionTimeout: options.connectionTimeout || 10000,
      ...options
    };

    // Initialize Lamport clock
    this.lamportClock = createInitialLamportClock(this.clientId);

    // Initialize sync metrics
    this.syncMetrics = {
      clientId: this.clientId,
      syncDuration: 0,
      deltaCount: 0,
      bytesTransferred: 0,
      compressionRatio: 1,
      sub100msLatencyCount: 0,
      totalSyncCount: 0,
      averageLatency: 0,
      lastSyncTimestamp: 0,
      timestamp: Date.now()
    };

    // Initialize vector clocks for all entity types
    for (const entityType of this.entityTypes) {
      this.lastKnownVectorClocks.set(entityType, createInitialVectorClock(this.clientId));
      this.localStates.set(entityType, {});
    }
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      this.cleanup();
      this.ws = new WebSocket(this.websocketUrl);

      // Set up connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (!this.isConnected && this.ws) {
          this.ws.close();
          this.emit('error', new SyncOperationError('Connection timeout'));
        }
      }, this.options.connectionTimeout);

      // Set up event handlers
      this.setupWebSocketHandlers();

      return new Promise((resolve, reject) => {
        const onConnected = () => {
          clearTimeout(this.connectionTimeout!);
          this.removeAllListeners('error');
          resolve();
        };

        const onError = (error: Error) => {
          clearTimeout(this.connectionTimeout!);
          this.removeAllListeners('connected');
          reject(error);
        };

        this.once('connected', onConnected);
        this.once('error', onError);
      });
    } catch (error) {
      this.emit('error', new SyncOperationError('Failed to connect to WebSocket server', { originalError: error }));
      throw error;
    }
  }

  /**
   * Set up WebSocket event handlers with proper cleanup
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onclose = () => this.handleClose();
    this.ws.onerror = (error) => this.handleError(error);
  }

  /**
   * Disconnect from the WebSocket server with proper cleanup
   */
  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.cleanup();

      if (this.ws) {
        this.ws.onclose = () => {
          this.isConnected = false;
          this.emit('disconnected');
          resolve();
        };
        this.ws.close();
        this.ws = null;
      } else {
        this.isConnected = false;
        this.emit('disconnected');
        resolve();
      }
    });
  }

  /**
   * Cleanup all resources and timers
   */
  private cleanup(): void {
    // Clear all timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.qualityMonitoringTimer) {
      clearInterval(this.qualityMonitoringTimer);
      this.qualityMonitoringTimer = null;
    }

    // Reject all pending syncs
    for (const [syncId, pendingSync] of this.pendingSyncs) {
      pendingSync.reject(new SyncOperationError('Client disconnected'));
    }
    this.pendingSyncs.clear();

    // Execute cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        logWarn('Cleanup callback error:', error);
      }
    }
    this.cleanupCallbacks.clear();

    // Clear event listeners
    this.eventListeners.clear();

    // Clear subscriptions
    this.subscriptions.clear();
  }

  /**
   * Subscribe to differential sync for one or more entity types
   */
  async subscribe(entityTypes?: string | string[]): Promise<void> {
    if (!this.isConnected) {
      throw new SyncOperationError('Must be connected to subscribe');
    }

    const typesToSubscribe = entityTypes ?
      (Array.isArray(entityTypes) ? entityTypes : [entityTypes]) :
      Array.from(this.entityTypes);

    for (const entityType of typesToSubscribe) {
      if (!this.entityTypes.has(entityType)) {
        this.entityTypes.add(entityType);
        this.lastKnownVectorClocks.set(entityType, createInitialVectorClock(this.clientId));
        this.localStates.set(entityType, {});
      }

      if (!this.subscriptions.has(entityType)) {
        this.subscriptions.add(entityType);
        await this.sendSubscriptionMessage(entityType, 'subscribe');
        this.emit('subscribed', { entityType });
      }
    }
  }

  /**
   * Unsubscribe from differential sync for one or more entity types
   */
  async unsubscribe(entityTypes?: string | string[]): Promise<void> {
    if (!this.isConnected) {
      return; // Not connected, nothing to unsubscribe
    }

    const typesToUnsubscribe = entityTypes ?
      (Array.isArray(entityTypes) ? entityTypes : [entityTypes]) :
      Array.from(this.subscriptions);

    const unsubscribePromises: Promise<void>[] = [];

    for (const entityType of typesToUnsubscribe) {
      if (this.subscriptions.has(entityType)) {
        this.subscriptions.delete(entityType);
        unsubscribePromises.push(this.sendSubscriptionMessage(entityType, 'unsubscribe'));

        // Clean up related data
        this.lastKnownVectorClocks.delete(entityType);
        this.localStates.delete(entityType);
        this.entityTypes.delete(entityType);

        this.emit('unsubscribed', { entityType });
      }
    }

    try {
      await Promise.all(unsubscribePromises);
    } catch (error) {
      this.emit('error', new SyncOperationError('Failed to unsubscribe from some entity types', { entityTypes, error }));
    }
  }

  /**
   * Send subscription/unsubscription message to server
   */
  private async sendSubscriptionMessage(entityType: string, action: 'subscribe' | 'unsubscribe'): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new SyncOperationError('WebSocket connection not ready');
    }

    const message = JSON.stringify({
      type: `sync:${action}`,
      data: {
        clientId: this.clientId,
        entityType,
        timestamp: Date.now()
      }
    });

    this.ws.send(message);
  }

  /**
   * Update local state and increment Lamport clock
   */
  updateLocalState(newState: any, entityType?: string): void {
    // Increment Lamport clock before state changes
    this.lamportClock = incrementLamportClock(this.lamportClock!);

    // Determine entity type
    const type = entityType || this.options.entityType || 'default';

    if (!this.entityTypes.has(type)) {
      this.entityTypes.add(type);
      this.lastKnownVectorClocks.set(type, createInitialVectorClock(this.clientId));
      this.localStates.set(type, {});
    }

    const oldState = { ...this.localStates.get(type) };
    const updatedState = { ...oldState, ...newState };
    this.localStates.set(type, updatedState);

    // Update vector clock for this entity type
    const currentClock = this.lastKnownVectorClocks.get(type)!;
    const newVersions = new Map(currentClock.versions);
    const currentVersion = newVersions.get(this.clientId) || 0;
    newVersions.set(this.clientId, currentVersion + 1);

    const newVectorClock: VectorClock = {
      clientId: this.clientId,
      versions: newVersions,
      timestamp: Date.now(),
      lamportCounter: this.lamportClock.counter,
      nodeId: this.clientId
    };

    this.lastKnownVectorClocks.set(type, newVectorClock);

    this.emit('state:updated', {
      entityType: type,
      oldState,
      newState: updatedState,
      vectorClock: newVectorClock,
      lamportClock: this.lamportClock
    });
  }

  /**
   * Get local state for a specific entity type
   */
  getLocalState(entityType?: string): any {
    const type = entityType || this.options.entityType || 'default';
    return this.localStates.get(type) || {};
  }

  /**
   * Get last known vector clock for a specific entity type
   */
  getLastKnownVectorClock(entityType?: string): VectorClock | null {
    const type = entityType || this.options.entityType || 'default';
    return this.lastKnownVectorClocks.get(type) || null;
  }

  /**
   * Request sync with server including Lamport clock
   */
  async requestSync(entityType?: string, options: {
    maxDeltaSize?: number;
    includeQualityMetrics?: boolean;
  } = {}): Promise<StateDelta[]> {
    if (!this.isConnected) {
      throw new SyncOperationError('Not connected to server');
    }

    const type = entityType || this.options.entityType || 'default';
    const syncId = `${type}-${Date.now()}-${Math.random()}`;
    const startTime = Date.now();

    // Serialize vector clock for transmission
    const vectorClock = this.getLastKnownVectorClock(type);
    const serializedVectorClock = vectorClock ? VectorClockSerializer.serialize(vectorClock) : undefined;

    const syncRequest: SyncRequest = {
      clientId: this.clientId,
      entityType: type,
      lastKnownVectorClock: serializedVectorClock,
      clientLamportClock: this.lamportClock || undefined,
      maxDeltaSize: options.maxDeltaSize,
      includeQualityMetrics: options.includeQualityMetrics ?? true
    };

    return new Promise((resolve, reject) => {
      // Add retry tracking
      const pendingSync = {
        resolve,
        reject,
        timestamp: startTime,
        entityType: type,
        retryCount: 0
      };

      this.pendingSyncs.set(syncId, pendingSync);

      try {
        const message = JSON.stringify({
          type: 'sync:request',
          syncId,
          data: syncRequest
        });

        this.ws!.send(message);
        this.emit('sync:requested', syncRequest);

        // Set up timeout for this sync request
        const timeout = setTimeout(() => {
          if (this.pendingSyncs.has(syncId)) {
            this.pendingSyncs.delete(syncId);
            reject(new SyncOperationError('Sync request timeout'));
          }
        }, this.options.connectionTimeout);

        // Store timeout for cleanup
        this.cleanupCallbacks.add(() => clearTimeout(timeout));

      } catch (error) {
        this.pendingSyncs.delete(syncId);
        reject(new SyncOperationError('Failed to send sync request', { originalError: error }));
      }
    });
  }

  /**
   * Process received deltas from server with Lamport clock handling and deserialization
   */
  async processDeltas(deltas: StateDelta[] | SerializedStateDelta[]): Promise<void> {
    const processedDeltas: StateDelta[] = [];

    for (const delta of deltas) {
      try {
        // Deserialize delta if needed
        const deserializedDelta = this.isValidSerializedDelta(delta)
          ? StateDeltaSerializer.deserialize(delta as SerializedStateDelta)
          : delta as StateDelta;

        // Validate the delta
        if (!isValidStateDelta(deserializedDelta)) {
          throw new SerializationError('Invalid state delta received');
        }

        // Process Lamport clock from server
        if (deserializedDelta.lamportClock && isValidLamportClock(deserializedDelta.lamportClock)) {
          this.lamportClock = mergeLamportClocks(this.lamportClock!, deserializedDelta.lamportClock);
        }

        // Process vector clock
        if (deserializedDelta.vectorClock && isValidVectorClock(deserializedDelta.vectorClock)) {
          this.lastKnownVectorClocks.set(deserializedDelta.entityType, deserializedDelta.vectorClock);
        }

        // Apply changes to local state
        for (const change of deserializedDelta.changes) {
          this.applyStateChange(change, deserializedDelta.entityType);
        }

        processedDeltas.push(deserializedDelta);
        this.emit('delta:processed', deserializedDelta);

      } catch (error) {
        this.emit('error', new SerializationError('Failed to process delta', { delta, error }));
      }
    }

    this.emit('deltas:processed', processedDeltas);
  }

  /**
   * Check if delta is serialized format
   */
  private isValidSerializedDelta(delta: any): boolean {
    return delta &&
           typeof delta === 'object' &&
           typeof delta.entityType === 'string' &&
           typeof delta.entityId === 'string' &&
           typeof delta.vectorClock === 'object' &&
           delta.vectorClock !== null &&
           typeof delta.vectorClock.versions === 'object' &&
           !Array.isArray(delta.vectorClock.versions); // Check if versions is object, not Map
  }

  /**
   * Get current Lamport clock
   */
  getLamportClock(): LamportClock | null {
    return this.lamportClock ? { ...this.lamportClock } : null;
  }

  /**
   * Get current quality metrics
   */
  getQualityMetrics(): QualityMetrics | null {
    return this.qualityMetrics ? { ...this.qualityMetrics } : null;
  }

  /**
   * Get bandwidth validation status
   */
  getBandwidthValidation(): BandwidthValidation | null {
    return this.bandwidthValidation ? { ...this.bandwidthValidation } : null;
  }

  /**
   * Request quality metrics from server
   */
  requestQualityMetrics(): void {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    const message = JSON.stringify({
      type: 'sync:get-quality-metrics',
      clientId: this.clientId,
      entityType: this.entityType
    });

    this.ws!.send(message);
  }

  /**
   * Get comprehensive sync metrics including quality and bandwidth
   */
  getSyncMetrics(): SyncMetrics {
    return {
      ...this.syncMetrics,
      qualityMetrics: this.qualityMetrics || undefined,
      bandwidthValidation: this.bandwidthValidation || undefined,
      sub100msLatencyCount: this.syncMetrics.sub100msLatencyCount,
      totalSyncCount: this.syncMetrics.totalSyncCount,
      averageLatency: this.syncMetrics.averageLatency,
      lastSyncTimestamp: this.syncMetrics.lastSyncTimestamp
    };
  }

  /**
   * Setup event handlers for WebSocket messages
   */
  private setupEventHandlers(): void {
    // This method is called in handleOpen after connection is established
    // Event handlers are already set up in the constructor
  }

  /**
   * Handle WebSocket connection open
   */
  private handleOpen(): void {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.setupEventHandlers();
    this.emit('connected');
  }

  /**
   * Handle incoming WebSocket messages with comprehensive error handling
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      if (!message || typeof message !== 'object') {
        throw new SerializationError('Invalid message format received');
      }

      switch (message.type) {
        case 'sync:response':
          this.handleSyncResponse(message);
          break;
        case 'sync:pong':
          this.handleSyncPong(message);
          break;
        case 'sync:delta':
          this.handleDeltaMessage(message);
          break;
        case 'sync:quality-metrics':
          this.handleQualityMetrics(message);
          break;
        case 'sync:bandwidth-validation':
          this.handleBandwidthValidation(message);
          break;
        case 'connected':
          this.handleConnectedMessage(message);
          break;
        case 'subscription:confirmed':
          this.handleSubscriptionConfirmed(message);
          break;
        case 'unsubscription:confirmed':
          this.handleUnsubscriptionConfirmed(message);
          break;
        case 'sync:error':
          this.handleSyncError(message);
          break;
        case 'quality-monitor:ping':
          this.handleQualityMonitorPing(message);
          break;
        default:
          logWarn('Unknown message type:', message.type);
      }
    } catch (error) {
      this.emit('error', new SerializationError('Failed to parse WebSocket message', {
        originalError: error,
        eventData: event.data
      }));
    }
  }

  /**
   * Handle connection confirmation message
   */
  private handleConnectedMessage(message: any): void {
    const {data} = message;

    // Update Lamport clock from server
    if (data.lamportClock && isValidLamportClock(data.lamportClock)) {
      this.lamportClock = mergeLamportClocks(this.lamportClock!, data.lamportClock);
    }

    // Update quality metrics
    if (data.qualityMetrics) {
      this.qualityMetrics = data.qualityMetrics;
      this.emit('quality:updated', data.qualityMetrics);
    }

    this.emit('server:connected', data);
  }

  /**
   * Handle subscription confirmation
   */
  private handleSubscriptionConfirmed(message: any): void {
    const {data} = message;
    this.emit('subscription:confirmed', data);
  }

  /**
   * Handle unsubscription confirmation
   */
  private handleUnsubscriptionConfirmed(message: any): void {
    const {data} = message;
    this.emit('unsubscription:confirmed', data);
  }

  /**
   * Handle sync error messages
   */
  private handleSyncError(message: any): void {
    const {data} = message;
    this.emit('error', new SyncOperationError(data.message || 'Sync operation failed', data));
  }

  /**
   * Handle quality monitoring ping
   */
  private handleQualityMonitorPing(message: any): void {
    const {data} = message;

    // Respond with pong
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const pongMessage = JSON.stringify({
        type: 'quality-monitor:pong',
        data: {
          pingTimestamp: data.timestamp,
          timestamp: Date.now()
        }
      });
      this.ws.send(pongMessage);
    }
  }

  /**
   * Handle sync response from server with deserialization
   */
  private async handleSyncResponse(message: any): Promise<void> {
    try {
      const {syncId, data} = message;
      const pendingSync = this.pendingSyncs.get(syncId);

      if (!pendingSync) {
        logWarn(`Received sync response for unknown syncId: ${syncId}`);
        return;
      }

      const {resolve, reject, timestamp, entityType} = pendingSync;

      // Validate response format
      if (!isValidSyncResponse(data)) {
        throw new SerializationError('Invalid sync response format');
      }

      const response = data;

      // Process server Lamport clock
      if (response.serverLamportClock && isValidLamportClock(response.serverLamportClock)) {
        this.lamportClock = mergeLamportClocks(this.lamportClock!, response.serverLamportClock);
      }

      // Deserialize and update vector clock
      if (response.currentVectorClock) {
        let vectorClock: VectorClock;
        if (this.isSerializedVectorClock(response.currentVectorClock)) {
          vectorClock = VectorClockSerializer.deserialize(response.currentVectorClock as SerializedVectorClock);
        } else if (isValidVectorClock(response.currentVectorClock)) {
          vectorClock = response.currentVectorClock;
        } else {
          throw new SerializationError('Invalid vector clock in sync response');
        }
        this.lastKnownVectorClocks.set(entityType, vectorClock);
      }

      // Update quality metrics
      if (response.qualityMetrics) {
        this.qualityMetrics = response.qualityMetrics;
        this.emit('quality:updated', response.qualityMetrics);
      }

      // Update bandwidth validation
      if (response.bandwidthValidation) {
        this.bandwidthValidation = response.bandwidthValidation;
        this.emit('bandwidth:validated', response.bandwidthValidation);
      }

      // Track sync performance
      const syncDuration = Date.now() - timestamp;
      this.updateSyncMetrics(syncDuration, response.deltas.length);

      // Process deltas with deserialization
      await this.processDeltas(response.deltas);

      this.pendingSyncs.delete(syncId);
      resolve(response.deltas);

    } catch (error) {
      const {syncId, data} = message;
      const pendingSync = this.pendingSyncs.get(syncId);

      if (pendingSync) {
        this.pendingSyncs.delete(syncId);
        pendingSync.reject(new SyncOperationError('Failed to handle sync response', {
          originalError: error,
          syncResponse: data
        }));
      } else {
        this.emit('error', new SyncOperationError('Failed to handle sync response', {
          originalError: error,
          syncResponse: data
        }));
      }
    }
  }

  /**
   * Check if vector clock is in serialized format
   */
  private isSerializedVectorClock(clock: any): boolean {
    return clock &&
           typeof clock === 'object' &&
           typeof clock.clientId === 'string' &&
           typeof clock.versions === 'object' &&
           clock.versions !== null &&
           !Array.isArray(clock.versions) && // Object, not Map
           typeof clock.timestamp === 'number' &&
           typeof clock.lamportCounter === 'number' &&
           typeof clock.nodeId === 'string';
  }

  /**
   * Handle sync pong message with quality metrics and Lamport clock
   */
  private handleSyncPong(message: any): void {
    const {data} = message;

    // Extract and update quality metrics
    if (data.qualityMetrics) {
      this.qualityMetrics = data.qualityMetrics;
      this.emit('quality:updated', data.qualityMetrics);
    }

    // Extract and update Lamport clock
    if (data.lamportClock) {
      this.mergeLamportClock(data.lamportClock);
    }

    // Extract and update bandwidth validation
    if (data.bandwidthValidation) {
      this.bandwidthValidation = data.bandwidthValidation;
      this.emit('bandwidth:validated', data.bandwidthValidation);
    }

    this.emit('sync:pong-received', data);
  }

  /**
   * Handle delta message from server
   */
  private handleDeltaMessage(message: any): void {
    const {data} = message;
    this.processDeltas([data]);
  }

  /**
   * Handle quality metrics update
   */
  private handleQualityMetrics(message: any): void {
    const {data} = message;
    this.qualityMetrics = data;
    this.emit('quality:updated', data);
  }

  /**
   * Handle bandwidth validation update
   */
  private handleBandwidthValidation(message: any): void {
    const {data} = message;
    this.bandwidthValidation = data;
    this.emit('bandwidth:validated', data);
  }

  /**
   * Handle WebSocket connection close
   */
  private handleClose(): void {
    this.isConnected = false;
    this.ws = null;
    this.emit('disconnected');

    if (this.reconnectAttempts < this.options.maxRetries) {
      this.scheduleReconnect();
    } else {
      this.emit('reconnect:failed');
    }
  }

  /**
   * Handle WebSocket connection error
   */
  private handleError(error: Event): void {
    this.emit('error', new Error('WebSocket connection error'));
  }

  /**
   * Schedule reconnection attempt with exponential backoff and jitter
   */
  private scheduleReconnect(): void {
    if (!this.options.autoReconnect) {
      this.emit('reconnect:failed');
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff with jitter
    const baseDelay = this.options.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    const delay = exponentialDelay + jitter;

    // Cap the delay at 30 seconds
    const cappedDelay = Math.min(delay, 30000);

    this.emit('reconnect:scheduled', {
      attempt: this.reconnectAttempts,
      delay: cappedDelay,
      maxRetries: this.options.maxRetries
    });

    this.reconnectTimer = setTimeout(async () => {
      if (this.reconnectAttempts <= this.options.maxRetries) {
        try {
          await this.connect();
        } catch (error) {
          this.emit('reconnect:attempt_failed', {
            attempt: this.reconnectAttempts,
            error
          });

          if (this.reconnectAttempts < this.options.maxRetries) {
            this.scheduleReconnect();
          } else {
            this.emit('reconnect:failed');
          }
        }
      }
    }, cappedDelay);
  }

  /**
   * Increment Lamport clock
   */
  private incrementLamportClock(): void {
    if (this.lamportClock) {
      this.lamportClock = incrementLamportClock(this.lamportClock);
    }
  }

  /**
   * Merge Lamport clock with server clock using max+1 logic
   */
  private mergeLamportClock(serverClock: LamportClock): void {
    if (this.lamportClock && serverClock) {
      this.lamportClock = mergeLamportClocks(this.lamportClock, serverClock);
    }
  }

  /**
   * Retry a failed sync operation with exponential backoff
   */
  private async retrySync(syncId: string, pendingSync: any): Promise<void> {
    const {entityType, retryCount = 0} = pendingSync;

    if (retryCount >= this.options.maxRetries) {
      this.pendingSyncs.delete(syncId);
      pendingSync.reject(new SyncOperationError('Max retry attempts exceeded'));
      return;
    }

    // Calculate retry delay with exponential backoff
    const delay = this.options.retryDelay * Math.pow(2, retryCount);

    // Update retry count
    pendingSync.retryCount = retryCount + 1;

    setTimeout(async () => {
      try {
        // Attempt to retry the sync
        await this.requestSync(entityType);

        // If successful, resolve the original promise
        this.pendingSyncs.delete(syncId);
        pendingSync.resolve([]);

      } catch (error) {
        this.emit('sync:retry_failed', {
          syncId,
          entityType,
          retryCount: pendingSync.retryCount,
          error
        });

        // Retry again if we haven't exceeded max attempts
        await this.retrySync(syncId, pendingSync);
      }
    }, delay);
  }

  /**
   * Add a cleanup callback that will be executed on disconnect
   */
  addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * Remove a cleanup callback
   */
  removeCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.delete(callback);
  }

  /**
   * Start automatic quality monitoring
   */
  startQualityMonitoring(interval: number = 30000): void {
    if (this.qualityMonitoringTimer) {
      clearInterval(this.qualityMonitoringTimer);
    }

    this.qualityMonitoringTimer = setInterval(async () => {
      if (this.isConnected) {
        try {
          await this.sendPing();
        } catch (error) {
          this.emit('error', new SyncOperationError('Quality monitoring ping failed', { error }));
        }
      }
    }, interval);
  }

  /**
   * Stop automatic quality monitoring
   */
  stopQualityMonitoring(): void {
    if (this.qualityMonitoringTimer) {
      clearInterval(this.qualityMonitoringTimer);
      this.qualityMonitoringTimer = null;
    }
  }

  /**
   * Send ping to server for quality monitoring
   */
  private async sendPing(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new SyncOperationError('WebSocket not ready for ping');
    }

    const pingMessage = JSON.stringify({
      type: 'sync:ping',
      data: {
        timestamp: Date.now(),
        qualityMetrics: this.qualityMetrics
      }
    });

    this.ws.send(pingMessage);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    isConnected: boolean;
    entityTypes: string[];
    subscriptions: string[];
    pendingSyncs: number;
    reconnectAttempts: number;
    uptime: number;
    syncMetrics: SyncMetrics;
  } {
    return {
      isConnected: this.isConnected,
      entityTypes: Array.from(this.entityTypes),
      subscriptions: Array.from(this.subscriptions),
      pendingSyncs: this.pendingSyncs.size,
      reconnectAttempts: this.reconnectAttempts,
      uptime: Date.now() - (this.syncMetrics.timestamp || Date.now()),
      syncMetrics: this.getSyncMetrics()
    };
  }

  /**
   * Apply state change to local state for specific entity type
   */
  private applyStateChange(change: any, entityType: string): void {
    const {field, oldValue, newValue, changeType} = change;

    if (!this.localStates.has(entityType)) {
      this.localStates.set(entityType, {});
    }

    const currentState = this.localStates.get(entityType)!;

    switch (changeType) {
      case 'create':
      case 'update':
        currentState[field] = newValue;
        break;
      case 'delete':
        delete currentState[field];
        break;
      default:
        logWarn(`Unknown change type: ${changeType}`);
    }

    // Emit state change event for granular tracking
    this.emit('state:change', {
      entityType,
      field,
      oldValue,
      newValue,
      changeType,
      timestamp: Date.now()
    });
  }

  /**
   * Update sync performance metrics with enhanced tracking
   */
  private updateSyncMetrics(duration: number, deltaCount: number): void {
    this.syncMetrics.totalSyncCount++;
    this.syncMetrics.lastSyncTimestamp = Date.now();

    // Track sub-100ms performance
    if (duration < 100) {
      this.syncMetrics.sub100msLatencyCount++;
    }

    // Update average latency with running average
    const alpha = 0.1; // Smoothing factor for exponential moving average
    this.syncMetrics.averageLatency =
      this.syncMetrics.averageLatency * (1 - alpha) + duration * alpha;

    // Update other metrics
    this.syncMetrics.syncDuration = duration;
    this.syncMetrics.deltaCount += deltaCount;
    this.syncMetrics.bytesTransferred += this.estimateMessageSize(deltaCount);
    this.syncMetrics.timestamp = Date.now();

    // Emit performance metrics for monitoring
    this.emit('sync:performance', {
      duration,
      deltaCount,
      averageLatency: this.syncMetrics.averageLatency,
      sub100msRate: (this.syncMetrics.sub100msLatencyCount / this.syncMetrics.totalSyncCount) * 100
    });
  }

  /**
   * Estimate message size for bandwidth metrics
   */
  private estimateMessageSize(deltaCount: number): number {
    // Rough estimate: each delta is ~1KB
    return deltaCount * 1024;
  }

  /**
   * Batch multiple state updates together for better performance
   */
  updateLocalStateBatch(updates: Array<{ entityType?: string; state: any }>): void {
    // Increment Lamport clock once for the batch
    this.lamportClock = incrementLamportClock(this.lamportClock!);

    for (const {entityType, state} of updates) {
      this.updateLocalState(state, entityType);
    }
  }

  /**
   * Debounced state update to reduce sync frequency
   */
  createDebouncedUpdate(delay: number = 100): (newState: any, entityType?: string) => void {
    const debouncedUpdates = new Map<string, {
      timeout: NodeJS.Timeout;
      state: any;
    }>();

    return (newState: any, entityType?: string) => {
      const type = entityType || this.options.entityType || 'default';

      // Clear existing timeout for this entity type
      if (debouncedUpdates.has(type)) {
        clearTimeout(debouncedUpdates.get(type)!.timeout);
      }

      // Merge new state
      const existingState = debouncedUpdates.get(type)?.state || {};
      const mergedState = { ...existingState, ...newState };

      // Set new timeout
      const timeout = setTimeout(() => {
        this.updateLocalState(mergedState, type);
        debouncedUpdates.delete(type);
      }, delay);

      debouncedUpdates.set(type, {
        timeout,
        state: mergedState
      });
    };
  }

  /**
   * Get current sync status for monitoring
   */
  getSyncStatus(): {
    isConnected: boolean;
    entityTypes: string[];
    subscriptions: string[];
    lastSyncTime: number | null;
    averageLatency: number;
    sub100msSuccessRate: number;
    qualityScore: number | null;
    reconnectAttempts: number;
  } {
    const sub100msSuccessRate = this.syncMetrics.totalSyncCount > 0
      ? (this.syncMetrics.sub100msLatencyCount / this.syncMetrics.totalSyncCount) * 100
      : 0;

    return {
      isConnected: this.isConnected,
      entityTypes: Array.from(this.entityTypes),
      subscriptions: Array.from(this.subscriptions),
      lastSyncTime: this.syncMetrics.lastSyncTimestamp || null,
      averageLatency: this.syncMetrics.averageLatency,
      sub100msSuccessRate,
      qualityScore: this.qualityMetrics?.qualityScore || null,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Reset sync metrics (useful for testing or troubleshooting)
   */
  resetSyncMetrics(): void {
    this.syncMetrics = {
      clientId: this.clientId,
      syncDuration: 0,
      deltaCount: 0,
      bytesTransferred: 0,
      compressionRatio: 1,
      sub100msLatencyCount: 0,
      totalSyncCount: 0,
      averageLatency: 0,
      lastSyncTimestamp: 0,
      timestamp: Date.now()
    };

    this.emit('metrics:reset');
  }

  /**
   * Add event listener with automatic cleanup
   */
  addManagedEventListener(event: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
    this.on(event, listener);
  }

  /**
   * Remove all managed event listeners for an event
   */
  removeManagedEventListeners(event: string): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        this.off(event, listener);
      }
      this.eventListeners.delete(event);
    }
  }

  /**
   * Get comprehensive client health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      connection: boolean;
      quality: number | null;
      latency: number;
      errorRate: number;
      uptime: number;
    };
    recommendations: string[];
  } {
    const avgLatency = this.syncMetrics.averageLatency;
    const qualityScore = this.qualityMetrics?.qualityScore || 100;
    const totalSyncs = this.syncMetrics.totalSyncCount;
    const sub100msRate = totalSyncs > 0
      ? (this.syncMetrics.sub100msLatencyCount / totalSyncs) * 100
      : 100;
    const uptime = Date.now() - this.syncMetrics.timestamp;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const recommendations: string[] = [];

    if (!this.isConnected) {
      status = 'unhealthy';
      recommendations.push('Connection lost - attempting to reconnect');
    } else if (avgLatency > 200 || sub100msRate < 70 || qualityScore < 60) {
      status = 'degraded';
      if (avgLatency > 200) recommendations.push('High latency detected');
      if (sub100msRate < 70) recommendations.push('Poor sync performance');
      if (qualityScore < 60) recommendations.push('Connection quality degraded');
    }

    if (this.reconnectAttempts > 3) {
      recommendations.push('Multiple reconnection attempts');
    }

    return {
      status,
      details: {
        connection: this.isConnected,
        quality: qualityScore,
        latency: avgLatency,
        errorRate: 100 - sub100msRate,
        uptime
      },
      recommendations
    };
  }
}