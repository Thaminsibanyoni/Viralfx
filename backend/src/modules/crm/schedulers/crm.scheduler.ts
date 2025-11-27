import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisService } from '../../redis/redis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrokerDocument } from '../entities/broker-document.entity';
import { Broker } from '../../brokers/entities/broker.entity';

@Injectable()
export class CrmScheduler {
  private readonly logger = new Logger(CrmScheduler.name);

  constructor(
    @InjectQueue('crm-tasks')
    private readonly crmQueue: Queue,
    @InjectQueue('crm-billing')
    private readonly crmBillingQueue: Queue,
    @InjectQueue('crm-ticket-sla')
    private readonly crmTicketSlaQueue: Queue,
    @InjectQueue('crm-docs')
    private readonly crmDocsQueue: Queue,
    @InjectQueue('crm-notifications')
    private readonly crmNotificationsQueue: Queue,
    @InjectQueue('crm-onboarding')
    private readonly crmOnboardingQueue: Queue,
    private redisService: RedisService,
    @InjectRepository(BrokerDocument)
    private brokerDocumentRepository: Repository<BrokerDocument>,
    @InjectRepository(Broker)
    private brokerRepository: Repository<Broker>,
  ) {}

  @Cron('0 9 * * *') // Every day at 9 AM
  async dailyLeadScoring() {
    this.logger.log('Starting daily lead scoring');

    try {
      await this.crmQueue.add('score-leads', {}, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log('Daily lead scoring job queued');
    } catch (error) {
      this.logger.error('Failed to queue daily lead scoring', error);
    }
  }

  @Cron('0 8 * * *') // Every day at 8 AM
  async sendFollowUpReminders() {
    this.logger.log('Starting follow-up reminders');

    try {
      await this.crmQueue.add('send-follow-up-reminders', {}, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log('Follow-up reminders job queued');
    } catch (error) {
      this.logger.error('Failed to queue follow-up reminders', error);
    }
  }

  @Cron('0 0 1 * *') // First day of every month at midnight
  async monthlyContractRenewalCheck() {
    this.logger.log('Starting monthly contract renewal check');

    try {
      await this.crmQueue.add('check-contract-renewals', {}, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log('Contract renewal check job queued');
    } catch (error) {
      this.logger.error('Failed to queue contract renewal check', error);
    }
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async updateOpportunityProbabilities() {
    this.logger.log('Starting opportunity probability update');

    try {
      await this.crmQueue.add('update-opportunity-probabilities', {}, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log('Opportunity probability update job queued');
    } catch (error) {
      this.logger.error('Failed to queue opportunity probability update', error);
    }
  }

  // Daily billing automation at 2:00 AM
  @Cron('0 2 * * *')
  async dailyBillingAutomation() {
    this.logger.log('Starting daily billing automation');

    // Implement distributed lock to prevent concurrent runs
    const lockKey = 'billing-lock:daily';
    const lockAcquired = await this.redisService.setnx(lockKey, '1', 3600); // 1 hour lock

    if (!lockAcquired) {
      this.logger.log('Daily billing already running');
      return;
    }

    try {
      await this.crmBillingQueue.add('generate-recurring-invoices', {}, {
        repeat: { cron: '0 2 * * *' },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });

      this.logger.log('Daily billing automation job queued');
    } catch (error) {
      this.logger.error('Failed to queue daily billing automation', error);
    } finally {
      await this.redisService.del(lockKey);
    }
  }

  // SLA breach checks every 30 minutes
  @Cron('*/30 * * * *')
  async checkSLABreaches() {
    this.logger.log('Starting SLA breach check');

    try {
      // Get active tickets for SLA checking
      const activeTickets = await this.getActiveTickets();

      await this.crmTicketSlaQueue.add('check-breaches', {
        ticketIds: activeTickets
      }, {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });

      this.logger.log(`SLA breach check queued for ${activeTickets.length} tickets`);
    } catch (error) {
      this.logger.error('Failed to queue SLA breach check', error);
    }
  }

  // Document scanning every 2 hours
  @Cron('0 */2 * * *')
  async scanPendingDocuments() {
    this.logger.log('Starting pending document scan');

    try {
      const pendingDocs = await this.getPendingDocuments();

      await this.crmDocsQueue.add('scan-pending-docs', {
        pendingDocIds: pendingDocs
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(`Document scan queued for ${pendingDocs.length} pending documents`);
    } catch (error) {
      this.logger.error('Failed to queue document scan', error);
    }
  }

  // Weekly onboarding review every Monday at 9 AM
  @Cron('0 9 * * 1')
  async weeklyOnboardingReview() {
    this.logger.log('Starting weekly onboarding review');

    try {
      const pendingBrokers = await this.getStalledOnboardings();

      await this.crmOnboardingQueue.add('weekly-review', {
        pendingBrokers
      }, {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      });

      this.logger.log(`Weekly review queued for ${pendingBrokers.length} stalled onboardings`);
    } catch (error) {
      this.logger.error('Failed to queue weekly onboarding review', error);
    }
  }

  // Daily digest notifications at 8 AM
  @Cron('0 8 * * *')
  async sendDailyDigest() {
    this.logger.log('Starting daily digest notifications');

    try {
      await this.crmNotificationsQueue.add('send-digest', {
        type: 'DAILY'
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log('Daily digest notification job queued');
    } catch (error) {
      this.logger.error('Failed to queue daily digest', error);
    }
  }

  // Weekly digest notifications every Monday at 9 AM
  @Cron('0 9 * * 1')
  async sendWeeklyDigest() {
    this.logger.log('Starting weekly digest notifications');

    try {
      await this.crmNotificationsQueue.add('send-digest', {
        type: 'WEEKLY'
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log('Weekly digest notification job queued');
    } catch (error) {
      this.logger.error('Failed to queue weekly digest', error);
    }
  }

  // Payment reconciliation every hour
  @Cron('0 * * * *')
  async reconcilePayments() {
    this.logger.log('Starting payment reconciliation');

    try {
      await this.crmBillingQueue.add('reconcile-payments', {}, {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });

      this.logger.log('Payment reconciliation job queued');
    } catch (error) {
      this.logger.error('Failed to queue payment reconciliation', error);
    }
  }

  // Helper methods for data retrieval
  private async getActiveTickets(): Promise<string[]> {
    // This would query the ticket repository for active tickets
    // For now, return empty array
    return [];
  }

  private async getPendingDocuments(): Promise<string[]> {
    const pendingDocs = await this.brokerDocumentRepository.find({
      where: { status: 'PENDING' },
      select: ['id'],
    });

    return pendingDocs.map(doc => doc.id);
  }

  private async getStalledOnboardings(): Promise<string[]> {
    // Find brokers with onboarding status that haven't been updated in 7+ days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const stalledBrokers = await this.brokerRepository
      .createQueryBuilder('broker')
      .leftJoin('broker.brokerAccount', 'account')
      .where('account.status IN (:...statuses)', {
        statuses: ['ONBOARDING', 'ONBOARDING_FAILED']
      })
      .andWhere('account.onboardingStartedAt < :date', { date: sevenDaysAgo })
      .select(['broker.id'])
      .getMany();

    return stalledBrokers.map(broker => broker.id);
  }
}