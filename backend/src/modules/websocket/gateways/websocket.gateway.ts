import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

@WSGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class WebSocketGatewayHandler implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGatewayHandler.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(private jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);

      client.userId = payload.sub;
      client.user = {
        id: payload.sub,
        email: payload.email,
        username: payload.username,
      };

      this.connectedClients.set(client.id, client);
      client.emit('connected', { message: 'Successfully connected' });
      this.logger.log(`Client connected: ${client.id} (${client.user.username})`);
    } catch (error) {
      this.logger.error('Authentication failed', error);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id} (${client.user?.username})`);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(@MessageBody() roomName: string, @ConnectedSocket() client: AuthenticatedSocket) {
    client.join(roomName);
    client.emit('joined-room', { roomName, message: `Joined room: ${roomName}` });
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(@MessageBody() roomName: string, @ConnectedSocket() client: AuthenticatedSocket) {
    client.leave(roomName);
    client.emit('left-room', { roomName, message: `Left room: ${roomName}` });
  }

  @SubscribeMessage('subscribe-to-updates')
  handleSubscribeToUpdates(@ConnectedSocket() client: AuthenticatedSocket) {
    const userRoom = `user-updates-${client.userId}`;
    client.join(userRoom);
    client.emit('subscribed', { message: 'Subscribed to updates' });
  }

  // Methods to broadcast messages to specific clients
  broadcastToUser(userId: string, event: string, data: any) {
    this.server.to(`user-updates-${userId}`).emit(event, data);
  }

  broadcastToRoom(roomName: string, event: string, data: any) {
    this.server.to(roomName).emit(event, data);
  }

  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  getConnectionStats() {
    return {
      connectedClients: this.connectedClients.size,
      connections: Array.from(this.connectedClients.values()).map(client => ({
        id: client.id,
        userId: client.userId,
        username: client.user?.username,
        email: client.user?.email,
      })),
    };
  }
}