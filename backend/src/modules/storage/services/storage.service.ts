import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('S3_BUCKET') || 'viralfx-storage';

    // Configure S3 client (works with both AWS S3 and MinIO)
    this.s3 = new S3({
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get<string>('S3_REGION') || 'us-east-1',
      endpoint: this.configService.get<string>('S3_ENDPOINT'), // For MinIO
      s3ForcePathStyle: !!this.configService.get<string>('S3_ENDPOINT') // Required for MinIO
    });
  }

  async uploadFile(
    buffer: Buffer,
    path: string,
    options: {
      contentType?: string;
      metadata?: Record<string, string>;
    } = {}): Promise<string> {
    try {
      const params: S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: path,
        Body: buffer,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: options.metadata || {}
      };

      const result = await this.s3.upload(params).promise();

      this.logger.log(`File uploaded successfully: ${path}`);
      return result.Location;

    } catch (error) {
      this.logger.error(`Failed to upload file: ${path}`, error);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  async downloadFile(path: string): Promise<Buffer> {
    try {
      const params: S3.GetObjectRequest = {
        Bucket: this.bucketName,
        Key: path
      };

      const result = await this.s3.getObject(params).promise();

      this.logger.log(`File downloaded successfully: ${path}`);
      return result.Body as Buffer;

    } catch (error) {
      this.logger.error(`Failed to download file: ${path}`, error);
      throw new Error(`File download failed: ${error.message}`);
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      const params: S3.DeleteObjectRequest = {
        Bucket: this.bucketName,
        Key: path
      };

      await this.s3.deleteObject(params).promise();

      this.logger.log(`File deleted successfully: ${path}`);

    } catch (error) {
      this.logger.error(`Failed to delete file: ${path}`, error);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params: S3.GetSignedUrlRequest = {
        Bucket: this.bucketName,
        Key: path,
        Expires: expiresIn
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);

      this.logger.log(`Signed URL generated for: ${path}`);
      return url;

    } catch (error) {
      this.logger.error(`Failed to generate signed URL for: ${path}`, error);
      throw new Error(`Signed URL generation failed: ${error.message}`);
    }
  }

  async listFiles(prefix: string): Promise<Array<{ key: string; lastModified: Date; size: number }>> {
    try {
      const params: S3.ListObjectsV2Request = {
        Bucket: this.bucketName,
        Prefix: prefix
      };

      const result = await this.s3.listObjectsV2(params).promise();

      const files = (result.Contents || []).map(obj => ({
        key: obj.Key!,
        lastModified: obj.LastModified!,
        size: obj.Size!
      }));

      this.logger.log(`Listed ${files.length} files with prefix: ${prefix}`);
      return files;

    } catch (error) {
      this.logger.error(`Failed to list files with prefix: ${prefix}`, error);
      throw new Error(`File listing failed: ${error.message}`);
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const params: S3.HeadObjectRequest = {
        Bucket: this.bucketName,
        Key: path
      };

      await this.s3.headObject(params).promise();
      return true;

    } catch (error) {
      if (error.code === 'NotFound' || error.statusCode === 404) {
        return false;
      }
      this.logger.error(`Failed to check file existence: ${path}`, error);
      throw new Error(`File existence check failed: ${error.message}`);
    }
  }

  async getFileMetadata(path: string): Promise<Record<string, string>> {
    try {
      const params: S3.HeadObjectRequest = {
        Bucket: this.bucketName,
        Key: path
      };

      const result = await this.s3.headObject(params).promise();

      return {
        contentType: result.ContentType!,
        contentLength: result.ContentLength!.toString(),
        lastModified: result.LastModified!.toISOString(),
        etag: result.ETag!,
        ...result.Metadata
      };

    } catch (error) {
      this.logger.error(`Failed to get file metadata: ${path}`, error);
      throw new Error(`File metadata retrieval failed: ${error.message}`);
    }
  }
}
