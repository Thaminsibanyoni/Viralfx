import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisModule } from '../redis/redis.module';

import { WebSocketGatewayHandler } from "./gateways/websocket.gateway";
import { WebSocketService } from "./services/websocket.service";
import { ConnectionQualityMonitorService } from "./services/connection-quality-monitor.service";
import { DifferentialSyncService } from "./services/differential-sync.service";
import { WebSocketMetricsController } from "./controllers/websocket-metrics.controller";

// Import other modules with forwardRef to break circular dependencies
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: '15m'
      }
    }),
    CacheModule.register(),
    RedisModule,
    // Use forwardRef to break circular dependencies
    forwardRef(() => AuthModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [WebSocketMetricsController],
  providers: [
    WebSocketGatewayHandler,
    WebSocketService,
    ConnectionQualityMonitorService,
    // DifferentialSyncService temporarily disabled due to circular dependency
  ],
  exports: [
    WebSocketGatewayHandler,
    WebSocketService,
    ConnectionQualityMonitorService,
    // DifferentialSyncService temporarily disabled due to circular dependency
  ]
})
export class WebSocketModule {}
