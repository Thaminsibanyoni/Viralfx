import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectRedis } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  metadata?: any;
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService) {}

  async getActiveAlerts() {
  try {
      // Get active alerts from Redis or database
  const activeAlerts = await this.redis.zrange('alerts:active', 0, -1, {
  rev: true
});
  const alerts = [];
  for (const alertData of activeAlerts) {
  try {
  const alert = JSON.parse(alertData);
  alerts.push(alert);
} catch (error) {
  this.logger.error('Error parsing alert data', error);
}
}
  return {
  total: alerts.length,
  alerts,
  summary: this.summarizeAlerts(alerts)
};
} catch (error) {
  this.logger.error('Error getting active alerts', error);
  return {
  total: 0,
  alerts: [],
  summary: { critical: 0, high: 0, medium: 0, low: 0 }
};
}
}

  async acknowledgeAlert(alertId: string) {
  try {
  const alertKey = `alert:${alertId}`;
  const alertData = await this.redis.get(alertKey);
  if (!alertData) {
  throw new Error(`Alert ${alertId} not found`);
}
  const alert: Alert = JSON.parse(alertData);
  alert.status = 'acknowledged';
  alert.acknowledgedAt = new Date();

      // Update alert in Redis
  await this.redis.set(alertKey, JSON.stringify(alert), 'EX', 86400); // 24 hours TTL

      // Remove from active alerts if it's resolved
  if (alert.status === 'resolved') {
  await this.redis.zrem('alerts:active', alertData);
}
  this.logger.log(`Alert ${alertId} acknowledged`);
  return {
  success: true,
  alert,
  message: 'Alert acknowledged successfully'
};
} catch (error) {
  this.logger.error(`Error acknowledging alert ${alertId}`, error);
  return {
  success: false,
  error: error.message,
  message: 'Failed to acknowledge alert'
};
}
}

  async createAlert(alertData: Partial<Alert>) {
  try {
  const alert: Alert = {
  id: alertData.id || this.generateAlertId(),
  type: alertData.type || 'system',
  severity: alertData.severity || 'medium',
  message: alertData.message || 'System alert',
  status: 'active',
  createdAt: new Date(),
  metadata: alertData.metadata || {}
};

      // Store alert in Redis
  const alertKey = `alert:${alert.id}`;
  await this.redis.set(alertKey, JSON.stringify(alert), 'EX', 86400); // 24 hours TTL

      // Add to active alerts sorted set with timestamp as score
  await this.redis.zadd('alerts:active', Date.now(), JSON.stringify(alert));

      // Send notifications based on severity
  await this.sendAlertNotification(alert);
  this.logger.log(`Alert created: ${alert.id} - ${alert.message}`);
  return alert;
} catch (error) {
  this.logger.error('Error creating alert', error);
  throw error;
}
}

  async resolveAlert(alertId: string) {
  try {
  const alertKey = `alert:${alertId}`;
  const alertData = await this.redis.get(alertKey);
  if (!alertData) {
  throw new Error(`Alert ${alertId} not found`);
}
  const alert: Alert = JSON.parse(alertData);
  alert.status = 'resolved';
  alert.resolvedAt = new Date();

      // Update alert in Redis
  await this.redis.set(alertKey, JSON.stringify(alert), 'EX', 604800); // 7 days TTL

      // Remove from active alerts
  await this.redis.zrem('alerts:active', alertData);
  this.logger.log(`Alert ${alertId} resolved`);
  return {
  success: true,
  alert,
  message: 'Alert resolved successfully'
};
} catch (error) {
  this.logger.error(`Error resolving alert ${alertId}`, error);
  return {
  success: false,
  error: error.message,
  message: 'Failed to resolve alert'
};
}
}

  async getAlertHistory(options: { timeRange?: string; limit?: number }) {
  try {
      // This would typically query historical alerts from a database
  return {
  timeRange: options.timeRange || '24h',
  limit: options.limit || 100,
  alerts: [], // Would return actual historical alerts
  summary: {
  total: 0,
  resolved: 0,
  acknowledged: 0,
  active: 0
}
};
} catch (error) {
  this.logger.error('Error getting alert history', error);
  return {
  timeRange: options.timeRange || '24h',
  limit: options.limit || 100,
  alerts: [],
  summary: {
  total: 0,
  resolved: 0,
  acknowledged: 0,
  active: 0
}
};
}
}

  async sendTestAlert(type: string, message: string) {
  const alert = await this.createAlert({
  type,
  message: `TEST: ${message}`,
  severity: 'low',
  metadata: { test: true, timestamp: new Date() }
});
  return {
  success: true,
  alert,
  message: 'Test alert sent successfully'
};
}

  private async sendAlertNotification(alert: Alert) {
  try {
      // Send notification based on severity
  const notificationData = {
  type: 'alert',
  severity: alert.severity,
  message: alert.message,
  alertId: alert.id,
  timestamp: alert.createdAt
};

      // In a real implementation, this would integrate with the notifications module
  if (alert.severity === 'critical' || alert.severity === 'high') {
        // Send immediate notification for high severity alerts
  this.logger.warn(`High severity alert: ${alert.message}`, alert);

      // Store notification in queue for processing
  await this.redis.lpush('notifications:alerts', JSON.stringify(notificationData));
}
} catch (error) {
  this.logger.error('Error sending alert notification', error);
}
}

  private generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

  private summarizeAlerts(alerts: Alert[]) {
  return alerts.reduce((summary, alert) => {
  summary[alert.severity]++;
  return summary;
}, { critical: 0, high: 0, medium: 0, low: 0 });
}

  async getAlertStatistics(timeRange?: string) {
  try {
      // This would typically query actual statistics from a database
  return {
  timeRange: timeRange || '24h',
  totalAlerts: 0,
  activeAlerts: 0,
  resolvedAlerts: 0,
  acknowledgedAlerts: 0,
  averageResolutionTime: '0m',
  alertsByType: {},
  alertsBySeverity: {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0
}
};
} catch (error) {
  this.logger.error('Error getting alert statistics', error);
  return {
  timeRange: timeRange || '24h',
  totalAlerts: 0,
  activeAlerts: 0,
  resolvedAlerts: 0,
  acknowledgedAlerts: 0,
  averageResolutionTime: '0m',
  alertsByType: {},
  alertsBySeverity: {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0
}
};
}
}}