import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChatService } from './services/chat.service';
import { ChatModerationService } from './services/chat-moderation.service';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatController } from './controllers/chat.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    NotificationsModule,
    CacheModule.register({
      ttl: 300, // 5 minutes default TTL
      max: 100, // Maximum number of items in cache
    }),
    BullModule.registerQueue({
      name: 'chat-notifications',
    }),
    BullModule.registerQueue({
      name: 'chat-moderation',
    }),
    BullModule.registerQueue({
      name: 'message-processing',
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatModerationService,
    ChatGateway,
  ],
  exports: [
    ChatService,
    ChatModerationService,
    ChatGateway,
  ],
})
export class ChatModule {}