import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Redis } from 'ioredis';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { ModerationAction, UserRole, MessageStatus, MessageType } from '../types/chat.types';

@Injectable()
export class ChatModerationService {
  private readonly logger = new Logger(ChatModerationService.name);
  private readonly BANNED_WORDS_CACHE_TTL = 300; // 5 minutes
  private readonly MODERATION_CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis,
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Mute a user in a room
   */
  async muteUser(
    roomId: string,
    targetUserId: string,
    durationHours: number = 1,
    reason?: string,
    moderatorId?: string
  ): Promise<void> {
    this.logger.log(`Muting user ${targetUserId} in room ${roomId} for ${durationHours} hours`);

    // Verify moderator permissions
    await this.verifyModeratorPermissions(roomId, moderatorId);

    const muteEndsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Update participant status
        const participant = await tx.chatParticipant.update({
          where: {
            roomId_userId: { roomId, userId: targetUserId },
          },
          data: {
            isMuted: true,
            mutedUntil: muteEndsAt,
            mutedBy: moderatorId,
            muteReason: reason,
          },
        });

        if (!participant) {
          throw new NotFoundException('User is not a participant in this room');
        }

        // Log moderation action
        await tx.moderationAction.create({
          data: {
            type: 'MUTE',
            userId: targetUserId,
            roomId,
            moderatorId: moderatorId || 'SYSTEM',
            reason: reason || 'Violation of chat rules',
            duration: durationHours * 3600, // Convert to seconds
            expiresAt: muteEndsAt,
          },
        });
      });

      // Cache mute status
      await this.cacheManager.set(
        `chat:muted:${roomId}:${targetUserId}`,
        true,
        durationHours * 3600
      );

      // Create system message
      await this.createSystemMessage({
        roomId,
        content: `A user has been muted${reason ? ` for: ${reason}` : ''}`,
        metadata: {
          action: 'user_muted',
          userId: targetUserId,
          duration: durationHours,
          reason,
        },
      });

      this.logger.log(`User ${targetUserId} muted successfully in room ${roomId}`);
    } catch (error) {
      this.logger.error('Failed to mute user:', error);
      throw new BadRequestException('Failed to mute user');
    }
  }

  /**
   * Unmute a user in a room
   */
  async unmuteUser(
    roomId: string,
    targetUserId: string,
    moderatorId?: string
  ): Promise<void> {
    this.logger.log(`Unmuting user ${targetUserId} in room ${roomId}`);

    // Verify moderator permissions
    await this.verifyModeratorPermissions(roomId, moderatorId);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Update participant status
        await tx.chatParticipant.update({
          where: {
            roomId_userId: { roomId, userId: targetUserId },
          },
          data: {
            isMuted: false,
            mutedUntil: null,
            mutedBy: null,
            muteReason: null,
          },
        });

        // Log moderation action
        await tx.moderationAction.create({
          data: {
            type: 'UNMUTE',
            userId: targetUserId,
            roomId,
            moderatorId: moderatorId || 'SYSTEM',
            reason: 'Mute lifted by moderator',
          },
        });
      });

      // Remove from cache
      await this.cacheManager.del(`chat:muted:${roomId}:${targetUserId}`);

      this.logger.log(`User ${targetUserId} unmuted successfully in room ${roomId}`);
    } catch (error) {
      this.logger.error('Failed to unmute user:', error);
      throw new BadRequestException('Failed to unmute user');
    }
  }

  /**
   * Ban a user from a room
   */
  async banUser(
    roomId: string,
    targetUserId: string,
    durationHours: number = 24,
    reason?: string,
    moderatorId?: string
  ): Promise<void> {
    this.logger.log(`Banning user ${targetUserId} from room ${roomId} for ${durationHours} hours`);

    // Verify moderator permissions
    await this.verifyModeratorPermissions(roomId, moderatorId);

    const banEndsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Remove from room
        await tx.chatParticipant.update({
          where: {
            roomId_userId: { roomId, userId: targetUserId },
          },
          data: {
            leftAt: new Date(),
            isBanned: true,
            bannedUntil: banEndsAt,
            bannedBy: moderatorId,
            banReason: reason,
          },
        });

        // Log moderation action
        await tx.moderationAction.create({
          data: {
            type: 'BAN',
            userId: targetUserId,
            roomId,
            moderatorId: moderatorId || 'SYSTEM',
            reason: reason || 'Violation of chat rules',
            duration: durationHours * 3600, // Convert to seconds
            expiresAt: banEndsAt,
          },
        });
      });

      // Cache ban status
      await this.cacheManager.set(
        `chat:banned:${roomId}:${targetUserId}`,
        true,
        durationHours * 3600
      );

      // Create system message
      await this.createSystemMessage({
        roomId,
        content: `A user has been banned from the room${reason ? ` for: ${reason}` : ''}`,
        metadata: {
          action: 'user_banned',
          userId: targetUserId,
          duration: durationHours,
          reason,
        },
      });

      this.logger.log(`User ${targetUserId} banned successfully from room ${roomId}`);
    } catch (error) {
      this.logger.error('Failed to ban user:', error);
      throw new BadRequestException('Failed to ban user');
    }
  }

  /**
   * Kick a user from a room (temporary removal)
   */
  async kickUser(
    roomId: string,
    targetUserId: string,
    reason?: string,
    moderatorId?: string
  ): Promise<void> {
    this.logger.log(`Kicking user ${targetUserId} from room ${roomId}`);

    // Verify moderator permissions
    await this.verifyModeratorPermissions(roomId, moderatorId);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Remove from room
        await tx.chatParticipant.update({
          where: {
            roomId_userId: { roomId, userId: targetUserId },
          },
          data: {
            leftAt: new Date(),
          },
        });

        // Log moderation action
        await tx.moderationAction.create({
          data: {
            type: 'KICK',
            userId: targetUserId,
            roomId,
            moderatorId: moderatorId || 'SYSTEM',
            reason: reason || 'Removed by moderator',
          },
        });
      });

      // Create system message
      await this.createSystemMessage({
        roomId,
        content: `A user has been removed from the room${reason ? ` for: ${reason}` : ''}`,
        metadata: {
          action: 'user_kicked',
          userId: targetUserId,
          reason,
        },
      });

      this.logger.log(`User ${targetUserId} kicked successfully from room ${roomId}`);
    } catch (error) {
      this.logger.error('Failed to kick user:', error);
      throw new BadRequestException('Failed to kick user');
    }
  }

  /**
   * Delete a message (moderation action)
   */
  async deleteMessage(
    messageId: string,
    reason?: string,
    moderatorId?: string
  ): Promise<void> {
    this.logger.log(`Deleting message ${messageId} (moderation action)`);

    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          room: {
            select: { id: true },
          },
        },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      // Verify moderator permissions if moderator ID is provided
      if (moderatorId) {
        await this.verifyModeratorPermissions(message.roomId, moderatorId);
      }

      await this.prisma.$transaction(async (tx) => {
        // Delete the message
        await tx.message.update({
          where: { id: messageId },
          data: {
            status: MessageStatus.DELETED,
            content: '[Message deleted by moderator]',
            metadata: {
              ...message.metadata,
              deletedAt: new Date(),
              deletedBy: moderatorId,
              deleteReason: reason,
              originalContent: message.content,
            },
          },
        });

        // Log moderation action
        await tx.moderationAction.create({
          data: {
            type: 'DELETE',
            userId: message.senderId,
            roomId: message.roomId,
            moderatorId: moderatorId || 'SYSTEM',
            reason: reason || 'Message violated community guidelines',
            metadata: {
              messageId,
              originalContent: message.content,
            },
          },
        });
      });

      this.logger.log(`Message ${messageId} deleted successfully`);
    } catch (error) {
      this.logger.error('Failed to delete message:', error);
      throw new BadRequestException('Failed to delete message');
    }
  }

  /**
   * Check if content violates rules
   */
  async checkContent(content: string, roomId?: string, userId?: string): Promise<{
    approved: boolean;
    reason?: string;
    violations: string[];
    filteredContent?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    autoAction?: 'WARN' | 'DELETE' | 'MUTE' | 'BAN';
  }> {
    const violations: string[] = [];
    let filteredContent = content;
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    // Get banned words and patterns
    const { bannedWords, suspiciousPatterns, spamPatterns } = await this.getModerationRules();

    // Check for banned words
    const words = content.toLowerCase().split(/\s+/);
    const foundBannedWords = words.filter(word =>
      bannedWords.includes(word) || bannedWords.some(banned => word.includes(banned))
    );

    if (foundBannedWords.length > 0) {
      violations.push(`Contains banned words: ${foundBannedWords.join(', ')}`);
      severity = 'HIGH';

      // Filter out banned words
      filteredContent = content.replace(new RegExp(foundBannedWords.join('|'), 'gi'), '[REDACTED]');
    }

    // Check for suspicious patterns
    for (const pattern of suspiciousPatterns) {
      if (new RegExp(pattern, 'gi').test(content)) {
        violations.push(`Contains suspicious pattern: ${pattern}`);
        severity = severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
      }
    }

    // Check for spam patterns
    const spamScore = this.calculateSpamScore(content, spamPatterns);
    if (spamScore > 0.7) {
      violations.push('Detected spam-like behavior');
      severity = severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
    }

    // Check for excessive caps
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.6 && content.length > 10) {
      violations.push('Excessive capitalization');
      severity = severity === 'HIGH' ? 'HIGH' : 'LOW';
    }

    // Check for excessive links
    const linkCount = (content.match(/https?:\/\/[^\s]+/gi) || []).length;
    if (linkCount > 2) {
      violations.push('Too many links');
      severity = severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
    }

    // Check for duplicate content (spam)
    if (await this.isDuplicateContent(content, userId, roomId)) {
      violations.push('Duplicate content detected');
      severity = 'MEDIUM';
    }

    // Determine auto-action based on severity and violations
    let autoAction: 'WARN' | 'DELETE' | 'MUTE' | 'BAN' | undefined;

    if (severity === 'HIGH' && foundBannedWords.length > 2) {
      autoAction = 'BAN';
    } else if (severity === 'HIGH' || violations.length > 3) {
      autoAction = 'DELETE';
    } else if (severity === 'MEDIUM' && violations.length > 1) {
      autoAction = 'MUTE';
    } else if (violations.length > 0) {
      autoAction = 'WARN';
    }

    return {
      approved: violations.length === 0,
      violations,
      filteredContent: filteredContent !== content ? filteredContent : undefined,
      severity,
      reason: violations.length > 0 ? violations.join('; ') : undefined,
      autoAction,
    };
  }

  /**
   * Get moderation logs for a room
   */
  async getModerationLogs(
    roomId: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      userId?: string;
    } = {}
  ): Promise<{
    actions: Array<{
      id: string;
      type: string;
      userId: string;
      moderatorId: string;
      reason: string;
      createdAt: Date;
      expiresAt?: Date;
      metadata?: any;
      moderator?: {
        username: string;
        profile?: {
          firstName: string;
          lastName: string;
        };
      };
      targetUser?: {
        username: string;
        profile?: {
          firstName: string;
          lastName: string;
        };
      };
    }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, type, userId } = options;
    const skip = (page - 1) * limit;

    const whereClause: any = { roomId };

    if (type) {
      whereClause.type = type.toUpperCase();
    }

    if (userId) {
      whereClause.userId = userId;
    }

    const [actions, total] = await Promise.all([
      this.prisma.moderationAction.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          moderator: {
            select: {
              username: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          targetUser: {
            select: {
              username: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.moderationAction.count({ where: whereClause }),
    ]);

    return {
      actions: actions.map(action => ({
        id: action.id,
        type: action.type,
        userId: action.userId,
        moderatorId: action.moderatorId,
        reason: action.reason,
        createdAt: action.createdAt,
        expiresAt: action.expiresAt,
        metadata: action.metadata,
        moderator: action.moderator,
        targetUser: action.targetUser,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get user's moderation history
   */
  async getUserModerationHistory(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      roomId?: string;
    } = {}
  ): Promise<any> {
    const { page = 1, limit = 20, roomId } = options;
    const skip = (page - 1) * limit;

    const whereClause: any = { userId };

    if (roomId) {
      whereClause.roomId = roomId;
    }

    const [actions, total] = await Promise.all([
      this.prisma.moderationAction.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          room: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          moderator: {
            select: {
              username: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.moderationAction.count({ where: whereClause }),
    ]);

    return {
      actions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Check if user is muted in a room
   */
  async isUserMuted(roomId: string, userId: string): Promise<boolean> {
    // Check cache first
    const cacheKey = `chat:muted:${roomId}:${userId}`;
    const cached = await this.cacheManager.get<boolean>(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    // Check database
    const participant = await this.prisma.chatParticipant.findFirst({
      where: {
        roomId,
        userId,
        isMuted: true,
        mutedUntil: {
          gt: new Date(),
        },
      },
    });

    const isMuted = !!participant;

    if (isMuted && participant.mutedUntil) {
      const ttl = Math.floor((participant.mutedUntil.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await this.cacheManager.set(cacheKey, true, ttl);
      }
    }

    return isMuted;
  }

  /**
   * Check if user is banned from a room
   */
  async isUserBanned(roomId: string, userId: string): Promise<boolean> {
    // Check cache first
    const cacheKey = `chat:banned:${roomId}:${userId}`;
    const cached = await this.cacheManager.get<boolean>(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    // Check database
    const participant = await this.prisma.chatParticipant.findFirst({
      where: {
        roomId,
        userId,
        isBanned: true,
        bannedUntil: {
          gt: new Date(),
        },
      },
    });

    const isBanned = !!participant;

    if (isBanned && participant.bannedUntil) {
      const ttl = Math.floor((participant.bannedUntil.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await this.cacheManager.set(cacheKey, true, ttl);
      }
    }

    return isBanned;
  }

  /**
   * Get moderation statistics
   */
  async getModerationStats(roomId?: string, timeWindow?: string): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    activeMutes: number;
    activeBans: number;
    recentActions: Array<{
      type: string;
      reason: string;
      createdAt: Date;
    }>;
  }> {
    const timeFilter = timeWindow ?
      { createdAt: { gte: new Date(Date.now() - this.parseTimeWindow(timeWindow)) } } : {};

    const whereClause: any = { ...timeFilter };
    if (roomId) {
      whereClause.roomId = roomId;
    }

    const [
      totalActions,
      actionsByType,
      activeMutes,
      activeBans,
      recentActions
    ] = await Promise.all([
      this.prisma.moderationAction.count({ where: whereClause }),
      this.prisma.moderationAction.groupBy({
        by: ['type'],
        where: whereClause,
        _count: { type: true },
      }),
      this.prisma.chatParticipant.count({
        where: {
          isMuted: true,
          mutedUntil: { gt: new Date() },
          ...(roomId && { roomId }),
        },
      }),
      this.prisma.chatParticipant.count({
        where: {
          isBanned: true,
          bannedUntil: { gt: new Date() },
          ...(roomId && { roomId }),
        },
      }),
      this.prisma.moderationAction.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          type: true,
          reason: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totalActions,
      actionsByType: actionsByType.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {}),
      activeMutes,
      activeBans,
      recentActions,
    };
  }

  /**
   * Create system message for moderation actions
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
        type: MessageType.SYSTEM,
        status: MessageStatus.SENT,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Verify moderator permissions
   */
  private async verifyModeratorPermissions(roomId: string, moderatorId?: string): Promise<void> {
    if (!moderatorId) {
      return; // System action
    }

    const participant = await this.prisma.chatParticipant.findUnique({
      where: {
        roomId_userId: { roomId, userId: moderatorId },
      },
    });

    if (!participant || !['ADMIN', 'MODERATOR'].includes(participant.role)) {
      throw new BadRequestException('Insufficient permissions for moderation action');
    }
  }

  /**
   * Get moderation rules from config/cache
   */
  private async getModerationRules(): Promise<{
    bannedWords: string[];
    suspiciousPatterns: string[];
    spamPatterns: string[];
  }> {
    const cacheKey = 'moderation:rules';
    const cached = await this.cacheManager.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const rules = {
      bannedWords: this.configService.get<string[]>('CHAT_BANNED_WORDS', [
        'spam', 'abuse', 'hate', 'violence', 'threat'
      ]),
      suspiciousPatterns: this.configService.get<string[]>('CHAT_SUSPICIOUS_PATTERNS', [
        '\\b\\d{3}-?\\d{3}-?\\d{4}\\b', // Phone numbers
        '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', // Emails
        '\\b\\$\\d+', // Money mentions
      ]),
      spamPatterns: this.configService.get<string[]>('CHAT_SPAM_PATTERNS', [
        'click here',
        'free money',
        'limited offer',
        'act now',
      ]),
    };

    await this.cacheManager.set(cacheKey, rules, this.MODERATION_CACHE_TTL);
    return rules;
  }

  /**
   * Calculate spam score
   */
  private calculateSpamScore(content: string, spamPatterns: string[]): number {
    let score = 0;
    const contentLower = content.toLowerCase();

    for (const pattern of spamPatterns) {
      if (contentLower.includes(pattern.toLowerCase())) {
        score += 0.3;
      }
    }

    // Check for repetitive characters
    if (/(.)\1{4,}/.test(content)) {
      score += 0.2;
    }

    // Check for excessive punctuation
    const punctCount = (content.match(/[!?]/g) || []).length;
    if (punctCount > 3) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Check for duplicate content
   */
  private async isDuplicateContent(content: string, userId?: string, roomId?: string): Promise<boolean> {
    if (!userId || !roomId) {
      return false;
    }

    const recentMessage = await this.prisma.message.findFirst({
      where: {
        roomId,
        senderId: userId,
        content: {
          equals: content,
        },
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
    });

    return !!recentMessage;
  }

  /**
   * Parse time window string to milliseconds
   */
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([hdwmy])$/);
    if (!match) {
      return 24 * 60 * 60 * 1000; // Default to 24 hours
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      h: 60 * 60 * 1000,    // hour
      d: 24 * 60 * 60 * 1000, // day
      w: 7 * 24 * 60 * 60 * 1000, // week
      m: 30 * 24 * 60 * 60 * 1000, // month
      y: 365 * 24 * 60 * 60 * 1000, // year
    };

    return value * (multipliers[unit as keyof typeof multipliers] || multipliers.d);
  }
}