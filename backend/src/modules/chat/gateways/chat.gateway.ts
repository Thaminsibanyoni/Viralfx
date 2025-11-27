import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from '../services/chat.service';
import { ChatModerationService } from '../services/chat-moderation.service';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import {
  ChatEventType,
  TypingIndicator,
  MessageStatus,
  ChatRoomType,
} from '../types/chat.types';
import {
  SendMessageDto,
  AddReactionDto,
  TypingDto,
} from '../dto/chat.dto';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  rooms: Set<string>;
  typingIntervals: Map<string, NodeJS.Timeout>;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();
  private readonly userSockets = new Map<string, Set<string>>();
  private readonly roomUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    private readonly moderationService: ChatModerationService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Chat WebSocket Gateway initialized');

    // Set up Redis adapter for multi-instance support
    const { createAdapter } = require('@socket.io/redis-adapter');
    const pubClient = this.redis;
    const subClient = pubClient.duplicate();

    server.adapter(createAdapter(pubClient, subClient));
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);

    try {
      // Authenticate client
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new WsException('Unauthorized');
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.sub;
      client.username = payload.username;
      client.rooms = new Set();
      client.typingIntervals = new Map();

      // Track connection
      this.connectedClients.set(client.id, client);

      if (!this.userSockets.has(client.userId)) {
        this.userSockets.set(client.userId, new Set());
      }
      this.userSockets.get(client.userId)!.add(client.id);

      // Join user's personal room for direct messages
      await client.join(`user:${client.userId}`);

      // Send user's online status to Redis
      await this.setUserOnlineStatus(client.userId, true);

      // Emit to client that connection is successful
      client.emit('connected', {
        userId: client.userId,
        username: client.username,
        timestamp: new Date(),
      });

      // Get user's rooms and notify about online status
      const userRooms = await this.chatService.getUserRooms(client.userId, { limit: 100 });

      for (const room of userRooms.rooms) {
        // Join room sockets
        await client.join(`room:${room.id}`);
        client.rooms.add(room.id);

        // Track room users
        if (!this.roomUsers.has(room.id)) {
          this.roomUsers.set(room.id, new Set());
        }
        this.roomUsers.get(room.id)!.add(client.userId);

        // Notify other users in room about online status
        client.to(`room:${room.id}`).emit('user_online', {
          userId: client.userId,
          username: client.username,
          roomId: room.id,
          timestamp: new Date(),
        });

        // Send unread count for this room
        const unreadCount = await this.getUnreadCount(room.id, client.userId);
        client.emit('unread_count', {
          roomId: room.id,
          count: unreadCount,
        });
      }

      this.logger.log(`User ${client.username} (${client.userId}) connected successfully`);
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}:`, error);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    if (client.userId) {
      // Clear typing intervals
      for (const [roomId, interval] of client.typingIntervals) {
        clearInterval(interval);
        this.broadcastTypingStop(roomId, client.userId, client.username);
      }

      // Remove from tracking
      this.connectedClients.delete(client.id);

      const userSocketSet = this.userSockets.get(client.userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(client.userId);

          // User is fully offline
          await this.setUserOnlineStatus(client.userId, false);

          // Notify all rooms that user is offline
          for (const roomId of client.rooms) {
            const roomUserSet = this.roomUsers.get(roomId);
            if (roomUserSet) {
              roomUserSet.delete(client.userId);
              if (roomUserSet.size === 0) {
                this.roomUsers.delete(roomId);
              }
            }

            this.server.to(`room:${roomId}`).emit('user_offline', {
              userId: client.userId,
              username: client.username,
              roomId,
              timestamp: new Date(),
            });
          }
        }
      }
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) {
      throw new WsException('Unauthorized');
    }

    try {
      const room = await this.chatService.getRoomById(data.roomId, client.userId);

      // Check if user is banned or muted
      const isBanned = await this.moderationService.isUserBanned(data.roomId, client.userId);
      if (isBanned) {
        throw new WsException('You are banned from this room');
      }

      const isMuted = await this.moderationService.isUserMuted(data.roomId, client.userId);

      // Join socket room
      await client.join(`room:${data.roomId}`);
      client.rooms.add(data.roomId);

      // Track room users
      if (!this.roomUsers.has(data.roomId)) {
        this.roomUsers.set(data.roomId, new Set());
      }
      this.roomUsers.get(data.roomId)!.add(client.userId);

      // Notify room about new user
      client.to(`room:${data.roomId}`).emit('user_joined', {
        userId: client.userId,
        username: client.username,
        roomId: data.roomId,
        timestamp: new Date(),
      });

      // Send room data to client
      client.emit('room_joined', {
        room,
        isMuted,
        timestamp: new Date(),
      });

      // Send online users in room
      const onlineUsers = Array.from(this.roomUsers.get(data.roomId) || []);
      client.emit('room_users', {
        roomId: data.roomId,
        users: onlineUsers,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`Failed to join room ${data.roomId}:`, error);
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) {
      throw new WsException('Unauthorized');
    }

    try {
      // Leave socket room
      await client.leave(`room:${data.roomId}`);
      client.rooms.delete(data.roomId);

      // Remove from room users tracking
      const roomUserSet = this.roomUsers.get(data.roomId);
      if (roomUserSet) {
        roomUserSet.delete(client.userId);
        if (roomUserSet.size === 0) {
          this.roomUsers.delete(data.roomId);
        }
      }

      // Notify room about user leaving
      client.to(`room:${data.roomId}`).emit('user_left', {
        userId: client.userId,
        username: client.username,
        roomId: data.roomId,
        timestamp: new Date(),
      });

      client.emit('room_left', {
        roomId: data.roomId,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`Failed to leave room ${data.roomId}:`, error);
      client.emit('error', { message: 'Failed to leave room' });
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto,
  ) {
    if (!client.userId) {
      throw new WsException('Unauthorized');
    }

    try {
      // Pre-validation checks
      const isMuted = await this.moderationService.isUserMuted(data.roomId, client.userId);
      if (isMuted) {
        throw new WsException('You are muted in this room');
      }

      const isBanned = await this.moderationService.isUserBanned(data.roomId, client.userId);
      if (isBanned) {
        throw new WsException('You are banned from this room');
      }

      // Send message
      const message = await this.chatService.sendMessage(client.userId, data);

      // Broadcast to all users in room
      this.server.to(`room:${data.roomId}`).emit('new_message', {
        message,
        type: ChatEventType.MESSAGE_SENT,
        timestamp: new Date(),
      });

      // Send to message sender's other sockets (for real-time update)
      const userSockets = this.userSockets.get(client.userId);
      if (userSockets) {
        userSockets.forEach(socketId => {
          this.server.to(socketId).emit('message_sent', {
            messageId: message.id,
            roomId: data.roomId,
            timestamp: new Date(),
          });
        });
      }

    } catch (error) {
      this.logger.error(`Failed to send message:`, error);
      client.emit('message_error', {
        roomId: data.roomId,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingDto,
  ) {
    if (!client.userId) {
      throw new WsException('Unauthorized');
    }

    // Check if user is muted
    const isMuted = await this.moderationService.isUserMuted(data.roomId, client.userId);
    if (isMuted) {
      return;
    }

    // Clear existing typing interval for this room
    const existingInterval = client.typingIntervals.get(data.roomId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Broadcast typing start
    client.to(`room:${data.roomId}`).emit('user_typing', {
      userId: client.userId,
      username: client.username,
      roomId: data.roomId,
      timestamp: new Date(),
    } as TypingIndicator);

    // Set auto-stop typing timer
    const duration = data.duration || 5000; // Default 5 seconds
    const interval = setTimeout(() => {
      this.broadcastTypingStop(data.roomId, client.userId!, client.username!);
      client.typingIntervals.delete(data.roomId);
    }, duration);

    client.typingIntervals.set(data.roomId, interval);
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) {
      throw new WsException('Unauthorized');
    }

    // Clear typing interval
    const interval = client.typingIntervals.get(data.roomId);
    if (interval) {
      clearInterval(interval);
      client.typingIntervals.delete(data.roomId);
    }

    this.broadcastTypingStop(data.roomId, client.userId, client.username);
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string; messageId?: string },
  ) {
    if (!client.userId) {
      throw new WsException('Unauthorized');
    }

    try {
      await this.chatService.markAsRead(client.userId, data.roomId, data.messageId);

      // Update unread count for user's other sockets
      const unreadCount = await this.getUnreadCount(data.roomId, client.userId);
      const userSockets = this.userSockets.get(client.userId);

      if (userSockets) {
        userSockets.forEach(socketId => {
          this.server.to(socketId).emit('unread_count', {
            roomId: data.roomId,
            count: unreadCount,
            timestamp: new Date(),
          });
        });
      }

    } catch (error) {
      this.logger.error(`Failed to mark as read:`, error);
    }
  }

  @SubscribeMessage('add_reaction')
  async handleAddReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: AddReactionDto,
  ) {
    if (!client.userId) {
      throw new WsException('Unauthorized');
    }

    try {
      await this.chatService.addReaction(client.userId, data.messageId, data.emoji);

      // Get message with reactions to broadcast
      const message = await this.chatService.getMessage(data.messageId, client.userId);

      this.server.to(`room:${message.roomId}`).emit('reaction_updated', {
        messageId: data.messageId,
        reactions: message.reactions,
        type: ChatEventType.REACTION_ADDED,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`Failed to add reaction:`, error);
      client.emit('error', { message: 'Failed to add reaction' });
    }
  }

  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) {
      throw new WsException('Unauthorized');
    }

    const onlineUsers = Array.from(this.roomUsers.get(data.roomId) || []);
    client.emit('online_users', {
      roomId: data.roomId,
      users: onlineUsers,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast typing stop event
   */
  private broadcastTypingStop(roomId: string, userId: string, username: string) {
    this.server.to(`room:${roomId}`).emit('user_stop_typing', {
      userId,
      username,
      roomId,
      timestamp: new Date(),
    });
  }

  /**
   * Set user online status in Redis
   */
  private async setUserOnlineStatus(userId: string, isOnline: boolean) {
    const key = `user:online:${userId}`;

    if (isOnline) {
      await this.redis.setex(key, 300, '1'); // 5 minutes TTL
    } else {
      await this.redis.del(key);
    }

    // Broadcast status change to all instances
    await this.redis.publish('user_status_change', JSON.stringify({
      userId,
      isOnline,
      timestamp: new Date(),
    }));
  }

  /**
   * Get unread count for a room
   */
  private async getUnreadCount(roomId: string, userId: string): Promise<number> {
    const count = await this.redis.get(`chat:unread:${userId}:${roomId}`);
    return parseInt(count || '0');
  }

  /**
   * Handle message updates from other services
   */
  public async broadcastMessageUpdate(event: {
    type: ChatEventType;
    roomId: string;
    message?: any;
    userId?: string;
    data?: any;
  }) {
    this.server.to(`room:${event.roomId}`).emit(event.type, {
      ...event.data,
      timestamp: new Date(),
    });
  }

  /**
   * Send notification to specific user
   */
  public async sendNotificationToUser(userId: string, notification: any) {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.server.to(socketId).emit('notification', {
          ...notification,
          timestamp: new Date(),
        });
      });
    }
  }

  /**
   * Get current connection stats
   */
  public getConnectionStats() {
    return {
      totalConnections: this.connectedClients.size,
      totalUsers: this.userSockets.size,
      roomsActive: this.roomUsers.size,
      userSockets: Object.fromEntries(
        Array.from(this.userSockets.entries()).map(([userId, sockets]) => [
          userId,
          sockets.size,
        ])
      ),
    };
  }
}