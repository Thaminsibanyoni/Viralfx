import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@nestjs-modules/ioredis';

import { WebSocketGateway } from './gateways/websocket.gateway';
import { WebSocketService } from './services/websocket.service';
import { ConnectionQualityMonitorService } from './services/connection-quality-monitor.service';
import { DifferentialSyncService } from './services/differential-sync.service';
import { WebSocketMetricsController } from './controllers/websocket-metrics.controller';

// Import other modules
import { AuthModule } from '../auth/auth.module';
import { OrderMatchingModule } from '../order-matching/order-matching.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketAggregationModule } from '../market-aggregation/market-aggregation.module';
import { ModerationModule } from '../moderation/moderation.module';

// Import entities
import { User } from '../database/entities/user.entity';
import { Trend } from '../database/entities/trend.entity';
import { Order } from '../database/entities/order.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Notification } from '../database/entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Trend,
      Order,
      Wallet,
      Transaction,
      Notification,
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: '15m',
      },
    }),
    RedisModule.forRoot({
      config: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      },
    }),
    AuthModule,
    OrderMatchingModule,
    WalletModule,
    NotificationModule,
    MarketAggregationModule,
    ModerationModule,
  ],
  controllers: [WebSocketMetricsController],
  providers: [
    WebSocketGateway,
    WebSocketService,
    ConnectionQualityMonitorService,
    DifferentialSyncService,
  ],
  exports: [
    WebSocketGateway,
    WebSocketService,
    ConnectionQualityMonitorService,
    DifferentialSyncService,
  ],
})
export class WebSocketModule {}