import { 
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Request, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiConsumes
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { FilesService } from '../services/files.service';
import {
  UploadFileDto,
  FileQueryDto,
  FileSearchDto,
  FileStatsDto,
  CreateShareDto,
  UpdateFileDto,
  FileBatchOperationDto,
  FileProcessingDto,
  FileVersionDto,
  FileActivityDto,
  FileAnalyticsDto,
  FileExportDto,
  FileQuotaDto
} from '../dto/files.dto';
import { AnyFilesInterceptor, FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard, ThrottlerGuard, RolesGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(AnyFilesInterceptor({
    storage: diskStorage({
      destination: './uploads/temp',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      }
    }),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      files: 10 // Max 10 files at once
    }
  }))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload file(s)' })
  @ApiResponse({ status: 201, description: 'File(s) uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or upload failed' })
  @ApiResponse({ status: 413, description: 'File too large' })
  async uploadFiles(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() uploadData: UploadFileDto,
    @Req() req) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Convert files to buffer format expected by service
    const fileBuffers = await Promise.all(
      files.map(async (file) => {
        const fs = require('fs').promises;
        const buffer = await fs.readFile(file.path);

        // Cleanup temp file
        await fs.unlink(file.path).catch(() => {});

        return {
          buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        };
      })
    );

    return this.filesService.uploadFiles(fileBuffers, uploadData, req.user.userId);
  }

  @Post('upload/single')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 100 * 1024 * 1024 // 100MB
    }
  }))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadSingleFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadData: UploadFileDto,
    @Req() req) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.filesService.uploadFiles([{
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    }], uploadData, req.user.userId);
  }

  @Post('upload/url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Get upload URL for direct browser upload' })
  @ApiResponse({ status: 201, description: 'Upload URL generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid upload request' })
  async getUploadUrl(
    @Body() uploadData: UploadFileDto,
    @Req() req) {
    return this.filesService.getUploadUrl(uploadData, req.user.userId);
  }

  @Post('upload/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete upload after direct browser upload' })
  @ApiResponse({ status: 200, description: 'Upload completed successfully' })
  async completeUpload(
    @Body() data: { fileId: string; size: number; hash?: string },
    @Req() req) {
    return this.filesService.completeUpload(data.fileId, data.size, data.hash, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: "Get current user's files" })
  @ApiQuery({ name: 'type', required: false, enum: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'ARCHIVE', 'OTHER'], description: 'Filter by file type' })
  @ApiQuery({ name: 'category', required: false, enum: ['PROFILE', 'DOCUMENT', 'MEDIA', 'BACKUP', 'TEMP', 'SYSTEM', 'GENERAL'], description: 'Filter by category' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DELETED'], description: 'Filter by status' })
  @ApiQuery({ name: 'visibility', required: false, enum: ['PRIVATE', 'PUBLIC', 'UNLISTED', 'SHARED'], description: 'Filter by visibility' })
  @ApiQuery({ name: 'search', required: false, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'updatedAt', 'size', 'name'], description: 'Sort by field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiResponse({ status: 200, description: 'Files retrieved successfully' })
  async getUserFiles(
    @Req() req,
    @Query() query: FileQueryDto) {
    return this.filesService.getUserFiles(req.user.userId, query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search files with advanced filters' })
  @ApiQuery({ name: 'query', required: false, description: 'Search query' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchFiles(
    @Req() req,
    @Query() searchDto: FileSearchDto) {
    return this.filesService.searchFiles(searchDto, req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file by ID' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiResponse({ status: 200, description: 'File retrieved successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    return this.filesService.getFile(id, req.user.userId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get file download URL' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiQuery({ name: 'expiresIn', required: false, type: Number, description: 'URL expiration in seconds (default: 3600)' })
  @ApiResponse({ status: 200, description: 'Download URL generated successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('expiresIn') expiresIn: number = 3600,
    @Req() req) {
    return this.filesService.getFileDownloadUrl(id, req.user.userId, expiresIn);
  }

  @Get(':id/thumbnails')
  @ApiOperation({ summary: 'Get file thumbnails' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiQuery({ name: 'size', required: false, enum: ['small', 'medium', 'large'], description: 'Thumbnail size' })
  @ApiResponse({ status: 200, description: 'Thumbnail URLs retrieved successfully' })
  async getThumbnails(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('size') size: string = 'medium',
    @Req() req) {
    return this.filesService.getThumbnails(id, size, req.user.userId);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Get file preview' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiResponse({ status: 200, description: 'File preview generated successfully' })
  async getPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    return this.filesService.getFilePreview(id, req.user.userId);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update file metadata' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiResponse({ status: 200, description: 'File updated successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: UpdateFileDto,
    @Req() req) {
    return this.filesService.updateFile(id, updateData, req.user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete file' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    await this.filesService.deleteFile(id, req.user.userId);
    return { message: 'File deleted successfully' };
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform batch operations on files' })
  @ApiResponse({ status: 200, description: 'Batch operation completed successfully' })
  async batchOperation(
    @Body() batchData: FileBatchOperationDto,
    @Req() req) {
    return this.filesService.performBatchOperation(batchData, req.user.userId);
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new file version' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiResponse({ status: 201, description: 'File version created successfully' })
  async createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() versionData: FileVersionDto,
    @Req() req) {
    return this.filesService.createFileVersion(id, versionData, req.user.userId);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get file versions' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiResponse({ status: 200, description: 'File versions retrieved successfully' })
  async getVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    return this.filesService.getFileVersions(id, req.user.userId);
  }

  @Post(':id/restore/:version')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore file to specific version' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiParam({ name: 'version', description: 'Version number' })
  @ApiResponse({ status: 200, description: 'File restored successfully' })
  async restoreVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version') version: number,
    @Req() req) {
    return this.filesService.restoreFileVersion(id, version, req.user.userId);
  }

  @Post(':id/process')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Process file (thumbnails, optimization, etc.)' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiResponse({ status: 202, description: 'File processing started' })
  async processFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() processingData: FileProcessingDto,
    @Req() req) {
    return this.filesService.processFile(id, processingData, req.user.userId);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Get file activity log' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiResponse({ status: 200, description: 'File activity retrieved successfully' })
  async getFileActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FileActivityDto,
    @Req() req) {
    return this.filesService.getFileActivity(id, query, req.user.userId);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get file analytics' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiQuery({ name: 'timeWindow', required: false, description: 'Time window (e.g., 7d, 30d)' })
  @ApiQuery({ name: 'metric', required: false, enum: ['views', 'downloads', 'countries', 'trends'], description: 'Specific metric' })
  @ApiResponse({ status: 200, description: 'File analytics retrieved successfully' })
  async getFileAnalytics(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() analyticsData: FileAnalyticsDto,
    @Req() req) {
    return this.filesService.getFileAnalytics(id, analyticsData, req.user.userId);
  }

  @Post('share')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create file share' })
  @ApiResponse({ status: 201, description: 'Share created successfully' })
  async createShare(
    @Body() shareData: CreateShareDto,
    @Req() req) {
    return this.filesService.createShare(shareData, req.user.userId);
  }

  @Get('share/:token')
  @ApiOperation({ summary: 'Get shared file by token' })
  @ApiParam({ name: 'token', description: 'Share token' })
  @ApiQuery({ name: 'password', required: false, description: 'Share password' })
  @ApiResponse({ status: 200, description: 'Shared file retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Share not found or expired' })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  async getSharedFile(
    @Param('token') token: string,
    @Query('password') password?: string) {
    return this.filesService.getSharedFile(token, password);
  }

  @Get('share/:token/download')
  @ApiOperation({ summary: 'Download shared file' })
  @ApiParam({ name: 'token', description: 'Share token' })
  @ApiQuery({ name: 'password', required: false, description: 'Share password' })
  @ApiResponse({ status: 200, description: 'Download URL generated successfully' })
  async getSharedFileDownload(
    @Param('token') token: string,
    @Query('password') password?: string) {
    return this.filesService.getSharedFileDownload(token, password);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get available file categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories() {
    return this.filesService.getCategories();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get file statistics' })
  @ApiQuery({ name: 'timeWindow', required: false, description: 'Time window (e.g., 7d, 30d)' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID (admin only)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(
    @Query() statsData: FileStatsDto,
    @Req() req) {
    const userId = req.user.role === 'ADMIN' ? statsData.userId : req.user.userId;
    return this.filesService.getFileStats(userId, statsData.timeWindow);
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get user storage quota' })
  @ApiQuery({ name: 'userId', required: false, description: 'User ID (admin only)' })
  @ApiResponse({ status: 200, description: 'Storage quota retrieved successfully' })
  async getQuota(
    @Query() quotaData: FileQuotaDto,
    @Req() req) {
    const userId = req.user.role === 'ADMIN' ? quotaData.userId : req.user.userId;
    return this.filesService.getUserQuota(userId);
  }

  @Post('export')
  @Roles('ADMIN', 'ANALYST')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Export files data' })
  @ApiResponse({ status: 202, description: 'Export job started' })
  async exportFiles(
    @Body() exportData: FileExportDto,
    @Req() req) {
    return this.filesService.exportFiles(exportData, req.user.userId);
  }

  @Post('backup')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create file backup' })
  @ApiResponse({ status: 202, description: 'Backup job started' })
  async createBackup(
    @Body() backupData: any, // Would define specific DTO
    @Req() req) {
    return this.filesService.createBackup(backupData, req.user.userId);
  }

  @Get('virus-scan/:id')
  @Roles('ADMIN', 'SECURITY')
  @ApiOperation({ summary: 'Get virus scan results' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiResponse({ status: 200, description: 'Virus scan results retrieved successfully' })
  async getVirusScanResults(
    @Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.getVirusScanResults(id);
  }

  @Post('virus-scan/:id')
  @Roles('ADMIN', 'SECURITY')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start virus scan' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiResponse({ status: 202, description: 'Virus scan started' })
  async startVirusScan(
    @Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.startVirusScan(id);
  }
}
