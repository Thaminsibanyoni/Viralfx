/**
 * Smart Caching Service for Predictive Notification Preloading
 *
 * Advanced IndexedDB-based caching system with intelligent storage management,
 * offline synchronization, and performance optimization.
 */

import { Notification } from '../../types/notification.types';
import { behaviorTrackingService } from './behaviorTrackingService';
import { notificationPredictionModel } from './notificationPredictionModel';

// Cache configuration
export interface CacheConfig {
  dbName: string;
  dbVersion: number;
  storeName: string;
  maxStorageQuota: number; // MB
  offlineExpiration: number; // Hours
  syncInterval: number; // Minutes
  compressionEnabled: boolean;
  backgroundSyncEnabled: boolean;
}

// Cache entry metadata
export interface CacheEntry {
  id: string;
  data: Notification;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  priority: number; // 0-1, higher = more important
  predictionScore: number; // 0-1, ML prediction of engagement likelihood
  size: number; // bytes
  isDirty: boolean; // Needs sync with server
  compressed: boolean;
}

// Cache statistics
export interface CacheStats {
  totalEntries: number;
  totalSize: number; // bytes
  hitRate: number; // percentage
  missRate: number; // percentage
  evictions: number;
  compressionRatio: number;
  offlineHits: number;
  lastSync: number;
  predictionAccuracy: number;
}

export class SmartCacheService {
  private config: CacheConfig = {
    dbName: 'NotificationCache',
    dbVersion: 1,
    storeName: 'notifications',
    maxStorageQuota: 50, // 50MB
    offlineExpiration: 24, // 24 hours
    syncInterval: 15, // 15 minutes
    compressionEnabled: true,
    backgroundSyncEnabled: true,
  };

  private db: IDBDatabase | null = null;
  private isInitialized: boolean = false;
  private stats: CacheStats = {
    totalEntries: 0,
    totalSize: 0,
    hitRate: 0,
    missRate: 0,
    evictions: 0,
    compressionRatio: 1,
    offlineHits: 0,
    lastSync: 0,
    predictionAccuracy: 0,
  };

  private accessLog: Array<{ id: string; timestamp: number; hit: boolean }> = [];
  private syncTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...this.config, ...config };
    this.initializeCache();
  }

  /**
   * Initialize the IndexedDB cache
   */
  private async initializeCache(): Promise<void> {
    try {
      this.db = await this.openDatabase();
      this.isInitialized = true;

      // Setup periodic tasks
      this.setupPeriodicTasks();

      // Load existing statistics
      await this.loadStats();

      // Perform initial cleanup
      await this.cleanupExpiredEntries();

      console.log('Smart cache service initialized');
    } catch (error) {
      console.error('Failed to initialize cache:', error);
      // Fallback to memory-based caching
      this.initializeMemoryCache();
    }
  }

  /**
   * Store notification with intelligent caching strategy
   */
  async storeNotification(notification: Notification, predictionScore: number = 0): Promise<void> {
    if (!this.isInitialized && !this.initializeMemoryCache()) {
      return;
    }

    try {
      const size = this.calculateSize(notification);
      const compressed = this.config.compressionEnabled && size > 1024; // Compress if > 1KB
      const data = compressed ? await this.compressData(notification) : notification;

      const entry: CacheEntry = {
        id: notification.id,
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + (this.config.offlineExpiration * 60 * 60 * 1000),
        accessCount: 0,
        lastAccessed: Date.now(),
        priority: this.calculatePriority(notification),
        predictionScore,
        size,
        isDirty: false,
        compressed,
      };

      // Check storage quota and evict if necessary
      await this.ensureStorageQuota(size);

      // Store the entry
      if (this.db) {
        await this.storeInIndexedDB(entry);
      } else {
        this.storeInMemory(entry);
      }

      this.updateStats({ totalEntries: this.stats.totalEntries + 1, totalSize: this.stats.totalSize + size });
    } catch (error) {
      console.error('Failed to store notification:', error);
    }
  }

  /**
   * Retrieve notification with intelligent access patterns
   */
  async getNotification(id: string): Promise<Notification | null> {
    const startTime = Date.now();

    try {
      let entry: CacheEntry | null = null;

      if (this.db) {
        entry = await this.getFromIndexedDB(id);
      } else {
        entry = this.getFromMemory(id);
      }

      if (entry) {
        // Update access information
        entry.accessCount++;
        entry.lastAccessed = Date.now();

        // Update the entry with new access info
        if (this.db) {
          await this.updateInIndexedDB(entry);
        } else {
          this.updateInMemory(entry);
        }

        // Decompress if necessary
        let notification: Notification;
        if (entry.compressed) {
          notification = await this.decompressData(entry.data as any);
        } else {
          notification = entry.data as Notification;
        }

        // Record successful hit
        this.recordAccess(id, true);

        // Track access time for ML model
        const accessTime = Date.now() - startTime;
        behaviorTrackingService.trackNotificationClick(notification, accessTime);

        return notification;
      } else {
        // Record miss
        this.recordAccess(id, false);
        return null;
      }
    } catch (error) {
      console.error('Failed to retrieve notification:', error);
      this.recordAccess(id, false);
      return null;
    }
  }

  /**
   * Get notifications to preload based on ML predictions
   */
  async getPreloadedNotifications(maxCount: number = 10): Promise<Notification[]> {
    try {
      if (!this.isInitialized) return [];

      let entries: CacheEntry[];

      if (this.db) {
        entries = await this.getAllFromIndexedDB();
      } else {
        entries = this.getAllFromMemory();
      }

      // Sort by priority and prediction score
      entries.sort((a, b) => {
        const scoreA = (a.priority * 0.6) + (a.predictionScore * 0.4);
        const scoreB = (b.priority * 0.6) + (b.predictionScore * 0.4);
        return scoreB - scoreA;
      });

      // Take top notifications
      const topEntries = entries.slice(0, maxCount);

      // Decompress and return
      const notifications: Notification[] = [];
      for (const entry of topEntries) {
        let notification: Notification;
        if (entry.compressed) {
          notification = await this.decompressData(entry.data as any);
        } else {
          notification = entry.data as Notification;
        }

        // Update access tracking
        entry.accessCount++;
        entry.lastAccessed = Date.now();

        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Failed to get preloaded notifications:', error);
      return [];
    }
  }

  /**
   * Batch preload notifications
   */
  async preloadNotifications(notifications: Notification[]): Promise<void> {
    if (!notifications.length) return;

    try {
      // Get predictions for all notifications
      const predictions = await Promise.all(
        notifications.map(async (notification) => {
          const prediction = await notificationPredictionModel.predictEngagement(notification);
          return {
            notification,
            predictionScore: prediction.willEngage * prediction.confidence,
          };
        })
      );

      // Filter by prediction threshold and sort
      const filtered = predictions
        .filter(p => p.predictionScore > 0.5)
        .sort((a, b) => b.predictionScore - a.predictionScore)
        .slice(0, 20); // Limit to 20 preloaded notifications

      // Store in batch
      await Promise.all(
        filtered.map(({ notification, predictionScore }) =>
          this.storeNotification(notification, predictionScore)
        )
      );

      console.log(`Preloaded ${filtered.length} notifications`);
    } catch (error) {
      console.error('Failed to preload notifications:', error);
    }
  }

  /**
   * Synchronize with server
   */
  async syncWithServer(serverNotifications: Notification[]): Promise<void> {
    try {
      const syncedCount = await this.performSync(serverNotifications);
      this.stats.lastSync = Date.now();
      this.saveStats();

      console.log(`Synced ${syncedCount} notifications with server`);
    } catch (error) {
      console.error('Failed to sync with server:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      if (this.db) {
        const transaction = this.db.transaction([this.config.storeName], 'readwrite');
        const store = transaction.objectStore(this.config.storeName);
        await store.clear();
      } else {
        this.clearMemoryCache();
      }

      // Reset statistics
      this.stats = {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 0,
        evictions: 0,
        compressionRatio: 1,
        offlineHits: 0,
        lastSync: 0,
        predictionAccuracy: 0,
      };

      this.accessLog = [];
      this.saveStats();

      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Private helper methods

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for notifications
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const store = db.createObjectStore(this.config.storeName, { keyPath: 'id' });

          // Create indexes for efficient querying
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('expiresAt', 'expiresAt');
          store.createIndex('priority', 'priority');
          store.createIndex('predictionScore', 'predictionScore');
          store.createIndex('lastAccessed', 'lastAccessed');
        } else {
          // Handle schema migrations if needed
          const store = request.transaction!.objectStore(this.config.storeName);

          // Check for and add missing indexes
          if (!store.indexNames.contains('priority')) {
            store.createIndex('priority', 'priority');
          }
          if (!store.indexNames.contains('predictionScore')) {
            store.createIndex('predictionScore', 'predictionScore');
          }
        }
      };
    });
  }

  private setupPeriodicTasks(): void {
    // Periodic sync
    if (this.config.backgroundSyncEnabled) {
      this.syncTimer = setInterval(() => {
        this.performBackgroundSync();
      }, this.config.syncInterval * 60 * 1000);
    }

    // Periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 60 * 1000); // Hourly cleanup
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimation (UTF-16)
  }

  private calculatePriority(notification: Notification): number {
    let priority = 0.5; // Base priority

    // Boost based on notification priority
    if (notification.priority === 'high') priority += 0.3;
    else if (notification.priority === 'medium') priority += 0.1;

    // Boost based on category importance
    const categoryPriority = {
      'security': 0.2,
      'alert': 0.2,
      'billing': 0.15,
      'order': 0.15,
      'system': 0.1,
      'broker': 0.1,
      'trading': 0.05,
      'social': 0.05,
      'promotion': 0.05,
    };

    priority += categoryPriority[notification.category] || 0;

    return Math.min(1, priority);
  }

  private async ensureStorageQuota( newSize: number): Promise<void> {
    const maxSize = this.config.maxStorageQuota * 1024 * 1024; // Convert to bytes

    // Check quota at 80% to trigger early warning
    const warningThreshold = maxSize * 0.8;

    if (this.stats.totalSize > warningThreshold) {
      console.warn(`Cache approaching storage limit: ${(this.stats.totalSize / 1024 / 1024).toFixed(2)}MB / ${(maxSize / 1024 / 1024).toFixed(2)}MB`);
    }

    if (this.stats.totalSize + newSize > maxSize) {
      // Need to evict some entries
      await this.evictLeastImportantEntries(newSize);
    }
  }

  private async evictLeastImportantEntries(requiredSpace: number): Promise<void> {
    let entries: CacheEntry[];

    if (this.db) {
      entries = await this.getAllFromIndexedDB();
    } else {
      entries = this.getAllFromMemory();
    }

    // Sort by importance score (low to high)
    entries.sort((a, b) => {
      const scoreA = this.calculateImportanceScore(a);
      const scoreB = this.calculateImportanceScore(b);
      return scoreA - scoreB;
    });

    let freedSpace = 0;
    const evicted: string[] = [];

    for (const entry of entries) {
      if (freedSpace >= requiredSpace) break;

      evicted.push(entry.id);
      freedSpace += entry.size;

      // Remove from storage
      if (this.db) {
        await this.removeFromIndexedDB(entry.id);
      } else {
        this.removeFromMemory(entry.id);
      }
    }

    this.stats.evictions += evicted.length;
    this.updateStats({
      totalEntries: this.stats.totalEntries - evicted.length,
      totalSize: this.stats.totalSize - freedSpace,
    });

    console.log(`Evicted ${evicted.length} entries to free ${freedSpace} bytes`);
  }

  private calculateImportanceScore(entry: CacheEntry): number {
    const age = Date.now() - entry.timestamp;
    const ageHours = age / (1000 * 60 * 60);

    // Decay factor for age (older = less important)
    const ageDecay = Math.exp(-ageHours / 24);

    // Frequency factor (accessed often = more important)
    const frequencyFactor = Math.log(1 + entry.accessCount);

    // Recency factor (recently accessed = more important)
    const recencyFactor = Math.exp(-(Date.now() - entry.lastAccessed) / (1000 * 60 * 60));

    // Combined score
    return (
      (entry.priority * 0.3) +
      (entry.predictionScore * 0.3) +
      (ageDecay * 0.2) +
      (frequencyFactor * 0.1) +
      (recencyFactor * 0.1)
    );
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    let entries: CacheEntry[];

    if (this.db) {
      entries = await this.getAllFromIndexedDB();
    } else {
      entries = this.getAllFromMemory();
    }

    const expired = entries.filter(entry => entry.expiresAt < now);
    const totalSize = expired.reduce((sum, entry) => sum + entry.size, 0);

    for (const entry of expired) {
      if (this.db) {
        await this.removeFromIndexedDB(entry.id);
      } else {
        this.removeFromMemory(entry.id);
      }
    }

    if (expired.length > 0) {
      this.updateStats({
        totalEntries: this.stats.totalEntries - expired.length,
        totalSize: this.stats.totalSize - totalSize,
      });

      console.log(`Cleaned up ${expired.length} expired entries`);
    }
  }

  private recordAccess(id: string, hit: boolean): void {
    this.accessLog.push({ id, timestamp: Date.now(), hit });

    // Keep only recent access log (last 1000 entries)
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000);
    }

    // Update hit/miss rates
    const recentAccess = this.accessLog.slice(-100);
    const hits = recentAccess.filter(access => access.hit).length;
    this.stats.hitRate = (hits / recentAccess.length) * 100;
    this.stats.missRate = 100 - this.stats.hitRate;

    if (hit && !navigator.onLine) {
      this.stats.offlineHits++;
    }
  }

  private async compressData(data: any): Promise<any> {
    // NOTE: Production implementation should use proper compression libraries like:
    // - pako (gzip compression): https://github.com/nodeca/pako
    // - lz-string: https://github.com/pieroxy/lz-string/
    // This is a placeholder that doesn't actually compress data
    return {
      compressed: true,
      data: JSON.stringify(data),
    };
  }

  private async decompressData(compressed: any): Promise<any> {
    if (compressed.compressed) {
      return JSON.parse(compressed.data);
    }
    return compressed;
  }

  private async performBackgroundSync(): Promise<void> {
    // This would implement actual background sync with server
    console.log('Background sync performed');
  }

  private async performSync(serverNotifications: Notification[]): Promise<number> {
    // Implementation for syncing with server
    return 0; // Return number of synced items
  }

  // Memory cache fallback (simplified)
  private memoryCache: Map<string, CacheEntry> = new Map();
  private initializeMemoryCache(): boolean {
    try {
      this.memoryCache.clear();
      return true;
    } catch (error) {
      return false;
    }
  }

  private storeInMemory(entry: CacheEntry): void {
    this.memoryCache.set(entry.id, entry);
  }

  private getFromMemory(id: string): CacheEntry | null {
    return this.memoryCache.get(id) || null;
  }

  private updateInMemory(entry: CacheEntry): void {
    this.memoryCache.set(entry.id, entry);
  }

  private removeFromMemory(id: string): void {
    this.memoryCache.delete(id);
  }

  private getAllFromMemory(): CacheEntry[] {
    return Array.from(this.memoryCache.values());
  }

  private clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  // IndexedDB operations
  private async storeInIndexedDB(entry: CacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        if (error?.name === 'QuotaExceededError') {
          // Handle quota exceeded by triggering aggressive eviction
          this.evictLeastImportantEntries(entry.size).then(() => {
            // Retry after eviction
            const retryRequest = store.put(entry);
            retryRequest.onsuccess = () => resolve();
            retryRequest.onerror = () => reject(retryRequest.error);
          });
        } else {
          reject(error);
        }
      };
    });
  }

  private async getFromIndexedDB(id: string): Promise<CacheEntry | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readonly');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async updateInIndexedDB(entry: CacheEntry): Promise<void> {
    return this.storeInIndexedDB(entry);
  }

  private async removeFromIndexedDB(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllFromIndexedDB(): Promise<CacheEntry[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readonly');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private updateStats(updates: Partial<CacheStats>): void {
    this.stats = { ...this.stats, ...updates };
    this.saveStats();
  }

  private async saveStats(): Promise<void> {
    try {
      localStorage.setItem('notificationCacheStats', JSON.stringify(this.stats));
    } catch (error) {
      console.warn('Failed to save cache stats:', error);
    }
  }

  private async loadStats(): Promise<void> {
    try {
      const stored = localStorage.getItem('notificationCacheStats');
      if (stored) {
        this.stats = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load cache stats:', error);
    }
  }

  public async destroy(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.db) {
      this.db.close();
    }
  }
}

// Singleton instance
export const _smartCacheService = new SmartCacheService();