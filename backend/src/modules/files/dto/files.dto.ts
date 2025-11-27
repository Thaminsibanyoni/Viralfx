import { IsString, IsOptional, IsEnum, IsArray, IsNumber, IsBoolean, IsDate, MaxLength, Min, Max, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { FileType, FileStatus, FileVisibility, FileCategory, ImageProcessingStatus } from '../types/files.types';

export class UploadFileDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fileName?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsEnum(FileCategory)
  @IsOptional()
  category?: FileCategory = FileCategory.GENERAL;

  @IsEnum(FileVisibility)
  @IsOptional()
  visibility?: FileVisibility = FileVisibility.PRIVATE;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsBoolean()
  @IsOptional()
  allowDuplicate?: boolean = false;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expiresAt?: Date;

  @IsObject()
  @IsOptional()
  metadata?: any;
}

export class FileQueryDto {
  @IsEnum(FileType)
  @IsOptional()
  type?: FileType;

  @IsEnum(FileCategory)
  @IsOptional()
  category?: FileCategory;

  @IsEnum(FileStatus)
  @IsOptional()
  status?: FileStatus;

  @IsEnum(FileVisibility)
  @IsOptional()
  visibility?: FileVisibility;

  @IsString()
  @IsOptional()
  search?: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  @IsString()
  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' | 'size' | 'name' = 'createdAt';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsString()
  @IsOptional()
  dateFrom?: string;

  @IsString()
  @IsOptional()
  dateTo?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  sizeMin?: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  sizeMax?: number;
}

export class FileDto {
  id: string;
  userId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileType: FileType;
  status: FileStatus;
  visibility: FileVisibility;
  category: FileCategory;
  hash: string;
  metadata: any;
  downloadUrl: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  user?: {
    id: string;
    username: string;
    profile?: {
      firstName: string;
      lastName: string;
      avatar: string;
    };
  };
}

export class FileUploadResponseDto {
  successful: FileDto[];
  failed: Array<{
    filename: string;
    error: string;
  }>;
  total: number;
}

export class PresignedUrlDto {
  url: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  expiresAt: Date;
}

export class CreateShareDto {
  @IsString()
  fileId: string;

  @IsEnum(['PUBLIC', 'PRIVATE'])
  shareType: 'PUBLIC' | 'PRIVATE';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sharedWith?: string[];

  @IsBoolean()
  @IsOptional()
  canView?: boolean = true;

  @IsBoolean()
  @IsOptional()
  canDownload?: boolean = true;

  @IsBoolean()
  @IsOptional()
  canShare?: boolean = false;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  expiresHours?: number = 24;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  downloadLimit?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  password?: string;
}

export class UpdateFileDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  originalName?: string;

  @IsEnum(FileVisibility)
  @IsOptional()
  visibility?: FileVisibility;

  @IsEnum(FileCategory)
  @IsOptional()
  category?: FileCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expiresAt?: Date;

  @IsObject()
  @IsOptional()
  metadata?: any;
}

export class FileSearchDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsEnum(FileType)
  @IsOptional()
  type?: FileType;

  @IsEnum(FileCategory)
  @IsOptional()
  category?: FileCategory;

  @IsEnum(FileStatus)
  @IsOptional()
  status?: FileStatus;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  dateFrom?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  dateTo?: Date;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  sizeMin?: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  sizeMax?: number;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;
}

export class FileStatsDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  timeWindow?: string; // e.g., '7d', '30d', '90d'
}

export class FileBatchOperationDto {
  @IsArray()
  @IsString({ each: true })
  fileIds: string[];

  @IsEnum(['DELETE', 'MOVE', 'UPDATE_CATEGORY', 'UPDATE_VISIBILITY', 'ADD_TAGS', 'REMOVE_TAGS'])
  operation: string;

  @IsObject()
  @IsOptional()
  parameters?: any;
}

export class FileProcessingDto {
  @IsString()
  fileId: string;

  @IsEnum(['GENERATE_THUMBNAILS', 'OPTIMIZE_IMAGE', 'EXTRACT_TEXT', 'CONVERT_FORMAT'])
  action: string;

  @IsObject()
  @IsOptional()
  options?: any;
}

export class FileVersionDto {
  @IsString()
  fileId: string;

  @IsString()
  @IsOptional()
  changelog?: string;
}

export class FileActivityDto {
  @IsString()
  fileId?: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  @IsEnum(['VIEWED', 'DOWNLOADED', 'SHARED', 'UPDATED', 'DELETED'])
  @IsOptional()
  action?: string;
}

export class FileAnalyticsDto {
  @IsString()
  fileId: string;

  @IsString()
  @IsOptional()
  timeWindow?: string; // e.g., '7d', '30d'

  @IsEnum(['views', 'downloads', 'countries', 'trends'])
  @IsOptional()
  metric?: string;
}

export class FileExportDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fileIds?: string[];

  @IsEnum(['JSON', 'CSV', 'XLSX'])
  format: 'JSON' | 'CSV' | 'XLSX';

  @IsObject()
  @IsOptional()
  filters?: any;

  @IsBoolean()
  @IsOptional()
  includeMetadata?: boolean = false;

  @IsBoolean()
  @IsOptional()
  includeAnalytics?: boolean = false;
}

export class FileQuotaDto {
  @IsString()
  @IsOptional()
  userId?: string;
}

export class FilePolicyDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsArray()
  rules: Array<{
    condition: string;
    action: string;
    parameters?: any;
  }>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  priority?: number = 1;
}

export class VirusScanResultDto {
  fileId: string;
  isClean: boolean;
  threats: Array<{
    type: string;
    name: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  scanEngine: string;
  scanDuration: number;
  scannedAt: Date;
}

export class FileBackupDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fileIds?: string[];

  @IsString()
  @IsOptional()
  destination?: string;

  @IsBoolean()
  @IsOptional()
  includeMetadata?: boolean = true;

  @IsBoolean()
  @IsOptional()
  compress?: boolean = true;

  @IsBoolean()
  @IsOptional()
  encrypt?: boolean = true;
}