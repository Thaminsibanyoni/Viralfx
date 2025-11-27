import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WebhookService } from '../services/webhook.service';

@Processor('api-webhooks')
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private webhookService: WebhookService) {}

  @Process('deliver')
  async handleWebhookDelivery(job: Job): Promise<void> {
    try {
      await this.webhookService.processWebhookDelivery(job);
      this.logger.debug(`Webhook delivered successfully: ${job.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to deliver webhook: ${job.id}`,
        error.stack,
      );
      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }
}