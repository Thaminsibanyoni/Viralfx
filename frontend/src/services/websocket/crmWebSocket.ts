import { io, Socket } from 'socket.io-client';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  id: string;
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'ticket' | 'broker' | 'billing' | 'deal' | 'system' | 'message';
  userId?: string;
  brokerId?: string;
  clientId?: string;
  ticketId?: string;
  dealId?: string;
  invoiceId?: string;
  actionUrl?: string;
  metadata?: any;
  readAt?: string;
  createdAt: string;
}

export interface TicketUpdateData {
  ticketId: string;
  status: string;
  priority: string;
  assigneeId?: string;
  assignedBy?: string;
  message?: string;
  changes: Record<string, any>;
  timestamp: string;
}

export interface BrokerUpdateData {
  brokerId: string;
  status: string;
  complianceStatus?: string;
  changes: Record<string, any>;
  updatedBy: string;
  timestamp: string;
}

export interface DealUpdateData {
  dealId: string;
  stage: string;
  status: string;
  estimatedValue?: number;
  probability?: number;
  assignedTo?: string;
  changes: Record<string, any>;
  updatedBy: string;
  timestamp: string;
}

export interface InvoiceUpdateData {
  invoiceId: string;
  status: string;
  paymentStatus?: string;
  amountPaid?: number;
  paymentMethod?: string;
  transactionReference?: string;
  changes: Record<string, any>;
  timestamp: string;
}

export interface UserActivityData {
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  metadata?: any;
  timestamp: string;
}

export interface SystemAlertData {
  id: string;
  type: 'performance' | 'security' | 'maintenance' | 'error' | 'warning';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  affectedServices?: string[];
  estimatedResolution?: string;
  metadata?: any;
  createdAt: string;
}

class CRMWebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private connectionPromise: Promise<boolean> | null = null;
  private listeners = new Map<string, Set<(data: any) => void>>();
  private pendingMessages: WebSocketMessage[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private token: string | null = null;

  // Authentication
  private getAuthToken(): string | null {
    if (this.token) return this.token;

    // Try to get token from localStorage
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      this.token = storedToken;
      return storedToken;
    }

    // Try to get token from cookies
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token') {
        this.token = value;
        return value;
      }
    }

    return null;
  }

  // Connection Management
  async connect(): Promise<boolean> {
    if (this.socket?.connected) {
      return true;
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this.establishConnection();

    try {
      const connected = await this.connectionPromise;
      return connected;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  private async establishConnection(): Promise<boolean> {
    const token = this.getAuthToken();
    if (!token) {
      console.warn('No authentication token available for WebSocket connection');
      return false;
    }

    try {
      // Get WebSocket URL from environment or fallback
      const wsUrl = (import.meta.env.VITE_WS_URL as string)?.replace('http', 'ws') ||
                   (import.meta.env.VITE_API_URL as string)?.replace('http', 'ws') + '/socket.io' ||
                   'ws://localhost:3000';

      this.socket = io(wsUrl, {
        auth: {
          token,
          clientType: 'frontend',
          version: '1.0.0'
        },
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        maxHttpBufferSize: 1e8, // 100 MB
      });

      return new Promise((resolve) => {
        if (!this.socket) {
          resolve(false);
          return;
        }

        // Connection Events
        this.socket.on('connect', () => {
          console.log('WebSocket connected successfully');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushPendingMessages();
          resolve(true);
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          this.handleConnectionError(error);
          resolve(false);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          this.stopHeartbeat();
          this.handleDisconnection(reason);
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log(`WebSocket reconnected after ${attemptNumber} attempts`);
          this.reconnectAttempts = 0;
          this.startHeartbeat();
        });

        this.socket.on('reconnect_error', (error) => {
          console.error('WebSocket reconnection error:', error);
          this.reconnectAttempts++;
        });

        this.socket.on('reconnect_failed', () => {
          console.error('WebSocket reconnection failed');
          this.reconnectAttempts = this.maxReconnectAttempts;
        });

        // Message Handlers
        this.setupMessageHandlers();

        // Connection timeout
        setTimeout(() => {
          if (!this.socket?.connected) {
            console.warn('WebSocket connection timeout');
            resolve(false);
          }
        }, 20000);
      });

    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      return false;
    }
  }

  private setupMessageHandlers(): void {
    if (!this.socket) return;

    // Real-time Updates
    this.socket.on('ticket:update', (data: TicketUpdateData) => {
      this.emitToListeners('ticket:update', data);
      this.createNotification({
        id: `ticket-${data.ticketId}-${Date.now()}`,
        title: 'Ticket Updated',
        message: `Ticket ${data.ticketId} status changed to ${data.status}`,
        type: 'info',
        priority: 'medium',
        category: 'ticket',
        ticketId: data.ticketId,
        actionUrl: `/admin/crm/tickets/${data.ticketId}`,
        metadata: data,
        createdAt: data.timestamp,
      });
    });

    this.socket.on('ticket:assigned', (data: any) => {
      this.emitToListeners('ticket:assigned', data);
      this.createNotification({
        id: `ticket-assigned-${data.ticketId}-${Date.now()}`,
        title: 'Ticket Assigned',
        message: `You have been assigned to ticket ${data.ticketNumber}`,
        type: 'info',
        priority: 'high',
        category: 'ticket',
        ticketId: data.ticketId,
        actionUrl: `/admin/crm/tickets/${data.ticketId}`,
        metadata: data,
        createdAt: data.timestamp,
      });

      // Play notification sound for assignments
      this.playNotificationSound('assignment');
    });

    this.socket.on('ticket:message', (data: any) => {
      this.emitToListeners('ticket:message', data);
      this.createNotification({
        id: `ticket-message-${data.ticketId}-${Date.now()}`,
        title: 'New Message',
        message: `New message in ticket ${data.ticketNumber}`,
        type: 'info',
        priority: 'medium',
        category: 'message',
        ticketId: data.ticketId,
        actionUrl: `/admin/crm/tickets/${data.ticketId}`,
        metadata: data,
        createdAt: data.timestamp,
      });

      if (!data.isInternal) {
        this.playNotificationSound('message');
      }
    });

    this.socket.on('broker:update', (data: BrokerUpdateData) => {
      this.emitToListeners('broker:update', data);
      this.createNotification({
        id: `broker-${data.brokerId}-${Date.now()}`,
        title: 'Broker Updated',
        message: `Broker status changed to ${data.status}`,
        type: data.status === 'APPROVED' ? 'success' : 'info',
        priority: 'medium',
        category: 'broker',
        brokerId: data.brokerId,
        actionUrl: `/admin/crm/brokers/${data.brokerId}`,
        metadata: data,
        createdAt: data.timestamp,
      });
    });

    this.socket.on('broker:kyc_completed', (data: any) => {
      this.emitToListeners('broker:kyc_completed', data);
      this.createNotification({
        id: `broker-kyc-${data.brokerId}-${Date.now()}`,
        title: 'KYC Completed',
        message: `${data.brokerName} has completed KYC verification`,
        type: 'success',
        priority: 'high',
        category: 'broker',
        brokerId: data.brokerId,
        actionUrl: `/admin/crm/brokers/${data.brokerId}`,
        metadata: data,
        createdAt: data.timestamp,
      });

      this.playNotificationSound('success');
    });

    this.socket.on('deal:update', (data: DealUpdateData) => {
      this.emitToListeners('deal:update', data);
      this.createNotification({
        id: `deal-${data.dealId}-${Date.now()}`,
        title: 'Deal Updated',
        message: `Deal moved to ${data.stage} stage`,
        type: 'info',
        priority: 'medium',
        category: 'deal',
        dealId: data.dealId,
        actionUrl: `/admin/crm/deals/${data.dealId}`,
        metadata: data,
        createdAt: data.timestamp,
      });
    });

    this.socket.on('invoice:created', (data: any) => {
      this.emitToListeners('invoice:created', data);
      this.createNotification({
        id: `invoice-${data.invoiceId}-${Date.now()}`,
        title: 'Invoice Created',
        message: `Invoice ${data.invoiceNumber} generated for ${data.brokerName}`,
        type: 'info',
        priority: 'medium',
        category: 'billing',
        invoiceId: data.invoiceId,
        actionUrl: `/admin/crm/billing/invoices/${data.invoiceId}`,
        metadata: data,
        createdAt: data.timestamp,
      });
    });

    this.socket.on('invoice:paid', (data: InvoiceUpdateData) => {
      this.emitToListeners('invoice:paid', data);
      this.createNotification({
        id: `invoice-paid-${data.invoiceId}-${Date.now()}`,
        title: 'Payment Received',
        message: `Payment of R${data.amountPaid?.toLocaleString()} received via ${data.paymentMethod}`,
        type: 'success',
        priority: 'high',
        category: 'billing',
        invoiceId: data.invoiceId,
        actionUrl: `/admin/crm/billing/invoices/${data.invoiceId}`,
        metadata: data,
        createdAt: data.timestamp,
      });

      this.playNotificationSound('success');
    });

    this.socket.on('invoice:overdue', (data: any) => {
      this.emitToListeners('invoice:overdue', data);
      this.createNotification({
        id: `invoice-overdue-${data.invoiceId}-${Date.now()}`,
        title: 'Invoice Overdue',
        message: `Invoice ${data.invoiceNumber} is now overdue`,
        type: 'warning',
        priority: 'high',
        category: 'billing',
        invoiceId: data.invoiceId,
        actionUrl: `/admin/crm/billing/invoices/${data.invoiceId}`,
        metadata: data,
        createdAt: data.timestamp,
      });
    });

    this.socket.on('sla:warning', (data: any) => {
      this.emitToListeners('sla:warning', data);
      this.createNotification({
        id: `sla-warning-${data.ticketId}-${Date.now()}`,
        title: 'SLA Warning',
        message: `Ticket ${data.ticketNumber} will breach SLA in ${data.timeRemaining}`,
        type: 'warning',
        priority: 'high',
        category: 'ticket',
        ticketId: data.ticketId,
        actionUrl: `/admin/crm/tickets/${data.ticketId}`,
        metadata: data,
        createdAt: data.timestamp,
      });

      this.playNotificationSound('warning');
    });

    this.socket.on('sla:breached', (data: any) => {
      this.emitToListeners('sla:breached', data);
      this.createNotification({
        id: `sla-breached-${data.ticketId}-${Date.now()}`,
        title: 'SLA Breached',
        message: `Ticket ${data.ticketNumber} has breached SLA requirements`,
        type: 'error',
        priority: 'urgent',
        category: 'ticket',
        ticketId: data.ticketId,
        actionUrl: `/admin/crm/tickets/${data.ticketId}`,
        metadata: data,
        createdAt: data.timestamp,
      });

      this.playNotificationSound('error');
    });

    // System Alerts
    this.socket.on('system:alert', (data: SystemAlertData) => {
      this.emitToListeners('system:alert', data);
      this.createNotification({
        id: `system-${data.id}`,
        title: data.title,
        message: data.message,
        type: data.severity === 'critical' ? 'error' : data.type === 'warning' ? 'warning' : 'info',
        priority: data.severity,
        category: 'system',
        metadata: data,
        createdAt: data.createdAt,
      });

      if (data.severity === 'critical' || data.severity === 'high') {
        this.playNotificationSound('error');
      }
    });

    // User Activity
    this.socket.on('user:activity', (data: UserActivityData) => {
      this.emitToListeners('user:activity', data);
    });

    // Live typing indicators
    this.socket.on('ticket:typing', (data: { ticketId: string; userId: string; userName: string; isTyping: boolean }) => {
      this.emitToListeners('ticket:typing', data);
    });

    // Live user presence
    this.socket.on('presence:update', (data: { userId: string; status: 'online' | 'away' | 'busy' | 'offline' }) => {
      this.emitToListeners('presence:update', data);
    });

    // Generic message handler for custom events
    this.socket.onAny((eventName: string, data: any) => {
      if (!eventName.startsWith('ticket:') &&
          !eventName.startsWith('broker:') &&
          !eventName.startsWith('deal:') &&
          !eventName.startsWith('invoice:') &&
          !eventName.startsWith('system:') &&
          !eventName.startsWith('user:') &&
          !eventName.startsWith('presence:')) {
        this.emitToListeners(eventName, data);
      }
    });
  }

  private handleConnectionError(error: Error): void {
    console.error('WebSocket connection error:', error);
    this.reconnectAttempts++;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        if (!this.socket?.connected) {
          this.connect();
        }
      }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1));
    }
  }

  private handleDisconnection(reason: string): void {
    console.log('WebSocket disconnected:', reason);
    this.stopHeartbeat();

    if (reason === 'io server disconnect') {
      // The disconnection was initiated by the server, reconnect manually
      this.connect();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Message Management
  private createNotification(notification: NotificationData): void {
    // Store notification locally
    const existingNotifications = JSON.parse(localStorage.getItem('crm_notifications') || '[]');
    existingNotifications.unshift(notification);

    // Keep only last 100 notifications
    const limitedNotifications = existingNotifications.slice(0, 100);
    localStorage.setItem('crm_notifications', JSON.stringify(limitedNotifications));

    // Emit to notification listeners
    this.emitToListeners('notification', notification);
    this.emitToListeners('notification:new', notification);

    // Show browser notification if permitted
    this.showBrowserNotification(notification);
  }

  private showBrowserNotification(notification: NotificationData): void {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted' && notification.priority !== 'low') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent',
      });

      if (notification.actionUrl) {
        browserNotification.onclick = () => {
          window.focus();
          window.location.href = notification.actionUrl;
          browserNotification.close();
        };
      }

      // Auto-close after 5 seconds for non-urgent notifications
      if (notification.priority !== 'urgent') {
        setTimeout(() => browserNotification.close(), 5000);
      }
    }
  }

  private playNotificationSound(type: 'message' | 'assignment' | 'success' | 'warning' | 'error'): void {
    try {
      const audio = new Audio();
      switch (type) {
        case 'message':
          audio.src = '/sounds/notification-message.mp3';
          break;
        case 'assignment':
          audio.src = '/sounds/notification-assignment.mp3';
          break;
        case 'success':
          audio.src = '/sounds/notification-success.mp3';
          break;
        case 'warning':
          audio.src = '/sounds/notification-warning.mp3';
          break;
        case 'error':
          audio.src = '/sounds/notification-error.mp3';
          break;
        default:
          audio.src = '/sounds/notification-default.mp3';
      }
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore autoplay policy restrictions
      });
    } catch (error) {
      // Ignore audio errors
    }
  }

  private emitToListeners(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in WebSocket listener:', error);
        }
      });
    }
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      if (message && this.socket?.connected) {
        this.socket.emit(message.type, message.data);
      }
    }
  }

  // Public API
  on(event: string, listener: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  off(event: string, listener: (data: any) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      // Queue message for when connection is restored
      this.pendingMessages.push({
        id: Date.now().toString(),
        type: event,
        data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Ticket-specific methods
  joinTicketRoom(ticketId: string): void {
    this.emit('ticket:join', { ticketId });
  }

  leaveTicketRoom(ticketId: string): void {
    this.emit('ticket:leave', { ticketId });
  }

  sendTypingIndicator(ticketId: string, isTyping: boolean): void {
    this.emit('ticket:typing', { ticketId, isTyping });
  }

  sendTicketMessage(ticketId: string, content: string, isInternal: boolean): void {
    this.emit('ticket:message', { ticketId, content, isInternal });
  }

  // Presence methods
  updatePresence(status: 'online' | 'away' | 'busy' | 'offline'): void {
    this.emit('presence:update', { status });
  }

  joinRoom(room: string): void {
    this.emit('room:join', { room });
  }

  leaveRoom(room: string): void {
    this.emit('room:leave', { room });
  }

  // System methods
  requestSystemStatus(): void {
    this.emit('system:status:request');
  }

  sendPing(): void {
    this.emit('ping');
  }

  // Disconnection
  disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.pendingMessages.length = 0;
    this.reconnectAttempts = 0;
  }

  // Status methods
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' {
    if (this.isConnecting) return 'connecting';
    if (this.socket?.connected) return 'connected';
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return 'error';
    return 'disconnected';
  }

  // Notification management
  getNotifications(): NotificationData[] {
    return JSON.parse(localStorage.getItem('crm_notifications') || '[]');
  }

  markNotificationAsRead(notificationId: string): void {
    const notifications = this.getNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.readAt = new Date().toISOString();
      localStorage.setItem('crm_notifications', JSON.stringify(notifications));
    }
  }

  markAllNotificationsAsRead(): void {
    const notifications = this.getNotifications();
    notifications.forEach(notification => {
      notification.readAt = notification.readAt || new Date().toISOString();
    });
    localStorage.setItem('crm_notifications', JSON.stringify(notifications));
  }

  clearNotifications(): void {
    localStorage.setItem('crm_notifications', JSON.stringify([]));
  }

  // Request browser notification permission
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }
}

// Export singleton instance
export const crmWebSocket = new CRMWebSocketService();
export default crmWebSocket;