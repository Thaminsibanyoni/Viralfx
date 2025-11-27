import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { firstValueFrom } from 'rxjs';
import { BrokerVerification, VerificationType, VerificationStatus, KycStatus } from '../entities/broker-verification.entity';
import { FSCAVerificationDto } from '../dto/fsca-verification.dto';
import { FSCAVerificationResponse } from '../interfaces/broker.interface';
import { Broker, BrokerStatus } from '../entities/broker.entity';

@Injectable()
export class FSCAService {
  private readonly logger = new Logger(FSCAService.name);
  private readonly fscaApiUrl: string;
  private readonly fscaApiKey: string;
  private readonly verificationTimeout: number;

  constructor(
    @InjectRepository(BrokerVerification)
    private verificationRepository: Repository<BrokerVerification>,
    @InjectRepository(Broker)
    private brokerRepository: Repository<Broker>,
    private configService: ConfigService,
    private httpService: HttpService,
    @InjectQueue('broker-verification') private verificationQueue: Queue,
  ) {
    this.fscaApiUrl = this.configService.get<string>('FSCA_API_URL', 'https://api.fsca.co.za');
    this.fscaApiKey = this.configService.get<string>('FSCA_API_KEY');
    this.verificationTimeout = this.configService.get<number>('FSCA_VERIFICATION_TIMEOUT', 30000);
  }

  async verifyFSCALicense(verificationData: FSCAVerificationDto): Promise<FSCAVerificationResponse> {
    this.logger.log(`Verifying FSCA license: ${verificationData.fscaLicenseNumber}`);

    try {
      // First, attempt automated verification
      const automatedResult = await this.performAutomatedVerification(verificationData);

      if (automatedResult.isValid) {
        // License verified successfully
        await this.updateVerificationStatus(verificationData.brokerId, VerificationStatus.APPROVED, automatedResult);

        // Update broker verification status
        await this.updateBrokerVerificationStatus(verificationData.brokerId, true);

        // Schedule renewal check if expiry date provided
        if (automatedResult.expiryDate) {
          await this.scheduleRenewalCheck(verificationData.brokerId, automatedResult.expiryDate);
        }

        this.logger.log(`FSCA license verified successfully: ${verificationData.fscaLicenseNumber}`);
        return automatedResult;
      } else {
        // License not valid or requires manual review
        await this.updateVerificationStatus(verificationData.brokerId, VerificationStatus.REJECTED, automatedResult);
        await this.updateBrokerVerificationStatus(verificationData.brokerId, false);

        this.logger.warn(`FSCA license verification failed: ${verificationData.fscaLicenseNumber}`);
        return automatedResult;
      }
    } catch (error) {
      this.logger.error(`Automated FSCA verification failed for ${verificationData.fscaLicenseNumber}:`, error);

      // Queue for manual review if automated verification fails
      await this.queueForManualReview(verificationData);

      // Return a response indicating manual review is needed
      return {
        isValid: false,
        licenseStatus: 'PENDING_MANUAL_REVIEW',
        verificationDate: new Date(),
        riskRating: 'UNKNOWN',
      };
    }
  }

  private async performAutomatedVerification(data: FSCAVerificationDto): Promise<FSCAVerificationResponse> {
    if (!this.fscaApiKey) {
      throw new Error('FSCA API key not configured');
    }

    const payload = {
      licenseNumber: data.fscaLicenseNumber,
      registrationNumber: data.registrationNumber,
      licenseCategory: data.licenseCategory,
      directors: data.directors,
      aum: data.aum,
    };

    const response = await firstValueFrom(
      this.httpService.post<FSCAVerificationResponse>(
        `${this.fscaApiUrl}/verify-license`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.fscaApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.verificationTimeout,
        }
      )
    );

    return response.data;
  }

  async checkLicenseStatus(licenseNumber: string): Promise<FSCAVerificationResponse> {
    this.logger.log(`Checking FSCA license status: ${licenseNumber}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get<FSCAVerificationResponse>(
          `${this.fscaApiUrl}/license-status/${licenseNumber}`,
          {
            headers: {
              'Authorization': `Bearer ${this.fscaApiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: this.verificationTimeout,
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to check license status for ${licenseNumber}:`, error);
      throw error;
    }
  }

  async validateDirectors(directors: Array<{ fullName: string; idNumber: string; role: string }>): Promise<{
    valid: boolean;
    issues: string[];
    sanctions: Array<{ name: string; match: string; list: string }>;
  }> {
    this.logger.log(`Validating ${directors.length} directors`);

    const issues: string[] = [];
    const sanctions: Array<{ name: string; match: string; list: string }> = [];
    let allValid = true;

    for (const director of directors) {
      // Validate ID number format (South African ID)
      if (!this.validateSouthAfricanID(director.idNumber)) {
        issues.push(`Invalid ID number format for ${director.fullName}`);
        allValid = false;
      }

      // Check against sanctions list
      try {
        const sanctionsCheck = await this.checkSanctionsList(director.fullName, director.idNumber);
        if (sanctionsCheck.length > 0) {
          sanctions.push(...sanctionsCheck);
          allValid = false;
        }
      } catch (error) {
        this.logger.error(`Failed to check sanctions for ${director.fullName}:`, error);
        issues.push(`Could not verify sanctions status for ${director.fullName}`);
      }
    }

    return {
      valid: allValid && issues.length === 0,
      issues,
      sanctions,
    };
  }

  private validateSouthAfricanID(idNumber: string): boolean {
    // South African ID validation (13 digits)
    const idPattern = /^\d{13}$/;
    if (!idPattern.test(idNumber)) return false;

    // Check Luhn algorithm
    let sum = 0;
    let alternate = false;

    for (let i = idNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(idNumber.substring(i, i + 1), 10);

      if (alternate) {
        digit *= 2;
        if (digit > 9) digit = 1 + (digit % 10);
      }

      sum += digit;
      alternate = !alternate;
    }

    return sum % 10 === 0;
  }

  private async checkSanctionsList(name: string, idNumber?: string): Promise<Array<{ name: string; match: string; list: string }>> {
    // This would integrate with sanctions checking APIs
    // For now, return empty array (no matches)
    // In production, integrate with services like World-Check, Dow Jones, etc.
    return [];
  }

  async scheduleRenewalCheck(brokerId: string, expiryDate: Date): Promise<void> {
    this.logger.log(`Scheduling renewal check for broker ${brokerId}, expiry: ${expiryDate}`);

    // Schedule reminder 30 days before expiry
    const reminderDate = new Date(expiryDate);
    reminderDate.setDate(reminderDate.getDate() - 30);

    // Schedule another reminder 7 days before expiry
    const finalReminderDate = new Date(expiryDate);
    finalReminderDate.setDate(finalReminderDate.getDate() - 7);

    // Add to queue for future processing
    await this.verificationQueue.add(
      'license-renewal-reminder',
      { brokerId, expiryDate, reminderType: 'THIRTY_DAYS' },
      { delay: reminderDate.getTime() - Date.now() }
    );

    await this.verificationQueue.add(
      'license-renewal-reminder',
      { brokerId, expiryDate, reminderType: 'SEVEN_DAYS' },
      { delay: finalReminderDate.getTime() - Date.now() }
    );
  }

  async getFSCAPublicRegistry(): Promise<any> {
    this.logger.log('Fetching FSCA public registry data');

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.fscaApiUrl}/public-registry`, {
          headers: {
            'Authorization': `Bearer ${this.fscaApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.verificationTimeout,
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch FSCA public registry:', error);
      throw error;
    }
  }

  private async updateVerificationStatus(
    brokerId: string,
    status: VerificationStatus,
    fscaResponse: FSCAVerificationResponse,
  ): Promise<void> {
    const verification = await this.verificationRepository.findOne({
      where: { brokerId, verificationType: VerificationType.FSCA_LICENSE },
      order: { createdAt: 'DESC' },
    });

    if (verification) {
      verification.status = status;
      verification.reviewedAt = new Date();
      verification.fscaResponse = fscaResponse;
      verification.expiresAt = fscaResponse.expiryDate;

      if (status === VerificationStatus.REJECTED) {
        verification.rejectionReason = fscaResponse.licenseStatus === 'EXPIRED'
          ? 'License has expired'
          : 'License validation failed';
      }

      await this.verificationRepository.save(verification);
    }
  }

  private async updateBrokerVerificationStatus(brokerId: string, verified: boolean): Promise<void> {
    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });

    if (!broker) {
      return;
    }

    // Check KYC/AML status before activating broker
    const kycVerifications = await this.verificationRepository.find({
      where: { brokerId },
    });

    const kycStatus = this.evaluateKycStatus(kycVerifications);

    // Update broker status based on both FSCA verification and KYC/AML status
    if (verified && kycStatus.kycApproved) {
      broker.complianceInfo.fscaVerified = verified;
      broker.status = BrokerStatus.VERIFIED;
      broker.verifiedAt = new Date();
      broker.trustScore = Math.min(broker.trustScore + 30, 100);
      broker.isActive = true;

      this.logger.log(`Broker ${brokerId} activated: FSCA verified and KYC/AML approved`);
    } else if (verified && !kycStatus.kycApproved) {
      // FSCA verified but KYC/AML not complete - set to pending
      broker.complianceInfo.fscaVerified = verified;
      broker.status = BrokerStatus.PENDING_VERIFICATION;
      broker.isActive = false;

      this.logger.log(`Broker ${brokerId} pending: FSCA verified but KYC/AML incomplete`);

      // Queue additional KYC checks if needed
      if (kycStatus.needsAdditionalChecks) {
        await this.queueAdditionalKycChecks(brokerId);
      }
    } else {
      // FSCA verification failed
      broker.complianceInfo.fscaVerified = false;
      broker.status = BrokerStatus.REJECTED;
      broker.verifiedAt = null;
      broker.trustScore = Math.max(broker.trustScore - 30, 0);
      broker.isActive = false;

      this.logger.log(`Broker ${brokerId} rejected: FSCA verification failed`);
    }

    await this.brokerRepository.save(broker);
  }

  private evaluateKycStatus(verifications: BrokerVerification[]): {
    kycApproved: boolean;
    needsAdditionalChecks: boolean;
    kycStatus?: KycStatus;
    missingChecks?: string[];
  } {
    const kycCheck = verifications.find(v =>
      v.verificationType === VerificationType.KYC_DIRECTORS ||
      v.verificationType === VerificationType.KYC_UBOS
    );

    const amlCheck = verifications.find(v => v.verificationType === VerificationType.AML_SANCTIONS);

    const missingChecks = [];

    // Check if KYC verification exists and is approved
    if (!kycCheck) {
      missingChecks.push('KYC_DIRECTORS_AND_UBOS');
    } else if (kycCheck.status !== VerificationStatus.APPROVED) {
      return {
        kycApproved: false,
        needsAdditionalChecks: true,
        kycStatus: kycCheck.kycStatus,
        missingChecks: ['KYC_APPROVAL_REQUIRED']
      };
    }

    // Check if AML checks exist and are clear
    if (!amlCheck) {
      missingChecks.push('AML_SANCTIONS_SCREENING');
    } else if (amlCheck.status !== VerificationStatus.APPROVED) {
      return {
        kycApproved: false,
        needsAdditionalChecks: true,
        kycStatus: kycCheck?.kycStatus,
        missingChecks: ['AML_CLEARANCE_REQUIRED']
      };
    }

    // Check KYC decision if present
    if (kycCheck?.kycDecision?.status === 'REJECTED') {
      return {
        kycApproved: false,
        needsAdditionalChecks: false,
        kycStatus: KycStatus.REJECTED,
        missingChecks: ['KYC_REJECTED']
      };
    }

    if (kycCheck?.kycDecision?.status === 'REQUIRES_ADDITIONAL_INFO') {
      return {
        kycApproved: false,
        needsAdditionalChecks: true,
        kycStatus: KycStatus.ADDITIONAL_INFO_REQUIRED,
        missingChecks: kycCheck.kycDecision.additionalInfoRequired || []
      };
    }

    return {
      kycApproved: missingChecks.length === 0 && (!kycCheck || kycCheck.kycDecision?.status === 'APPROVED'),
      needsAdditionalChecks: missingChecks.length > 0,
      kycStatus: kycCheck?.kycStatus,
      missingChecks
    };
  }

  private async queueAdditionalKycChecks(brokerId: string): Promise<void> {
    this.logger.log(`Queueing additional KYC/AML checks for broker ${brokerId}`);

    // Queue director verification
    await this.verificationQueue.add('verify-directors', {
      brokerId,
      checkType: 'comprehensive'
    });

    // Queue AML sanctions screening
    await this.verificationQueue.add('verify-documents', {
      brokerId,
      documentTypes: ['sanctions_screening', 'pep_screening', 'adverse_media']
    });

    // Set KYC status to in progress
    const kycVerification = await this.verificationRepository.findOne({
      where: {
        brokerId,
        verificationType: VerificationType.KYC_DIRECTORS
      }
    });

    if (kycVerification) {
      kycVerification.kycStatus = KycStatus.IN_PROGRESS;
      await this.verificationRepository.save(kycVerification);
    }
  }

  private async queueForManualReview(verificationData: FSCAVerificationDto): Promise<void> {
    this.logger.log(`Queueing manual review for FSCA license: ${verificationData.fscaLicenseNumber}`);

    // Create verification record for manual review
    const verification = this.verificationRepository.create({
      brokerId: verificationData.brokerId,
      verificationType: VerificationType.MANUAL_REVIEW,
      status: VerificationStatus.PENDING,
      documents: [{
        type: 'FSCA_LICENSE_APPLICATION',
        url: null,
        uploadedAt: new Date(),
        verified: false,
      }],
    });

    await this.verificationRepository.save(verification);

    // Queue manual review job
    await this.verificationQueue.add('manual-review', {
      verificationId: verification.id,
      brokerId: verificationData.brokerId,
      fscaLicenseNumber: verificationData.fscaLicenseNumber,
      registrationNumber: verificationData.registrationNumber,
      verificationData,
    });
  }
}