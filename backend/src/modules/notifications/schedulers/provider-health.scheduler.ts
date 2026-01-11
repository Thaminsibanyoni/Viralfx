import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { PrismaService } from "../../../prisma/prisma.service";
import { ProviderHealthService } from '../services/provider-health.service';

@Injectable()
export class ProviderHealthScheduler {
  private readonly logger = new Logger(ProviderHealthScheduler.name);
  constructor(
  private readonly prisma: PrismaService,
  private readonly providerHealthService: ProviderHealthService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkProviderHealth(): Promise<void> {
  this.logger.debug('Starting provider health check');
  try {
      // Check health of all notification providers
  const healthStatus = await this.providerHealthService.checkAllProvidersHealth();
  const unhealthyProviders = healthStatus.filter(provider => !provider.isHealthy);
  if (unhealthyProviders.length > 0) {
  this.logger.warn(`Unhealthy providers detected: ${unhealthyProviders.map(p => p.provider).join(', ')}`);

        // Create alert notifications for system administrators
  await this.createProviderHealthAlerts(unhealthyProviders);
  }
  this.logger.debug(`Provider health check completed. ${healthStatus.length} providers checked`);
    } catch (error) {
  this.logger.error('Failed to check provider health:', error);
  }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async updateProviderMetrics(): Promise<void> {
  this.logger.debug('Starting provider metrics update');
  try {
      // Update performance metrics for all providers
  await this.providerHealthService.updateProviderMetrics();
  this.logger.debug('Provider metrics updated successfully');
    } catch (error) {
  this.logger.error('Failed to update provider metrics:', error);
  }
  }

  @Cron('0 0 * * *') // Daily at midnight
  async generateProviderReports(): Promise<void> {
  this.logger.log('Starting daily provider performance report generation');
  try {
      // Generate performance reports for all providers
  const reports = await this.providerHealthService.generateDailyReports();

      // Store reports in database
  for (const report of reports) {
  await this.prisma.providerPerformanceReport.create({
  data: {
  provider: report.provider,
  date: report.date,
  totalSent: report.totalSent,
  totalDelivered: report.totalDelivered,
  totalFailed: report.totalFailed,
  averageDeliveryTime: report.averageDeliveryTime,
  successRate: report.successRate,
  cost: report.cost,
  metadata: report.metadata
  }
  });
  }
  this.logger.log(`Generated ${reports.length} provider performance reports`);
    } catch (error) {
  this.logger.error('Failed to generate provider reports:', error);
  }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldHealthData(): Promise<void> {
  this.logger.log('Starting old health data cleanup');
  try {
      // Clean up provider health data older than 30 days
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await this.prisma.providerHealthData.deleteMany({
  where: {
  timestamp: {
  lt: cutoffDate
  }
  }
  });
  this.logger.log(`Cleaned up ${result.count} old provider health records`);
    } catch (error) {
  this.logger.error('Failed to cleanup old health data:', error);
  }
  }

  @Interval(60000) // Every minute
  async monitorProviderQueues(): Promise<void> {
  this.logger.debug('Monitoring provider queues');
  try {
      // Check queue sizes and processing times
  const queueStatus = await this.providerHealthService.checkQueueStatus();

      // Alert if any queue is backing up
  for (const queue of queueStatus) {
  if (queue.size > 1000) { // Threshold for queue size
  this.logger.warn(`Provider ${queue.provider} queue is backing up: ${queue.size} jobs pending`);
  await this.createQueueAlert(queue);
  }
  }
    } catch (error) {
  this.logger.error('Failed to monitor provider queues:', error);
  }
  }

  @Cron('*/15 * * * *') // Every 15 minutes
  async optimizeProviderSelection(): Promise<void> {
  this.logger.debug('Starting provider selection optimization');
  try {
      // Update provider weights based on performance
  await this.providerHealthService.optimizeProviderWeights();
  this.logger.debug('Provider selection optimization completed');
    } catch (error) {
  this.logger.error('Failed to optimize provider selection:', error);
  }
  }

  private async createProviderHealthAlerts(unhealthyProviders: any[]): Promise<void> {
  try {
      // Find admin users to notify
  const adminUsers = await this.prisma.adminUser.findMany({
  where: {
  isActive: true
  },
  select: {
  id: true
  }
  });

      // Create alerts for each admin
  for (const admin of adminUsers) {
  for (const provider of unhealthyProviders) {
  await this.prisma.notification.create({
  data: {
  userId: admin.id,
  type: 'SYSTEM_ALERT',
  title: `Provider Health Alert: ${provider.provider}`,
  message: `Provider ${provider.provider} is experiencing health issues. Status: ${provider.status}`,
  metadata: {
  provider: provider.provider,
  status: provider.status,
  lastCheck: provider.lastCheck,
  error: provider.error,
  alertType: 'PROVIDER_HEALTH'
  },
  status: 'PENDING',
  priority: 'HIGH'
  }
  });
  }
  }
    } catch (error) {
  this.logger.error('Failed to create provider health alerts:', error);
  }
  }

  private async createQueueAlert(queue: any): Promise<void> {
  try {
      // Find admin users to notify
  const adminUsers = await this.prisma.adminUser.findMany({
  where: {
  isActive: true
  },
  select: {
  id: true
  }
  });

      // Create alerts for each admin
  for (const admin of adminUsers) {
  await this.prisma.notification.create({
  data: {
  userId: admin.id,
  type: 'SYSTEM_ALERT',
  title: `Queue Alert: ${queue.provider}`,
  message: `Provider ${queue.provider} queue has ${queue.size} pending jobs`,
  metadata: {
  provider: queue.provider,
  queueSize: queue.size,
  processingRate: queue.processingRate,
  alertType: 'QUEUE_BACKUP'
  },
  status: 'PENDING',
  priority: 'MEDIUM'
  }
  });
  }
    } catch (error) {
  this.logger.error('Failed to create queue alerts:', error);
  }
  }
}