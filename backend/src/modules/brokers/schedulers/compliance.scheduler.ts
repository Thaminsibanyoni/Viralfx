import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository, Not, IsNull } from 'typeorm';
import { ComplianceService } from '../services/compliance.service';
import { FSCAService } from '../services/fsca.service';
import { ComplianceCheckType } from '../entities/broker-compliance-check.entity';
import { Broker, BrokerStatus } from '../entities/broker.entity';

@Injectable()
export class ComplianceScheduler {
  private readonly logger = new Logger(ComplianceScheduler.name);

  constructor(
    @InjectRepository(Broker)
    private readonly brokerRepository: Repository<Broker>,
    private readonly complianceService: ComplianceService,
    private readonly fscsService: FSCAService,
    @InjectQueue('broker-compliance') private complianceQueue: Queue,
    @InjectQueue('broker-verification') private verificationQueue: Queue,
  ) {}

  @Cron('0 2 * * *') // Daily at 2 AM
  async handleDailyComplianceChecks() {
    this.logger.log('Starting daily compliance checks at 2 AM');

    try {
      // Query all active brokers
      const brokers = await this.getActiveBrokers();
      const brokerIds = brokers.map(broker => broker.id);

      const results = [];

      for (const brokerId of brokerIds) {
        try {
          // Queue daily compliance check for each broker
          const job = await this.complianceQueue.add('daily-compliance-check', {
            brokerId,
          }, {
            attempts: 3,
            backoff: 'exponential',
            delay: Math.random() * 60000, // Random delay to prevent overload
          });

          results.push({ brokerId, jobId: job.id, success: true });
          this.logger.log(`Queued daily compliance check for broker ${brokerId}, job ${job.id}`);
        } catch (error) {
          this.logger.error(`Failed to queue daily compliance check for broker ${brokerId}:`, error);
          results.push({ brokerId, error: error.message, success: false });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.log(`Daily compliance checks queued. Success: ${successful}, Failed: ${failed}`);

      return {
        success: true,
        totalBrokers: brokerIds.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      this.logger.error('Failed to start daily compliance checks:', error);
      throw error;
    }
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async handleFSCALicenseStatusCheck() {
    this.logger.log('Starting FSCA license status checks');

    try {
      // Find brokers with FSCA licenses
      const brokersWithLicenses = await this.getBrokersWithFSCALicenses();

      const results = [];

      for (const broker of brokersWithLicenses) {
        try {
          // Check FSCA license status
          const licenseStatus = await this.fscsService.checkLicenseStatus(broker.fscaLicenseNumber);

          // If license is not active, create compliance alert
          if (licenseStatus.licenseStatus !== 'ACTIVE') {
            await this.complianceQueue.add('send-compliance-alert', {
              brokerId: broker.id,
              options: {
                alert: {
                  id: `fscs-status-${broker.id}`,
                  brokerId: broker.id,
                  type: 'FSCA_LICENSE_STATUS',
                  severity: 'HIGH',
                  message: `FSCA license status: ${licenseStatus.licenseStatus}`,
                  details: licenseStatus,
                  recommendations: [
                    'Contact FSCA immediately',
                    'Update license status in ViralFX',
                    'Consider temporary suspension',
                  ],
                  createdAt: new Date(),
                  status: 'OPEN',
                },
                escalationLevel: 2,
              },
            });
          }

          results.push({ brokerId: broker.id, licenseStatus: licenseStatus.licenseStatus, success: true });
        } catch (error) {
          this.logger.error(`Failed to check FSCA license for broker ${broker.id}:`, error);
          results.push({ brokerId: broker.id, error: error.message, success: false });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.log(`FSCA license status checks completed. Success: ${successful}, Failed: ${failed}`);

      return {
        success: true,
        totalChecked: brokersWithLicenses.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      this.logger.error('Failed to complete FSCA license status checks:', error);
      throw error;
    }
  }

  @Cron('0 0 * * 0') // Weekly on Sunday at midnight
  async handleWeeklyComplianceReport() {
    this.logger.log('Generating weekly compliance report');

    try {
      // Collect weekly compliance metrics
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date();
      weekEnd.setHours(23, 59, 59, 999);

      // In a real implementation, this would query actual compliance data
      const reportData = {
        period: {
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
        },
        summary: {
          totalChecks: 245,
          passedChecks: 232,
          failedChecks: 13,
          averageComplianceScore: 0.92,
        },
        issues: [
          {
            type: 'FSCA_LICENSE',
            count: 3,
            severity: 'HIGH',
          },
          {
            type: 'SANCTIONS_LIST',
            count: 2,
            severity: 'MEDIUM',
          },
        ],
        trends: {
          complianceScoreChange: 0.03,
          issueCountChange: -2,
        },
      };

      // Queue report generation
      await this.complianceQueue.add('generate-compliance-report', {
        reportType: 'WEEKLY',
        period: { start: weekStart, end: weekEnd },
        data: reportData,
      });

      this.logger.log('Weekly compliance report generation initiated');
      return {
        success: true,
        message: 'Weekly compliance report generated',
        data: reportData,
      };
    } catch (error) {
      this.logger.error('Failed to generate weekly compliance report:', error);
      throw error;
    }
  }

  @Cron('0 8 * * 1') // Mondays at 8 AM
  async handleSendComplianceReminders() {
    this.logger.log('Sending weekly compliance reminders');

    try {
      // Find brokers needing compliance reminders
      const reminders = await this.getBrokersNeedingComplianceReminders();

      const results = [];

      for (const reminder of reminders) {
        try {
          await this.complianceQueue.add('send-compliance-alert', {
            brokerId: reminder.brokerId,
            options: {
              alert: {
                id: `reminder-${reminder.brokerId}-${reminder.type}`,
                brokerId: reminder.brokerId,
                type: reminder.type,
                severity: 'MEDIUM',
                message: reminder.message,
                details: reminder,
                recommendations: this.getReminderRecommendations(reminder.type),
                createdAt: new Date(),
                status: 'OPEN',
              },
            },
          });

          results.push({ brokerId: reminder.brokerId, type: reminder.type, success: true });
        } catch (error) {
          this.logger.error(`Failed to send compliance reminder for broker ${reminder.brokerId}:`, error);
          results.push({ brokerId: reminder.brokerId, type: reminder.type, error: error.message, success: false });
        }
      }

      const sent = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.log(`Compliance reminders completed. Sent: ${sent}, Failed: ${failed}`);

      return {
        success: true,
        totalReminders: reminders.length,
        sent,
        failed,
        results,
      };
    } catch (error) {
      this.logger.error('Failed to send compliance reminders:', error);
      throw error;
    }
  }

  @Cron('0 3 1 * *') // Monthly on 1st at 3 AM
  async handleMonthlyComplianceReview() {
    this.logger.log('Starting monthly compliance review');

    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date();
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);

      // Perform comprehensive monthly review
      const reviewTasks = [
        'Check all broker compliance scores',
        'Review compliance trends',
        'Identify high-risk brokers',
        'Schedule compliance audits',
        'Update compliance policies',
      ];

      const results = [];

      for (const task of reviewTasks) {
        try {
          // Queue each review task
          await this.complianceQueue.add('monthly-review-task', {
            task,
            period: { start: monthStart, end: monthEnd },
          });

          results.push({ task, success: true });
        } catch (error) {
          this.logger.error(`Failed to queue monthly review task: ${task}:`, error);
          results.push({ task, error: error.message, success: false });
        }
      }

      const completed = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.log(`Monthly compliance review tasks queued. Completed: ${completed}, Failed: ${failed}`);

      return {
        success: true,
        period: { start: monthStart, end: monthEnd },
        totalTasks: reviewTasks.length,
        completed,
        failed,
        results,
      };
    } catch (error) {
      this.logger.error('Failed to start monthly compliance review:', error);
      throw error;
    }
  }

  @Cron('0 */4 * * *') // Every 4 hours
  async handleSecurityAssessments() {
    this.logger.log('Running periodic security assessments');

    try {
      // Queue security assessments for all active brokers
      const brokers = await this.getActiveBrokers();
      const brokerIds = brokers.map(broker => broker.id);

      for (const brokerId of brokerIds) {
        await this.complianceQueue.add('security-assessment', {
          brokerId,
        }, {
          attempts: 2,
          backoff: 'fixed',
          delay: Math.random() * 30000, // Random delay to distribute load
        });
      }

      this.logger.log(`Security assessments queued for ${brokerIds.length} brokers`);
      return {
        success: true,
        totalAssessments: brokerIds.length,
      };
    } catch (error) {
      this.logger.error('Failed to queue security assessments:', error);
      throw error;
    }
  }

  @Cron('0 9 * * *') // Daily at 9 AM
  async handleFSCADocumentExpiryReminders() {
    this.logger.log('Checking for FSCA document expiry reminders');

    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      // Find brokers with FSCA licenses expiring soon
      const brokersWithExpiringLicenses = await this.brokerRepository
        .createQueryBuilder('broker')
        .where('broker.isActive = :isActive', { isActive: true })
        .andWhere('broker.status = :status', { status: BrokerStatus.VERIFIED })
        .andWhere('broker.fscaLicenseExpiry IS NOT NULL')
        .andWhere('broker.fscaLicenseExpiry <= :ninetyDays', { ninetyDays: ninetyDaysFromNow })
        .select(['broker.id', 'broker.companyName', 'broker.fscaLicenseExpiry', 'broker.fscaLicenseNumber'])
        .getMany();

      const results = [];

      for (const broker of brokersWithExpiringLicenses) {
        const daysUntilExpiry = Math.ceil(
          (broker.fscaLicenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        let recommendations: string[];

        if (daysUntilExpiry <= 30) {
          severity = 'CRITICAL';
          recommendations = [
            'Renew FSCA license immediately',
            'Contact FSCA for expedited processing',
            'Upload renewal documentation',
            'Inform clients of potential service interruption',
          ];
        } else if (daysUntilExpiry <= 60) {
          severity = 'HIGH';
          recommendations = [
            'Start FSCA license renewal process',
            'Prepare renewal documentation',
            'Contact FSCA for renewal requirements',
            'Schedule compliance review',
          ];
        } else {
          severity = 'MEDIUM';
          recommendations = [
            'Review FSCA license expiry date',
            'Prepare renewal documentation in advance',
            'Check renewal requirements',
            'Schedule renewal reminder',
          ];
        }

        try {
          await this.complianceQueue.add('send-compliance-alert', {
            brokerId: broker.id,
            options: {
              alert: {
                id: `fscs-expiry-${broker.id}`,
                brokerId: broker.id,
                type: 'DOCUMENT_EXPIRY',
                severity,
                message: `FSCA license expires in ${daysUntilExpiry} days`,
                details: {
                  licenseNumber: broker.fscaLicenseNumber,
                  expiryDate: broker.fscaLicenseExpiry,
                  daysUntilExpiry,
                  licenseType: 'FSCA_LICENSE',
                },
                recommendations,
                createdAt: new Date(),
                status: 'OPEN',
              },
              escalationLevel: severity === 'CRITICAL' ? 3 : severity === 'HIGH' ? 2 : 1,
            },
          });

          results.push({
            brokerId: broker.id,
            companyName: broker.companyName,
            daysUntilExpiry,
            severity,
            success: true
          });

          this.logger.log(`FSCA expiry reminder sent for broker ${broker.companyName} (${daysUntilExpiry} days remaining)`);
        } catch (error) {
          this.logger.error(`Failed to send FSCA expiry reminder for broker ${broker.id}:`, error);
          results.push({ brokerId: broker.id, error: error.message, success: false });
        }
      }

      const sent = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.log(`FSCA expiry reminders completed. Sent: ${sent}, Failed: ${failed}`);

      return {
        success: true,
        totalReminders: brokersWithExpiringLicenses.length,
        sent,
        failed,
        results,
      };
    } catch (error) {
      this.logger.error('Failed to send FSCA expiry reminders:', error);
      throw error;
    }
  }

  @Cron('0 1 * * *') // Daily at 1 AM
  async handleComplianceScoreRecalculation() {
    this.logger.log('Recalculating compliance scores');

    try {
      // Queue batch compliance score recalculation
      await this.complianceQueue.add('batch-compliance-check', {
        brokerId: 'SYSTEM', // Special case for system-wide batch operation
      });

      this.logger.log('Compliance score recalculation queued');
      return {
        success: true,
        message: 'Compliance score recalculation initiated',
      };
    } catch (error) {
      this.logger.error('Failed to queue compliance score recalculation:', error);
      throw error;
    }
  }

  private getReminderRecommendations(type: string): string[] {
    const recommendations = {
      DOCUMENT_EXPIRY: [
        'Upload renewed documents',
        'Check expiration dates',
        'Contact support if assistance needed',
      ],
      COMPLIANCE_SCORE: [
        'Review compliance issues',
        'Address failing checks',
        'Improve security measures',
      ],
      LICENSE_RENEWAL: [
        'Renew FSCA license',
        'Update license details',
        'Submit renewal documentation',
      ],
    };

    return recommendations[type] || ['Contact compliance team for assistance'];
  }

  private async getActiveBrokers(): Promise<Broker[]> {
    try {
      return await this.brokerRepository.find({
        where: {
          isActive: true,
          status: BrokerStatus.VERIFIED,
        },
        select: ['id'],
      });
    } catch (error) {
      this.logger.error('Failed to get active brokers:', error);
      return [];
    }
  }

  private async getBrokersWithFSCALicenses(): Promise<Array<{ id: string; fscaLicenseNumber: string }>> {
    try {
      const brokers = await this.brokerRepository.find({
        where: {
          isActive: true,
          status: BrokerStatus.VERIFIED,
          fscaLicenseNumber: Not(IsNull()),
        },
        select: ['id', 'fscaLicenseNumber'],
      });
      return brokers.map(broker => ({
        id: broker.id,
        fscaLicenseNumber: broker.fscaLicenseNumber,
      }));
    } catch (error) {
      this.logger.error('Failed to get brokers with FSCA licenses:', error);
      return [];
    }
  }

  private async getBrokersNeedingComplianceReminders(): Promise<Array<{
    brokerId: string;
    type: string;
    message: string;
    daysUntilExpiry?: number;
    score?: number;
  }>> {
    try {
      const reminders = [];
      const brokers = await this.brokerRepository.find({
        where: {
          isActive: true,
          status: BrokerStatus.VERIFIED,
        },
        select: ['id', 'companyName', 'riskAssessment'],
      });

      // Check for low compliance scores based on risk assessment
      for (const broker of brokers) {
        if (broker.riskAssessment && broker.riskAssessment.riskScore) {
          const riskScore = broker.riskAssessment.riskScore;

          // If risk score is above 70 (high risk), add a compliance reminder
          if (riskScore > 70) {
            reminders.push({
              brokerId: broker.id,
              type: 'COMPLIANCE_SCORE',
              message: `High compliance risk score: ${riskScore}`,
              score: riskScore,
            });
          }
        }
      }

      return reminders;
    } catch (error) {
      this.logger.error('Failed to get brokers needing compliance reminders:', error);
      return [];
    }
  }
}