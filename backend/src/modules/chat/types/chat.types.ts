export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  DELETED = 'DELETED',
  FAILED = 'FAILED'
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
  AUDIO = 'AUDIO',
  SYSTEM = 'SYSTEM',
  POLL = 'POLL',
  EMBED = 'EMBED'
}

export enum ChatRoomType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  DIRECT_MESSAGE = 'DIRECT_MESSAGE',
  GROUP = 'GROUP',
  TOPIC_BASED = 'TOPIC_BASED'
}

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER'
}

export enum ChatEventType {
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_UPDATED = 'MESSAGE_UPDATED',
  MESSAGE_DELETED = 'MESSAGE_DELETED',
  REACTION_ADDED = 'REACTION_ADDED',
  REACTION_REMOVED = 'REACTION_REMOVED',
  USER_JOINED = 'USER_JOINED',
  USER_LEFT = 'USER_LEFT',
  USER_TYPING = 'USER_TYPING',
  USER_STOPPED_TYPING = 'USER_ONLINE',
  ROOM_UPDATED = 'ROOM_UPDATED',
  ROOM_CREATED = 'ROOM_CREATED',
  ROOM_ARCHIVED = 'ROOM_ARCHIVED'
}

export interface ChatEvent {
  type: ChatEventType;
  roomId: string;
  userId?: string;
  data: any;
  timestamp: Date;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface ChatParticipant {
  id: string;
  roomId: string;
  userId: string;
  role: UserRole;
  joinedAt: Date;
  lastActiveAt: Date;
  leftAt?: Date;
  isMuted: boolean;
  user?: {
    id: string;
    username: string;
    profile?: {
      firstName: string;
      lastName: string;
      avatar: string;
      isOnline: boolean;
    };
  };
}

export interface ChatRoom {
  id: string;
  name?: string;
  description?: string;
  type: ChatRoomType;
  topicId?: string;
  createdBy: string;
  isArchived: boolean;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  participants?: ChatParticipant[];
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  metadata: any;
  replyToId?: string;
  createdAt: Date;
  updatedAt: Date;
  sender?: {
    id: string;
    username: string;
    profile?: {
      firstName: string;
      lastName: string;
      avatar: string;
    };
  };
  replyTo?: Message;
  reactions?: MessageReaction[];
}

export interface TypingIndicator {
  roomId: string;
  userId: string;
  username: string;
  timestamp: Date;
}

export interface UnreadCount {
  roomId: string;
  count: number;
  lastReadAt?: Date;
}

export interface MessageFilter {
  search?: string;
  type?: MessageType;
  senderId?: string;
  before?: string;
  after?: string;
  page?: number;
  limit?: number;
}

export interface RoomFilter {
  type?: ChatRoomType;
  includeArchived?: boolean;
  hasUnread?: boolean;
  topicId?: string;
}

export interface ChatStats {
  totalMessages: number;
  totalRooms: number;
  activeUsers: number;
  averageMessagesPerRoom: number;
  topActiveRooms: Array<{
    roomId: string;
    name?: string;
    messageCount: number;
  }>;
  messagesByType: Record<MessageType, number>;
}

export interface ModerationAction {
  type: 'DELETE' | 'MUTE' | 'KICK' | 'BAN';
  userId: string;
  roomId?: string;
  reason: string;
  duration?: number; // in seconds
  moderatorId: string;
  createdAt: Date;
}

export interface ChatSettings {
  enableFileUploads: boolean;
  maxFileSize: number;
  allowedFileTypes: string[];
  enableVoiceMessages: boolean;
  enableReactions: boolean;
  enableTypingIndicators: boolean;
  maxMessageLength: number;
  rateLimitMessages: number;
  rateLimitWindow: number;
  autoModeration: boolean;
  profanityFilter: boolean;
  linkFilter: boolean;
}
