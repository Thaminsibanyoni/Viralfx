import apiClient from './client';

export const _notificationApi = {
  // Get all notifications for current user
  getNotifications: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    category?: string;
    read?: boolean;
    priority?: string;
  }) => {
    const response = await apiClient.get('/notifications', { params });
    return response.data;
  },

  // Get unread count
  getUnreadCount: async () => {
    const response = await apiClient.get('/notifications/unread-count');
    return response.data;
  },

  // Mark notification as read
  markAsRead: async (id: string) => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    const response = await apiClient.patch('/notifications/read-all');
    return response.data;
  },

  // Delete notification
  deleteNotification: async (id: string) => {
    const response = await apiClient.delete(`/notifications/${id}`);
    return response.data;
  },

  // Clear all notifications
  clearAll: async () => {
    const response = await apiClient.delete('/notifications');
    return response.data;
  },

  // Get notification preferences
  getPreferences: async () => {
    const response = await apiClient.get('/notifications/preferences');
    return response.data;
  },

  // Update notification preferences
  updatePreferences: async (preferences: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    smsNotifications?: boolean;
    inAppNotifications?: boolean;
    quietHours?: {
      enabled: boolean;
      start: string;
      end: string;
    };
  }) => {
    const response = await apiClient.put('/notifications/preferences', preferences);
    return response.data;
  },

  // Get notification statistics
  getStats: async () => {
    const response = await apiClient.get('/notifications/stats');
    return response.data;
  },
};

// Re-export with original name for compatibility
export const notificationApi = _notificationApi;
