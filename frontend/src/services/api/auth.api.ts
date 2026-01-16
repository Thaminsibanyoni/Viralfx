import { apiClient } from './client';
import type {
  LoginRequest, RegisterRequest, LoginResponse, RegisterResponse, TokenPair, User, TwoFactorSetup, PasswordResetRequest, PasswordResetConfirm, ChangePasswordRequest, } from '../../types/auth.types';

class AuthAPI {
  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // Transform email to identifier for backend compatibility
    const loginData = {
      identifier: credentials.email || credentials.identifier || credentials.username || '',
      password: credentials.password,
      twoFactorCode: credentials.twoFactorCode,
      deviceFingerprint: credentials.deviceFingerprint,
      userAgent: credentials.userAgent,
    };
    const response = await apiClient.post('/auth/login', loginData);

    // Handle both wrapped and unwrapped responses
    // Backend returns: { success, data: { user, tokens, ... } }
    // apiClient.post returns AxiosResponse where response.data is the body
    if (response.data && response.data.data) {
      // Wrapped response - extract inner data
      return response.data.data as LoginResponse;
    }
    // Unwrapped response or error
    return response.data as LoginResponse;
  }

  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    const response = await apiClient.post('/auth/register', userData);

    // Handle both wrapped and unwrapped responses
    if (response.data && response.data.data) {
      return response.data.data as RegisterResponse;
    }
    return response.data as RegisterResponse;
  }

  async logout(allSessions: boolean = false): Promise<void> {
    await apiClient.post('/auth/logout', { allSessions });
  }

  // Token management
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const response = await apiClient.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  async verifyEmail(token: string): Promise<void> {
    await apiClient.post('/auth/verify-email', { token });
  }

  async resendVerification(email: string): Promise<void> {
    await apiClient.post('/auth/resend-verification', { email });
  }

  // Two-factor authentication
  async enable2FA(password: string): Promise<TwoFactorSetup> {
    const response = await apiClient.post('/auth/2fa/enable', { password });
    return response.data;
  }

  async verify2FA(token: string): Promise<boolean> {
    const response = await apiClient.post('/auth/2fa/verify', { token });
    return response.data.success;
  }

  async disable2FA(password: string, token: string): Promise<void> {
    await apiClient.post('/auth/2fa/disable', { password, token });
  }

  async generateBackupCodes(): Promise<string[]> {
    const response = await apiClient.post('/auth/2fa/backup-codes');
    return response.data.backupCodes;
  }

  // Password management
  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password });
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await apiClient.post('/auth/change-password', data);
  }

  async validateResetToken(token: string): Promise<boolean> {
    const response = await apiClient.post('/auth/validate-reset-token', { token });
    return response.data.valid;
  }

  // User profile
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get('/auth/me');
    return response.data;
  }

  async updateProfile(userData: Partial<User>): Promise<User> {
    const response = await apiClient.put('/auth/profile', userData);
    return response.data;
  }

  async changeEmail(newEmail: string, password: string): Promise<void> {
    await apiClient.post('/auth/change-email', { newEmail, password });
  }

  async verifyEmailChange(token: string): Promise<void> {
    await apiClient.post('/auth/verify-email-change', { token });
  }

  // Security settings
  async getActiveSessions(): Promise<any[]> {
    const response = await apiClient.get('/auth/sessions');
    return response.data.sessions;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await apiClient.delete(`/auth/sessions/${sessionId}`);
  }

  async enableBiometricAuth(): Promise<void> {
    await apiClient.post('/auth/biometric/enable');
  }

  async disableBiometricAuth(): Promise<void> {
    await apiClient.post('/auth/biometric/disable');
  }

  // Account management
  async deactivateAccount(password: string): Promise<void> {
    await apiClient.post('/auth/deactivate', { password });
  }

  async deleteAccount(password: string, confirmation: string): Promise<void> {
    await apiClient.post('/auth/delete', { password, confirmation });
  }

  async requestAccountDeletion(): Promise<string> {
    const response = await apiClient.post('/auth/request-deletion');
    return response.data.deletionToken;
  }

  // Social authentication
  async getOAuthUrl(provider: 'google' | 'apple' | 'facebook'): Promise<string> {
    const response = await apiClient.get(`/auth/oauth/${provider}/url`);
    return response.data.url;
  }

  async handleOAuthCallback(provider: string, code: string, state: string): Promise<LoginResponse> {
    const response = await apiClient.post(`/auth/oauth/${provider}/callback`, { code, state });
    return response.data;
  }

  async linkSocialAccount(provider: string, token: string): Promise<void> {
    await apiClient.post(`/auth/social/link/${provider}`, { token });
  }

  async unlinkSocialAccount(provider: string): Promise<void> {
    await apiClient.delete(`/auth/social/unlink/${provider}`);
  }

  // KYC and verification
  async submitKYC(kycData: any): Promise<void> {
    await apiClient.post('/auth/kyc/submit', kycData);
  }

  async getKYCStatus(): Promise<any> {
    const response = await apiClient.get('/auth/kyc/status');
    return response.data;
  }

  async uploadKYCDocument(type: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('document', file);

    await apiClient.post('/auth/kyc/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // Device management
  async registerDevice(deviceInfo: any): Promise<void> {
    await apiClient.post('/auth/devices/register', deviceInfo);
  }

  async getRegisteredDevices(): Promise<any[]> {
    const response = await apiClient.get('/auth/devices');
    return response.data.devices;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await apiClient.delete(`/auth/devices/${deviceId}`);
  }

  // Rate limiting
  async checkRateLimit(action: string): Promise<{ remaining: number; resetTime: number }> {
    const response = await apiClient.get(`/auth/rate-limit/${action}`);
    return response.data;
  }

  // Security audit
  async getSecurityLog(): Promise<any[]> {
    const response = await apiClient.get('/auth/security/log');
    return response.data.log;
  }

  async acknowledgeSecurityAlert(alertId: string): Promise<void> {
    await apiClient.post(`/auth/security/acknowledge/${alertId}`);
  }
}

// Create and export singleton instance
export const authApi = new AuthAPI();

// Export default for convenience
export default authApi;