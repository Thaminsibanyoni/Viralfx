import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AdminUser, AdminRole, AdminPermission } from '../types/admin.types';
import { adminApi } from '../services/api/admin.api';

interface AdminState {
  // Auth state
  admin: AdminUser | null;
  isAuthenticated: boolean;
  permissions: string[];
  loading: boolean;
  error: string | null;

  // Dashboard state
  dashboardMetrics: any | null;
  systemHealth: any | null;
  alerts: any[] | null;

  // Notifications state
  notifications: any[];

  // WebSocket connection
  wsConnection: WebSocket | null;

  // Actions
  setAdmin: (admin: AdminUser | null) => void;
  setPermissions: (permissions: string[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setNotifications: (notifications: any[]) => void;
  addNotification: (notification: any) => void;
  markNotificationAsRead: (notificationId: string) => void;

  // Auth actions
  login: (credentials: { email: string; password: string; twoFactorCode?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  getProfile: () => Promise<void>;

  // Permission checks
  checkPermission: (permission: string) => boolean;
  hasRole: (role: AdminRole) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;

  // Dashboard actions
  fetchDashboardMetrics: (timeframe?: string) => Promise<void>;
  fetchSystemHealth: () => Promise<void>;
  fetchAlerts: () => Promise<void>;

  // WebSocket actions
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;

  // Clear state
  clearState: () => void;
}

export const useAdminStore = create<AdminState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        admin: null,
        isAuthenticated: false,
        permissions: [],
        loading: false,
        error: null,
        dashboardMetrics: null,
        systemHealth: null,
        alerts: [],
        notifications: [],
        wsConnection: null,

        // Setters
        setAdmin: (admin) => set({ admin }),
        setPermissions: (permissions) => set({ permissions }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),
        clearError: () => set({ error: null }),
        setNotifications: (notifications) => set({ notifications }),
        addNotification: (notification) => {
          const currentNotifications = get().notifications;
          set({ notifications: [notification, ...currentNotifications] });
        },
        markNotificationAsRead: (notificationId) => {
          const currentNotifications = get().notifications;
          const updatedNotifications = currentNotifications.map((notif: any) =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          );
          set({ notifications: updatedNotifications });
        },

        // Auth actions
        login: async (credentials) => {
          set({ loading: true, error: null });
          try {
            const response = await adminApi.adminLogin(credentials);

            // Store tokens
            localStorage.setItem('admin_access_token', response.tokens.accessToken);
            localStorage.setItem('admin_refresh_token', response.tokens.refreshToken);
            localStorage.setItem('admin_token_expires', response.tokens.expiresIn);

            // Store admin data
            set({
              admin: response.admin,
              permissions: response.permissions,
              isAuthenticated: true,
              loading: false,
            });

            // Connect WebSocket
            get().connectWebSocket();

          } catch (error: any) {
            set({
              error: error.response?.data?.message || 'Login failed',
              loading: false,
            });
            throw error;
          }
        },

        logout: async () => {
          try {
            // Call logout API
            if (get().isAuthenticated) {
              await adminApi.adminLogout();
            }
          } catch (error) {
            console.error('Logout API error:', error);
          } finally {
            // Clear local storage
            localStorage.removeItem('admin_access_token');
            localStorage.removeItem('admin_refresh_token');
            localStorage.removeItem('admin_token_expires');

            // Disconnect WebSocket
            get().disconnectWebSocket();

            // Clear state
            set({
              admin: null,
              permissions: [],
              isAuthenticated: false,
              dashboardMetrics: null,
              systemHealth: null,
              alerts: [],
              notifications: [],
            });
          }
        },

        refreshToken: async () => {
          try {
            const refreshToken = localStorage.getItem('admin_refresh_token');
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            const response = await adminApi.refreshToken(refreshToken);

            // Update tokens
            localStorage.setItem('admin_access_token', response.accessToken);
            localStorage.setItem('admin_refresh_token', response.refreshToken);
            localStorage.setItem('admin_token_expires', response.expiresIn);

            // Update expiration time
            const expiresAt = Date.now() + (response.expiresIn * 1000);
            localStorage.setItem('admin_token_expires_at', expiresAt.toString());

          } catch (error) {
            console.error('Token refresh failed:', error);
            get().logout();
            throw error;
          }
        },

        getProfile: async () => {
          try {
            const response = await adminApi.getAdminProfile();
            set({
              admin: response.admin,
              permissions: response.permissions,
            });
          } catch (error) {
            console.error('Failed to fetch profile:', error);
            throw error;
          }
        },

        // Permission checks
        checkPermission: (permission) => {
          const {admin, permissions} = get();

          // SuperAdmin has all permissions
          if (admin?.isSuperAdmin || admin?.role === 'SUPER_ADMIN') {
            return true;
          }

          // Check specific permission
          return permissions.includes(permission);
        },

        hasRole: (role) => {
          const {admin} = get();
          return admin?.role === role;
        },

        hasAnyPermission: (requiredPermissions) => {
          const {admin, permissions} = get();

          // SuperAdmin has all permissions
          if (admin?.isSuperAdmin || admin?.role === 'SUPER_ADMIN') {
            return true;
          }

          return permissions.some(permission => permissions.includes(permission));
        },

        hasAllPermissions: (requiredPermissions) => {
          const {admin, permissions} = get();

          // SuperAdmin has all permissions
          if (admin?.isSuperAdmin || admin?.role === 'SUPER_ADMIN') {
            return true;
          }

          return permissions.every(permission => permissions.includes(permission));
        },

        // Dashboard actions
        fetchDashboardMetrics: async (timeframe = '24h') => {
          try {
            const metrics = await adminApi.getDashboardOverview(timeframe);
            set({ dashboardMetrics: metrics });
          } catch (error) {
            console.error('Failed to fetch dashboard metrics:', error);
          }
        },

        fetchSystemHealth: async () => {
          try {
            const health = await adminApi.getSystemHealth();
            set({ systemHealth: health });
          } catch (error) {
            console.error('Failed to fetch system health:', error);
          }
        },

        fetchAlerts: async () => {
          try {
            const alerts = await adminApi.getSystemAlerts();
            set({ alerts });
          } catch (error) {
            console.error('Failed to fetch alerts:', error);
          }
        },

        // WebSocket actions
        connectWebSocket: () => {
          const token = localStorage.getItem('admin_access_token');
          if (!token) return;

          const wsUrl = `${import.meta.env.VITE_ADMIN_WS_URL || 'ws://localhost:3000/admin'}?token=${token}`;
          const ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            console.log('Admin WebSocket connected');
            set({ wsConnection: ws });
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              handleWebSocketMessage(data, set, get);
            } catch (error) {
              console.error('Failed to parse WebSocket message:', error);
            }
          };

          ws.onclose = () => {
            console.log('Admin WebSocket disconnected');
            set({ wsConnection: null });

            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
              if (get().isAuthenticated) {
                get().connectWebSocket();
              }
            }, 5000);
          };

          ws.onerror = (error) => {
            console.error('Admin WebSocket error:', error);
          };
        },

        disconnectWebSocket: () => {
          const {wsConnection} = get();
          if (wsConnection) {
            wsConnection.close();
            set({ wsConnection: null });
          }
        },

        // Clear state
        clearState: () => {
          set({
            admin: null,
            isAuthenticated: false,
            permissions: [],
            loading: false,
            error: null,
            dashboardMetrics: null,
            systemHealth: null,
            alerts: [],
            notifications: [],
          });
        },
      }),
      {
        name: 'admin-store',
        partialize: (state) => ({
          admin: state.admin,
          isAuthenticated: state.isAuthenticated,
          permissions: state.permissions,
        }),
      }
    ),
    {
      name: 'admin-store',
    }
  )
);

// WebSocket message handler
function handleWebSocketMessage(data: any, set: any, get: any) {
  const {type, payload} = data;

  switch (type) {
    case 'admin:metrics:updated':
      set({
        dashboardMetrics: payload
      });
      break;

    case 'admin:alert:new':
      const currentAlerts = get().alerts || [];
      set({
        alerts: [payload, ...currentAlerts.slice(0, 49)] // Keep latest 50 alerts
      });
      break;

    case 'admin:settings:updated':
      // Refresh platform settings
      break;

    case 'admin:notification:broadcasted':
      get().addNotification(payload);
      break;

    case 'admin:system:health:changed':
      set({
        systemHealth: payload
      });
      break;

    case 'admin:session:expired':
      // Force logout
      get().logout();
      break;

    default:
      console.log('Unknown WebSocket message type:', type);
  }
}

// Token validation helper
export const validateToken = () => {
  const token = localStorage.getItem('admin_access_token');
  const expiresAt = localStorage.getItem('admin_token_expires_at');

  if (!token) return false;

  if (expiresAt) {
    const now = Date.now();
    const expiration = parseInt(expiresAt);

    // If token expires within 5 minutes, refresh it
    if (expiration - now < 5 * 60 * 1000) {
      return 'refresh';
    }

    // If token is expired, logout
    if (now > expiration) {
      return 'expired';
    }
  }

  return 'valid';
};

// Auto-refresh token interval
let tokenRefreshInterval: NodeJS.Timeout | null = null;

export const startTokenRefresh = () => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }

  // Check token every 4 minutes
  tokenRefreshInterval = setInterval(async () => {
    const validation = validateToken();
    const {isAuthenticated} = useAdminStore.getState();

    if (validation === 'refresh' && isAuthenticated) {
      try {
        await useAdminStore.getState().refreshToken();
      } catch (error) {
        console.error('Auto token refresh failed:', error);
      }
    } else if (validation === 'expired' && isAuthenticated) {
      await useAdminStore.getState().logout();
    }
  }, 4 * 60 * 1000); // 4 minutes
};

export const _stopTokenRefresh = () => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
};

// Initialize token refresh on app start
if (typeof window !== 'undefined') {
  startTokenRefresh();
}