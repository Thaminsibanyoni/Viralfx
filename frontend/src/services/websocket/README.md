# Differential Sync Client

A production-ready WebSocket-based differential synchronization client with comprehensive error handling, vector clock support, and performance monitoring.

## Features

### ✅ Fixed Issues
- **Unsubscribe Bug**: Fixed array vs Set operations - proper unsubscription with cleanup
- **Vector Clock Serialization**: Handles Map ↔ Record conversion for JSON transmission
- **WebSocket Integration**: Normalizes data formats between backend and frontend
- **Error Handling**: Comprehensive error handling with retry logic and cleanup
- **Type Safety**: Full TypeScript support with proper types and validation

### 🚀 Enhanced Functionality
- **Multiple Entity Types**: Support for syncing multiple entity types simultaneously
- **Performance Monitoring**: Sub-100ms latency tracking and quality metrics
- **Automatic Reconnection**: Exponential backoff with jitter for connection recovery
- **Batch Updates**: Debounced state updates to reduce sync frequency
- **Health Monitoring**: Real-time connection health status and recommendations
- **Memory Management**: Proper cleanup of listeners, timers, and resources

## Basic Usage

### Simple Client Setup

```typescript
import DifferentialSyncClient from './services/websocket/differentialSyncClient';

const client = new DifferentialSyncClient({
  clientId: 'admin-dashboard-123',
  websocketUrl: 'wss://api.viralfx.com/ws',
  entityTypes: ['users', 'orders', 'trends'],
  autoReconnect: true,
  qualityMonitoring: true,
  maxRetries: 5,
  retryDelay: 1000
});

// Connect and subscribe
await client.connect();
await client.subscribe();

// Update local state
client.updateLocalState(
  { status: 'active', lastSeen: Date.now() },
  'users'
);

// Request sync
const deltas = await client.requestSync('users');
```

### React Hook Usage

```typescript
import { useDifferentialSync } from '@/hooks/useDifferentialSync';

function AdminDashboard() {
  const [state, actions] = useDifferentialSync({
    clientId: 'admin-dashboard-123',
    websocketUrl: 'wss://api.viralfx.com/ws',
    entityTypes: ['users', 'orders', 'settings'],
    onConnected: () => console.log('Connected!'),
    onError: (error) => console.error('Sync error:', error),
    onStateUpdated: (entityType, newState) => {
      console.log(`${entityType} updated:`, newState);
    }
  });

  const handleUserUpdate = async (userId: string, userData: any) => {
    // Update local state immediately
    actions.updateLocalState(
      { [userId]: userData },
      'users'
    );

    // Request sync with server
    try {
      const deltas = await actions.requestSync('users');
      console.log('Received', deltas.length, 'deltas');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  if (state.isConnecting) return <div>Connecting...</div>;
  if (!state.isConnected) return <div>Disconnected</div>;

  return (
    <div>
      <div>Connection: {state.connectionHealth}</div>
      <div>Latency: {state.averageLatency}ms</div>
      <div>Quality: {state.qualityScore}%</div>

      {/* User management UI */}
    </div>
  );
}
```

### Single Entity Hook

```typescript
import { useDifferentialSyncEntity } from '@/hooks/useDifferentialSync';

function UserManager() {
  const [state, actions] = useDifferentialSyncEntity('users', {
    clientId: 'user-manager-456',
    websocketUrl: 'wss://api.viralfx.com/ws',
    onStateUpdated: (entityType, newState) => {
      // Only user updates here
      console.log('Users updated:', newState);
    }
  });

  const getUsers = () => actions.getLocalState();
  const syncUsers = () => actions.requestSync();

  return (
    <div>
      <button onClick={syncUsers}>Sync Users</button>
      <pre>{JSON.stringify(getUsers(), null, 2)}</pre>
    </div>
  );
}
```

## Advanced Usage

### Batch Updates for Performance

```typescript
// Create debounced updater for better performance
const debouncedUpdate = client.createDebouncedUpdate(200);

// Multiple rapid updates will be batched
debouncedUpdate({ name: 'John' }, 'users');
debouncedUpdate({ email: 'john@example.com' }, 'users');
// Only one sync will be sent after 200ms

// Or use batch update method
client.updateLocalStateBatch([
  { entityType: 'users', state: { name: 'John' } },
  { entityType: 'orders', state: { status: 'pending' } },
  { entityType: 'settings', state: { theme: 'dark' } }
]);
```

### Performance Monitoring

```typescript
// Get comprehensive sync status
const status = client.getSyncStatus();
console.log('Sync Status:', {
  connected: status.isConnected,
  latency: status.averageLatency,
  successRate: status.sub100msSuccessRate,
  quality: status.qualityScore
});

// Get health status with recommendations
const health = client.getHealthStatus();
console.log('Health:', health.status);
health.recommendations.forEach(rec => console.warn(rec));

// Listen to performance events
client.on('sync:performance', ({ duration, sub100msRate }) => {
  console.log(`Sync completed in ${duration}ms, ${sub100msRate}% under 100ms`);
});
```

### Error Handling and Retry Logic

```typescript
client.on('error', (error) => {
  if (error.code === 'CONNECTION_TIMEOUT') {
    console.warn('Connection timeout, will retry...');
  } else if (error.code === 'SYNC_OPERATION_ERROR') {
    console.error('Sync operation failed:', error.details);
  }
});

client.on('reconnect:scheduled', ({ attempt, delay }) => {
  console.log(`Reconnection attempt ${attempt} in ${delay}ms`);
});

client.on('reconnect:failed', () => {
  console.error('Max reconnection attempts reached');
  // Show user notification
});
```

### Cleanup and Resource Management

```typescript
// Add cleanup callbacks
client.addCleanupCallback(() => {
  console.log('Cleaning up resources...');
});

// Managed event listeners (auto-cleanup)
client.addManagedEventListener('state:updated', (data) => {
  handleStateUpdate(data);
});

// Proper disconnection
await client.disconnect(); // Cleans up all resources
```

## Configuration Options

```typescript
interface DifferentialSyncClientOptions {
  clientId: string;                    // Unique client identifier
  websocketUrl: string;                // WebSocket server URL
  entityTypes?: string[];              // Entity types to sync
  autoReconnect?: boolean;             // Enable auto-reconnection (default: true)
  maxRetries?: number;                 // Max retry attempts (default: 5)
  retryDelay?: number;                 // Base retry delay in ms (default: 1000)
  connectionTimeout?: number;          // Connection timeout in ms (default: 10000)
  qualityMonitoring?: boolean;         // Enable quality monitoring (default: true)
  enableCompression?: boolean;         // Enable compression (default: true)
  conflictResolution?: ConflictStrategy; // Conflict resolution strategy
}
```

## Event Types

### Connection Events
- `connected` - Successfully connected to server
- `disconnected` - Disconnected from server
- `error` - Connection or sync error occurred
- `reconnect:scheduled` - Reconnection scheduled
- `reconnect:failed` - Max reconnection attempts reached

### Sync Events
- `sync:requested` - Sync request sent to server
- `sync:response` - Sync response received from server
- `sync:delta` - Real-time delta received from server
- `sync:performance` - Sync performance metrics

### State Events
- `state:updated` - Local state updated
- `state:change` - Individual state change occurred
- `delta:processed` - Delta successfully processed
- `deltas:processed` - Multiple deltas processed

### Quality Events
- `quality:updated` - Connection quality metrics updated
- `bandwidth:validated` - Bandwidth validation completed

### Subscription Events
- `subscribed` - Successfully subscribed to entity type
- `unsubscribed` - Successfully unsubscribed from entity type

## Integration with Backend

The client automatically handles serialization/deserialization of vector clocks and other data structures:

### Backend Response Format
```json
{
  "type": "sync:response",
  "syncId": "users-1234567890-0.123",
  "data": {
    "clientId": "admin-dashboard-123",
    "entityType": "users",
    "deltas": [
      {
        "entityType": "users",
        "entityId": "user-123",
        "changes": [
          {
            "field": "status",
            "oldValue": "inactive",
            "newValue": "active",
            "changeType": "update",
            "timestamp": 1234567890123
          }
        ],
        "vectorClock": {
          "clientId": "server-1",
          "versions": {"user-123": 5, "server-1": 3},
          "timestamp": 1234567890123,
          "lamportCounter": 8,
          "nodeId": "server-1"
        },
        "timestamp": 1234567890123
      }
    ],
    "currentVectorClock": {
      "clientId": "server-1",
      "versions": {"user-123": 5, "server-1": 3},
      "timestamp": 1234567890123,
      "lamportCounter": 8,
      "nodeId": "server-1"
    },
    "serverLamportClock": {
      "counter": 15,
      "nodeId": "server-1",
      "timestamp": 1234567890123
    },
    "qualityMetrics": {
      "qualityScore": 95.5,
      "latency": 45,
      "packetLoss": 0.01,
      "jitter": 12,
      "connectionStability": 0.98
    },
    "timestamp": 1234567890123
  }
}
```

## Performance Characteristics

- **Latency**: Sub-100ms sync completion for typical operations
- **Memory**: Efficient cleanup prevents memory leaks
- **Network**: Differential sync reduces bandwidth usage
- **Reliability**: Automatic retry and reconnection
- **Monitoring**: Real-time performance and health metrics

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check websocketUrl is correct and accessible
   - Verify firewall/network settings
   - Increase connectionTimeout if needed

2. **High Latency**
   - Monitor network conditions
   - Check server performance
   - Consider enabling compression

3. **Frequent Reconnections**
   - Check network stability
   - Verify WebSocket server health
   - Adjust retry parameters

### Debug Mode

Enable debug logging:
```typescript
client.on('sync:performance', console.log);
client.on('error', console.error);
client.on('state:change', console.debug);
```

### Health Monitoring

```typescript
const health = client.getHealthStatus();
if (health.status !== 'healthy') {
  console.warn('Connection issues:', health.recommendations);
}
```

## Migration Guide

### From Legacy Client

1. Replace old client with new DifferentialSyncClient
2. Update constructor options (entityTypes vs entityType)
3. Update method signatures (entityType parameter added)
4. Add proper error handling
5. Implement cleanup in component unmount

```typescript
// Old
const client = new DifferentialSyncClient({
  clientId: 'test',
  websocketUrl: 'ws://localhost:3000',
  entityType: 'users'
});

// New
const client = new DifferentialSyncClient({
  clientId: 'test',
  websocketUrl: 'ws://localhost:3000',
  entityTypes: ['users', 'orders'],
  autoReconnect: true,
  qualityMonitoring: true
});

await client.connect();
await client.subscribe();
```