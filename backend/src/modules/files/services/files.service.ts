import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException, Inject } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { ConfigService } from '@nestjs/config';
import { MinioService } from 'nestjs-minio-client';
import { v4 as uuidv4 } from 'uuid';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import * as path from 'path';
import {
  UploadFileDto,
  FileDto,
  FileQueryDto,
  FileUploadResponseDto,
  FileStatsDto,
  PresignedUrlDto
} from '../dto/files.dto';
import {
  FileType,
  FileStatus,
  FileVisibility,
  ImageProcessingStatus
} from '../types/files.types';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly bucketName: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    this.bucketName = this.configService.get('MINIO_BUCKET', 'viralfx-files');
    this.maxFileSize = parseInt(this.configService.get('MAX_FILE_SIZE', '104857600')); // 100MB default
    this.allowedMimeTypes = this.configService.get<string[]>(
      'ALLOWED_MIME_TYPES',
      [
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Archives
        'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
        // Video
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
        // Audio
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
        // Text
        'text/plain', 'text/csv', 'application/json',
      ]
    );
    this.baseUrl = this.configService.get('MINIO_ENDPOINT', 'localhost:9000');

    // Ensure bucket exists
    this.ensureBucketExists();
  }

  /**
   * Upload file(s) to MinIO and store metadata
   */
  async uploadFiles(
    files: Array<{
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    }>,
    uploadData: UploadFileDto,
    userId: string
  ): Promise<FileUploadResponseDto[]> {
    this.logger.log(`Uploading ${files.length} files for user ${userId}`);

    try {
      const uploadPromises = files.map(file => this.uploadSingleFile(file, uploadData, userId));
      const results = await Promise.allSettled(uploadPromises);

      const successful: FileDto[] = [];
      const failed: Array<{ filename: string; error: string }> = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            filename: files[index].originalname,
            error: result.reason.message || 'Upload failed'
          });
        }
      });

      this.logger.log(`Upload completed: ${successful.length} successful, ${failed.length} failed`);

      return {
        successful,
        failed,
        total: files.length
      };
    } catch (error) {
      this.logger.error('File upload failed:', error);
      throw new InternalServerErrorException('File upload failed');
    }
  }

  /**
   * Upload a single file
   */
  private async uploadSingleFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    uploadData: UploadFileDto,
    userId: string
  ): Promise<FileDto> {
    // Validate file
    await this.validateFile(file);

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const objectName = `${uploadData.category || 'general'}/${userId}/${Date.now()}/${fileName}`;

    // Calculate file hash
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Check for duplicates
    const existingFile = await this.findDuplicateFile(fileHash, userId);
    if (existingFile && !uploadData.allowDuplicate) {
      return this.formatFile(existingFile);
    }

    try {
      // Upload to MinIO
      await this.minio.client.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
          'X-Amz-Meta-Uploaded-By': userId,
          'X-Amz-Meta-Original-Name': file.originalname,
          'X-Amz-Meta-File-Hash': fileHash
        }
      );

      // Create file metadata record
      const fileType = this.determineFileType(file.mimetype);
      const fileMetadata = await this.extractFileMetadata(file.buffer, file.mimetype);

      const fileRecord = await this.prisma.file.create({
        data: {
          userId,
          fileName,
          originalName: file.originalname,
          objectName,
          mimeType: file.mimetype,
          size: file.size,
          fileType,
          hash: fileHash,
          status: FileStatus.UPLOADED,
          visibility: uploadData.visibility || FileVisibility.PRIVATE,
          category: uploadData.category || 'general',
          metadata: {
            ...fileMetadata,
            uploadedAt: new Date().toISOString(),
            tags: uploadData.tags || []
          },
          expiresAt: uploadData.expiresAt
        }
      });

      // Process image if applicable
      if (fileType === FileType.IMAGE) {
        await this.processImage(fileRecord.id, file.buffer);
      }

      // Cache file info
      await this.cacheFileInfo(fileRecord);

      this.logger.log(`File uploaded successfully: ${fileRecord.id}`);
      return this.formatFile(fileRecord);
    } catch (error) {
      // Cleanup on failure
      try {
        await this.minio.client.removeObject(this.bucketName, objectName);
      } catch (cleanupError) {
        this.logger.error('Failed to cleanup file after upload error:', cleanupError);
      }

      throw error;
    }
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string, userId?: string): Promise<FileDto> {
    // Check cache first
    const cacheKey = `file:${fileId}`;
    let fileRecord = await this.cacheManager.get<any>(cacheKey);

    if (!fileRecord) {
      fileRecord = await this.prisma.file.findUnique({
        where: { id: fileId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      });

      if (!fileRecord) {
        throw new NotFoundException('File not found');
      }

      // Cache the result
      await this.cacheFileInfo(fileRecord);
    }

    // Check access permissions
    await this.checkFileAccess(fileRecord, userId);

    return this.formatFile(fileRecord);
  }

  /**
   * Get file download URL
   */
  async getFileDownloadUrl(
    fileId: string,
    userId?: string,
    expiresIn: number = 3600
  ): Promise<PresignedUrlDto> {
    const fileRecord = await this.prisma.file.findUnique({
      where: { id: fileId }
    });

    if (!fileRecord) {
      throw new NotFoundException('File not found');
    }

    await this.checkFileAccess(fileRecord, userId);

    // Check if file has expired
    if (fileRecord.expiresAt && fileRecord.expiresAt < new Date()) {
      throw new BadRequestException('File has expired');
    }

    try {
      const presignedUrl = await this.minio.client.presignedGetObject(
        this.bucketName,
        fileRecord.objectName,
        expiresIn
      );

      return {
        url: presignedUrl,
        fileName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        size: fileRecord.size,
        expiresAt: new Date(Date.now() + expiresIn * 1000)
      };
    } catch (error) {
      this.logger.error('Failed to generate presigned URL:', error);
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  /**
   * Get file upload URL (for direct browser uploads)
   */
  async getUploadUrl(
    uploadData: UploadFileDto,
    userId: string,
    expiresIn: number = 3600
  ): Promise<PresignedUrlDto> {
    const fileName = `${uuidv4()}`;
    const objectName = `${uploadData.category || 'general'}/${userId}/${Date.now()}/${fileName}`;

    try {
      const presignedUrl = await this.minio.client.presignedPutObject(
        this.bucketName,
        objectName,
        expiresIn
      );

      // Create pending file record
      const fileRecord = await this.prisma.file.create({
        data: {
          userId,
          fileName,
          originalName: uploadData.fileName || fileName,
          objectName,
          mimeType: uploadData.mimeType || 'application/octet-stream',
          status: FileStatus.PENDING,
          visibility: uploadData.visibility || FileVisibility.PRIVATE,
          category: uploadData.category || 'general',
          metadata: {
            tags: uploadData.tags || [],
            uploadUrl: presignedUrl,
            createdAt: new Date().toISOString()
          },
          expiresAt: uploadData.expiresAt
        }
      });

      return {
        url: presignedUrl,
        fileId: fileRecord.id,
        fileName: uploadData.fileName || fileName,
        expiresAt: new Date(Date.now() + expiresIn * 1000)
      };
    } catch (error) {
      this.logger.error('Failed to generate upload URL:', error);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  /**
   * List user's files
   */
  async getUserFiles(
    userId: string,
    query: FileQueryDto = {}
  ): Promise<{
    files: FileDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      type,
      category,
      status,
      visibility,
      search
    } = query;

    const skip = (page - 1) * limit;

    const whereClause: any = { userId };

    if (type) {
      whereClause.fileType = type;
    }

    if (category) {
      whereClause.category = category;
    }

    if (status) {
      whereClause.status = status;
    }

    if (visibility) {
      whereClause.visibility = visibility;
    }

    if (search) {
      whereClause.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
        { metadata: { path: ['tags'], array_contains: [search] } },
      ];
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      }),
      this.prisma.file.count({ where: whereClause }),
    ]);

    return {
      files: files.map(file => this.formatFile(file)),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, userId?: string): Promise<void> {
    const fileRecord = await this.prisma.file.findUnique({
      where: { id: fileId }
    });

    if (!fileRecord) {
      throw new NotFoundException('File not found');
    }

    // Check permissions
    if (userId && fileRecord.userId !== userId) {
      const userRole = await this.getUserRole(userId);
      if (!['ADMIN', 'MODERATOR'].includes(userRole)) {
        throw new BadRequestException('Insufficient permissions to delete this file');
      }
    }

    try {
      // Delete from MinIO
      await this.minio.client.removeObject(this.bucketName, fileRecord.objectName);

      // Delete from database
      await this.prisma.file.delete({
        where: { id: fileId }
      });

      // Remove from cache
      await this.cacheManager.del(`file:${fileId}`);

      this.logger.log(`File deleted successfully: ${fileId}`);
    } catch (error) {
      this.logger.error('Failed to delete file:', error);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  /**
   * Get file statistics
   */
  async getFileStats(userId?: string, timeWindow?: string): Promise<FileStatsDto> {
    const whereClause: any = {};

    if (userId) {
      whereClause.userId = userId;
    }

    if (timeWindow) {
      const daysBack = this.parseTimeWindow(timeWindow);
      whereClause.createdAt = {
        gte: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      };
    }

    const [
      totalFiles,
      totalSize,
      filesByType,
      filesByStatus,
      recentUploads,
      storageUsage,
    ] = await Promise.all([
      this.prisma.file.count({ where: whereClause }),
      this.prisma.file.aggregate({
        where: whereClause,
        _sum: { size: true }
      }),
      this.prisma.file.groupBy({
        by: ['fileType'],
        where: whereClause,
        _count: { fileType: true },
        _sum: { size: true }
      }),
      this.prisma.file.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { status: true }
      }),
      this.prisma.file.count({
        where: {
          ...whereClause,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      this.getStorageUsage(),
    ]);

    return {
      totalFiles,
      totalSize: totalSize._sum.size || 0,
      filesByType: filesByType.reduce((acc, item) => {
        acc[item.fileType] = {
          count: item._count.fileType,
          size: item._sum.size || 0
        };
        return acc;
      }, {}),
      filesByStatus: filesByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      recentUploads,
      storageUsage
    };
  }

  /**
   * Validate file before upload
   */
  private async validateFile(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): Promise<void> {
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    // Additional virus scanning could be added here
    // await this.scanForMalware(file.buffer);
  }

  /**
   * Determine file type from MIME type
   */
  private determineFileType(mimeType: string): FileType {
    if (mimeType.startsWith('image/')) {
      return FileType.IMAGE;
    } else if (mimeType.startsWith('video/')) {
      return FileType.VIDEO;
    } else if (mimeType.startsWith('audio/')) {
      return FileType.AUDIO;
    } else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
      return FileType.DOCUMENT;
    } else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) {
      return FileType.ARCHIVE;
    } else {
      return FileType.OTHER;
    }
  }

  /**
   * Extract metadata from file
   */
  private async extractFileMetadata(buffer: Buffer, mimeType: string): Promise<any> {
    const metadata: any = {
      size: buffer.length,
      hash: crypto.createHash('sha256').update(buffer).digest('hex')
    };

    if (mimeType.startsWith('image/')) {
      try {
        // Image metadata extraction would go here
        // For now, just add basic info
        metadata.dimensions = {
          width: 0, // Would extract from image
          height: 0
        };
      } catch (error) {
        this.logger.warn('Failed to extract image metadata:', error);
      }
    }

    return metadata;
  }

  /**
   * Process uploaded image (create thumbnails, optimize, etc.)
   */
  private async processImage(fileId: string, buffer: Buffer): Promise<void> {
    try {
      // Update image processing status
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          metadata: {
            imageProcessingStatus: ImageProcessingStatus.PROCESSING,
            processedAt: new Date().toISOString()
          }
        }
      });

      // Create thumbnails, resize images, etc.
      // This would integrate with image processing libraries

      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          metadata: {
            imageProcessingStatus: ImageProcessingStatus.COMPLETED,
            thumbnails: {
              small: `thumbs/small/${fileId}.jpg`,
              medium: `thumbs/medium/${fileId}.jpg`,
              large: `thumbs/large/${fileId}.jpg`
            }
          }
        }
      });

      this.logger.log(`Image processing completed for file: ${fileId}`);
    } catch (error) {
      this.logger.error('Image processing failed:', error);

      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          metadata: {
            imageProcessingStatus: ImageProcessingStatus.FAILED,
            processingError: error.message
          }
        }
      });
    }
  }

  /**
   * Find duplicate file by hash
   */
  private async findDuplicateFile(hash: string, userId: string): Promise<any | null> {
    return await this.prisma.file.findFirst({
      where: {
        hash,
        userId,
        status: FileStatus.UPLOADED
      }
    });
  }

  /**
   * Check file access permissions
   */
  private async checkFileAccess(file: any, userId?: string): Promise<void> {
    if (!userId) {
      if (file.visibility !== FileVisibility.PUBLIC) {
        throw new BadRequestException('Authentication required to access this file');
      }
      return;
    }

    // Owner can always access their files
    if (file.userId === userId) {
      return;
    }

    // Check user role
    const userRole = await this.getUserRole(userId);
    if (['ADMIN', 'MODERATOR'].includes(userRole)) {
      return;
    }

    // Check file visibility
    if (file.visibility === FileVisibility.PRIVATE) {
      throw new BadRequestException('You do not have permission to access this file');
    }
  }

  /**
   * Get user role
   */
  private async getUserRole(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    return user?.role || 'USER';
  }

  /**
   * Cache file information
   */
  private async cacheFileInfo(file: any): Promise<void> {
    const cacheKey = `file:${file.id}`;
    await this.cacheManager.set(cacheKey, file, 300); // 5 minutes TTL
  }

  /**
   * Get storage usage statistics
   */
  private async getStorageUsage(): Promise<{ total: number; used: number; available: number }> {
    try {
      const stats = await this.minio.client.bucketExists(this.bucketName);
      // MinIO doesn't provide detailed stats easily, so we'll estimate
      return {
        total: 0, // Would get from MinIO stats or config
        used: 0,
        available: 0
      };
    } catch (error) {
      this.logger.error('Failed to get storage usage:', error);
      return {
        total: 0,
        used: 0,
        available: 0
      };
    }
  }

  /**
   * Ensure bucket exists
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      const bucketExists = await this.minio.client.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.minio.client.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Created bucket: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error('Failed to ensure bucket exists:', error);
    }
  }

  /**
   * Format file for response
   */
  private formatFile(file: any): FileDto {
    return {
      id: file.id,
      userId: file.userId,
      fileName: file.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      fileType: file.fileType,
      status: file.status,
      visibility: file.visibility,
      category: file.category,
      hash: file.hash,
      metadata: file.metadata,
      downloadUrl: `${this.baseUrl}/${this.bucketName}/${file.objectName}`,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      expiresAt: file.expiresAt,
      user: file.user
    };
  }

  /**
   * Parse time window string to days
   */
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([hdwmy])$/);
    if (!match) {
      return 7; // Default to 7 days
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      h: 1 / 24,    // hour
      d: 1,         // day
      w: 7,         // week
      m: 30,        // month
      y: 365       // year
    };

    return value * (multipliers[unit as keyof typeof multipliers] || 1);
  }
}
