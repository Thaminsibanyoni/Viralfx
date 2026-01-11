import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class WebSocketEventService extends EventEmitter2 {
  private readonly logger = new Logger(WebSocketEventService.name);
  private connectedClients = new Map<string, any>();

  constructor() {
    super();
  }

  // Emit event to specific client
  emitToClient(clientId: string, event: string, data: any): void {
    this.emit(`client-${clientId}`, { event, data, timestamp: new Date() });
  }

  // Emit event to specific room
  emitToRoom(room: string, event: string, data: any): void {
    this.emit(`room-${room}`, { event, data, timestamp: new Date() });
  }

  // Emit event to specific users
  emitToUsers(userIds: string[], event: string, data: any): void {
    userIds.forEach(userId => {
      this.emitToClient(userId, event, data);
    });
  }

  // Emit to all connected clients
  emitToAll(event: string, data: any): void {
    this.emit('broadcast', { event, data, timestamp: new Date() });
  }

  // Handle client connection
  onClientConnect(clientId: string, clientData: any): void {
    this.connectedClients.set(clientId, {
      ...clientData,
      connectedAt: new Date(),
      lastActivity: new Date(),
    });

    this.emitToAll('client-connected', {
      clientId,
      totalClients: this.connectedClients.size,
    });
  }

  // Handle client disconnection
  onClientDisconnect(clientId: string): void {
    const client = this.connectedClients.get(clientId);
    this.connectedClients.delete(clientId);

    this.emitToAll('client-disconnected', {
      clientId,
      totalClients: this.connectedClients.size,
      sessionDuration: client ? new Date().getTime() - client.connectedAt.getTime() : 0,
    });
  }

  // Get connection statistics
  getConnectionStats() {
    return {
      totalConnections: this.connectedClients.size,
      clients: Array.from(this.connectedClients.entries()).map(([id, data]) => ({
        id,
        ...data,
      })),
    };
  }

  // Check if client is connected
  isClientConnected(clientId: string): boolean {
    return this.connectedClients.has(clientId);
  }

  // Get client information
  getClientInfo(clientId: string): any {
    return this.connectedClients.get(clientId);
  }
}