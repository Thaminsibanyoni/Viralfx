import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from "../../../prisma/prisma.service";
import { VPMXCoreService } from '../services/vpmx-core.service';
import { VPMXAnalyticsService } from '../services/vpmx-analytics.service';
import { VPMXPredictionService } from '../services/vpmx-prediction.service';

@Injectable()
export class VPMXScheduler {
  private readonly logger = new Logger(VPMXScheduler.name);
  constructor(
  private readonly prisma: PrismaService,
  private readonly vpmxCoreService: VPMXCoreService,
  private readonly vpmxAnalyticsService: VPMXAnalyticsService,
  private readonly vpmxPredictionService: VPMXPredictionService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async updateVPMXIndices(): Promise<void> {
  this.logger.log('Starting hourly VPMX index update');
  try {
      // Update all VPMX indices with latest market data
  const updatedIndices = await this.vpmxCoreService.updateAllIndices();
  this.logger.log(`Updated ${updatedIndices.length} VPMX indices`);
    } catch (error) {
  this.logger.error('Failed to update VPMX indices:', error);
  }
  }

  @Cron('*/15 * * * *') // Every 15 minutes
  async calculateVPMXScores(): Promise<void> {
  this.logger.debug('Starting VPMX score calculation');
  try {
      // Calculate VPMX scores for trending assets
  const assets = await this.prisma.viralAsset.findMany({
  where: {
  isActive: true
  },
  take: 100 // Limit to top 100 trending assets
  });
  for (const asset of assets) {
  try {
  await this.vpmxCoreService.calculateVPMXScore(asset.id);
        } catch (error) {
  this.logger.error(`Failed to calculate VPMX score for asset ${asset.id}:`, error);
  continue;
  }
      }
  this.logger.debug(`Calculated VPMX scores for ${assets.length} assets`);
    } catch (error) {
  this.logger.error('Failed to calculate VPMX scores:', error);
  }
  }

  @Cron('0 */30 * * * *') // Every 30 minutes
  async runVPMXPredictions(): Promise<void> {
  this.logger.log('Starting VPMX prediction run');
  try {
      // Run ML models to predict viral potential
  const predictions = await this.vpmxPredictionService.runAllPredictions();

      // Store predictions in database
  for (const prediction of predictions) {
  await this.prisma.vpmxPrediction.create({
  data: {
  assetId: prediction.assetId,
  predictedViralityScore: prediction.score,
  confidence: prediction.confidence,
  timeToPeak: prediction.timeToPeak,
  predictedPeakValue: prediction.peakValue,
  factors: prediction.factors,
  modelVersion: prediction.modelVersion,
  createdAt: new Date()
  }
      });
    }
  this.logger.log(`Generated ${predictions.length} VPMX predictions`);
    } catch (error) {
  this.logger.error('Failed to run VPMX predictions:', error);
  }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateRiskAssessments(): Promise<void> {
  this.logger.log('Starting VPMX risk assessment update');
  try {
      // Update risk assessments for all active viral assets
  const assets = await this.prisma.viralAsset.findMany({
  where: {
  isActive: true
  }
  });
  for (const asset of assets) {
  try {
  await this.vpmxCoreService.updateRiskAssessment(asset.id);
        } catch (error) {
  this.logger.error(`Failed to update risk assessment for asset ${asset.id}:`, error);
  continue;
  }
      }
  this.logger.log(`Updated risk assessments for ${assets.length} assets`);
    } catch (error) {
  this.logger.error('Failed to update risk assessments:', error);
  }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async generateVPMXReports(): Promise<void> {
  this.logger.log('Starting VPMX report generation');
  try {
      // Generate comprehensive VPMX analytics reports
  const reports = await this.vpmxAnalyticsService.generateReports();

      // Store reports
  for (const report of reports) {
  await this.prisma.vpmxAnalyticsReport.create({
  data: {
  reportType: report.type,
  data: report.data,
  generatedAt: new Date(),
  metadata: report.metadata
  }
      });
    }
  this.logger.log(`Generated ${reports.length} VPMX reports`);
    } catch (error) {
  this.logger.error('Failed to generate VPMX reports:', error);
  }
  }

  @Cron('0 0 * * *') // Daily at midnight
  async cleanupOldData(): Promise<void> {
  this.logger.log('Starting VPMX data cleanup');
  try {
      // Clean up old prediction data (older than 30 days)
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const predictionsResult = await this.prisma.vpmxPrediction.deleteMany({
  where: {
  createdAt: {
  lt: cutoffDate
  }
      }
  });

      // Clean up old analytics reports (older than 90 days)
  const reportCutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const reportsResult = await this.prisma.vpmxAnalyticsReport.deleteMany({
  where: {
  generatedAt: {
  lt: reportCutoffDate
  }
      }
  });
  this.logger.log(`Cleaned up ${predictionsResult.count} old predictions and ${reportsResult.count} old reports`);
    } catch (error) {
  this.logger.error('Failed to cleanup old VPMX data:', error);
  }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async retrainMLModels(): Promise<void> {
  this.logger.log('Starting ML model retraining');
  try {
      // Retrain VPMX prediction models with latest data
  const modelResults = await this.vpmxPredictionService.retrainModels();

      // Log model performance improvements
  for (const result of modelResults) {
  this.logger.log(`Model ${result.modelName} retrained. New accuracy: ${result.accuracy} Previous accuracy: ${result.previousAccuracy}`);
  }
  this.logger.log(`Retrained ${modelResults.length} ML models`);
    } catch (error) {
  this.logger.error('Failed to retrain ML models:', error);
  }
  }

  @Cron('*/5 * * * *') // Every 5 minutes
  async monitorVPMXPerformance(): Promise<void> {
  this.logger.debug('Monitoring VPMX system performance');
  try {
      // Check system health and performance metrics
  const performance = await this.vpmxCoreService.getPerformanceMetrics();

      // Alert if performance is degraded
  if (performance.responseTime > 5000) { // 5 seconds threshold
  this.logger.warn(`VPMX system performance degraded. Response time: ${performance.responseTime}ms`);
  }

      // Update performance tracking
  await this.prisma.vpmxPerformanceMetric.create({
  data: {
  responseTime: performance.responseTime,
  throughput: performance.throughput,
  errorRate: performance.errorRate,
  cpuUsage: performance.cpuUsage,
  memoryUsage: performance.memoryUsage,
  timestamp: new Date()
  }
  });
    } catch (error) {
  this.logger.error('Failed to monitor VPMX performance:', error);
  }
  }

  @Cron('0 0 * * 0') // Weekly on Sunday at midnight
  async validateVPMXModels(): Promise<void> {
  this.logger.log('Starting VPMX model validation');
  try {
      // Validate ML models against holdout data
  const validationResults = await this.vpmxPredictionService.validateModels();

      // Log validation results
  for (const result of validationResults) {
  this.logger.log(`Model validation for ${result.modelName}: MAE=${result.mae} RMSE=${result.rmse} R²=${result.r2}`);
  }

      // Flag models that need retraining
  const modelsNeedingRetraining = validationResults.filter(result => result.needsRetraining);
  if (modelsNeedingRetraining.length > 0) {
  this.logger.warn(`Models needing retraining: ${modelsNeedingRetraining.map(m => m.modelName).join(', ')}`);

        // Schedule immediate retraining for poor performing models
  for (const model of modelsNeedingRetraining) {
  await this.vpmxPredictionService.scheduleRetraining(model.modelName);
  }
      }
  this.logger.log(`Validated ${validationResults.length} VPMX models`);
    } catch (error) {
  this.logger.error('Failed to validate VPMX models:', error);
  }
  }
}