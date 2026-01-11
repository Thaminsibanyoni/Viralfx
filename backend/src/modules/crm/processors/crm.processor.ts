import {Processor, WorkerHost} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CrmService } from '../services/crm.service';
import { LeadService } from '../services/lead.service';
import { OpportunityService } from '../services/opportunity.service';
import { ContractService } from '../services/contract.service';
import { NotificationService } from "../../notifications/services/notification.service";

@Processor('crm-tasks')
export class CrmProcessor extends WorkerHost {
  private readonly logger = new Logger(CrmProcessor.name);

  constructor(
    private readonly crmService: CrmService,
    private readonly leadService: LeadService,
    private readonly opportunityService: OpportunityService,
    private readonly contractService: ContractService,
    private readonly notificationService: NotificationService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'score-leads':
        return this.handleLeadScoring(job);
      case 'send-follow-up-reminders':
        return this.handleFollowUpReminders(job);
      case 'update-opportunity-probabilities':
        return this.handleOpportunityProbabilityUpdate(job);
      case 'check-contract-renewals':
        return this.handleContractRenewalCheck(job);
      case 'send-activity-reminder':
        return this.handleActivityReminder(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async handleLeadScoring(job: Job) {
    this.logger.log('Starting lead scoring process');

    try {
      // Get all leads that need scoring (unscored or with old scores)
      const leadsToScore = await this.leadService.getLeads({
        limit: 1000,
        search: '' // Get leads without filter
      });

      for (const lead of leadsToScore.leads) {
        const score = await this.calculateLeadScore(lead);

        if (score !== lead.leadScore) {
          await this.leadService.updateLead(lead.id, { leadScore: score });
          this.logger.debug(`Updated lead ${lead.id} score to ${score}`);
        }
      }

      this.logger.log(`Completed scoring ${leadsToScore.leads.length} leads`);
    } catch (error) {
      this.logger.error('Lead scoring failed', error);
      throw error;
    }
  }

  private async handleFollowUpReminders(job: Job) {
    this.logger.log('Processing follow-up reminders');

    try {
      // Get scheduled activities for today
      // This would need ActivityService injected
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Send reminders for activities scheduled today
      // Implementation would depend on ActivityService methods

      this.logger.log('Follow-up reminders processed');
    } catch (error) {
      this.logger.error('Follow-up reminders failed', error);
      throw error;
    }
  }

  private async handleOpportunityProbabilityUpdate(job: Job) {
    this.logger.log('Updating opportunity probabilities');

    try {
      // Get opportunities in progress
      const opportunities = await this.opportunityService.getOpportunities({
        page: 1,
        limit: 1000
      });

      for (const opportunity of opportunities.opportunities) {
        const newProbability = await this.calculateDynamicProbability(opportunity);

        if (Math.abs(newProbability - opportunity.probability) > 10) { // Only update if significant change
          await this.opportunityService.updateOpportunity(opportunity.id, {
            probability: newProbability
          });
        }
      }

      this.logger.log(`Updated probabilities for ${opportunities.opportunities.length} opportunities`);
    } catch (error) {
      this.logger.error('Opportunity probability update failed', error);
      throw error;
    }
  }

  private async handleContractRenewalCheck(job: Job) {
    this.logger.log('Checking contract renewals');

    try {
      // Check contracts expiring in 30, 60, 90 days
      const expiringContracts30 = await this.contractService.getExpiringContracts(30);
      const expiringContracts60 = await this.contractService.getExpiringContracts(60);
      const expiringContracts90 = await this.contractService.getExpiringContracts(90);

      // Send notifications for contracts expiring soon
      for (const contract of expiringContracts30) {
        await this.notificationService.sendNotification({
          category: 'crm',
          type: 'contract_expiring_soon',
          recipientId: contract.brokerId,
          data: {
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            daysUntilExpiry: 30
          },
          message: `Contract expiring in 30 days: ${contract.contractNumber}`
        });
      }

      for (const contract of expiringContracts60) {
        await this.notificationService.sendNotification({
          category: 'crm',
          type: 'contract_expiring_soon',
          recipientId: contract.brokerId,
          data: {
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            daysUntilExpiry: 60
          },
          message: `Contract expiring in 60 days: ${contract.contractNumber}`
        });
      }

      this.logger.log(`Checked contract renewals: ${expiringContracts30.length} expiring in 30 days`);
    } catch (error) {
      this.logger.error('Contract renewal check failed', error);
      throw error;
    }
  }

  private async handleActivityReminder(job: Job) {
    const { activityId, scheduledAt, assignedTo } = job.data;

    try {
      if (assignedTo) {
        await this.notificationService.sendNotification({
          category: 'crm',
          type: 'activity_reminder',
          recipientId: assignedTo,
          data: {
            activityId,
            scheduledAt
          },
          message: `Reminder: Activity scheduled for ${new Date(scheduledAt).toLocaleString()}`
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send activity reminder for ${activityId}`, error);
    }
  }

  private async calculateLeadScore(lead: any): Promise<number> {
    let score = 0;

    // Email domain quality
    if (lead.email && !lead.email.includes('@gmail.com') && !lead.email.includes('@yahoo.com')) {
      score += 10;
    }

    // Company information
    if (lead.company) {
      score += 15;
    }

    // Position level (simplified)
    if (lead.position) {
      const position = lead.position.toLowerCase();
      if (position.includes('ceo') || position.includes('director') || position.includes('manager')) {
        score += 15;
      } else if (position.includes('senior') || position.includes('lead')) {
        score += 10;
      }
    }

    // Phone number provided
    if (lead.phone) {
      score += 10;
    }

    // Estimated revenue
    if (lead.estimatedRevenue) {
      if (lead.estimatedRevenue > 100000) score += 20;
      else if (lead.estimatedRevenue > 50000) score += 15;
      else if (lead.estimatedRevenue > 10000) score += 10;
    }

    // Source quality
    switch (lead.source) {
      case 'REFERRAL':
        score += 20;
        break;
      case 'WEBSITE':
        score += 15;
        break;
      case 'EVENT':
        score += 10;
        break;
      case 'COLD_CALL':
        score += 5;
        break;
    }

    return Math.min(100, score);
  }

  private async calculateDynamicProbability(opportunity: any): Promise<number> {
    let baseProbability = 50;

    // Adjust based on stage duration
    const daysInStage = Math.floor(
      (Date.now() - new Date(opportunity.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // If stuck in a stage too long, reduce probability
    if (daysInStage > 30) {
      baseProbability -= 10;
    }

    // Adjust based on value (larger deals might be harder)
    if (opportunity.value > 100000) {
      baseProbability -= 5;
    }

    // Could add more sophisticated logic here based on:
    // - Recent activities
    // - Broker engagement
    // - Market conditions
    // - Competitor activity

    return Math.max(0, Math.min(100, baseProbability));
  }
}
