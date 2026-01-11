import { Injectable, Logger, OnModuleInit, OnModuleDestroy, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { VectorClock, StateVersion, StateDelta, SyncRequest, SyncResponse, ConflictResolution, SyncStrategy, ConflictStrategy, LamportClock, BandwidthValidationResult, ConnectionQualityMetrics, ConnectionEvent } from '../interfaces/differential-sync.interface';
import { ConnectionQualityMonitorService } from "./connection-quality-monitor.service";
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DifferentialSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DifferentialSyncService.name);
  private readonly SYNC_STATE_PREFIX = 'sync:state:';
  private readonly CLIENT_CLOCK_PREFIX = 'sync:client:';
  private readonly LAMPORT_CLOCK_PREFIX = 'sync:client:';
  private readonly BANDWIDTH_METRICS_PREFIX = 'sync:metrics:bandwidth:';
  private readonly BANDWIDTH_VALIDATION_PREFIX = 'sync:bandwidth:validation:';
  private readonly ENTITY_CACHE_PREFIX = 'sync:entity:';
  private readonly BATCH_PROCESSING_PREFIX = 'sync:batch:';
  private readonly ERROR_RATE_PREFIX = 'sync:error-rate:';

  private readonly BATCH_SIZE = 50; // Process entities in batches of 50
  private readonly CACHE_TTL = 300; // 5 minutes cache TTL
  private readonly MAX_CONCURRENT_OPERATIONS = 1000;

  private batchProcessingQueue: Array<() => Promise<any>> = [];
  private isProcessingBatch = false;
  private batchProcessingInterval: NodeJS.Timeout | null = null;

  // Error tracking map for in-memory calculation
  private clientErrorRates = new Map<string, {
    totalOperations: number;
    errorCount: number;
    errors: Array<{
      timestamp: number;
      errorType: string;
      message: string;
    }>;
    lastReset: number;
    lastSyncTime: number;
  }>();

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ConnectionQualityMonitorService))
    private readonly connectionQualityMonitor: ConnectionQualityMonitorService,
    private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.logger.log('Initializing Differential Sync Service');
    await this.startBatchProcessing();
    this.logger.log('Differential Sync Service initialized');
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Differential Sync Service');
    await this.stopBatchProcessing();
    this.logger.log('Differential Sync Service shut down');
  }

  private async startBatchProcessing(): Promise<void> {
    if (this.batchProcessingInterval) {
      clearInterval(this.batchProcessingInterval);
    }

    this.batchProcessingInterval = setInterval(async () => {
      if (this.batchProcessingQueue.length > 0 && !this.isProcessingBatch) {
        await this.processBatchQueue();
      }
    }, 100); // Process queue every 100ms
  }

  private async stopBatchProcessing(): Promise<void> {
    if (this.batchProcessingInterval) {
      clearInterval(this.batchProcessingInterval);
      this.batchProcessingInterval = null;
    }

    // Process remaining items in queue
    if (this.batchProcessingQueue.length > 0) {
      await this.processBatchQueue();
    }
  }

  private async processBatchQueue(): Promise<void> {
    if (this.isProcessingBatch || this.batchProcessingQueue.length === 0) {
      return;
    }

    this.isProcessingBatch = true;
    const startTime = Date.now();

    try {
      const batch = this.batchProcessingQueue.splice(0, this.BATCH_SIZE);
      const promises = batch.map(operation =>
        operation().catch(error => {
          this.logger.error('Batch operation failed:', error);
          return null;
        })
      );

      await Promise.allSettled(promises);

      const duration = Date.now() - startTime;
      this.logger.debug(`Processed batch of ${batch.length} operations in ${duration}ms`);
    } catch (error) {
      this.logger.error('Batch processing failed:', error);
    } finally {
      this.isProcessingBatch = false;
    }
  }

  private addToBatchQueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedOperation = async () => {
        try {
          const result = await operation();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      };

      this.batchProcessingQueue.push(wrappedOperation);

      // If queue is getting too large, process immediately
      if (this.batchProcessingQueue.length >= this.MAX_CONCURRENT_OPERATIONS) {
        setImmediate(() => this.processBatchQueue());
      }
    });
  }

  /**
   * Initialize vector clock for a new client with validation and error handling
   */
  async initializeClient(clientId: string): Promise<VectorClock> {
    try {
      // Validate clientId
      if (!clientId || typeof clientId !== 'string') {
        throw new Error('Invalid clientId provided');
      }

      // Record operation start time for latency tracking
      const startTime = Date.now();

      const vectorClock: VectorClock = {
        clientId,
        versions: new Map<string, number>(),
        timestamp: Date.now(),
        lamportCounter: 0,
        nodeId: clientId
      };

      // Validate vector clock structure
      this.validateVectorClock(vectorClock);

      // Use Redis pipelining for efficient operations
      const pipeline = this.redis.pipeline();

      // Store vector clock with proper serialization
      pipeline.setex(
        `${this.CLIENT_CLOCK_PREFIX}${clientId}:vector-clock`,
        86400, // 24 hours TTL
        JSON.stringify(this.serializeVectorClock(vectorClock))
      );

      // Initialize Lamport clock separately
      const lamportClock: LamportClock = {
        counter: 0,
        nodeId: clientId,
        timestamp: Date.now()
      };

      pipeline.hset(
        `${this.LAMPORT_CLOCK_PREFIX}${clientId}:lamport-clock`,
        {
          counter: lamportClock.counter.toString(),
          nodeId: lamportClock.nodeId,
          timestamp: lamportClock.timestamp.toString()
        }
      );

      pipeline.expire(`${this.LAMPORT_CLOCK_PREFIX}${clientId}:lamport-clock`, 86400);

      // Execute pipeline
      await pipeline.exec();

      // Record latency for connection quality monitoring
      const duration = Date.now() - startTime;
      await this.connectionQualityMonitor.recordLatency(clientId, duration);

      this.logger.debug(`Initialized vector clock and Lamport clock for client ${clientId} in ${duration}ms`);
      return vectorClock;
    } catch (error) {
      this.logger.error(`Failed to initialize client ${clientId}:`, error);
      throw new Error(`Client initialization failed: ${error.message}`);
    }
  }

  /**
   * Get current vector clock for client with validation and error handling
   */
  async getClientVectorClock(clientId: string): Promise<VectorClock | null> {
    try {
      if (!clientId || typeof clientId !== 'string') {
        throw new Error('Invalid clientId provided');
      }

      const startTime = Date.now();
      const clockData = await this.redis.get(`${this.CLIENT_CLOCK_PREFIX}${clientId}:vector-clock`);

      if (!clockData) {
        this.logger.debug(`No vector clock found for client ${clientId}`);
        return null;
      }

      let parsedData;
      try {
        parsedData = JSON.parse(clockData);
      } catch (parseError) {
        this.logger.warn(`Invalid JSON in vector clock for client ${clientId}:`, parseError);
        // Clean up corrupted data
        await this.redis.del(`${this.CLIENT_CLOCK_PREFIX}${clientId}:vector-clock`);
        return null;
      }

      const vectorClock = this.deserializeVectorClock(parsedData);

      // Validate the deserialized vector clock
      if (!this.validateVectorClock(vectorClock)) {
        this.logger.warn(`Invalid vector clock structure for client ${clientId}, cleaning up`);
        await this.redis.del(`${this.CLIENT_CLOCK_PREFIX}${clientId}:vector-clock`);
        return null;
      }

      // Record latency for performance monitoring
      const duration = Date.now() - startTime;
      await this.connectionQualityMonitor.recordLatency(clientId, duration);

      return vectorClock;
    } catch (error) {
      this.logger.error(`Failed to get vector clock for client ${clientId}:`, error);
      return null;
    }
  }

  /**
   * Increment Lamport clock for a client
   */
  async incrementLamportClock(clientId: string): Promise<LamportClock> {
    const clockKey = `${this.LAMPORT_CLOCK_PREFIX}${clientId}:lamport-clock`;

    // Atomically increment the counter
    const newCounter = await this.redis.hincrby(clockKey, 'counter', 1);

    // Update timestamp
    const timestamp = Date.now();
    await this.redis.hset(clockKey, 'timestamp', timestamp.toString());

    const lamportClock: LamportClock = {
      counter: newCounter,
      nodeId: clientId,
      timestamp
    };

    await this.redis.expire(clockKey, 86400);

    this.logger.debug(`Incremented Lamport clock for client ${clientId} to ${newCounter}`);
    return lamportClock;
  }

  /**
   * Merge Lamport clocks according to Lamport's algorithm
   * clock = max(local_clock, received_clock) + 1
   */
  async mergeLamportClocks(clientId: string, receivedClock: LamportClock): Promise<LamportClock> {
    const clockKey = `${this.LAMPORT_CLOCK_PREFIX}${clientId}:lamport-clock`;

    // Get current local clock
    const localClockData = await this.redis.hgetall(clockKey);
    const localCounter = parseInt(localClockData.counter || '0');

    // Apply Lamport merge rule
    const newCounter = Math.max(localCounter, receivedClock.counter) + 1;

    // Update clock with merged value
    const timestamp = Date.now();
    await this.redis.hset(clockKey, {
      counter: newCounter.toString(),
      nodeId: clientId,
      timestamp: timestamp.toString()
    });

    await this.redis.expire(clockKey, 86400);

    const mergedClock: LamportClock = {
      counter: newCounter,
      nodeId: clientId,
      timestamp
    };

    this.logger.debug(`Merged Lamport clock for client ${clientId}: local=${localCounter}, received=${receivedClock.counter}, merged=${newCounter}`);
    return mergedClock;
  }

  /**
   * Get current Lamport clock for a client
   */
  async getLamportClock(clientId: string): Promise<LamportClock | null> {
    const clockKey = `${this.LAMPORT_CLOCK_PREFIX}${clientId}:lamport-clock`;
    const clockData = await this.redis.hgetall(clockKey);

    if (!clockData || !clockData.counter) return null;

    return {
      counter: parseInt(clockData.counter),
      nodeId: clockData.nodeId || clientId,
      timestamp: parseInt(clockData.timestamp || '0')
    };
  }

  /**
   * Calculate state deltas since last sync with real database integration
   */
  async calculateStateDelta(request: SyncRequest): Promise<StateDelta[]> {
    const startTime = Date.now();
    const { clientId, entityType, lastKnownVectorClock, maxDeltaSize = 100 } = request;

    try {
      // Validate request
      if (!clientId || !entityType) {
        throw new Error('Invalid sync request: missing clientId or entityType');
      }

      // Check if client should use polling fallback
      const shouldUseFallback = await this.connectionQualityMonitor.shouldUsePollingFallback(clientId);
      if (shouldUseFallback) {
        this.logger.debug(`Client ${clientId} using polling fallback, reducing delta size`);
        // Activate fallback if not already active
        await this.connectionQualityMonitor.activatePollingFallback(
          clientId,
          'Poor connection quality detected during sync'
        );
      }

      // Increment Lamport clock before calculating deltas
      const lamportClock = await this.incrementLamportClock(clientId);

      // Get current server state
      const currentClock = await this.getClientVectorClock(clientId);
      if (!currentClock) {
        this.logger.warn(`No vector clock found for client ${clientId}, returning empty deltas`);
        return [];
      }

      // Get entity state using batch processing for performance
      const entityState = await this.addToBatchQueue(() =>
        this.getEntityState(entityType, request.entityId)
      );

      if (!entityState) {
        this.logger.debug(`No entity state found for ${entityType}:${request.entityId}`);
        return [];
      }

      // Calculate deltas based on vector clock comparison
      const deltas = await this.calculateDifferences(
        entityType,
        entityState,
        lastKnownVectorClock,
        currentClock,
        maxDeltaSize,
        lamportClock
      );

      // Record sync performance metrics
      const duration = Date.now() - startTime;
      const deltaSize = JSON.stringify(deltas).length;

      await this.connectionQualityMonitor.recordSyncPerformanceMetrics({
        clientId,
        syncDuration: duration,
        deltaCount: deltas.length,
        bytesTransferred: deltaSize,
        compressionRatio: entityState ? deltaSize / JSON.stringify(entityState).length : 1,
        timestamp: Date.now()
      });

      // Record bandwidth metrics
      const fullSize = JSON.stringify(entityState).length;
      await this.recordBandwidthMetrics(clientId, fullSize, deltaSize);

      // Check if we should activate polling fallback based on performance
      if (duration > 200 || deltas.length > maxDeltaSize) {
        await this.connectionQualityMonitor.activatePollingFallback(
          clientId,
          `Performance threshold exceeded: ${duration}ms duration, ${deltas.length} deltas`
        );
      }

      this.logger.debug(
        `Calculated ${deltas.length} deltas for client ${clientId} on entity ${entityType} in ${duration}ms`
      );

      // Record successful operation
      this.recordSyncOperation(clientId, true);

      return deltas;
    } catch (error) {
      this.logger.error(`Failed to calculate state delta for client ${clientId}:`, error);

      // Record failed operation
      this.recordSyncOperation(
        clientId,
        false,
        'SYNC_CALCULATION_ERROR',
        error.message
      );

      // Activate fallback on error
      await this.connectionQualityMonitor.activatePollingFallback(
        clientId,
        `Sync calculation failed: ${error.message}`
      );

      return [];
    }
  }

  /**
   * Broadcast state delta to multiple clients
   */
  async broadcastStateDelta(delta: StateDelta, targetClients: string[]): Promise<void> {
    // Increment server Lamport clock before broadcasting
    const serverNodeId = 'server';
    const serverClockKey = `${this.LAMPORT_CLOCK_PREFIX}server:lamport-clock`;

    const currentCounter = await this.redis.hincrby(serverClockKey, 'counter', 1);
    const timestamp = Date.now();

    await this.redis.hset(serverClockKey, {
      counter: currentCounter.toString(),
      nodeId: serverNodeId,
      timestamp: timestamp.toString()
    });

    // Include Lamport counter in the delta
    delta.vectorClock.lamportCounter = currentCounter;

    // Broadcast to all target clients
    for (const clientId of targetClients) {
      try {
        await this.redis.lpush(
          `${this.CLIENT_CLOCK_PREFIX}${clientId}:pending-deltas`,
          JSON.stringify(this.serializeStateDelta(delta))
        );
        await this.redis.expire(`${this.CLIENT_CLOCK_PREFIX}${clientId}:pending-deltas`, 3600);
      } catch (error) {
        this.logger.error(`Failed to queue delta for client ${clientId}:`, error);
      }
    }

    this.logger.debug(`Broadcasted state delta to ${targetClients.length} clients`);
  }

  /**
   * Resolve conflicts between multiple state updates
   */
  async resolveConflict(conflictType: string, states: any[]): Promise<ConflictResolution> {
    // Use Lamport timestamp comparison for conflict resolution
    let winningState = states[0];
    let winningLamportCounter = 0;

    for (const state of states) {
      if (state.vectorClock && state.vectorClock.lamportCounter > winningLamportCounter) {
        winningState = state;
        winningLamportCounter = state.vectorClock.lamportCounter;
      }
    }

    // If Lamport counters are equal, use nodeId lexicographic ordering as tiebreaker
    const tiedStates = states.filter(s =>
      s.vectorClock && s.vectorClock.lamportCounter === winningLamportCounter
    );

    if (tiedStates.length > 1) {
      tiedStates.sort((a, b) => {
        const nodeA = a.vectorClock?.nodeId || '';
        const nodeB = b.vectorClock?.nodeId || '';
        return nodeA.localeCompare(nodeB);
      });
      winningState = tiedStates[0];
    }

    return {
      conflictType,
      resolution: ConflictStrategy.LAST_WRITE_WINS,
      mergedState: winningState,
      reasoning: `Conflict resolved using Lamport clock comparison. Winning state has Lamport counter: ${winningLamportCounter}`,
      timestamp: Date.now()
    };
  }

  /**
   * Record bandwidth metrics for sync operations
   */
  async recordBandwidthMetrics(
    clientId: string,
    fullSize: number,
    deltaSize: number
  ): Promise<void> {
    const reduction = fullSize > 0 ? ((fullSize - deltaSize) / fullSize) * 100 : 0;

    const metrics = {
      fullSize,
      deltaSize,
      reduction: parseFloat(reduction.toFixed(2)),
      timestamp: Date.now()
    };

    // Store metrics
    await this.redis.lpush(
      `${this.BANDWIDTH_METRICS_PREFIX}${clientId}`,
      JSON.stringify(metrics)
    );

    await this.redis.ltrim(`${this.BANDWIDTH_METRICS_PREFIX}${clientId}`, 0, 999); // Keep last 1000 entries
    await this.redis.expire(`${this.BANDWIDTH_METRICS_PREFIX}${clientId}`, 86400);

    // Validate against target
    await this.validateBandwidthReduction(clientId, fullSize, deltaSize);

    this.logger.debug(`Recorded bandwidth metrics for client ${clientId}: ${reduction}% reduction`);
  }

  /**
   * Validate bandwidth reduction meets target percentage
   */
  private async validateBandwidthReduction(
    clientId: string,
    fullSize: number,
    deltaSize: number
  ): Promise<void> {
    const validationEnabled = this.configService.get<boolean>('WS_BANDWIDTH_VALIDATION_ENABLED', true);
    if (!validationEnabled) return;

    const targetReduction = this.configService.get<number>('WS_BANDWIDTH_REDUCTION_TARGET', 87);
    const actualReduction = fullSize > 0 ? ((fullSize - deltaSize) / fullSize) * 100 : 0;

    const validationResult: BandwidthValidationResult = {
      isValid: actualReduction >= targetReduction,
      actualReduction: parseFloat(actualReduction.toFixed(2)),
      targetReduction,
      fullSize,
      deltaSize,
      timestamp: Date.now()
    };

    // Store validation result
    await this.redis.setex(
      `${this.BANDWIDTH_VALIDATION_PREFIX}${clientId}`,
      3600, // 1 hour TTL
      JSON.stringify(validationResult)
    );

    if (!validationResult.isValid) {
      this.logger.warn(
        `Client ${clientId} bandwidth reduction (${actualReduction}%) below target (${targetReduction}%)`
      );
    }
  }

  /**
   * Get bandwidth validation result for a client
   */
  async getBandwidthValidationResult(clientId: string): Promise<BandwidthValidationResult | null> {
    const resultData = await this.redis.get(`${this.BANDWIDTH_VALIDATION_PREFIX}${clientId}`);
    if (!resultData) return null;

    return JSON.parse(resultData);
  }

  /**
   * Get all bandwidth validation results for admin dashboard
   */
  async getAllBandwidthValidationResults(): Promise<(BandwidthValidationResult & { clientId: string })[]> {
    try {
      const validationKeys = await this.redis.keys(`${this.BANDWIDTH_VALIDATION_PREFIX}*`);
      const allResults: (BandwidthValidationResult & { clientId: string })[] = [];

      for (const key of validationKeys) {
        const clientId = key.replace(this.BANDWIDTH_VALIDATION_PREFIX, '');
        const resultData = await this.redis.get(key);
        if (resultData) {
          const result = JSON.parse(resultData) as BandwidthValidationResult;
          allResults.push({
            ...result,
            clientId
          });
        }
      }

      return allResults;
    } catch (error) {
      this.logger.error('Failed to get all bandwidth validation results:', error);
      return [];
    }
  }

  /**
   * Get entity state from database with caching and error handling
   */
  async getEntityState(entityType: string, entityId?: string): Promise<any> {
    try {
      // Validate entityType
      if (!entityType) {
        throw new Error('Entity type is required');
      }

      // Check cache first
      const cacheKey = `${this.ENTITY_CACHE_PREFIX}${entityType}${entityId ? `:${entityId}` : ''}`;
      const cachedState = await this.redis.get(cacheKey);

      if (cachedState) {
        try {
          return JSON.parse(cachedState);
        } catch (parseError) {
          this.logger.warn(`Invalid cached state for ${entityType}, clearing cache`);
          await this.redis.del(cacheKey);
        }
      }

      let entityState: any;

      // Query database based on entity type with optimized queries
      switch (entityType.toLowerCase()) {
        case 'users':
          if (entityId) {
            entityState = await this.prisma.user.findUnique({
              where: { id: entityId },
              select: {
                id: true,
                email: true,
                username: true,
                role: true,
                status: true,
                firstName: true,
                lastName: true,
                avatar: true,
                country: true,
                balanceUsd: true,
                balanceLocked: true,
                kycStatus: true,
                twoFactorEnabled: true,
                emailVerified: true,
                lastLoginAt: true,
                brokerId: true,
                updatedAt: true
              }
            });
          } else {
            entityState = await this.prisma.user.findMany({
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                username: true,
                role: true,
                status: true,
                lastLoginAt: true,
                updatedAt: true
              },
              take: 100, // Limit for performance
              orderBy: { updatedAt: 'desc' }
            });
          }
          break;

        case 'brokers':
          if (entityId) {
            entityState = await this.prisma.broker.findUnique({
              where: { id: entityId },
              include: {
                users: {
                  select: {
                    id: true,
                    username: true,
                    status: true
                  },
                  take: 50
                }
              }
            });
          } else {
            entityState = await this.prisma.broker.findMany({
              where: { isActive: true },
              select: {
                id: true,
                companyName: true,
                tier: true,
                status: true,
                totalTraders: true,
                totalVolume: true,
                averageRating: true,
                trustScore: true,
                updatedAt: true
              },
              take: 100,
              orderBy: { updatedAt: 'desc' }
            });
          }
          break;

        case 'markets':
          // Assuming Market model exists in schema
          entityState = await this.getMarketState(entityId);
          break;

        case 'notifications':
          if (entityId) {
            entityState = await this.prisma.notification.findUnique({
              where: { id: entityId }
            });
          } else {
            entityState = await this.prisma.notification.findMany({
              take: 100,
              orderBy: { createdAt: 'desc' }
            });
          }
          break;

        case 'trends':
          // Assuming Trend model exists
          entityState = await this.getTrendState(entityId);
          break;

        default:
          this.logger.warn(`Unsupported entity type: ${entityType}`);
          return null;
      }

      // Cache the result if successful
      if (entityState) {
        await this.redis.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(entityState)
        );
      }

      return entityState;
    } catch (error) {
      this.logger.error(`Failed to get entity state for ${entityType}:${entityId}:`, error);
      return null;
    }
  }

  /**
   * Get market state (placeholder implementation)
   */
  private async getMarketState(entityId?: string): Promise<any> {
    // This would query market data from your Market model
    // For now, return a placeholder structure
    return entityId ? { id: entityId, type: 'market' } : [];
  }

  /**
   * Get trend state (placeholder implementation)
   */
  private async getTrendState(entityId?: string): Promise<any> {
    // This would query trend data from your Trend model
    // For now, return a placeholder structure
    return entityId ? { id: entityId, type: 'trend' } : [];
  }

  /**
   * Calculate differences between states using vector clocks
   */
  private async calculateDifferences(
    entityType: string,
    currentState: any,
    lastKnownVectorClock?: VectorClock,
    currentClock?: VectorClock,
    maxDeltaSize: number = 100,
    lamportClock?: LamportClock
  ): Promise<StateDelta[]> {
    const deltas: StateDelta[] = [];

    try {
      if (!currentState) {
        return deltas;
      }

      // Get previous state for comparison
      const previousStateKey = `${this.SYNC_STATE_PREFIX}${entityType}:previous`;
      const previousStateData = await this.redis.get(previousStateKey);

      let previousState: any = null;
      if (previousStateData) {
        try {
          previousState = JSON.parse(previousStateData);
        } catch (parseError) {
          this.logger.warn(`Invalid previous state for ${entityType}, ignoring`);
        }
      }

      // Compare current and previous states to generate deltas
      const changes = this.compareStates(previousState, currentState);

      if (changes.length > 0) {
        const stateDelta: StateDelta = {
          entityType,
          entityId: currentState.id || entityType,
          changes,
          vectorClock: currentClock || {
            clientId: 'server',
            versions: new Map(),
            timestamp: Date.now(),
            lamportCounter: 0,
            nodeId: 'server'
          },
          lamportClock,
          timestamp: Date.now()
        };

        deltas.push(stateDelta);

        // Limit delta size
        if (deltas.length >= maxDeltaSize) {
          this.logger.warn(`Delta size limit reached for ${entityType}, truncating`);
          return deltas.slice(0, maxDeltaSize);
        }
      }

      // Update previous state in cache
      await this.redis.setex(
        previousStateKey,
        this.CACHE_TTL,
        JSON.stringify(currentState)
      );

      return deltas;
    } catch (error) {
      this.logger.error(`Failed to calculate differences for ${entityType}:`, error);
      return [];
    }
  }

  /**
   * Compare two states and identify changes
   */
  private compareStates(previousState: any, currentState: any): StateChange[] {
    const changes: StateChange[] = [];

    try {
      if (!previousState) {
        // If no previous state, all current fields are new
        return this.flattenStateChanges(currentState, 'create');
      }

      if (!currentState) {
        // If current state is null, previous state was deleted
        return this.flattenStateChanges(previousState, 'delete');
      }

      // Compare each field
      const allKeys = new Set([
        ...Object.keys(previousState || {}),
        ...Object.keys(currentState || {})
      ]);

      for (const key of allKeys) {
        const oldValue = previousState?.[key];
        const newValue = currentState?.[key];

        // Skip comparison for complex objects that shouldn't be diffed directly
        if (this.shouldSkipField(key, oldValue, newValue)) {
          continue;
        }

        if (!this.deepEqual(oldValue, newValue)) {
          changes.push({
            field: key,
            oldValue,
            newValue,
            changeType: newValue === undefined ? 'delete' : 'update',
            timestamp: Date.now()
          });
        }
      }

      return changes;
    } catch (error) {
      this.logger.error('Failed to compare states:', error);
      return [];
    }
  }

  /**
   * Flatten state changes for initial state
   */
  private flattenStateChanges(state: any, changeType: 'create' | 'delete'): StateChange[] {
    const changes: StateChange[] = [];

    try {
      if (!state || typeof state !== 'object') {
        return changes;
      }

      const flattenObject = (obj: any, prefix = ''): void => {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const value = obj[key];

            if (this.shouldSkipField(key, null, value)) {
              continue;
            }

            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
              flattenObject(value, fullKey);
            } else {
              changes.push({
                field: fullKey,
                oldValue: changeType === 'delete' ? value : undefined,
                newValue: changeType === 'create' ? value : undefined,
                changeType,
                timestamp: Date.now()
              });
            }
          }
        }
      };

      flattenObject(state);
      return changes;
    } catch (error) {
      this.logger.error('Failed to flatten state changes:', error);
      return [];
    }
  }

  /**
   * Determine if a field should be skipped during comparison
   */
  private shouldSkipField(key: string, oldValue: any, newValue: any): boolean {
    // Skip fields that shouldn't be synced or are too complex
    const skipFields = ['password', 'token', 'secret', 'internal'];
    return skipFields.some(skip => key.toLowerCase().includes(skip));
  }

  /**
   * Deep equality check for values
   */
  private deepEqual(a: any, b: any): boolean {
    try {
      if (a === b) return true;
      if (a == null || b == null) return false;
      if (typeof a !== typeof b) return false;

      if (typeof a === 'object') {
        if (Array.isArray(a) !== Array.isArray(b)) return false;

        if (Array.isArray(a)) {
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i++) {
            if (!this.deepEqual(a[i], b[i])) return false;
          }
          return true;
        }

        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
          if (!keysB.includes(key) || !this.deepEqual(a[key], b[key])) {
            return false;
          }
        }
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up client data with comprehensive cleanup
   */
  async cleanupClient(clientId: string): Promise<void> {
    try {
      if (!clientId) {
        this.logger.warn('Cannot cleanup client: no clientId provided');
        return;
      }

      // Deactivate polling fallback if active
      await this.connectionQualityMonitor.deactivatePollingFallback(clientId);

      // Clean up error tracking data
      this.clientErrorRates.delete(clientId);

      const keys = [
        `${this.CLIENT_CLOCK_PREFIX}${clientId}:vector-clock`,
        `${this.LAMPORT_CLOCK_PREFIX}${clientId}:lamport-clock`,
        `${this.BANDWIDTH_METRICS_PREFIX}${clientId}`,
        `${this.BANDWIDTH_VALIDATION_PREFIX}${clientId}`,
        `${this.CLIENT_CLOCK_PREFIX}${clientId}:pending-deltas`,
        `${this.ERROR_RATE_PREFIX}${clientId}`
      ];

      // Use Redis pipeline for efficient deletion
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();

      this.logger.debug(`Cleaned up sync data for client ${clientId}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup client ${clientId}:`, error);
    }
  }

  /**
   * Record sync operation success/error for rate tracking
   */
  private recordSyncOperation(clientId: string, success: boolean, errorType?: string, errorMessage?: string): void {
    const now = Date.now();
    const existing = this.clientErrorRates.get(clientId);

    if (!existing) {
      this.clientErrorRates.set(clientId, {
        totalOperations: 0,
        errorCount: 0,
        errors: [],
        lastReset: now,
        lastSyncTime: now
      });
    }

    const errorData = this.clientErrorRates.get(clientId)!;
    errorData.totalOperations++;
    errorData.lastSyncTime = now;

    if (!success) {
      errorData.errorCount++;
      errorData.errors.push({
        timestamp: now,
        errorType: errorType || 'UNKNOWN_ERROR',
        errorMessage: errorMessage || 'Unknown error'
      });

      // Keep only last 50 errors
      if (errorData.errors.length > 50) {
        errorData.errors = errorData.errors.slice(-50);
      }
    }

    // Reset counters if they're getting too large (every 10k operations or 1 hour)
    if (errorData.totalOperations > 10000 || now - errorData.lastReset > 3600000) {
      errorData.totalOperations = Math.min(errorData.totalOperations, 1000); // Keep reasonable baseline
      errorData.errorCount = Math.min(errorData.errorCount, 1000);
      errorData.lastReset = now;

      // Keep only recent errors
      const recentTime = now - 1800000; // Last 30 minutes
      errorData.errors = errorData.errors.filter(error => error.timestamp > recentTime);
    }
  }

  /**
   * Get current error rate for a client
   */
  private getErrorRate(clientId: string): number {
    const errorData = this.clientErrorRates.get(clientId);
    if (!errorData || errorData.totalOperations === 0) {
      return 0;
    }

    return (errorData.errorCount / errorData.totalOperations) * 100;
  }

  /**
   * Get detailed error statistics for a client (private method)
   */
  private getErrorData(clientId: string): {
    errorRate: number;
    totalOperations: number;
    errorCount: number;
    recentErrors: Array<{
      timestamp: number;
      errorType: string;
      message: string;
    }>;
    lastSyncTime: number;
  } {
    const errorData = this.clientErrorRates.get(clientId);

    if (!errorData) {
      return {
        errorRate: 0,
        totalOperations: 0,
        errorCount: 0,
        recentErrors: [],
        lastSyncTime: 0
      };
    }

    const recentTime = Date.now() - 1800000; // Last 30 minutes
    const recentErrors = errorData.errors.filter(error => error.timestamp > recentTime);

    return {
      errorRate: errorData.totalOperations > 0 ? (errorData.errorCount / errorData.totalOperations) * 100 : 0,
      totalOperations: errorData.totalOperations,
      errorCount: errorData.errorCount,
      recentErrors,
      lastSyncTime: errorData.lastSyncTime
    };
  }

  /**
   * Validate vector clock structure and detect corruption
   */
  private validateVectorClock(clock: VectorClock): boolean {
    try {
      if (!clock) {
        return false;
      }

      // Check required fields
      if (!clock.clientId || typeof clock.clientId !== 'string') {
        return false;
      }

      if (!clock.nodeId || typeof clock.nodeId !== 'string') {
        return false;
      }

      if (!clock.versions || !(clock.versions instanceof Map)) {
        return false;
      }

      if (typeof clock.timestamp !== 'number' || clock.timestamp <= 0) {
        return false;
      }

      if (typeof clock.lamportCounter !== 'number' || clock.lamportCounter < 0) {
        return false;
      }

      // Validate versions map
      for (const [key, value] of clock.versions) {
        if (typeof key !== 'string' || typeof value !== 'number' || value < 0) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Vector clock validation failed:', error);
      return false;
    }
  }

  /**
   * Enhanced serialization with error handling for Map-JSON conversion
   */
  private serializeVectorClock(clock: VectorClock): any {
    try {
      if (!this.validateVectorClock(clock)) {
        throw new Error('Invalid vector clock structure');
      }

      return {
        clientId: clock.clientId,
        versions: clock.versions ? Object.fromEntries(clock.versions) : {},
        timestamp: clock.timestamp,
        lamportCounter: clock.lamportCounter,
        nodeId: clock.nodeId
      };
    } catch (error) {
      this.logger.error('Failed to serialize vector clock:', error);
      // Return a minimal valid structure
      return {
        clientId: clock.clientId || 'unknown',
        versions: {},
        timestamp: Date.now(),
        lamportCounter: 0,
        nodeId: clock.nodeId || 'server'
      };
    }
  }

  /**
   * Enhanced deserialization with validation and corruption handling
   */
  private deserializeVectorClock(data: any): VectorClock {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data for vector clock deserialization');
      }

      // Handle missing or corrupted versions
      let versions: Map<string, number> = new Map();
      if (data.versions) {
        try {
          if (typeof data.versions === 'object' && !Array.isArray(data.versions)) {
            versions = new Map(Object.entries(data.versions));
          } else if (Array.isArray(data.versions)) {
            // Handle case where versions was serialized as array
            versions = new Map(data.versions);
          }
        } catch (versionError) {
          this.logger.warn('Failed to deserialize versions, using empty map:', versionError);
          versions = new Map();
        }
      }

      const vectorClock: VectorClock = {
        clientId: data.clientId || 'unknown',
        versions,
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
        lamportCounter: typeof data.lamportCounter === 'number' ? data.lamportCounter : 0,
        nodeId: data.nodeId || data.clientId || 'unknown'
      };

      // Validate the reconstructed vector clock
      if (!this.validateVectorClock(vectorClock)) {
        throw new Error('Deserialized vector clock failed validation');
      }

      return vectorClock;
    } catch (error) {
      this.logger.error('Failed to deserialize vector clock:', error);
      // Return a minimal valid vector clock
      return {
        clientId: 'corrupted',
        versions: new Map(),
        timestamp: Date.now(),
        lamportCounter: 0,
        nodeId: 'recovery'
      };
    }
  }

  /**
   * Enhanced state delta serialization with validation
   */
  private serializeStateDelta(delta: StateDelta): any {
    try {
      if (!delta) {
        throw new Error('Invalid state delta');
      }

      return {
        entityType: delta.entityType,
        entityId: delta.entityId,
        changes: delta.changes || [],
        vectorClock: this.serializeVectorClock(delta.vectorClock),
        lamportClock: delta.lamportClock || {
          counter: 0,
          nodeId: 'server',
          timestamp: Date.now()
        },
        timestamp: delta.timestamp || Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to serialize state delta:', error);
      // Return minimal valid structure
      return {
        entityType: delta.entityType || 'unknown',
        entityId: delta.entityId || 'unknown',
        changes: [],
        vectorClock: this.serializeVectorClock({
          clientId: 'server',
          versions: new Map(),
          timestamp: Date.now(),
          lamportCounter: 0,
          nodeId: 'server'
        }),
        lamportClock: {
          counter: 0,
          nodeId: 'server',
          timestamp: Date.now()
        },
        timestamp: Date.now()
      };
    }
  }

  /**
   * Batch sync multiple entities for improved performance
   */
  async batchSyncEntities(
    clientId: string,
    entityRequests: Array<{ entityType: string; entityId?: string }>
  ): Promise<StateDelta[]> {
    const startTime = Date.now();

    try {
      // Check if client should use polling fallback
      const shouldUseFallback = await this.connectionQualityMonitor.shouldUsePollingFallback(clientId);
      if (shouldUseFallback) {
        await this.connectionQualityMonitor.activatePollingFallback(
          clientId,
          'Batch sync activated due to poor connection quality'
        );
      }

      // Increment Lamport clock once for the batch
      const lamportClock = await this.incrementLamportClock(clientId);

      // Process requests in parallel with batch queue
      const batchPromises = entityRequests.map(request =>
        this.addToBatchQueue(async () => {
          const entityState = await this.getEntityState(request.entityType, request.entityId);
          return { request, entityState };
        })
      );

      const results = await Promise.allSettled(batchPromises);

      // Generate deltas for all entities
      const allDeltas: StateDelta[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.entityState) {
          const { request, entityState } = result.value;
          const deltas = await this.calculateDifferences(
            request.entityType,
            entityState,
            undefined, // No previous clock for batch sync
            await this.getClientVectorClock(clientId),
            50, // Smaller deltas for batch processing
            lamportClock
          );
          allDeltas.push(...deltas);
        }
      }

      // Record batch performance metrics
      const duration = Date.now() - startTime;
      const deltaSize = JSON.stringify(allDeltas).length;

      await this.connectionQualityMonitor.recordSyncPerformanceMetrics({
        clientId,
        syncDuration: duration,
        deltaCount: allDeltas.length,
        bytesTransferred: deltaSize,
        compressionRatio: 1.0, // No full state comparison for batch
        timestamp: Date.now()
      });

      this.logger.debug(
        `Batch sync completed for client ${clientId}: ${allDeltas.length} deltas from ${entityRequests.length} entities in ${duration}ms`
      );

      // Record successful batch operation
      this.recordSyncOperation(clientId, true);

      return allDeltas;
    } catch (error) {
      this.logger.error(`Batch sync failed for client ${clientId}:`, error);

      // Record failed batch operation
      this.recordSyncOperation(
        clientId,
        false,
        'BATCH_SYNC_ERROR',
        error.message
      );

      await this.connectionQualityMonitor.activatePollingFallback(
        clientId,
        `Batch sync failed: ${error.message}`
      );
      return [];
    }
  }

  /**
   * Invalidate cache for specific entity type
   */
  async invalidateEntityCache(entityType: string, entityId?: string): Promise<void> {
    try {
      const cacheKey = `${this.ENTITY_CACHE_PREFIX}${entityType}${entityId ? `:${entityId}` : ''}`;
      await this.redis.del(cacheKey);

      // Also invalidate the previous state cache
      const previousStateKey = `${this.SYNC_STATE_PREFIX}${entityType}:previous`;
      await this.redis.del(previousStateKey);

      this.logger.debug(`Invalidated cache for ${entityType}:${entityId || 'all'}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for ${entityType}:${entityId}:`, error);
    }
  }

  /**
   * Get detailed error statistics for monitoring
   */
  async getErrorStatistics(clientId: string): Promise<{
    errorRate: number;
    totalOperations: number;
    errorCount: number;
    recentErrors: Array<{
      timestamp: number;
      errorType: string;
      message: string;
    }>;
    lastSyncTime: number;
  }> {
    return this.getErrorData(clientId);
  }

  
  /**
   * Get sync statistics for monitoring and debugging
   */
  async getSyncStatistics(clientId: string): Promise<{
    totalSyncs: number;
    averageLatency: number;
    bandwidthReduction: number;
    errorRate: number;
    lastSyncTime: number;
  }> {
    try {
      const performanceStats = await this.connectionQualityMonitor.getClientPerformanceStats(clientId);
      const bandwidthValidation = await this.getBandwidthValidationResult(clientId);

      // Get error statistics from our tracking
      const errorStats = this.getErrorData(clientId);

      return {
        totalSyncs: performanceStats.totalSyncs,
        averageLatency: performanceStats.avgSyncDuration,
        bandwidthReduction: bandwidthValidation?.actualReduction || 0,
        errorRate: parseFloat(errorStats.errorRate.toFixed(2)),
        lastSyncTime: errorStats.lastSyncTime
      };
    } catch (error) {
      this.logger.error(`Failed to get sync statistics for client ${clientId}:`, error);
      return {
        totalSyncs: 0,
        averageLatency: 0,
        bandwidthReduction: 0,
        errorRate: 0,
        lastSyncTime: 0
      };
    }
  }

  /**
   * Get error statistics for a specific client
   * Public accessor method that calls the existing private getErrorData() method
   */
  getClientErrorStats(clientId: string): {
    errorRate: number;
    totalOperations: number;
    errorCount: number;
    recentErrors: Array<{
      timestamp: number;
      errorType: string;
      message: string;
    }>;
    lastSyncTime: number;
  } {
    try {
      return this.getErrorData(clientId);
    } catch (error) {
      this.logger.error(`Failed to get client error stats for ${clientId}:`, error);
      return {
        errorRate: 0,
        totalOperations: 0,
        errorCount: 0,
        recentErrors: [],
        lastSyncTime: 0
      };
    }
  }

  /**
   * Primary API for retrieving aggregated error statistics for all connected clients
   * Returns an array of error statistics for all connected clients, sorted by error rate (highest first)
   *
   * NOTE: This method is intentionally synchronous - it operates on in-memory data only
   * and does not perform any I/O operations, making it safe to call without await.
   * It accesses the clientErrorRates Map which contains pre-calculated error statistics.
   */
  getAllClientsErrorStats(): Array<{
    clientId: string;
    errorRate: number;
    totalOperations: number;
    errorCount: number;
    lastSyncTime: number;
  }> {
    try {
      const allStats: Array<{
        clientId: string;
        errorRate: number;
        totalOperations: number;
        errorCount: number;
        lastSyncTime: number;
      }> = [];

      for (const [clientId, errorData] of this.clientErrorRates.entries()) {
        allStats.push({
          clientId,
          errorRate: errorData.totalOperations > 0 ? (errorData.errorCount / errorData.totalOperations) * 100 : 0,
          totalOperations: errorData.totalOperations,
          errorCount: errorData.errorCount,
          lastSyncTime: errorData.lastSyncTime
        });
      }

      return allStats.sort((a, b) => b.errorRate - a.errorRate); // Sort by highest error rate first
    } catch (error) {
      this.logger.error('Failed to get all clients error stats:', error);
      return [];
    }
  }

  /**
   * Get the last sync timestamp for a client
   * Returns the last sync timestamp for a client from the clientErrorRates Map, or 0 if client not found
   */
  getClientLastSyncTime(clientId: string): number {
    try {
      const errorData = this.clientErrorRates.get(clientId);
      return errorData?.lastSyncTime || 0;
    } catch (error) {
      this.logger.error(`Failed to get client last sync time for ${clientId}:`, error);
      return 0;
    }
  }
}
