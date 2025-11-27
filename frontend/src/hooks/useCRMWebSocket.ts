import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import crmWebSocket, {
  NotificationData, TicketUpdateData, BrokerUpdateData, DealUpdateData, InvoiceUpdateData, UserActivityData, SystemAlertData, } from '../services/websocket/crmWebSocket';
import { message } from 'antd';

interface UseCRMWebSocketOptions {
  autoConnect?: boolean;
  enableNotifications?: boolean;
  enableSounds?: boolean;
  reconnectOnFocus?: boolean;
  reconnectOnNetworkOnline?: boolean;
}

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastMessage?: any;
  notifications: NotificationData[];
  unreadCount: number;
  error?: Error;
}

interface TicketRoomState {
  typingUsers: Map<string, { userName: string; lastTyped: number }>;
  subscribedTickets: Set<string>;
}

interface PresenceState {
  onlineUsers: Map<string, { userName: string; status: string; lastSeen: string }>;
  currentUserStatus: 'online' | 'away' | 'busy' | 'offline';
}

export const useCRMWebSocket = (options: UseCRMWebSocketOptions = {}) => {
  const {autoConnect = true, enableNotifications = true, enableSounds = true, reconnectOnFocus = true, reconnectOnNetworkOnline = true, } = options;

  const {isAuthenticated, user} = useAuthStore();
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    connectionStatus: 'disconnected',
    notifications: [],
    unreadCount: 0,
  });

  const [ticketRooms, setTicketRooms] = useState<TicketRoomState>({
    typingUsers: new Map(),
    subscribedTickets: new Set(),
  });

  const [presence, setPresence] = useState<PresenceState>({
    onlineUsers: new Map(),
    currentUserStatus: 'online',
  });

  const listenersRef = new Map<string, () => void>();
  const typingTimeoutsRef = new Map<string, NodeJS.Timeout>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize notifications from localStorage
  useEffect(() => {
    const savedNotifications = crmWebSocket.getNotifications();
    const unreadCount = savedNotifications.filter(n => !n.readAt).length;

    setState(prev => ({
      ...prev,
      notifications: savedNotifications,
      unreadCount,
    }));

    // Request notification permission
    if (enableNotifications) {
      crmWebSocket.requestNotificationPermission();
    }
  }, [enableNotifications]);

  // Connection management
  useEffect(() => {
    if (!isAuthenticated || !autoConnect) {
      return;
    }

    const connect = async () => {
      setState(prev => ({ ...prev, connecting: true, connectionStatus: 'connecting' }));

      try {
        const connected = await crmWebSocket.connect();

        if (connected) {
          setState(prev => ({
            ...prev,
            connected: true,
            connecting: false,
            connectionStatus: 'connected',
          }));

          // Join user-specific room
          if (user?.id) {
            crmWebSocket.joinRoom(`user:${user.id}`);
          }

          // Set initial presence
          crmWebSocket.updatePresence('online');
        } else {
          setState(prev => ({
            ...prev,
            connected: false,
            connecting: false,
            connectionStatus: 'error',
            error: new Error('Failed to connect to WebSocket'),
          }));
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          connectionStatus: 'error',
          error: error instanceof Error ? error : new Error('Connection failed'),
        }));
      }
    };

    connect();

    return () => {
      // Cleanup listeners on unmount
      listenersRef.forEach(unsubscribe => unsubscribe());
      listenersRef.clear();

      typingTimeoutsRef.forEach(timeout => clearTimeout(timeout));
      typingTimeoutsRef.clear();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isAuthenticated, autoConnect, user?.id]);

  // Reconnect on window focus
  useEffect(() => {
    if (!reconnectOnFocus) return;

    const handleFocus = () => {
      if (!state.connected && isAuthenticated) {
        crmWebSocket.connect();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [reconnectOnFocus, state.connected, isAuthenticated]);

  // Reconnect on network online
  useEffect(() => {
    if (!reconnectOnNetworkOnline) return;

    const handleOnline = () => {
      if (!state.connected && isAuthenticated) {
        crmWebSocket.connect();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [reconnectOnNetworkOnline, state.connected, isAuthenticated]);

  // Event listeners
  useEffect(() => {
    // Connection status changes
    const unsubscribeConnect = crmWebSocket.on('connect', () => {
      setState(prev => ({
        ...prev,
        connected: true,
        connecting: false,
        connectionStatus: 'connected',
        error: undefined,
      }));
    });

    const unsubscribeDisconnect = crmWebSocket.on('disconnect', () => {
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        connectionStatus: 'disconnected',
      }));
    });

    const unsubscribeConnectError = crmWebSocket.on('connect_error', (error) => {
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        connectionStatus: 'error',
        error: error instanceof Error ? error : new Error('Connection error'),
      }));
    });

    // Notifications
    const unsubscribeNotification = crmWebSocket.on('notification', (notification: NotificationData) => {
      setState(prev => ({
        ...prev,
        notifications: [notification, ...prev.notifications].slice(0, 100),
        unreadCount: prev.unreadCount + (notification.readAt ? 0 : 1),
      }));

      // Show Ant Design message for high priority notifications
      if (enableNotifications && (notification.priority === 'high' || notification.priority === 'urgent')) {
        const messageType = notification.type === 'error' ? 'error' :
                           notification.type === 'warning' ? 'warning' :
                           notification.type === 'success' ? 'success' : 'info';

        message[messageType](notification.title, notification.message, {
          duration: notification.priority === 'urgent' ? 0 : 4.5,
          onClick: notification.actionUrl ? () => {
            window.location.href = notification.actionUrl;
          } : undefined,
        });
      }
    });

    // Ticket typing indicators
    const unsubscribeTicketTyping = crmWebSocket.on('ticket:typing', (data: {
      ticketId: string;
      userId: string;
      userName: string;
      isTyping: boolean;
    }) => {
      setTicketRooms(prev => {
        const newTypingUsers = new Map(prev.typingUsers);

        if (data.isTyping) {
          newTypingUsers.set(data.userId, {
            userName: data.userName,
            lastTyped: Date.now(),
          });

          // Clear existing timeout for this user
          const existingTimeout = typingTimeoutsRef.get(data.userId);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }

          // Set new timeout to remove typing indicator after 3 seconds
          const timeout = setTimeout(() => {
            setTicketRooms(prev => {
              const updatedTypingUsers = new Map(prev.typingUsers);
              updatedTypingUsers.delete(data.userId);
              return { ...prev, typingUsers: updatedTypingUsers };
            });
            typingTimeoutsRef.delete(data.userId);
          }, 3000);

          typingTimeoutsRef.set(data.userId, timeout);
        } else {
          newTypingUsers.delete(data.userId);

          const timeout = typingTimeoutsRef.get(data.userId);
          if (timeout) {
            clearTimeout(timeout);
            typingTimeoutsRef.delete(data.userId);
          }
        }

        return { ...prev, typingUsers: newTypingUsers };
      });
    });

    // Presence updates
    const unsubscribePresenceUpdate = crmWebSocket.on('presence:update', (data: {
      userId: string;
      status: 'online' | 'away' | 'busy' | 'offline';
    }) => {
      setPresence(prev => {
        const newOnlineUsers = new Map(prev.onlineUsers);

        if (data.status === 'offline') {
          newOnlineUsers.delete(data.userId);
        } else {
          const userInfo = newOnlineUsers.get(data.userId) || { userName: '', status: '', lastSeen: '' };
          newOnlineUsers.set(data.userId, {
            ...userInfo,
            status: data.status,
            lastSeen: new Date().toISOString(),
          });
        }

        return { ...prev, onlineUsers: newOnlineUsers };
      });
    });

    listenersRef.set('connect', unsubscribeConnect);
    listenersRef.set('disconnect', unsubscribeDisconnect);
    listenersRef.set('connect_error', unsubscribeConnectError);
    listenersRef.set('notification', unsubscribeNotification);
    listenersRef.set('ticket:typing', unsubscribeTicketTyping);
    listenersRef.set('presence:update', unsubscribePresenceUpdate);

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeConnectError();
      unsubscribeNotification();
      unsubscribeTicketTyping();
      unsubscribePresenceUpdate();
    };
  }, [enableNotifications]);

  // Utility functions
  const joinTicketRoom = useCallback((ticketId: string) => {
    crmWebSocket.joinTicketRoom(ticketId);
    setTicketRooms(prev => ({
      ...prev,
      subscribedTickets: new Set([...prev.subscribedTickets, ticketId]),
    }));
  }, []);

  const leaveTicketRoom = useCallback((ticketId: string) => {
    crmWebSocket.leaveTicketRoom(ticketId);
    setTicketRooms(prev => {
      const newSubscribedTickets = new Set(prev.subscribedTickets);
      newSubscribedTickets.delete(ticketId);
      const newTypingUsers = new Map(prev.typingUsers);
      newTypingUsers.clear(); // Clear typing when leaving room

      return {
        ...prev,
        subscribedTickets: newSubscribedTickets,
        typingUsers: newTypingUsers,
      };
    });
  }, []);

  const sendTypingIndicator = useCallback((ticketId: string, isTyping: boolean) => {
    crmWebSocket.sendTypingIndicator(ticketId, isTyping);
  }, []);

  const sendTicketMessage = useCallback((ticketId: string, content: string, isInternal: boolean) => {
    crmWebSocket.sendTicketMessage(ticketId, content, isInternal);
  }, []);

  const updatePresence = useCallback((status: 'online' | 'away' | 'busy' | 'offline') => {
    crmWebSocket.updatePresence(status);
    setPresence(prev => ({ ...prev, currentUserStatus: status }));
  }, []);

  const markNotificationAsRead = useCallback((notificationId: string) => {
    crmWebSocket.markNotificationAsRead(notificationId);
    setState(prev => {
      const updatedNotifications = prev.notifications.map(n =>
        n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
      );
      const unreadCount = updatedNotifications.filter(n => !n.readAt).length;
      return {
        ...prev,
        notifications: updatedNotifications,
        unreadCount,
      };
    });
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    crmWebSocket.markAllNotificationsAsRead();
    setState(prev => {
      const updatedNotifications = prev.notifications.map(n => ({
        ...n,
        readAt: n.readAt || new Date().toISOString(),
      }));
      return {
        ...prev,
        notifications: updatedNotifications,
        unreadCount: 0,
      };
    });
  }, []);

  const clearNotifications = useCallback(() => {
    crmWebSocket.clearNotifications();
    setState(prev => ({
      ...prev,
      notifications: [],
      unreadCount: 0,
    }));
  }, []);

  const reconnect = useCallback(async () => {
    setState(prev => ({ ...prev, connecting: true }));
    const connected = await crmWebSocket.connect();
    setState(prev => ({
      ...prev,
      connecting: false,
      connected,
      connectionStatus: connected ? 'connected' : 'error',
    }));
    return connected;
  }, []);

  const disconnect = useCallback(() => {
    crmWebSocket.disconnect();
    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      connectionStatus: 'disconnected',
    }));
  }, []);

  // Custom event listeners
  const onTicketUpdate = useCallback((callback: (data: TicketUpdateData) => void) => {
    return crmWebSocket.on('ticket:update', callback);
  }, []);

  const onBrokerUpdate = useCallback((callback: (data: BrokerUpdateData) => void) => {
    return crmWebSocket.on('broker:update', callback);
  }, []);

  const onDealUpdate = useCallback((callback: (data: DealUpdateData) => void) => {
    return crmWebSocket.on('deal:update', callback);
  }, []);

  const onInvoiceUpdate = useCallback((callback: (data: InvoiceUpdateData) => void) => {
    return crmWebSocket.on('invoice:paid', callback);
  }, []);

  const onUserActivity = useCallback((callback: (data: UserActivityData) => void) => {
    return crmWebSocket.on('user:activity', callback);
  }, []);

  const onSystemAlert = useCallback((callback: (data: SystemAlertData) => void) => {
    return crmWebSocket.on('system:alert', callback);
  }, []);

  // Get typing users for a specific ticket
  const getTypingUsersForTicket = useCallback((ticketId: string) => {
    const typingUsers = Array.from(ticketRooms.typingUsers.entries())
      .map(([userId, data]) => data.userName)
      .filter(userName => userName); // Filter out empty names

    return typingUsers.length > 0 ? typingUsers : undefined;
  }, [ticketRooms.typingUsers]);

  // Check if user is subscribed to ticket
  const isSubscribedToTicket = useCallback((ticketId: string) => {
    return ticketRooms.subscribedTickets.has(ticketId);
  }, [ticketRooms.subscribedTickets]);

  return {
    // State
    ...state,

    // Ticket room state
    typingUsers: getTypingUsersForTicket,
    isSubscribedToTicket,

    // Presence state
    onlineUsers: Array.from(presence.onlineUsers.values()),
    currentUserStatus: presence.currentUserStatus,

    // Methods
    joinTicketRoom,
    leaveTicketRoom,
    sendTypingIndicator,
    sendTicketMessage,
    updatePresence,

    // Notification methods
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,

    // Connection methods
    reconnect,
    disconnect,

    // Event listeners
    onTicketUpdate,
    onBrokerUpdate,
    onDealUpdate,
    onInvoiceUpdate,
    onUserActivity,
    onSystemAlert,

    // Raw WebSocket access
    socket: crmWebSocket,
  };
};

export default useCRMWebSocket;