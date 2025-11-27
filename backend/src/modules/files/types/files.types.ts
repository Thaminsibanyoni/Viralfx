export enum FileType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  ARCHIVE = 'ARCHIVE',
  OTHER = 'OTHER',
}

export enum FileStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

export enum FileVisibility {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
  UNLISTED = 'UNLISTED',
  SHARED = 'SHARED',
}

export enum ImageProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum FileCategory {
  PROFILE = 'PROFILE',
  DOCUMENT = 'DOCUMENT',
  MEDIA = 'MEDIA',
  BACKUP = 'BACKUP',
  TEMP = 'TEMP',
  SYSTEM = 'SYSTEM',
  GENERAL = 'GENERAL',
}

export interface FileMetadata {
  size?: number;
  hash?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number; // For video/audio
  bitrate?: number; // For audio/video
  codec?: string; // For video/audio
  pages?: number; // For documents
  author?: string; // For documents
  title?: string; // For documents
  subject?: string; // For documents
  createdDate?: Date; // Original file creation date
  modifiedDate?: Date; // Original file modification date
  uploadedAt?: string;
  tags?: string[];
  description?: string;
  customFields?: Record<string, any>;
  imageProcessingStatus?: ImageProcessingStatus;
  thumbnails?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  processingError?: string;
}

export interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  requireAuthentication: boolean;
  enableVirusScanning: boolean;
  enableImageProcessing: boolean;
  enableAutoCategorization: boolean;
  storageQuota: {
    daily: number;
    monthly: number;
    total: number;
  };
  retentionPolicy: {
    defaultDays: number;
    tempDays: number;
    archiveDays: number;
  };
}

export interface ThumbnailConfig {
  small: {
    width: number;
    height: number;
    quality: number;
  };
  medium: {
    width: number;
    height: number;
    quality: number;
  };
  large: {
    width: number;
    height: number;
    quality: number;
  };
}

export interface ImageProcessingOptions {
  generateThumbnails: boolean;
  thumbnailConfig?: ThumbnailConfig;
  optimizeImages: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface FileIndexingOptions {
  extractText: boolean;
  generatePreviews: boolean;
  extractMetadata: boolean;
  enableSearch: boolean;
  tags: string[];
  categories: FileCategory[];
}

export interface FileShare {
  id: string;
  fileId: string;
  sharedBy: string;
  sharedWith?: string; // null for public shares
  shareToken: string;
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canShare: boolean;
  };
  expiresAt?: Date;
  downloadLimit?: number;
  downloadCount: number;
  password?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  objectName: string;
  size: number;
  hash: string;
  changelog?: string;
  createdBy: string;
  createdAt: Date;
}

export interface FileActivity {
  id: string;
  fileId: string;
  userId: string;
  action: 'VIEWED' | 'DOWNLOADED' | 'SHARED' | 'UPDATED' | 'DELETED';
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<FileType, {
    count: number;
    size: number;
  }>;
  filesByStatus: Record<FileStatus, number>;
  recentUploads: number;
  storageUsage: {
    total: number;
    used: number;
    available: number;
  };
}

export interface StorageQuota {
  userId: string;
  used: number;
  total: number;
  daily: number;
  monthly: number;
  resetDate: Date;
}

export interface FileAnalytics {
  fileId: string;
  views: number;
  downloads: number;
  shares: number;
  uniqueViewers: number;
  topCountries: Array<{
    country: string;
    count: number;
  }>;
  viewTrend: Array<{
    date: string;
    views: number;
  }>;
  downloadTrend: Array<{
    date: string;
    downloads: number;
  }>;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  totalBytes: number;
  uploadedBytes: number;
  percentage: number;
  speed: number; // bytes per second
  timeRemaining: number; // seconds
  status: FileStatus;
  error?: string;
}

export interface BatchUploadResult {
  batchId: string;
  totalFiles: number;
  successful: number;
  failed: number;
  files: Array<{
    originalName: string;
    fileId?: string;
    status: 'success' | 'error';
    error?: string;
  }>;
  startedAt: Date;
  completedAt?: Date;
}

export interface FileSearchQuery {
  query?: string;
  type?: FileType;
  category?: FileCategory;
  status?: FileStatus;
  visibility?: FileVisibility;
  userId?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  sizeMin?: number;
  sizeMax?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'size' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface FileSearchResult {
  files: Array<{
    id: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    fileType: FileType;
    category: FileCategory;
    tags: string[];
    createdAt: Date;
    user: {
      id: string;
      username: string;
    };
    relevanceScore?: number;
  }>;
  total: number;
  page: number;
  totalPages: number;
  facets: {
    types: Record<FileType, number>;
    categories: Record<FileCategory, number>;
    tags: Record<string, number>;
  };
  suggestions?: string[];
}

export interface FileCompressionOptions {
  enabled: boolean;
  level: number; // 1-9
  algorithm: 'gzip' | 'brotli' | 'lz4';
  applyToTypes: FileType[];
}

export interface FileEncryptionOptions {
  enabled: boolean;
  algorithm: 'AES256' | 'AES128';
  keyRotationDays: number;
  applyToTypes: FileType[];
}

export interface FileBackupOptions {
  enabled: boolean;
  schedule: string; // cron expression
  retentionDays: number;
  destinations: string[]; // backup destinations
}

export interface FileAuditLog {
  id: string;
  fileId?: string;
  userId: string;
  action: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface FilePolicy {
  id: string;
  name: string;
  description: string;
  rules: Array<{
    condition: string;
    action: string;
    parameters?: any;
  }>;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}