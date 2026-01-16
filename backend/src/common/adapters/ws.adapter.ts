import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

export class WebSocketAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(WebSocketAdapter.name);
  private pubClient: ReturnType<typeof createClient>;
  private subClient: ReturnType<typeof createClient>;

  constructor(app: any) {
    super(app);

    // Redis configuration for scaling WebSocket connections
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.pubClient = createClient({ url: redisUrl, socket: { reconnectStrategy: () => 1000 } });
      this.subClient = this.pubClient.duplicate();

      // Connect both clients
      this.pubClient.connect().catch(err => this.logger.error('PubClient connection error:', err));
      this.subClient.connect().catch(err => this.logger.error('SubClient connection error:', err));

      this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
    } catch (error) {
      this.logger.error('Failed to initialize Redis adapter', error);
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      adapter: this.adapterConstructor
    });

    return server;
  }
}