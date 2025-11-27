import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { User, LoginCredentials, RegisterData } from '../types/user.types';
import type { TokenPair } from '../types/auth.types';

interface UseAuthReturn {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<{ user: User; tokens: TokenPair }>;
  register: (data: RegisterData) => Promise<{ user: User; tokens: TokenPair }>;
  logout: (allSessions?: boolean) => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;

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
  setLoading: (loading: boolean) => void;
  clearError: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const {user, isAuthenticated, isLoading, isInitialized, login, register, logout, refreshAuth, updateUser, enable2FA, verify2FA, disable2FA, forgotPassword, resetPassword, changePassword, getAuthHeaders, isTokenExpired, canRetryLogin, setLoading, clearError, } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    login,
    register,
    logout,
    refreshAuth,
    updateUser,
    enable2FA,
    verify2FA,
    disable2FA,
    forgotPassword,
    resetPassword,
    changePassword,
    getAuthHeaders,
    isTokenExpired,
    canRetryLogin,
    setLoading,
    clearError,
  };
};

export default useAuth;