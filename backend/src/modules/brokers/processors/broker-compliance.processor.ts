import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { ComplianceService } from '../services/compliance.service';
import { ComplianceCheckType, ComplianceResult } from '../entities/broker-compliance-check.entity';
import { NotificationService } from '../../notifications/services/notification.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Broker } from '../entities/broker.entity';

export interface ComplianceJobData {
  brokerId: string;
  checkType?: ComplianceCheckType;
  options?: any;
}

@Processor('broker-compliance')
export class BrokerComplianceProcessor {
  private readonly logger = new Logger(BrokerComplianceProcessor.name);

  constructor(
    private readonly complianceService: ComplianceService,
    private readonly notificationService: NotificationService,
    private readonly prismaService: PrismaService,
  ) {}

  @OnQueueActive()
  onActive(job: Job<ComplianceJobData>) {
    this.logger.log(`Processing compliance job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<ComplianceJobData>) {
    this.logger.log(`Completed compliance job ${job.id} of type ${job.name}`);
  }

  @OnQueueFailed()
  onFailed(job: Job<ComplianceJobData>, error: Error) {
    this.logger.error(`Failed compliance job ${job.id} of type ${job.name}:`, error);
  }

  @Process('daily-compliance-check')
  async handleDailyComplianceCheck(job: Job<ComplianceJobData>) {
    const { brokerId } = job.data;

    this.logger.log(`Running daily compliance check for broker ${brokerId}`);

    try {
      // Run all required compliance checks
      const checkTypes = [
        ComplianceCheckType.FSCA_LICENSE,
        ComplianceCheckType.SANCTIONS_LIST,
        ComplianceCheckType.ADVERSE_MEDIA,
        ComplianceCheckType.FINANCIAL_HEALTH,
        ComplianceCheckType.SECURITY_ASSESSMENT,
      ];

      const results = [];
      let overallPassed = true;

      for (const checkType of checkTypes) {
        try {
          const result = await this.complianceService.performComplianceCheck(brokerId, checkType);
          results.push({ checkType, result });

          if (result.result === ComplianceResult.FAIL) {
            overallPassed = false;
          }
        } catch (error) {
          this.logger.error(`Failed to run ${checkType} check for broker ${brokerId}:`, error);
          results.push({ checkType, error: error.message });
          overallPassed = false;
        }
      }

      // Calculate overall compliance score
      const complianceScore = await this.complianceService.calculateComplianceScore(brokerId);

      // Log daily check summary
      await this.logComplianceActivity(brokerId, 'DAILY_COMPLIANCE_CHECK', {
        results,
        overallPassed,
        complianceScore,
        checkCount: checkTypes.length,
        passedCount: results.filter(r => r.result?.result !== ComplianceResult.FAIL).length,
      });

      this.logger.log(`Daily compliance check completed for broker ${brokerId}. Score: ${complianceScore}`);

      return {
        success: true,
        overallPassed,
        complianceScore,
        results,
      };
    } catch (error) {
      this.logger.error(`Daily compliance check failed for broker ${brokerId}:`, error);

      await this.logComplianceActivity(brokerId, 'DAILY_COMPLIANCE_CHECK_ERROR', {
        error: error.message,
      });

      throw error;
    }
  }

  @Process('sanctions-check')
  async handleSanctionsCheck(job: Job<ComplianceJobData>) {
    const { brokerId } = job.data;

    this.logger.log(`Running sanctions check for broker ${brokerId}`);

    try {
      const result = await this.complianceService.performComplianceCheck(brokerId, ComplianceCheckType.SANCTIONS_LIST);

      await this.logComplianceActivity(brokerId, 'SANCTIONS_CHECK', {
        result: result.result,
        score: result.score,
        flags: result.details?.flags || [],
      });

      return result;
    } catch (error) {
      this.logger.error(`Sanctions check failed for broker ${brokerId}:`, error);
      throw error;
    }
  }

  @Process('adverse-media-check')
  async handleAdverseMediaCheck(job: Job<ComplianceJobData>) {
    const { brokerId } = job.data;

    this.logger.log(`Running adverse media check for broker ${brokerId}`);

    try {
      const result = await this.complianceService.performComplianceCheck(brokerId, ComplianceCheckType.ADVERSE_MEDIA);

      await this.logComplianceActivity(brokerId, 'ADVERSE_MEDIA_CHECK', {
        result: result.result,
        score: result.score,
        flags: result.details?.flags || [],
      });

      return result;
    } catch (error) {
      this.logger.error(`Adverse media check failed for broker ${brokerId}:`, error);
      throw error;
    }
  }

  @Process('financial-health-check')
  async handleFinancialHealthCheck(job: Job<ComplianceJobData>) {
    const { brokerId } = job.data;

    this.logger.log(`Running financial health check for broker ${brokerId}`);

    try {
      const result = await this.complianceService.performComplianceCheck(brokerId, ComplianceCheckType.FINANCIAL_HEALTH);

      await this.logComplianceActivity(brokerId, 'FINANCIAL_HEALTH_CHECK', {
        result: result.result,
        score: result.score,
        aum: result.details?.actualValue,
        threshold: result.details?.threshold,
      });

      return result;
    } catch (error) {
      this.logger.error(`Financial health check failed for broker ${brokerId}:`, error);
      throw error;
    }
  }

  @Process('security-assessment')
  async handleSecurityAssessment(job: Job<ComplianceJobData>) {
    const { brokerId } = job.data;

    this.logger.log(`Running security assessment for broker ${brokerId}`);

    try {
      const result = await this.complianceService.performComplianceCheck(brokerId, ComplianceCheckType.SECURITY_ASSESSMENT);

      await this.logComplianceActivity(brokerId, 'SECURITY_ASSESSMENT', {
        result: result.result,
        score: result.score,
        flags: result.details?.flags || [],
      });

      return result;
    } catch (error) {
      this.logger.error(`Security assessment failed for broker ${brokerId}:`, error);
      throw error;
    }
  }

  @Process('send-compliance-alert')
  async handleSendComplianceAlert(job: Job<ComplianceJobData>) {
    const { brokerId, options } = job.data;

    this.logger.log(`Sending compliance alert for broker ${brokerId}`);

    try {
      const { alert, escalationLevel = 1 } = options;

      // Send notification through notification service
      await this.notificationService.sendComplianceAlert(brokerId, alert);

      // Log alert sent
      await this.logComplianceActivity(brokerId, 'COMPLIANCE_ALERT_SENT', {
        alertType: alert.type,
        severity: alert.severity,
        escalationLevel,
      });

      // Escalate if needed
      if (escalationLevel > 1) {
        await this.escalateComplianceIssue(brokerId, alert, escalationLevel);
      }

      this.logger.log(`Compliance alert sent for broker ${brokerId}`);
      return { success: true, message: 'Alert sent' };
    } catch (error) {
      this.logger.error(`Failed to send compliance alert for broker ${brokerId}:`, error);
      throw error;
    }
  }

  @Process('handle-critical-compliance-issue')
  async handleCriticalComplianceIssue(job: Job<ComplianceJobData>) {
    const { brokerId, options } = job.data;

    this.logger.log(`Handling critical compliance issue for broker ${brokerId}`);

    try {
      const { alert } = options;

      // Escalate to senior compliance team
      await this.escalateToSeniorTeam(brokerId, alert);

      // Consider temporary suspension for critical issues
      if (alert.severity === 'CRITICAL') {
        await this.considerSuspension(brokerId, alert);
      }

      // Send urgent notifications
      await this.sendUrgentNotifications(brokerId, alert);

      await this.logComplianceActivity(brokerId, 'CRITICAL_COMPLIANCE_ISSUE_HANDLED', {
        alertType: alert.type,
        severity: alert.severity,
        actions: ['ESCALATED', 'NOTIFIED', 'SUSPENSION_CONSIDERED'],
      });

      this.logger.log(`Critical compliance issue handled for broker ${brokerId}`);
      return { success: true, message: 'Critical issue handled' };
    } catch (error) {
      this.logger.error(`Failed to handle critical compliance issue for broker ${brokerId}:`, error);
      throw error;
    }
  }

  @Process('batch-compliance-check')
  async handleBatchComplianceCheck(job: Job<ComplianceJobData>) {
    this.logger.log('Running batch compliance check for all active brokers');

    try {
      // In a real implementation, this would query all active brokers
      const brokerIds = ['broker-1', 'broker-2', 'broker-3']; // Placeholder

      const results = [];

      for (const brokerId of brokerIds) {
        try {
          const result = await this.complianceService.calculateComplianceScore(brokerId);
          results.push({ brokerId, complianceScore: result, success: true });
        } catch (error) {
          results.push({ brokerId, error: error.message, success: false });
        }
      }

      const successfulChecks = results.filter(r => r.success).length;
      const failedChecks = results.filter(r => !r.success).length;

      await this.logComplianceActivity('SYSTEM', 'BATCH_COMPLIANCE_CHECK', {
        totalBrokers: brokerIds.length,
        successfulChecks,
        failedChecks,
        averageScore: successfulChecks > 0
          ? results.filter(r => r.success).reduce((sum, r) => sum + r.complianceScore, 0) / successfulChecks
          : 0,
      });

      this.logger.log(`Batch compliance check completed. Success: ${successfulChecks}, Failed: ${failedChecks}`);

      return {
        success: true,
        totalBrokers: brokerIds.length,
        successfulChecks,
        failedChecks,
        results,
      };
    } catch (error) {
      this.logger.error('Batch compliance check failed:', error);
      throw error;
    }
  }

  private async escalateComplianceIssue(brokerId: string, alert: any, escalationLevel: number): Promise<void> {
    // Escalate based on level
    const escalationTargets = {
      1: ['compliance-team@viralfx.com'],
      2: ['compliance-team@viralfx.com', 'senior-compliance@viralfx.com'],
      3: ['compliance-team@viralfx.com', 'senior-compliance@viralfx.com', 'cto@viralfx.com'],
    };

    const targets = escalationTargets[escalationLevel] || escalationTargets[1];

    for (const target of targets) {
      // Send escalation notification
      await this.notificationService.sendComplianceAlert(brokerId, {
        ...alert,
        message: `[ESCALATION LEVEL ${escalationLevel}] ${alert.message}`,
        escalationTarget: target,
        escalatedAt: new Date(),
      });
    }
  }

  private async escalateToSeniorTeam(brokerId: string, alert: any): Promise<void> {
    // Send to senior compliance team and management
    await this.notificationService.sendComplianceAlert(brokerId, {
      ...alert,
      message: `[CRITICAL ESCALATION] ${alert.message}`,
      escalatedAt: new Date(),
      requiresImmediateAction: true,
    });
  }

  private async considerSuspension(brokerId: string, alert: any): Promise<void> {
    // Log consideration of suspension
    await this.logComplianceActivity(brokerId, 'SUSPENSION_CONSIDERED', {
      alertType: alert.type,
      reason: alert.message,
      consideredAt: new Date(),
    });

    // In a real implementation, this might trigger an automated suspension
    // or create a task for manual review
  }

  private async sendUrgentNotifications(brokerId: string, alert: any): Promise<void> {
    // Send SMS, push notifications, and email for critical issues
    const urgentChannels = ['SMS', 'PUSH', 'EMAIL', 'IN_APP'];

    for (const channel of urgentChannels) {
      await this.notificationService.sendComplianceAlert(brokerId, {
        ...alert,
        message: `[URGENT - ${channel}] ${alert.message}`,
        channel,
        priority: 'HIGH',
      });
    }
  }

  private async logComplianceActivity(
    entityId: string,
    activity: string,
    details: any,
  ): Promise<void> {
    await this.prismaService.auditLog.create({
      data: {
        action: 'COMPLIANCE_CHECK',
        entityType: 'BROKER_COMPLIANCE',
        entityId,
        oldValues: null,
        newValues: JSON.stringify({
          activity,
          details,
          timestamp: new Date().toISOString(),
        }),
        userId: null,
        ipAddress: null,
        userAgent: 'Compliance Processor',
      },
    });
  }
}