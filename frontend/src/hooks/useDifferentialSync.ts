import { useEffect, useRef, useState, useCallback } from 'react';
import DifferentialSyncClient, { SyncMetrics, StateDelta, VectorClock } from '../services/websocket/differentialSyncClient';

export interface UseDifferentialSyncOptions {
  clientId: string;
  websocketUrl: string;
  entityTypes?: string[];
  autoConnect?: boolean;
  autoSubscribe?: boolean;
  qualityMonitoring?: boolean;
  enableReconnect?: boolean;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onStateUpdated?: (entityType: string, data: any) => void;
  onDeltaProcessed?: (delta: StateDelta) => void;
}

export interface DifferentialSyncState {
  isConnected: boolean;
  isConnecting: boolean;
  isSubscribed: boolean;
  lastSyncTime: number | null;
  averageLatency: number;
  sub100msSuccessRate: number;
  qualityScore: number | null;
  reconnectAttempts: number;
  connectionHealth: 'healthy' | 'degraded' | 'unhealthy';
}

export interface DifferentialSyncActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  subscribe: (entityTypes?: string | string[]) => Promise<void>;
  unsubscribe: (entityTypes?: string | string[]) => Promise<void>;
  requestSync: (entityType?: string) => Promise<StateDelta[]>;
  updateLocalState: (newState: any, entityType?: string) => void;
  getLocalState: (entityType?: string) => any;
  getLastKnownVectorClock: (entityType?: string) => VectorClock | null;
  getConnectionStats: () => any;
  getHealthStatus: () => any;
  resetMetrics: () => void;
}

export function useDifferentialSync(options: UseDifferentialSyncOptions): [
  DifferentialSyncState,
  DifferentialSyncActions
] {
  const {clientId, websocketUrl, entityTypes, autoConnect = true, autoSubscribe = true, qualityMonitoring = true, enableReconnect = true, onConnected, onDisconnected, onError, onStateUpdated, onDeltaProcessed, } = options;

  const clientRef = useRef<DifferentialSyncClient | null>(null);
  const [state, setState] = useState<DifferentialSyncState>({
    isConnected: false,
    isConnecting: false,
    isSubscribed: false,
    lastSyncTime: null,
    averageLatency: 0,
    sub100msSuccessRate: 0,
    qualityScore: null,
    reconnectAttempts: 0,
    connectionHealth: 'healthy'
  });

  // Initialize client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = new DifferentialSyncClient({
        clientId,
        websocketUrl,
        entityTypes,
        autoReconnect: enableReconnect,
        qualityMonitoring,
      });

      // Set up event listeners
      const client = clientRef.current;

      client.on('connected', () => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          reconnectAttempts: 0
        }));
        onConnected?.();
      });

      client.on('disconnected', () => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          isSubscribed: false
        }));
        onDisconnected?.();
      });

      client.on('error', (error) => {
        console.error('Differential sync error:', error);
        onError?.(error);
      });

      client.on('state:updated', (data) => {
        onStateUpdated?.(data.entityType, data.newState);
      });

      client.on('delta:processed', (delta) => {
        onDeltaProcessed?.(delta);
      });

      client.on('subscribed', ({ entityType }) => {
        setState(prev => ({ ...prev, isSubscribed: true }));
      });

      client.on('unsubscribed', ({ entityType }) => {
        setState(prev => ({ ...prev, isSubscribed: false }));
      });

      client.on('sync:performance', ({ duration, averageLatency, sub100msRate }) => {
        setState(prev => ({
          ...prev,
          lastSyncTime: Date.now(),
          averageLatency,
          sub100msSuccessRate: sub100msRate
        }));
      });

      client.on('quality:updated', (qualityMetrics) => {
        setState(prev => ({
          ...prev,
          qualityScore: qualityMetrics.qualityScore
        }));
      });

      client.on('reconnect:scheduled', ({ attempt }) => {
        setState(prev => ({ ...prev, reconnectAttempts: attempt }));
      });

      // Update health status periodically
      const healthInterval = setInterval(() => {
        if (client) {
          const health = client.getHealthStatus();
          setState(prev => ({
            ...prev,
            connectionHealth: health.status
          }));
        }
      }, 5000);

      // Auto-connect if enabled
      if (autoConnect) {
        client.connect().catch((error) => {
          console.error('Auto-connect failed:', error);
          setState(prev => ({ ...prev, isConnecting: false }));
        });
      }

      return () => {
        clearInterval(healthInterval);
        client.disconnect();
      };
    }
  }, [
    clientId,
    websocketUrl,
    entityTypes,
    autoConnect,
    enableReconnect,
    qualityMonitoring,
    onConnected,
    onDisconnected,
    onError,
    onStateUpdated,
    onDeltaProcessed
  ]);

  // Auto-subscribe after connection
  useEffect(() => {
    if (state.isConnected && autoSubscribe && clientRef.current) {
      clientRef.current.subscribe(entityTypes).catch((error) => {
        console.error('Auto-subscribe failed:', error);
      });
    }
  }, [state.isConnected, autoSubscribe, entityTypes]);

  // Actions
  const connect = useCallback(async () => {
    if (!clientRef.current) return;

    setState(prev => ({ ...prev, isConnecting: true }));
    try {
      await clientRef.current.connect();
    } catch (error) {
      setState(prev => ({ ...prev, isConnecting: false }));
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!clientRef.current) return;

    try {
      await clientRef.current.disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }, []);

  const subscribe = useCallback(async (entityTypes?: string | string[]) => {
    if (!clientRef.current) return;

    try {
      await clientRef.current.subscribe(entityTypes);
    } catch (error) {
      console.error('Subscribe error:', error);
      throw error;
    }
  }, []);

  const unsubscribe = useCallback(async (entityTypes?: string | string[]) => {
    if (!clientRef.current) return;

    try {
      await clientRef.current.unsubscribe(entityTypes);
    } catch (error) {
      console.error('Unsubscribe error:', error);
      throw error;
    }
  }, []);

  const requestSync = useCallback(async (entityType?: string) => {
    if (!clientRef.current) return [];

    try {
      return await clientRef.current.requestSync(entityType);
    } catch (error) {
      console.error('Sync request error:', error);
      throw error;
    }
  }, []);

  const updateLocalState = useCallback((newState: any, entityType?: string) => {
    clientRef.current?.updateLocalState(newState, entityType);
  }, []);

  const getLocalState = useCallback((entityType?: string) => {
    return clientRef.current?.getLocalState(entityType) || {};
  }, []);

  const getLastKnownVectorClock = useCallback((entityType?: string) => {
    return clientRef.current?.getLastKnownVectorClock(entityType) || null;
  }, []);

  const getConnectionStats = useCallback(() => {
    return clientRef.current?.getConnectionStats() || {};
  }, []);

  const getHealthStatus = useCallback(() => {
    return clientRef.current?.getHealthStatus() || {};
  }, []);

  const resetMetrics = useCallback(() => {
    clientRef.current?.resetSyncMetrics();
  }, []);

  const actions: DifferentialSyncActions = {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    requestSync,
    updateLocalState,
    getLocalState,
    getLastKnownVectorClock,
    getConnectionStats,
    getHealthStatus,
    resetMetrics
  };

  return [state, actions];
}

// Higher-order hook for specific entity types
export function useDifferentialSyncEntity(
  entityType: string,
  baseOptions: Omit<UseDifferentialSyncOptions, 'entityTypes'>
) {
  const [state, actions] = useDifferentialSync({
    ...baseOptions,
    entityTypes: [entityType]
  });

  const updateLocalState = useCallback((newState: any) => {
    actions.updateLocalState(newState, entityType);
  }, [actions, entityType]);

  const getLocalState = useCallback(() => {
    return actions.getLocalState(entityType);
  }, [actions, entityType]);

  const getLastKnownVectorClock = useCallback(() => {
    return actions.getLastKnownVectorClock(entityType);
  }, [actions, entityType]);

  const requestSync = useCallback(() => {
    return actions.requestSync(entityType);
  }, [actions, entityType]);

  return [
    state,
    {
      ...actions,
      updateLocalState,
      getLocalState,
      getLastKnownVectorClock,
      requestSync
    }
  ] as const;
}

export default useDifferentialSync;