import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
@WebSocketGateway({
  namespace: '/admin',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  },
  transports: ['websocket']
})
export class AdminWebSocketService implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdminWebSocketService.name);
  private connectedClients = new Map<string, Socket>();

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async onModuleInit() {
    this.logger.log('Admin WebSocket Gateway initialized');
  }

  async onModuleDestroy() {
    this.logger.log('Admin WebSocket Gateway destroyed');
  }

  // @OnGatewayConnection() - Removed due to SWC compilation issue
  handleConnection(client: Socket) {
    this.logger.log(`Admin client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Send welcome message
    client.emit('connected', {
      message: 'Connected to Admin WebSocket',
      timestamp: new Date().toISOString()
    });
  }

  // @OnGatewayDisconnect() - Removed due to SWC compilation issue
  handleDisconnect(client: Socket) {
    this.logger.log(`Admin client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('join-admin-room')
  handleJoinAdminRoom(client: Socket, data: { adminId: string }) {
    client.join(`admin-${data.adminId}`);
    client.emit('joined-admin-room', { adminId: data.adminId });
  }

  @SubscribeMessage('leave-admin-room')
  handleLeaveAdminRoom(client: Socket, data: { adminId: string }) {
    client.leave(`admin-${data.adminId}`);
    client.emit('left-admin-room', { adminId: data.adminId });
  }

  // Method to broadcast messages to all connected admins
  broadcastToAdmins(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.log(`Broadcasted to ${this.connectedClients.size} admin clients: ${event}`);
  }

  // Method to send to specific admin
  sendToAdmin(adminId: string, event: string, data: any) {
    this.server.to(`admin-${adminId}`).emit(event, data);
  }

  // Method to get connection stats
  getConnectionStats() {
    return {
      connectedClients: this.connectedClients.size,
      connections: Array.from(this.connectedClients.keys())
    };
  }
}