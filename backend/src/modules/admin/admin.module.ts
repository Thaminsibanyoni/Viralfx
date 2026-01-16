import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';

// Entities

// Services
import { AdminAuthService } from "./services/admin-auth.service";
import { AdminRbacService } from "./services/admin-rbac.service";
import { AdminDashboardService } from "./services/admin-dashboard.service";
import { AdminWebSocketService } from "./services/admin-websocket.service";
import { PlatformSettingsService } from "./services/platform-settings.service";
import { VTSManagementService } from "./services/vts-management.service";
import { OracleManagementService } from "./services/oracle-management.service";
import { NotificationManagementService } from "./services/notification-management.service";
import { TrendApprovalService } from "./services/trend-approval.service";
import { MarketControlService } from "./services/market-control.service";
import { CandleEngineService } from "./services/candle-engine.service";
import { OracleGovernanceService } from "./services/oracle-governance.service";
import { AuditHelper } from "./helpers/audit-helper";

// Controllers
import { AdminAuthController } from "./controllers/admin-auth.controller";
import { AdminDashboardController } from "./controllers/admin-dashboard.controller";
import { PlatformSettingsController } from "./controllers/platform-settings.controller";
import { VTSManagementController } from "./controllers/vts-management.controller";
import { OracleManagementController } from "./controllers/oracle-management.controller";
import { NotificationManagementController } from "./controllers/notification-management.controller";
import { TrendApprovalController } from "./controllers/trend-approval.controller";
import { MarketControlController } from "./controllers/market-control.controller";
import { CandleEngineController } from "./controllers/candle-engine.controller";
import { OracleGovernanceController } from "./controllers/oracle-governance.controller";

// Guards
import { AdminAuthGuard } from "./guards/admin-auth.guard";

// External Modules
import { AuthModule } from '../auth/auth.module';
import { OracleModule } from '../oracle/oracle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { AuditModule } from '../audit/audit.module';
import { ConnectionQualityMonitorService } from '../websocket/services/connection-quality-monitor.service';
import { DifferentialSyncService } from '../websocket/services/differential-sync.service';

@Module({
  imports: [
        JwtModule.registerAsync({
      useFactory: async () => ({
        secret: process.env.JWT_ADMIN_SECRET || 'superadmin-secret-key',
        signOptions: {
          expiresIn: process.env.JWT_ADMIN_EXPIRES_IN || '15m'
        }
      })
    }),
    BullModule.registerQueue({
      name: 'notifications'
    }),
    ConfigModule,
    PrismaModule,
    AuthModule,  // Added for JwtAuthGuard and RolesGuard
    OracleModule,
    NotificationsModule,
    WebSocketModule,
    AuditModule,
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    PlatformSettingsController,
    VTSManagementController,
    OracleManagementController,
    NotificationManagementController,
    TrendApprovalController,
    MarketControlController,
    CandleEngineController,
    OracleGovernanceController,
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
    TrendApprovalService,
    MarketControlService,
    CandleEngineService,
    OracleGovernanceService,
    AuditHelper,
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
    MarketControlService,
    CandleEngineService,
    OracleGovernanceService,
    AdminAuthGuard,
    ConnectionQualityMonitorService,
    DifferentialSyncService,
  ]
})
export class AdminModule {}
