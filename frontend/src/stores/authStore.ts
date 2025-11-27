import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { authApi } from '../services/api/auth.api';
import type { User, LoginCredentials, RegisterData } from '../types/user.types';
import type { TokenPair } from '../types/auth.types';

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  loginAttempts: number;
  lastLoginAttempt: number | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<{ user: User; tokens: TokenPair }>;
  register: (data: RegisterData) => Promise<{ user: User; tokens: TokenPair }>;
  logout: (allSessions?: boolean) => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;

  // 2FA actions
  enable2FA: (password: string) => Promise<any>;
  verify2FA: (token: string) => Promise<void>;
  disable2FA: (password: string) => Promise<void>;

  // Password actions
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;

  // Utility methods
  getAuthHeaders: () => { Authorization: string } | {};
  isTokenExpired: () => boolean;
  canRetryLogin: () => boolean;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

export const useAuthStore = create<AuthState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: false,
          loginAttempts: 0,
          lastLoginAttempt: null,

          // Login action
          login: async (credentials: LoginCredentials) => {
            const state = get();

            // Check if user is locked out
            if (!state.canRetryLogin()) {
              throw new Error('Too many failed attempts. Please try again later.');
            }

            set({ isLoading: true });

            try {
              const response = await authApi.login({
                ...credentials,
                deviceFingerprint: state.getDeviceFingerprint(),
                userAgent: navigator.userAgent,
              });

              // Handle 2FA requirement
              if (response.requiresTwoFactor) {
                set({
                  isLoading: false,
                  loginAttempts: state.loginAttempts + 1,
                  lastLoginAttempt: Date.now(),
                });
                throw new Error('Two-factor authentication required');
              }

              // Successful login
              set({
                user: response.user,
                accessToken: response.tokens.accessToken,
                refreshToken: response.tokens.refreshToken,
                isAuthenticated: true,
                isLoading: false,
                loginAttempts: 0,
                lastLoginAttempt: null,
                isInitialized: true,
              });

              // Set up token refresh
              state.setupTokenRefresh();

              return response;
            } catch (error: any) {
              set({
                isLoading: false,
                loginAttempts: state.loginAttempts + 1,
                lastLoginAttempt: Date.now(),
              });
              throw error;
            }
          },

          // Register action
          register: async (data: RegisterData) => {
            set({ isLoading: true });

            try {
              const response = await authApi.register(data);

              set({
                user: response.user,
                accessToken: response.tokens.accessToken,
                refreshToken: response.tokens.refreshToken,
                isAuthenticated: true,
                isLoading: false,
                isInitialized: true,
              });

              // Set up token refresh
              get().setupTokenRefresh();

              return response;
            } catch (error) {
              set({ isLoading: false });
              throw error;
            }
          },

          // Logout action
          logout: async (allSessions = false) => {
            const {accessToken, user} = get();

            // Call logout API (don't wait for it)
            if (accessToken && user) {
              authApi.logout(allSessions).catch(console.error);
            }

            // Clear state
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              loginAttempts: 0,
              lastLoginAttempt: null,
            });

            // Clear token refresh
            get().clearTokenRefresh();
          },

          // Refresh authentication
          refreshAuth: async () => {
            const {refreshToken} = get();

            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            try {
              const tokens = await authApi.refreshToken({ refreshToken });

              set({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
              });

              // Set up new token refresh
              get().setupTokenRefresh();
            } catch (error) {
              // Refresh failed, clear auth state
              set({
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false,
                loginAttempts: 0,
                lastLoginAttempt: null,
              });

              get().clearTokenRefresh();
              throw error;
            }
          },

          // Update user data
          updateUser: (userData: Partial<User>) => {
            set((state) => ({
              user: state.user ? { ...state.user, ...userData } : null,
            }));
          },

          // Set loading state
          setLoading: (loading: boolean) => {
            set({ isLoading: loading });
          },

          // Clear errors (placeholder for error handling)
          clearError: () => {
            // Could be expanded to handle specific error states
          },

          // Enable 2FA
          enable2FA: async (password: string) => {
            const response = await authApi.enable2FA({ password });
            return response;
          },

          // Verify 2FA
          verify2FA: async (token: string) => {
            await authApi.verify2FA({ token });

            // Update user state
            set((state) => ({
              user: state.user ? { ...state.user, twoFactorEnabled: true } : null,
            }));
          },

          // Disable 2FA
          disable2FA: async (password: string) => {
            await authApi.disable2FA(password);

            // Update user state
            set((state) => ({
              user: state.user ? { ...state.user, twoFactorEnabled: false } : null,
            }));
          },

          // Forgot password
          forgotPassword: async (email: string) => {
            await authApi.forgotPassword(email);
          },

          // Reset password
          resetPassword: async (token: string, password: string) => {
            await authApi.resetPassword(token, password);
          },

          // Change password
          changePassword: async (oldPassword: string, newPassword: string) => {
            await authApi.changePassword(oldPassword, newPassword);
          },

          // Get auth headers for API calls
          getAuthHeaders: () => {
            const {accessToken} = get();
            return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
          },

          // Check if token is expired
          isTokenExpired: () => {
            const {accessToken} = get();

            if (!accessToken) return true;

            try {
              const payload = JSON.parse(atob(accessToken.split('.')[1]));
              const now = Date.now() / 1000;
              return payload.exp < now;
            } catch {
              return true;
            }
          },

          // Check if user can retry login
          canRetryLogin: () => {
            const {loginAttempts, lastLoginAttempt} = get();

            if (loginAttempts < MAX_LOGIN_ATTEMPTS) return true;

            if (!lastLoginAttempt) return true;

            return Date.now() - lastLoginAttempt > LOCK_TIME;
          },

          // Utility: Get device fingerprint
          getDeviceFingerprint: () => {
            // Simple fingerprinting - in production, use a more sophisticated method
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.textBaseline = 'top';
              ctx.font = '14px Arial';
              ctx.fillText('Device fingerprint', 2, 2);
            }

            const fingerprint = [
              navigator.userAgent,
              navigator.language,
              screen.width + 'x' + screen.height,
              new Date().getTimezoneOffset(),
              canvas.toDataURL(),
            ].join('|');

            return btoa(fingerprint);
          },

          // Setup token refresh timer
          setupTokenRefresh: () => {
            const {accessToken} = get();

            if (!accessToken) return;

            try {
              const payload = JSON.parse(atob(accessToken.split('.')[1]));
              const expirationTime = payload.exp * 1000;
              const refreshTime = expirationTime - 5 * 60 * 1000; // 5 minutes before expiry

              const timeout = refreshTime - Date.now();

              if (timeout > 0) {
                setTimeout(() => {
                  get().refreshAuth().catch(console.error);
                }, timeout);
              }
            } catch (error) {
              console.error('Failed to setup token refresh:', error);
            }
          },

          // Clear token refresh timer
          clearTokenRefresh: () => {
            // In a real implementation, you'd clear the timeout here
            // This is a placeholder
          },
        }),
        {
          name: 'viralfx-auth-storage',
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({
            user: state.user,
            accessToken: state.accessToken,
            refreshToken: state.refreshToken,
            isAuthenticated: state.isAuthenticated,
            loginAttempts: state.loginAttempts,
            lastLoginAttempt: state.lastLoginAttempt,
          }),
          onRehydrateStorage: () => (state) => {
            if (state) {
              state.isInitialized = true;

              // Check if token is expired on rehydrate
              if (state.accessToken && state.isTokenExpired()) {
                state.refreshAuth().catch(() => {
                  // If refresh fails, clear auth state
                  state.user = null;
                  state.accessToken = null;
                  state.refreshToken = null;
                  state.isAuthenticated = false;
                });
              }
            }
          },
        }
      )
    ),
    { name: 'AuthStore' }
  )
);

// Hook to initialize auth on app start
export const _useInitializeAuth = () => {
  const {isInitialized, accessToken, refreshAuth} = useAuthStore();

  React.useEffect(() => {
    if (!isInitialized) {
      // Will be handled by onRehydrateStorage
      return;
    }

    if (accessToken) {
      // Set up initial token refresh
      const store = useAuthStore.getState();
      store.setupTokenRefresh();
    }
  }, [isInitialized, accessToken, refreshAuth]);
};