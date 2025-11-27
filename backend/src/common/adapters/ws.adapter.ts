import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

export class WebSocketAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(WebSocketAdapter.name);

  constructor(app: any) {
    super(app);

    // Redis configuration for scaling WebSocket connections
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      this.adapterConstructor = createAdapter(pubClient, subClient);
    } catch (error) {
      this.logger.warn('Redis not available for WebSocket adapter, falling back to memory adapter');
      // Will use default memory adapter if Redis is not available
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Apply Redis adapter if available
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}