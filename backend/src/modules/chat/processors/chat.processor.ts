import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ChatModerationService } from '../services/chat-moderation.service';
import { ChatGateway } from '../gateways/chat.gateway';

interface ChatNotificationJob {
  type: 'NEW_MESSAGE' | 'MENTION' | 'ROOM_INVITE' | 'MODERATION_ALERT';
  data: {
    userId: string;
    roomId?: string;
    messageId?: string;
    content?: string;
    senderId?: string;
    senderUsername?: string;
    roomName?: string;
    action?: string;
    reason?: string;
  };
}

interface MessageProcessingJob {
  type: 'CONTENT_ANALYSIS' | 'SENTIMENT_ANALYSIS' | 'SPAM_DETECTION';
  data: {
    messageId: string;
    content: string;
    senderId: string;
    roomId: string;
  };
}

@Processor('chat-notifications')
export class ChatNotificationProcessor {
  private readonly logger = new Logger(ChatNotificationProcessor.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Process('send-notification')
  async handleNotification(job: Job<ChatNotificationJob>): Promise<void> {
    const { type, data } = job.data;

    this.logger.log(`Processing chat notification: ${type} for user ${data.userId}`);

    try {
      switch (type) {
        case 'NEW_MESSAGE':
          await this.handleNewMessageNotification(data);
          break;

        case 'MENTION':
          await this.handleMentionNotification(data);
          break;

        case 'ROOM_INVITE':
          await this.handleRoomInviteNotification(data);
          break;

        case 'MODERATION_ALERT':
          await this.handleModerationAlert(data);
          break;

        default:
          this.logger.warn(`Unknown notification type: ${type}`);
      }

      this.logger.log(`Chat notification processed successfully: ${type}`);
    } catch (error) {
      this.logger.error(`Failed to process chat notification ${type}:`, error);
      throw error;
    }
  }

  private async handleNewMessageNotification(data: any): Promise<void> {
    // Check if user is online and in the room
    const isOnline = await this.isUserOnline(data.userId);
    const isInRoom = await this.isUserInRoom(data.userId, data.roomId);

    if (isOnline && isInRoom) {
      // User is already in the room, no need for notification
      return;
    }

    // Send real-time notification via WebSocket
    this.chatGateway.sendNotificationToUser(data.userId, {
      type: 'NEW_MESSAGE',
      title: `New message in ${data.roomName || 'Chat Room'}`,
      body: `${data.senderUsername}: ${data.content?.substring(0, 100)}${data.content?.length > 100 ? '...' : ''}`,
      data: {
        roomId: data.roomId,
        messageId: data.messageId,
        senderId: data.senderId,
        senderUsername: data.senderUsername,
      },
    });

    // Update unread count
    await this.incrementUnreadCount(data.userId, data.roomId);
  }

  private async handleMentionNotification(data: any): Promise<void> {
    this.chatGateway.sendNotificationToUser(data.userId, {
      type: 'MENTION',
      title: `You were mentioned in ${data.roomName || 'Chat Room'}`,
      body: `${data.senderUsername} mentioned you: ${data.content?.substring(0, 100)}${data.content?.length > 100 ? '...' : ''}`,
      data: {
        roomId: data.roomId,
        messageId: data.messageId,
        senderId: data.senderId,
        senderUsername: data.senderUsername,
      },
    });
  }

  private async handleRoomInviteNotification(data: any): Promise<void> {
    this.chatGateway.sendNotificationToUser(data.userId, {
      type: 'ROOM_INVITE',
      title: 'Room Invitation',
      body: `You've been invited to join ${data.roomName}`,
      data: {
        roomId: data.roomId,
        roomName: data.roomName,
        inviterId: data.senderId,
        inviterUsername: data.senderUsername,
      },
    });
  }

  private async handleModerationAlert(data: any): Promise<void> {
    this.chatGateway.sendNotificationToUser(data.userId, {
      type: 'MODERATION_ALERT',
      title: 'Moderation Action',
      body: `Your message has been ${data.action.toLowerCase()}`,
      data: {
        roomId: data.roomId,
        action: data.action,
        reason: data.reason,
        messageId: data.messageId,
      },
    });
  }

  private async isUserOnline(userId: string): Promise<boolean> {
    // This would check Redis or some other store for online status
    return false; // Placeholder
  }

  private async isUserInRoom(userId: string, roomId: string): Promise<boolean> {
    // This would check if user is actively connected to room
    return false; // Placeholder
  }

  private async incrementUnreadCount(userId: string, roomId: string): Promise<void> {
    // Increment unread count in Redis
    // This would be implemented with actual Redis client
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`Chat notification job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Chat notification job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Chat notification job ${job.id} failed:`, error.message);
  }
}

@Processor('chat-moderation')
export class ChatModerationProcessor {
  private readonly logger = new Logger(ChatModerationProcessor.name);

  constructor(
    private readonly moderationService: ChatModerationService,
  ) {}

  @Process('auto-moderate')
  async handleAutoModeration(job: Job<MessageProcessingJob>): Promise<void> {
    const { type, data } = job.data;

    this.logger.log(`Processing auto-moderation: ${type} for message ${data.messageId}`);

    try {
      switch (type) {
        case 'CONTENT_ANALYSIS':
          await this.performContentAnalysis(data);
          break;

        case 'SPAM_DETECTION':
          await this.performSpamDetection(data);
          break;

        default:
          this.logger.warn(`Unknown moderation type: ${type}`);
      }

      this.logger.log(`Auto-moderation processed successfully: ${type}`);
    } catch (error) {
      this.logger.error(`Failed to process auto-moderation ${type}:`, error);
      throw error;
    }
  }

  private async performContentAnalysis(data: any): Promise<void> {
    const moderationResult = await this.moderationService.checkContent(
      data.content,
      data.roomId,
      data.senderId
    );

    if (!moderationResult.approved && moderationResult.autoAction) {
      // Apply automatic moderation action
      switch (moderationResult.autoAction) {
        case 'DELETE':
          await this.moderationService.deleteMessage(
            data.messageId,
            moderationResult.reason,
            'SYSTEM'
          );
          break;

        case 'MUTE':
          await this.moderationService.muteUser(
            data.roomId,
            data.senderId,
            1, // 1 hour
            moderationResult.reason,
            'SYSTEM'
          );
          break;

        case 'BAN':
          await this.moderationService.banUser(
            data.roomId,
            data.senderId,
            24, // 24 hours
            moderationResult.reason,
            'SYSTEM'
          );
          break;
      }
    }
  }

  private async performSpamDetection(data: any): Promise<void> {
    // Additional spam detection logic
    const spamScore = await this.calculateSpamScore(data.content, data.senderId, data.roomId);

    if (spamScore > 0.8) {
      await this.moderationService.muteUser(
        data.roomId,
        data.senderId,
        1,
        'Spam detection triggered',
        'SYSTEM'
      );
    }
  }

  private async calculateSpamScore(content: string, userId: string, roomId: string): Promise<number> {
    // Placeholder for spam score calculation
    return 0.1;
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`Chat moderation job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Chat moderation job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Chat moderation job ${job.id} failed:`, error.message);
  }
}

@Processor('message-processing')
export class MessageProcessingProcessor {
  private readonly logger = new Logger(MessageProcessingProcessor.name);

  constructor(
    private readonly chatService: ChatService,
  ) {}

  @Process('process-message')
  async handleMessageProcessing(job: Job<MessageProcessingJob>): Promise<void> {
    const { type, data } = job.data;

    this.logger.log(`Processing message: ${type} for message ${data.messageId}`);

    try {
      switch (type) {
        case 'SENTIMENT_ANALYSIS':
          await this.performSentimentAnalysis(data);
          break;

        case 'CONTENT_INDEXING':
          await this.performContentIndexing(data);
          break;

        case 'TRANSLATION':
          await this.performTranslation(data);
          break;

        default:
          this.logger.warn(`Unknown message processing type: ${type}`);
      }

      this.logger.log(`Message processing completed successfully: ${type}`);
    } catch (error) {
      this.logger.error(`Failed to process message ${type}:`, error);
      throw error;
    }
  }

  private async performSentimentAnalysis(data: any): Promise<void> {
    // Integrate with sentiment analysis module
    // This would analyze the emotional tone of the message
    const sentiment = await this.analyzeSentiment(data.content);

    // Store sentiment analysis results
    await this.chatService.updateMessageMetadata(
      data.messageId,
      { sentiment }
    );
  }

  private async performContentIndexing(data: any): Promise<void> {
    // Index message content for search functionality
    // This would extract keywords, entities, etc.
    const indexedData = await this.indexContent(data.content);

    // Store indexing results
    await this.chatService.updateMessageMetadata(
      data.messageId,
      { indexed: indexedData }
    );
  }

  private async performTranslation(data: any): Promise<void> {
    // Auto-translate message content
    // This would detect language and provide translations
    const translations = await this.translateContent(data.content);

    // Store translations
    await this.chatService.updateMessageMetadata(
      data.messageId,
      { translations }
    );
  }

  private async analyzeSentiment(content: string): Promise<any> {
    // Placeholder for sentiment analysis
    return {
      score: 0.1,
      magnitude: 0.5,
      label: 'neutral',
    };
  }

  private async indexContent(content: string): Promise<any> {
    // Placeholder for content indexing
    return {
      keywords: [],
      entities: [],
      language: 'en',
    };
  }

  private async translateContent(content: string): Promise<any> {
    // Placeholder for translation
    return {
      detectedLanguage: 'en',
      translations: {},
    };
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`Message processing job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Message processing job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Message processing job ${job.id} failed:`, error.message);
  }
}