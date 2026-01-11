import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { FilesService } from "../../files/services/files.service";
import { NotificationService } from "../../notifications/services/notification.service";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface KYCDocument {
  type: 'IDENTITY' | 'PROOF_OF_ADDRESS' | 'SELFIE' | 'BUSINESS_REGISTRATION';
  url: string;
  uploadedAt: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

interface KYCSubmission {
  documents: KYCDocument[];
  submittedAt: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: Date;
  notes?: string;
}

@Injectable()
export class KYCService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly notificationService: NotificationService,
    @InjectQueue('user-kyc')
    private readonly kycQueue: Queue) {}

  async submitKYCDocuments(
    userId: string,
    files: {
      identity?: Express.Multer.File;
      proofOfAddress?: Express.Multer.File;
      selfie?: Express.Multer.File;
      businessRegistration?: Express.Multer.File;
    }): Promise<KYCSubmission> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === 'APPROVED') {
      throw new BadRequestException('KYC is already approved');
    }

    // Validate required documents
    if (!files.identity || !files.proofOfAddress || !files.selfie) {
      throw new BadRequestException('Identity, proof of address, and selfie are required');
    }

    const documents: KYCDocument[] = [];
    const uploadPromises: Promise<any>[] = [];

    // Upload documents
    if (files.identity) {
      uploadPromises.push(
        this.uploadDocument(files.identity, userId, 'IDENTITY').then(doc => documents.push(doc))
      );
    }

    if (files.proofOfAddress) {
      uploadPromises.push(
        this.uploadDocument(files.proofOfAddress, userId, 'PROOF_OF_ADDRESS').then(doc => documents.push(doc))
      );
    }

    if (files.selfie) {
      uploadPromises.push(
        this.uploadDocument(files.selfie, userId, 'SELFIE').then(doc => documents.push(doc))
      );
    }

    if (files.businessRegistration) {
      uploadPromises.push(
        this.uploadDocument(files.businessRegistration, userId, 'BUSINESS_REGISTRATION').then(doc => documents.push(doc))
      );
    }

    await Promise.all(uploadPromises);

    // Create KYC submission
    const submission: KYCSubmission = {
      documents,
      submittedAt: new Date(),
      status: 'PENDING'
    };

    // Update user KYC status
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'PENDING',
        kycSubmittedAt: new Date()
      }
    });

    // Queue verification job
    await this.kycQueue.add('verify-kyc', {
      userId,
      submission
    });

    // Send notification
    await this.notificationService.sendNotification({
      userId,
      type: 'KYC_SUBMITTED',
      title: 'KYC Documents Submitted',
      message: 'Your KYC documents have been submitted for review. We will notify you once the verification is complete.',
      data: { submissionId: user.id }
    });

    return submission;
  }

  async verifyIdentity(userId: string, verificationData: any): Promise<any> {
    // This would integrate with FSCA-compliant identity verification service
    // For now, we'll simulate the verification process

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Queue comprehensive identity verification
    await this.kycQueue.add('comprehensive-identity-check', {
      userId,
      verificationData
    });

    return { message: 'Identity verification initiated' };
  }

  async approveKYC(userId: string, reviewerId: string, notes?: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus !== 'PENDING') {
      throw new BadRequestException('KYC is not pending review');
    }

    // Update user KYC status
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'APPROVED',
        kycReviewedAt: new Date(),
        kycReviewedBy: reviewerId
      }
    });

    // Send approval notification
    await this.notificationService.sendNotification({
      userId,
      type: 'KYC_APPROVED',
      title: 'KYC Verification Approved',
      message: 'Congratulations! Your KYC verification has been approved. You now have full access to all features.',
      data: { approvedAt: new Date() }
    });

    return updatedUser;
  }

  async rejectKYC(
    userId: string,
    reviewerId: string,
    rejectionReason: string,
    notes?: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus !== 'PENDING') {
      throw new BadRequestException('KYC is not pending review');
    }

    // Update user KYC status
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'REJECTED',
        kycReviewedAt: new Date(),
        kycReviewedBy: reviewerId,
        kycRejectionReason: rejectionReason
      }
    });

    // Send rejection notification
    await this.notificationService.sendNotification({
      userId,
      type: 'KYC_REJECTED',
      title: 'KYC Verification Rejected',
      message: `Your KYC verification has been rejected. Reason: ${rejectionReason}. Please resubmit with correct documents.`,
      data: { rejectionReason, rejectedAt: new Date() }
    });

    return updatedUser;
  }

  async getKYCStatus(userId: string): Promise<{
    status: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
    submittedAt?: Date;
    reviewedAt?: Date;
    rejectionReason?: string;
    documents?: KYCDocument[];
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      status: user.kycStatus || 'NOT_SUBMITTED',
      submittedAt: user.kycSubmittedAt,
      reviewedAt: user.kycReviewedAt,
      rejectionReason: user.kycRejectionReason,
      documents: user.kycDocuments?.documents
    };
  }

  async requestAdditionalDocuments(
    userId: string,
    requestedDocuments: string[],
    reason: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Send notification for additional documents
    await this.notificationService.sendNotification({
      userId,
      type: 'KYC_ADDITIONAL_DOCS',
      title: 'Additional KYC Documents Required',
      message: `We need additional documents to complete your KYC verification. ${reason}`,
      data: { requestedDocuments, reason }
    });

    // Queue follow-up reminder
    await this.kycQueue.add('send-kyc-reminder', {
      userId,
      requestedDocuments,
      reminderDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days later
    });
  }

  private async uploadDocument(
    file: Express.Multer.File,
    userId: string,
    type: KYCDocument['type']): Promise<KYCDocument> {
    const uploadedFile = await this.filesService.uploadFile(file, userId, `kyc-${type.toLowerCase()}`);

    return {
      type,
      url: uploadedFile.url,
      uploadedAt: new Date(),
      status: 'PENDING'
    };
  }
}
