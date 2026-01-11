import * as AWS from "aws-sdk";

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  encryption?: "AES256" | "aws:kms";
  keyId?: string;
  tags?: Record<string, string>;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
  metadata?: Record<string, string>;
  storageClass?: string;
  versionId?: string;
}

export interface FileListItem {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  storageClass?: string;
  owner?: {
  id: string;
  displayName: string;
  };
}

export interface S3UploadResult {
  Location: string;
  key: string;
  Bucket: string;
  ETag: string;
}

export interface S3GetObjectResult {
  Body: Buffer;
  ContentType: string;
  ContentLength: number;
  LastModified: Date;
  ETag: string;
  Metadata: Record<string, string>;
}

export type S3PutObjectRequest = AWS.S3.PutObjectRequest;
export type S3GetObjectRequest = AWS.S3.GetObjectRequest;
export type S3DeleteObjectRequest = AWS.S3.DeleteObjectRequest;
export type S3HeadObjectRequest = AWS.S3.HeadObjectRequest;
export type S3ListObjectsV2Request = AWS.S3.ListObjectsV2Request;

export interface S3GetSignedUrlParams {
  Bucket: string;
  Key: string;
  Expires?: number;
  ACL?: string;
  ContentType?: string;
  CacheControl?: string;
  ContentDisposition?: string;
  ContentEncoding?: string;
}

export interface S3SignedUrlOptions {
  operation: "getObject" | "putObject";
  expiresIn?: number;
  contentType?: string;
  contentDisposition?: string;
  cacheControl?: string;
  acl?: string;
}

export interface StorageConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  signatureVersion?: string;
  maxRetries?: number;
  retryDelayOptions?: {
  customBackoff?: (retryCount: number) => number;
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  key: string;
}

export interface PresignedUrlResult {
  url: string;
  key: string;
  expires: number;
}

export interface BulkUploadResult {
  successful: Array<{
  key: string;
  location: string;
  size: number;
  }>;
  failed: Array<{
  key: string;
  error: string;
  }>;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
}

export interface StorageStatistics {
  totalObjects: number;
  totalSize: number;
  averageObjectSize: number;
  sizeByType: Record<string, number>;
  countByType: Record<string, number>;
  oldestObject: Date;
  newestObject: Date;
}

export interface LifecycleRule {
  id: string;
  status: "Enabled" | "Disabled";
  filter?: {
  prefix?: string;
  tags?: Record<string, string>;
  };
  transitions?: Array<{
  days: number;
  storageClass: string;
  }>;
  expiration?: {
  days?: number;
  date?: Date;
  };
}