import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RedisService } from "../../redis/redis.service";
import { WalletService } from "../../wallet/services/index";
import { BillingService } from '../services/billing.service';
// COMMENTED OUT (cross-module entity import): import { Broker } from "../../brokers/entities/broker.entity";
// COMMENTED OUT (TypeORM entity deleted): import { BrokerAccount } from '../entities/broker-account.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerNote } from '../entities/broker-note.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerDocument } from '../entities/broker-document.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerSubscription } from '../entities/broker-subscription.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerInvoice } from '../entities/broker-invoice.entity';
import { NotificationService } from "../../notifications/services/notification.service";

@Processor('crm-onboarding')
export class CrmOnboardingProcessor extends WorkerHost {
  private readonly logger = new Logger(CrmOnboardingProcessor.name);

  constructor(
        private redisService: RedisService,
    private walletService: WalletService,
    private billingService: BillingService,
    private notificationsService: NotificationService,
    private dataSource: DataSource) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'onboard-broker':
        return this.handleBrokerOnboarding(job);
      case 'fsca-review':
        return this.handleFSCAReview(job);
      case 'weekly-review':
        return this.handleWeeklyOnboardingReview(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async handleBrokerOnboarding(job: Job<{
    brokerId: string;
    triggerSource: 'MANUAL' | 'AUTOMATIC' | 'WEBHOOK';
  }>) {
    const { brokerId, triggerSource } = job.data;

    this.logger.log(`Starting broker onboarding for ${brokerId} (trigger: ${triggerSource})`);

    // Implement distributed lock to prevent concurrent onboarding
    const lockKey = `onboarding-lock:${brokerId}`;
    const lockAcquired = await this.redisService.setnx(lockKey, '1', 1800); // 30 minutes

    if (!lockAcquired) {
      this.logger.warn(`Broker onboarding already in progress for ${brokerId}`);
      return { status: 'skipped', reason: 'already_processing' };
    }

    try {
      const broker = await this.prisma.broker.findFirst({
        where: { id: brokerId },
        relations: ['brokerAccount']
      });

      if (!broker) {
        throw new Error(`Broker ${brokerId} not found`);
      }

      // Get or create broker account
      let brokerAccount = broker.brokerAccount;
      if (!brokerAccount) {
        brokerAccount = await this.prisma.brokeraccountrepository.upsert({
          brokerId,
          accountNumber: `BKR-${Date.now()}`,
          status: 'ONBOARDING',
          onboardingStartedAt: new Date()
        });
      }

      // Execute onboarding steps
      const onboardingSteps = await this.executeOnboardingSteps(broker, brokerAccount);

      // Update final status
      const finalStatus = onboardingSteps.failed.length === 0 ? 'ACTIVE' : 'ONBOARDING_FAILED';
      await this.prisma.brokeraccountrepository.update(brokerAccount.id, {
        status: finalStatus,
        onboardingCompletedAt: finalStatus === 'ACTIVE' ? new Date() : null,
        onboardingSteps: onboardingSteps
      });

      // Send completion notification
      await this.notificationsService.sendNotification({
        type: finalStatus === 'ACTIVE' ? 'onboarding_completed' : 'onboarding_failed',
        channels: ['email'],
        data: {
          brokerId,
          brokerName: broker.companyName || broker.name,
          status: finalStatus,
          steps: onboardingSteps
        }
      });

      this.logger.log(`Broker onboarding completed for ${brokerId} with status: ${finalStatus}`);
      return { status: finalStatus, steps: onboardingSteps };

    } catch (error) {
      this.logger.error(`Broker onboarding failed for ${brokerId}:`, error);

      // Update account status to failed
      await this.prisma.brokeraccountrepository.update(
        { brokerId },
        {
          status: 'ONBOARDING_FAILED',
          onboardingFailedAt: new Date(),
          failureReason: error.message
        }
      );

      throw error;
    } finally {
      await this.redisService.del(lockKey);
    }
  }

  private async handleFSCAReview(job: Job<{
    brokerId: string;
    reason: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH';
  }>) {
    const { brokerId, reason, priority = 'NORMAL' } = job.data;

    this.logger.log(`Creating FSCA review task for broker ${brokerId}: ${reason}`);

    try {
      const broker = await this.prisma.broker.findFirst({
        where: { id: brokerId }
      });

      if (!broker) {
        throw new Error(`Broker ${brokerId} not found`);
      }

      // Create compliance review note
      await this.prisma.brokernoterepository.upsert({
        brokerId,
        content: `FSCA verification review required: ${reason}`,
        category: 'COMPLIANCE',
        priority: priority,
        requiresAction: true,
        createdBy: 'system',
        metadata: {
          reviewType: 'FSCA_VERIFICATION',
          priority,
          automatedFlag: true
        }
      });

      // Notify compliance operations team
      await this.notificationsService.sendNotification({
        type: 'compliance_review_required',
        channels: ['email', 'push'],
        data: {
          brokerId,
          brokerName: broker.companyName || broker.name,
          reviewType: 'FSCA_VERIFICATION',
          reason,
          priority,
          actionUrl: `/compliance/review/${brokerId}`
        }
      });

      // If FSCA license number is available, attempt automated verification
      if (broker.fscaLicenseNumber && priority !== 'HIGH') {
        await this.attemptFSCAVerification(brokerId, broker.fscaLicenseNumber);
      }

      this.logger.log(`FSCA review task created for broker ${brokerId}`);
      return { status: 'created', brokerId, reviewType: 'FSCA_VERIFICATION' };

    } catch (error) {
      this.logger.error(`Failed to create FSCA review for broker ${brokerId}:`, error);
      throw error;
    }
  }

  private async handleWeeklyOnboardingReview(job: Job<{ pendingBrokers?: string[] }>) {
    const { pendingBrokers } = job.data;

    this.logger.log('Starting weekly onboarding review');

    try {
      let brokers;
      if (pendingBrokers) {
        brokers = await this.prisma.findByIds(pendingBrokers, {
          relations: ['brokerAccount']
        });
      } else {
        // Find brokers with stalled onboarding (> 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        brokers = await this.brokerRepository
          .createQueryBuilder('broker')
          .leftJoinAndSelect('broker.brokerAccount', 'account')
          .where('account.status IN (:...statuses)', {
            statuses: ['ONBOARDING', 'ONBOARDING_FAILED']
          })
          .andWhere('account.onboardingStartedAt < :date', { date: sevenDaysAgo })
          .getMany();
      }

      this.logger.log(`Found ${brokers.length} brokers for weekly review`);

      const reviewResults = {
        escalated: [],
        resolved: [],
        requiresAction: []
      };

      for (const broker of brokers) {
        const account = broker.brokerAccount;
        const daysSinceStart = Math.floor(
          (Date.now() - new Date(account.onboardingStartedAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        const review = await this.performOnboardingReview(broker, account, daysSinceStart);

        if (review.action === 'ESCALATE') {
          reviewResults.escalated.push({
            brokerId: broker.id,
            daysStalled: daysSinceStart,
            reason: review.reason
          });
        } else if (review.action === 'RESOLVE') {
          reviewResults.resolved.push({
            brokerId: broker.id,
            resolution: review.resolution
          });
        } else {
          reviewResults.requiresAction.push({
            brokerId: broker.id,
            action: review.action,
            details: review.details
          });
        }
      }

      // Send summary to operations team
      await this.notificationsService.sendNotification({
        type: 'weekly_onboarding_review',
        channels: ['email'],
        data: {
          reviewDate: new Date().toISOString(),
          totalReviewed: brokers.length,
          escalated: reviewResults.escalated.length,
          resolved: reviewResults.resolved.length,
          requiresAction: reviewResults.requiresAction.length,
          details: reviewResults
        }
      });

      this.logger.log(`Weekly onboarding review completed. Escalated: ${reviewResults.escalated.length}, Resolved: ${reviewResults.resolved.length}`);

      return reviewResults;
    } catch (error) {
      this.logger.error('Weekly onboarding review failed:', error);
      throw error;
    }
  }

  private async executeOnboardingSteps(broker: Broker, brokerAccount: BrokerAccount): Promise<{
    completed: any[];
    failed: any[];
    skipped: any[];
  }> {
    const steps = {
      completed: [],
      failed: [],
      skipped: []
    };

    // Step 1: Verify required documents
    try {
      const docStatus = await this.verifyRequiredDocuments(broker.id);
      steps.completed.push({ step: 'document_verification', status: 'completed', details: docStatus });
    } catch (error) {
      steps.failed.push({ step: 'document_verification', error: error.message });
    }

    // Step 2: Initialize broker wallet
    try {
      await this.walletService.createBrokerWallet(broker.id);
      steps.completed.push({ step: 'wallet_creation', status: 'completed' });
    } catch (error) {
      steps.failed.push({ step: 'wallet_creation', error: error.message });
    }

    // Step 3: Setup initial subscription
    try {
      const subscription = await this.setupInitialSubscription(broker.id);
      steps.completed.push({ step: 'subscription_setup', status: 'completed', details: subscription });
    } catch (error) {
      steps.failed.push({ step: 'subscription_setup', error: error.message });
    }

    // Step 4: Generate welcome package
    try {
      await this.generateWelcomePackage(broker);
      steps.completed.push({ step: 'welcome_package', status: 'completed' });
    } catch (error) {
      steps.failed.push({ step: 'welcome_package', error: error.message });
    }

    // Step 5: Send compliance notifications
    try {
      await this.sendComplianceNotifications(broker);
      steps.completed.push({ step: 'compliance_notifications', status: 'completed' });
    } catch (error) {
      steps.failed.push({ step: 'compliance_notifications', error: error.message });
    }

    return steps;
  }

  private async verifyRequiredDocuments(brokerId: string): Promise<any> {
    const requiredDocs = ['FSP_LICENSE', 'PROOF_OF_ADDRESS', 'BANK_STATEMENT', 'ID_DOCUMENT'];
    const documents = await this.prisma.brokerdocumentrepository.findMany({
      where: { brokerId }
    });

    const verified = documents.filter(doc =>
      requiredDocs.includes(doc.documentType) && doc.status === 'APPROVED'
    );

    if (verified.length < requiredDocs.length) {
      throw new Error(`Missing required documents. Have ${verified.length}/${requiredDocs.length}`);
    }

    return { required: requiredDocs.length, verified: verified.length, documents: verified.map(d => d.documentType) };
  }

  private async setupInitialSubscription(brokerId: string): Promise<BrokerSubscription> {
    return await this.billingService.createInitialSubscription(brokerId);
  }

  private async generateWelcomePackage(broker: Broker): Promise<void> {
    // Generate welcome materials
    const welcomeData = {
      brokerId: broker.id,
      brokerName: broker.companyName || broker.name,
      welcomeEmail: true,
      setupGuide: true,
      apiCredentials: true,
      trainingMaterials: true
    };

    // Send welcome notification
    await this.notificationsService.sendNotification({
      userId: broker.userId,
      type: 'welcome_package',
      channels: ['email'],
      data: welcomeData
    });
  }

  private async sendComplianceNotifications(broker: Broker): Promise<void> {
    // Notify compliance team about new broker
    await this.notificationsService.sendNotification({
      type: 'new_broker_compliance',
      channels: ['email'],
      data: {
        brokerId: broker.id,
        brokerName: broker.companyName || broker.name,
        fscaLicense: broker.fscaLicenseNumber,
        onboardingDate: new Date().toISOString()
      }
    });
  }

  private async attemptFSCAVerification(brokerId: string, licenseNumber: string): Promise<void> {
    // This would integrate with actual FSCA API
    // For now, create a pending verification task
    await this.prisma.brokernoterepository.upsert({
      brokerId,
      content: `Automated FSCA verification initiated for license: ${licenseNumber}`,
      category: 'COMPLIANCE',
      priority: 'NORMAL',
      createdBy: 'system',
      metadata: {
        verificationType: 'FSCA_AUTOMATED',
        licenseNumber,
        initiatedAt: new Date().toISOString()
      }
    });
  }

  private async performOnboardingReview(broker: Broker, account: BrokerAccount, daysStalled: number): Promise<{
    action: string;
    reason?: string;
    resolution?: string;
    details?: any;
  }> {
    // Check if all documents are approved
    const documents = await this.prisma.brokerdocumentrepository.findMany({
      where: { brokerId: broker.id }
    });

    const pendingDocs = documents.filter(doc => doc.status === 'PENDING');
    const rejectedDocs = documents.filter(doc => doc.status === 'REJECTED');

    if (rejectedDocs.length > 0) {
      return {
        action: 'ESCALATE',
        reason: `Rejected documents: ${rejectedDocs.map(d => d.documentType).join(', ')}`
      };
    }

    if (pendingDocs.length > 0 && daysStalled > 14) {
      return {
        action: 'ESCALATE',
        reason: `Stalled onboarding with ${pendingDocs.length} pending documents for ${daysStalled} days`
      };
    }

    if (pendingDocs.length === 0) {
      // All documents processed - can complete onboarding
      return {
        action: 'RESOLVE',
        resolution: 'All documents approved - ready to complete onboarding'
      };
    }

    return {
      action: 'REQUIRES_ACTION',
      details: {
        pendingDocuments: pendingDocs.length,
        daysStalled,
        nextAction: 'Send reminder to broker'
      }
    };
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing onboarding job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed onboarding job ${job.id} of type ${job.name}. Result:`, result);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed onboarding job ${job.id} of type ${job.name}:`, error);
  }
}
