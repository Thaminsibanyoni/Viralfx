import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

// Entities
import { AdminUser } from './entities/admin-user.entity';
import { AdminPermission } from './entities/admin-permission.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminSession } from './entities/admin-session.entity';

// Services
import { AdminAuthService } from './services/admin-auth.service';
import { AdminRbacService } from './services/admin-rbac.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminWebSocketService } from './services/admin-websocket.service';
import { PlatformSettingsService } from './services/platform-settings.service';
import { VTSManagementService } from './services/vts-management.service';
import { OracleManagementService } from './services/oracle-management.service';
import { NotificationManagementService } from './services/notification-management.service';

// Controllers
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { PlatformSettingsController } from './controllers/platform-settings.controller';
import { VTSManagementController } from './controllers/vts-management.controller';
import { OracleManagementController } from './controllers/oracle-management.controller';
import { NotificationManagementController } from './controllers/notification-management.controller';

// Guards
import { AdminAuthGuard } from './guards/admin-auth.guard';

// External Modules
import { PrismaModule } from '../prisma/prisma.module';
import { OracleModule } from '../oracle/oracle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { ConnectionQualityMonitorService } from '../websocket/services/connection-quality-monitor.service';
import { DifferentialSyncService } from '../websocket/services/differential-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUser,
      AdminPermission,
      AdminAuditLog,
      AdminSession,
    ]),
    JwtModule.registerAsync({
      useFactory: async () => ({
        secret: process.env.JWT_ADMIN_SECRET || 'superadmin-secret-key',
        signOptions: {
          expiresIn: process.env.JWT_ADMIN_EXPIRES_IN || '15m',
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    ConfigModule,
    PrismaModule,
    OracleModule,
    NotificationsModule,
    WebSocketModule,
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    PlatformSettingsController,
    VTSManagementController,
    OracleManagementController,
    NotificationManagementController,
  ],
  providers: [
    AdminAuthService,
    AdminRbacService,
    AdminDashboardService,
    AdminWebSocketService,
    PlatformSettingsService,
    VTSManagementService,
    OracleManagementService,
    NotificationManagementService,
    AdminAuthGuard,
    ConnectionQualityMonitorService,
    DifferentialSyncService,
  ],
  exports: [
    AdminAuthService,
    AdminRbacService,
    AdminDashboardService,
    AdminWebSocketService,
    PlatformSettingsService,
    VTSManagementService,
    OracleManagementService,
    NotificationManagementService,
    AdminAuthGuard,
    ConnectionQualityMonitorService,
    DifferentialSyncService,
  ],
})
export class AdminModule {}