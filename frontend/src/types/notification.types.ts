export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'system' | 'trading' | 'security' | 'billing' | 'social' | 'promotion' | 'order' | 'alert' | 'broker';
  priority: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
  userId: string;
  metadata?: Record<string, any>;
}

export interface NotificationResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  inAppNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}