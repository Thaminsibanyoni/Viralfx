import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { message } from 'antd';
import { logDebug, logWarn, logError } from '../logger';

// API Client Configuration
const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/api/v1';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiClient {
  private instance: AxiosInstance;
  private isRefreshing: boolean = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    this.instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000, // 10 seconds
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - Add auth token
    this.instance.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();

        // Log requests
        logDebug(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data,
        });

        return config;
      },
      (error) => {
        logError('[API Request Error]', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle common responses and errors
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log successful responses
        logDebug(`[API Response] ${response.status} ${response.config.url}`, response.data);

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config;

        // Log errors
        logError(`[API Error] ${error.response?.status} ${error.config?.url}`, {
          message: error.message,
          response: error.response?.data,
        });

        // Handle token refresh for 401 errors
        if (error.response?.status === 401 && originalRequest && !this.isRetryRequest(originalRequest)) {
          // Prevent multiple concurrent refresh attempts
          if (this.isRefreshing) {
            // Queue the request if a refresh is already in progress
            return new Promise((resolve, reject) => {
              this.refreshSubscribers.push((token: string) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                originalRequest._retry = true;
                resolve(this.instance(originalRequest));
              });
            });
          }

          this.isRefreshing = true;

          try {
            await this.refreshToken();

            // Retry the original request with new token
            const token = this.getAuthToken();
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              originalRequest._retry = true;

              // Process queued requests
              this.refreshSubscribers.forEach(callback => callback(token));
              this.refreshSubscribers = [];

              return this.instance(originalRequest);
            }
          } catch (refreshError) {
            // Token refresh failed, clear queue and redirect to login
            this.refreshSubscribers = [];
            this.handleAuthError();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        // Handle other error types
        this.handleError(error);

        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    try {
      return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    } catch (error) {
      logWarn('Failed to get auth token:', error);
      return null;
    }
  }

  private async refreshToken(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      const {token, refreshToken: newRefreshToken} = response.data.data;

      // Store new tokens
      if (localStorage.getItem('authToken')) {
        localStorage.setItem('authToken', token);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }
      } else {
        sessionStorage.setItem('authToken', token);
        if (newRefreshToken) {
          sessionStorage.setItem('refreshToken', newRefreshToken);
        }
      }
    } catch (error) {
      throw new Error('Token refresh failed');
    }
  }

  private isRetryRequest(config: any): boolean {
    return config._retry === true;
  }

  private handleAuthError(): void {
    // Prevent redirect loops - only redirect if not already on login page
    const currentPath = window.location.pathname;
    if (currentPath === '/login' || currentPath === '/register') {
      return;
    }

    // Clear stored tokens
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('refreshToken');

    // Use React Router's navigate instead of hard redirect to preserve state
    // Only use hard redirect as fallback
    if (!this.isReactRouterAvailable()) {
      window.location.href = '/login';
    } else {
      // Trigger a custom event that the app can listen to
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }

  private isReactRouterAvailable(): boolean {
    // Check if we're in a React app context
    try {
      return document.querySelector('[data-reactroot]') !== null ||
             window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined;
    } catch {
      return false;
    }
  }

  private handleError(error: AxiosError): void {
    const status = error.response?.status;
    const data = error.response?.data as any;

    switch (status) {
      case 400:
        this.showValidationError(data?.message || 'Bad request');
        break;
      case 401:
        this.showValidationError(data?.message || 'Authentication required');
        break;
      case 403:
        this.showValidationError(data?.message || 'Access denied');
        break;
      case 404:
        this.showValidationError(data?.message || 'Resource not found');
        break;
      case 422:
        this.showValidationError(data?.message || 'Validation error');
        break;
      case 429:
        this.showValidationError('Too many requests. Please try again later.');
        break;
      case 500:
        this.showValidationError(data?.message || 'Server error. Please try again later.');
        break;
      case 502:
      case 503:
      case 504:
        this.showValidationError('Service unavailable. Please try again later.');
        break;
      default:
        // Network errors or other issues
        if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
          console.error('Backend connection failed. Is the backend running on port 3000?');
          this.showValidationError({
            message: 'Unable to connect to server. Please ensure the backend is running.',
            userMessage: 'Connection failed. The server may be offline. Please try again later.',
          });
        } else {
          this.showValidationError('An unexpected error occurred. Please try again.');
        }
    }
  }

  private showValidationError(errorMessage: string | { message: string; userMessage?: string }): void {
    let displayMessage: string;
    let consoleMessage: string;

    if (typeof errorMessage === 'string') {
      displayMessage = errorMessage;
      consoleMessage = `[API Error] ${errorMessage}`;
    } else {
      displayMessage = errorMessage.userMessage || errorMessage.message;
      consoleMessage = `[API Error] ${errorMessage.message}`;
    }

    // Avoid showing multiple error messages for the same issue
    if (!this.isDuplicateMessage(consoleMessage)) {
      message.error({
        content: displayMessage,
        duration: 5,
        key: 'api-error',
      });
    }
  }

  private isDuplicateMessage(message: string): boolean {
    // Simple check to prevent duplicate messages
    return false; // Allow all messages for now, could be enhanced with message deduplication
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.get(url, config);
    return response.data;
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.post(url, data, config);
    return response.data;
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.put(url, data, config);
    return response.data;
  }

  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.patch(url, data, config);
    return response.data;
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.delete(url, config);
    return response.data;
  }

  // Specialized methods for notifications with offline support
  public async getNotifications<T = any>(params?: any): Promise<ApiResponse<T>> {
    try {
      return await this.get('/notifications', { params });
    } catch (error) {
      // Fallback to cached notifications if offline
      if (this.isNetworkError(error)) {
        return this.getCachedNotifications();
      }
      throw error;
    }
  }

  public async markNotificationAsRead(id: string): Promise<ApiResponse<any>> {
    try {
      return await this.patch(`/notifications/${id}/read`);
    } catch (error) {
      // Queue action for later sync if offline
      if (this.isNetworkError(error)) {
        this.queueNotificationAction({ type: 'mark_read', id, timestamp: Date.now() });
        return { success: true, message: 'Action queued for sync when online' };
      }
      throw error;
    }
  }

  private isNetworkError(error: any): boolean {
    return (
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('Network Error') ||
      !navigator.onLine
    );
  }

  private async getCachedNotifications(): Promise<ApiResponse<any>> {
    try {
      const cached = localStorage.getItem('cachedNotifications');
      if (cached) {
        const data = JSON.parse(cached);
        const now = Date.now();

        // Check if cache is still valid (30 minutes)
        if (now - data.timestamp < 30 * 60 * 1000) {
          return {
            success: true,
            data: data.notifications,
            message: 'Showing cached notifications (offline mode)',
          };
        }
      }
    } catch (error) {
      logWarn('Failed to get cached notifications:', error);
    }

    return {
      success: false,
      message: 'No cached notifications available',
    };
  }

  private queueNotificationAction(action: any): void {
    try {
      const queue = JSON.parse(localStorage.getItem('notificationActionQueue') || '[]');
      queue.push(action);
      localStorage.setItem('notificationActionQueue', JSON.stringify(queue));
    } catch (error) {
      logWarn('Failed to queue notification action:', error);
    }
  }

  // Health check method
  public async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; timestamp: string }> {
    try {
      const response = await this.get('/health');
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Check backend health with shorter timeout
  public async checkBackendHealth(): Promise<boolean> {
    try {
      await this.get('/health', { timeout: 3000 });
      return true;
    } catch {
      console.warn('Backend health check failed. Some features may be unavailable.');
      return false;
    }
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Export both the instance and class for testing
export default apiClient;
export { apiClient, ApiClient, type ApiResponse };