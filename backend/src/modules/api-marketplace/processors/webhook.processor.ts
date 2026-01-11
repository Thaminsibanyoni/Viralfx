import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WebhookService } from '../services/webhook.service';

@Processor('api-webhooks')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private webhookService: WebhookService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'deliver':
        return this.handleWebhookDelivery(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async handleWebhookDelivery(job: Job): Promise<void> {
    try {
      await this.webhookService.processWebhookDelivery(job);
      this.logger.debug(`Webhook delivered successfully: ${job.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to deliver webhook: ${job.id}`,
        error.stack);
      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }
}
