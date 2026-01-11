import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { PlatformSettingsService } from '../services/platform-settings.service';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('Platform Settings')
@Controller('admin/platform')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class PlatformSettingsController {
  private readonly logger = new Logger(PlatformSettingsController.name);

  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
        private prisma: PrismaService) {}

  @Get('settings')
  @Permissions('platform:read')
  @ApiOperation({ summary: 'Get all platform settings' })
  @ApiResponse({ status: 200, description: 'Platform settings retrieved successfully' })
  async getPlatformSettings() {
    return await this.platformSettingsService.getAllSettings();
  }

  @Put('settings/:key')
  @Permissions('platform:update')
  @ApiOperation({ summary: 'Update a specific setting' })
  @ApiResponse({ status: 200, description: 'Setting updated successfully' })
  async updateSetting(
    @Param('key') key: string,
    @Body('value') value: any,
    @Req() req: any) {
    const result = await this.platformSettingsService.updateSetting(
      key,
      value,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'PlatformSetting',
      targetId: key,
      metadata: { key, value },
      description: `Updated platform setting: ${key}`
    });

    this.logger.log(`Setting ${key} updated by admin ${req.admin.id}`);
    return result;
  }

  @Post('settings/bulk')
  @Permissions('platform:update')
  @ApiOperation({ summary: 'Bulk update multiple settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async bulkUpdateSettings(
    @Body('settings') settings: Record<string, any>,
    @Req() req: any) {
    const result = await this.platformSettingsService.bulkUpdateSettings(
      settings,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.HIGH,
      targetType: 'PlatformSettings',
      targetId: 'bulk_update',
      metadata: { settings },
      description: `Bulk updated ${Object.keys(settings).length} platform settings`
    });

    this.logger.log(`Bulk settings update by admin ${req.admin.id}`);
    return result;
  }

  @Get('features')
  @Permissions('platform:read')
  @ApiOperation({ summary: 'Get feature flags' })
  @ApiResponse({ status: 200, description: 'Feature flags retrieved successfully' })
  async getFeatureFlags() {
    return await this.platformSettingsService.getFeatureFlags();
  }

  @Put('features/:feature')
  @Permissions('platform:update')
  @ApiOperation({ summary: 'Toggle feature flag' })
  @ApiResponse({ status: 200, description: 'Feature flag updated successfully' })
  async toggleFeature(
    @Param('feature') feature: string,
    @Body('enabled') enabled: boolean,
    @Req() req: any) {
    const result = await this.platformSettingsService.toggleFeature(
      feature,
      enabled,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.HIGH,
      targetType: 'FeatureFlag',
      targetId: feature,
      metadata: { feature, enabled },
      description: `${enabled ? 'Enabled' : 'Disabled'} feature: ${feature}`
    });

    this.logger.log(`Feature ${feature} ${enabled ? 'enabled' : 'disabled'} by admin ${req.admin.id}`);
    return result;
  }

  @Post('maintenance')
  @Permissions('platform:*')
  @ApiOperation({ summary: 'Enable/disable maintenance mode' })
  @ApiResponse({ status: 200, description: 'Maintenance mode updated successfully' })
  async setMaintenanceMode(
    @Body('enabled') enabled: boolean,
    @Body('message') message?: string,
    @Req() req: any) {
    const result = await this.platformSettingsService.setMaintenanceMode(
      enabled,
      message,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.CRITICAL,
      targetType: 'MaintenanceMode',
      targetId: 'system',
      metadata: { enabled, message },
      description: `${enabled ? 'Enabled' : 'Disabled'} maintenance mode`
    });

    this.logger.log(`Maintenance mode ${enabled ? 'enabled' : 'disabled'} by admin ${req.admin.id}`);
    return result;
  }

  @Get('branding')
  @Permissions('platform:read')
  @ApiOperation({ summary: 'Get branding configuration' })
  @ApiResponse({ status: 200, description: 'Branding configuration retrieved successfully' })
  async getBranding() {
    return await this.platformSettingsService.getBranding();
  }

  @Put('branding')
  @Permissions('platform:update')
  @ApiOperation({ summary: 'Update branding settings' })
  @ApiResponse({ status: 200, description: 'Branding settings updated successfully' })
  async updateBranding(
    @Body() brandingData: any,
    @Req() req: any) {
    const result = await this.platformSettingsService.updateBranding(
      brandingData,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'Branding',
      targetId: 'platform',
      metadata: brandingData,
      description: 'Updated platform branding'
    });

    this.logger.log(`Branding updated by admin ${req.admin.id}`);
    return result;
  }

  @Get('trading-rules')
  @Permissions('platform:read')
  @ApiOperation({ summary: 'Get trading rules configuration' })
  @ApiResponse({ status: 200, description: 'Trading rules retrieved successfully' })
  async getTradingRules() {
    return await this.platformSettingsService.getTradingRules();
  }

  @Put('trading-rules')
  @Permissions('platform:update')
  @ApiOperation({ summary: 'Update trading rules' })
  @ApiResponse({ status: 200, description: 'Trading rules updated successfully' })
  async updateTradingRules(
    @Body() tradingRules: any,
    @Req() req: any) {
    const result = await this.platformSettingsService.updateTradingRules(
      tradingRules,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.HIGH,
      targetType: 'TradingRules',
      targetId: 'platform',
      metadata: tradingRules,
      description: 'Updated trading rules'
    });

    this.logger.log(`Trading rules updated by admin ${req.admin.id}`);
    return result;
  }

  @Get('notification-templates')
  @Permissions('platform:read')
  @ApiOperation({ summary: 'Get notification templates' })
  @ApiResponse({ status: 200, description: 'Notification templates retrieved successfully' })
  async getNotificationTemplates() {
    return await this.platformSettingsService.getNotificationTemplates();
  }

  @Put('notification-templates/:type')
  @Permissions('platform:update')
  @ApiOperation({ summary: 'Update notification template' })
  @ApiResponse({ status: 200, description: 'Notification template updated successfully' })
  async updateNotificationTemplate(
    @Param('type') type: string,
    @Body('template') template: any,
    @Req() req: any) {
    const result = await this.platformSettingsService.updateNotificationTemplate(
      type,
      template,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.LOW,
      targetType: 'NotificationTemplate',
      targetId: type,
      metadata: { type, template },
      description: `Updated notification template: ${type}`
    });

    this.logger.log(`Notification template ${type} updated by admin ${req.admin.id}`);
    return result;
  }

  @Get('rate-limits')
  @Permissions('platform:read')
  @ApiOperation({ summary: 'Get rate limit configuration' })
  @ApiResponse({ status: 200, description: 'Rate limit configuration retrieved successfully' })
  async getRateLimits() {
    return await this.platformSettingsService.getRateLimits();
  }

  @Put('rate-limits')
  @Permissions('platform:update')
  @ApiOperation({ summary: 'Update rate limit configuration' })
  @ApiResponse({ status: 200, description: 'Rate limit configuration updated successfully' })
  async updateRateLimits(
    @Body() rateLimits: any,
    @Req() req: any) {
    const result = await this.platformSettingsService.updateRateLimits(
      rateLimits,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'RateLimits',
      targetId: 'platform',
      metadata: rateLimits,
      description: 'Updated rate limit configuration'
    });

    this.logger.log(`Rate limits updated by admin ${req.admin.id}`);
    return result;
  }

  @Get('backup')
  @Permissions('platform:read')
  @ApiOperation({ summary: 'Get backup configuration' })
  @ApiResponse({ status: 200, description: 'Backup configuration retrieved successfully' })
  async getBackupConfiguration() {
    return await this.platformSettingsService.getBackupConfiguration();
  }

  @Put('backup')
  @Permissions('platform:update')
  @ApiOperation({ summary: 'Update backup configuration' })
  @ApiResponse({ status: 200, description: 'Backup configuration updated successfully' })
  async updateBackupConfiguration(
    @Body() backupConfig: any,
    @Req() req: any) {
    const result = await this.platformSettingsService.updateBackupConfiguration(
      backupConfig,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.HIGH,
      targetType: 'BackupConfiguration',
      targetId: 'platform',
      metadata: backupConfig,
      description: 'Updated backup configuration'
    });

    this.logger.log(`Backup configuration updated by admin ${req.admin.id}`);
    return result;
  }
}
