// Chat-related type definitions for ViralFX

import type { User } from './user.types';

export enum ConversationType {
  DIRECT = 'DIRECT',
  BROKER = 'BROKER',
  SUPPORT = 'SUPPORT',
  COMMUNITY = 'COMMUNITY',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  SYSTEM = 'SYSTEM',
}

export enum MessageStatus {
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: User;
  content: string;
  type: MessageType;
  status: MessageStatus;
  attachments: Attachment[];
  readBy: string[];
  reactions: MessageReaction[];
  replyTo?: string;
  threadId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    device?: string;
    ipAddress?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    editHistory?: Array<{
      timestamp: string;
      content: string;
    }>;
  };
}

export interface Attachment {
  id: string;
  messageId: string;
  type: 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO';
  filename: string;
  originalFilename: string;
  url: string;
  thumbnailUrl?: string;
  downloadUrl: string;
  size: number;
  mimeType: string;
  duration?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  uploadedAt: string;
  metadata: {
    checksum: string;
    virusScan?: {
      status: 'CLEAN' | 'INFECTED' | 'PENDING';
      scannedAt?: string;
    };
    compression?: boolean;
    processing?: boolean;
  };
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  user: User;
  emoji: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string;
  description?: string;
  avatar?: string;
  participants: User[];
  admins: User[];
  lastMessage?: Message;
  unreadCount: number;
  isOnline: boolean;
  isActive: boolean;
  isArchived: boolean;
  isPinned: boolean;
  isMuted: boolean;
  settings: {
    allowInvites: boolean;
    requireApproval: boolean;
    publicVisibility: boolean;
    messageRetention: number;
    enableThreads: boolean;
    enableReactions: boolean;
    enableFileSharing: boolean;
    allowExternalUsers: boolean;
  };
  metadata: {
    createdAt: string;
    createdBy: string;
    updatedBy?: string;
    tags: string[];
    category?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    customFields?: Record<string, any>;
  };
}

export interface ConversationFilters {
  type?: ConversationType;
  search?: string;
  participants?: string[];
  hasUnread?: boolean;
  isActive?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
  category?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}

export interface CreateConversationData {
  type: ConversationType;
  name?: string;
  description?: string;
  participantIds: string[];
  initialMessage?: string;
  avatar?: string;
  settings?: Partial<Conversation['settings']>;
  metadata?: Partial<Conversation['metadata']>;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  username: string;
  timestamp: number;
  expiresAt: number;
}

export interface OnlineStatus {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: string;
  message?: string;
  expiresAt?: string;
}

export interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut?: string;
  variables: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface ChatStats {
  totalConversations: number;
  totalMessages: number;
  unreadMessages: number;
  activeConversations: number;
  archivedConversations: number;
  pinnedConversations: number;
  blockedUsers: number;
  storageUsed: number;
  storageLimit: number;
  averageResponseTime: number;
  messageCountByType: Record<MessageType, number>;
  messageCountByHour: Record<string, number>;
  participantCountByConversationType: Record<ConversationType, number>;
}

export interface ChatSettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  soundEnabled: boolean;
  desktopNotifications: boolean;
  autoPlayVideos: boolean;
  showTimestamps: boolean;
  showReadReceipts: boolean;
  showOnlineStatus: boolean;
  showTypingIndicators: boolean;
  messageSound: string;
  notificationSound: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  messageRetention: number;
  autoDelete: boolean;
  autoDeleteDays: number;
  defaultLanguage: string;
  timeZone: string;
  statusMessage?: string;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sound: boolean;
  desktop: boolean;
  conversationTypes: ConversationType[];
  keywords: string[];
  doNotDisturb: boolean;
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  mutedUsers: string[];
  mutedConversations: string[];
  notificationFrequency: 'REAL_TIME' | 'HOURLY' | 'DAILY' | 'WEEKLY';
  digestSettings: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    time: string;
    includeUnread: boolean;
    includeSummary: boolean;
  };
}

export interface ChatReport {
  id: string;
  type: 'MESSAGE' | 'USER' | 'CONVERSATION';
  reportId: string;
  reporterId: string;
  reporter: User;
  reason: 'SPAM' | 'INAPPROPRIATE' | 'HARASSMENT' | 'ABUSE' | 'VIOLENCE' | 'THREATS' | 'OTHER';
  description?: string;
  status: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  resolution?: string;
  evidence?: Attachment[];
}

export interface ChatModeration {
  queue: {
    reportedMessages: Array<{
      message: Message;
      reports: ChatReport[];
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
    reportedUsers: Array<{
      user: User;
      reports: ChatReport[];
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
    autoModeration: {
      enabled: boolean;
      rules: Array<{
        id: string;
        name: string;
        conditions: any;
        action: 'DELETE' | 'WARN' | 'HIDE' | 'FLAG';
        severity: 'LOW' | 'MEDIUM' | 'HIGH';
        isActive: boolean;
      }>;
    };
  };
  actions: Array<{
    type: 'DELETE' | 'WARN' | 'BAN' | 'SUSPEND' | 'HIDE' | 'REVIEW';
    targetType: 'MESSAGE' | 'USER' | 'CONVERSATION';
    targetId: string;
    reason: string;
    moderatorId: string;
    timestamp: string;
  }>;
}

export interface ChatSearchResult {
  messages: Array<{
    message: Message;
    conversation: Conversation;
    highlights: string[];
    relevance: number;
  }>;
  conversations: Array<{
    conversation: Conversation;
    match: Message;
    highlights: string[];
    relevance: number;
  }>;
  users: Array<{
    user: User;
    conversations: Conversation[];
    messages: Message[];
    highlights: string[];
    relevance: number;
  }>;
  total: number;
  facets: {
    messageTypes: Record<MessageType, number>;
    conversationTypes: Record<ConversationType, number>;
    timeRanges: Record<string, number>;
    participants: Record<string, number>;
  };
  suggestions: string[];
}

export interface ChatExport {
  format: 'json' | 'csv' | 'html' | 'pdf';
  dateRange?: {
    start: string;
    end: string;
  };
  includeArchived: boolean;
  includeMedia: boolean;
  includeMetadata: boolean;
  maxFileSize?: number;
  compression: boolean;
  downloadUrl: string;
  expiresAt?: string;
}

export interface ChatBackup {
  id: string;
  userId: string;
  name: string;
  description?: string;
  data: {
    conversations: Conversation[];
    messages: Message[];
    settings: ChatSettings;
    templates: MessageTemplate[];
    stats: ChatStats;
  };
  size: number;
  createdAt: string;
  expiresAt: string;
  downloadUrl: string;
  isAutomatic: boolean;
  schedule?: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    time: string;
    dayOfWeek?: number;
  retention: number;
  };
}

export interface ChatIntegration {
  platform: string;
  type: 'WEBHOOK' | 'API' | 'EMAIL' | 'SLACK' | 'TEAMS' | 'DISCORD';
  settings: {
    webhookUrl?: string;
    secret?: string;
    events: string[];
    headers?: Record<string, string>;
    filters?: any[];
    transformations?: Array<{
      field: string;
      operation: string;
      value: any;
    }>;
  };
  isActive: boolean;
  createdAt: string;
  lastSync?: string;
  stats: {
    eventsProcessed: number;
    errors: number;
    lastError?: string;
  };
}

export interface ChatAI {
  enabled: boolean;
  model: string;
  features: {
    autoReply: boolean;
    sentimentAnalysis: boolean;
    topicSuggestions: boolean;
    translation: boolean;
    summarization: boolean;
    moderation: boolean;
  };
  settings: {
    autoReplyDelay: number;
    confidenceThreshold: number;
    maxTokens: number;
    temperature: number;
    language: string;
    personality: string;
  };
  usage: {
    requests: number;
    tokensUsed: number;
    costs: number;
    lastReset: string;
  };
}