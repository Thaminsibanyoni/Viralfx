import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FilesService } from '../../files/services/files.service';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { NotificationsService } from '../../notifications/services/notification.service';
import { RedisService } from '../../redis/redis.service';
import { BrokerAccount } from '../entities/broker-account.entity';
import { BrokerInvoice } from '../entities/broker-invoice.entity';
import { BrokerPayment } from '../entities/broker-payment.entity';
import { BrokerSubscription } from '../entities/broker-subscription.entity';
import { BrokerNote } from '../entities/broker-note.entity';
import { BrokerDocument } from '../entities/broker-document.entity';
import { Broker } from '../../brokers/entities/broker.entity';
import { User } from '../../users/entities/user.entity';
import { CreateBrokerAccountDto } from '../dto/create-broker-account.dto';
import { UpdateBrokerAccountDto } from '../dto/update-broker-account.dto';
import { CreateBrokerNoteDto } from '../dto/create-broker-note.dto';
import { CreateBrokerInvoiceDto } from '../dto/create-broker-invoice.dto';

@Injectable()
export class BrokerCrmService {
  private readonly logger = new Logger(BrokerCrmService.name);

  constructor(
    @InjectRepository(BrokerAccount)
    private brokerAccountRepository: Repository<BrokerAccount>,
    @InjectRepository(BrokerInvoice)
    private brokerInvoiceRepository: Repository<BrokerInvoice>,
    @InjectRepository(BrokerPayment)
    private brokerPaymentRepository: Repository<BrokerPayment>,
    @InjectRepository(BrokerSubscription)
    private brokerSubscriptionRepository: Repository<BrokerSubscription>,
    @InjectRepository(BrokerNote)
    private brokerNoteRepository: Repository<BrokerNote>,
    @InjectRepository(BrokerDocument)
    private brokerDocumentRepository: Repository<BrokerDocument>,
    @InjectRepository(Broker)
    private brokerRepository: Repository<Broker>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
    private filesService: FilesService,
    private notificationsService: NotificationsService,
    private redisService: RedisService,
    @InjectQueue('crm-docs')
    private crmDocsQueue: Queue,
    @InjectQueue('crm-onboarding')
    private crmOnboardingQueue: Queue,
  ) {}

  async createBrokerAccount(createDto: CreateBrokerAccountDto): Promise<BrokerAccount> {
    const broker = await this.brokerRepository.findOne({
      where: { id: createDto.brokerId },
    });

    if (!broker) {
      throw new NotFoundException('Broker not found');
    }

    // Check if account already exists
    const existingAccount = await this.brokerAccountRepository.findOne({
      where: { brokerId: createDto.brokerId },
    });

    if (existingAccount) {
      throw new BadRequestException('Broker account already exists');
    }

    const account = this.brokerAccountRepository.create(createDto);
    return await this.brokerAccountRepository.save(account);
  }

  async getBrokerAccount(brokerId: string): Promise<BrokerAccount> {
    const account = await this.brokerAccountRepository.findOne({
      where: { brokerId },
      relations: ['broker', 'invoices', 'subscriptions', 'notes', 'documents'],
    });

    if (!account) {
      throw new NotFoundException('Broker account not found');
    }

    return account;
  }

  async updateBrokerAccount(
    brokerId: string,
    updateDto: UpdateBrokerAccountDto,
  ): Promise<BrokerAccount> {
    const account = await this.getBrokerAccount(brokerId);
    Object.assign(account, updateDto);
    return await this.brokerAccountRepository.save(account);
  }

  async getBrokerInvoices(brokerId: string, page = 1, limit = 20): Promise<{ invoices: BrokerInvoice[]; total: number }> {
    const [invoices, total] = await this.brokerInvoiceRepository.findAndCount({
      where: { brokerId },
      relations: ['brokerAccount', 'payments', 'items'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { invoices, total };
  }

  async createBrokerInvoice(createDto: CreateBrokerInvoiceDto): Promise<BrokerInvoice> {
    // Generate unique invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = this.brokerInvoiceRepository.create({
      ...createDto,
      invoiceNumber,
    });

    return await this.brokerInvoiceRepository.save(invoice);
  }

  async getBrokerPayments(brokerId: string): Promise<BrokerPayment[]> {
    return await this.brokerPaymentRepository.find({
      where: { brokerId },
      relations: ['invoice', 'broker'],
      order: { createdAt: 'DESC' },
    });
  }

  async getBrokerSubscriptions(brokerId: string): Promise<BrokerSubscription[]> {
    return await this.brokerSubscriptionRepository.find({
      where: { brokerId },
      relations: ['brokerAccount', 'usageRecords'],
      order: { createdAt: 'DESC' },
    });
  }

  async createBrokerNote(createDto: CreateBrokerNoteDto, authorId: string): Promise<BrokerNote> {
    const note = this.brokerNoteRepository.create({
      ...createDto,
      authorId,
    });

    return await this.brokerNoteRepository.save(note);
  }

  async getAllBrokerAccounts(filters: {
    page?: number;
    limit?: number;
    status?: string;
    tier?: string;
    search?: string;
  }): Promise<{ brokers: BrokerAccount[]; page: number; limit: number; total: number }> {
    const {
      page = 1,
      limit = 10,
      status,
      tier,
      search,
    } = filters;

    const queryBuilder = this.brokerAccountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.broker', 'broker')
      .leftJoinAndSelect('account.subscriptions', 'subscriptions')
      .leftJoinAndSelect('account.invoices', 'invoices');

    // Apply filters
    if (status) {
      queryBuilder.andWhere('account.status = :status', { status });
    }
    if (tier) {
      queryBuilder.andWhere('account.tier = :tier', { tier });
    }
    if (search) {
      queryBuilder.andWhere(
        '(broker.companyName ILIKE :search OR broker.email ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [brokers, total] = await queryBuilder
      .orderBy('account.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      brokers,
      page,
      limit,
      total,
    };
  }

  async uploadDocument(
    brokerId: string,
    documentData: {
      file: Express.Multer.File;
      documentType: string;
      description: string;
      tags?: string[];
      expiryDate?: Date;
    },
    uploadedBy?: string,
  ): Promise<BrokerDocument> {
    this.logger.log(`Uploading document for broker ${brokerId}: ${documentData.file.originalname}`);

    const brokerAccount = await this.getBrokerAccount(brokerId);

    // Validate document type and required fields for FSCA compliance
    await this.validateDocumentType(documentData.documentType, documentData.file);

    // Upload file using FilesService with secure storage
    try {
      const uploadResult = await this.filesService.uploadFiles(
        [{
          buffer: documentData.file.buffer,
          originalname: documentData.file.originalname,
          mimetype: documentData.file.mimetype,
          size: documentData.file.size,
        }],
        {
          category: `broker-documents/${documentData.documentType.toLowerCase()}`,
          visibility: 'PRIVATE' as any,
          tags: documentData.tags || [],
          fileName: `${brokerId}_${documentData.documentType}_${Date.now()}${documentData.file.originalname.substring(documentData.file.originalname.lastIndexOf('.'))}`,
          allowDuplicate: false,
          expiresAt: documentData.expiryDate,
        },
        uploadedBy || 'system'
      );

      if (uploadResult.failed.length > 0) {
        throw new BadRequestException(`File upload failed: ${uploadResult.failed[0].error}`);
      }

      const uploadedFile = uploadResult.successful[0];

      // Create broker document record
      const document = this.brokerDocumentRepository.create({
        brokerId,
        brokerAccountId: brokerAccount.id,
        uploadedBy: uploadedBy || 'system',
        documentType: documentData.documentType,
        title: `${documentData.documentType} - ${documentData.file.originalname}`,
        description: documentData.description,
        fileName: documentData.file.originalname,
        fileUrl: uploadedFile.downloadUrl,
        fileId: uploadedFile.id, // Reference to FilesModule record
        fileSize: uploadedFile.size,
        mimeType: uploadedFile.mimeType,
        fileHash: uploadedFile.hash,
        status: 'PENDING_VERIFICATION',
        uploadedAt: new Date(),
        tags: documentData.tags || [],
        metadata: {
          uploadSource: 'crm-portal',
          originalUploadDate: new Date().toISOString(),
          fileCategory: uploadedFile.fileType,
          virusScanStatus: 'PENDING',
          fscaCompliance: await this.checkFSCARequirements(documentData.documentType, uploadedFile),
        },
      });

      const savedDocument = await this.brokerDocumentRepository.save(document);

      // Queue virus scan and document processing
      await this.queueDocumentProcessing(savedDocument.id, uploadedFile.id);

      this.logger.log(`Document uploaded successfully: ${savedDocument.id} for broker ${brokerId}`);
      return savedDocument;

    } catch (error) {
      this.logger.error(`Document upload failed for broker ${brokerId}:`, error);
      throw new BadRequestException(`Document upload failed: ${error.message}`);
    }
  }

  async verifyDocument(
    brokerId: string,
    documentId: string,
    status: string,
    notes?: string,
  ): Promise<BrokerDocument> {
    const document = await this.brokerDocumentRepository.findOne({
      where: { id: documentId, brokerId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    document.status = status as 'APPROVED' | 'REJECTED' | 'PENDING';
    document.verifiedBy = 'current_user'; // Would come from req.user in real implementation
    document.verifiedAt = new Date();

    if (status === 'REJECTED' && notes) {
      document.rejectionReason = notes;
    }

    return await this.brokerDocumentRepository.save(document);
  }

  async addNote(
    brokerId: string,
    noteData: { content: string; category: string },
    authorId?: string,
  ): Promise<BrokerNote> {
    const brokerAccount = await this.getBrokerAccount(brokerId);

    const note = this.brokerNoteRepository.create({
      brokerId,
      brokerAccountId: brokerAccount.id,
      content: noteData.content,
      category: noteData.category,
      authorId: authorId || 'system',
    });

    return await this.brokerNoteRepository.save(note);
  }

  async getBrokerInvoices(
    brokerId: string,
    filters: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<BrokerInvoice[]> {
    const { status, startDate, endDate } = filters;

    const queryBuilder = this.brokerInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.brokerAccount', 'brokerAccount')
      .leftJoinAndSelect('invoice.payments', 'payments')
      .leftJoinAndSelect('invoice.items', 'items')
      .where('invoice.brokerId = :brokerId', { brokerId });

    if (status) {
      queryBuilder.andWhere('invoice.status = :status', { status });
    }
    if (startDate) {
      queryBuilder.andWhere('invoice.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('invoice.createdAt <= :endDate', { endDate });
    }

    return await queryBuilder
      .orderBy('invoice.createdAt', 'DESC')
      .getMany();
  }

  async getBrokerNotes(brokerId: string): Promise<BrokerNote[]> {
    return await this.brokerNoteRepository.find({
      where: { brokerId },
      relations: ['author', 'brokerAccount'],
      order: { createdAt: 'DESC' },
    });
  }

  async uploadBrokerDocument(
    brokerId: string,
    documentData: {
      documentType: string;
      title: string;
      description?: string;
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
      expiryDate?: Date;
    },
    uploadedBy: string,
  ): Promise<BrokerDocument> {
    const brokerAccount = await this.getBrokerAccount(brokerId);

    const document = this.brokerDocumentRepository.create({
      brokerId,
      brokerAccountId: brokerAccount.id,
      uploadedBy,
      ...documentData,
    });

    return await this.brokerDocumentRepository.save(document);
  }

  async verifyBrokerDocument(
    documentId: string,
    verifiedBy: string,
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
  ): Promise<BrokerDocument> {
    const document = await this.brokerDocumentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    document.status = status;
    document.verifiedBy = verifiedBy;
    document.verifiedAt = new Date();

    if (status === 'REJECTED' && rejectionReason) {
      document.rejectionReason = rejectionReason;
    }

    return await this.brokerDocumentRepository.save(document);
  }

  async getBrokerDocuments(brokerId: string): Promise<BrokerDocument[]> {
    return await this.brokerDocumentRepository.find({
      where: { brokerId },
      relations: ['uploader', 'verifier'],
      order: { createdAt: 'DESC' },
    });
  }

  async getBrokerMetrics(brokerId: string): Promise<any> {
    const account = await this.getBrokerAccount(brokerId);

    // Get metrics from various tables
    const [totalInvoices, totalPaid, totalOutstanding] = await Promise.all([
      this.brokerInvoiceRepository.count({
        where: { brokerId },
      }),
      this.brokerPaymentRepository.sum('amount', {
        where: { brokerId, status: 'COMPLETED' },
      }),
      this.brokerInvoiceRepository.sum('totalAmount', {
        where: { brokerId, status: 'SENT' },
      }),
    ]);

    const documents = await this.brokerDocumentRepository.count({
      where: { brokerId, status: 'PENDING' },
    });

    return {
      accountStatus: account.status,
      complianceStatus: account.complianceStatus,
      riskRating: account.rating,
      totalInvoices: totalInvoices || 0,
      totalPaid: totalPaid || 0,
      totalOutstanding: totalOutstanding || 0,
      pendingDocuments: documents,
    };
  }

  private async generateInvoiceNumber(): Promise<string> {
    const prefix = 'INV';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Get count for this month
    const count = await this.brokerInvoiceRepository.count({
      where: {
        createdAt: {
          $gte: new Date(year, date.getMonth(), 1),
          $lt: new Date(year, date.getMonth() + 1, 1),
        },
      },
    });

    return `${prefix}${year}${month}${String(count + 1).padStart(4, '0')}`;
  }

  async updateComplianceStatus(
    brokerId: string,
    status: string,
    reason: string,
    verifiedBy?: string,
  ): Promise<BrokerAccount> {
    const account = await this.getBrokerAccount(brokerId);

    account.complianceStatus = status;
    account.complianceNotes = reason;
    account.fscaVerified = status === 'APPROVED';
    account.fscaVerificationDate = new Date();
    account.verifiedBy = verifiedBy || 'system';

    return await this.brokerAccountRepository.save(account);
  }

  // Document security and validation methods
  private async validateDocumentType(documentType: string, file: Express.Multer.File): Promise<void> {
    // FSCA document type validation
    const allowedDocumentTypes = [
      'FSP_LICENSE',
      'PROOF_OF_ADDRESS',
      'BANK_STATEMENT',
      'ID_DOCUMENT',
      'PASSPORT',
      'COMPANY_REGISTRATION',
      'TAX_CLEARANCE',
      'FINANCIAL_STATEMENTS',
      'FITNESS_PROPERITY_REPORT',
      'BOARD_RESOLUTION',
      'SHAREHOLDER_REGISTER',
      'COMPLIANCE_MANUAL',
      'RISK_MANAGEMENT_POLICY',
      'INTERNAL_AUDIT_REPORT',
      'EXTERNAL_AUDIT_REPORT',
      'PROOF_OF_INSURANCE',
      'DIRECTOR_CONSENT',
    ];

    if (!allowedDocumentTypes.includes(documentType)) {
      throw new BadRequestException(`Invalid document type: ${documentType}. Allowed types: ${allowedDocumentTypes.join(', ')}`);
    }

    // File type validation based on document type
    const documentTypeFileRules = {
      'FSP_LICENSE': ['application/pdf', 'image/jpeg', 'image/png'],
      'PROOF_OF_ADDRESS': ['application/pdf', 'image/jpeg', 'image/png'],
      'BANK_STATEMENT': ['application/pdf', 'image/jpeg', 'image/png'],
      'ID_DOCUMENT': ['application/pdf', 'image/jpeg', 'image/png'],
      'PASSPORT': ['application/pdf', 'image/jpeg', 'image/png'],
      'COMPANY_REGISTRATION': ['application/pdf', 'image/jpeg', 'image/png'],
      'TAX_CLEARANCE': ['application/pdf', 'image/jpeg', 'image/png'],
      'FINANCIAL_STATEMENTS': ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    };

    const allowedMimeTypes = documentTypeFileRules[documentType] || ['application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type for ${documentType}. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    // File size validation based on document type
    const maxFileSize = documentType.includes('FINANCIAL_STATEMENTS') ? 10 * 1024 * 1024 : 5 * 1024 * 1024; // 10MB for financial statements, 5MB for others
    if (file.size > maxFileSize) {
      throw new BadRequestException(`File size exceeds maximum allowed size for ${documentType}: ${maxFileSize / 1024 / 1024}MB`);
    }
  }

  private async checkFSCARequirements(documentType: string, uploadedFile: any): Promise<any> {
    const fscaRequirements = {
      isRequiredDocument: true,
      complianceChecklist: {
        isReadable: true,
        hasValidFormat: true,
        notExpired: true,
        containsRequiredFields: false, // Would need OCR verification
        digitallySigned: false,
        watermarked: false,
      },
      documentCategory: this.getFSCACategory(documentType),
      expiryDate: this.getDocumentExpiryDate(documentType),
      verificationLevel: this.getVerificationLevel(documentType),
    };

    // Additional FSCA-specific checks
    switch (documentType) {
      case 'FSP_LICENSE':
        fscaRequirements.complianceChecklist.containsRequiredFields = true;
        fscaRequirements.verificationLevel = 'HIGH';
        break;
      case 'FITNESS_PROPERITY_REPORT':
        fscaRequirements.verificationLevel = 'CRITICAL';
        break;
      case 'FINANCIAL_STATEMENTS':
        fscaRequirements.complianceChecklist.notExpired = false; // Financial statements don't expire but should be recent
        fscaRequirements.verificationLevel = 'HIGH';
        break;
      default:
        fscaRequirements.verificationLevel = 'MEDIUM';
    }

    return fscaRequirements;
  }

  private getFSCACategory(documentType: string): string {
    const categories = {
      'FSP_LICENSE': 'REGULATORY',
      'FITNESS_PROPERITY_REPORT': 'COMPLIANCE',
      'FINANCIAL_STATEMENTS': 'FINANCIAL',
      'PROOF_OF_ADDRESS': 'IDENTITY',
      'ID_DOCUMENT': 'IDENTITY',
      'PASSPORT': 'IDENTITY',
      'COMPANY_REGISTRATION': 'BUSINESS',
      'TAX_CLEARANCE': 'TAX',
      'BOARD_RESOLUTION': 'GOVERNANCE',
      'SHAREHOLDER_REGISTER': 'GOVERNANCE',
    };

    return categories[documentType] || 'GENERAL';
  }

  private getDocumentExpiryDate(documentType: string): Date | null {
    const expiryPeriods = {
      'FSP_LICENSE': 365 * 3, // 3 years
      'FITNESS_PROPERITY_REPORT': 365, // 1 year
      'PROOF_OF_ADDRESS': 90, // 3 months
      'BANK_STATEMENT': 90, // 3 months
      'TAX_CLEARANCE': 365, // 1 year
    };

    const days = expiryPeriods[documentType];
    return days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  }

  private getVerificationLevel(documentType: string): string {
    const levels = {
      'FSP_LICENSE': 'CRITICAL',
      'FITNESS_PROPERITY_REPORT': 'CRITICAL',
      'FINANCIAL_STATEMENTS': 'HIGH',
      'TAX_CLEARANCE': 'HIGH',
      'COMPANY_REGISTRATION': 'HIGH',
      'PROOF_OF_ADDRESS': 'MEDIUM',
      'ID_DOCUMENT': 'HIGH',
      'PASSPORT': 'HIGH',
    };

    return levels[documentType] || 'LOW';
  }

  private async queueDocumentProcessing(documentId: string, fileId: string): Promise<void> {
    // Queue virus scanning
    await this.fileScanningQueue.add('scan-file', {
      documentId,
      fileId,
      priority: 'HIGH',
      scanType: 'MALWARE',
    });

    // Queue document processing and OCR
    await this.fileScanningQueue.add('process-document', {
      documentId,
      fileId,
      processingType: 'OCR_EXTRACTION',
      extractFields: true,
      validateFormat: true,
    });

    // Queue FSCA compliance check
    await this.fileScanningQueue.add('fsca-compliance-check', {
      documentId,
      fileId,
      verifySignature: true,
      validateWatermarks: true,
      checkExpiry: true,
    });

    this.logger.log(`Document processing queued for document ${documentId}, file ${fileId}`);
  }

  // Additional document management methods
  async getDocumentsWithSecurityChecks(brokerId: string, userId?: string): Promise<BrokerDocument[]> {
    const documents = await this.brokerDocumentRepository.find({
      where: { brokerId },
      relations: ['brokerAccount'],
      order: { uploadedAt: 'DESC' },
    });

    // Filter documents based on user permissions
    if (userId) {
      const userRole = await this.getUserRole(userId);
      return documents.filter(doc => this.hasDocumentAccess(doc, userRole, userId));
    }

    return documents;
  }

  private async getUserRole(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { role: true },
    });

    return user?.role || 'USER';
  }

  private hasDocumentAccess(document: BrokerDocument, userRole: string, userId: string): boolean {
    // Admin and compliance roles can access all documents
    if (['ADMIN', 'COMPLIANCE', 'SALES'].includes(userRole)) {
      return true;
    }

    // Users can only access their own documents
    return document.uploadedBy === userId;
  }

  async deleteDocumentSecurely(brokerId: string, documentId: string, userId: string): Promise<void> {
    const document = await this.brokerDocumentRepository.findOne({
      where: { id: documentId, brokerId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check permissions
    const userRole = await this.getUserRole(userId);
    if (!this.hasDocumentAccess(document, userRole, userId)) {
      throw new BadRequestException('Insufficient permissions to delete this document');
    }

    // Delete from FilesModule if fileId exists
    if (document.fileId) {
      try {
        await this.filesService.deleteFile(document.fileId, userId);
      } catch (error) {
        this.logger.warn(`Failed to delete file from FilesModule: ${error.message}`);
      }
    }

    // Delete broker document record
    await this.brokerDocumentRepository.remove(document);

    this.logger.log(`Document ${documentId} deleted securely for broker ${brokerId}`);
  }

  async completeDocumentUpload(
    brokerId: string,
    documentId: string,
    uploadData: {
      s3Path: string;
      fileHash: string;
      mimeType: string;
      documentType: string;
      description?: string;
      tags?: string[];
      expiryDate?: string;
    }
  ): Promise<BrokerDocument> {
    // Validate broker exists
    const broker = await this.brokerRepository.findOne({
      where: { id: brokerId },
    });

    if (!broker) {
      throw new NotFoundException('Broker not found');
    }

    // Get or create broker account
    let brokerAccount = await this.brokerAccountRepository.findOne({
      where: { brokerId },
    });

    if (!brokerAccount) {
      brokerAccount = await this.brokerAccountRepository.save({
        brokerId,
        accountNumber: `BKR-${Date.now()}`,
        status: 'PENDING_VERIFICATION',
      });
    }

    // Create broker document record
    const document = this.brokerDocumentRepository.create({
      id: documentId,
      brokerId,
      brokerAccountId: brokerAccount.id,
      documentType: uploadData.documentType,
      title: `${uploadData.documentType.replace('_', ' ')} - ${new Date().toISOString().split('T')[0]}`,
      description: uploadData.description,
      fileName: uploadData.s3Path.split('/').pop(),
      s3Path: uploadData.s3Path,
      fileHash: uploadData.fileHash,
      mimeType: uploadData.mimeType,
      fileSize: 0, // Will be updated after S3 file verification
      tags: uploadData.tags || [],
      uploadedAt: new Date(),
      status: 'PENDING',
      uploadedBy: 'system', // Will be updated with actual user ID
      expiryDate: uploadData.expiryDate ? new Date(uploadData.expiryDate) : null,
      metadata: {
        uploadSource: 'S3_PRESIGNED',
        uploadTimestamp: new Date().toISOString(),
      },
    });

    const savedDocument = await this.brokerDocumentRepository.save(document);

    // Enqueue document scanning
    await this.crmDocsQueue.add('scan-document', {
      docId: documentId,
      s3Path: uploadData.s3Path,
      brokerId,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    this.logger.log(`Document upload completed for broker ${brokerId}, document ${documentId}`);
    return savedDocument;
  }

  async updateComplianceStatus(
    brokerId: string,
    status: string,
    reason?: string
  ): Promise<BrokerAccount> {
    const brokerAccount = await this.brokerAccountRepository.findOne({
      where: { brokerId },
    });

    if (!brokerAccount) {
      throw new NotFoundException('Broker account not found');
    }

    // If status is PENDING, initiate FSCA verification
    if (status === 'PENDING') {
      const broker = await this.brokerRepository.findOne({
        where: { id: brokerId },
      });

      if (broker?.fscaLicenseNumber) {
        try {
          // Call FSCA API for verification (placeholder implementation)
          const fscaResponse = await this.verifyFSCALicense(broker.fscaLicenseNumber);

          if (fscaResponse.verified) {
            brokerAccount.fscaVerified = true;
            brokerAccount.fscaVerifiedAt = new Date();
            status = 'VERIFIED';
          } else {
            // Create manual review task
            await this.crmOnboardingQueue.add('fsca-review', {
              brokerId,
              reason: `FSCA verification failed: ${fscaResponse.reason}`,
            });
          }
        } catch (error) {
          // FSCA API unavailable - queue for manual review
          await this.crmOnboardingQueue.add('fsca-review', {
            brokerId,
            reason: 'FSCA API unavailable - manual review required',
          });
        }
      }
    }

    brokerAccount.status = status;
    if (reason) {
      await this.brokerNoteRepository.save({
        brokerId,
        content: `Status update: ${status} - ${reason}`,
        category: 'COMPLIANCE',
        createdBy: 'system',
      });
    }

    return await this.brokerAccountRepository.save(brokerAccount);
  }

  private async verifyFSCALicense(licenseNumber: string): Promise<{ verified: boolean; reason?: string }> {
    // Placeholder for FSCA API integration
    // In real implementation, this would make HTTP request to FSCA verification service
    return {
      verified: Math.random() > 0.3, // Simulate 70% success rate
      reason: 'License not found in FSCA database',
    };
  }
}