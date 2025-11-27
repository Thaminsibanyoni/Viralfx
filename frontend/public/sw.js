/**
 * Predictive Notification Preloading - Service Worker
 *
 * Advanced service worker for background synchronization, offline caching,
 * and intelligent notification preloading with battery optimization.
 */

const CACHE_NAME = 'viralfx-notifications-v1';
const PREDICTIVE_CACHE_NAME = 'viralfx-predictive-v1';

// Configuration
const CONFIG = {
  CACHE_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  SYNC_INTERVAL: 15 * 60 * 1000, // 15 minutes
  PREDICTION_INTERVAL: 5 * 60 * 1000, // 5 minutes
  BATTERY_OPTIMIZATION: true,
  OFFLINE_FIRST: true,
  NETWORK_CHECK_INTERVAL: 30 * 1000, // 30 seconds
};

// State management
let isOnline = navigator.onLine;
let batteryLevel = 1.0;
let isCharging = false;
let lastSyncTime = 0;
let predictiveModelLoaded = false;

// IndexedDB setup for service worker state
const SW_STATE_DB = 'SWStateDB';
const SW_STATE_VERSION = 1;

/**
 * Open IndexedDB for service worker state storage
 */
async function openSWDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SW_STATE_DB, SW_STATE_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Get value from IndexedDB
 */
async function getState(key) {
  try {
    const db = await openSWDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['state'], 'readonly');
      const store = transaction.objectStore('state');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('SW: Failed to get state from IndexedDB:', error);
    return null;
  }
}

/**
 * Set value in IndexedDB
 */
async function setState(key, value) {
  try {
    const db = await openSWDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['state'], 'readwrite');
      const store = transaction.objectStore('state');
      const request = store.put({
        key,
        value,
        timestamp: Date.now()
      });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('SW: Failed to set state in IndexedDB:', error);
  }
}

// Initialize service worker
self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache essential files
        return cache.addAll([
          '/',
          '/static/js/bundle.js',
          '/static/css/main.css',
        ]);
      })
      .then(() => {
        console.log('SW: Installation complete');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== PREDICTIVE_CACHE_NAME) {
              console.log('SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('SW: Activation complete');
        return self.clients.claim();
      })
      .then(() => {
        // Initialize monitoring
        initializeMonitoring();
        startBackgroundTasks();
      })
  );
});

// Fetch event with offline-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // API requests for notifications
  if (url.pathname.includes('/api/notifications')) {
    event.respondWith(handleNotificationAPI(request));
    return;
  }

  // Static resources - cache first
  if (url.pathname.includes('/static/')) {
    event.respondWith(handleStaticResource(request));
    return;
  }

  // Navigation requests - network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
});

// Background sync
self.addEventListener('sync', (event) => {
  console.log('SW: Background sync triggered:', event.tag);

  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  } else if (event.tag === 'predictive-preload') {
    event.waitUntil(performPredictivePreload());
  }
});

// Periodic background sync (if supported)
if ('serviceWorker' in navigator && 'periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    console.log('SW: Periodic background sync triggered:', event.tag);

    if (event.tag === 'notification-sync') {
      event.waitUntil(syncNotifications());
    } else if (event.tag === 'predictive-preload') {
      event.waitUntil(performPredictivePreload());
    }
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('SW: Push notification received');

  if (!event.data) {
    return;
  }

  const notificationData = event.data.json();

  // Cache the notification immediately
  cacheNotification(notificationData)
    .then(() => {
      // Show notification if user is not active
      return showNotification(notificationData);
    })
    .catch((error) => {
      console.error('SW: Failed to handle push notification:', error);
    });
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('SW: Notification clicked');

  event.notification.close();

  const notificationData = event.notification.data;
  const urlToOpen = notificationData.actionUrl || '/notifications';

  event.waitUntil(
    clients.matchAll()
      .then((clientList) => {
        // Focus existing client if available
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        // Open new client
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Request handling functions

async function handleNotificationAPI(request) {
  try {
    // Try network first for GET requests
    if (request.method === 'GET') {
      const networkResponse = await fetchNetworkFirst(request);
      if (networkResponse) {
        return networkResponse;
      }
    }

    // Fallback to cache for GET requests
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    // For POST requests, store for later sync if offline
    if (!isOnline && request.method === 'POST') {
      await storeForLaterSync(request);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Request queued for sync when online'
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Default to network
    return fetch(request);
  } catch (error) {
    console.error('SW: Network request failed:', error);

    // Return cached version if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'No cached version available'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleStaticResource(request) {
  // Cache first strategy for static resources
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('SW: Failed to fetch static resource:', error);
    return new Response('Resource not available offline', { status: 503 });
  }
}

async function handleNavigationRequest(request) {
  // Network first for navigation requests
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('SW: Network request failed, trying cache');
  }

  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Return offline page
  return caches.match('/offline.html') ||
         new Response('Offline', { status: 503 });
}

// Background sync functions

async function syncNotifications() {
  if (!isOnline) {
    console.log('SW: Offline, skipping sync');
    return;
  }

  console.log('SW: Syncing notifications');

  try {
    // Get queued requests
    const queuedRequests = await getQueuedRequests();

    // Sync each request
    for (const queuedRequest of queuedRequests) {
      try {
        await fetch(queuedRequest.request);
        await removeQueuedRequest(queuedRequest.id);
        console.log('SW: Synced queued request:', queuedRequest.id);
      } catch (error) {
        console.error('SW: Failed to sync queued request:', queuedRequest.id, error);
      }
    }

    // Fetch latest notifications
    await fetchLatestNotifications();

    lastSyncTime = Date.now();
    await updateSyncStatus();

    console.log('SW: Sync completed');
  } catch (error) {
    console.error('SW: Sync failed:', error);
  }
}

async function performPredictivePreload() {
  if (CONFIG.BATTERY_OPTIMIZATION && !(await shouldPerformPreload())) {
    console.log('SW: Battery optimization - skipping preload');
    return;
  }

  console.log('SW: Performing predictive preload');

  try {
    // Get user behavior prediction
    const prediction = await getPredictionData();

    if (prediction.probability > 0.7) {
      // Fetch notifications to preload
      const notificationsToPreload = await getNotificationsForPreload(prediction);

      // Cache the notifications
      for (const notification of notificationsToPreload) {
        await cacheNotification(notification);
      }

      console.log(`SW: Preloaded ${notificationsToPreload.length} notifications`);
    }
  } catch (error) {
    console.error('SW: Predictive preload failed:', error);
  }
}

// Cache management

async function cacheNotification(notification) {
  try {
    const cache = await caches.open(PREDICTIVE_CACHE_NAME);
    const request = new Request(`/api/notifications/${notification.id}`, {
      method: 'GET',
    });

    const response = new Response(JSON.stringify(notification), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${CONFIG.CACHE_MAX_AGE}`,
        'X-Cached-Timestamp': Date.now().toString(),
      },
    });

    await cache.put(request, response);
    console.log('SW: Cached notification:', notification.id);
  } catch (error) {
    console.error('SW: Failed to cache notification:', error);
  }
}

async function getCachedNotification(id) {
  try {
    const cache = await caches.open(PREDICTIVE_CACHE_NAME);
    const request = new Request(`/api/notifications/${id}`);
    const response = await cache.match(request);

    if (response) {
      const timestamp = response.headers.get('X-Cached-Timestamp');
      const age = Date.now() - parseInt(timestamp || '0');

      // Check if cache is still valid
      if (age < CONFIG.CACHE_MAX_AGE) {
        return await response.json();
      } else {
        // Remove expired cache entry
        await cache.delete(request);
      }
    }

    return null;
  } catch (error) {
    console.error('SW: Failed to get cached notification:', error);
    return null;
  }
}

async function cleanupExpiredCache() {
  try {
    const cache = await caches.open(PREDICTIVE_CACHE_NAME);
    const requests = await cache.keys();

    const now = Date.now();
    let cleanedCount = 0;

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const timestamp = response.headers.get('X-Cached-Timestamp');
        const age = now - parseInt(timestamp || '0');

        if (age > CONFIG.CACHE_MAX_AGE) {
          await cache.delete(request);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`SW: Cleaned up ${cleanedCount} expired cache entries`);
    }
  } catch (error) {
    console.error('SW: Failed to cleanup cache:', error);
  }
}

// Utility functions

async function fetchNetworkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('SW: Network request failed, trying cache');
  }

  return null;
}

async function storeForLaterSync(request) {
  try {
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const syncRequest = {
      id,
      request: {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: await request.text(),
      },
      timestamp: Date.now(),
    };

    // Store in IndexedDB (simplified here, would use proper IDB in production)
    const db = await openSyncDB();
    await db.add('syncQueue', syncRequest);

    console.log('SW: Stored request for later sync:', id);
  } catch (error) {
    console.error('SW: Failed to store request for sync:', error);
  }
}

async function getQueuedRequests() {
  try {
    const db = await openSyncDB();
    return await db.getAll('syncQueue');
  } catch (error) {
    console.error('SW: Failed to get queued requests:', error);
    return [];
  }
}

async function removeQueuedRequest(id) {
  try {
    const db = await openSyncDB();
    await db.delete('syncQueue', id);
  } catch (error) {
    console.error('SW: Failed to remove queued request:', error);
  }
}

async function fetchLatestNotifications() {
  try {
    const response = await fetch('/api/notifications?limit=50');
    if (response.ok) {
      const notifications = await response.json();

      // Cache new notifications
      for (const notification of notifications.data || notifications) {
        await cacheNotification(notification);
      }

      console.log(`SW: Fetched and cached ${notifications.data?.length || notifications.length} notifications`);
    }
  } catch (error) {
    console.error('SW: Failed to fetch latest notifications:', error);
  }
}

async function showNotification(notification) {
  if (!('showNotification' in self.registration)) {
    return;
  }

  const options = {
    body: notification.message,
    icon: '/static/icons/icon-192x192.png',
    badge: '/static/icons/badge-72x72.png',
    tag: notification.id,
    requireInteraction: notification.priority === 'high',
    actions: notification.actionUrl ? [
      {
        action: 'view',
        title: 'View',
      },
    ] : [],
    data: notification,
  };

  return self.registration.showNotification(notification.title, options);
}

async function shouldPerformPreload() {
  // Don't preload if battery is low and not charging
  if (batteryLevel < 0.2 && !isCharging) {
    return false;
  }

  // Don't preload if user has been inactive for a while
  try {
    const lastActivity = await getState('lastUserActivity');
    if (lastActivity) {
      const inactiveTime = Date.now() - parseInt(lastActivity);
      if (inactiveTime > 30 * 60 * 1000) { // 30 minutes
        return false;
      }
    }
  } catch (error) {
    console.warn('SW: Failed to check user activity:', error);
    // Default to active if we can't check
  }

  return true;
}

async function getPredictionData() {
  // Get prediction data from IndexedDB
  try {
    const predictionData = await getState('notificationPrediction');
    if (predictionData) {
      return JSON.parse(predictionData);
    }
  } catch (error) {
    console.error('SW: Failed to get prediction data:', error);
  }

  // Default prediction
  return {
    probability: 0.5,
    confidence: 0.3,
    preferredCategories: ['system', 'security'],
    reasoning: ['Default prediction'],
  };
}

async function getNotificationsForPreload(prediction) {
  try {
    const categoryParam = prediction.preferredCategories.join(',');
    const response = await fetch(`/api/notifications?categories=${categoryParam}&limit=20&preload=true`);

    if (response.ok) {
      const data = await response.json();
      return data.data || data;
    }
  } catch (error) {
    console.error('SW: Failed to fetch notifications for preload:', error);
  }

  return [];
}

// Monitoring and optimization

function initializeMonitoring() {
  // Monitor network status
  self.addEventListener('online', () => {
    isOnline = true;
    console.log('SW: Network connection restored');

    // Trigger immediate sync
    setTimeout(() => {
      syncNotifications();
    }, 1000);
  });

  self.addEventListener('offline', () => {
    isOnline = false;
    console.log('SW: Network connection lost');
  });

  // Monitor battery status
  if ('getBattery' in navigator) {
    navigator.getBattery().then((battery) => {
      batteryLevel = battery.level;
      isCharging = battery.charging;

      battery.addEventListener('levelchange', () => {
        batteryLevel = battery.level;
        console.log('SW: Battery level changed:', batteryLevel);
      });

      battery.addEventListener('chargingchange', () => {
        isCharging = battery.charging;
        console.log('SW: Charging status changed:', isCharging);
      });
    });
  }
}

function startBackgroundTasks() {
  // Periodic sync
  setInterval(() => {
    if (isOnline) {
      syncNotifications();
    }
  }, CONFIG.SYNC_INTERVAL);

  // Predictive preload
  setInterval(() => {
    performPredictivePreload();
  }, CONFIG.PREDICTION_INTERVAL);

  // Cache cleanup
  setInterval(() => {
    cleanupExpiredCache();
  }, 60 * 60 * 1000); // Hourly

  // Register periodic sync (if supported)
  registerPeriodicSync();
}

async function registerPeriodicSync() {
  if ('serviceWorker' in navigator && 'periodicSync' in self.registration) {
    try {
      // Register for periodic notification sync (every 15 minutes)
      await self.registration.periodicSync.register('notification-sync', {
        minInterval: 15 * 60 * 1000, // 15 minutes
      });

      // Register for periodic predictive preload (every 30 minutes)
      await self.registration.periodicSync.register('predictive-preload', {
        minInterval: 30 * 60 * 1000, // 30 minutes
      });

      console.log('SW: Periodic sync registered successfully');
    } catch (error) {
      console.log('SW: Periodic sync registration failed:', error);
    }
  }
}

async function updateSyncStatus() {
  try {
    const status = {
      lastSyncTime,
      isOnline,
      batteryLevel,
      isCharging,
    };

    await setState('swSyncStatus', status);
  } catch (error) {
    console.error('SW: Failed to update sync status:', error);
  }
}

// IndexedDB helpers (simplified)
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NotificationSyncDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
    };
  });
}

// Performance monitoring
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PERFORMANCE_METRICS') {
    console.log('SW: Performance metrics received:', event.data.metrics);
    // Could send these to analytics service
  }

  // Handle client-SW communication for activity updates
  if (event.data && event.data.type === 'UPDATE_ACTIVITY') {
    setState('lastUserActivity', event.data.timestamp);
    console.log('SW: Updated user activity timestamp');
  }

  // Handle prediction updates from main thread
  if (event.data && event.data.type === 'UPDATE_PREDICTION') {
    setState('notificationPrediction', JSON.stringify(event.data.prediction));
    console.log('SW: Updated prediction data');
  }
});

console.log('SW: Service worker script loaded');