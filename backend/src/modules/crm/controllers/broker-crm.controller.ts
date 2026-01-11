import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from "../../files/services/files.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes, ApiForbiddenResponse } from '@nestjs/swagger';
import { BrokerCrmService } from '../services/broker-crm.service';
import { CreateBrokerAccountDto } from '../dto/create-broker-account.dto';
import { UpdateBrokerAccountDto } from '../dto/update-broker-account.dto';
import { UserRole } from "../../../common/enums/user-role.enum";
import { PermissionGuard } from '../guards/permission.guard';
import { CheckPermission } from '../decorators/check-permission.decorator';

@ApiTags('CRM - Brokers')
@ApiBearerAuth()
@Controller('api/v1/crm/brokers')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles(UserRole.ADMIN, UserRole.SALES, UserRole.COMPLIANCE)
export class BrokerCrmController {
  constructor(
    private readonly brokerCrmService: BrokerCrmService,
    private readonly filesService: FilesService) {}

  @Post()
  @ApiOperation({ summary: 'Create new broker account' })
  @ApiResponse({ status: 201, description: 'Broker account created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createBrokerAccount(@Body() createBrokerAccountDto: CreateBrokerAccountDto) {
    try {
      const broker = await this.brokerCrmService.createBrokerAccount(createBrokerAccountDto);

      return {
        success: true,
        message: 'Broker account created successfully',
        data: broker
      };
    } catch (error) {
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'List all broker accounts with pagination' })
  @ApiResponse({ status: 200, description: 'Broker accounts retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'] })
  @ApiQuery({ name: 'tier', required: false, enum: ['STARTER', 'VERIFIED', 'PARTNER', 'ENTERPRISE'] })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by company name or email' })
  async getAllBrokerAccounts(@Query() query: any) {
    const filters = {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
      status: query.status,
      tier: query.tier,
      search: query.search
    };

    const result = await this.brokerCrmService.getAllBrokerAccounts(filters);

    return {
      success: true,
      data: result.brokers,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit)
      }
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get broker account details' })
  @ApiResponse({ status: 200, description: 'Broker account details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  async getBrokerAccount(@Param('id', ParseUUIDPipe) id: string) {
    const broker = await this.brokerCrmService.getBrokerAccount(id);

    return {
      success: true,
      data: broker
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update broker account' })
  @ApiResponse({ status: 200, description: 'Broker account updated successfully' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  @HttpCode(HttpStatus.OK)
  async updateBrokerAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBrokerAccountDto: UpdateBrokerAccountDto) {
    const broker = await this.brokerCrmService.updateBrokerAccount(id, updateBrokerAccountDto);

    return {
      success: true,
      message: 'Broker account updated successfully',
      data: broker
    };
  }

  @Post(':id/documents/presign')
  @ApiOperation({ summary: 'Generate pre-signed URL for document upload' })
  @ApiResponse({ status: 200, description: 'Pre-signed URL generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async generateDocumentUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { filename: string; contentType: string; documentType: string }) {
    const { filename, contentType, documentType } = body;

    // Generate unique document ID and S3 key
    const documentId = require('crypto').randomUUID();
    const key = `brokers/${id}/${documentId}-${filename}`;

    const presignedUrl = await this.filesService.generatePresignedUrl({
      bucket: 'broker-docs',
      key,
      expiresIn: 3600,
      contentType
    });

    return {
      success: true,
      data: {
        uploadUrl: presignedUrl,
        documentId,
        s3Key: key
      }
    };
  }

  @Post(':id/documents/:documentId/complete')
  @ApiOperation({ summary: 'Complete document upload after S3 upload' })
  @ApiResponse({ status: 201, description: 'Document upload completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  async completeDocumentUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() body: {
      s3Path: string;
      fileHash: string;
      mimeType: string;
      documentType: string;
      description?: string;
      tags?: string[];
      expiryDate?: string;
    }) {
    const document = await this.brokerCrmService.completeDocumentUpload(id, documentId, body);

    return {
      success: true,
      message: 'Document uploaded successfully and queued for security verification',
      data: {
        ...document,
        securityStatus: 'PENDING_VERIFICATION',
        virusScanStatus: 'PENDING',
        fscaComplianceStatus: 'PENDING_REVIEW'
      }
    };
  }

  @Patch(':id/documents/:documentId/verify')
  @ApiOperation({ summary: 'Verify broker document' })
  @ApiResponse({ status: 200, description: 'Document verified successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @HttpCode(HttpStatus.OK)
  @CheckPermission('crm.brokers.verify')
  async verifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() verificationData: { status: string; notes: string }) {
    const document = await this.brokerCrmService.verifyDocument(
      id,
      documentId,
      verificationData.status,
      verificationData.notes);

    return {
      success: true,
      message: 'Document verification updated successfully',
      data: document
    };
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add internal note to broker' })
  @ApiResponse({ status: 201, description: 'Note added successfully' })
  async addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() noteData: { content: string; category: string }) {
    const note = await this.brokerCrmService.addNote(id, noteData);

    return {
      success: true,
      message: 'Note added successfully',
      data: note
    };
  }

  @Get(':id/compliance')
  @ApiOperation({ summary: 'Get broker compliance information' })
  @ApiResponse({ status: 200, description: 'Broker compliance information retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  async getBrokerCompliance(@Param('id', ParseUUIDPipe) id: string) {
    const compliance = await this.brokerCrmService.getBrokerCompliance(id);

    return {
      success: true,
      data: compliance
    };
  }

  @Patch(':id/compliance')
  @Roles(UserRole.ADMIN, UserRole.COMPLIANCE)
  @ApiOperation({ summary: 'Update broker compliance status' })
  @ApiResponse({ status: 200, description: 'Broker compliance status updated successfully' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateBrokerCompliance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() complianceData: {
      kycStatus?: string;
      kycCompletedAt?: string;
      fspaVerified?: boolean;
      fspaVerifiedAt?: string;
      complianceStatus?: string;
      riskRating?: string;
      notes?: string;
    }) {
    const compliance = await this.brokerCrmService.updateBrokerCompliance(id, complianceData);

    return {
      success: true,
      message: 'Broker compliance status updated successfully',
      data: compliance
    };
  }

  @Get(':id/invoices')
  @ApiOperation({ summary: 'Get broker invoices' })
  @ApiResponse({ status: 200, description: 'Broker invoices retrieved successfully' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getBrokerInvoices(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: any) {
    const filters = {
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    };

    const invoices = await this.brokerCrmService.getBrokerInvoices(id, filters);

    return {
      success: true,
      data: invoices
    };
  }

  @Patch(':id/compliance-status')
  @ApiOperation({ summary: 'Update broker compliance status' })
  @ApiResponse({ status: 200, description: 'Compliance status updated successfully' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  @HttpCode(HttpStatus.OK)
  async updateComplianceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() complianceData: { status: string; reason: string }) {
    const broker = await this.brokerCrmService.updateComplianceStatus(
      id,
      complianceData.status,
      complianceData.reason);

    return {
      success: true,
      message: 'Compliance status updated successfully',
      data: broker
    };
  }
}
