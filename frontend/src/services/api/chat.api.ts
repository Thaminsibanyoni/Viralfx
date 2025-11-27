import { apiClient } from './client';
import type {
  Conversation, Message, ConversationFilters, Attachment, TypingIndicator, CreateConversationData, MessageType, ConversationType, } from '../../types/chat';
import type { User } from '../../types/user.types';

interface SendMessageData {
  conversationId: string;
  content: string;
  attachments?: File[];
  type?: MessageType;
  replyTo?: string;
}

interface UploadResponse {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  thumbnail?: string;
}

interface NotificationSettings {
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
}

class ChatAPI {
  // Conversation management
  async getConversations(filters?: ConversationFilters): Promise<Conversation[]> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'search') {
            params.append('q', String(value));
          } else if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }

    const response = await apiClient.get(`/chat/conversations?${params.toString()}`);
    return response.data.conversations;
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await apiClient.get(`/chat/conversations/${conversationId}`);
    return response.data.conversation;
  }

  async createConversation(data: CreateConversationData): Promise<Conversation> {
    const response = await apiClient.post('/chat/conversations', data);
    return response.data.conversation;
  }

  async updateConversation(conversationId: string, data: Partial<Conversation>): Promise<Conversation> {
    const response = await apiClient.put(`/chat/conversations/${conversationId}`, data);
    return response.data.conversation;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/chat/conversations/${conversationId}`);
  }

  async archiveConversation(conversationId: string): Promise<void> {
    await apiClient.post(`/chat/conversations/${conversationId}/archive`);
  }

  async unarchiveConversation(conversationId: string): Promise<void> {
    await apiClient.post(`/chat/conversations/${conversationId}/unarchive`);
  }

  async pinConversation(conversationId: string): Promise<void> {
    await apiClient.post(`/chat/conversations/${conversationId}/pin`);
  }

  async unpinConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/chat/conversations/${conversationId}/pin`);
  }

  async muteConversation(conversationId: string, duration?: number): Promise<void> {
    const data = duration ? { duration } : {};
    await apiClient.post(`/chat/conversations/${conversationId}/mute`, data);
  }

  async unmuteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/chat/conversations/${conversationId}/mute`);
  }

  // Message management
  async getMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50,
    before?: string,
    after?: string
  ): Promise<{
    messages: Message[];
    hasMore: boolean;
    total: number;
    page: number;
  }> {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));
    if (before) params.append('before', before);
    if (after) params.append('after', after);

    const response = await apiClient.get(
      `/chat/conversations/${conversationId}/messages?${params.toString()}`
    );
    return response.data;
  }

  async getMessage(messageId: string): Promise<Message> {
    const response = await apiClient.get(`/chat/messages/${messageId}`);
    return response.data.message;
  }

  async sendMessage(data: SendMessageData): Promise<Message> {
    if (data.attachments && data.attachments.length > 0) {
      const formData = new FormData();
      formData.append('conversationId', data.conversationId);
      formData.append('content', data.content);
      if (data.type) formData.append('type', data.type);
      if (data.replyTo) formData.append('replyTo', data.replyTo);

      data.attachments.forEach((file, index) => {
        formData.append(`attachment${index}`, file);
      });

      const response = await apiClient.post('/chat/messages', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.message;
    } else {
      const response = await apiClient.post('/chat/messages', {
        conversationId: data.conversationId,
        content: data.content,
        type: data.type,
        replyTo: data.replyTo,
      });
      return response.data.message;
    }
  }

  async editMessage(messageId: string, content: string): Promise<Message> {
    const response = await apiClient.put(`/chat/messages/${messageId}`, { content });
    return response.data.message;
  }

  async deleteMessage(messageId: string, deleteForEveryone: boolean = false): Promise<void> {
    await apiClient.delete(`/chat/messages/${messageId}?deleteForEveryone=${deleteForEveryone}`);
  }

  async recallMessage(messageId: string): Promise<Message> {
    const response = await apiClient.post(`/chat/messages/${messageId}/recall`);
    return response.data.message;
  }

  // Message reactions
  async addReaction(messageId: string, emoji: string): Promise<void> {
    await apiClient.post(`/chat/messages/${messageId}/reactions`, { emoji });
  }

  async removeReaction(messageId: string, emoji: string): Promise<void> {
    await apiClient.delete(`/chat/messages/${messageId}/reactions/${emoji}`);
  }

  async getMessageReactions(messageId: string): Promise<Array<{
    userId: string;
    username: string;
    emoji: string;
    createdAt: string;
  }>> {
    const response = await apiClient.get(`/chat/messages/${messageId}/reactions`);
    return response.data.reactions;
  }

  // Message attachments
  async uploadFile(file: File, conversationId: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', conversationId);

    const response = await apiClient.post('/chat/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getAttachment(attachmentId: string): Promise<Attachment> {
    const response = await apiClient.get(`/chat/attachments/${attachmentId}`);
    return response.data.attachment;
  }

  async downloadAttachment(attachmentId: string): Promise<string> {
    const response = await apiClient.get(`/chat/attachments/${attachmentId}/download`);
    return response.data.downloadUrl;
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    await apiClient.delete(`/chat/attachments/${attachmentId}`);
  }

  // Read receipts and typing indicators
  async markAsRead(conversationId: string, messageId?: string): Promise<void> {
    const data = messageId ? { messageId } : {};
    await apiClient.post(`/chat/conversations/${conversationId}/read`, data);
  }

  async markAllAsRead(): Promise<void> {
    await apiClient.post('/chat/conversations/read-all');
  }

  async getReadStatus(messageId: string): Promise<Array<{
    userId: string;
    username: string;
    readAt: string;
  }>> {
    const response = await apiClient.get(`/chat/messages/${messageId}/read-status`);
    return response.data.readBy;
  }

  async sendTypingIndicator(conversationId: string, isTyping: boolean): Promise<void> {
    await apiClient.post(`/chat/conversations/${conversationId}/typing`, { isTyping });
  }

  async getTypingUsers(conversationId: string): Promise<TypingIndicator[]> {
    const response = await apiClient.get(`/chat/conversations/${conversationId}/typing`);
    return response.data.typingUsers;
  }

  // Search and filtering
  async searchMessages(query: string, conversationId?: string, limit: number = 20): Promise<{
    messages: Array<{
      message: Message;
      conversation: Conversation;
      highlights: string[];
    }>;
    total: number;
  }> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', String(limit));
    if (conversationId) params.append('conversationId', conversationId);

    const response = await apiClient.get(`/chat/search/messages?${params.toString()}`);
    return response.data;
  }

  async searchConversations(query: string, filters?: ConversationFilters): Promise<{
    conversations: Array<{
      conversation: Conversation;
      match: Message;
      highlights: string[];
    }>;
    total: number;
  }> {
    const params = new URLSearchParams();
    params.append('q', query);

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }

    const response = await apiClient.get(`/chat/search/conversations?${params.toString()}`);
    return response.data;
  }

  // User management in conversations
  async addParticipants(conversationId: string, userIds: string[]): Promise<void> {
    await apiClient.post(`/chat/conversations/${conversationId}/participants`, { userIds });
  }

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    await apiClient.delete(`/chat/conversations/${conversationId}/participants/${userId}`);
  }

  async leaveConversation(conversationId: string): Promise<void> {
    await apiClient.post(`/chat/conversations/${conversationId}/leave`);
  }

  async getParticipants(conversationId: string): Promise<User[]> {
    const response = await apiClient.get(`/chat/conversations/${conversationId}/participants`);
    return response.data.participants;
  }

  async updateParticipantRole(conversationId: string, userId: string, role: string): Promise<void> {
    await apiClient.put(`/chat/conversations/${conversationId}/participants/${userId}`, { role });
  }

  // Blocking and reporting
  async blockUser(userId: string): Promise<void> {
    await apiClient.post(`/chat/users/${userId}/block`);
  }

  async unblockUser(userId: string): Promise<void> {
    await apiClient.delete(`/chat/users/${userId}/block`);
  }

  async getBlockedUsers(): Promise<User[]> {
    const response = await apiClient.get('/chat/users/blocked');
    return response.data.blockedUsers;
  }

  async reportUser(userId: string, reason: string, description?: string): Promise<void> {
    await apiClient.post(`/chat/users/${userId}/report`, { reason, description });
  }

  async reportMessage(messageId: string, reason: string, description?: string): Promise<void> {
    await apiClient.post(`/chat/messages/${messageId}/report`, { reason, description });
  }

  // Chat settings and preferences
  async getNotificationSettings(): Promise<NotificationSettings> {
    const response = await apiClient.get('/chat/settings/notifications');
    return response.data.settings;
  }

  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
    await apiClient.put('/chat/settings/notifications', settings);
  }

  async getChatSettings(): Promise<{
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    soundEnabled: boolean;
    desktopNotifications: boolean;
    autoPlayVideos: boolean;
    showTimestamps: boolean;
    showReadReceipts: boolean;
    onlineStatus: boolean;
    typingIndicators: boolean;
  }> {
    const response = await apiClient.get('/chat/settings');
    return response.data.settings;
  }

  async updateChatSettings(settings: any): Promise<void> {
    await apiClient.put('/chat/settings', settings);
  }

  // Chat status and presence
  async updateOnlineStatus(status: 'online' | 'away' | 'busy' | 'offline'): Promise<void> {
    await apiClient.post('/chat/status', { status });
  }

  async setUserStatus(status: string, expiresAt?: Date): Promise<void> {
    const data = { status };
    if (expiresAt) {
      data.expiresAt = expiresAt.toISOString();
    }
    await apiClient.post('/chat/user-status', data);
  }

  async getUserStatus(userId?: string): Promise<{
    status: string;
    lastSeen?: string;
    message?: string;
    expiresAt?: string;
  }> {
    const url = userId ? `/chat/users/${userId}/status` : '/chat/status';
    const response = await apiClient.get(url);
    return response.data;
  }

  // Chat statistics and analytics
  async getChatStats(): Promise<{
    totalConversations: number;
    totalMessages: number;
    unreadMessages: number;
    activeConversations: number;
    blockedUsers: number;
    storageUsed: number;
    storageLimit: number;
  }> {
    const response = await apiClient.get('/chat/stats');
    return response.data.stats;
  }

  async getConversationStats(conversationId: string): Promise<{
    totalMessages: number;
    messagesByType: Record<MessageType, number>;
    totalAttachments: number;
    participantCount: number;
    createdDate: string;
    lastActivity: string;
    averageResponseTime: number;
  }> {
    const response = await apiClient.get(`/chat/conversations/${conversationId}/stats`);
    return response.data.stats;
  }

  // Message templates and quick replies
  async getMessageTemplates(): Promise<Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    shortcut?: string;
    variables: string[];
  }>> {
    const response = await apiClient.get('/chat/templates');
    return response.data.templates;
  }

  async createMessageTemplate(template: {
    title: string;
    content: string;
    category: string;
    shortcut?: string;
    variables: string[];
  }): Promise<any> {
    const response = await apiClient.post('/chat/templates', template);
    return response.data.template;
  }

  async deleteMessageTemplate(templateId: string): Promise<void> {
    await apiClient.delete(`/chat/templates/${templateId}`);
  }

  // Chat export and backup
  async exportConversation(conversationId: string, format: 'json' | 'csv' | 'html'): Promise<string> {
    const response = await apiClient.get(
      `/chat/conversations/${conversationId}/export?format=${format}`
    );
    return response.data.downloadUrl;
  }

  async exportAllChats(format: 'json' | 'csv'): Promise<string> {
    const response = await apiClient.get(`/chat/export?format=${format}`);
    return response.data.downloadUrl;
  }

  // Admin and moderation functions
  async getAdminChatStats(): Promise<{
    totalUsers: number;
    totalConversations: number;
    totalMessages: number;
    activeUsers: number;
    reports: number;
    blockedUsers: number;
    storageUsage: number;
  }> {
    const response = await apiClient.get('/admin/chat/stats');
    return response.data.stats;
  }

  async getModerationQueue(): Promise<{
    reportedMessages: Array<{
      message: Message;
      reports: Array<{
        userId: string;
        reason: string;
        createdAt: string;
      }>;
    }>;
    reportedUsers: Array<{
      user: User;
      reports: Array<{
        reporterId: string;
        reason: string;
        createdAt: string;
      }>;
    }>;
  }> {
    const response = await apiClient.get('/admin/chat/moderation');
    return response.data;
  }

  async moderateMessage(messageId: string, action: 'delete' | 'warn' | 'ban', reason?: string): Promise<void> {
    await apiClient.post(`/admin/chat/messages/${messageId}/moderate`, { action, reason });
  }

  async moderateUser(userId: string, action: 'warn' | 'ban' | 'suspend', duration?: number, reason?: string): Promise<void> {
    const data = { action };
    if (duration) data.duration = duration;
    if (reason) data.reason = reason;
    await apiClient.post(`/admin/chat/users/${userId}/moderate`, data);
  }
}

// Create and export singleton instance
export const chatApi = new ChatAPI();

// Export default for convenience
export default chatApi;