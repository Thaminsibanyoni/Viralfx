import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { Redis } from 'ioredis';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  CreateMessageDto,
  MessageDto,
  ChatRoomDto,
  ChatRoomResponseDto,
  SendMessageDto,
  MessageQueryDto
} from '../dto/chat.dto';
import { MessageStatus, MessageType, ChatRoomType, UserRole } from '../types/chat.types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly MESSAGES_CACHE_TTL = 3600; // 1 hour
  private readonly ROOM_CACHE_TTL = 1800; // 30 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService) {}

  /**
   * Create a new chat room
   */
  async createRoom(roomData: {
    name?: string;
    description?: string;
    type: ChatRoomType;
    topicId?: string;
    createdBy: string;
    participantIds?: string[];
    metadata?: any;
  }): Promise<ChatRoomResponseDto> {
    this.logger.log(`Creating chat room of type: ${roomData.type}`);

    try {
      const room = await this.prisma.chatRoom.create({
        data: {
          name: roomData.name,
          description: roomData.description,
          type: roomData.type,
          topicId: roomData.topicId,
          createdBy: roomData.createdBy,
          metadata: roomData.metadata || {},
          participants: roomData.participantIds ? {
            create: roomData.participantIds.map(userId => ({
              userId,
              role: roomData.createdBy === userId ? 'ADMIN' : 'MEMBER'
            }))
          } : undefined
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                  profile: {
                    select: {
                      firstName: true,
                      lastName: true,
                      avatar: true
                    }
                  }
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              }
            }
          },
          _count: {
            select: {
              participants: true,
              messages: true
            }
          }
        }
      });

      // Cache the room
      await this.cacheRoom(room);

      // Create system message for room creation
      if (room.type !== 'DIRECT_MESSAGE') {
        await this.createSystemMessage({
          roomId: room.id,
          content: `Chat room "${room.name}" has been created`,
          metadata: { action: 'room_created', createdBy: roomData.createdBy }
        });
      }

      this.logger.log(`Chat room created: ${room.id}`);
      return this.formatChatRoom(room);
    } catch (error) {
      this.logger.error('Failed to create chat room:', error);
      throw new BadRequestException('Failed to create chat room');
    }
  }

  /**
   * Get user's chat rooms
   */
  async getUserRooms(
    userId: string,
    options: {
      type?: ChatRoomType;
      page?: number;
      limit?: number;
      includeArchived?: boolean;
    } = {}
  ): Promise<{ rooms: ChatRoomDto[]; total: number; page: number; totalPages: number }> {
    const { type, page = 1, limit = 20, includeArchived = false } = options;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      participants: {
        some: {
          userId,
          leftAt: null
        }
      }
    };

    if (type) {
      whereClause.type = type;
    }

    if (!includeArchived) {
      whereClause.isArchived = false;
    }

    const [rooms, total] = await Promise.all([
      this.prisma.chatRoom.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          participants: {
            where: { leftAt: null },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  profile: {
                    select: {
                      firstName: true,
                      lastName: true,
                      avatar: true,
                      isOnline: true
                    }
                  }
                }
              }
            }
          },
          lastMessage: {
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  profile: {
                    select: {
                      firstName: true,
                      lastName: true,
                      avatar: true
                    }
                  }
                }
              }
            }
          },
          _count: {
            select: {
              participants: true,
              messages: {
                where: {
                  createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                  }
                }
              }
            }
          }
        }
      }),
      this.prisma.chatRoom.count({ where: whereClause }),
    ]);

    return {
      rooms: rooms.map(room => this.formatChatRoom(room)),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get chat room by ID
   */
  async getRoomById(roomId: string, userId: string): Promise<ChatRoomResponseDto> {
    // Check cache first
    const cachedRoom = await this.getCachedRoom(roomId);
    if (cachedRoom) {
      // Verify user is participant
      const isParticipant = await this.verifyRoomParticipant(roomId, userId);
      if (!isParticipant) {
        throw new NotFoundException('Room not found or access denied');
      }
      return cachedRoom;
    }

    const room = await this.prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        participants: {
          some: {
            userId,
            leftAt: null
          }
        }
      },
      include: {
        participants: {
          where: { leftAt: null },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatar: true,
                    isOnline: true
                  }
                }
              }
            }
          }
        },
        topic: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatar: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            participants: true,
            messages: true
          }
        }
      }
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Cache the room
    await this.cacheRoom(room);

    return this.formatChatRoom(room);
  }

  /**
   * Send a message
   */
  async sendMessage(
    userId: string,
    messageData: SendMessageDto
  ): Promise<MessageDto> {
    const { roomId, content, type = 'TEXT', metadata, replyToId } = messageData;

    // Verify user is participant and not muted
    const participant = await this.prisma.chatParticipant.findFirst({
      where: {
        roomId,
        userId,
        leftAt: null
      }
    });

    if (!participant) {
      throw new BadRequestException('You are not a participant in this room');
    }

    if (participant.isMuted) {
      throw new BadRequestException('You are muted in this room');
    }

    // Check rate limiting
    const rateLimitKey = `chat:rate_limit:${userId}:${roomId}`;
    const messageCount = await this.redis.incr(rateLimitKey);

    if (messageCount === 1) {
      await this.redis.expire(rateLimitKey, 60); // 1 minute window
    }

    const rateLimit = parseInt(this.configService.get('CHAT_RATE_LIMIT', '10'));
    if (messageCount > rateLimit) {
      throw new BadRequestException('Rate limit exceeded. Please wait before sending another message');
    }

    // Content moderation check
    const moderationResult = await this.performContentModeration(content);
    if (!moderationResult.approved) {
      throw new BadRequestException('Message rejected: ' + moderationResult.reason);
    }

    try {
      const message = await this.prisma.$transaction(async (tx) => {
        // Create message
        const newMessage = await tx.message.create({
          data: {
            roomId,
            senderId: userId,
            content,
            type,
            metadata: metadata || {},
            replyToId,
            status: 'SENT'
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatar: true
                  }
                }
              }
            },
            replyTo: {
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true
                  }
                }
              }
            },
            room: {
              select: {
                type: true,
                participants: {
                  select: {
                    userId: true
                  }
                }
              }
            }
          }
        });

        // Update room last message
        await tx.chatRoom.update({
          where: { id: roomId },
          data: { lastMessageAt: new Date() }
        });

        // Update participant's last activity
        await tx.chatParticipant.update({
          where: {
            roomId_userId: { roomId, userId }
          },
          data: { lastActiveAt: new Date() }
        });

        return newMessage;
      });

      // Cache recent messages
      await this.cacheMessage(message);

      // Update room cache
      await this.invalidateRoomCache(roomId);

      this.logger.log(`Message sent: ${message.id} in room: ${roomId}`);

      // Update unread counts for other participants
      await this.updateUnreadCounts(roomId, userId);

      return this.formatMessage(message);
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw new BadRequestException('Failed to send message');
    }
  }

  /**
   * Get messages in a room
   */
  async getMessages(
    roomId: string,
    userId: string,
    query: MessageQueryDto = {}
  ): Promise<{ messages: MessageDto[]; total: number; hasMore: boolean }> {
    const {
      page = 1,
      limit = 50,
      before,
      after,
      search,
      type,
      senderId
    } = query;

    // Verify user is participant
    const isParticipant = await this.verifyRoomParticipant(roomId, userId);
    if (!isParticipant) {
      throw new NotFoundException('Room not found or access denied');
    }

    const whereClause: any = { roomId };

    if (before) {
      whereClause.createdAt = { lt: new Date(before) };
    } else if (after) {
      whereClause.createdAt = { gt: new Date(after) };
    }

    if (search) {
      whereClause.content = { contains: search, mode: 'insensitive' };
    }

    if (type) {
      whereClause.type = type;
    }

    if (senderId) {
      whereClause.senderId = senderId;
    }

    const messages = await this.prisma.message.findMany({
      where: whereClause,
      take: limit + 1, // +1 to check if there are more
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true
              }
            }
          }
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true
              }
            }
          }
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      }
    });

    const hasMore = messages.length > limit;
    const messageData = hasMore ? messages.slice(0, -1) : messages;

    // Mark messages as read for this user
    if (messageData.length > 0) {
      await this.markMessagesAsRead(
        messageData.map(m => m.id),
        userId
      );
    }

    return {
      messages: messageData.reverse().map(msg => this.formatMessage(msg)),
      total: messageData.length,
      hasMore
    };
  }

  /**
   * Join a room (for public rooms)
   */
  async joinRoom(userId: string, roomId: string): Promise<void> {
    const room = await this.prisma.chatRoom.findFirst({
      where: { id: roomId, type: 'PUBLIC' }
    });

    if (!room) {
      throw new NotFoundException('Room not found or not joinable');
    }

    // Check if already a participant
    const existingParticipant = await this.prisma.chatParticipant.findUnique({
      where: {
        roomId_userId: { roomId, userId }
      }
    });

    if (existingParticipant && !existingParticipant.leftAt) {
      return; // Already a member
    }

    if (existingParticipant && existingParticipant.leftAt) {
      // Rejoin
      await this.prisma.chatParticipant.update({
        where: {
          roomId_userId: { roomId, userId }
        },
        data: {
          leftAt: null,
          joinedAt: new Date()
        }
      });
    } else {
      // Join for first time
      await this.prisma.chatParticipant.create({
        data: {
          roomId,
          userId,
          role: 'MEMBER'
        }
      });
    }

    await this.createSystemMessage({
      roomId,
      content: 'A new user has joined the room',
      metadata: { action: 'user_joined', userId }
    });

    await this.invalidateRoomCache(roomId);
  }

  /**
   * Leave a room
   */
  async leaveRoom(userId: string, roomId: string): Promise<void> {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: {
        roomId_userId: { roomId, userId }
      }
    });

    if (!participant || participant.leftAt) {
      return; // Already left
    }

    await this.prisma.chatParticipant.update({
      where: {
        roomId_userId: { roomId, userId }
      },
      data: {
        leftAt: new Date()
      }
    });

    await this.createSystemMessage({
      roomId,
      content: 'A user has left the room',
      metadata: { action: 'user_left', userId }
    });

    await this.invalidateRoomCache(roomId);
  }

  /**
   * Add reaction to message
   */
  async addReaction(
    userId: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    // Verify user can see the message
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        room: {
          participants: {
            some: {
              userId,
              leftAt: null
            }
          }
        }
      }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if reaction already exists
    const existingReaction = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji }
      }
    });

    if (existingReaction) {
      // Remove existing reaction (toggle)
      await this.prisma.messageReaction.delete({
        where: {
          id: existingReaction.id
        }
      });
    } else {
      // Add new reaction
      await this.prisma.messageReaction.create({
        data: {
          messageId,
          userId,
          emoji
        }
      });
    }

    await this.invalidateMessageCache(messageId);
  }

  /**
   * Delete a message
   */
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId },
      include: {
        room: {
          include: {
            participants: {
              where: { userId },
              select: { role: true }
            }
          }
        }
      }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const participantRole = message.room.participants[0]?.role;
    const isAdmin = participantRole === 'ADMIN';
    const isOwner = message.senderId === userId;

    if (!isOwner && !isAdmin) {
      throw new BadRequestException('You can only delete your own messages');
    }

    if (message.type === 'SYSTEM' && !isAdmin) {
      throw new BadRequestException('Cannot delete system messages');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'DELETED',
        content: '[Message deleted]',
        metadata: {
          ...message.metadata,
          deletedAt: new Date(),
          deletedBy: userId,
          originalContent: message.content
        }
      }
    });

    await this.invalidateMessageCache(messageId);
    await this.invalidateRoomCache(message.roomId);
  }

  /**
   * Create system message
   */
  private async createSystemMessage(data: {
    roomId: string;
    content: string;
    metadata?: any;
  }): Promise<void> {
    await this.prisma.message.create({
      data: {
        roomId: data.roomId,
        content: data.content,
        type: 'SYSTEM',
        status: 'SENT',
        metadata: data.metadata || {}
      }
    });
  }

  /**
   * Perform content moderation
   */
  private async performContentModeration(content: string): Promise<{
    approved: boolean;
    reason?: string;
    filteredContent?: string;
  }> {
    // Basic content filters
    const bannedWords = this.configService.get<string[]>('CHAT_BANNED_WORDS', []);
    const containsBannedWords = bannedWords.some(word =>
      content.toLowerCase().includes(word.toLowerCase())
    );

    if (containsBannedWords) {
      return {
        approved: false,
        reason: 'Message contains inappropriate content'
      };
    }

    // Length check
    const maxLength = parseInt(this.configService.get('CHAT_MAX_MESSAGE_LENGTH', '2000'));
    if (content.length > maxLength) {
      return {
        approved: false,
        reason: 'Message too long'
      };
    }

    // Check for spam patterns (excessive caps, links, etc.)
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.7 && content.length > 10) {
      return {
        approved: false,
        reason: 'Excessive capitalization'
      };
    }

    // Link filtering
    const linkRegex = /https?:\/\/[^\s]+/gi;
    const links = content.match(linkRegex);
    if (links && links.length > 3) {
      return {
        approved: false,
        reason: 'Too many links'
      };
    }

    return { approved: true };
  }

  /**
   * Update unread counts for room participants
   */
  private async updateUnreadCounts(roomId: string, senderId: string): Promise<void> {
    const participants = await this.prisma.chatParticipant.findMany({
      where: {
        roomId,
        userId: { not: senderId },
        leftAt: null
      }
    });

    for (const participant of participants) {
      await this.redis.incr(`chat:unread:${participant.userId}:${roomId}`);
    }
  }

  /**
   * Mark messages as read
   */
  private async markMessagesAsRead(messageIds: string[], userId: string): Promise<void> {
    const roomIds = new Set();

    for (const messageId of messageIds) {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: { roomId: true }
      });

      if (message) {
        roomIds.add(message.roomId);
      }
    }

    // Clear unread counts for these rooms
    for (const roomId of roomIds) {
      await this.redis.del(`chat:unread:${userId}:${roomId}`);
    }
  }

  /**
   * Verify user is room participant
   */
  private async verifyRoomParticipant(roomId: string, userId: string): Promise<boolean> {
    const cacheKey = `chat:participant:${roomId}:${userId}`;
    const cached = await this.cacheManager.get<boolean>(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const isParticipant = await this.prisma.chatParticipant.findFirst({
      where: {
        roomId,
        userId,
        leftAt: null
      }
    }) !== null;

    await this.cacheManager.set(cacheKey, isParticipant, 300); // 5 minutes
    return isParticipant;
  }

  /**
   * Cache room data
   */
  private async cacheRoom(room: any): Promise<void> {
    const cacheKey = `chat:room:${room.id}`;
    await this.cacheManager.set(cacheKey, room, this.ROOM_CACHE_TTL);
  }

  /**
   * Get cached room
   */
  private async getCachedRoom(roomId: string): Promise<any | null> {
    const cacheKey = `chat:room:${roomId}`;
    return await this.cacheManager.get<any>(cacheKey);
  }

  /**
   * Invalidate room cache
   */
  private async invalidateRoomCache(roomId: string): Promise<void> {
    const cacheKey = `chat:room:${roomId}`;
    await this.cacheManager.del(cacheKey);
  }

  /**
   * Cache message
   */
  private async cacheMessage(message: any): Promise<void> {
    const cacheKey = `chat:message:${message.id}`;
    await this.cacheManager.set(cacheKey, message, this.MESSAGES_CACHE_TTL);
  }

  /**
   * Invalidate message cache
   */
  private async invalidateMessageCache(messageId: string): Promise<void> {
    const cacheKey = `chat:message:${messageId}`;
    await this.cacheManager.del(cacheKey);
  }

  /**
   * Format chat room for response
   */
  private formatChatRoom(room: any): ChatRoomResponseDto {
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      topicId: room.topicId,
      topic: room.topic,
      createdBy: room.createdBy,
      participants: room.participants?.map(p => ({
        id: p.id,
        user: p.user,
        role: p.role,
        joinedAt: p.joinedAt,
        lastActiveAt: p.lastActiveAt,
        isMuted: p.isMuted
      })) || [],
      lastMessage: room.lastMessage,
      lastMessageAt: room.lastMessageAt,
      isArchived: room.isArchived,
      metadata: room.metadata,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      participantCount: room._count?.participants || 0,
      messageCount: room._count?.messages || 0
    };
  }

  /**
   * Format message for response
   */
  private formatMessage(message: any): MessageDto {
    return {
      id: message.id,
      roomId: message.roomId,
      content: message.content,
      type: message.type,
      status: message.status,
      metadata: message.metadata,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: message.sender,
      replyTo: message.replyTo,
      reactions: message.reactions?.map(r => ({
        id: r.id,
        emoji: r.emoji,
        user: r.user,
        createdAt: r.createdAt
      })) || [],
      isEdited: message.updatedAt > message.createdAt
    };
  }
}
