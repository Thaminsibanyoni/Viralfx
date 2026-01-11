import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { AdminWebSocketService } from "./admin-websocket.service";
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminWebSocketService: AdminWebSocketService,
    @InjectRedis() private readonly redis: Redis) {}

  async getAllSettings() {
    const cacheKey = 'platform:settings:all';

    // Try to get from cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const settings = await this.prisma.platformSetting.findMany({
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ]
    });

    // Group by category
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = {};
      }

      let value = setting.value;
      // Parse JSON values
      if (setting.type === 'json' && typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          this.logger.warn(`Failed to parse JSON for setting ${setting.key}:`, e);
        }
      } else if (setting.type === 'boolean') {
        value = value === 'true';
      } else if (setting.type === 'number') {
        value = parseFloat(value);
      }

      acc[setting.category][setting.key] = {
        value,
        type: setting.type,
        description: setting.description,
        updatedAt: setting.updatedAt
      };

      return acc;
    }, {} as Record<string, any>);

    // Cache the result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(groupedSettings));

    return groupedSettings;
  }

  async getSetting(key: string) {
    const cacheKey = `platform:setting:${key}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const setting = await this.prisma.platformSetting.findUnique({
      where: { key }
    });

    if (!setting) {
      return null;
    }

    let value = setting.value;
    if (setting.type === 'json' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        this.logger.warn(`Failed to parse JSON for setting ${key}:`, e);
      }
    } else if (setting.type === 'boolean') {
      value = value === 'true';
    } else if (setting.type === 'number') {
      value = parseFloat(value);
    }

    const result = {
      key: setting.key,
      value,
      type: setting.type,
      category: setting.category,
      description: setting.description,
      updatedAt: setting.updatedAt
    };

    // Cache the result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    return result;
  }

  async updateSetting(key: string, value: any, adminId: string) {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key }
    });

    if (!setting) {
      throw new Error(`Setting ${key} not found`);
    }

    // Validate value type
    let stringValue: string;
    if (setting.type === 'json') {
      stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    } else if (setting.type === 'boolean') {
      stringValue = String(Boolean(value));
    } else if (setting.type === 'number') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new Error(`Invalid number value for setting ${key}`);
      }
      stringValue = String(numValue);
    } else {
      stringValue = String(value);
    }

    // Update the setting
    const updatedSetting = await this.prisma.platformSetting.update({
      where: { key },
      data: {
        value: stringValue,
        updatedBy: adminId,
        updatedAt: new Date()
      }
    });

    // Clear cache
    await this.redis.del(`platform:setting:${key}`);
    await this.redis.del('platform:settings:all');

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('admin:settings:updated', {
      key,
      value: stringValue,
      type: setting.type,
      category: setting.category,
      updatedBy: adminId,
      timestamp: new Date().toISOString()
    });

    this.logger.log(`Setting ${key} updated by admin ${adminId}`);

    return updatedSetting;
  }

  async bulkUpdateSettings(settings: Record<string, any>, adminId: string) {
    const results = [];

    for (const [key, value] of Object.entries(settings)) {
      try {
        const result = await this.updateSetting(key, value, adminId);
        results.push({ key, success: true, result });
      } catch (error) {
        this.logger.error(`Failed to update setting ${key}:`, error);
        results.push({ key, success: false, error: error.message });
      }
    }

    return results;
  }

  async getFeatureFlags() {
    const cacheKey = 'platform:features';

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const featureFlags = await this.prisma.platformSetting.findMany({
      where: {
        category: 'features',
        type: 'boolean'
      },
      select: {
        key: true,
        value: true,
        description: true,
        updatedAt: true
      }
    });

    const flags = featureFlags.reduce((acc, flag) => {
      acc[flag.key] = {
        enabled: flag.value === 'true',
        description: flag.description,
        lastUpdated: flag.updatedAt
      };
      return acc;
    }, {} as Record<string, any>);

    // Cache the result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(flags));

    return flags;
  }

  async toggleFeature(feature: string, enabled: boolean, adminId: string) {
    const settingKey = `FEATURE_${feature.toUpperCase()}`;

    return await this.updateSetting(settingKey, enabled, adminId);
  }

  async setMaintenanceMode(enabled: boolean, message?: string, adminId?: string) {
    const maintenanceResult = await this.updateSetting(
      'MAINTENANCE_MODE',
      enabled,
      adminId || 'system'
    );

    if (message) {
      await this.updateSetting(
        'MAINTENANCE_MESSAGE',
        message,
        adminId || 'system'
      );
    }

    // Emit critical WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('admin:maintenance:changed', {
      enabled,
      message,
      timestamp: new Date().toISOString()
    });

    return maintenanceResult;
  }

  async getBranding() {
    const brandingCategories = ['branding', 'ui', 'theme'];
    const allSettings = await this.getAllSettings();

    return brandingCategories.reduce((acc, category) => {
      if (allSettings[category]) {
        acc = { ...acc, ...allSettings[category] };
      }
      return acc;
    }, {} as Record<string, any>);
  }

  async updateBranding(branding: any, adminId: string) {
    const results = [];

    for (const [key, value] of Object.entries(branding)) {
      try {
        const settingKey = `BRAND_${key.toUpperCase()}`;
        const result = await this.updateSetting(settingKey, value, adminId);
        results.push({ key: settingKey, success: true, result });
      } catch (error) {
        this.logger.error(`Failed to update branding setting ${key}:`, error);
        results.push({ key, success: false, error: error.message });
      }
    }

    // Emit branding update event
    await this.adminWebSocketService.broadcastToAdmins('admin:branding:updated', {
      branding,
      updatedBy: adminId,
      timestamp: new Date().toISOString()
    });

    return results;
  }

  async getTradingRules() {
    const tradingCategories = ['trading', 'market', 'limits'];
    const allSettings = await this.getAllSettings();

    return tradingCategories.reduce((acc, category) => {
      if (allSettings[category]) {
        acc = { ...acc, ...allSettings[category] };
      }
      return acc;
    }, {} as Record<string, any>);
  }

  async updateTradingRules(tradingRules: any, adminId: string) {
    const results = [];

    for (const [key, value] of Object.entries(tradingRules)) {
      try {
        const settingKey = `TRADING_${key.toUpperCase()}`;
        const result = await this.updateSetting(settingKey, value, adminId);
        results.push({ key: settingKey, success: true, result });
      } catch (error) {
        this.logger.error(`Failed to update trading rule ${key}:`, error);
        results.push({ key, success: false, error: error.message });
      }
    }

    // Emit trading rules update event
    await this.adminWebSocketService.broadcastToAdmins('admin:trading:rules:updated', {
      tradingRules,
      updatedBy: adminId,
      timestamp: new Date().toISOString()
    });

    return results;
  }

  async getNotificationTemplates() {
    const templates = await this.prisma.platformSetting.findMany({
      where: {
        category: 'notifications',
        type: 'json'
      },
      select: {
        key: true,
        value: true,
        description: true,
        updatedAt: true
      }
    });

    const parsedTemplates = templates.reduce((acc, template) => {
      try {
        acc[template.key] = {
          ...JSON.parse(template.value),
          description: template.description,
          lastUpdated: template.updatedAt
        };
      } catch (e) {
        this.logger.warn(`Failed to parse notification template ${template.key}:`, e);
      }
      return acc;
    }, {} as Record<string, any>);

    return parsedTemplates;
  }

  async updateNotificationTemplate(type: string, template: any, adminId: string) {
    const settingKey = `NOTIF_TEMPLATE_${type.toUpperCase()}`;

    return await this.updateSetting(settingKey, template, adminId);
  }

  async getRateLimits() {
    const rateLimitCategories = ['rate_limits', 'security'];
    const allSettings = await this.getAllSettings();

    return rateLimitCategories.reduce((acc, category) => {
      if (allSettings[category]) {
        acc = { ...acc, ...allSettings[category] };
      }
      return acc;
    }, {} as Record<string, any>);
  }

  async updateRateLimits(rateLimits: any, adminId: string) {
    const results = [];

    for (const [key, value] of Object.entries(rateLimits)) {
      try {
        const settingKey = `RATE_LIMIT_${key.toUpperCase()}`;
        const result = await this.updateSetting(settingKey, value, adminId);
        results.push({ key: settingKey, success: true, result });
      } catch (error) {
        this.logger.error(`Failed to update rate limit ${key}:`, error);
        results.push({ key, success: false, error: error.message });
      }
    }

    return results;
  }

  async getBackupConfiguration() {
    const backupSettings = await this.prisma.platformSetting.findMany({
      where: {
        category: 'backup'
      },
      orderBy: { key: 'asc' }
    });

    const config = backupSettings.reduce((acc, setting) => {
      let value = setting.value;
      if (setting.type === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          this.logger.warn(`Failed to parse backup setting ${setting.key}:`, e);
        }
      } else if (setting.type === 'boolean') {
        value = value === 'true';
      }

      acc[setting.key] = {
        value,
        type: setting.type,
        description: setting.description,
        updatedAt: setting.updatedAt
      };
      return acc;
    }, {} as Record<string, any>);

    return config;
  }

  async updateBackupConfiguration(backupConfig: any, adminId: string) {
    const results = [];

    for (const [key, value] of Object.entries(backupConfig)) {
      try {
        const settingKey = `BACKUP_${key.toUpperCase()}`;
        const result = await this.updateSetting(settingKey, value, adminId);
        results.push({ key: settingKey, success: true, result });
      } catch (error) {
        this.logger.error(`Failed to update backup config ${key}:`, error);
        results.push({ key, success: false, error: error.message });
      }
    }

    return results;
  }

  async initializeDefaultSettings() {
    const defaultSettings = [
      // General Settings
      { key: 'PLATFORM_NAME', value: 'ViralFX', category: 'general', type: 'string', description: 'Platform display name' },
      { key: 'DEFAULT_CURRENCY', value: 'USD', category: 'general', type: 'string', description: 'Default currency' },
      { key: 'DEFAULT_LANGUAGE', value: 'en', category: 'general', type: 'string', description: 'Default language' },
      { key: 'TIMEZONE', value: 'UTC', category: 'general', type: 'string', description: 'Default timezone' },

      // Feature Flags
      { key: 'FEATURE_ORACLE_ENABLED', value: 'true', category: 'features', type: 'boolean', description: 'Enable Oracle network' },
      { key: 'FEATURE_VTS_ENABLED', value: 'true', category: 'features', type: 'boolean', description: 'Enable VTS registry' },
      { key: 'FEATURE_GMN_ENABLED', value: 'false', category: 'features', type: 'boolean', description: 'Enable GMN network' },
      { key: 'FEATURE_SOCIAL_LOGIN', value: 'false', category: 'features', type: 'boolean', description: 'Enable social login' },
      { key: 'FEATURE_2FA_REQUIRED', value: 'false', category: 'features', type: 'boolean', description: 'Require 2FA for all users' },
      { key: 'FEATURE_WELCOME_BONUS', value: 'false', category: 'features', type: 'boolean', description: 'Enable welcome bonus' },
      { key: 'FEATURE_REFERRAL_PROGRAM', value: 'false', category: 'features', type: 'boolean', description: 'Enable referral program' },

      // Branding
      { key: 'BRAND_LOGO_LIGHT', value: '', category: 'branding', type: 'string', description: 'Light theme logo URL' },
      { key: 'BRAND_LOGO_DARK', value: '', category: 'branding', type: 'string', description: 'Dark theme logo URL' },
      { key: 'BRAND_PRIMARY_COLOR', value: '#4B0082', category: 'branding', type: 'string', description: 'Primary brand color' },
      { key: 'BRAND_ACCENT_COLOR', value: '#FFB300', category: 'branding', type: 'string', description: 'Accent brand color' },

      // Trading Rules
      { key: 'TRADING_MIN_STAKE', value: '1', category: 'trading', type: 'number', description: 'Minimum stake amount' },
      { key: 'TRADING_MAX_STAKE', value: '10000', category: 'trading', type: 'number', description: 'Maximum stake amount' },
      { key: 'TRADING_COMMISSION_RATE', value: '0.001', category: 'trading', type: 'number', description: 'Trading commission rate' },

      // Maintenance
      { key: 'MAINTENANCE_MODE', value: 'false', category: 'system', type: 'boolean', description: 'Maintenance mode status' },
      { key: 'MAINTENANCE_MESSAGE', value: 'System under maintenance. Please check back later.', category: 'system', type: 'string', description: 'Maintenance mode message' },

      // Rate Limits
      { key: 'RATE_LIMIT_PUBLIC', value: '100', category: 'rate_limits', type: 'number', description: 'Public API rate limit (per minute)' },
      { key: 'RATE_LIMIT_AUTHENTICATED', value: '1000', category: 'rate_limits', type: 'number', description: 'Authenticated API rate limit (per minute)' },

      // Backup
      { key: 'BACKUP_ENABLED', value: 'true', category: 'backup', type: 'boolean', description: 'Enable automatic backups' },
      { key: 'BACKUP_FREQUENCY', value: 'daily', category: 'backup', type: 'string', description: 'Backup frequency' },
      { key: 'BACKUP_RETENTION_DAYS', value: '30', category: 'backup', type: 'number', description: 'Backup retention period in days' },
    ];

    for (const setting of defaultSettings) {
      const existing = await this.prisma.platformSetting.findUnique({
        where: { key: setting.key }
      });

      if (!existing) {
        await this.prisma.platformSetting.create({
          data: {
            ...setting,
            updatedBy: 'system'
          }
        });
      }
    }

    this.logger.log('Default platform settings initialized');
  }
}
