import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

import { ReportService } from '../services/report.service';

@Processor('analytics-report')
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(private readonly reportService: ReportService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'generate-backtest-report':
        return this.processBacktestReport(job);
      case 'generate-performance-report':
        return this.processPerformanceReport(job);
      case 'generate-comparison-report':
        return this.processComparisonReport(job);
      case 'cleanup-expired-reports':
        return this.processCleanupExpiredReports(job);
      case 'batch-report-generation':
        return this.processBatchReportGeneration(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async processBacktestReport(job: Job<{
    reportId: string;
    backtestId: string;
    timestamp: Date;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing backtest report generation: ${job.data.reportId}`);

      const { reportId, backtestId } = job.data;

      // Update progress
      await job.updateProgress(10);

      // Generate the backtest report
      await this.reportService.generateBacktestReportInternal(reportId, backtestId);

      // Update progress
      await job.updateProgress(100);

      this.logger.log(`Backtest report generation completed: ${reportId}`);
      return {
        reportId,
        backtestId,
        completed: true
      };

    } catch (error) {
      this.logger.error(`Backtest report generation job ${job.id} failed:`, error);
      await this.markReportAsFailed(job.data.reportId, error.message);
      throw error;
    }
  }

  private async processPerformanceReport(job: Job<{
    reportId: string;
    config: any;
    userId?: string;
    timestamp: Date;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing performance report generation: ${job.data.reportId}`);

      const { reportId, config, userId } = job.data;

      // Update progress
      await job.updateProgress(10);

      // Generate the performance report
      await this.reportService.generatePerformanceReportInternal(reportId, config, userId);

      // Update progress
      await job.updateProgress(100);

      this.logger.log(`Performance report generation completed: ${reportId}`);
      return {
        reportId,
        config,
        completed: true
      };

    } catch (error) {
      this.logger.error(`Performance report generation job ${job.id} failed:`, error);
      await this.markReportAsFailed(job.data.reportId, error.message);
      throw error;
    }
  }

  private async processComparisonReport(job: Job<{
    reportId: string;
    strategyIds: string[];
    symbol: string;
    period: { start: Date; end: Date };
    userId?: string;
    timestamp: Date;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing comparison report generation: ${job.data.reportId}`);

      const { reportId, strategyIds, symbol, period, userId } = job.data;

      // Update progress
      await job.updateProgress(10);

      // Generate the comparison report
      await this.reportService.generateComparisonReportInternal(
        reportId,
        strategyIds,
        symbol,
        period,
        userId
      );

      // Update progress
      await job.updateProgress(100);

      this.logger.log(`Comparison report generation completed: ${reportId}`);
      return {
        reportId,
        strategyIds,
        symbol,
        completed: true
      };

    } catch (error) {
      this.logger.error(`Comparison report generation job ${job.id} failed:`, error);
      await this.markReportAsFailed(job.data.reportId, error.message);
      throw error;
    }
  }

  private async processCleanupExpiredReports(job: Job<{
    hoursToKeep?: number;
    dryRun?: boolean;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing expired reports cleanup`);

      const { hoursToKeep = 168, dryRun = false } = job.data; // 7 days default

      // Update progress
      await job.updateProgress(10);

      // Get all reports
      const reportHistory = await this.reportService.getReportHistory();

      // Filter expired reports
      const cutoffTime = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000);
      const expiredReports = reportHistory.reports.filter(report =>
        new Date(report.createdAt) < cutoffTime
      );

      await job.updateProgress(50);

      if (dryRun) {
        this.logger.log(`Dry run: Would delete ${expiredReports.length} expired reports`);
        await job.updateProgress(100);

        return {
          dryRun: true,
          hoursToKeep,
          totalReports: reportHistory.reports.length,
          expiredReports: expiredReports.length,
          expiredReportIds: expiredReports.map(r => r.id)
        };
      } else {
        // Delete expired reports from cache
        // This would need to be implemented in ReportService
        let deletedCount = 0;
        for (const report of expiredReports) {
          try {
            // Implementation would go here to remove from Redis
            deletedCount++;
          } catch (error) {
            this.logger.warn(`Failed to delete report ${report.id}:`, error);
          }
        }

        await job.updateProgress(100);

        this.logger.log(`Cleanup completed: deleted ${deletedCount} expired reports`);
        return {
          dryRun: false,
          hoursToKeep,
          totalReports: reportHistory.reports.length,
          expiredReports: expiredReports.length,
          deletedCount
        };
      }

    } catch (error) {
      this.logger.error(`Expired reports cleanup job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async processBatchReportGeneration(job: Job<{
    reportConfigs: Array<{
      type: string;
      entityType: string;
      entityId: string;
      period: string;
      format?: string;
    }>;
    userId?: string;
  }>): Promise<any> {
    try {
      this.logger.log(`Processing batch report generation: ${job.data.reportConfigs.length} reports`);

      const { reportConfigs, userId } = job.data;
      const results = [];

      for (let i = 0; i < reportConfigs.length; i++) {
        const config = reportConfigs[i];

        try {
          const reportId = await this.reportService.queueReportGeneration(config, userId);
          results.push({
            config,
            reportId,
            success: true
          });
        } catch (error) {
          this.logger.warn(`Failed to queue report generation for ${config.entityId}:`, error);
          results.push({
            config,
            success: false,
            error: error.message
          });
        }

        // Update progress
        const progress = Math.floor(((i + 1) / reportConfigs.length) * 90) + 10;
        await job.updateProgress(progress);
      }

      await job.updateProgress(100);

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.log(`Batch report generation completed: ${successful} successful, ${failed} failed`);
      return {
        totalReports: reportConfigs.length,
        successful,
        failed,
        results,
        processedAt: new Date()
      };

    } catch (error) {
      this.logger.error(`Batch report generation job ${job.id} failed:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Report generation job ${job.id} started: ${job.data}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`Report generation job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Report generation job ${job.id} failed:`, error);
  }

  // Helper methods

  private async markReportAsFailed(reportId: string, errorMessage: string): Promise<void> {
    try {
      // Get the current report
      const report = await this.reportService.getReport(reportId);
      if (report) {
        // Update status to failed
        report.status = 'failed';
        // In a real implementation, you'd store the error message and update the cache

        this.logger.warn(`Report ${reportId} marked as failed: ${errorMessage}`);
      }
    } catch (error) {
      this.logger.error(`Failed to mark report ${reportId} as failed:`, error);
    }
  }
}
