import { Processor } from '@nestjs/bullmq';
import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { FSCAService } from '../services/fsca.service';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerVerification, VerificationStatus, VerificationType, KycStatus } from '../entities/broker-verification.entity';
import { NotificationService } from "../../notifications/services/notification.service";
import { PrismaService } from "../../../prisma/prisma.service";

export interface VerificationJobData {
  brokerId: string;
  fscaLicenseNumber?: string;
  registrationNumber?: string;
  verificationData?: any;
  verificationId?: string;
}

@Processor('broker-verification')
export class BrokerVerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(BrokerVerificationProcessor.name);

  constructor(
        private prisma: PrismaService,
    private readonly fscsService: FSCAService,
    private readonly notificationService: NotificationService,
    private readonly prismaService: PrismaService) {
    super();
}

  async process(job: any): Promise<any> {
    switch (job.name) {
      case 'verify-fsca-license':
        return this.handleFSCALicenseVerification(job);
      case 'verify-documents':
        return this.handleDocumentVerification(job);
      case 'verify-directors':
        return this.handleDirectorVerification(job);
      case 'manual-review':
        return this.handleManualReview(job);
      case 'send-verification-result':
        return this.handleSendVerificationResult(job);
      case 'license-renewal-reminder':
        return this.handleLicenseRenewalReminder(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }


  @OnWorkerEvent('active')
  onActive(job: Job<VerificationJobData>) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<VerificationJobData>) {
    this.logger.log(`Completed job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<VerificationJobData>, error: Error) {
    this.logger.error(`Failed job ${job.id} of type ${job.name}:`, error);
  }

  private async handleFSCALicenseVerification(job: Job<VerificationJobData>) {
    const { brokerId, fscaLicenseNumber, registrationNumber } = job.data;

    this.logger.log(`Processing FSCA license verification for broker ${brokerId}`);

    try {
      const result = await this.fscsService.verifyFSCALicense({
        brokerId,
        fscaLicenseNumber,
        registrationNumber,
        licenseCategory: 'II', // Default category
        directors: [] // Would need to be provided in job data
      });

      await this.logVerificationActivity(brokerId, 'FSCA_LICENSE_VERIFICATION', {
        fscaLicenseNumber,
        result: result.isValid ? 'VERIFIED' : 'FAILED',
        licenseStatus: result.licenseStatus
      });

      this.logger.log(`FSCA license verification completed for broker ${brokerId}: ${result.isValid ? 'VERIFIED' : 'FAILED'}`);
      return result;
    } catch (error) {
      this.logger.error(`FSCA license verification failed for broker ${brokerId}:`, error);

      await this.logVerificationActivity(brokerId, 'FSCA_LICENSE_VERIFICATION_ERROR', {
        fscaLicenseNumber,
        error: error.message
      });

      throw error;
    }
  }

  private async handleDocumentVerification(job: Job<VerificationJobData>) {
    const { brokerId, verificationData } = job.data;

    this.logger.log(`Processing document verification for broker ${brokerId}`);

    try {
      // Determine if this is an AML check or document verification
      const isAmlCheck = verificationData.documentTypes?.includes('sanctions_screening') ||
                        verificationData.documentTypes?.includes('pep_screening') ||
                        verificationData.documentTypes?.includes('adverse_media');

      let verificationResult;

      if (isAmlCheck) {
        // Handle AML checks
        verificationResult = await this.processAmlChecks(brokerId, verificationData.documentTypes);
        await this.updateAmlVerification(brokerId, verificationResult);
      } else {
        // Handle document verification
        verificationResult = await this.processDocuments(verificationData.documents);
        await this.updateDocumentVerification(brokerId, verificationData.documents, verificationResult);
      }

      const activityType = isAmlCheck ? 'AML_SCREENING' : 'DOCUMENT_VERIFICATION';
      await this.logVerificationActivity(brokerId, activityType, {
        documentCount: verificationData.documents?.length || 0,
        documentTypes: verificationData.documentTypes,
        result: verificationResult.isValid ? 'VERIFIED' : 'FAILED',
        issues: verificationResult.issues
      });

      // Trigger comprehensive KYC decision if this was an AML check
      if (isAmlCheck) {
        await this.evaluateKycDecision(brokerId);
      }

      this.logger.log(`${activityType} completed for broker ${brokerId}: ${verificationResult.isValid ? 'VERIFIED' : 'FAILED'}`);
      return verificationResult;
    } catch (error) {
      this.logger.error(`Document verification failed for broker ${brokerId}:`, error);

      await this.logVerificationActivity(brokerId, 'DOCUMENT_VERIFICATION_ERROR', {
        error: error.message
      });

      throw error;
    }
  }

  private async handleDirectorVerification(job: Job<VerificationJobData>) {
    const { brokerId, verificationData } = job.data;

    this.logger.log(`Processing director verification for broker ${brokerId}`);

    try {
      const directors = verificationData.directors || [];
      const validationResult = await this.fscsService.validateDirectors(directors);

      // Update KYC state in verification record
      await this.updateKycDirectorVerification(brokerId, directors, validationResult);

      await this.logVerificationActivity(brokerId, 'DIRECTOR_VERIFICATION', {
        directorCount: directors.length,
        result: validationResult.valid ? 'VERIFIED' : 'FAILED',
        sanctions: validationResult.sanctions,
        issues: validationResult.issues
      });

      // Trigger comprehensive KYC decision if all checks are complete
      await this.evaluateKycDecision(brokerId);

      this.logger.log(`Director verification completed for broker ${brokerId}: ${validationResult.valid ? 'VERIFIED' : 'FAILED'}`);
      return validationResult;
    } catch (error) {
      this.logger.error(`Director verification failed for broker ${brokerId}:`, error);

      await this.logVerificationActivity(brokerId, 'DIRECTOR_VERIFICATION_ERROR', {
        error: error.message
      });

      throw error;
    }
  }

  private async handleManualReview(job: Job<VerificationJobData>) {
    const { brokerId, verificationData, verificationId } = job.data;

    this.logger.log(`Queueing manual review for broker ${brokerId}`);

    try {
      // Send notification to admin team for manual review
      await this.notificationService.sendComplianceAlert(brokerId, {
        id: verificationId,
        brokerId,
        type: 'MANUAL_REVIEW_REQUIRED',
        severity: 'MEDIUM',
        message: `Manual review required for broker verification`,
        details: {
          verificationData,
          requiresAction: 'Please review and approve/reject broker verification'
        },
        recommendations: [
          'Review submitted documents',
          'Verify FSCA license details',
          'Check director information',
          'Validate business information',
        ],
        createdAt: new Date(),
        status: 'OPEN'
      });

      await this.logVerificationActivity(brokerId, 'MANUAL_REVIEW_QUEUED', {
        verificationId,
        verificationData
      });

      this.logger.log(`Manual review queued for broker ${brokerId}`);
      return { success: true, message: 'Manual review queued' };
    } catch (error) {
      this.logger.error(`Failed to queue manual review for broker ${brokerId}:`, error);
      throw error;
    }
  }

  private async handleSendVerificationResult(job: Job<VerificationJobData>) {
    const { brokerId, verificationData } = job.data;

    this.logger.log(`Sending verification result notification for broker ${brokerId}`);

    try {
      const { result, isApproved, rejectionReason } = verificationData;

      if (isApproved) {
        await this.sendApprovalNotification(brokerId, result);
      } else {
        await this.sendRejectionNotification(brokerId, result, rejectionReason);
      }

      await this.logVerificationActivity(brokerId, 'VERIFICATION_RESULT_SENT', {
        isApproved,
        rejectionReason
      });

      this.logger.log(`Verification result notification sent for broker ${brokerId}`);
      return { success: true, message: 'Notification sent' };
    } catch (error) {
      this.logger.error(`Failed to send verification result for broker ${brokerId}:`, error);
      throw error;
    }
  }

  private async handleLicenseRenewalReminder(job: Job<VerificationJobData>) {
    const { brokerId, verificationData, expiryDate, reminderType } = job.data;

    this.logger.log(`Sending license renewal reminder for broker ${brokerId}`);

    try {
      // Handle both payload structures for backward compatibility
      const actualExpiryDate = verificationData?.expiryDate || expiryDate;
      const actualReminderType = verificationData?.reminderType || reminderType;

      await this.notificationService.sendComplianceAlert(brokerId, {
        id: `renewal-${brokerId}-${actualReminderType}`,
        brokerId,
        type: 'LICENSE_RENEWAL_REMINDER',
        severity: actualReminderType === 'SEVEN_DAYS' ? 'HIGH' : 'MEDIUM',
        message: `FSCA license expires in ${actualReminderType === 'SEVEN_DAYS' ? '7 days' : '30 days'}`,
        details: {
          expiryDate: actualExpiryDate,
          reminderType: actualReminderType,
          daysUntilExpiry: Math.ceil((actualExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        },
        recommendations: [
          'Contact FSCA to renew license',
          'Update license details in ViralFX',
          'Ensure continuity of compliance',
        ],
        createdAt: new Date(),
        status: 'OPEN'
      });

      await this.logVerificationActivity(brokerId, 'LICENSE_RENEWAL_REMINDER', {
        expiryDate: actualExpiryDate,
        reminderType: actualReminderType
      });

      this.logger.log(`License renewal reminder sent for broker ${brokerId}`);
      return { success: true, message: 'Renewal reminder sent' };
    } catch (error) {
      this.logger.error(`Failed to send renewal reminder for broker ${brokerId}:`, error);
      throw error;
    }
  }

  private async processDocuments(documents: any[]): Promise<any> {
    // Simulate document processing
    // In a real implementation, this would:
    // 1. Use OCR services (like Tesseract.js)
    // 2. Validate document formats
    // 3. Check for required fields
    // 4. Verify document authenticity
    // 5. Check expiration dates

    const issues = [];
    const validDocuments = documents.filter(doc => {
      // Simulate validation logic
      if (!doc.url || !doc.type) {
        issues.push(`Invalid document: ${doc.id}`);
        return false;
      }
      return true;
    });

    return {
      isValid: issues.length === 0,
      validDocuments: validDocuments.length,
      totalDocuments: documents.length,
      issues
    };
  }

  private async sendApprovalNotification(brokerId: string, result: any): Promise<void> {
    await this.notificationService.sendBrokerVerificationResult(brokerId, {
      success: true,
      result,
      message: 'Your broker application has been approved!',
      nextSteps: [
        'Complete your integration setup',
        'Review API documentation',
        'Start testing your integration',
      ]
    });
  }

  private async sendRejectionNotification(brokerId: string, result: any, rejectionReason: string): Promise<void> {
    await this.notificationService.sendBrokerVerificationResult(brokerId, {
      success: false,
      result,
      rejectionReason,
      message: 'Your broker application could not be approved at this time',
      nextSteps: [
        'Review the rejection reasons',
        'Update your documentation',
        'Resubmit your application',
      ]
    });
  }

  private async updateKycDirectorVerification(brokerId: string, directors: any[], validationResult: any): Promise<void> {
    try {
      // Find or create KYC verification record
      let kycVerification = await this.prisma.verificationrepository.findFirst({
        where: {
          brokerId,
          verificationType: VerificationType.KYC_DIRECTORS
        }
      });

      if (!kycVerification) {
        kycVerification = this.prisma.verificationrepository.create({
          brokerId,
          verificationType: VerificationType.KYC_DIRECTORS,
          status: VerificationStatus.IN_PROGRESS,
          kycStatus: KycStatus.IN_PROGRESS
        });
      }

      // Update KYC data with director information
      const kycData = kycVerification.kycData || {};
      kycData.directors = directors.map(director => ({
        id: director.id || director.idNumber,
        name: director.name,
        idNumber: director.idNumber,
        role: director.role || 'Director',
        shareholding: director.shareholding || 0,
        verificationStatus: validationResult.sanctions && validationResult.sanctions.length > 0 ? 'REJECTED' : 'APPROVED',
        verificationDate: new Date(),
        documents: director.documents || [],
        riskScore: validationResult.sanctions?.length > 0 ? 80 : 20,
        notes: validationResult.sanctions?.length > 0 ? 'Sanctions match found' : 'No issues found'
      }));

      kycVerification.kycData = kycData;
      kycVerification.status = validationResult.valid ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;
      kycVerification.kycStatus = validationResult.valid ? KycStatus.UNDER_REVIEW : KycStatus.IN_PROGRESS;

      await this.prisma.verificationrepository.upsert(kycVerification);
    } catch (error) {
      this.logger.error(`Failed to update KYC director verification for ${brokerId}:`, error);
    }
  }

  private async updateAmlVerification(brokerId: string, amlResult: any): Promise<void> {
    try {
      // Find or create AML verification record
      let amlVerification = await this.prisma.verificationrepository.findFirst({
        where: {
          brokerId,
          verificationType: VerificationType.AML_SANCTIONS
        }
      });

      if (!amlVerification) {
        amlVerification = this.prisma.verificationrepository.create({
          brokerId,
          verificationType: VerificationType.AML_SANCTIONS,
          status: VerificationStatus.IN_PROGRESS
        });
      }

      // Update KYC data with AML check results
      const kycData = amlVerification.kycData || {};
      kycData.amlChecks = {
        sanctionsScreening: {
          checked: true,
          result: amlResult.sanctionsFound ? 'MATCH' : 'CLEAR',
          checkedAt: new Date(),
          details: amlResult.sanctionsDetails
        },
        pepScreening: {
          checked: amlResult.documentTypes?.includes('pep_screening'),
          result: amlResult.pepFound ? 'MATCH' : 'CLEAR',
          checkedAt: new Date(),
          details: amlResult.pepDetails
        },
        adverseMedia: {
          checked: amlResult.documentTypes?.includes('adverse_media'),
          result: amlResult.adverseMediaFound ? 'FOUND' : 'CLEAR',
          checkedAt: new Date(),
          details: amlResult.adverseMediaDetails
        }
      };

      const hasIssues = amlResult.sanctionsFound || amlResult.pepFound || amlResult.adverseMediaFound;

      amlVerification.kycData = kycData;
      amlVerification.status = hasIssues ? VerificationStatus.REJECTED : VerificationStatus.APPROVED;

      await this.prisma.verificationrepository.upsert(amlVerification);
    } catch (error) {
      this.logger.error(`Failed to update AML verification for ${brokerId}:`, error);
    }
  }

  private async updateDocumentVerification(brokerId: string, documents: any[], verificationResult: any): Promise<void> {
    try {
      // Find document verification record
      let docVerification = await this.prisma.verificationrepository.findFirst({
        where: {
          brokerId,
          verificationType: VerificationType.DOCUMENTS
        }
      });

      if (!docVerification) {
        docVerification = this.prisma.verificationrepository.create({
          brokerId,
          verificationType: VerificationType.DOCUMENTS,
          status: VerificationStatus.IN_PROGRESS
        });
      }

      // Update documents with verification results
      const updatedDocuments = documents.map(doc => ({
        id: doc.id,
        type: doc.type,
        url: doc.url,
        uploadedAt: doc.uploadedAt,
        verified: !verificationResult.issues?.includes(doc.id),
        verificationOutcome: !verificationResult.issues?.includes(doc.id) ? 'APPROVED' : 'REJECTED',
        verifiedAt: new Date(),
        verifiedBy: 'System',
        rejectionReason: verificationResult.issues?.includes(doc.id) ? 'Document validation failed' : undefined,
        expiryDate: doc.expiryDate
      }));

      docVerification.documents = updatedDocuments;
      docVerification.status = verificationResult.isValid ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;

      await this.prisma.verificationrepository.upsert(docVerification);
    } catch (error) {
      this.logger.error(`Failed to update document verification for ${brokerId}:`, error);
    }
  }

  private async evaluateKycDecision(brokerId: string): Promise<void> {
    try {
      const verifications = await this.prisma.verificationrepository.findMany({
        where: { brokerId }
      });

      const kycVerification = verifications.find(v => v.verificationType === VerificationType.KYC_DIRECTORS);
      const amlVerification = verifications.find(v => v.verificationType === VerificationType.AML_SANCTIONS);
      const documentVerification = verifications.find(v => v.verificationType === VerificationType.DOCUMENTS);

      if (!kycVerification) {
        return;
      }

      // Evaluate all KYC components
      const kycComplete = kycVerification.status === VerificationStatus.APPROVED;
      const amlClear = !amlVerification || amlVerification.status === VerificationStatus.APPROVED;
      const documentsApproved = !documentVerification || documentVerification.status === VerificationStatus.APPROVED;

      let decisionStatus: 'APPROVED' | 'REJECTED' | 'REQUIRES_ADDITIONAL_INFO';
      let reason: string;
      let additionalInfoRequired: string[] = [];

      if (kycComplete && amlClear && documentsApproved) {
        decisionStatus = 'APPROVED';
        reason = 'All KYC/AML checks passed';
      } else if (!amlVerification || !documentVerification) {
        decisionStatus = 'REQUIRES_ADDITIONAL_INFO';
        reason = 'Additional verification required';
        additionalInfoRequired = [
          !amlVerification ? 'AML screening required' : null,
          !documentVerification ? 'Document verification required' : null,
        ].filter(Boolean);
      } else {
        decisionStatus = 'REJECTED';
        reason = 'KYC/AML checks failed';
        additionalInfoRequired = [];
      }

      // Update KYC decision
      const kycData = kycVerification.kycData || {};
      kycVerification.kycDecision = {
        status: decisionStatus,
        decidedAt: new Date(),
        decidedBy: 'System',
        reason,
        additionalInfoRequired,
        nextReviewDate: decisionStatus === 'REQUIRES_ADDITIONAL_INFO' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
        conditions: decisionStatus === 'APPROVED' ? ['Periodic review required'] : []
      };

      kycVerification.kycData = kycData;
      kycVerification.kycStatus = decisionStatus === 'APPROVED' ? KycStatus.APPROVED :
                                decisionStatus === 'REJECTED' ? KycStatus.REJECTED : KycStatus.ADDITIONAL_INFO_REQUIRED;

      await this.prisma.verificationrepository.upsert(kycVerification);

      // Re-evaluate broker verification status
      await this.fscsService.updateBrokerVerificationStatus(brokerId, true);
    } catch (error) {
      this.logger.error(`Failed to evaluate KYC decision for ${brokerId}:`, error);
    }
  }

  private async processAmlChecks(brokerId: string, documentTypes: string[]): Promise<any> {
    // Simulate AML checks
    const sanctionsFound = Math.random() < 0.05; // 5% chance
    const pepFound = Math.random() < 0.02; // 2% chance
    const adverseMediaFound = Math.random() < 0.03; // 3% chance

    return {
      isValid: !sanctionsFound && !pepFound && !adverseMediaFound,
      sanctionsFound,
      pepFound,
      adverseMediaFound,
      sanctionsDetails: sanctionsFound ? ['Match found on international sanctions list'] : [],
      pepDetails: pepFound ? ['Politically exposed person identified'] : [],
      adverseMediaDetails: adverseMediaFound ? ['Negative news articles found'] : [],
      documentTypes
    };
  }

  private async logVerificationActivity(brokerId: string, activity: string, details: any): Promise<void> {
    await this.prismaService.auditLog.create({
      data: {
        action: 'BROKER_VERIFICATION',
        entityType: 'BROKER_VERIFICATION',
        entityId: brokerId,
        oldValues: null,
        newValues: JSON.stringify({
          activity,
          details,
          timestamp: new Date().toISOString()
        }),
        userId: null,
        ipAddress: null,
        userAgent: 'Bull Processor'
      }
    });
  }
}
