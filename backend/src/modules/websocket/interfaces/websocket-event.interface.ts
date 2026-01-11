export interface WebSocketEvent {
  type: string;
  payload: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface WebSocketMessage<T = any> {
  event: string;
  data: T;
  timestamp: Date;
  id: string;
}

export interface WebSocketUser {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  connectedAt: Date;
  lastSeen: Date;
  socketIds: string[];
}

export interface WebSocketRoom {
  name: string;
  type: 'public' | 'private' | 'user';
  members: string[];
  createdAt: Date;
  maxUsers?: number;
  metadata?: Record<string, any>;
}

export interface WebSocketConnectionStats {
  totalConnections: number;
  activeConnections: number;
  connectionsByRoom: Record<string, number>;
  messagesSent: number;
  messagesReceived: number;
  lastActivity: Date;
}

export interface WebSocketEventType {
  CONNECTION: 'connection';
  DISCONNECTION: 'disconnection';
  MESSAGE: 'message';
  JOIN_ROOM: 'join-room';
  LEAVE_ROOM: 'leave-room';
  SUBSCRIBE: 'subscribe';
  UNSUBSCRIBE: 'unsubscribe';
  ERROR: 'error';
  BROADCAST: 'broadcast';
}

export interface WebSocketError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  userId?: string;
  socketId?: string;
}