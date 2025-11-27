import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Request,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { KYCService } from '../services/kyc.service';

@ApiTags('KYC')
@Controller('users/kyc')
@UseGuards(JwtAuthGuard, ThrottlerGuard, RolesGuard)
@ApiBearerAuth()
export class KYCController {
  constructor(private readonly kycService: KYCService) {}

  @Post('submit')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'identity', maxCount: 1 },
      { name: 'proofOfAddress', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
      { name: 'businessRegistration', maxCount: 1 },
    ], {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
      },
      fileFilter: (req, file, cb) => {
        // Accept common document formats
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/jpg',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only images and PDF documents are allowed.'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit KYC documents' })
  @ApiResponse({ status: 201, description: 'KYC documents submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file format or missing required documents' })
  @ApiResponse({ status: 409, description: 'KYC already approved' })
  async submitKYCDocuments(
    @Request() req,
    @UploadedFiles() files: {
      identity?: Express.Multer.File[];
      proofOfAddress?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
      businessRegistration?: Express.Multer.File[];
    },
  ) {
    // Organize files by field name
    const fileMap: any = {
      identity: files.identity?.[0],
      proofOfAddress: files.proofOfAddress?.[0],
      selfie: files.selfie?.[0],
      businessRegistration: files.businessRegistration?.[0],
    };

    return this.kycService.submitKYCDocuments(req.user.userId, fileMap);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get KYC verification status' })
  @ApiResponse({ status: 200, description: 'KYC status retrieved successfully' })
  async getKYCStatus(@Request() req) {
    return this.kycService.getKYCStatus(req.user.userId);
  }

  @Post(':id/approve')
  @Roles('ADMIN', 'KYC_REVIEWER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve KYC verification (Admin/KYC Reviewer only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'KYC approved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'KYC is not pending review' })
  async approveKYC(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { notes?: string },
    @Request() req,
  ) {
    return this.kycService.approveKYC(id, req.user.userId, body.notes);
  }

  @Post(':id/reject')
  @Roles('ADMIN', 'KYC_REVIEWER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject KYC verification (Admin/KYC Reviewer only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'KYC rejected successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'KYC is not pending review' })
  async rejectKYC(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { rejectionReason: string; notes?: string },
    @Request() req,
  ) {
    const { rejectionReason, notes } = body;

    if (!rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    return this.kycService.rejectKYC(id, req.user.userId, rejectionReason, notes);
  }

  @Get(':id/documents')
  @Roles('ADMIN', 'KYC_REVIEWER')
  @ApiOperation({ summary: 'Get KYC documents for review (Admin/KYC Reviewer only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'KYC documents retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getKYCDocuments(@Param('id', ParseUUIDPipe) id: string) {
    const kycStatus = await this.kycService.getKYCStatus(id);
    return kycStatus;
  }

  @Post('verify-identity')
  @ApiOperation({ summary: 'Initiate identity verification' })
  @ApiResponse({ status: 200, description: 'Identity verification initiated' })
  async verifyIdentity(
    @Request() req,
    @Body() body: {
      idNumber?: string;
      passportNumber?: string;
      nationality?: string;
    },
  ) {
    return this.kycService.verifyIdentity(req.user.userId, body);
  }

  @Post(':id/request-additional-docs')
  @Roles('ADMIN', 'KYC_REVIEWER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request additional KYC documents (Admin/KYC Reviewer only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Additional documents requested successfully' })
  async requestAdditionalDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      requestedDocuments: string[];
      reason: string;
    },
  ) {
    const { requestedDocuments, reason } = body;

    if (!requestedDocuments || requestedDocuments.length === 0) {
      throw new BadRequestException('Requested documents array is required');
    }

    if (!reason) {
      throw new BadRequestException('Reason for additional documents is required');
    }

    await this.kycService.requestAdditionalDocuments(id, requestedDocuments, reason);

    return { message: 'Additional documents requested successfully' };
  }
}