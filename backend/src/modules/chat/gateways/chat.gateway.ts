import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedClients = new Map<string, Socket>();

  constructor(private jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);

      client.data = { userId: payload.sub };
      this.connectedClients.set(client.id, client);

      client.emit('connected', { message: 'Connected to chat' });
      this.logger.log(`Client connected: ${client.id}`);
    } catch (error) {
      this.logger.error('Authentication failed', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-chat')
  handleJoinChat(@MessageBody() chatRoom: string, @ConnectedSocket() client: Socket) {
    client.join(chatRoom);
    client.emit('joined-chat', { chatRoom });
  }

  @SubscribeMessage('send-message')
  handleMessage(
    @MessageBody() messageData: { chatRoom: string; content: string },
    @ConnectedSocket() client: Socket) {
    this.server.to(messageData.chatRoom).emit('new-message', {
      content: messageData.content,
      sender: client.data.userId,
      timestamp: new Date(),
    });
  }
}