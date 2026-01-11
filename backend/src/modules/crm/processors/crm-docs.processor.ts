import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RedisService } from "../../redis/redis.service";
// COMMENTED OUT (TypeORM entity deleted): import { BrokerDocument } from '../entities/broker-document.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerNote } from '../entities/broker-note.entity';
import { NotificationService } from "../../notifications/services/notification.service";
import { ClamAVService } from "../../files/services/clamav.service";

@Processor('crm-docs')
export class CrmDocsProcessor extends WorkerHost {
  private readonly logger = new Logger(CrmDocsProcessor.name);

  constructor(
        private redisService: RedisService,
    private notificationsService: NotificationService,
    private clamAVService: ClamAVService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'scan-document':
        return this.handleDocumentScan(job);
      case 'scan-pending-docs':
        return this.handlePendingDocumentsScan(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  private async handleDocumentScan(job: Job<{ docId: string; s3Path: string; brokerId: string }>) {
    const { docId, s3Path, brokerId } = job.data;

    // Implement Redis lock for idempotency
    const lockKey = `scan-lock:${docId}`;
    const lockAcquired = await this.redisService.setnx(lockKey, '1', 300); // 5 minutes lock

    if (!lockAcquired) {
      this.logger.warn(`Document scan already in progress for ${docId}`);
      return { status: 'skipped', reason: 'already_processing' };
    }

    try {
      this.logger.log(`Starting document scan for ${docId} with S3 path: ${s3Path}`);

      // Get document from database
      const document = await this.prisma.brokerdocumentrepository.findFirst({
        where: { id: docId }
      });

      if (!document) {
        throw new Error(`Document ${docId} not found`);
      }

      // Perform virus scan using ClamAV or external service
      const scanResult = await this.performVirusScan(s3Path);

      if (scanResult.infected) {
        // Document is infected - reject and notify compliance
        await this.prisma.brokerdocumentrepository.update(docId, {
          status: 'REJECTED',
          reviewNotes: `Virus detected: ${scanResult.threat}`
        });

        // Create compliance note
        await this.prisma.brokernoterepository.upsert({
          brokerId,
          content: `Document rejected due to virus detection: ${document.documentType}`,
          category: 'SECURITY',
          priority: 'HIGH'
        });

        // Notify compliance operations
        await this.notificationsService.sendNotification({
          type: 'doc_rejected',
          channels: ['email'],
          data: {
            docId,
            brokerId,
            reason: `Virus detected: ${scanResult.threat}`
          }
        });

        this.logger.warn(`Document ${docId} rejected due to virus detection: ${scanResult.threat}`);
        return { status: 'rejected', reason: 'virus_detected' };
      }

      // Document is clean - approve
      await this.prisma.brokerdocumentrepository.update(docId, {
        status: 'APPROVED',
        reviewNotes: 'Document passed security verification'
      });

      // Notify admin about document approval
      await this.notificationsService.sendNotification({
        type: 'doc_approved',
        channels: ['email', 'push'],
        data: {
          docId,
          brokerId,
          documentType: document.documentType
        }
      });

      this.logger.log(`Document ${docId} approved successfully`);
      return { status: 'approved', scanResult };

    } catch (error) {
      this.logger.error(`Failed to scan document ${docId}:`, error);

      // Update document status to indicate failure
      await this.prisma.brokerdocumentrepository.update(docId, {
        status: 'FAILED',
        reviewNotes: `Scan failed: ${error.message}`
      });

      throw error;
    } finally {
      // Release Redis lock
      await this.redisService.del(lockKey);
    }
  }

  private async handlePendingDocumentsScan(job: Job<{ pendingDocIds?: string[] }>) {
    const { pendingDocIds } = job.data;

    let pendingDocs;
    if (pendingDocIds) {
      pendingDocs = await this.prisma.findByIds(pendingDocIds);
    } else {
      // Find all pending documents
      pendingDocs = await this.prisma.brokerdocumentrepository.findMany({
        where: { status: 'PENDING' }
      });
    }

    this.logger.log(`Found ${pendingDocs.length} pending documents to scan`);

    for (const doc of pendingDocs) {
      try {
        // Enqueue individual document scan
        await job.queue.add('scan-document', {
          docId: doc.id,
          s3Path: doc.s3Path,
          brokerId: doc.brokerId
        }, {
          delay: Math.random() * 5000, // Random delay to prevent overload
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        });
      } catch (error) {
        this.logger.error(`Failed to queue scan for document ${doc.id}:`, error);
      }
    }

    return { queued: pendingDocs.length };
  }

  private async performVirusScan(s3Path: string): Promise<{ infected: boolean; threat?: string }> {
    try {
      // Use ClamAV service if available
      if (this.clamAVService) {
        const result = await this.clamAVService.scanFile(s3Path);
        return {
          infected: result.infected,
          threat: result.threat
        };
      }

      // Fallback to external scanning service or mock implementation
      // In production, this would integrate with services like:
      // - VirusTotal API
      // - AWS Macie
      // - Cloud security scanners
      const mockScanResult = Math.random() > 0.95; // 5% chance of infection for demo

      return {
        infected: mockScanResult,
        threat: mockScanResult ? 'Test.Virus.Demo' : undefined
      };
    } catch (error) {
      this.logger.error(`Virus scan failed for ${s3Path}:`, error);
      // Fail safe - treat as potentially infected
      return {
        infected: true,
        threat: 'Scan_failed'
      };
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed job ${job.id} of type ${job.name}. Result:`, result);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed job ${job.id} of type ${job.name}:`, error);
  }
}
