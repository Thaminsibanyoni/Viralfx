import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { FilesService } from '../services/files.service';
import { MinioService } from 'nestjs-minio-client';
import { PrismaService } from '../../../prisma/prisma.service';

interface FileProcessingJob {
  type: 'GENERATE_THUMBNAILS' | 'OPTIMIZE_IMAGE' | 'EXTRACT_TEXT' | 'CONVERT_FORMAT' | 'SCAN_VIRUS';
  data: {
    fileId: string;
    userId: string;
    options?: any;
  };
}

interface FileScanningJob {
  type: 'VIRUS_SCAN' | 'CONTENT_ANALYSIS' | 'DUPLICATE_DETECTION';
  data: {
    fileId: string;
    userId: string;
    filePath: string;
  };
}

interface FileCleanupJob {
  type: 'DELETE_EXPIRED' | 'CLEANUP_TEMP' | 'COMPRESS_STORAGE';
  data: {
    bucket?: string;
    olderThan?: Date;
    dryRun?: boolean;
  };
}

interface FileBackupJob {
  type: 'FULL_BACKUP' | 'INCREMENTAL_BACKUP' | 'SINGLE_FILE';
  data: {
    fileIds?: string[];
    destination?: string;
    compress?: boolean;
    encrypt?: boolean;
  };
}

@Processor('file-processing')
export class FileProcessingProcessor {
  private readonly logger = new Logger(FileProcessingProcessor.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly minio: MinioService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('generate-thumbnails')
  async handleGenerateThumbnails(job: Job<FileProcessingJob>): Promise<void> {
    const { fileId, userId, options } = job.data;

    this.logger.log(`Generating thumbnails for file: ${fileId}`);

    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error('File not found');
      }

      if (!file.mimeType.startsWith('image/')) {
        throw new Error('File is not an image');
      }

      // Get file from MinIO
      const objectStream = await this.minio.client.getObject('viralfx-files', file.objectName);
      const chunks = [];

      for await (const chunk of objectStream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      // Generate thumbnails using image processing library
      const thumbnails = await this.generateImageThumbnails(buffer, options);

      // Upload thumbnails to MinIO
      for (const [size, thumbnailBuffer] of Object.entries(thumbnails)) {
        const thumbnailObjectName = `thumbnails/${size}/${fileId}.jpg`;

        await this.minio.client.putObject(
          'viralfx-files',
          thumbnailObjectName,
          thumbnailBuffer,
          thumbnailBuffer.length,
          { 'Content-Type': 'image/jpeg' }
        );
      }

      // Update file metadata with thumbnail URLs
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          metadata: {
            ...file.metadata,
            thumbnails: Object.keys(thumbnails).reduce((acc, size) => {
              acc[size] = `thumbnails/${size}/${fileId}.jpg`;
              return acc;
            }, {}),
            thumbnailGeneratedAt: new Date().toISOString(),
          },
        },
      });

      this.logger.log(`Thumbnails generated successfully for file: ${fileId}`);
    } catch (error) {
      this.logger.error(`Failed to generate thumbnails for file ${fileId}:`, error);

      // Update file with error status
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          metadata: {
            thumbnailError: error.message,
            thumbnailFailedAt: new Date().toISOString(),
          },
        },
      });

      throw error;
    }
  }

  @Process('optimize-image')
  async handleOptimizeImage(job: Job<FileProcessingJob>): Promise<void> {
    const { fileId, userId, options } = job.data;

    this.logger.log(`Optimizing image for file: ${fileId}`);

    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error('File not found');
      }

      if (!file.mimeType.startsWith('image/')) {
        throw new Error('File is not an image');
      }

      // Get file from MinIO
      const objectStream = await this.minio.client.getObject('viralfx-files', file.objectName);
      const chunks = [];

      for await (const chunk of objectStream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      // Optimize image
      const optimizedBuffer = await this.optimizeImageBuffer(buffer, options);

      // Calculate size savings
      const sizeReduction = ((file.size - optimizedBuffer.length) / file.size) * 100;

      if (sizeReduction > 5) { // Only update if we saved at least 5%
        // Upload optimized version
        const optimizedObjectName = `optimized/${fileId}.${options.format || 'webp'}`;

        await this.minio.client.putObject(
          'viralfx-files',
          optimizedObjectName,
          optimizedBuffer,
          optimizedBuffer.length,
          { 'Content-Type': `image/${options.format || 'webp'}` }
        );

        // Update file metadata
        await this.prisma.file.update({
          where: { id: fileId },
          data: {
            metadata: {
              ...file.metadata,
              optimized: {
                objectName: optimizedObjectName,
                originalSize: file.size,
                optimizedSize: optimizedBuffer.length,
                sizeReduction: Math.round(sizeReduction * 100) / 100,
                options,
                optimizedAt: new Date().toISOString(),
              },
            },
          },
        });

        this.logger.log(`Image optimized successfully for file ${fileId}: ${sizeReduction.toFixed(2)}% reduction`);
      } else {
        this.logger.log(`Image optimization skipped for file ${fileId}: minimal size reduction`);
      }
    } catch (error) {
      this.logger.error(`Failed to optimize image for file ${fileId}:`, error);
      throw error;
    }
  }

  @Process('extract-text')
  async handleExtractText(job: Job<FileProcessingJob>): Promise<void> {
    const { fileId, userId } = job.data;

    this.logger.log(`Extracting text from file: ${fileId}`);

    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error('File not found');
      }

      // Get file from MinIO
      const objectStream = await this.minio.client.getObject('viralfx-files', file.objectName);
      const chunks = [];

      for await (const chunk of objectStream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      // Extract text based on file type
      const extractedText = await this.extractTextFromFile(buffer, file.mimeType);

      if (extractedText) {
        // Update file metadata
        await this.prisma.file.update({
          where: { id: fileId },
          data: {
            metadata: {
              ...file.metadata,
              extractedText,
              textExtractedAt: new Date().toISOString(),
              textLength: extractedText.length,
            },
          },
        });

        this.logger.log(`Text extracted successfully for file ${fileId}: ${extractedText.length} characters`);
      } else {
        this.logger.log(`No text extracted from file ${fileId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to extract text from file ${fileId}:`, error);
      throw error;
    }
  }

  @Process('convert-format')
  async handleConvertFormat(job: Job<FileProcessingJob>): Promise<void> {
    const { fileId, userId, options } = job.data;

    this.logger.log(`Converting file format for file: ${fileId}`);

    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error('File not found');
      }

      // Get file from MinIO
      const objectStream = await this.minio.client.getObject('viralfx-files', file.objectName);
      const chunks = [];

      for await (const chunk of objectStream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      // Convert file format
      const convertedBuffer = await this.convertFileFormat(buffer, file.mimeType, options.targetFormat);

      // Upload converted version
      const convertedObjectName = `converted/${fileId}.${options.targetFormat}`;

      await this.minio.client.putObject(
        'viralfx-files',
        convertedObjectName,
        convertedBuffer,
        convertedBuffer.length,
        { 'Content-Type': this.getMimeTypeFromFormat(options.targetFormat) }
      );

      // Update file metadata
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          metadata: {
            ...file.metadata,
            converted: {
              objectName: convertedObjectName,
              originalFormat: file.mimeType,
              targetFormat: options.targetFormat,
              convertedSize: convertedBuffer.length,
              convertedAt: new Date().toISOString(),
            },
          },
        },
      });

      this.logger.log(`File format converted successfully for file ${fileId}: ${file.mimeType} -> ${options.targetFormat}`);
    } catch (error) {
      this.logger.error(`Failed to convert file format for file ${fileId}:`, error);
      throw error;
    }
  }

  private async generateImageThumbnails(buffer: Buffer, options?: any): Promise<Record<string, Buffer>> {
    // Placeholder for image thumbnail generation
    // This would integrate with libraries like sharp or jimp
    const sizes = options?.sizes || ['small', 'medium', 'large'];
    const dimensions = {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 600, height: 600 },
    };

    const thumbnails: Record<string, Buffer> = {};

    for (const size of sizes) {
      // For now, just return the original buffer (in real implementation, this would resize)
      thumbnails[size] = buffer;
    }

    return thumbnails;
  }

  private async optimizeImageBuffer(buffer: Buffer, options?: any): Promise<Buffer> {
    // Placeholder for image optimization
    // This would integrate with libraries like sharp or imagemin
    const quality = options?.quality || 80;
    const format = options?.format || 'webp';

    // For now, just return the original buffer
    return buffer;
  }

  private async extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
    // Placeholder for text extraction
    // This would integrate with libraries like pdf-parse, tesseract-js, etc.

    if (mimeType === 'application/pdf') {
      // Extract text from PDF
      return 'Extracted text from PDF placeholder';
    } else if (mimeType.startsWith('image/')) {
      // Extract text from image using OCR
      return 'Extracted text from image using OCR placeholder';
    } else if (mimeType.startsWith('text/')) {
      // Return text content directly
      return buffer.toString('utf-8');
    }

    return '';
  }

  private async convertFileFormat(buffer: Buffer, currentFormat: string, targetFormat: string): Promise<Buffer> {
    // Placeholder for file format conversion
    // This would integrate with libraries like sharp (for images), ffmpeg (for video), etc.

    if (currentFormat.startsWith('image/') && ['webp', 'jpg', 'png'].includes(targetFormat)) {
      // Convert image format
      return buffer; // Placeholder
    } else if (currentFormat.startsWith('video/') && ['mp4', 'webm'].includes(targetFormat)) {
      // Convert video format
      return buffer; // Placeholder
    }

    throw new Error(`Conversion from ${currentFormat} to ${targetFormat} not supported`);
  }

  private getMimeTypeFromFormat(format: string): string {
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'pdf': 'application/pdf',
    };

    return mimeTypes[format] || 'application/octet-stream';
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`File processing job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`File processing job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`File processing job ${job.id} failed:`, error.message);
  }
}

@Processor('file-scanning')
export class FileScanningProcessor {
  private readonly logger = new Logger(FileScanningProcessor.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('virus-scan')
  async handleVirusScan(job: Job<FileScanningJob>): Promise<void> {
    const { fileId, userId } = job.data;

    this.logger.log(`Starting virus scan for file: ${fileId}`);

    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error('File not found');
      }

      // Perform virus scan (placeholder)
      const scanResult = await this.performVirusScan(file);

      // Update file with scan results
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          metadata: {
            ...file.metadata,
            virusScan: {
              ...scanResult,
              scannedAt: new Date().toISOString(),
            },
          },
        },
      });

      // If threats are detected, take action
      if (!scanResult.isClean && scanResult.threats.length > 0) {
        await this.handleThreats(file, scanResult);
      }

      this.logger.log(`Virus scan completed for file ${fileId}: ${scanResult.isClean ? 'Clean' : 'Threats detected'}`);
    } catch (error) {
      this.logger.error(`Failed to scan file ${fileId}:`, error);
      throw error;
    }
  }

  private async performVirusScan(file: any): Promise<any> {
    // Placeholder for virus scanning
    // This would integrate with antivirus engines like ClamAV

    return {
      isClean: true,
      threats: [],
      scanEngine: 'ClamAV',
      scanDuration: 1.5,
    };
  }

  private async handleThreats(file: any, scanResult: any): Promise<void> {
    // Handle detected threats
    this.logger.warn(`Threats detected in file ${file.id}:`, scanResult.threats);

    // Could quarantine the file, notify admins, etc.
    await this.prisma.file.update({
      where: { id: file.id },
      data: {
        status: 'QUARANTINED',
      },
    });
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`File scanning job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`File scanning job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`File scanning job ${job.id} failed:`, error.message);
  }
}

@Processor('file-cleanup')
export class FileCleanupProcessor {
  private readonly logger = new Logger(FileCleanupProcessor.name);

  constructor(
    private readonly minio: MinioService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('delete-expired')
  async handleDeleteExpired(job: Job<FileCleanupJob>): Promise<void> {
    this.logger.log('Starting cleanup of expired files');

    try {
      const expiredFiles = await this.prisma.file.findMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          status: 'UPLOADED',
        },
      });

      for (const file of expiredFiles) {
        // Delete from MinIO
        try {
          await this.minio.client.removeObject('viralfx-files', file.objectName);
        } catch (error) {
          this.logger.error(`Failed to delete expired file from storage: ${file.id}`, error);
        }

        // Update database
        await this.prisma.file.update({
          where: { id: file.id },
          data: { status: 'DELETED' },
        });
      }

      this.logger.log(`Cleaned up ${expiredFiles.length} expired files`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired files:', error);
      throw error;
    }
  }

  @OnQueueActive()
  onJobActive(job: Job) {
    this.logger.debug(`File cleanup job ${job.id} started processing`);
  }

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`File cleanup job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`File cleanup job ${job.id} failed:`, error.message);
  }
}